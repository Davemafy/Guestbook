import { LABELS, type SignalLabel } from "../domain/labels";
import type { Prediction } from "../domain/observation";
import { FROZEN_TEST_CASES, TRAINING_CASES } from "./trainingData";

const DIM = 2048;
const EPOCHS = 40;
const THRESHOLD = 0.5;
const LR0 = 0.3;
const L2 = 1e-5;

interface SparseFeature {
  index: number;
  value: number;
}

interface TrainedModel {
  weights: Float32Array;
  bias: Float32Array;
  trainingMs: number;
}

let modelPromise: Promise<TrainedModel> | null = null;

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function charNgrams(input: string): string[] {
  const words = normalizeText(input).match(/[\p{L}\p{N}']+/gu) ?? [];
  const grams: string[] = [];
  for (const word of words) {
    const padded = " " + word + " ";
    for (const n of [3, 4, 5]) {
      if (padded.length < n) continue;
      for (let i = 0; i <= padded.length - n; i++) {
        grams.push(padded.slice(i, i + n));
      }
    }
  }
  return grams;
}

function vectorize(input: string): SparseFeature[] {
  const counts = new Map<number, number>();
  for (const gram of charNgrams(input)) {
    const index = fnv1a(gram) % DIM;
    counts.set(index, (counts.get(index) ?? 0) + 1);
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

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffleDeterministic(values: number[], random: () => number) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const current = values[i];
    values[i] = values[j];
    values[j] = current;
  }
}

async function train(): Promise<TrainedModel> {
  const started = performance.now();
  const features = TRAINING_CASES.map((item) => vectorize(item.text));
  const labelIndex = new Map<SignalLabel, number>(LABELS.map((label, index) => [label, index]));
  const positives = new Float32Array(LABELS.length);

  for (const item of TRAINING_CASES) {
    for (const label of item.labels) {
      positives[labelIndex.get(label)!] += 1;
    }
  }

  const weights = new Float32Array(LABELS.length * DIM);
  const bias = new Float32Array(LABELS.length);
  const order = Array.from({ length: TRAINING_CASES.length }, (_, i) => i);
  const random = seededRandom(42);
  const total = TRAINING_CASES.length;

  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    shuffleDeterministic(order, random);
    const lr = LR0 / (1 + 0.08 * epoch);

    for (const row of order) {
      const featureRow = features[row];
      const truth = new Set(TRAINING_CASES[row].labels);

      for (let classIndex = 0; classIndex < LABELS.length; classIndex++) {
        const offset = classIndex * DIM;
        let z = bias[classIndex];
        for (const feature of featureRow) {
          z += weights[offset + feature.index] * feature.value;
        }

        const y = truth.has(LABELS[classIndex]) ? 1 : 0;
        const positiveCount = Math.max(1, positives[classIndex]);
        const negativeCount = Math.max(1, total - positives[classIndex]);
        const sampleWeight = y ? total / (2 * positiveCount) : total / (2 * negativeCount);
        const gradient = (sigmoid(z) - y) * sampleWeight;

        for (const feature of featureRow) {
          const wi = offset + feature.index;
          weights[wi] -= lr * (gradient * feature.value + L2 * weights[wi]);
        }
        bias[classIndex] -= lr * gradient;
      }
    }

    if (epoch % 8 === 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return { weights, bias, trainingMs: performance.now() - started };
}

export function getModel(): Promise<TrainedModel> {
  if (!modelPromise) modelPromise = train();
  return modelPromise;
}

function scoreText(model: TrainedModel, text: string): Array<{ label: SignalLabel; score: number }> {
  const featureRow = vectorize(text);
  return LABELS.map((label, classIndex) => {
    const offset = classIndex * DIM;
    let z = model.bias[classIndex];
    for (const feature of featureRow) {
      z += model.weights[offset + feature.index] * feature.value;
    }
    return { label, score: sigmoid(z) };
  }).sort((a, b) => b.score - a.score);
}

export async function classify(text: string): Promise<{ predictions: Prediction[]; inferenceMs: number }> {
  const model = await getModel();
  const started = performance.now();
  const scores = scoreText(model, text);
  const inferenceMs = performance.now() - started;

  const accepted = scores
    .filter((item) => item.label !== "UNKNOWN" && item.score >= THRESHOLD)
    .map((item) => ({
      label: item.label,
      score: item.score,
      accepted: true,
      engine: "guestbook-micro-v1" as const,
    }));

  if (accepted.length > 0) {
    return { predictions: accepted, inferenceMs };
  }

  const unknownScore = scores.find((item) => item.label === "UNKNOWN")?.score ?? 0;
  return {
    predictions: [{
      label: "UNKNOWN",
      score: Math.max(unknownScore, scores[0]?.score ?? 0),
      accepted: false,
      engine: "guestbook-micro-v1",
    }],
    inferenceMs,
  };
}

export async function benchmark() {
  const model = await getModel();
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let exact = 0;
  const latencies: number[] = [];

  for (const testCase of FROZEN_TEST_CASES) {
    const started = performance.now();
    const scores = scoreText(model, testCase.text);
    latencies.push(performance.now() - started);

    const predicted = new Set<SignalLabel>(
      scores.filter((item) => item.label !== "UNKNOWN" && item.score >= THRESHOLD).map((item) => item.label)
    );
    if (predicted.size === 0) predicted.add("UNKNOWN");

    const expected = new Set(testCase.labels);
    if (predicted.size === expected.size && [...predicted].every((label) => expected.has(label))) exact += 1;

    for (const label of LABELS) {
      const p = predicted.has(label);
      const y = expected.has(label);
      if (p && y) tp += 1;
      if (p && !y) fp += 1;
      if (!p && y) fn += 1;
    }
  }

  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1 = (2 * precision * recall) / Math.max(1e-9, precision + recall);
  latencies.sort((a, b) => a - b);

  return {
    cases: FROZEN_TEST_CASES.length,
    precision,
    recall,
    f1,
    exactMatch: exact / FROZEN_TEST_CASES.length,
    medianInferenceMs: latencies[Math.floor(latencies.length / 2)] ?? 0,
    trainingMs: model.trainingMs,
    weightBytes: model.weights.byteLength + model.bias.byteLength,
    dimensions: DIM,
    epochs: EPOCHS,
    threshold: THRESHOLD,
    note: "Frozen synthetic stress set. Useful for regression testing, not a field-performance claim.",
  };
}
