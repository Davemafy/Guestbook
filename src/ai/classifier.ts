import type { Prediction } from "../domain/observation";
import { keywordBaseline } from "./baseline";

export interface Classifier {
  name: string;
  classify(text: string): Promise<Prediction[]>;
}

export const baselineClassifier: Classifier = {
  name: "Keyword baseline",
  async classify(text) {
    return keywordBaseline(text);
  },
};

// The fastText/WASM implementation replaces this in the critical path only
// after we have real train/dev/test data and calibrated thresholds.
export const activeClassifier = baselineClassifier;
