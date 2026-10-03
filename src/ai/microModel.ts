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
    .filter((item) => item.label !== "UNKNOWN" && item.score >= THRESHOLD)
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
  return {
    cases: FROZEN_TEST_CASES.length,
    precision, recall, f1,
    exactMatch: exact / FROZEN_TEST_CASES.length,
    medianInferenceMs: latencies[Math.floor(latencies.length / 2)] ?? 0,
    loadMs: model.loadMs,
    weightBytes: MODEL_WEIGHT_BYTES,
    dimensions: DIM,
    threshold: THRESHOLD,
    note: "Frozen synthetic stress set. Useful for regression testing, not a field-performance claim.",
  };
}
