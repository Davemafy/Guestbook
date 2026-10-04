# Guestbook Micro v1 — Model Card

## Purpose

Guestbook Micro v1 is a deliberately narrow multi-label classifier for small-tourism interactions. It converts a visitor's natural-language message into one or more bounded business signals. It does **not** generate prose, make business decisions, or perform bookings.

## Runtime design

- **Model family:** one-vs-rest logistic classifiers
- **Features:** hashed character n-grams, lengths 3–5
- **Feature dimensions:** 4,096
- **Labels:** 15 including `UNKNOWN`
- **Learned weights:** 245,820 bytes (~240 KB)
- **Inference:** entirely in-browser
- **Network calls during inference:** 0
- **Decision threshold:** 0.60
- **Cloud/API dependency:** none

Character n-grams were chosen to make the prototype less brittle to spelling variation, inflection, and informal phrasing without requiring a general-purpose language model.

## Labels

- `PRAISE_EXPERIENCE`
- `WANT_PRODUCT`
- `WANT_ACTIVITY`
- `WANT_BOOKING`
- `ASK_ACCESS`
- `ASK_PRICE`
- `ASK_PAYMENT`
- `FRICTION_ACCESS`
- `FRICTION_VALUE`
- `FRICTION_EXPECTATION`
- `REQUIREMENT_ACCESSIBILITY`
- `REQUIREMENT_DIETARY_SAFETY`
- `COMMUNICATION_GAP`
- `RETURN_REFERRAL`
- `UNKNOWN`

One observation may receive multiple labels.

## Prototype data

The production training mix contains **2,687 cases**: 438 synthetic prototype examples, selected Amazon MASSIVE train examples in English and Kiswahili, and weakly labeled sentences from a hashed Nairobi public-review training partition. Raw external reviews are not committed to the repository.

The bundled frozen regression set contains **35 synthetic stress cases** and remains separate from training. MASSIVE test is untouched during fitting. Nairobi sentences are split deterministically by text hash, with the held-out bucket excluded from fitting.

The Nairobi labels use transparent lexical weak supervision and therefore are not equivalent to manual field annotations. MASSIVE intent mappings are nearest-signal transfer probes rather than tourism labels.

## Frozen regression result

At threshold **0.60** on the 35-case frozen synthetic stress set:

| Metric | Result |
| --- | ---: |
| Micro precision | **92.5%** |
| Micro recall | **88.1%** |
| Micro F1 | **90.2%** |
| Exact multi-label match | **82.9%** |

These values are **regression evidence, not field-performance claims**. The `/lab` route recomputes the metrics using the actual model running in the browser.

## External held-out evidence

- MASSIVE en-US test transfer probe: **91.1%** mapped-label hit across 305 cases.
- MASSIVE sw-KE test transfer probe: **92.8%** mapped-label hit across 305 cases.
- Nairobi held-out weak-label probe: **98.0%** agreement across 1,055 anchor-matched sentences.

See [`external-evidence.md`](external-evidence.md) for the exact split, mappings, caveats, and source attribution.

## Deterministic contradiction guard

Guestbook Micro v1 now applies a tiny deterministic post-inference guard for explicit contradictions and negations. The learned model is still responsible for language interpretation, but obvious phrases such as **“I don't want to buy,” “not expensive,” “no food allergies,” “exactly as advertised,”** or **“I understood everything clearly”** suppress the corresponding positive/friction signal rather than allowing lexical fragments to create an obviously contradictory tag.

This policy layer does not increase the learned model size and is tested separately from the 35-case model benchmark. It is a safety/consistency guard, not a replacement for semantic classification.

## Responsible-use boundaries

Guestbook preserves the raw source text behind every model output.

The model can abstain through `UNKNOWN`. Accessibility and dietary/safety signals are explicitly surfaced for human confirmation. No label automatically triggers a booking, payment, message, price change, or safety decision.

The operator can confirm, remove, or add signals before they enter business memory.

## Known limitations

- The corpus is still small and partly synthetic; external supervision covers only a subset of labels.
- Kiswahili evidence is limited to mapped MASSIVE intents and prototype tourism phrases; it is not dialect-complete.
- Informal Nigerian English/Pidgin examples are limited and should not be treated as language certification.
- Scores are model scores, not calibrated probabilities of truth.
- The model does not extract detailed entities such as dates, exact prices, allergens, or group counts.
- Guestbook's MVP assumes one shared operator/guide/family smartphone; it does not claim disconnected phones can silently synchronize.
- Nairobi evaluation uses weak lexical labels rather than human field annotation.
- MASSIVE evaluation measures semantic transfer from non-tourism intents.
- A real deployment requires independently collected, consented, human-labeled field data and evaluation across target communities.

## Why learned ML rather than only lexical rules?\n\nA simpler deterministic baseline was tested rather than assumed to be inadequate.\n\n- On the 35-case frozen synthetic set, transparent lexical rules score **93.0% micro-F1** and **82.9% exact match**. Guestbook Micro scores **90.2% micro-F1** and **82.9% exact match**. On this small synthetic set, rules are competitive.\n- On untouched MASSIVE semantic-transfer slices, the lexical baseline reaches only **16.7%** mapped-label hit in English and **2.3%** in Kiswahili. Guestbook Micro reaches **91.1%** and **92.8%** respectively.\n\nThis is the architectural boundary: learned ML is used only to interpret messy language into a bounded signal set. Distinct-visit counting, thresholds, evidence grouping, persistence, and the final business decision are not delegated to the model.\n\nThe MASSIVE comparison is a semantic-transfer probe rather than tourism field accuracy, and it does not prove every possible rules engine must fail.\n\n## Why not an LLM?

The critical task has a small answer space. A general-purpose LLM would increase model size, latency, battery/compute demand, failure modes, and offline packaging cost. Guestbook therefore tests the smallest useful intelligence for this specific workflow.

## Next validation step

Collect an independently labeled field dataset from tourism operators and visitors, freeze it before tuning, then report per-label precision/recall, confusion, abstention/coverage, language slices, latency on low-end Android hardware, and correction rates.
