# Guestbook System Design

Guestbook is an offline-first, shared-device system:

```
visitor / guide / operator
          |
          v
natural-language interaction
          |
          v
Guestbook Micro v1
(~240 KB learned weights)
          |
          v
bounded multi-label signals
          |
          v
human review / correction
          |
          v
IndexedDB local record
          |
          v
deterministic aggregation
by distinct visitId
          |
          v
evidence-backed memory
          |
          v
operator decision
```

## Design rules

1. **AI interprets individual language.** It does not generate business conclusions.
2. **Code establishes repetition.** A trend is counted from confirmed signals across distinct visits.
3. **Evidence stays attached.** Every memory item can reveal the original visitor words.
4. **Uncertainty is visible.** Unsupported input becomes `UNKNOWN`.
5. **Sensitive requirements stay human-controlled.** Accessibility and dietary/safety signals require confirmation.
6. **The core path is offline.** Inference, review, storage, aggregation, and decisions do not require a server.
7. **One shared phone is the MVP boundary.** A visitor may be handed the operator/guide/family phone, or their words can be captured afterward.

## Storage

Observations are stored in IndexedDB through Dexie. Records include a unique observation ID, distinct visit ID, raw source text, language marker, model outputs, confirmed labels, status, source, and timestamp.

Demo observations are explicitly marked `isDemo: true`.

## Offline behavior

The PWA service worker caches the application shell and subsequently requested same-origin assets. The application requests persistent browser storage where supported.

The intended proof is a cold reopen in airplane mode followed by a new local classification with zero inference requests.

## Product surfaces

- `/` — entry and product thesis
- `/guest` — shared-phone visitor capture
- `/review` — human confirmation/correction
- `/capture` — guide/operator capture when the guest never uses the phone
- `/memory` — repeated signals with source evidence
- `/decide` — operator-controlled action prompts
- `/lab` — model diagnostics, synthetic regression, and held-out external evidence
