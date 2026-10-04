# Guestbook — Submission Pack

Use this file as the final copy source. Do not improvise technical claims during recording.

## One-line pitch

Guestbook turns messy visitor words into small, inspectable business memory on the device: local bounded interpretation, human confirmation, source evidence, repeated memory, then a human decision.

## Short description

Small tourism businesses learn from conversations, but those conversations disappear. Guestbook captures a visitor's exact words, interprets only the messy-language step with a 245,820-byte local classifier, asks a person to confirm or correct the signals, preserves the original evidence, and counts repeated confirmed needs across distinct visits. The critical typed workflow runs in-browser with zero network inference. Voice is optional and connected.

## Why Small AI

Guestbook does not use AI for counting, storage, evidence grouping, thresholds, or business decisions. Deterministic code handles those jobs. The learned model exists only where rules failed to generalize: mapping messy English and Kiswahili visitor language into 15 bounded signals including UNKNOWN.

A transparent lexical baseline is competitive on the small synthetic set (93.0% micro-F1 versus 90.2% for Guestbook Micro), but on untouched MASSIVE semantic-transfer slices the rules fall to 16.7% in English and 2.3% in Kiswahili, while Guestbook Micro reaches 91.1% and 92.8%.

## 60-second demo video

**0:00–0:08**  
“Small tourism businesses hear useful visitor feedback every day, but the evidence disappears after the conversation.”

**0:08–0:20**  
Type: **My mother cannot walk very far and I want to buy some coffee beans.**  
“Guestbook interprets the messy language locally and proposes bounded signals. The original words stay attached.”

**0:20–0:31**  
Show Review. Confirm accessibility and product intent.  
“A person confirms or corrects what enters memory. Sensitive requirements never become automatic facts.”

**0:31–0:43**  
Show Memory changing from five to six visits, then Evidence.  
“Repeated memory is deterministic: six distinct confirmed visits, with every source record inspectable.”

**0:43–0:52**  
Open Decide.  
“Guestbook stops before the business decision. Noor decides what to do.”

**0:52–1:00**  
Show System → Model.  
“245,820 learned bytes. Zero network inference. AI only where language needs to generalize.”

## 60-second technical video

**0:00–0:12**  
“Guestbook Micro is one-vs-rest logistic classification over hashed Unicode character n-grams, three to five characters, 4,096 dimensions, 15 bounded labels, threshold 0.60.”

**0:12–0:24**  
Show System → Model → Model evolution.  
“Our first synthetic-only model failed external contact: 79.8% UNKNOWN on 5,000 Nairobi reviews and roughly 0.3% Swahili transfer. We rejected it.”

**0:24–0:38**  
Show promoted metrics.  
“The promoted model uses 2,687 training cases and exactly 245,820 bytes of learned weights. Untouched MASSIVE mapped-label hit is 91.1% English and 92.8% Kiswahili. Nairobi weak-label agreement is 98.0%.”

**0:38–0:52**  
Show Why learned AI.  
“Rules actually beat the model on our tiny synthetic F1 test, 93.0 to 90.2. But those same rules collapse on untouched MASSIVE: 16.7% English and 2.3% Kiswahili.”

**0:52–1:00**  
“Where deterministic code works, Guestbook uses it. The learned model exists only for the messy-language part rules failed to generalize to.”

## 60-second team/context video

“I built Guestbook solo for the World Bank Small AI Tourism challenge. I started from a simple question: what is the smallest useful intelligence a small tourism operator actually needs?

The answer was not a chatbot or a large model. It was a bounded interpreter that can survive messy visitor language, preserve the evidence, and still leave authority with the human operator.

The hardest part was rejecting results that looked good. Our first model scored well on our own synthetic examples but failed badly on external Nairobi and Kiswahili data, so I retrained it and kept the failure visible.

Guestbook now runs the critical typed path locally in the browser, keeps UNKNOWN as a valid answer, and uses human confirmation before anything becomes business memory.

We were not trying to build the smallest model possible. We were trying to find the smallest model that survived contact with data we did not write.”

## Golden proof inputs

**Kiswahili:**  
`Bei ni ngapi na mnakubali M-Pesa?`  
Expected: ASK_PRICE + ASK_PAYMENT.

**Mixed requirement/product:**  
`My mother cannot walk very far and I want to buy some coffee beans.`  
Expected: REQUIREMENT_ACCESSIBILITY + WANT_PRODUCT, then human confirmation.

**Abstention:**  
`My shirt is green.`  
Expected: UNKNOWN.

## Claims language

Say:
- **245,820 bytes of learned classifier weights**
- **zero network inference**
- **MASSIVE semantic-transfer probe**
- **Nairobi weak-label agreement**
- **typed critical path works offline**
- **voice is optional and connected**

Do not say:
- field accuracy
- offline speech recognition
- every language
- autonomous business decisions
- real customer adoption
- the whole app is 240 KB

## Final technical close

> We were not trying to build the smallest model possible. We were trying to find the smallest model that survived contact with data we did not write.
