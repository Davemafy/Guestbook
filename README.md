# Guestbook

**Every visit teaches the business.**

**Hosted demo:** https://guestbook-small-ai.vercel.app

Guestbook is an offline-first Small AI prototype for small tourism operators. It turns messy visitor comments, questions and needs into structured, inspectable business memory while keeping the original evidence and final decision with the operator.

## Working product

- Guest mode with English and Kiswahili prompts
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

## Small AI architecture

Guestbook deliberately does not use a general-purpose LLM in its critical path.

Guestbook Micro v1 is a tiny multilabel classifier:
- hashed character n-grams (3 to 5 characters)
- 2,048 feature dimensions
- 15 bounded labels including UNKNOWN
- one-vs-rest logistic classifiers pretrained and bundled with the app
- approximately 120 KB of learned weights in memory
- synthetic prototype corpus covering English, Kiswahili and informal Nigerian English/Pidgin patterns
- no model download, API key, server inference, or generated JSON

The learned weights are frozen into the app, so a cold offline reopen performs inference immediately without training or a network.

## Technical documentation

- [Model card](docs/model-card.md)
- [System design](docs/system-design.md)
- [Taxonomy audit](docs/taxonomy-audit.md)

## Responsible AI

Raw source text is always preserved. The model can abstain with UNKNOWN. Accessibility and dietary/safety signals are explicitly marked for human confirmation. Guestbook does not automatically send messages, accept bookings, change prices, or make safety decisions. Demo records are visibly marked as demo data.

## Evaluation

The /lab route runs a frozen synthetic stress set on the actual in-browser model and reports micro precision, recall, F1, exact-match rate, training time, model weight footprint and median local inference latency.

Those numbers are regression evidence for this prototype. They are not claimed as field accuracy. The next validation step is a separately collected, human-labeled tourism dataset that is never used to tune the model.

## Offline proof

1. Open Guestbook once while connected.
2. Visit Guest mode and /lab once so the app assets are cached.
3. Close the app.
4. Enable airplane mode.
5. Reopen Guestbook.
6. Classify a new observation.
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
