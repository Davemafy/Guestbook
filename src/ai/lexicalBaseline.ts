import { LABELS, type SignalLabel } from "../domain/labels";
import { FROZEN_TEST_CASES } from "./trainingData";

const RULES: Partial<Record<SignalLabel, RegExp[]>> = {
  PRAISE_EXPERIENCE: [
    /\b(amazing|excellent|wonderful|beautiful|lovely|fantastic|great|incredible|best|enjoyed|good)\b/i,
    /\b(nzuri|tulipenda|tupendeza)\b/i,
    /\b(place sweet|tour make sense)\b/i,
  ],
  WANT_PRODUCT: [
    /\b(buy|purchase|take .*home|for sale|sell|order)\b/i,
    /\b(kununua|mnauza|nataka .*maharagwe)\b/i,
    /\b(i wan buy|fit buy)\b/i,
  ],
  WANT_ACTIVITY: [
    /\b(try|join|help|take part|do).{0,28}\b(roast|roasting|picking|harvest|cooking|walk|activity|feeding)\b/i,
    /\b(shiriki|kujaribu|matembezi|shughuli)\b/i,
  ],
  WANT_BOOKING: [
    /\b(book|reserve|reservation|schedule|available|space|room)\b/i,
    /\b(come|visit).{0,20}\b(saturday|sunday|friday|tomorrow|next)\b/i,
    /\b(kuja|kuweka nafasi|kuhifadhi|nafasi)\b/i,
    /\b(i fit book|wan book)\b/i,
  ],
  ASK_ACCESS: [
    /\b(how (?:do|can|will) (?:we|i) (?:get|reach)|way to|get there|where (?:is|are)|directions?|route|transport|taxi|bus|pickup|located)\b/i,
    /\b(tutafikaje|wapi|usafiri|njia|iko mbali)\b/i,
  ],
  ASK_PRICE: [
    /\b(how much|price|cost|fee|charge|pay per person|cheapest)\b/i,
    /\b(bei|gharama|kiingilio)\b/i,
    /\b(how much .*collect)\b/i,
  ],
  ASK_PAYMENT: [
    /\b(card|cash|visa|mastercard|m-?pesa|mobile money|bank transfer|payment method|electronically|debit)\b/i,
    /\b(kadi|malipo|pesa taslimu|kulipa)\b/i,
    /\b(pos|transfer)\b/i,
  ],
  FRICTION_ACCESS: [
    /\b(got lost|hard to find|difficult to find|rough road|road .*rough|bad road|road .*bad|transport .*difficult|access road|taxi .*refused|no signs|muddy|directions .*confusing|finding .*difficult)\b/i,
    /\b(tulipotea|barabara .*mbaya|barabara .*mbovu|shida kufika|vigumu kufika)\b/i,
  ],
  FRICTION_VALUE: [
    /\b(too expensive|overpriced|not worth|too costly|paid too much|fee .*too high|price .*too high|poor value|worth the money|extra charges .*high)\b/i,
    /\b(bei .*ghali|bei .*juu|gharama .*kubwa|haikustahili)\b/i,
  ],
  FRICTION_EXPECTATION: [
    /\b(not as advertised|different from .*advertised|different from .*listing|did not match|website .*said|page said|promised|expected .* but|photos .*looked|listing .*promised|information .*out of date|website .*look)\b/i,
    /\b(haikuwa kama|tulitarajia|tangazo|tovuti .*ilisema)\b/i,
  ],
  REQUIREMENT_ACCESSIBILITY: [
    /\b(wheelchair|crutches|limited mobility|cannot walk|can't walk|cannot manage|needs? .*route|without .*stairs|elderly|rest stops?|gentler path|easier route|cannot climb)\b/i,
    /\b(hawezi .*kutembea|hawezi .*kupanda|kiti cha magurudumu|bila ngazi|njia rahisi)\b/i,
    /\b(no fit .*climb|no fit .*waka)\b/i,
  ],
  REQUIREMENT_DIETARY_SAFETY: [
    /\b(allerg|peanut|nuts?|shellfish|gluten|vegan|vegetarian|dairy|diabetic|asthma|medical condition)\b/i,
    /\b(mzio|karanga|mboga|pumu|bila maziwa)\b/i,
  ],
  COMMUNICATION_GAP: [
    /\b(did not understand|could not understand|unclear|confusing|never told|nobody told|did not know|nobody explained|unsure what|instructions .*confusing)\b/i,
    /\b(sikuelewa|maelezo .*wazi|hatukujua|hakuna .*aliyeeleza)\b/i,
  ],
  RETURN_REFERRAL: [
    /\b(come again|visit again|return|recommend|bring .*friends|bring .*family|bring .*colleagues|tell .*friends|told .*friends)\b/i,
    /\b(nitakuja tena|tutarudi|nitapendekeza|nitawaambia|nitarudi)\b/i,
    /\b(go come back|go bring|go recommend|go tell)\b/i,
  ],
};

export function classifyLexically(text: string): SignalLabel[] {
  const hits = Object.entries(RULES)
    .filter(([, patterns]) => patterns?.some((pattern) => pattern.test(text)))
    .map(([label]) => label as SignalLabel);
  return hits.length ? hits : ["UNKNOWN"];
}

export function benchmarkLexicalBaseline() {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let exact = 0;

  for (const testCase of FROZEN_TEST_CASES) {
    const predicted = new Set(classifyLexically(testCase.text));
    const expected = new Set(testCase.labels);
    if (predicted.size === expected.size && [...predicted].every((label) => expected.has(label))) exact++;

    for (const label of LABELS) {
      const p = predicted.has(label);
      const y = expected.has(label);
      if (p && y) tp++;
      if (p && !y) fp++;
      if (!p && y) fn++;
    }
  }

  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1 = (2 * precision * recall) / Math.max(1e-9, precision + recall);

  return {
    cases: FROZEN_TEST_CASES.length,
    precision,
    recall,
    f1,
    exactMatch: exact / Math.max(1, FROZEN_TEST_CASES.length),
    note: "Transparent lexical rules. No learned weights. Same frozen synthetic cases as Guestbook Micro.",
  };
}
