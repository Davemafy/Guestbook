import type { SignalLabel } from "./labels";

export type ObservationSource = "guest" | "noor" | "guide";

export interface Prediction {
  label: SignalLabel;
  score: number | null;
  accepted: boolean;
  engine: "keyword-baseline" | "fasttext";
}

export interface Observation {
  id: string;
  visitId: string;
  rawText: string;
  language: string;
  source: ObservationSource;
  createdAt: number;
  predictions: Prediction[];
  confirmedLabels: SignalLabel[];
}
