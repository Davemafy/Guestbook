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
  PRAISE_EXPERIENCE: { title: "Experience praised", description: "A guest explicitly valued part of the visit.", tone: "positive" },
  WANT_PRODUCT: { title: "Wants a product", description: "A guest wants to buy something from the operator.", tone: "intent" },
  WANT_ACTIVITY: { title: "Wants an activity", description: "A guest wants to participate in an activity.", tone: "intent" },
  WANT_BOOKING: { title: "Booking intent", description: "A guest wants to reserve or schedule a visit.", tone: "intent" },
  ASK_ACCESS: { title: "Access question", description: "A guest needs directions, transport, or pickup information.", tone: "neutral" },
  ASK_PRICE: { title: "Price question", description: "A guest needs price, fee, or inclusion information.", tone: "neutral" },
  ASK_PAYMENT: { title: "Payment question", description: "A guest needs to know how they can pay.", tone: "neutral" },
  FRICTION_ACCESS: { title: "Access friction", description: "Getting to the experience caused difficulty.", tone: "friction" },
  FRICTION_VALUE: { title: "Price / value friction", description: "A guest felt the experience was not worth the cost.", tone: "friction" },
  FRICTION_EXPECTATION: { title: "Expectation mismatch", description: "What happened differed from what was promised or described.", tone: "friction" },
  REQUIREMENT_ACCESSIBILITY: { title: "Accessibility need", description: "A guest has a mobility or access requirement.", tone: "requirement" },
  REQUIREMENT_DIETARY_SAFETY: { title: "Dietary / safety need", description: "A guest has a dietary, allergy, or health requirement.", tone: "requirement" },
  COMMUNICATION_GAP: { title: "Communication gap", description: "Important information was unclear, missing, or misunderstood.", tone: "friction" },
  RETURN_REFERRAL: { title: "Return / referral", description: "A guest intends to return or recommend the experience.", tone: "positive" },
  UNKNOWN: { title: "Not sure", description: "Guestbook does not have enough signal to classify this reliably.", tone: "neutral" },
};

export const HUMAN_CONFIRM_REQUIRED = new Set<SignalLabel>([
  "REQUIREMENT_ACCESSIBILITY",
  "REQUIREMENT_DIETARY_SAFETY",
]);
