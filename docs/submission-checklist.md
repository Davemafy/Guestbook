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

Use this exact tested observation:

> We loved the roasting, the road was terrible, and we want to buy beans.

Expected accepted signals:

- Experience praised
- Access friction
- Wants a product

Flow:

1. Home → I’m visiting
2. Guest → paste/type tested observation
3. Review → show original quote + three local-model signals
4. Confirm into memory
5. Memory → expand source evidence
6. Decide → show human-controlled action prompt
7. /lab → show ~120 KB model, 0 inference requests, regression metrics

## Technical claims safe to make

- About **120 KB** learned weights
- Entire inference path runs **in-browser**
- **0 network requests during inference**
- **15 bounded labels**, including UNKNOWN
- Multi-label output
- Original visitor text is preserved
- Human review before memory
- Repeated patterns are counted deterministically across distinct visit IDs
- Frozen **synthetic** stress-set result at threshold 0.60:
  - 95.1% micro precision
  - 92.9% micro recall
  - 94.0% micro F1
  - 88.6% exact multi-label match

## Claims not to make

- Do not call the synthetic metrics field accuracy.
- Do not claim every language is supported.
- Do not claim voice transcription exists in the submission build.
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
- [ ] /lab benchmark runs
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
