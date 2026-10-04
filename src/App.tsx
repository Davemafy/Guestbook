import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { activeClassifier } from "./ai/classifier";
import { db } from "./storage/db";
import { seedDemoData } from "./data/demoData";
import { buildMemory, decisionCopy, type MemorySignal } from "./domain/memory";
import { HUMAN_CONFIRM_REQUIRED, LABELS, LABEL_META, type SignalLabel } from "./domain/labels";
import type { Observation, Prediction } from "./domain/observation";


type SpeechAvailability = "available" | "downloadable" | "downloading" | "unavailable";

interface LocalSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}

interface LocalSpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<LocalSpeechRecognitionResult>;
}

interface LocalSpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((event: LocalSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

interface LocalSpeechRecognitionConstructor {
  new (): LocalSpeechRecognitionInstance;
  available?: (options: { langs: string[]; processLocally: true }) => Promise<SpeechAvailability>;
  install?: (options: { langs: string[]; processLocally: true }) => Promise<boolean>;
}

function getLocalSpeechRecognition(): LocalSpeechRecognitionConstructor | null {
  const candidate = window as typeof window & {
    SpeechRecognition?: LocalSpeechRecognitionConstructor;
    webkitSpeechRecognition?: LocalSpeechRecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

function useLocationKey() {
  const [key, setKey] = useState(() => window.location.pathname + window.location.search);
  useEffect(() => {
    const update = () => setKey(window.location.pathname + window.location.search);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return key;
}

function go(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatPercent(value: number) {
  return Math.round(value * 100) + "%";
}

function Header({ operator = false }: { operator?: boolean }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then(() => setOfflineReady(true))
        .catch(() => setOfflineReady(false));
    }

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const statusText = online ? (offlineReady ? "OFFLINE READY" : "PREPARING OFFLINE") : "OFFLINE";
  const statusClass = !online || offlineReady ? "status offline" : "status online";

  return (
    <header className="topbar">
      <button className="wordmark" onClick={() => go("/")}>GUESTBOOK</button>
      <div className="top-actions">
        {operator && <button className="quiet-link" onClick={() => go("/memory")}>Operator</button>}
        <span className={statusClass}><span className="status-dot" />{statusText}</span>
      </div>
    </header>
  );
}

function Shell({ children, operator = false }: { children: ReactNode; operator?: boolean }) {
  return <main className="page"><Header operator={operator} />{children}</main>;
}

function Home() {
  return (
    <Shell>
      <section className="hero">
        <p className="eyebrow">OFFLINE SMALL AI · TOURISM</p>
        <h1>Every visit teaches the business.</h1>
        <p className="lede">On one shared phone, Guestbook turns the comments, questions and needs that normally disappear after a visit into evidence a small tourism operator can actually use.</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => go("/guest")}>I’m visiting</button>
          <button className="secondary" onClick={() => go("/memory")}>Open operator memory</button>
        </div>
      </section>
      <section className="principle-strip">
        <div><span>01</span><strong>Pass the shared phone</strong><p>A guest speaks naturally, or a guide captures their words later. No account.</p></div>
        <div><span>02</span><strong>Small AI interprets locally</strong><p>No cloud inference. Multiple signals from one message.</p></div>
        <div><span>03</span><strong>Operator keeps control</strong><p>Every signal links back to the original words.</p></div>
      </section>
      <footer className="footer-line"><span>AI interprets.</span><span>Evidence accumulates.</span><span>Humans decide.</span></footer>
    </Shell>
  );
}

const guestCopy = {
  en: {
    label: "ENGLISH",
    eyebrow: "GUEST MODE · NO ACCOUNT",
    title: "What should the host know?",
    helper: "Use the shared phone to leave a comment, question or need in your own words. Nothing needs to sync first.",
    placeholder: "My mother cannot walk very far and I want to buy some coffee beans.",
    submit: "Add to Guestbook",
  },
  sw: {
    label: "KISWAHILI",
    eyebrow: "HALI YA MGENI · HAKUNA AKAUNTI",
    title: "Mwenyeji anapaswa kujua nini?",
    helper: "Tumia simu hii kuandika maoni, swali au hitaji kwa maneno yako. Hakuna haja ya kusawazisha kwanza.",
    placeholder: "Bei ni ngapi na mnakubali M-Pesa?",
    submit: "Ongeza kwenye Guestbook",
  },
};

function Guest() {
  const [language, setLanguage] = useState<keyof typeof guestCopy>("en");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<"checking" | SpeechAvailability | "installing" | "listening" | "error">("checking");
  const recognitionRef = useRef<LocalSpeechRecognitionInstance | null>(null);
  const copy = guestCopy[language];

  useEffect(() => {
    let cancelled = false;

    async function checkVoice() {
      if (language !== "en") {
        setVoiceState("unavailable");
        return;
      }

      const Recognition = getLocalSpeechRecognition();
      if (!Recognition?.available) {
        setVoiceState("unavailable");
        return;
      }

      setVoiceState("checking");
      try {
        const availability = await Recognition.available({
          langs: ["en-US"],
          processLocally: true,
        });
        if (!cancelled) setVoiceState(availability);
      } catch {
        if (!cancelled) setVoiceState("unavailable");
      }
    }

    void checkVoice();
    return () => {
      cancelled = true;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, [language]);

  async function installVoice() {
    const Recognition = getLocalSpeechRecognition();
    if (!Recognition?.install || language !== "en") return;

    setVoiceState("installing");
    try {
      const installed = await Recognition.install({
        langs: ["en-US"],
        processLocally: true,
      });
      setVoiceState(installed ? "available" : "unavailable");
    } catch {
      setVoiceState("error");
    }
  }

  function startVoice() {
    const Recognition = getLocalSpeechRecognition();
    if (!Recognition || language !== "en" || voiceState !== "available") return;

    const recognition = new Recognition();
    const base = text.trim();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.processLocally = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index++) {
        transcript += event.results[index][0]?.transcript ?? "";
      }
      const next = [base, transcript.trim()].filter(Boolean).join(base ? " " : "");
      setText(next);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceState("available");
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
      setVoiceState("error");
    };

    recognitionRef.current = recognition;
    setVoiceState("listening");
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceState("error");
    }
  }

  function stopVoice() {
    recognitionRef.current?.stop();
  }

  async function submit() {
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    const result = await activeClassifier.classify(text.trim());
    const id = crypto.randomUUID();
    const observation: Observation = {
      id,
      visitId: crypto.randomUUID(),
      rawText: text.trim(),
      language,
      source: "guest",
      createdAt: Date.now(),
      predictions: result.predictions,
      confirmedLabels: [],
      status: "pending",
    };
    await db.observations.add(observation);
    go("/review?id=" + encodeURIComponent(id));
  }

  const voiceLabel =
    voiceState === "listening" ? "LISTENING — TAP TO STOP" :
    voiceState === "available" ? "START OFFLINE VOICE" :
    voiceState === "downloadable" ? "INSTALL OFFLINE VOICE" :
    voiceState === "downloading" || voiceState === "installing" ? "INSTALLING VOICE…" :
    voiceState === "checking" ? "CHECKING OFFLINE VOICE…" :
    "OFFLINE VOICE UNAVAILABLE";

  const voiceAction =
    voiceState === "available" ? startVoice :
    voiceState === "listening" ? stopVoice :
    voiceState === "downloadable" ? installVoice :
    undefined;

  return (
    <Shell>
      <section className="narrow">
        <div className="language-switch" role="group" aria-label="Language">
          {(Object.keys(guestCopy) as Array<keyof typeof guestCopy>).map((key) => (
            <button key={key} className={language === key ? "language active" : "language"} onClick={() => setLanguage(key)}>
              {guestCopy[key].label}
            </button>
          ))}
        </div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="screen-title">{copy.title}</h1>
        <p className="lede">{copy.helper}</p>

        {language === "en" && (
          <section className={"voice-panel " + (voiceState === "listening" ? "listening" : "")}>
            <div className="voice-copy">
              <span>VOICE INPUT · BROWSER-LOCAL</span>
              <strong>{voiceLabel}</strong>
              <p>
                {voiceState === "available" || voiceState === "listening"
                  ? "English speech is processed on this device. Guestbook never falls back silently to cloud speech."
                  : voiceState === "downloadable"
                    ? "Your browser can install its English speech pack once. The Guestbook classifier stays ~240 KB."
                    : "Typing remains the guaranteed offline path on this browser."}
              </p>
            </div>
            <button
              className="voice-action"
              onClick={voiceAction}
              disabled={!voiceAction || voiceState === "installing" || voiceState === "downloading" || voiceState === "checking"}
            >
              {voiceState === "listening" ? "STOP" : voiceState === "downloadable" ? "INSTALL" : "VOICE"}
            </button>
          </section>
        )}

        <div className="type-divider"><span>OR TYPE</span></div>
        <textarea className="guest-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={copy.placeholder} rows={7} />
        <div className="input-footer">
          <span>{text.length} characters</span>
          <button className="primary" disabled={text.trim().length < 3 || busy} onClick={submit}>
            {busy ? "Understanding locally…" : copy.submit}
          </button>
        </div>
      </section>
    </Shell>
  );
}

function Capture() {
  const [source, setSource] = useState<"guide" | "operator">("guide");
  const [language, setLanguage] = useState("en");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    const result = await activeClassifier.classify(text.trim());
    const id = crypto.randomUUID();
    const observation: Observation = {
      id,
      visitId: crypto.randomUUID(),
      rawText: text.trim(),
      language,
      source,
      createdAt: Date.now(),
      predictions: result.predictions,
      confirmedLabels: [],
      status: "pending",
    };
    await db.observations.add(observation);
    go("/review?id=" + encodeURIComponent(id));
  }

  return (
    <Shell operator>
      <section className="narrow">
        <p className="eyebrow">CAPTURE LATER · SAME OFFLINE LOOP</p>
        <h1 className="screen-title">Keep what the guest said.</h1>
        <p className="lede">If the guest never touches the phone, the guide or operator can record the observation afterward. Guestbook stores the source separately and still requires review.</p>
        <div className="capture-controls">
          <div className="language-switch" role="group" aria-label="Observation source">
            <button className={source === "guide" ? "language active" : "language"} onClick={() => setSource("guide")}>GUIDE</button>
            <button className={source === "operator" ? "language active" : "language"} onClick={() => setSource("operator")}>OPERATOR</button>
          </div>
          <div className="language-switch" role="group" aria-label="Language">
            <button className={language === "en" ? "language active" : "language"} onClick={() => setLanguage("en")}>ENGLISH</button>
            <button className={language === "sw" ? "language active" : "language"} onClick={() => setLanguage("sw")}>KISWAHILI</button>
          </div>
        </div>
        <textarea
          className="guest-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="They loved the roasting, said the road was difficult, and asked whether we sell beans."
          rows={7}
          autoFocus
        />
        <div className="input-footer">
          <span>{text.length} characters · source: {source}</span>
          <button className="primary" disabled={text.trim().length < 3 || busy} onClick={submit}>
            {busy ? "Understanding locally…" : "Interpret observation"}
          </button>
        </div>
      </section>
    </Shell>
  );
}

function Review() {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  const [observation, setObservation] = useState<Observation | null>(null);
  const [selected, setSelected] = useState<Set<SignalLabel>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const item = requestedId
        ? await db.observations.get(requestedId)
        : await db.observations.where("status").equals("pending").last();
      setObservation(item ?? null);
      setSelected(new Set((item?.predictions ?? []).filter((p) => p.label !== "UNKNOWN").map((p) => p.label)));
      setLoading(false);
    })();
  }, [requestedId]);

  function toggle(label: SignalLabel) {
    if (label === "UNKNOWN") return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function confirm() {
    if (!observation) return;
    const before = buildMemory(await db.observations.toArray());
    const previousCounts = Object.fromEntries(
      [...selected].map((label) => [label, before.find((signal) => signal.label === label)?.visitCount ?? 0]),
    );
    sessionStorage.setItem("guestbook-last-accumulation", JSON.stringify(previousCounts));
    await db.observations.update(observation.id, { status: "confirmed", confirmedLabels: [...selected] });
    go("/memory");
  }

  if (loading) return <Shell operator><p className="lede">Loading local record…</p></Shell>;
  if (!observation) return <Shell operator><section className="empty"><h1>No pending observation.</h1><button className="primary" onClick={() => go("/guest")}>Add one</button></section></Shell>;

  return (
    <Shell operator>
      <section className="review-layout">
        <div>
          <p className="eyebrow">HUMAN REVIEW · {observation.source.toUpperCase()} SOURCE</p>
          <h1 className="screen-title">What Guestbook heard.</h1>
          <blockquote className="source-quote">“{observation.rawText}”</blockquote>
          <p className="microcopy">Nothing below replaces the original words. Tap any signal to correct the model before it enters memory.</p>
        </div>
        <div className="review-panel">
          <div className="interpret-proof">
            <div><strong>~240 KB</strong><span>learned weights</span></div>
            <div><strong>0</strong><span>network inference</span></div>
            <div><strong>LOCAL</strong><span>on this device</span></div>
          </div>
          <div className="panel-head"><span>INTERPRETED LOCALLY</span><span>{observation.predictions[0]?.engine ?? "guestbook-micro-v1"}</span></div>
          <div className="prediction-list">
            {observation.predictions.map((prediction) => (
              <button key={prediction.label} className={selected.has(prediction.label) ? "prediction selected signal-reveal" : "prediction signal-reveal"} onClick={() => toggle(prediction.label)}>
                <div>
                  <strong>{LABEL_META[prediction.label].title}</strong>
                  <small>{LABEL_META[prediction.label].description}</small>
                </div>
                <div className="score">
                  <span>score {formatPercent(prediction.score)}</span>
                  {HUMAN_CONFIRM_REQUIRED.has(prediction.label) && <em>confirm</em>}
                </div>
              </button>
            ))}
          </div>
          <details className="add-signal">
            <summary>Add or correct a signal</summary>
            <div className="label-grid">
              {LABELS.filter((label) => label !== "UNKNOWN").map((label) => (
                <button key={label} className={selected.has(label) ? "label active" : "label"} onClick={() => toggle(label)}>
                  {LABEL_META[label].title}
                </button>
              ))}
            </div>
          </details>
          <button className="primary full" onClick={confirm}>Confirm into memory</button>
        </div>
      </section>
    </Shell>
  );
}

