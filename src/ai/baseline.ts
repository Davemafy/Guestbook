import type { SignalLabel } from "../domain/labels";
import type { Prediction } from "../domain/observation";

const RULES: Array<{ label: SignalLabel; patterns: RegExp[] }> = [
  { label: "PRAISE_EXPERIENCE", patterns: [/\blove(?:d)?\b/i, /\bamazing\b/i, /\bbeautiful\b/i, /\bexcellent\b/i, /\bgreat\b/i] },
  { label: "PURCHASE_INTENT", patterns: [/\bbuy\b/i, /\bpurchase\b/i, /take (?:it|some|coffee|beans) home/i] },
  { label: "REQUEST_PRODUCT", patterns: [/can (?:i|we) (?:buy|purchase)/i, /do you sell/i] },
  { label: "REQUEST_ACTIVITY", patterns: [/can (?:i|we) (?:try|join|do)/i, /wanted to try/i, /wish .* could/i] },
  { label: "BOOKING_INTENT", patterns: [/\bbook\b/i, /can .* come (?:next|on|this)/i, /group of \d+/i] },
  { label: "RETURN_REFERRAL_INTENT", patterns: [/come again/i, /bring .* (?:friend|family|colleague)/i, /recommend/i] },
  { label: "FRICTION_ACCESS", patterns: [/got lost/i, /hard to find/i, /transport/i, /reach the farm/i] },
  { label: "FRICTION_PRICE", patterns: [/too expensive/i, /price .* high/i, /cost .* much/i] },
  { label: "FRICTION_EXPERIENCE", patterns: [/too long/i, /rushed/i, /waited/i, /nowhere .* sit/i, /no shade/i] },
  { label: "COMMUNICATION_GAP", patterns: [/didn.?t understand/i, /not understand/i, /wasn.?t sure/i, /nobody explained/i, /unclear/i] },
  { label: "PAYMENT_FRICTION", patterns: [/cash only/i, /card/i, /mobile money/i, /payment/i] },
  { label: "ACCESSIBILITY_REQUIREMENT", patterns: [/wheelchair/i, /could not manage/i, /struggled with .*walk/i, /steep (?:path|steps|walk)/i] },
  { label: "DIETARY_PREFERENCE", patterns: [/vegetarian/i, /vegan/i, /no (?:meat|eggs|dairy)/i] },
  { label: "SAFETY_REQUIREMENT", patterns: [/allerg/i, /asthma/i, /medical/i, /emergency/i] },
  { label: "CULTURAL_SENSITIVITY", patterns: [/sacred/i, /ceremony/i, /commercial show/i, /photos? .* allowed/i] },
];

export function keywordBaseline(text: string): Prediction[] {
  const matches = RULES
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(text)))
    .map((rule) => ({
      label: rule.label,
      score: null,
      accepted: true,
      engine: "keyword-baseline" as const,
    }));

  if (matches.length === 0) {
    return [{
      label: "UNKNOWN",
      score: null,
      accepted: false,
      engine: "keyword-baseline",
    }];
  }

  return matches;
}
