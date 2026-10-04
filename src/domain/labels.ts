export const LABELS = [
  "PRAISE_EXPERIENCE",
  "WANT_PRODUCT",
  "WANT_ACTIVITY",
  "WANT_BOOKING",
  "ASK_ACCESS",
  "ASK_PRICE",
  "ASK_PAYMENT",
  "FRICTION_ACCESS",
  "FRICTION_VALUE",
  "FRICTION_EXPECTATION",
  "REQUIREMENT_ACCESSIBILITY",
  "REQUIREMENT_DIETARY_SAFETY",
  "COMMUNICATION_GAP",
  "RETURN_REFERRAL",
  "UNKNOWN",
] as const;

export type SignalLabel = (typeof LABELS)[number];

export const LABEL_META: Record<SignalLabel, { title: string; description: string; tone: "positive" | "intent" | "friction" | "requirement" | "neutral" }> = {
  PRAISE_EXPERIENCE: { title: "Loved the experience", description: "They called out something they really enjoyed.", tone: "positive" },
  WANT_PRODUCT: { title: "Wants to buy something", description: "They want something they can take home or buy later.", tone: "intent" },
  WANT_ACTIVITY: { title: "Wants another activity", description: "They want something else to do during the visit.", tone: "intent" },
  WANT_BOOKING: { title: "Wants to book", description: "They are asking to reserve or schedule a visit.", tone: "intent" },
  ASK_ACCESS: { title: "Needs directions", description: "They need help finding, reaching, or getting picked up.", tone: "neutral" },
  ASK_PRICE: { title: "Asking about price", description: "They want to know the price or what is included.", tone: "neutral" },
  ASK_PAYMENT: { title: "Asking how to pay", description: "They want to know which payment options are available.", tone: "neutral" },
  FRICTION_ACCESS: { title: "Hard to get here", description: "They had trouble finding or reaching the experience.", tone: "friction" },
  FRICTION_VALUE: { title: "Didn’t feel worth the price", description: "They questioned the value for what they paid.", tone: "friction" },
  FRICTION_EXPECTATION: { title: "Not what they expected", description: "The visit did not match what they were led to expect.", tone: "friction" },
  REQUIREMENT_ACCESSIBILITY: { title: "Accessibility need", description: "They mentioned a mobility or access need.", tone: "requirement" },
  REQUIREMENT_DIETARY_SAFETY: { title: "Dietary or safety need", description: "They mentioned food, allergy, health, or safety needs.", tone: "requirement" },
  COMMUNICATION_GAP: { title: "Information was unclear", description: "Something important was missing, confusing, or misunderstood.", tone: "friction" },
  RETURN_REFERRAL: { title: "Would return or recommend", description: "They want to come back or tell someone else about it.", tone: "positive" },
  UNKNOWN: { title: "Not sure", description: "There isn’t enough here to confidently place this feedback.", tone: "neutral" },
};

export const HUMAN_CONFIRM_REQUIRED = new Set<SignalLabel>([
  "REQUIREMENT_ACCESSIBILITY",
  "REQUIREMENT_DIETARY_SAFETY",
]);
