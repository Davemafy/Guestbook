# Guestbook — Final Submission Record

## Submission status

- [x] HackOS project submitted
- [x] Google Form submitted
- [x] Challenge: **4.C — World Bank (Track Tourism)**
- [x] Solo submission
- [x] Public GitHub repository
- [x] Working hosted demo
- [x] MIT license
- [x] Team photo uploaded
- [x] 3/3 required videos uploaded

## Final videos

- **Team introduction:** 37.2 seconds
- **Product demo:** 44.0 seconds
- **Technical walkthrough:** 58.0 seconds

## URLs

- Product: https://guestbook-small-ai.vercel.app/
- Source: https://github.com/Davemafy/Guestbook
- Model/system evidence: https://guestbook-small-ai.vercel.app/system
- Lab alias: https://guestbook-small-ai.vercel.app/lab

## Final product QA path

- [x] Guest entry works
- [x] Host note capture preserves operator provenance
- [x] English + Kiswahili capture
- [x] Local multilabel inference
- [x] Human review/correction
- [x] Memory across distinct visits
- [x] Source-linked evidence
- [x] Human-controlled decision layer
- [x] IndexedDB persistence
- [x] JSON export for confirmed non-demo records
- [x] Offline-ready PWA path
- [x] Typed inference works with zero network inference
- [x] Optional connected browser speech input
- [x] Model/evaluation evidence visible in System

## Judge-proof inputs

**Positive opportunity**

`The roasting was amazing. Can we buy some beans to take home?`

Expected: PRAISE_EXPERIENCE + WANT_PRODUCT.

**Kiswahili**

`Bei ni ngapi na mnakubali M-Pesa?`

Expected: ASK_PRICE + ASK_PAYMENT.

**Abstention**

`My shirt is green.`

Expected: UNKNOWN.

## Claim boundaries

- Metrics are regression, semantic-transfer, and weak-label evidence — not field accuracy.
- Voice is optional and connected; offline guarantee applies to typed capture + Guestbook Micro.
- The MVP assumes a shared operator/guide/family device; disconnected phones do not silently synchronize.
- 245,820 bytes refers to **learned classifier weights**, not total app size.
- Guestbook does not autonomously accept bookings, change prices, send messages, or make safety decisions.
