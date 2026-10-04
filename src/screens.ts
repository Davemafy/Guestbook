export type ScreenSpec = {
  n: number;
  group: string;
  slug: string;
  title: string;
  headline: string;
  description: string;
  kind: string;
};

export const screens: ScreenSpec[] = [
  { n:1, group:"Entry", slug:"welcome", title:"Welcome / Place identity", headline:"Karibu Coffee Farm", description:"Establish the place before asking for feedback.", kind:"welcome" },
  { n:2, group:"Entry", slug:"language", title:"Choose language", headline:"Choose how you want to leave your message", description:"English and Kiswahili are available on this device.", kind:"choice" },
  { n:3, group:"Entry", slug:"mode", title:"Guest mode / Staff mode", headline:"How are you using Guestbook?", description:"Visitors leave evidence. Staff capture and review it.", kind:"choice" },
  { n:4, group:"Guest capture", slug:"leave-message", title:"Leave a message", headline:"What should the host know?", description:"Type, speak, or attach a photo. No account required.", kind:"compose" },
  { n:5, group:"Guest capture", slug:"voice-capture", title:"Voice capture", headline:"Speak naturally", description:"Your words become an editable transcript before anything is saved.", kind:"voice" },
  { n:6, group:"Guest capture", slug:"offline-voice-setup", title:"Offline voice setup", headline:"Install voice for offline use", description:"Download once while connected, then transcribe on this device.", kind:"setup" },
  { n:7, group:"Guest capture", slug:"photo-attachment", title:"Photo attachment", headline:"Add context with a photo", description:"Review or remove the local attachment before submission.", kind:"attachment" },
  { n:8, group:"Guest capture", slug:"transcript-review", title:"Transcript review", headline:"Check what Guestbook heard", description:"Edit the transcript before local interpretation.", kind:"transcript" },
  { n:9, group:"Guest capture", slug:"message-submitted", title:"Message submitted", headline:"Thank you", description:"Your message is saved on this device for the host to review.", kind:"success" },
  { n:10, group:"Staff capture", slug:"capture-after-visit", title:"Capture after a visit", headline:"Keep what the guest said", description:"Record a visitor observation after they leave.", kind:"compose" },
  { n:11, group:"Staff capture", slug:"source-selector", title:"Source selector", headline:"Who heard this?", description:"Preserve source, language, and visit identity.", kind:"choice" },
  { n:12, group:"Staff capture", slug:"quick-capture", title:"Quick capture", headline:"One sentence. Done.", description:"Designed for a guide standing between visits.", kind:"quick" },
  { n:13, group:"Staff capture", slug:"batch-capture", title:"Batch end-of-day capture", headline:"Add several observations", description:"Record the notes collected during the day without turning them into one visit.", kind:"batch" },
  { n:14, group:"Interpretation", slug:"local-interpretation", title:"Local interpretation", headline:"Guestbook understood this", description:"The small local model proposes a bounded set of business signals.", kind:"interpret" },
  { n:15, group:"Interpretation", slug:"confirm-signals", title:"Confirm signals", headline:"Check the interpretation", description:"Accept only what the source words actually support.", kind:"confirm" },
  { n:16, group:"Interpretation", slug:"correct-signals", title:"Correct signals", headline:"Fix what the model missed", description:"Add a missing signal or remove a bad one.", kind:"correct" },
  { n:17, group:"Interpretation", slug:"sensitive-confirmation", title:"Sensitive requirement confirmation", headline:"Confirm this requirement explicitly", description:"Accessibility and dietary/safety signals never enter memory automatically.", kind:"sensitive" },
  { n:18, group:"Interpretation", slug:"unknown", title:"Unknown / abstention", headline:"No confident business signal", description:"Guestbook can say it does not know.", kind:"unknown" },
  { n:19, group:"Interpretation", slug:"duplicate-check", title:"Duplicate / same-visit check", headline:"Is this a new visit?", description:"Keep one party from becoming several independent pieces of evidence.", kind:"duplicate" },
  { n:20, group:"Business memory", slug:"memory-overview", title:"Memory overview", headline:"What keeps repeating?", description:"The operator home: confirmed patterns across distinct visits.", kind:"memory" },
  { n:21, group:"Business memory", slug:"signal-detail", title:"Signal detail", headline:"Wants a product", description:"Inspect one recurring signal and the visits behind it.", kind:"signal" },
  { n:22, group:"Business memory", slug:"source-evidence-ledger", title:"Source evidence ledger", headline:"Original words, not summaries", description:"Every pattern stays traceable to its source evidence.", kind:"evidence" },
  { n:23, group:"Business memory", slug:"observation-detail", title:"Observation detail", headline:"One source record", description:"Inspect source, language, visit, time, media, and confirmed labels.", kind:"observation" },
  { n:24, group:"Business memory", slug:"new-evidence-moment", title:"New evidence moment", headline:"5 → 6 independent visits", description:"The signature accumulation state after a newly confirmed visit.", kind:"transition" },
  { n:25, group:"Business memory", slug:"recently-emerging", title:"Recently emerging", headline:"Signals starting to repeat", description:"Early patterns stay separate from mature evidence.", kind:"emerging" },
  { n:26, group:"Business memory", slug:"persistent-signals", title:"Persistent signals", headline:"Still showing up", description:"Patterns that continue across a longer operating period.", kind:"persistent" },
  { n:27, group:"Business memory", slug:"fading-signals", title:"Fading signals", headline:"Mentioned less often now", description:"See what used to repeat but has slowed down.", kind:"fading" },
  { n:28, group:"Business memory", slug:"contradictory-evidence", title:"Contradictory evidence", headline:"The evidence disagrees", description:"Show demand and resistance together instead of hiding conflict.", kind:"conflict" },
  { n:29, group:"Decision support", slug:"attention", title:"What deserves attention?", headline:"What deserves attention?", description:"Repeated evidence that has crossed the action threshold.", kind:"attention" },
  { n:30, group:"Decision support", slug:"decision-detail", title:"Decision detail", headline:"Should we sell take-home beans?", description:"One signal, its evidence, and operator context.", kind:"decision" },
  { n:31, group:"Decision support", slug:"explore-decision", title:"Explore decision", headline:"Explore this signal", description:"Mark the evidence as worth investigating without automating action.", kind:"explore" },
  { n:32, group:"Decision support", slug:"not-now", title:"Not now", headline:"Valid evidence. Deferred decision.", description:"Keep the signal visible without pretending it needs immediate action.", kind:"defer" },
  { n:33, group:"Decision support", slug:"wrong-signal", title:"Wrong signal", headline:"Reject misleading aggregation", description:"Repeated evidence can still be interpreted incorrectly.", kind:"wrong" },
  { n:34, group:"Decision support", slug:"decision-history", title:"Decision history", headline:"What did we decide before?", description:"Review prior operator choices alongside the evidence that informed them.", kind:"history" },
  { n:35, group:"Learning loop", slug:"record-change", title:"After we changed something", headline:"Record a business change", description:"Example: started selling 250g bean bags.", kind:"change" },
  { n:36, group:"Learning loop", slug:"signal-change", title:"Did the signal change?", headline:"Before and after", description:"Compare evidence before and after an operator intervention.", kind:"compare" },
  { n:37, group:"Learning loop", slug:"outcome-note", title:"Outcome note", headline:"What actually happened?", description:"Record the commercial or operational outcome in plain language.", kind:"outcome" },
  { n:38, group:"Learning loop", slug:"resolved-pattern", title:"Resolved pattern", headline:"This friction stopped repeating", description:"Close the loop when a change appears to resolve a recurring problem.", kind:"resolved" },
  { n:39, group:"Guest response", slug:"immediate-answer", title:"Immediate answer", headline:"Here is the verified answer", description:"Return operator-approved facts for known questions.", kind:"answer" },
  { n:40, group:"Guest response", slug:"safe-handoff", title:"Safe handoff", headline:"Ask the host", description:"When Guestbook should not answer, hand off clearly.", kind:"handoff" },
  { n:41, group:"Guest response", slug:"accessibility-info", title:"Accessibility information", headline:"What to expect before you arrive", description:"Only verified accessibility facts from the operator.", kind:"accessibility" },
  { n:42, group:"Guest response", slug:"products-experiences", title:"Products / experiences", headline:"Things visitors keep asking about", description:"Operator-controlled offerings shaped by repeated demand.", kind:"offer" },
  { n:43, group:"Visits", slug:"todays-visits", title:"Today’s visits", headline:"Today’s visits", description:"Distinct visit sessions and the observations attached to each.", kind:"visits" },
  { n:44, group:"Visits", slug:"visit-detail", title:"Visit detail", headline:"Visit #A14", description:"Everything heard during one visit stays grouped together.", kind:"visit" },
  { n:45, group:"Visits", slug:"end-visit", title:"End visit", headline:"Close this visit", description:"An explicit boundary keeps aggregation honest.", kind:"endvisit" },
  { n:46, group:"People & staff", slug:"shared-device-handoff", title:"Shared-device handoff", headline:"Return the phone to staff mode", description:"Protect business memory when a visitor has been using the device.", kind:"shared" },
  { n:47, group:"People & staff", slug:"staff-mode", title:"Staff mode", headline:"What needs staff attention?", description:"Capture, review queue, and device status.", kind:"staffmode" },
  { n:48, group:"People & staff", slug:"review-queue", title:"Review queue", headline:"Pending human review", description:"Observations waiting for confirmation before entering memory.", kind:"queue" },
  { n:49, group:"Business setup", slug:"create-guestbook", title:"Create this Guestbook", headline:"Set up this place", description:"Name the business and establish its local Guestbook.", kind:"create" },
  { n:50, group:"Business setup", slug:"what-you-offer", title:"What do you offer?", headline:"What happens here?", description:"Add operator-provided products, services, and experiences.", kind:"offers" },
  { n:51, group:"Business setup", slug:"verified-facts", title:"Verified facts", headline:"Facts Guestbook may safely repeat", description:"Opening hours, payments, accessibility, products, and other controlled facts.", kind:"facts" },
  { n:52, group:"Business setup", slug:"signal-vocabulary", title:"Signal vocabulary", headline:"What can Guestbook recognize?", description:"Inspect the bounded business-signal taxonomy.", kind:"vocabulary" },
  { n:53, group:"Business setup", slug:"languages", title:"Languages", headline:"Language support on this device", description:"Typed and installed voice languages, clearly separated.", kind:"languages" },
  { n:54, group:"Offline system", slug:"offline-readiness", title:"Offline readiness", headline:"Ready without a connection?", description:"Show exactly what is cached and usable offline.", kind:"offline" },
  { n:55, group:"Offline system", slug:"install-offline-voice", title:"Install offline voice", headline:"Download English voice", description:"One-time speech pack setup with real progress.", kind:"voiceinstall" },
  { n:56, group:"Offline system", slug:"storage", title:"Storage", headline:"What is stored here?", description:"Show local records, model bytes, speech pack size, and browser storage.", kind:"storage" },
  { n:57, group:"Offline system", slug:"offline-failure", title:"Offline failure state", headline:"This part needs a connection", description:"Keep all still-available offline paths visible.", kind:"offlinefail" },
  { n:58, group:"Offline system", slug:"reconnect", title:"Reconnect state", headline:"Connection restored", description:"Do not imply cross-device sync that does not exist.", kind:"reconnect" },
  { n:59, group:"Data control", slug:"export-memory", title:"Export memory", headline:"Export confirmed local memory", description:"Real, confirmed, non-demo observations only.", kind:"export" },
  { n:60, group:"Data control", slug:"import-restore", title:"Import / restore", headline:"Restore a Guestbook export", description:"Bring an intentionally exported local memory onto this device.", kind:"import" },
  { n:61, group:"Data control", slug:"delete-observation", title:"Delete observation", headline:"Delete this source record?", description:"Remove one local observation with explicit confirmation.", kind:"delete" },
  { n:62, group:"Data control", slug:"clear-guestbook", title:"Clear local Guestbook", headline:"Delete all local Guestbook data?", description:"A destructive reset for this browser.", kind:"clear" },
  { n:63, group:"Data control", slug:"demo-boundary", title:"Demo-data boundary", headline:"Demo evidence is marked", description:"Keep seeded examples visibly separate from real visitor evidence.", kind:"demo" },
  { n:64, group:"Trust", slug:"how-it-works", title:"How Guestbook works", headline:"Small model. Human review. Deterministic memory.", description:"Explain the product without AI theatre.", kind:"how" },
  { n:65, group:"Trust", slug:"why-signal-exists", title:"Why this signal exists", headline:"Why is this in memory?", description:"Expose source evidence, distinct visits, threshold, and confirmation.", kind:"why" },
  { n:66, group:"Trust", slug:"model-limitations", title:"Model limitations", headline:"What Guestbook does not know", description:"Language, coverage, score, and validation limitations.", kind:"limits" },
  { n:67, group:"Trust", slug:"privacy", title:"Privacy", headline:"What stays on this device", description:"Explain local storage, voice paths, and export clearly.", kind:"privacy" },
  { n:68, group:"Technical", slug:"model-lab", title:"Model Lab", headline:"Test local inference", description:"Run one sentence through the classifier and inspect scores.", kind:"lab" },
  { n:69, group:"Technical", slug:"benchmark-evidence", title:"Benchmark evidence", headline:"Frozen regression benchmark", description:"Precision, recall, F1, exact match, and model size.", kind:"benchmark" },
  { n:70, group:"Technical", slug:"external-validation", title:"External validation", headline:"Held-out transfer probes", description:"MASSIVE and Nairobi results, clearly not field accuracy.", kind:"validation" },
  { n:71, group:"Technical", slug:"offline-proof", title:"Offline proof", headline:"Prove the app still works disconnected", description:"Show shell, local model, and local records available offline.", kind:"proof" },
  { n:72, group:"Technical", slug:"demo-reset", title:"Demo reset", headline:"Restore the canonical recording state", description:"Return to five marked product-request demo visits.", kind:"reset" }
];

export const screenGroups = [...new Set(screens.map((screen) => screen.group))];

export function screenPath(screen: ScreenSpec) {
  return `/screens/${screen.n}-${screen.slug}`;
}

export function getScreenByPath(pathname: string) {
  if (pathname === "/") return screens[3];
  if (pathname === "/memory") return screens[19];
  if (pathname === "/decide") return screens[28];
  if (pathname === "/lab") return screens[67];
  const match = pathname.match(/^\/screens\/(\d+)-/);
  if (!match) return screens[3];
  return screens.find((screen) => screen.n === Number(match[1])) ?? screens[3];
}
