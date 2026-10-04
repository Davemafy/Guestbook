# Guestbook

**Every visit teaches the business.**

**Hosted demo:** https://guestbook-small-ai.vercel.app

Guestbook is an offline-first Small AI prototype for small tourism operators. It turns messy visitor comments, questions and needs into structured, inspectable business memory while keeping the original evidence and final decision with the operator.

## Working product

- Guest mode with English and Kiswahili prompts
- Optional connected browser speech input with **0 MB Guestbook voice-model download**; typing remains the guaranteed offline path
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

Voice is an **optional input adapter**, not the business-intelligence model. On supported mobile browsers, **Speak now** uses the browser's speech-recognition service while connected and writes the transcript into the same editable text box.

Guestbook does **not** download a speech model in the normal flow: **0 MB Guestbook voice-model download**. General free-form offline speech recognition does not fit a credible ~1 MB browser model budget, so the project does not pretend otherwise. The core typed workflow and the 245,820-byte Guestbook classifier remain fully offline.

## Why Kenya for the prototype\n\nGuestbook's prototype evidence is localized around **Kenya** rather than treating "local" as a generic label.\n\n- The interface includes a typed **Kiswahili** path.\n- The multilingual transfer probe uses Amazon MASSIVE **sw-KE**.\n- The human-written hospitality-language probe uses **Inside Airbnb Nairobi** reviews.\n- World Bank data reports **35% of Kenya's population using the internet in 2024**, which makes an offline-first critical path materially relevant.\n- Kenya's National Bureau of Statistics reports **2,550,641 international visitor arrivals in 2025**, up 6.2% from 2024.\n\nThese facts do not make the prototype field-validated. They explain why Kenya is a coherent next validation setting: the language, tourism context, external text evidence, and connectivity constraint point to the same place.\n\nSources:\n- World Bank, Individuals using the Internet (% of population), Kenya: https://data.worldbank.org/country/kenya?locations=ke&name_desc=false\n- Kenya National Bureau of Statistics, Economic Survey 2026: https://www.knbs.or.ke/wp-content/uploads/2026/04/2026-Economic-Survey.pdf\n- Dataset and licensing details for MASSIVE and Inside Airbnb are documented in [external evidence](docs/external-evidence.md).\n\n## Small AI architecture

Guestbook deliberately does not use a general-purpose LLM in its critical path.

Guestbook Micro v1 is a tiny multilabel classifier:
- hashed character n-grams (3 to 5 characters)
- 4,096 feature dimensions
- 15 bounded labels including UNKNOWN
- one-vs-rest logistic classifiers pretrained and bundled with the app
- 245,820 bytes (~240 KB) of learned weights
- 2,687 training cases: 438 synthetic prototypes plus licensed MASSIVE train examples and a hashed Nairobi weak-supervision training partition
- no model download, API key, server inference, or generated JSON
- deterministic contradiction guard for obvious negation such as “not expensive,” “don’t want to buy,” “no allergies,” and “understood everything”

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

The MASSIVE numbers are semantic-transfer probes and the Nairobi labels are weak supervision, not manually labeled field truth. None of these are claimed as real-world tourism accuracy. A transparent no-ML lexical baseline is competitive on the small synthetic benchmark (93.0% micro-F1) but falls to 16.7% mapped-label hit on untouched MASSIVE English and 2.3% on Kiswahili, versus 91.1% and 92.8% for Guestbook Micro. This is why learned AI is restricted to language interpretation while counts, thresholds, evidence grouping, and business decisions stay deterministic or human-controlled. The next validation step is independently collected, consented, human-labeled field data.

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
