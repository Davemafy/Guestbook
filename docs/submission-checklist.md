# Guestbook — Final Submission Checklist

## Form

- Solo: **Yes**
- Team name: **N/A**
- Challenge: **4.C — World Bank (Track Tourism)**
- GitHub: **https://github.com/Davemafy/Guestbook**
- Hosted demo: **https://guestbook-small-ai.vercel.app**
- License: **MIT**

## Required uploads

- [ ] Demo video — max 60 sec
- [ ] Tech video — max 60 sec
- [ ] Team video — max 60 sec
- [ ] Team picture
- [ ] Verify every uploaded video link/file opens without requesting access

## Demo golden path

**Reset demo before each recorded take:** open `/lab` → **Reset demo**. This restores five marked product-request demo visits so the new guest becomes the visible sixth visit.

If the Moonshine voice pack is already installed and the Guest screen reports **VOICE READY**, speak the observation locally. Otherwise type it; do not troubleshoot voice during the recorded take.

Use this exact tested observation:

> My mother cannot walk very far and I want to buy some coffee beans.

Expected accepted signals:

- Accessibility need
- Wants a product

Flow:

1. Home → I’m visiting
2. Guest → paste/type tested observation
3. Review → show original quote + two local-model signals, including the human-confirmation marker on accessibility
4. Confirm into memory
5. Memory → expand source evidence
6. Decide → show human-controlled action prompt
7. /lab → show ~240 KB model, 0 inference requests, synthetic regression + held-out external probes

## Technical claims safe to make

- About **240 KB** learned weights
- Entire inference path runs **in-browser**
- **0 network requests during inference**
- **15 bounded labels**, including UNKNOWN
- Multi-label output
- Original visitor text is preserved
- Human review before memory
- Repeated patterns are counted deterministically across distinct visit IDs
- **2,687** training cases across synthetic prototypes + external training partitions
- Frozen **synthetic** stress-set result at threshold 0.60:
  - 92.5% micro precision
  - 88.1% micro recall
  - 90.2% micro F1
  - 82.9% exact multi-label match
- Untouched MASSIVE test semantic-transfer probes:
  - 91.1% mapped-label hit — English
  - 92.8% mapped-label hit — Kiswahili
- Held-out Nairobi weak-label probe: 98.0% agreement across 1,055 anchor-matched sentences

## Claims not to make

- Do not call the synthetic, MASSIVE-transfer, or Nairobi weak-label metrics field accuracy.
- Do not claim every language is supported.
- Voice is optional and real in the submission build through Moonshine WASM. Do not imply Kiswahili voice support or any cloud speech fallback.
- Do not claim two disconnected phones synchronize offline.
- Do not call model scores calibrated probabilities.
- Do not claim real customer adoption or measured revenue impact.

## Final browser checks

- [ ] Home loads
- [ ] /guest loads
- [ ] tested English observation returns the three expected signals
- [ ] Kiswahili test: `Bei ni ngapi na mnakubali M-Pesa?` returns price + payment signals
- [ ] UNKNOWN test: `My shirt is green.` does not force a business signal
- [ ] Review corrections work
- [ ] Memory source evidence expands
- [ ] Decide buttons work
- [ ] /capture guide/operator path works
- [ ] Export JSON downloads confirmed non-demo records
- [ ] /lab benchmark and external-evidence section render
- [ ] Install/open PWA once, then test cold reopen in airplane mode

## Final repo checks

- [x] Public repository
- [x] README
- [x] MIT license
- [x] Model card
- [x] System design
- [x] Taxonomy audit
- [x] Submission video plan
- [x] CI green
- [x] Public hosted demo

## URLs

- Product: https://guestbook-small-ai.vercel.app
- Model lab: https://guestbook-small-ai.vercel.app/lab
- Source: https://github.com/Davemafy/Guestbook
- Video plan: docs/submission-video-plan.md
- Model card: docs/model-card.md
- System design: docs/system-design.md


## Offline voice check

- [ ] On phone, connect once and install the English voice pack.
- [ ] Wait for **VOICE READY**.
- [ ] Turn on airplane mode.
- [ ] Reload Guestbook.
- [ ] Tap **Load cached voice** if shown.
- [ ] Speak a new English observation and verify the transcript appears without network.
- [ ] Keep Kiswahili demo typed; no Swahili speech claim.
- [ ] When saying “~240 KB,” explicitly refer to **Guestbook Micro**, not the optional Moonshine speech pack.
