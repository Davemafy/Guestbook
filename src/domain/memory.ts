import type { Observation } from "./observation";
import { LABEL_META, type SignalLabel } from "./labels";

export interface MemorySignal {
  label: SignalLabel;
  title: string;
  description: string;
  visitCount: number;
  observations: Observation[];
}

export function buildMemory(observations: Observation[]): MemorySignal[] {
  const map = new Map<SignalLabel, { visits: Set<string>; observations: Observation[] }>();

  for (const observation of observations) {
    if (observation.status !== "confirmed") continue;
    for (const label of observation.confirmedLabels) {
      if (label === "UNKNOWN") continue;
      const current = map.get(label) ?? { visits: new Set<string>(), observations: [] };
      current.visits.add(observation.visitId);
      current.observations.push(observation);
      map.set(label, current);
    }
  }

  return [...map.entries()]
    .map(([label, value]) => ({
      label,
      title: LABEL_META[label].title,
      description: LABEL_META[label].description,
      visitCount: value.visits.size,
      observations: value.observations,
    }))
    .sort((a, b) => b.visitCount - a.visitCount);
}

export function decisionCopy(signal: MemorySignal): { headline: string; body: string } {
  if (signal.label === "WANT_PRODUCT") {
    return { headline: "Test a take-home offer?", body: signal.visitCount + " independent visits asked to buy something from the experience." };
  }
  if (signal.label === "FRICTION_ACCESS") {
    return { headline: "Make arrival easier?", body: signal.visitCount + " visits reported difficulty reaching or finding the experience." };
  }
  if (signal.label === "PRAISE_EXPERIENCE") {
    return { headline: "Protect what guests already value.", body: signal.visitCount + " visits independently praised the experience." };
  }
  if (signal.label === "ASK_PRICE") {
    return { headline: "Clarify pricing before arrival?", body: signal.visitCount + " visits needed price or inclusion information." };
  }
  if (signal.label === "COMMUNICATION_GAP") {
    return { headline: "Close an information gap?", body: signal.visitCount + " visits reported missing or unclear information." };
  }
  return { headline: "A repeated signal is forming.", body: signal.visitCount + " independent visits produced the same signal: " + signal.title.toLowerCase() + "." };
}
