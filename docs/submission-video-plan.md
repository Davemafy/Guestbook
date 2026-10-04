# Guestbook — Final Submitted Videos

The submission portal required three separate videos, each no longer than 60 seconds. The final submission contains all three.

## Product demo — 44.0 seconds

Judge-facing flow:

1. show that feedback can be captured directly as **Guest entry** or documented by the operator as **Host note**
2. enter a positive tourism observation:
   > The roasting was amazing. Can we buy some beans to take home?
3. show local interpretation
4. show human review before memory
5. show repeated business memory
6. show source-linked evidence
7. finish on the operator-controlled decision layer

The product demo is intentionally outcome-first rather than benchmark-first.

## Technical walkthrough — 58.0 seconds

Technical story:

1. first model failed external contact
2. **79.8% UNKNOWN** on a 5,000-review Nairobi stress sample
3. roughly **0.3% Kiswahili transfer**
4. rejected rather than hidden
5. final model: **2,687 training cases**
6. **245,820 bytes of learned weights**
7. **0 network inference requests**
8. rules-only baseline works on synthetic examples but collapses on external English/Kiswahili
9. learned AI is therefore bounded to messy-language interpretation
10. evidence, counting and decisions remain deterministic or human-controlled

## Team introduction — 37.2 seconds

Solo-builder context and motivation for choosing a deliberately bounded Small AI system rather than a chatbot or general-purpose LLM.

## Recording/claim rules preserved

- Say **245,820 bytes of learned classifier weights**, not “the whole app is 240 KB.”
- Do not call transfer/weak-label metrics field accuracy.
- Do not claim offline speech recognition.
- Do not claim every language.
- Do not claim autonomous business decisions.
- The strongest offline proof is a cold reopen in airplane mode followed by a brand-new **typed** inference.
