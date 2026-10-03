import type { Prediction } from "../domain/observation";
import { benchmark, classify, getModel } from "./microModel";

export interface ClassificationResult {
  predictions: Prediction[];
  inferenceMs: number;
}

export const activeClassifier = {
  name: "Guestbook Micro v1",
  async warmup() {
    return getModel();
  },
  async classify(text: string): Promise<ClassificationResult> {
    return classify(text);
  },
  benchmark,
};
