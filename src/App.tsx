import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { activeClassifier } from "./ai/classifier";
import { db } from "./storage/db";
import { seedDemoData } from "./data/demoData";
import { buildMemory, decisionCopy, type MemorySignal } from "./domain/memory";
import { HUMAN_CONFIRM_REQUIRED, LABELS, LABEL_META, type SignalLabel } from "./domain/labels";
import type { Observation, Prediction } from "./domain/observation";
import { createOfflineVoice, type OfflineVoiceController, type VoiceProgress } from "./voice/moonshine";
import { getScreenByPath, screenPath, screens, type ScreenSpec } from "./screens";

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

function fmtPercent(value: number) {
  return Math.round(value * 100) + "%";
}

function currentPendingId() {
  return sessionStorage.getItem("guestbook-pending-id");
}

function Button({
  children,
  variant = "primary",
  onClick,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return <button type={type} className={"ui-button " + variant} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Badge({ children, variant = "secondary" }: { children: ReactNode; variant?: "secondary" | "outline" | "destructive" | "success" }) {
  return <span className={"ui-badge " + variant}>{children}</span>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={"ui-card " + className}>{children}</section>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="ui-field">
      <span className="ui-label">{label}</span>
      {children}
      {hint && <span className="ui-hint">{hint}</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={"ui-input " + (props.className ?? "")} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={"ui-textarea " + (props.className ?? "")} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={"ui-select " + (props.className ?? "")} />;
}

function Alert({ title, children, variant = "default" }: { title: string; children: ReactNode; variant?: "default" | "destructive" | "success" }) {
  return <div className={"ui-alert " + variant}><strong>{title}</strong><div>{children}</div></div>;
}

function Progress({ value }: { value: number }) {
  return <div className="ui-progress"><span style={{ width: Math.max(0, Math.min(100, value)) + "%" }} /></div>;
}

function Tabs({ items, value, onChange }: { items: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="ui-tabs">{items.map((item) => <button key={item} className={value === item ? "active" : ""} onClick={() => onChange(item)}>{item}</button>)}</div>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <Card className="empty-card"><div className="empty-mark" /><h3>{title}</h3><p>{body}</p>{action && <div className="actions">{action}</div>}</Card>;
}

function DataTable({ rows }: { rows: Array<[string, string, string?]> }) {
  return (
    <div className="table-wrap">
      <table className="ui-table">
        <thead><tr><th>Item</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2] ?? "—"}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function AppShell({ screen, children }: { screen: ScreenSpec; children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) navigator.serviceWorker.ready.then(() => setReady(true)).catch(() => {});
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const navItems = [
    ["Guest view", 1],
    ["Capture", 4],
    ["Review", 48],
    ["Memory", 20],
    ["Decide", 29],
    ["Visits", 43],
    ["Staff", 47],
    ["Setup", 49],
    ["Offline", 54],
    ["Data", 59],
    ["Trust", 64],
    ["Lab", 68],
  ] as const;

  const currentSection =
    screen.n <= 9 ? "Guest view" :
    screen.n <= 19 ? (screen.n <= 13 ? "Capture" : "Review") :
    screen.n <= 28 ? "Memory" :
    screen.n <= 42 ? "Decide" :
    screen.n <= 48 ? (screen.n <= 45 ? "Visits" : "Staff") :
    screen.n <= 53 ? "Setup" :
    screen.n <= 58 ? "Offline" :
    screen.n <= 63 ? "Data" :
    screen.n <= 67 ? "Trust" : "Lab";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <button onClick={() => go("/screens/20-memory-overview")}>Guestbook</button>
        </div>

        <div className="sidebar-scroll primary-sidebar-nav">
          <div className="nav-group">
            <div className="nav-label">Workspace</div>
            {navItems.map(([label, number]) => {
              const target = screens.find((item) => item.n === number)!;
              return (
                <button
                  key={label}
                  className={currentSection === label ? "active" : ""}
                  onClick={() => go(screenPath(target))}
                >
                  <em>{label}</em>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sidebar-footer">
          <span className={"status-dot " + (!online || ready ? "ready" : "")} />
          <span>{online ? (ready ? "Offline ready" : "Preparing offline") : "Offline"}</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="mobile-screen-select">
            <Select
              value={currentSection}
              onChange={(event) => {
                const item = navItems.find(([label]) => label === event.target.value);
                if (!item) return;
                const target = screens.find((screenItem) => screenItem.n === item[1]);
                if (target) go(screenPath(target));
              }}
            >
              {navItems.map(([label]) => <option key={label} value={label}>{label}</option>)}
            </Select>
          </div>

          <div className="breadcrumb">
            <span>{screen.group}</span><b>/</b><strong>{screen.title}</strong>
          </div>

          <div className="topbar-actions">
            <Button variant="ghost" onClick={() => go("/screens/64-how-it-works")}>How it works</Button>
            <Button variant="outline" onClick={() => go("/screens/68-model-lab")}>Model Lab</Button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="screen-kicker">{screen.group}</div>
              <h1>{screen.headline}</h1>
              <p>{screen.description}</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function useObservations() {
  const [rows, setRows] = useState<Observation[]>([]);
  const refresh = async () => {
    await seedDemoData();
    setRows(await db.observations.orderBy("createdAt").reverse().toArray());
  };
  useEffect(() => { void refresh(); }, []);
  return { rows, refresh };
}

function CaptureMessageScreen() {
  const [language, setLanguage] = useState<"en" | "sw">("en");
  const [text, setText] = useState("My mother cannot walk very far and I want to buy some coffee beans.");
  const [busy, setBusy] = useState(false);

  async function interpret() {
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    const result = await activeClassifier.classify(text.trim());
    const id = crypto.randomUUID();
    await db.observations.put({
      id,
      visitId: crypto.randomUUID(),
      rawText: text.trim(),
      language,
      source: "guest",
      createdAt: Date.now(),
      predictions: result.predictions,
      confirmedLabels: [],
      status: "pending",
    });
    sessionStorage.setItem("guestbook-pending-id", id);
    sessionStorage.setItem("guestbook-transcript", text.trim());
    go("/screens/14-local-interpretation");
  }

  return (
    <div className="grid-2">
      <Card>
        <div className="card-header"><div><h2>Leave a message</h2><p>No account. Shared phone. Exact words first.</p></div><Badge variant="success">Local</Badge></div>
        <Tabs items={["English", "Kiswahili"]} value={language === "en" ? "English" : "Kiswahili"} onChange={(value) => setLanguage(value === "English" ? "en" : "sw")} />
        <Field label="What should the host know?" hint="The source sentence stays attached to every confirmed signal.">
          <Textarea rows={9} value={text} onChange={(event) => setText(event.target.value)} />
        </Field>
        <div className="actions">
          <Button variant="outline" onClick={() => go("/screens/5-voice-capture")}>Use voice</Button>
          <Button variant="outline" onClick={() => go("/screens/7-photo-attachment")}>Attach photo</Button>
          <Button onClick={interpret} disabled={busy}>{busy ? "Interpreting…" : "Interpret locally"}</Button>
        </div>
      </Card>
      <Card>
        <div className="card-header"><div><h3>What happens next</h3><p>Bounded local AI, then human authority.</p></div></div>
        <div className="stack">
          <div className="item-row"><span>1</span><div><strong>Interpret</strong><small>~240 KB classifier · 0 inference requests</small></div></div>
          <div className="item-row"><span>2</span><div><strong>Review</strong><small>Confirm, remove, or add signals.</small></div></div>
          <div className="item-row"><span>3</span><div><strong>Remember</strong><small>Distinct confirmed visits accumulate.</small></div></div>
        </div>
      </Card>
    </div>
  );
}

function VoiceCaptureScreen() {
  const [transcript, setTranscript] = useState(sessionStorage.getItem("guestbook-transcript") ?? "");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "listening" | "error">("idle");
  const [progress, setProgress] = useState<VoiceProgress | null>(null);
  const [error, setError] = useState("");
  const ref = useRef<OfflineVoiceController | null>(null);

  useEffect(() => () => { void ref.current?.stop(); ref.current?.close(); }, []);

  async function prepare() {
    setState("loading");
    setError("");
    try {
      const controller = await createOfflineVoice({
        onText: (text) => setTranscript(text),
        onLine: (text) => setTranscript(text),
        onProgress: setProgress,
        onError: (err) => { setError(err.message); setState("error"); },
      });
      ref.current = controller;
      await controller.load();
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  async function start() {
    if (!ref.current) return;
    setState("listening");
    try { await ref.current.start(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); setState("error"); }
  }

  async function stop() {
    if (!ref.current) return;
    await ref.current.stop();
    setState("ready");
  }

  function continueFlow() {
    sessionStorage.setItem("guestbook-transcript", transcript);
    go("/screens/8-transcript-review");
  }

  const pct = progress?.total ? Math.round(progress.fraction * 100) : 0;

  return (
    <div className="grid-2">
      <Card>
        <div className="card-header"><div><h2>Voice capture</h2><p>Optional input adapter. The transcript remains editable.</p></div><Badge variant="outline">English</Badge></div>
        <div className={"voice-panel " + (state === "listening" ? "live" : "")}>
          <div className="voice-orb"><span /></div>
          <strong>{state === "listening" ? "Listening on this device" : state === "ready" ? "Offline voice ready" : "Prepare offline voice"}</strong>
          <p>Speech does not make business decisions. It only produces text.</p>
        </div>
        {state === "loading" && <div className="stack-sm"><Progress value={pct || 12} /><span className="muted">{pct ? pct + "% downloaded" : "Preparing speech model…"}</span></div>}
        {error && <Alert title="Voice unavailable" variant="destructive">{error}</Alert>}
        <div className="actions">
          {state === "idle" || state === "error" ? <Button onClick={prepare}>Prepare offline voice</Button> : null}
          {state === "ready" ? <Button onClick={start}>Start recording</Button> : null}
          {state === "listening" ? <Button variant="destructive" onClick={stop}>Stop recording</Button> : null}
        </div>
      </Card>
      <Card>
        <Field label="Live transcript" hint="Edit before continuing.">
          <Textarea rows={10} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Your transcript appears here…" />
        </Field>
        <div className="actions"><Button onClick={continueFlow} disabled={transcript.trim().length < 3}>Review transcript</Button></div>
      </Card>
    </div>
  );
}

function TranscriptReviewScreen() {
  const [text, setText] = useState(sessionStorage.getItem("guestbook-transcript") ?? "My mother cannot walk very far and I want to buy some coffee beans.");
  async function save() {
    const result = await activeClassifier.classify(text.trim());
    const id = crypto.randomUUID();
    await db.observations.put({
      id, visitId: crypto.randomUUID(), rawText: text.trim(), language: "en", source: "guest",
      createdAt: Date.now(), predictions: result.predictions, confirmedLabels: [], status: "pending",
    });
    sessionStorage.setItem("guestbook-pending-id", id);
    go("/screens/14-local-interpretation");
  }
  return <Card><Field label="Transcript"><Textarea rows={10} value={text} onChange={(event) => setText(event.target.value)} /></Field><Alert title="Before you continue">Check names, accessibility details, prices, and product requests. The exact transcript becomes the source record.</Alert><div className="actions"><Button onClick={save}>Use this transcript</Button></div></Card>;
}

function PendingInterpretation({ confirm = false }: { confirm?: boolean }) {
  const [observation, setObservation] = useState<Observation | null>(null);
  const [selected, setSelected] = useState<Set<SignalLabel>>(new Set());

  useEffect(() => {
    (async () => {
      const id = currentPendingId();
      const row = id ? await db.observations.get(id) : await db.observations.where("status").equals("pending").last();
      if (!row) return;
      setObservation(row);
      setSelected(new Set(row.predictions.filter((p) => p.label !== "UNKNOWN").map((p) => p.label)));
    })();
  }, []);

  if (!observation) return <EmptyState title="No pending observation" body="Capture a guest message first." action={<Button onClick={() => go("/screens/4-leave-message")}>Open capture</Button>} />;

  async function commit() {
    if (!observation) return;
    const memoryBefore = buildMemory(await db.observations.toArray());
    const previous = Object.fromEntries([...selected].map((label) => [label, memoryBefore.find((item) => item.label === label)?.visitCount ?? 0]));
    sessionStorage.setItem("guestbook-last-accumulation", JSON.stringify(previous));
    await db.observations.update(observation.id, { status: "confirmed", confirmedLabels: [...selected] });
    go("/screens/24-new-evidence-moment");
  }

  return (
    <div className="grid-2">
      <Card>
        <div className="card-header"><div><h2>Source record</h2><p>Original words remain attached.</p></div><Badge variant="outline">{observation.language.toUpperCase()}</Badge></div>
        <blockquote className="source-quote">“{observation.rawText}”</blockquote>
        <div className="meta-row"><span>{observation.source.toUpperCase()}</span><span>JUST NOW</span><span>LOCAL RECORD</span></div>
      </Card>
      <Card>
        <div className="card-header"><div><h2>{confirm ? "Confirm signals" : "Local interpretation"}</h2><p>{confirm ? "A person decides what enters memory." : "Model scores are not calibrated probabilities."}</p></div><Badge variant="success">0 network</Badge></div>
        <div className="signal-stack">
          {observation.predictions.map((prediction) => {
            const active = selected.has(prediction.label);
            return (
              <button className={"signal-item " + (active ? "selected" : "")} key={prediction.label} onClick={() => {
                if (prediction.label === "UNKNOWN") return;
                setSelected((current) => {
                  const next = new Set(current);
                  active ? next.delete(prediction.label) : next.add(prediction.label);
                  return next;
                });
              }}>
                <span className="checkbox">{active ? "✓" : ""}</span>
                <span><strong>{LABEL_META[prediction.label].title}</strong><small>{LABEL_META[prediction.label].description}</small></span>
                <span className="score">{fmtPercent(prediction.score)}{HUMAN_CONFIRM_REQUIRED.has(prediction.label) && <em>Human confirm</em>}</span>
              </button>
            );
          })}
        </div>
        <div className="actions">
          {confirm ? <Button onClick={commit}>Confirm into memory</Button> : <Button onClick={() => go("/screens/15-confirm-signals")}>Continue to human review</Button>}
          <Button variant="outline" onClick={() => go("/screens/16-correct-signals")}>Correct signals</Button>
        </div>
      </Card>
    </div>
  );
}

function MemoryOverview({ detail = false }: { detail?: boolean }) {
  const { rows } = useObservations();
  const memory = useMemo(() => buildMemory(rows), [rows]);
  const featured = memory.find((signal) => signal.label === "WANT_PRODUCT") ?? memory[0];
  if (!featured) return <EmptyState title="No confirmed memory yet" body="Confirm an observation to begin building business memory." />;
  return (
    <div className="stack-lg">
      <div className="stats-grid">
        <Card><div className="stat"><span>Strongest signal</span><strong>{featured.visitCount}</strong><p>{featured.title}</p></div></Card>
        <Card><div className="stat"><span>Confirmed records</span><strong>{rows.filter((row) => row.status === "confirmed").length}</strong><p>Across distinct visit IDs</p></div></Card>
        <Card><div className="stat"><span>Signals in memory</span><strong>{memory.length}</strong><p>UNKNOWN excluded from action</p></div></Card>
      </div>
      <Card>
        <div className="card-header"><div><h2>{detail ? featured.title : "Business memory"}</h2><p>{detail ? featured.description : "Repeated evidence, ordered by distinct visits."}</p></div><Button variant="outline" onClick={() => go("/screens/22-source-evidence-ledger")}>View source evidence</Button></div>
        <div className="memory-list">
          {memory.map((signal) => <button key={signal.label} onClick={() => go("/screens/21-signal-detail")}><span><strong>{signal.title}</strong><small>{signal.description}</small></span><Badge variant={signal.visitCount >= 3 ? "success" : "outline"}>{signal.visitCount} visits</Badge></button>)}
        </div>
      </Card>
    </div>
  );
}

function EvidenceLedger() {
  const { rows } = useObservations();
  const memory = useMemo(() => buildMemory(rows), [rows]);
  const featured = memory.find((signal) => signal.label === "WANT_PRODUCT") ?? memory[0];
  return <Card><div className="card-header"><div><h2>{featured?.title ?? "Evidence"}</h2><p>Original source records remain inspectable.</p></div><Badge variant="outline">{featured?.observations.length ?? 0} sources</Badge></div><div className="evidence-list">{(featured?.observations ?? []).map((row) => <div className="evidence-row" key={row.id}><blockquote>“{row.rawText}”</blockquote><div><span>{row.isDemo ? "DEMO VISIT" : row.source.toUpperCase()}</span><span>{row.language.toUpperCase()}</span><span>{new Date(row.createdAt).toLocaleDateString()}</span></div></div>)}</div></Card>;
}

function TransitionScreen() {
  const { rows } = useObservations();
  const memory = useMemo(() => buildMemory(rows), [rows]);
  const featured = memory.find((signal) => signal.label === "WANT_PRODUCT") ?? memory[0];
  let previous = 5;
  try {
    const parsed = JSON.parse(sessionStorage.getItem("guestbook-last-accumulation") ?? "{}");
    if (featured && typeof parsed[featured.label] === "number") previous = parsed[featured.label];
  } catch {}
  const current = featured?.visitCount ?? previous;
  return (
    <Card className="transition-card">
      <div className="transition-number"><span>{previous}</span><b>→</b><strong>{current}</strong></div>
      <h2>{featured?.title ?? "Wants a product"}</h2>
      <p>{current} independent visits now point to the same confirmed business signal.</p>
      <Alert title="Why this matters" variant="success">This is deterministic accumulation across distinct visit IDs, not a generated recommendation.</Alert>
      <div className="actions"><Button onClick={() => go("/screens/20-memory-overview")}>Open business memory</Button><Button variant="outline" onClick={() => go("/screens/30-decision-detail")}>Review decision</Button></div>
    </Card>
  );
}

function DecisionScreen({ state }: { state: "detail" | "explore" | "defer" | "wrong" }) {
  const { rows } = useObservations();
  const memory = useMemo(() => buildMemory(rows).filter((signal) => signal.visitCount >= 3), [rows]);
  const signal = memory.find((item) => item.label === "WANT_PRODUCT") ?? memory[0];
  const copy = signal ? decisionCopy(signal) : { headline: "No repeated signal yet", body: "Confirm more independent observations." };
  const [decision, setDecision] = useState(() => localStorage.getItem("guestbook-featured-decision") ?? "");

  function choose(value: string) {
    setDecision(value);
    localStorage.setItem("guestbook-featured-decision", value);
  }

  return (
    <div className="grid-2">
      <Card>
        <div className="card-header"><div><h2>{copy.headline}</h2><p>{copy.body}</p></div>{signal && <Badge variant="success">{signal.visitCount} visits</Badge>}</div>
        <Alert title="Decision boundary">Guestbook shows repeated evidence. It does not price, order stock, message customers, or make the business decision.</Alert>
        <div className="actions">
          <Button variant={decision === "Explore" ? "primary" : "outline"} onClick={() => choose("Explore")}>Explore</Button>
          <Button variant={decision === "Not now" ? "primary" : "outline"} onClick={() => choose("Not now")}>Not now</Button>
          <Button variant={decision === "Wrong signal" ? "destructive" : "outline"} onClick={() => choose("Wrong signal")}>Wrong signal</Button>
        </div>
        {state !== "detail" && <Alert title={"Decision: " + (state === "explore" ? "Explore" : state === "defer" ? "Not now" : "Wrong signal")} variant={state === "wrong" ? "destructive" : "success"}>This screen records the operator’s choice while keeping the underlying evidence intact.</Alert>}
      </Card>
      <Card><div className="card-header"><div><h3>Source evidence</h3><p>Why this decision is here.</p></div></div><div className="evidence-list">{(signal?.observations ?? []).slice(0, 3).map((row) => <div className="evidence-row" key={row.id}><blockquote>“{row.rawText}”</blockquote><div><span>{row.isDemo ? "DEMO" : "REAL"}</span><span>{row.language.toUpperCase()}</span></div></div>)}</div></Card>
    </div>
  );
}

function GenericForm({ fields, destructive = false }: { fields: Array<[string,string,string?]>; destructive?: boolean }) {
  const [values, setValues] = useState<Record<string,string>>(() => Object.fromEntries(fields.map(([label, value]) => [label, value])));
  return <Card><div className="form-stack">{fields.map(([label,,hint]) => <Field key={label} label={label} hint={hint}><Input value={values[label]} onChange={(event) => setValues({...values,[label]:event.target.value})} /></Field>)}</div><div className="actions"><Button variant={destructive ? "destructive" : "primary"}>{destructive ? "Confirm destructive action" : "Save changes"}</Button><Button variant="outline">Cancel</Button></div></Card>;
}

function ChoiceCards({ options }: { options: Array<[string,string,string?]> }) {
  const [selected, setSelected] = useState(options[0]?.[0] ?? "");
  return <div className="choice-grid">{options.map(([title,body,badge]) => <button key={title} className={"choice-card " + (selected === title ? "selected" : "")} onClick={() => setSelected(title)}><div>{badge && <Badge variant="outline">{badge}</Badge>}<h3>{title}</h3><p>{body}</p></div><span className="radio">{selected === title ? "●" : "○"}</span></button>)}</div>;
}

function TechnicalLab({ benchmark = false }: { benchmark?: boolean }) {
  const [text, setText] = useState("How much is entry and can I pay by card?");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [report, setReport] = useState<Awaited<ReturnType<typeof activeClassifier.benchmark>> | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  async function run() {
    if (benchmark) setReport(await activeClassifier.benchmark());
    else {
      const result = await activeClassifier.classify(text);
      setPredictions(result.predictions);
      setMs(result.inferenceMs);
    }
  }
  return <div className="grid-2"><Card>{benchmark ? <Alert title="Frozen regression set">35 synthetic stress cases. This is not field accuracy.</Alert> : <Field label="Observation"><Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} /></Field>}<div className="actions"><Button onClick={run}>{benchmark ? "Run benchmark" : "Run local inference"}</Button></div></Card><Card>{benchmark ? <div className="metric-grid"><div><span>Micro F1</span><strong>{report ? fmtPercent(report.f1) : "—"}</strong></div><div><span>Precision</span><strong>{report ? fmtPercent(report.precision) : "—"}</strong></div><div><span>Recall</span><strong>{report ? fmtPercent(report.recall) : "—"}</strong></div><div><span>Exact</span><strong>{report ? fmtPercent(report.exactMatch) : "—"}</strong></div><div><span>Weights</span><strong>~240 KB</strong></div><div><span>Network</span><strong>0</strong></div></div> : <><div className="card-header"><div><h3>Predictions</h3><p>{ms === null ? "Run an observation." : ms.toFixed(2) + " ms on this device"}</p></div></div><div className="signal-stack">{predictions.map((p) => <div className="signal-item static" key={p.label}><span className="checkbox">✓</span><span><strong>{LABEL_META[p.label].title}</strong><small>{LABEL_META[p.label].description}</small></span><span className="score">{fmtPercent(p.score)}</span></div>)}</div></>}</Card></div>;
}

function ScreenBody({ screen }: { screen: ScreenSpec }) {
  switch (screen.n) {
    case 1:
      return <div className="hero-grid"><Card className="hero-card"><Badge variant="outline">Karibu Coffee Farm</Badge><h2>Every visit can teach the business.</h2><p>Guestbook keeps the exact words visitors leave behind, finds repetition locally, and gives the final decision back to the operator.</p><div className="actions"><Button onClick={() => go("/screens/2-language")}>Leave a message</Button><Button variant="outline" onClick={() => go("/screens/47-staff-mode")}>Staff mode</Button></div></Card><Card><DataTable rows={[["Local classifier","Ready","~240 KB"],["Business memory","On device","IndexedDB"],["Voice","Optional","Connected or offline pack"]]} /></Card></div>;
    case 2:
      return <ChoiceCards options={[["English","Type or speak in English.","Typed + voice"],["Kiswahili","Typed Kiswahili path.","Typed"],["Use device default","Continue with the language already selected on this shared phone.","Default"]]} />;
    case 3:
      return <ChoiceCards options={[["Guest","Leave a message without an account.","Public"],["Guide","Capture something a visitor told you.","Staff"],["Operator","Review memory and make decisions.","Private"]]} />;
    case 4: return <CaptureMessageScreen />;
    case 5: return <VoiceCaptureScreen />;
    case 6:
      return <div className="grid-2"><Card><div className="card-header"><div><h2>Offline voice pack</h2><p>Install once while connected.</p></div><Badge variant="outline">~74 MB</Badge></div><Progress value={68} /><div className="actions"><Button>Continue installation</Button><Button variant="outline">Use typing instead</Button></div></Card><Card><Alert title="Core Guestbook stays small">The 240 KB business classifier and typed workflow work offline without this optional speech pack.</Alert></Card></div>;
    case 7:
      return <div className="grid-2"><Card><div className="upload-zone"><strong>Drop a guest photo here</strong><p>or choose a local image</p><Button variant="outline">Choose photo</Button></div></Card><Card><div className="media-preview"><div className="media-placeholder" /><div><strong>IMG_2048.jpg</strong><span>1.8 MB · local attachment</span></div></div><div className="actions"><Button>Keep photo</Button><Button variant="destructive">Remove</Button></div></Card></div>;
    case 8: return <TranscriptReviewScreen />;
    case 9:
      return <EmptyState title="Message saved" body="Thank you. The host can review your exact words before they enter business memory." action={<Button onClick={() => go("/screens/1-welcome")}>Return to welcome</Button>} />;
    case 10:
      return <Card><Tabs items={["Guide","Operator"]} value="Guide" onChange={() => {}} /><Field label="What did the visitor say?"><Textarea rows={8} defaultValue="They loved the roasting, said the road was difficult, and asked whether we sell beans." /></Field><div className="actions"><Button onClick={() => go("/screens/14-local-interpretation")}>Interpret locally</Button></div></Card>;
    case 11:
      return <ChoiceCards options={[["Guest","Visitor entered this directly.","Source"],["Guide","Guide heard and recorded it.","Source"],["Operator","Operator heard and recorded it.","Source"]]} />;
    case 12:
      return <Card><Field label="Quick capture"><Textarea rows={6} defaultValue="Family asked if they could buy the beans they tasted." /></Field><div className="inline-fields"><Select defaultValue="en"><option value="en">English</option><option value="sw">Kiswahili</option></Select><Select defaultValue="guide"><option>Guide</option><option>Operator</option></Select><Button>Save and continue</Button></div></Card>;
    case 13:
      return <Card><div className="card-header"><div><h2>End-of-day notes</h2><p>Each row becomes a separate visit record.</p></div><Button variant="outline">Add row</Button></div><DataTable rows={[["Visit A14","Needs review","Asked about beans"],["Visit A15","Draft","Road was difficult"],["Visit A16","Draft","Asked about M-Pesa"]]} /><div className="actions"><Button>Review 3 observations</Button></div></Card>;
    case 14: return <PendingInterpretation />;
    case 15: return <PendingInterpretation confirm />;
    case 16:
      return <Card><div className="card-header"><div><h2>Correct the signal set</h2><p>Add only labels the source words support.</p></div></div><div className="tag-grid">{LABELS.filter((label) => label !== "UNKNOWN").map((label) => <button key={label}><span>{LABEL_META[label].title}</span><small>{LABEL_META[label].description}</small></button>)}</div><div className="actions"><Button onClick={() => go("/screens/15-confirm-signals")}>Return to confirmation</Button></div></Card>;
    case 17:
      return <div className="grid-2"><Card><Alert title="Explicit confirmation required" variant="destructive">Accessibility and dietary/safety signals can affect how a business responds to a visitor. Confirm the meaning before saving.</Alert><blockquote className="source-quote">“My mother cannot walk very far…”</blockquote></Card><Card><h3>Accessibility need</h3><p className="muted">Does the source clearly communicate an accessibility requirement?</p><div className="actions"><Button>Yes, confirm</Button><Button variant="outline">No, remove signal</Button></div></Card></div>;
    case 18:
      return <EmptyState title="No confident business signal" body="Guestbook is allowed to abstain. Keep the source record, add a signal manually, or discard it." action={<><Button variant="outline">Keep as UNKNOWN</Button><Button>Add a signal</Button></>} />;
    case 19:
      return <Card><Alert title="Possible duplicate visit">This observation looks close to Visit A14, created 4 minutes ago.</Alert><ChoiceCards options={[["Same visit","Attach this observation to A14.","Recommended"],["New visit","Count this as an independent visitor party.","Override"]]} /><div className="actions"><Button>Continue</Button></div></Card>;
    case 20: return <MemoryOverview />;
    case 21: return <MemoryOverview detail />;
    case 22: return <EvidenceLedger />;
    case 23:
      return <div className="grid-2"><Card><blockquote className="source-quote">“My mother cannot walk very far and I want to buy some coffee beans.”</blockquote><div className="meta-grid"><div><span>Source</span><strong>Guest</strong></div><div><span>Language</span><strong>English</strong></div><div><span>Visit</span><strong>A21</strong></div><div><span>Status</span><strong>Confirmed</strong></div></div></Card><Card><h3>Confirmed labels</h3><div className="actions"><Badge variant="success">Accessibility need</Badge><Badge variant="success">Wants product</Badge></div><Button variant="destructive" onClick={() => go("/screens/61-delete-observation")}>Delete observation</Button></Card></div>;
    case 24: return <TransitionScreen />;
    case 25:
      return <Card><div className="card-header"><div><h2>Recently emerging</h2><p>Early repetition, below the main decision threshold.</p></div></div><DataTable rows={[["Payment question","2 visits","This week"],["Booking request","2 visits","This week"],["Road friction","2 visits","Today"]]} /></Card>;
    case 26:
      return <Card><DataTable rows={[["Wants a product","6 visits","Persistent"],["Praise experience","5 visits","Persistent"],["Value friction","4 visits","Persistent"]]} /></Card>;
    case 27:
      return <Card><DataTable rows={[["Road friction","5 → 1","Fading"],["Cash-only question","4 → 0","Fading"],["Finding the entrance","3 → 1","Fading"]]} /></Card>;
    case 28:
      return <div className="grid-2"><Card><h3>For</h3><div className="big-number">4</div><p>Visitors asked for a packaged take-home product.</p></Card><Card><h3>Against / constraint</h3><div className="big-number">3</div><p>Visitors said luggage space or price would make them unlikely to buy.</p></Card></div>;
    case 29:
      return <Card><div className="priority-list">{[["Wants a product","6","Ready to review"],["Payment question","4","Repeated"],["Accessibility need","3","Human-sensitive"],["Road friction","3","Repeated"]].map(([a,b,c]) => <button key={a} onClick={() => go("/screens/30-decision-detail")}><span><strong>{a}</strong><small>{c}</small></span><Badge>{b} visits</Badge></button>)}</div></Card>;
    case 30: return <DecisionScreen state="detail" />;
    case 31: return <DecisionScreen state="explore" />;
    case 32: return <DecisionScreen state="defer" />;
    case 33: return <DecisionScreen state="wrong" />;
    case 34:
      return <Card><DataTable rows={[["Wants a product","Explore","Oct 4"],["Road friction","Not now","Oct 2"],["Cash payment","Wrong signal","Sep 29"]]} /></Card>;
    case 35:
      return <GenericForm fields={[["Change","Started selling 250g bean bags","Describe what changed."],["Date","2026-10-04"],["Linked signal","Wants a product"]]} />;
    case 36:
      return <div className="grid-2"><Card><h3>Before change</h3><div className="big-number">6</div><p>Product requests across the previous 12 visits.</p></Card><Card><h3>After change</h3><div className="big-number">2</div><p>Requests remain, but now include “where can I buy?” instead of “do you sell?”</p></Card></div>;
    case 37:
      return <Card><Field label="What happened?"><Textarea rows={8} defaultValue="We sold 18 small bags in the first week. Two visitors asked for a larger size." /></Field><Field label="Outcome"><Select defaultValue="positive"><option value="positive">Positive</option><option>Mixed</option><option>No clear change</option><option>Negative</option></Select></Field><div className="actions"><Button>Save outcome</Button></div></Card>;
    case 38:
      return <EmptyState title="Pattern resolved" body="Card-payment questions stopped repeating after a terminal was added. Keep the historical evidence for context." action={<Button variant="outline">View before/after evidence</Button>} />;
    case 39:
      return <Card><div className="answer-panel"><Badge variant="success">Verified fact</Badge><h2>Yes, card payments are accepted.</h2><p>Confirmed by the operator on October 3. If the terminal is unavailable, the host will tell you before payment.</p></div><div className="actions"><Button>Done</Button><Button variant="outline">Ask the host instead</Button></div></Card>;
    case 40:
      return <EmptyState title="Ask the host" body="Guestbook does not have a verified answer for this question. Show this screen to a staff member." action={<Button>Return to guest mode</Button>} />;
    case 41:
      return <div className="grid-2"><Card><h3>Walking</h3><DataTable rows={[["Main route","Approx. 180 m","Operator verified"],["Surface","Packed earth + concrete","Operator verified"],["Rest seating","2 points","Operator verified"]]} /></Card><Card><h3>Access</h3><DataTable rows={[["Steps","4 at roasting room","Operator verified"],["Ramp","Main tasting area","Operator verified"],["Toilet","Step-free","Operator verified"]]} /></Card></div>;
    case 42:
      return <div className="cards-3">{[["Roasted beans","250g bags available after tasting."],["Farm walk","Guided route through growing and processing."],["Roasting session","Small-group demonstration on scheduled days."]].map(([t,b]) => <Card key={t}><h3>{t}</h3><p>{b}</p><Button variant="outline">Ask host</Button></Card>)}</div>;
    case 43:
      return <Card><DataTable rows={[["A21","Active","2 observations"],["A20","Ended 18 min ago","1 observation"],["A19","Ended 42 min ago","3 observations"],["A18","Ended 1 hr ago","1 observation"]]} /></Card>;
    case 44:
      return <div className="grid-2"><Card><h3>Visit A21</h3><div className="meta-grid"><div><span>Started</span><strong>10:42</strong></div><div><span>Source</span><strong>Guest</strong></div><div><span>Language</span><strong>English</strong></div><div><span>Status</span><strong>Active</strong></div></div></Card><Card><h3>Observations</h3><div className="evidence-list"><div className="evidence-row"><blockquote>“Can I buy these beans?”</blockquote></div><div className="evidence-row"><blockquote>“My mother cannot walk very far.”</blockquote></div></div></Card></div>;
    case 45:
      return <Card><Alert title="End Visit A21?">Future observations will start a new independent visit. This boundary directly affects evidence counts.</Alert><div className="actions"><Button>End visit</Button><Button variant="outline">Keep active</Button></div></Card>;
    case 46:
      return <Card className="center-card"><Badge variant="outline">Shared device</Badge><h2>Hand the phone back to staff.</h2><p>Business memory and operator controls stay hidden until staff mode is restored.</p><div className="actions center"><Button>Return to staff mode</Button></div></Card>;
    case 47:
      return <div className="cards-3">{[["Capture","Record something a visitor said.","3 drafts"],["Review queue","Confirm observations before memory.","4 pending"],["Device","Offline shell and classifier ready.","Ready"]].map(([t,b,k]) => <Card key={t}><Badge variant="outline">{k}</Badge><h3>{t}</h3><p>{b}</p><Button variant="outline">Open</Button></Card>)}</div>;
    case 48:
      return <Card><div className="priority-list">{[["A21 · Guest","My mother cannot walk very far…","2 signals"],["A20 · Guide","Family asked to buy beans.","1 signal"],["A18 · Operator","Road was difficult after rain.","1 signal"]].map(([a,b,c]) => <button key={a} onClick={() => go("/screens/15-confirm-signals")}><span><strong>{a}</strong><small>{b}</small></span><Badge variant="outline">{c}</Badge></button>)}</div></Card>;
    case 49: return <GenericForm fields={[["Place name","Karibu Coffee Farm"],["Location label","Kiambu, Kenya"],["Device name","Front desk phone"]]} />;
    case 50: return <GenericForm fields={[["Experience","Coffee farm tour"],["Product","Roasted coffee beans"],["Service","Guided tasting"],["Other","Roasting demonstration"]]} />;
    case 51:
      return <Card><div className="card-header"><div><h2>Verified facts</h2><p>Only these facts can be repeated automatically to guests.</p></div><Button>Add fact</Button></div><DataTable rows={[["Cards accepted","Verified","Oct 3"],["Open 09:00–17:00","Verified","Oct 3"],["Step-free tasting area","Verified","Oct 2"],["250g beans available","Verified","Oct 4"]]} /></Card>;
    case 52:
      return <Card><div className="tag-grid">{LABELS.map((label) => <div key={label}><strong>{LABEL_META[label].title}</strong><small>{LABEL_META[label].description}</small></div>)}</div></Card>;
    case 53:
      return <Card><DataTable rows={[["English typed","Ready","Core"],["Kiswahili typed","Ready","Core"],["English connected voice","Browser-dependent","Optional"],["English offline voice","Installed","Moonshine"],["Kiswahili voice","Not supported","Do not claim"]]} /></Card>;
    case 54:
      return <div className="grid-2"><Card><div className="readiness"><span className="status-dot ready" /><div><h2>Offline ready</h2><p>App shell, local records, and classifier are available without a connection.</p></div></div><DataTable rows={[["App shell","Cached","Ready"],["Classifier","Cached","~240 KB"],["IndexedDB","Local","Ready"],["Voice pack","Optional","Installed separately"]]} /></Card><Card><Alert title="Cold proof">Close the tab, disconnect, reopen Guestbook, enter an unseen sentence, classify it, confirm it, and inspect the persisted memory.</Alert></Card></div>;
    case 55:
      return <Card><div className="card-header"><div><h2>English offline voice</h2><p>Moonshine Tiny Streaming · WebAssembly</p></div><Badge variant="outline">~74 MB pack</Badge></div><Progress value={42} /><p className="muted">31.2 MB / 74 MB · downloading model files</p><div className="actions"><Button>Continue download</Button><Button variant="outline">Use typing instead</Button></div></Card>;
    case 56:
      return <Card><DataTable rows={[["Business classifier","~240 KB","Required"],["Guestbook records","184 KB","24 observations"],["Offline voice pack","~74 MB","Optional"],["App shell","1.2 MB","Cached"]]} /></Card>;
    case 57:
      return <Alert title="Offline voice is not installed" variant="destructive">Typing, local classification, review, business memory, and decisions still work. Connect once only if you want the optional offline speech pack.</Alert>;
    case 58:
      return <Alert title="Connection restored" variant="success">Guestbook is online again. Local records stay local; this does not imply cross-device sync.</Alert>;
    case 59:
      return <Card><Alert title="Export scope">Confirmed, real observations only. Demo data is excluded.</Alert><DataTable rows={[["Records","12","Confirmed"],["Demo records","0","Excluded"],["Format","JSON","Portable"]]} /><div className="actions"><Button onClick={async () => {
        const rows = (await db.observations.toArray()).filter((row) => row.status === "confirmed" && !row.isDemo);
        const blob = new Blob([JSON.stringify(rows, null, 2)], {type:"application/json"});
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="guestbook-memory.json"; a.click(); URL.revokeObjectURL(url);
      }}>Export JSON</Button></div></Card>;
    case 60:
      return <Card><div className="upload-zone"><strong>Choose Guestbook export</strong><p>JSON created by Guestbook</p><Button variant="outline">Choose file</Button></div><Alert title="Restore policy">Import is explicit. Existing local records are not silently merged or overwritten.</Alert></Card>;
    case 61: return <GenericForm destructive fields={[["Observation ID","A21-02"],["Source","Guest"],["Reason","Entered by mistake"]]} />;
    case 62:
      return <Card><Alert title="This deletes local Guestbook data" variant="destructive">Confirmed observations, drafts, decisions, and local configuration on this browser will be removed.</Alert><Field label="Type CLEAR to continue"><Input placeholder="CLEAR" /></Field><div className="actions"><Button variant="destructive">Clear local Guestbook</Button></div></Card>;
    case 63:
      return <Card><div className="card-header"><div><h2>Demo boundary</h2><p>Seeded records must never masquerade as real field evidence.</p></div><Badge variant="outline">isDemo</Badge></div><DataTable rows={[["Demo visit 01","DEMO","Wants product"],["Demo visit 02","DEMO","Wants product"],["Visit A21","REAL","Pending review"]]} /></Card>;
    case 64:
      return <div className="cards-3">{[["1. Interpret","A ~240 KB local classifier proposes bounded business signals."],["2. Confirm","A human accepts, removes, or adds signals."],["3. Accumulate","Deterministic code counts distinct confirmed visits."],["4. Decide","The operator sees source-backed repetition and chooses what to do."],["5. Learn","Record what changed and whether the signal changed afterward."]].map(([t,b]) => <Card key={t}><h3>{t}</h3><p>{b}</p></Card>)}</div>;
    case 65:
      return <div className="grid-2"><Card><h2>Wants a product</h2><div className="big-number">6</div><p>Distinct confirmed visits</p><DataTable rows={[["Threshold","3 visits","Action review"],["Current","6 visits","Repeated"],["Generated recommendation","No","Human decides"]]} /></Card><EvidenceLedger /></div>;
    case 66:
      return <Card><DataTable rows={[["Model score","Not a calibrated probability","Limitation"],["Language coverage","English strongest; Kiswahili typed","Limitation"],["External evaluation","Transfer probes / weak labels","Not field accuracy"],["Voice","English only in current offline pack","Limitation"],["Recommendations","Not generated automatically","Product rule"]]} /></Card>;
    case 67:
      return <div className="cards-3">{[["Source text","Stored in IndexedDB on this browser."],["Local classifier","Runs on-device with no inference request."],["Connected voice","Uses browser speech service while connected."],["Offline voice","Runs on-device after optional pack install."],["Export","Only happens when the operator explicitly requests it."]].map(([t,b]) => <Card key={t}><h3>{t}</h3><p>{b}</p></Card>)}</div>;
    case 68: return <TechnicalLab />;
    case 69: return <TechnicalLab benchmark />;
    case 70:
      return <Card><DataTable rows={[["MASSIVE English","91.1%","Mapped-label hit"],["MASSIVE Swahili","92.8%","Mapped-label hit"],["Nairobi holdout","98.0%","Weak-label agreement"],["Field accuracy","Not claimed","Needs consented human labels"]]} /><Alert title="Interpretation">These are transfer and weak-supervision probes. They are not tourism field accuracy.</Alert></Card>;
    case 71:
      return <div className="grid-2"><Card><h3>Proof sequence</h3><ol className="steps"><li>Open while connected.</li><li>Wait for Offline ready.</li><li>Close the tab.</li><li>Disconnect / airplane mode.</li><li>Reopen Guestbook.</li><li>Enter an unseen sentence.</li><li>Classify and confirm it.</li><li>Reopen memory and verify persistence.</li></ol></Card><Card><Alert title="What this proves" variant="success">Offline shell + local inference + local persistence. Not merely a cached landing page.</Alert></Card></div>;
    case 72:
      return <Card><Alert title="Canonical recording state">Reset removes local test entries and restores five marked product-request demo visits.</Alert><div className="actions"><Button variant="destructive" onClick={async () => { await db.observations.clear(); localStorage.removeItem("guestbook-featured-decision"); sessionStorage.clear(); await seedDemoData(); window.location.reload(); }}>Reset demo</Button></div></Card>;
    default:
      return <Card><p>{screen.description}</p></Card>;
  }
}

export default function App() {
  useLocationKey();
  const screen = getScreenByPath(window.location.pathname);
  useEffect(() => { void seedDemoData(); }, []);
  return <AppShell screen={screen}><ScreenBody screen={screen} /></AppShell>;
}
