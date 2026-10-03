# Guestbook Taxonomy Audit

Status: **V0 rejected — revise before training**

Purpose: stress-test the label space before collecting or training on data. These cases are **synthetic adversarial audit cases only**. They are not training, dev, or test data and must never be counted in model evaluation.

## Product invariant

Guestbook should not force an observation into the nearest available label just because the model can return one. If the taxonomy does not represent the meaning cleanly, that is a taxonomy failure, not a classifier failure.

The model is multi-label. One observation may legitimately produce several labels.

## Candidate taxonomy V0

- `PRAISE_EXPERIENCE`
- `REQUEST_PRODUCT`
- `REQUEST_ACTIVITY`
- `FRICTION_ACCESS`
- `FRICTION_DURATION`
- `FRICTION_PRICE`
- `ACCESSIBILITY`
- `DIETARY`
- `PURCHASE_INTENT`
- `REFERRAL_INTENT`
- `OTHER`
- `UNKNOWN`

## Audit rule

For each observation, assign one of:

- **CLEAN** — V0 expresses the important meaning directly.
- **ACCEPTABLE** — V0 preserves the useful business meaning but loses secondary nuance.
- **FORCED** — the observation would be misleadingly mapped, flattened into `OTHER`, or lose an operationally important distinction.

**Pass criterion:** no more than 3 of 15 adversarial observations may be FORCED.

## 15 adversarial observations

| # | Observation | Best V0 handling | Fit | Why |
|---|---|---|---|---|
| 1 | “The guide was kind, but I didn’t understand the story.” | `PRAISE_EXPERIENCE` + `OTHER` | **FORCED** | Communication/language failure is a meaningful tourism signal, not generic OTHER. |
| 2 | “I’d come again if transport here was easier.” | `FRICTION_ACCESS` + `REFERRAL_INTENT` | CLEAN | Multi-label classification preserves both access friction and future intent. |
| 3 | “My daughter loved the goats.” | `PRAISE_EXPERIENCE` | ACCEPTABLE | Useful praise survives, but the specific experience topic is lost. |
| 4 | “The coffee was excellent, but the bag was too expensive for me to buy.” | `PRAISE_EXPERIENCE` + `FRICTION_PRICE` + `PURCHASE_INTENT` | CLEAN | V0 captures the useful business meaning. |
| 5 | “I wanted to try roasting, but nobody explained whether visitors were allowed.” | `REQUEST_ACTIVITY` + `OTHER` | **FORCED** | The missing explanation / unclear policy is actionable communication friction. |
| 6 | “We got lost trying to find the farm.” | `FRICTION_ACCESS` | CLEAN | Direct fit. |
| 7 | “My mother could not manage the steep steps.” | `ACCESSIBILITY` | CLEAN | Direct fit, provided accessibility is treated as a requirement/constraint rather than sentiment. |
| 8 | “Is the lunch peanut-free? I have a severe allergy.” | `DIETARY` | **FORCED** | A safety-critical allergy should not be collapsed into an ordinary food preference. |
| 9 | “I would bring my colleagues here next month.” | `REFERRAL_INTENT` | ACCEPTABLE | Captures referral, but mixes referral and return/group-booking intent. |
| 10 | “The view was beautiful, but there was nowhere shaded to sit.” | `PRAISE_EXPERIENCE` + `OTHER` | **FORCED** | Comfort/amenity friction is actionable and should not disappear into OTHER. |
| 11 | “The guide rushed us through the coffee section.” | `FRICTION_DURATION` | ACCEPTABLE | Duration is related, but the real issue is pace/experience quality rather than total tour length. |
| 12 | “I wanted to buy beans, but I only had a card and mobile money.” | `PURCHASE_INTENT` + `OTHER` | **FORCED** | Payment-method friction is commercially important and distinct. |
| 13 | “Can I bring a group of twelve next Saturday?” | `OTHER` | **FORCED** | Booking/capacity intent is a core tourism workflow and should not be generic OTHER. |
| 14 | “I wasn’t sure whether photos were allowed near the roasting area.” | `OTHER` | **FORCED** | Policy/communication uncertainty is actionable. |
| 15 | “The sacred-tree story was fascinating, but I would not want it turned into a commercial show.” | `PRAISE_EXPERIENCE` + `OTHER` | **FORCED** | Cultural-sensitivity feedback matters and is not generic noise. |

## Result

- CLEAN: **5**
- ACCEPTABLE: **3**
- FORCED: **7**

**V0 fails the audit.** Seven forced fits is well above the maximum of three.

The failure pattern is useful: V0 is too focused on generic praise/request/price/access signals and under-represents the operational realities of tourism.

## Revised taxonomy V1

Keep the taxonomy coarse enough to support with limited data, but add the missing high-value distinctions:

- `PRAISE_EXPERIENCE`
- `REQUEST_PRODUCT`
- `REQUEST_ACTIVITY`
- `PURCHASE_INTENT`
- `BOOKING_INTENT`
- `RETURN_REFERRAL_INTENT`
- `FRICTION_ACCESS`
- `FRICTION_PRICE`
- `FRICTION_EXPERIENCE` — pace, comfort, amenities, tour flow
- `COMMUNICATION_GAP` — language, unclear explanation, unclear policy
- `PAYMENT_FRICTION`
- `ACCESSIBILITY_REQUIREMENT`
- `DIETARY_PREFERENCE`
- `SAFETY_REQUIREMENT` — allergies or other non-negotiable safety constraints
- `CULTURAL_SENSITIVITY`
- `OTHER`
- `UNKNOWN`

### Why these labels

V1 intentionally distinguishes:

1. **Business opportunity** — requests, purchase intent, booking intent.
2. **Experience friction** — access, price, payment, tour quality.
3. **Operational requirements** — accessibility, dietary preference, safety.
4. **Communication/cultural issues** — misunderstanding and cultural sensitivity.
5. **Positive/return signals** — praise and return/referral intent.

`SAFETY_REQUIREMENT` must never be converted directly into an automated business recommendation. It requires human confirmation.

`UNKNOWN` is a valid product outcome when the model cannot represent an observation confidently.

## What V1 still deliberately does not model

Do not grow the label list just to capture every noun in a tourist comment.

V1 does **not** try to encode detailed topics such as goats, waterfalls, coffee trees, lunch dishes, or individual landmarks as top-level labels. Those would create sparse classes. The first model should answer **what kind of business signal this is**, not build a complete ontology of the tour.

If later evidence shows that topic-level repetition is necessary for the product, add a separate, independently evaluated topic layer rather than multiplying the signal taxonomy into dozens of signal-topic pairs.

## Pre-training gate

Before any model training:

- [ ] Run another 15 fresh adversarial observations against V1.
- [ ] V1 must have **≤3 forced fits**.
- [ ] Every label intended for training must have a plan for **≥20 training examples**.
- [ ] Rare safety labels may remain rule-assisted / human-confirmed if support is insufficient.
- [ ] Freeze the taxonomy before collecting the held-out test set.
- [ ] Do not use these audit cases in train/dev/test.

## Evaluation discipline

After taxonomy freeze:

1. Collect raw observations first.
2. Label them only afterward.
3. Split train/dev/test before threshold tuning.
4. Tune thresholds on dev only.
5. Run the frozen test set once.
6. Report micro/macro precision, recall, F1, per-label support, per-label confusion, and abstention/coverage.
7. Keep raw source text attached to every prediction and every human correction.
