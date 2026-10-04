# Guestbook — Submission Pack

## One-line pitch

Guestbook turns messy visitor words into small, inspectable business memory on the device: local bounded interpretation, human confirmation, source evidence, repeated memory, then a human decision.

## Challenge

**7th Hack-Nation Global AI Hackathon**  
**World Bank — Small AI for Development, Track C: Tourism**

## Submitted product

- Live demo: https://guestbook-small-ai.vercel.app/
- Source: https://github.com/Davemafy/Guestbook
- Capture modes: **Guest entry** and provenance-preserving **Host note**
- Languages in the prototype UI: **English + Kiswahili**
- Typed critical path: **offline**
- Network inference: **0 requests**
- Final business decision: **human-controlled**

## Why Small AI

Guestbook does not use AI for counting, storage, evidence grouping, thresholds, or business decisions. Deterministic code handles those jobs.

The learned model exists only where rules failed to generalize: mapping messy visitor language into 15 bounded signals including UNKNOWN.

### Guestbook Micro v1

- one-vs-rest logistic classifiers
- hashed Unicode character n-grams, lengths 3–5
- 4,096 feature dimensions
- 15 bounded labels
- threshold 0.60
- 2,687 training cases
- **245,820 bytes of learned weights**
- **zero network inference**

## Failure → promotion evidence

The first synthetic-only classifier was rejected after external testing:

- **79.8% UNKNOWN** on a 5,000-review Nairobi stress sample
- roughly **0.3% Kiswahili transfer**

Promoted model probes:

- MASSIVE English mapped-label hit: **91.1%**
- MASSIVE Kiswahili mapped-label hit: **92.8%**
- held-out Nairobi weak-label agreement: **98.0%**
- frozen 35-case synthetic regression micro-F1: **90.2%**

Transparent lexical baseline:

- synthetic regression micro-F1: **93.0%**
- MASSIVE English: **16.7%**
- MASSIVE Kiswahili: **2.3%**

These are semantic-transfer and weak-label probes, **not field-accuracy claims**.

## Submitted demo story

The final product demo uses the positive tourism observation:

> The roasting was amazing. Can we buy some beans to take home?

Expected interpretation:

- **Loved the experience**
- **Wants to buy something**

The demo then shows human review, repeated memory, source-linked evidence, and the operator decision boundary.

## Strongest offline proof

1. Load Guestbook once while connected.
2. Wait for the local/offline-ready indicator.
3. Enable airplane mode.
4. Reopen Guestbook.
5. Type a brand-new observation.
6. Guestbook Micro still classifies it locally.

Voice is optional and connected; the project does **not** claim offline free-form speech recognition.

## Claims language

Safe claims:

- **245,820 bytes of learned classifier weights**
- **zero network inference**
- **typed critical path works offline**
- **MASSIVE semantic-transfer probe**
- **Nairobi weak-label agreement**
- **voice is optional and connected**
- **final business decisions stay human-controlled**

Do not claim:

- field accuracy
- offline speech recognition
- every language
- autonomous business decisions
- real customer adoption or measured revenue impact
- that the whole application is 245,820 bytes

## Technical close

> We were not trying to build the smallest model possible. We were trying to find the smallest model that survived contact with data we did not write.
