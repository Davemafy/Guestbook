# Guestbook — Submission Video Plan

All three videos must stay under 60 seconds.

## Demo video — 55–58 seconds

**0:00–0:05 — Thesis**
Open Guestbook home.

> Small tourism businesses hear valuable comments every day, but most of that knowledge disappears after the visitor leaves.

Tap **I’m visiting**.

**0:05–0:17 — Visitor input**
Use the tested message:

> My mother cannot walk very far and I want to buy some coffee beans.

> Guestbook works on one shared phone, even offline. A visitor speaks naturally; no account or cloud AI.

Submit.

**0:17–0:29 — Local interpretation + human control**
Expected signals:
- Accessibility need — explicitly marked for human confirmation
- Wants a product

> A tiny local model turns the message into bounded signals. The original words never disappear, and the operator can correct anything before it enters memory.

Press **Confirm into memory**.

**0:29–0:43 — Evidence-backed memory**
Expand **Wants a product** source evidence.

> Confirmed signals accumulate across independent visits. Guestbook does not generate a trend — deterministic code counts the evidence, and every pattern links back to the source.

Tap **What should I act on?**

**0:43–0:53 — Decision**
Show **Test a take-home offer?**.

> The AI never changes the business. It surfaces repeated evidence, and the operator decides.

**0:53–0:58 — Technical proof**
Cut to /lab after running the benchmark.

> The model is about 240 kilobytes, runs entirely in-browser, and makes zero network requests during inference.

> Guestbook. Every visit teaches the business.

## Technical video — 55–58 seconds

Open /lab.

> We deliberately did not use a general-purpose LLM. Guestbook's critical task has a small answer space, so we built a task-specific multi-label classifier.

> Guestbook Micro v1 uses hashed three-to-five-character n-grams, 4,096 dimensions, fifteen bounded labels, and about 240 kilobytes of learned weights.

Run:

> How much is entry and can I pay by card?

> It supports multiple signals from one interaction and abstains with UNKNOWN when it does not have enough evidence.

Briefly show the Review correction controls.

> Every prediction is reviewable. Accessibility and dietary or safety needs explicitly require human confirmation.

Show Memory.

> After confirmation, IndexedDB stores the source locally. Deterministic code groups signals by distinct visit IDs — the model cannot invent a trend.

Return to /lab.

> On the frozen synthetic set it keeps 90.2% micro-F1. More importantly, untouched MASSIVE test probes hit 91.1% in English and 92.8% in Swahili, while a held-out Nairobi weak-label probe reaches 98.0%. Those are transfer and weak-label results, not field accuracy.

## Team video — 45–55 seconds

> I'm David Imafidon, and I built Guestbook solo.
>
> I focused on a problem that looks small but compounds for thousands of tourism microbusinesses: visitors ask questions, mention problems, and reveal what they value, but that information usually disappears because the operator does not have the connectivity, data volume, or tools to analyze it.
>
> My approach was to use less AI, not more. Guestbook runs a tiny local classifier on a shared phone, keeps the original evidence, and leaves every final decision with the operator.
>
> I built the product, the offline architecture, the model, the evaluation harness, and the human-review workflow during the hackathon.
>
> The goal is simple: make useful customer intelligence available even where cloud AI is the wrong tool.

## Recording rules

- Never call the synthetic, MASSIVE-transfer, or Nairobi weak-label metrics real-world accuracy.
- Never say the model understands every language.
- Do not claim full offline voice transcription; the submission build uses text capture.
- Do not claim separate offline phones synchronize; the MVP uses one shared device.
- Keep the OFFLINE badge visible if recording the offline proof.
- For airplane-mode proof: load the PWA/routes first, close it, enable airplane mode, reopen, then classify a new message.
- Record the demo path twice before narration and use the cleaner take.
