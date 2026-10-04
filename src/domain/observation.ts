import type { SignalLabel } from "./labels";

export type ObservationSource = "guest" | "operator" | "guide" | "demo";
export type ObservationStatus = "pending" | "confirmed" | "dismissed";

export interface Prediction {
  label: SignalLabel;
  score: number;
  accepted: boolean;
  engine: "guestbook-micro-v1";
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
  status: ObservationStatus;
  isDemo?: boolean;
  mediaDataUrl?: string;
}
