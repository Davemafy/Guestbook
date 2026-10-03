# Guestbook

**Every visit teaches the business.**

Guestbook is an offline-first Small AI prototype for informal tourism operators. It turns messy visitor comments into structured, inspectable business signals while keeping source evidence and the final decision with the operator.

## Current status

The repository is intentionally building the risky core before the polished product UI.

- ✅ V1 taxonomy adversarially audited
- ✅ React/Vite PWA lab scaffold
- ✅ local IndexedDB persistence layer
- ✅ honest keyword baseline
- ⏳ real train/dev/test observation dataset
- ⏳ fastText multi-label model
- ⏳ calibrated abstention thresholds
- ⏳ frozen test metrics
- ⏳ Guest → Review → Memory → Decide product UI

Open `/lab` to inspect the current baseline. **No trained-model accuracy is claimed yet.**

## Architecture

```
raw multilingual observation
        ↓
tiny local multi-label classifier
        ↓
calibrated per-label thresholds
        ↓
UNKNOWN / human confirmation when uncertain
        ↓
local IndexedDB record
        ↓
deterministic aggregation by distinct visit
        ↓
evidence-backed memory
        ↓
operator decision
```

AI interprets. Evidence accumulates. Humans decide.

## Taxonomy

See [docs/taxonomy-audit.md](docs/taxonomy-audit.md).

The synthetic adversarial audit cases are explicitly excluded from training and evaluation.

## Evaluation policy

Guestbook will not report metrics until:

1. raw observations are collected;
2. taxonomy labels are assigned afterward;
3. train/dev/test splits are frozen;
4. thresholds are calibrated only on dev;
5. the frozen test set is run once.

Planned reporting: micro/macro precision, recall and F1; per-label support/confusion; abstention/coverage; model size; local inference latency.

## Offline proof

The target proof is stricter than simply toggling Wi-Fi while the app is open:

1. load/install once;
2. cache the app/model;
3. close Guestbook;
4. enable airplane mode;
5. reopen cold;
6. classify a new observation;
7. verify the critical path makes zero network requests.

## Development

```bash
npm install
npm run dev
```

## License

MIT license will be added before submission.
