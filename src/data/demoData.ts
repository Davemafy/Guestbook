import type { Observation } from "../domain/observation";
import { db } from "../storage/db";

const ago = (minutes: number) => Date.now() - minutes * 60_000;

export const DEMO_OBSERVATIONS: Observation[] = [
  { id: "demo-01", visitId: "visit-01", rawText: "The roasting was amazing. Can we buy some beans to take home?", language: "en", source: "demo", createdAt: ago(620), predictions: [], confirmedLabels: ["PRAISE_EXPERIENCE","WANT_PRODUCT"], status: "confirmed", isDemo: true },
  { id: "demo-02", visitId: "visit-02", rawText: "Do you sell the coffee we tasted?", language: "en", source: "demo", createdAt: ago(510), predictions: [], confirmedLabels: ["WANT_PRODUCT"], status: "confirmed", isDemo: true },
  { id: "demo-03", visitId: "visit-03", rawText: "Ziara ilikuwa nzuri sana — roasting ndiyo nilipenda zaidi.", language: "sw", source: "demo", createdAt: ago(430), predictions: [], confirmedLabels: ["PRAISE_EXPERIENCE"], status: "confirmed", isDemo: true },
  { id: "demo-04", visitId: "visit-04", rawText: "Can we buy a bag before we leave? The farm walk was beautiful.", language: "en", source: "demo", createdAt: ago(360), predictions: [], confirmedLabels: ["WANT_PRODUCT","PRAISE_EXPERIENCE"], status: "confirmed", isDemo: true },
  { id: "demo-05", visitId: "visit-05", rawText: "The road from town was rough and we nearly missed the entrance.", language: "en", source: "demo", createdAt: ago(280), predictions: [], confirmedLabels: ["FRICTION_ACCESS"], status: "confirmed", isDemo: true },
  { id: "demo-06", visitId: "visit-06", rawText: "Barabara ilikuwa mbaya na tulipotea njiani.", language: "sw", source: "demo", createdAt: ago(210), predictions: [], confirmedLabels: ["FRICTION_ACCESS"], status: "confirmed", isDemo: true },
  { id: "demo-07", visitId: "visit-07", rawText: "Road to the place bad well well, but the coffee experience make sense.", language: "en-ng", source: "demo", createdAt: ago(160), predictions: [], confirmedLabels: ["FRICTION_ACCESS","PRAISE_EXPERIENCE"], status: "confirmed", isDemo: true },
  { id: "demo-08", visitId: "visit-08", rawText: "My mother cannot manage the steep path. Is there an easier route?", language: "en", source: "demo", createdAt: ago(90), predictions: [], confirmedLabels: ["REQUIREMENT_ACCESSIBILITY"], status: "confirmed", isDemo: true },
  { id: "demo-09", visitId: "visit-09", rawText: "I would definitely bring my friends here next time.", language: "en", source: "demo", createdAt: ago(40), predictions: [], confirmedLabels: ["RETURN_REFERRAL"], status: "confirmed", isDemo: true },
];

export async function seedDemoData() {
  if ((await db.observations.count()) === 0) {
    await db.observations.bulkAdd(DEMO_OBSERVATIONS);
  }
}
