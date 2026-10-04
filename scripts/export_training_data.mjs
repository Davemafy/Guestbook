import fs from "node:fs";

let src = fs.readFileSync(new URL("../src/ai/trainingData.ts", import.meta.url), "utf8");
src = src
  .replace(/import type[^\n]*\n/g, "")
  .replace(/export interface TrainingCase[\s\S]*?\n}\n/, "")
  .replace(/const SINGLE: Record<SignalLabel, string\[\]> =/, "const SINGLE =")
  .replace(/const MULTI: TrainingCase\[\] =/, "const MULTI =")
  .replace(/export const TRAINING_CASES: TrainingCase\[\] =/, "const TRAINING_CASES =")
  .replace(/export const FROZEN_TEST_CASES: TrainingCase\[\] =/, "const FROZEN_TEST_CASES =")
  .replace(/label as SignalLabel/g, "label");

const data = eval("(()=>{" + src + "; return {TRAINING_CASES,FROZEN_TEST_CASES};})()");
process.stdout.write(JSON.stringify(data));
