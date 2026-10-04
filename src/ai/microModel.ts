import { LABELS, type SignalLabel } from "../domain/labels";
import type { Prediction } from "../domain/observation";
import { FROZEN_TEST_CASES } from "./trainingData";
import { MODEL_BASE64, MODEL_DIM as DIM, MODEL_THRESHOLD as THRESHOLD, MODEL_WEIGHT_BYTES } from "./pretrained";

interface SparseFeature { index: number; value: number; }
interface LoadedModel { weights: Float32Array; bias: Float32Array; loadMs: number; }

let cachedModel: LoadedModel | null = null;

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function normalizeText(input: string): string {
  return input.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function vectorize(input: string): SparseFeature[] {
  const words = normalizeText(input).match(/[\p{L}\p{N}']+/gu) ?? [];
  const counts = new Map<number, number>();
  for (const word of words) {
    const padded = " " + word + " ";
    for (const n of [3, 4, 5]) {
      if (padded.length < n) continue;
      for (let i = 0; i <= padded.length - n; i++) {
        const index = fnv1a(padded.slice(i, i + n)) % DIM;
        counts.set(index, (counts.get(index) ?? 0) + 1);
      }
    }
  }
  const raw: SparseFeature[] = [];
  let normSq = 0;
  for (const [index, count] of counts) {
    const value = 1 + Math.log(count);
    raw.push({ index, value });
    normSq += value * value;
  }
  const norm = Math.sqrt(normSq) || 1;
  return raw.map((feature) => ({ index: feature.index, value: feature.value / norm }));
}


const CONTRADICTION_GUARDS: Partial<Record<SignalLabel, RegExp[]>> = {
  PRAISE_EXPERIENCE: [
    /\b(not|wasn['’]?t|isn['’]?t|never)\s+(?:very\s+)?(?:good|great|amazing|excellent|wonderful|beautiful|lovely|fantastic)\b/i,
  ],
  WANT_PRODUCT: [
    /\b(?:do not|don['’]?t|did not|didn['’]?t|never)\s+(?:want|need|plan|intend)(?:\s+to)?\s+(?:buy|purchase|order|take)\b/i,
    /\b(?:not buying|no need to buy|not interested in buying)\b/i,
  ],
  WANT_ACTIVITY: [
    /\b(?:do not|don['’]?t|did not|didn['’]?t|never)\s+(?:want|need|plan|intend)(?:\s+to)?\s+(?:try|join|do|take part|participate)\b/i,
  ],
  WANT_BOOKING: [
    /\b(?:do not|don['’]?t|did not|didn['’]?t|never)\s+(?:want|need|plan|intend)(?:\s+to)?\s+(?:book|reserve|visit|come)\b/i,
    /\b(?:not booking|no booking|cancel(?:led)? the booking)\b/i,
  ],
  FRICTION_ACCESS: [
    /\b(?:not|wasn['’]?t|isn['’]?t)\s+(?:hard|difficult)\s+to\s+(?:find|reach|get to)\b/i,
    /\b(?:did not|didn['’]?t)\s+get\s+lost\b/i,
  ],
  FRICTION_VALUE: [
    /\b(?:not|wasn['’]?t|isn['’]?t)\s+(?:too\s+)?(?:expensive|overpriced|costly)\b/i,
    /\b(?:good|great|fair)\s+value\b/i,
  ],
  FRICTION_EXPECTATION: [
    /\b(?:exactly|just)\s+as\s+(?:advertised|described|shown)\b/i,
    /\b(?:matched|matches)\s+(?:the\s+)?(?:listing|photos|description)\b/i,
  ],
  REQUIREMENT_ACCESSIBILITY: [
    /\b(?:no|without)\s+(?:mobility|accessibility)\s+(?:issue|issues|needs|problem|problems)\b/i,
    /\b(?:can|could)\s+walk\s+(?:fine|easily|without trouble)\b/i,
  ],
  REQUIREMENT_DIETARY_SAFETY: [
    /\b(?:no|without)\s+(?:food\s+)?(?:allergies|allergy|dietary restrictions|dietary needs)\b/i,
    /\b(?:not|isn['’]?t|wasn['’]?t)\s+allergic\b/i,
  ],
  COMMUNICATION_GAP: [
    /\b(?:understood|understand)\s+(?:everything|clearly|the explanation)\b/i,
    /\b(?:nothing|none of it)\s+was\s+confusing\b/i,
  ],
  RETURN_REFERRAL: [
    /\b(?:would not|wouldn['’]?t|will not|won['’]?t|do not|don['’]?t)\s+(?:return|come again|recommend|bring)\b/i,
  ],
};

function contradicts(label: SignalLabel, text: string): boolean {
  return CONTRADICTION_GUARDS[label]?.some((pattern) => pattern.test(text)) ?? false;
}

const CONTRADICTION_GUARD_CASES: Array<{ text: string; blocked: SignalLabel }> = [
  { text: "I don't want to buy coffee beans.", blocked: "WANT_PRODUCT" },
  { text: "We are not booking a visit this weekend.", blocked: "WANT_BOOKING" },
  { text: "It wasn't expensive at all.", blocked: "FRICTION_VALUE" },
  { text: "We did not get lost and the farm was easy to find.", blocked: "FRICTION_ACCESS" },
  { text: "It was exactly as advertised.", blocked: "FRICTION_EXPECTATION" },
  { text: "I have no food allergies or dietary restrictions.", blocked: "REQUIREMENT_DIETARY_SAFETY" },
  { text: "I can walk fine and have no mobility issues.", blocked: "REQUIREMENT_ACCESSIBILITY" },
  { text: "I understood everything clearly.", blocked: "COMMUNICATION_GAP" },
  { text: "I wouldn't recommend this to my friends.", blocked: "RETURN_REFERRAL" },
];

function sigmoid(value: number): number {
  const clipped = Math.max(-30, Math.min(30, value));
  return 1 / (1 + Math.exp(-clipped));
}

function decodeModel(): LoadedModel {
  if (cachedModel) return cachedModel;
  const started = performance.now();
  const binary = atob(MODEL_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const floats = new Float32Array(bytes.buffer);
  const weightCount = LABELS.length * DIM;
  cachedModel = {
    weights: floats.subarray(0, weightCount),
    bias: floats.subarray(weightCount, weightCount + LABELS.length),
    loadMs: performance.now() - started,
  };
  return cachedModel;
}

export async function getModel(): Promise<LoadedModel> {
  return decodeModel();
}

function scoreText(model: LoadedModel, text: string): Array<{ label: SignalLabel; score: number }> {
  const featureRow = vectorize(text);
  return LABELS.map((label, classIndex) => {
    const offset = classIndex * DIM;
    let z = model.bias[classIndex];
    for (const feature of featureRow) z += model.weights[offset + feature.index] * feature.value;
    return { label, score: sigmoid(z) };
  }).sort((a, b) => b.score - a.score);
}

export async function classify(text: string): Promise<{ predictions: Prediction[]; inferenceMs: number }> {
  const model = decodeModel();
  const started = performance.now();
  const scores = scoreText(model, text);
  const inferenceMs = performance.now() - started;
  const accepted = scores
    .filter((item) => item.label !== "UNKNOWN" && item.score >= THRESHOLD && !contradicts(item.label, text))
    .map((item) => ({ ...item, accepted: true, engine: "guestbook-micro-v1" as const }));

  if (accepted.length) return { predictions: accepted, inferenceMs };
  const unknownScore = scores.find((item) => item.label === "UNKNOWN")?.score ?? 0;
  return {
    predictions: [{ label: "UNKNOWN", score: Math.max(unknownScore, scores[0]?.score ?? 0), accepted: false, engine: "guestbook-micro-v1" }],
    inferenceMs,
  };
}

export async function benchmark() {
  const model = decodeModel();
  let tp = 0, fp = 0, fn = 0, exact = 0;
  const latencies: number[] = [];
  for (const testCase of FROZEN_TEST_CASES) {
    const started = performance.now();
    const scores = scoreText(model, testCase.text);
    latencies.push(performance.now() - started);
    const predicted = new Set<SignalLabel>(
      scores.filter((item) => item.label !== "UNKNOWN" && item.score >= THRESHOLD).map((item) => item.label)
    );
    if (!predicted.size) predicted.add("UNKNOWN");
    const expected = new Set(testCase.labels);
    if (predicted.size === expected.size && [...predicted].every((label) => expected.has(label))) exact++;
    for (const label of LABELS) {
      const p = predicted.has(label), y = expected.has(label);
      if (p && y) tp++;
      if (p && !y) fp++;
      if (!p && y) fn++;
    }
  }
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1 = (2 * precision * recall) / Math.max(1e-9, precision + recall);
  latencies.sort((a, b) => a - b);
  const contradictionGuardPassed = CONTRADICTION_GUARD_CASES.filter(({ text, blocked }) => contradicts(blocked, text)).length;
  return {
    cases: FROZEN_TEST_CASES.length,
    precision, recall, f1,
    exactMatch: exact / FROZEN_TEST_CASES.length,
    contradictionGuardCases: CONTRADICTION_GUARD_CASES.length,
    contradictionGuardPassed,
    medianInferenceMs: latencies[Math.floor(latencies.length / 2)] ?? 0,
    loadMs: model.loadMs,
    weightBytes: MODEL_WEIGHT_BYTES,
    dimensions: DIM,
    threshold: THRESHOLD,
    note: "Frozen synthetic stress set. Useful for regression testing, not a field-performance claim.",
  };
}