function exportMemory(observations: Observation[]) {
  const rows = observations
    .filter((observation) => observation.status === "confirmed" && !observation.isDemo)
    .map((observation) => ({
      id: observation.id,
      visitId: observation.visitId,
      source: observation.source,
      language: observation.language,
      createdAt: new Date(observation.createdAt).toISOString(),
      rawText: observation.rawText,
      confirmedLabels: observation.confirmedLabels,
    }));
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    product: "Guestbook",
    records: rows,
  }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "guestbook-local-memory.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function Memory() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [expanded, setExpanded] = useState<SignalLabel | null>(null);
  const [previousCounts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("guestbook-last-accumulation") ?? "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    seedDemoData().then(() => db.observations.orderBy("createdAt").reverse().toArray()).then(setObservations);
  }, []);

  const memory = useMemo(() => buildMemory(observations), [observations]);

  return (
    <Shell operator>
      <section className="memory-head">
        <div>
          <p className="eyebrow">OPERATOR MEMORY · LOCAL ONLY</p>
          <h1 className="screen-title">What keeps repeating?</h1>
        </div>
        <div className="memory-actions">
          <button className="secondary" onClick={() => go("/guest")}>Guest entry</button>
          <button className="secondary" onClick={() => go("/capture")}>Capture later</button>
          <button className="secondary" onClick={() => exportMemory(observations)}>Export JSON</button>
          <button className="primary" onClick={() => go("/decide")}>What should I act on?</button>
        </div>
      </section>
      <section className="memory-grid">
        {memory.map((signal, index) => (
          <article key={signal.label} className={"memory-card " + (signal.label === "WANT_PRODUCT" && signal.visitCount >= 5 ? "memory-card-signature" : "")}>
            <div className="memory-rank">{String(index + 1).padStart(2, "0")}</div>
            <div className="memory-main">
              <div className="memory-title-row">
                <h2>{signal.title}</h2>
                {previousCounts[signal.label] !== undefined && signal.visitCount > previousCounts[signal.label] ? (
                  <strong className="count-change">
                    <i>{previousCounts[signal.label]}</i>
                    <b>→</b>
                    {signal.visitCount}
                    <span>visits · just now</span>
                  </strong>
                ) : (
                  <strong>{signal.visitCount} <span>visits</span></strong>
                )}
              </div>
              <p>{signal.description}</p>
              <button className="evidence-toggle" onClick={() => setExpanded(expanded === signal.label ? null : signal.label)}>
                {expanded === signal.label ? "Hide source evidence" : "View source evidence"}
              </button>
              {expanded === signal.label && (
                <div className="evidence-list">
                  {signal.observations.map((obs) => (
                    <div key={obs.id} className="evidence-item">
                      <span>{obs.language.toUpperCase()} · {obs.isDemo ? "DEMO VISIT" : obs.source.toUpperCase()}</span>
                      <p>“{obs.rawText}”</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
      <p className="dataset-note">Demo visits are visibly marked. New confirmed visits are stored only in this browser via IndexedDB.</p>
    </Shell>
  );
}

function Decide() {
  const [signals, setSignals] = useState<MemorySignal[]>([]);
  const [decisions, setDecisions] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem("guestbook-decisions") ?? "{}"));

  useEffect(() => {
    db.observations.toArray().then((rows) => setSignals(buildMemory(rows).filter((signal) => signal.visitCount >= 3)));
  }, []);

  function decide(label: string, decision: string) {
    const next = { ...decisions, [label]: decision };
    setDecisions(next);
    localStorage.setItem("guestbook-decisions", JSON.stringify(next));
  }

  return (
    <Shell operator>
      <section className="narrow decision-page">
        <p className="eyebrow">DECISION LAYER · HUMAN CONTROL</p>
        <h1 className="screen-title">Evidence, not autopilot.</h1>
        <p className="lede">Guestbook never changes the business for you. It surfaces repeated evidence and leaves the decision here.</p>
        <div className="decision-list">
          {signals.map((signal) => {
            const copy = decisionCopy(signal);
            return (
              <article className="decision-card" key={signal.label}>
                <span className="decision-count">{signal.visitCount} independent visits</span>
                <h2>{copy.headline}</h2>
                {signal.label === "WANT_PRODUCT" && (
                  <p className="decision-proof">Not a prediction. Not a generated recommendation. {signal.visitCount} pieces of confirmed evidence.</p>
                )}
                <p>{copy.body}</p>
                <div className="decision-buttons">
                  {["Explore","Not now","Wrong signal"].map((option) => (
                    <button key={option} className={decisions[signal.label] === option ? "decision active" : "decision"} onClick={() => decide(signal.label, option)}>{option}</button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <button className="quiet-link back-link" onClick={() => go("/memory")}>← Back to evidence</button>
      </section>
    </Shell>
  );
}

function Lab() {
  const [text, setText] = useState("How much is entry and can I pay by card?");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [report, setReport] = useState<Awaited<ReturnType<typeof activeClassifier.benchmark>> | null>(null);
  const [running, setRunning] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  async function resetDemo() {
    await db.observations.clear();
    localStorage.removeItem("guestbook-decisions");
    sessionStorage.removeItem("guestbook-last-accumulation");
    await seedDemoData();
    setPredictions([]);
    setInferenceMs(null);
    setReport(null);
    setResetMessage("Demo reset to five product-request visits.");
  }

  async function run() {
    setRunning(true);
    const result = await activeClassifier.classify(text);
    setPredictions(result.predictions);
    setInferenceMs(result.inferenceMs);
    setRunning(false);
  }

  async function runBenchmark() {
    setRunning(true);
    setReport(await activeClassifier.benchmark());
    setRunning(false);
  }

  return (
    <Shell operator>
      <section className="lab-head">
        <p className="eyebrow">MODEL LAB · NO CLOUD</p>
        <h1 className="screen-title">Prove the hard part.</h1>
        <p className="lede">Guestbook Micro v1 is a 4,096-dimensional hashed character n-gram logistic classifier trained from the bundled prototype set plus licensed external training partitions, then frozen into the app. No model download, API key, or network inference.</p>
      </section>
      <section className="lab-grid">
        <div className="lab-input panel">
          <label>Observation</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} />
          <button className="primary" onClick={run} disabled={running}>{running ? "Running locally…" : "Run local inference"}</button>
        </div>
        <div className="panel">
          <div className="panel-head"><span>PREDICTIONS</span><span>{inferenceMs === null ? "—" : inferenceMs.toFixed(2) + " ms"}</span></div>
          <div className="prediction-list compact">
            {predictions.length === 0 ? <p className="muted">Run an observation.</p> : predictions.map((prediction) => (
              <div className="prediction selected static" key={prediction.label}>
                <div><strong>{LABEL_META[prediction.label].title}</strong><small>{prediction.label}</small></div>
                <div className="score"><span>{formatPercent(prediction.score)}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="benchmark">
        <div className="benchmark-copy">
          <p className="eyebrow">REGRESSION CHECK</p>
          <h2>Frozen stress set.</h2>
          <p>This benchmark is deliberately labeled as synthetic. It protects the demo from regressions; it is not presented as field accuracy.</p>
          <button className="secondary" onClick={runBenchmark} disabled={running}>Run benchmark on this device</button>
        </div>
        <div className="metric-grid">
          <Metric label="Micro F1" value={report ? formatPercent(report.f1) : "—"} />
          <Metric label="Precision" value={report ? formatPercent(report.precision) : "—"} />
          <Metric label="Recall" value={report ? formatPercent(report.recall) : "—"} />
          <Metric label="Exact match" value={report ? formatPercent(report.exactMatch) : "—"} />
          <Metric label="Cases" value={report ? String(report.cases) : "35"} />
          <Metric label="Weights" value={report ? Math.round(report.weightBytes / 1024) + " KB" : "~240 KB"} />
          <Metric label="Median inference" value={report ? report.medianInferenceMs.toFixed(2) + " ms" : "—"} />
          <Metric label="Network inference" value="0 requests" />
        </div>
      </section>
      {report && <p className="dataset-note">{report.note} Model load: {report.loadMs.toFixed(2)} ms.</p>}
      <section className="benchmark external-benchmark">
        <div className="benchmark-copy">
          <p className="eyebrow">EXTERNAL EVIDENCE · HELD OUT</p>
          <h2>Beyond the synthetic demo set.</h2>
          <p>The promoted model was fit on MASSIVE train plus a hashed Nairobi training partition. These figures use untouched MASSIVE test and a held-out Nairobi lexical-anchor split. They are transfer probes, not field accuracy.</p>
        </div>
        <div className="metric-grid">
          <Metric label="MASSIVE English" value="91.1%" />
          <Metric label="MASSIVE Swahili" value="92.8%" />
          <Metric label="Nairobi weak-label holdout" value="98.0%" />
          <Metric label="Training cases" value="2,687" />
          <Metric label="Dimensions" value="4,096" />
          <Metric label="Weights" value="240 KB" />
        </div>
      </section>
      <section className="lab-reset">
        <div>
          <p className="eyebrow">RECORDING UTILITY</p>
          <strong>Reset local demo state</strong>
          <p>Deletes local test entries, restores the marked demo visits, and resets the product-request baseline to five.</p>
          {resetMessage && <span>{resetMessage}</span>}
        </div>
        <button className="secondary" onClick={resetDemo}>Reset demo</button>
      </section>
    </Shell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

export default function App() {
  const location = useLocationKey();

  useEffect(() => {
    seedDemoData();
    void activeClassifier.warmup();
  }, []);

  const path = location.split("?")[0];
  if (path === "/guest") return <Guest />;
  if (path === "/review") return <Review />;
  if (path === "/capture") return <Capture />;
  if (path === "/memory") return <Memory />;
  if (path === "/decide") return <Decide />;
  if (path === "/lab") return <Lab />;
  return <Home />;
}
