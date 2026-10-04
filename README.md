# Guestbook

**Every visit teaches the business.**

**Hosted demo:** https://guestbook-small-ai.vercel.app

Guestbook is an offline-first Small AI prototype for small tourism operators. It turns messy visitor comments, questions and needs into structured, inspectable business memory while keeping the original evidence and final decision with the operator.

## Working product

- Guest mode with English and Kiswahili prompts
- Capability-gated browser-local English voice; typing remains the guaranteed fallback
- Local multi-label inference with zero network requests
- Human review and correction before a signal enters memory
- Guide/operator capture when a guest never uses the phone
- Manual JSON export of confirmed local records
- IndexedDB persistence
- Evidence grouped across distinct visits
- Decision prompts that never act automatically
- PWA/service worker for offline reopening
- /lab for local inference and on-device regression testing

## Device model

Guestbook's offline MVP uses **one shared smartphone** owned by the operator, guide, cooperative, or family member. A visitor can be handed that phone for a short interaction, or the guide/operator can capture the visitor's words afterward. The MVP does not pretend that two disconnected phones can silently sync with each other. Store-and-forward export is a future extension, not part of the critical demo path.

## Voice input

Guestbook treats speech recognition as an **input adapter**, not as the business-intelligence model. On browsers that expose on-device `SpeechRecognition.available()`, Guestbook checks specifically for an English local language pack with `processLocally: true`. If the pack is downloadable, the user may install it once through the browser. Recognition is only started after the browser reports local availability.

Guestbook never silently falls back to cloud speech. If local recognition is unavailable, the microphone control is disabled and typing remains available. Kiswahili remains a typed path unless the browser itself reports a compatible local pack.

## Small AI architecture

Guestbook deliberately does not use a general-purpose LLM in its critical path.

Guestbook Micro v1 is a tiny multilabel classifier:
- hashed character n-grams (3 to 5 characters)
- 4,096 feature dimensions
- 15 bounded labels including UNKNOWN
- one-vs-rest logistic classifiers pretrained and bundled with the app
- 245,820 bytes (~240 KB) of learned weights
- 2,687 training cases: 438 synthetic prototypes plus licensed MASSIVE train examples and a hashed Nairobi weak-supervision training partition
- no model download, API key, server inference, or generated JSON

The learned weights are frozen into the app, so a cold offline reopen performs inference immediately without training or a network.

## Technical documentation

- [Model card](docs/model-card.md)
- [System design](docs/system-design.md)
- [Taxonomy audit](docs/taxonomy-audit.md)
- [External evidence](docs/external-evidence.md)

## Responsible AI

Raw source text is always preserved. The model can abstain with UNKNOWN. Accessibility and dietary/safety signals are explicitly marked for human confirmation. Guestbook does not automatically send messages, accept bookings, change prices, or make safety decisions. Demo records are visibly marked as demo data.

## Evaluation

The /lab route runs the frozen synthetic stress set on the actual in-browser model and also displays held-out external evidence. The promoted model keeps 90.2% micro-F1 on the 35-case synthetic regression set. On untouched MASSIVE test slices mapped to the nearest Guestbook signals, it reaches 91.1% mapped-label hit in English and 92.8% in Swahili. On a held-out Nairobi public-review partition with transparent lexical weak labels, it reaches 98.0% label agreement.

The MASSIVE numbers are semantic-transfer probes and the Nairobi labels are weak supervision, not manually labeled field truth. None of these are claimed as real-world tourism accuracy. The next validation step is independently collected, consented, human-labeled field data.

## Offline proof

1. Open Guestbook once while connected.
2. Wait until the header changes from **PREPARING OFFLINE** to **OFFLINE READY**. The service worker install does not complete until the current hashed JS/CSS assets have been precached.
3. Close the app.
4. Enable airplane mode.
5. Reopen Guestbook.
6. Classify a brand-new observation.
7. The inference path uses zero network requests.

## Development

    npm install
    npm run dev
    npm run build

## Routes

- / — product entry
- /guest — visitor capture
- /review — operator confirmation
- /capture — guide/operator capture after a visit
- /memory — repeated signals + source evidence
- /decide — human decision layer
- /lab — model diagnostics and regression test

## License

MIT
