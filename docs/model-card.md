# Guestbook Micro v1 — Model Card

## Purpose

Guestbook Micro v1 is a deliberately narrow multi-label classifier for small-tourism interactions. It converts a visitor's natural-language message into one or more bounded business signals. It does **not** generate prose, make business decisions, or perform bookings.

## Runtime design

- **Model family:** one-vs-rest logistic classifiers
- **Features:** hashed character n-grams, lengths 3–5
- **Feature dimensions:** 2,048
- **Labels:** 15 including `UNKNOWN`
- **Learned weights:** 122,940 bytes (~120 KB)
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

The bundled training corpus contains **438 synthetic prototype examples**. It covers English, Kiswahili, and informal Nigerian English/Pidgin-style phrasing. Synthetic generation is disclosed explicitly; the corpus is not presented as a representative field dataset.

The frozen regression set contains **35 synthetic stress cases** and is kept separate from the examples used to fit the weights.

Public travel communities and tourism research were used to stress-test the *taxonomy* and identify recurring problem types such as access, price/value, payment, expectation mismatch, language/communication, accessibility, booking, and purchase intent. Verbatim community posts are not copied into the model corpus.

## Frozen regression result

At threshold **0.60** on the 35-case frozen synthetic stress set:

| Metric | Result |
| --- | ---: |
| Micro precision | **95.1%** |
| Micro recall | **92.9%** |
| Micro F1 | **94.0%** |
| Exact multi-label match | **88.6%** |

These values are **regression evidence, not field-performance claims**. The `/lab` route recomputes the metrics using the actual model running in the browser.

## Responsible-use boundaries

Guestbook preserves the raw source text behind every model output.

The model can abstain through `UNKNOWN`. Accessibility and dietary/safety signals are explicitly surfaced for human confirmation. No label automatically triggers a booking, payment, message, price change, or safety decision.

The operator can confirm, remove, or add signals before they enter business memory.

## Known limitations

- The training corpus is synthetic and small.
- Kiswahili coverage is prototype-level, not dialect-complete.
- Informal Nigerian English/Pidgin examples are limited and should not be treated as language certification.
- Scores are model scores, not calibrated probabilities of truth.
- The model does not extract detailed entities such as dates, exact prices, allergens, or group counts.
- Guestbook's MVP assumes one shared operator/guide/family smartphone; it does not claim disconnected phones can silently synchronize.
- A real deployment requires independently collected, consented, human-labeled field data and evaluation across target communities.

## Why not an LLM?

The critical task has a small answer space. A general-purpose LLM would increase model size, latency, battery/compute demand, failure modes, and offline packaging cost. Guestbook therefore tests the smallest useful intelligence for this specific workflow.

## Next validation step

Collect an independently labeled field dataset from tourism operators and visitors, freeze it before tuning, then report per-label precision/recall, confusion, abstention/coverage, language slices, latency on low-end Android hardware, and correction rates.
