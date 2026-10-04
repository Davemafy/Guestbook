import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { activeClassifier } from "./ai/classifier";
import { db } from "./storage/db";
import { seedDemoData } from "./data/demoData";
import { buildMemory, decisionCopy, type MemorySignal } from "./domain/memory";
import { HUMAN_CONFIRM_REQUIRED, LABELS, LABEL_META, type SignalLabel } from "./domain/labels";
import type { Observation, Prediction } from "./domain/observation";


interface BrowserSpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

function getBrowserSpeechRecognition(): BrowserSpeechRecognitionConstructor | null {
  const scope = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

type Route = "guest" | "review" | "memory" | "evidence" | "decide" | "system";
type BannerTone = "accent" | "positive" | "warning" | "negative" | "neutral";
type ButtonHierarchy = "primary" | "secondary" | "tertiary" | "negative";
type ButtonSize = "small" | "medium";
type ButtonShape = "rect" | "pill";

const NAV: Array<{ key: Route; label: string; path: string }> = [
  { key: "guest", label: "Guest", path: "/" },
  { key: "review", label: "Review", path: "/review" },
  { key: "memory", label: "Memory", path: "/memory" },
  { key: "evidence", label: "Evidence", path: "/evidence" },
  { key: "decide", label: "Decide", path: "/decide" },
  { key: "system", label: "System", path: "/system" },
];

const guestCopy = {
  en: {
    language: "English",
    title: "What should the host know?",
    placeholder: "Tell us what worked, what was difficult, or what you wish you could do next.",
  },
  sw: {
    language: "Kiswahili",
    title: "Mwenyeji anapaswa kujua nini?",
    placeholder: "Tuambie kilichofanya kazi, kilichokuwa kigumu, au unachotamani kufanya baadaye.",
  },
} as const;

function useLocationKey() {
  const [key, setKey] = useState(() => window.location.pathname + window.location.search);
  useEffect(() => {
    const update = () => setKey(window.location.pathname + window.location.search);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return key;
}

function routeForPath(pathname: string): Route {
  if (pathname === "/review" || pathname.includes("confirm-signals") || pathname.includes("local-interpretation") || pathname.includes("review-queue")) return "review";
  if (pathname === "/memory" || pathname.includes("memory-overview") || pathname.includes("signal-detail") || pathname.includes("new-evidence-moment")) return "memory";
  if (pathname === "/evidence" || pathname.includes("source-evidence") || pathname.includes("observation-detail")) return "evidence";
  if (pathname === "/decide" || pathname.includes("attention") || pathname.includes("decision")) return "decide";
  if (pathname === "/system" || pathname === "/lab" || pathname.includes("offline") || pathname.includes("model-lab") || pathname.includes("benchmark") || pathname.includes("validation") || pathname.includes("demo-reset")) return "system";
  return "guest";
}

function go(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatPercent(value: number) {
  return Math.round(value * 100) + "%";
}

function formatAge(timestamp: number) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + " hr ago";
  return Math.round(hours / 24) + " d ago";
}

function sourceLabel(observation: Observation) {
  if (observation.isDemo || observation.source === "demo") return "Demo visit";
  if (observation.source === "guide") return "Guide";
  if (observation.source === "operator") return "Operator";
  return "Guest";
}

function BaseButton({
  children,
  hierarchy = "primary",
  size = "medium",
  shape = "rect",
  onClick,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  hierarchy?: ButtonHierarchy;
  size?: ButtonSize;
  shape?: ButtonShape;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={["base-button", hierarchy, size, shape, className].filter(Boolean).join(" ")}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
}

function BaseButtonGroup({
  items,
  value,
  onChange,
  shape = "pill",
  size = "small",
}: {
  items: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  shape?: ButtonShape;
  size?: ButtonSize;
}) {
  return (
    <div className="base-button-group" role="group">
      {items.map((item) => (
        <BaseButton
          key={item.value}
          hierarchy={value === item.value ? "primary" : "secondary"}
          size={size}
          shape={shape}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </BaseButton>
      ))}
    </div>
  );
}

function BaseBanner({
  tone = "neutral",
  children,
  action,
}: {
  tone?: BannerTone;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={"base-banner " + tone}>
      <div>{children}</div>
      {action && <div className="banner-action">{action}</div>}
    </div>
  );
}

function BaseBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: BannerTone }) {
  return <span className={"base-badge " + tone}>{children}</span>;
}

function BaseProgress({ value, tone = "accent" }: { value: number; tone?: BannerTone }) {
  return <div className={"base-progress " + tone}><span style={{ width: Math.max(0, Math.min(100, value)) + "%" }} /></div>;
}

function DockedAction({ children }: { children: ReactNode }) {
  return <div className="docked-action">{children}</div>;
}

function NavGlyph({ route }: { route: Exclude<Route, "system"> }) {
  const common = { width: 20, height: 20, viewBox: "0 0 20 20", "aria-hidden": true } as const;
  if (route === "guest") return <svg {...common} fill="none"><path d="M3 8.25 10 2.75l7 5.5V17H12v-5H8v5H3V8.25Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
  if (route === "review") return <svg {...common} fill="none"><path d="m4.5 10 3.1 3.1L15.8 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (route === "memory") return <svg {...common} fill="none"><path d="M4 4h12v12H4z" stroke="currentColor" strokeWidth="1.6"/><path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
  if (route === "evidence") return <svg {...common} fill="none"><path d="M3.5 5.5h13v9h-13z" stroke="currentColor" strokeWidth="1.6"/><path d="M6.5 8h7M6.5 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
  return <svg {...common} fill="none"><path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 3v3M17 10h-3M10 17v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}

function Shell({ route, children, layout = "compact" }: { route: Route; children: ReactNode; layout?: "normal" | "compact" }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) navigator.serviceWorker.ready.then(() => setOfflineReady(true)).catch(() => {});
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const status = online ? (offlineReady ? "Offline ready" : "Preparing offline") : "Offline";
  const mobileNav = NAV.filter((item): item is { key: Exclude<Route, "system">; label: string; path: string } => item.key !== "system");

  return (
    <div className={"base-app " + layout}>
      <header className="base-navigation">
        <div className={"nav-grid " + layout + "-grid"}>
          <button className="brand-mark" onClick={() => go("/")}>Guestbook</button>
          <nav className="desktop-nav" aria-label="Primary">
            {NAV.map((item) => (
              <button key={item.key} className={route === item.key ? "active" : ""} onClick={() => go(item.path)}>{item.label}</button>
            ))}
          </nav>
          <div className="nav-status">
            <span className={"status-pip " + (!online || offlineReady ? "positive" : "warning")} />
            <span>{status}</span>
          </div>
          <button className={"mobile-system-link " + (route === "system" ? "active" : "")} onClick={() => go("/system")}>
            System
          </button>
        </div>
      </header>

      {children}

      <nav className="base-bottom-navigation" aria-label="Primary mobile navigation">
        {mobileNav.map((item) => (
          <button key={item.key} className={route === item.key ? "active" : ""} onClick={() => go(item.path)}>
            <span className="bottom-nav-icon"><NavGlyph route={item.key} /></span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function PageTitle({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <div className="page-title">
      <div className="label-small">{kicker}</div>
      <h1>{title}</h1>
      {body && <p>{body}</p>}
    </div>
  );
}

function Field({ label, hint, meta, children }: { label: string; hint?: string; meta?: string; children: ReactNode }) {
  return (
    <label className="base-field">
      <span className="field-label-row">
        <span className="label-medium">{label}</span>
        {meta && <span className="field-meta">{meta}</span>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={"base-textarea " + (props.className ?? "")} />;
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

function AudioVisualizer({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audio = new AudioContextCtor();
    const source = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);

    const bins = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = () => {
      frame = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(bins);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--content-primary").trim() || "#111";

      const barCount = 28;
      const gap = Math.max(2, width * 0.006);
      const barWidth = Math.max(2, (width - gap * (barCount - 1)) / barCount);
      const usableBins = Math.min(bins.length, 72);
      const step = usableBins / barCount;

      for (let index = 0; index < barCount; index++) {
        const start = Math.floor(index * step);
        const end = Math.max(start + 1, Math.floor((index + 1) * step));
        let total = 0;
        for (let bin = start; bin < end; bin++) total += bins[bin] ?? 0;
        const level = total / Math.max(1, end - start) / 255;
        const shaped = Math.pow(level, 0.72);
        const barHeight = Math.max(height * 0.08, shaped * height * 0.92);
        const x = index * (barWidth + gap);
        const y = (height - barHeight) / 2;
        ctx.globalAlpha = 0.28 + shaped * 0.72;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
      ctx.globalAlpha = 1;
    };

    draw();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      source.disconnect();
      void audio.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} className="audio-visualizer" aria-hidden="true" />;
}

function GuestScreen() {
  const [language, setLanguage] = useState<keyof typeof guestCopy>("en");
  const [text, setText] = useState("");
  const [mediaDataUrl, setMediaDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "error" | "unavailable">(
    () => getBrowserSpeechRecognition() ? "idle" : "unavailable",
  );
  const [voiceError, setVoiceError] = useState("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const voiceRef = useRef<BrowserSpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRef = useRef<HTMLInputElement | null>(null);
  const copy = guestCopy[language];

  useEffect(() => () => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  function releaseAudioStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setAudioStream(null);
  }

  function attachPhoto(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setMediaDataUrl(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  async function startVoice() {
    if (!navigator.onLine) {
      setVoiceError("Voice transcription needs a connection on this phone. Typing and Guestbook AI still work offline.");
      setVoiceState("error");
      return;
    }

    const Recognition = getBrowserSpeechRecognition();
    if (!Recognition) {
      setVoiceState("unavailable");
      setVoiceError("This browser does not expose speech recognition. Type instead.");
      return;
    }

    releaseAudioStream();
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      setAudioStream(stream);
    } catch {
      setVoiceError("Allow microphone access to use voice. Typing remains available.");
      setVoiceState("error");
      return;
    }

    const recognition = new Recognition();
    const base = text.trim();
    recognition.lang = language === "sw" ? "sw-KE" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index++) {
        transcript += event.results[index]?.[0]?.transcript ?? "";
      }
      const clean = transcript.trim();
      setText([base, clean].filter(Boolean).join(base && clean ? " " : ""));
    };
    recognition.onend = () => {
      voiceRef.current = null;
      releaseAudioStream();
      setVoiceState("idle");
    };
    recognition.onerror = (event) => {
      voiceRef.current = null;
      releaseAudioStream();
      setVoiceState("idle");
      setVoiceError(
        event.error === "not-allowed"
          ? "Allow microphone access and try again."
          : "Voice transcription failed. Typing remains available.",
      );
    };

    setVoiceError("");
    voiceRef.current = recognition;
    setVoiceState("listening");
    try {
      recognition.start();
    } catch {
      voiceRef.current = null;
      releaseAudioStream();
      setVoiceState("error");
      setVoiceError("Voice could not start on this browser.");
    }
  }

  function stopVoice() {
    try {
      voiceRef.current?.stop();
    } finally {
      window.setTimeout(() => {
        if (streamRef.current) releaseAudioStream();
      }, 250);
    }
  }

  async function submit() {
    if (text.trim().length < 3 || busy) return;
    if (voiceState === "listening") stopVoice();
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
      mediaDataUrl: mediaDataUrl || undefined,
    };
    await db.observations.put(observation);
    sessionStorage.setItem("guestbook-pending-id", id);
    go("/review?id=" + encodeURIComponent(id));
  }

  return (
    <Shell route="guest" layout="normal">
      <main className="normal-grid guest-layout">
        <section className="guest-primary">
          <PageTitle
            kicker="Karibu Coffee Farm · Guest"
            title={copy.title}
            body="Leave the exact words first. Guestbook interprets them on this device, then a person decides what belongs in business memory."
          />

          <div className="section-gap">
            <BaseButtonGroup
              items={[
                { value: "en", label: "English" },
                { value: "sw", label: "Kiswahili" },
              ]}
              value={language}
              onChange={(value) => setLanguage(value as keyof typeof guestCopy)}
            />
          </div>

          <div className={"message-composer " + (voiceState === "listening" ? "is-listening" : "")}>
            <Field label="Your message" meta={text.length + "/1000"} hint="No account required. You can edit this before it is saved.">
              <Textarea rows={9} maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.placeholder} />
            </Field>
            <div className="composer-controls">
              <button className="composer-icon-button" type="button" onClick={() => mediaRef.current?.click()} aria-label="Attach photo" title="Attach photo">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.5 10.5 10 6a3 3 0 0 1 4.24 4.24l-5.66 5.67a4 4 0 1 1-5.66-5.66l6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {voiceState !== "listening" && voiceState !== "unavailable" && (
                <button className="composer-voice-button" type="button" onClick={() => void startVoice()} aria-label="Speak now">
                  <span className="mic-dot" aria-hidden="true" />
                  <span>Speak now</span>
                </button>
              )}
              {voiceState === "listening" && (
                <div className="listening-control">
                  <span className="listening-label"><span className="record-dot" />Listening</span>
                  <AudioVisualizer stream={audioStream} />
                  <button className="stop-listening" type="button" onClick={stopVoice}>Stop</button>
                </div>
              )}
            </div>
          </div>

          {mediaDataUrl && (
            <div className="media-preview">
              <img src={mediaDataUrl} alt="" />
              <div><span className="label-small">Attached photo</span><BaseButton hierarchy="tertiary" size="small" shape="rect" onClick={() => setMediaDataUrl("")}>Remove</BaseButton></div>
            </div>
          )}

          <input ref={mediaRef} className="sr-only" type="file" accept="image/*" onChange={(event) => attachPhoto(event.target.files?.[0])} />

          {voiceState === "unavailable" && <BaseBanner tone="neutral">Voice is unavailable in this browser. Typing and local Guestbook inference still work offline.</BaseBanner>}
          {voiceError && <BaseBanner tone="negative">{voiceError}</BaseBanner>}
        </section>

        <aside className="guest-context">
          <div className="context-rule">
            <div className="label-small">What happens next</div>
            <div className="context-step"><strong>Interpret</strong><p>~240 KB classifier. No inference request.</p></div>
            <div className="context-step"><strong>Review</strong><p>A person confirms or corrects the signals.</p></div>
            <div className="context-step"><strong>Remember</strong><p>Only confirmed evidence accumulates across distinct visits.</p></div>
          </div>
        </aside>
      </main>

      <DockedAction>
        <div className="normal-grid dock-grid">
          <div className="dock-copy"><span className="label-small">Source stays attached</span><span>Guest words remain evidence, not a generated summary.</span></div>
          <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={submit} disabled={text.trim().length < 3 || busy}>
            {busy ? "Interpreting locally…" : "Interpret locally"}
          </BaseButton>
        </div>
      </DockedAction>
    </Shell>
  );
}

function ReviewScreen() {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id") || sessionStorage.getItem("guestbook-pending-id");
  const [observation, setObservation] = useState<Observation | null>(null);
  const [selected, setSelected] = useState<Set<SignalLabel>>(new Set());
  const [sensitiveConfirmed, setSensitiveConfirmed] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);

  useEffect(() => {
    (async () => {
      const row = requestedId
        ? await db.observations.get(requestedId)
        : await db.observations.where("status").equals("pending").last();
      if (!row) return;
      setObservation(row);
      setSelected(new Set(row.predictions.filter((prediction) => prediction.label !== "UNKNOWN").map((prediction) => prediction.label)));
    })();
  }, [requestedId]);

  const hasSensitive = [...selected].some((label) => HUMAN_CONFIRM_REQUIRED.has(label));

  function toggle(label: SignalLabel) {
    if (label === "UNKNOWN") return;
    setSelected((current) => {
      const next = new Set(current);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
    if (HUMAN_CONFIRM_REQUIRED.has(label)) setSensitiveConfirmed(false);
  }

  async function confirm() {
    if (!observation || (hasSensitive && !sensitiveConfirmed)) return;
    const before = buildMemory(await db.observations.toArray());
    const previous = Object.fromEntries([...selected].map((label) => [label, before.find((signal) => signal.label === label)?.visitCount ?? 0]));
    sessionStorage.setItem("guestbook-last-accumulation", JSON.stringify(previous));
    await db.observations.update(observation.id, { status: "confirmed", confirmedLabels: [...selected] });
    go("/memory");
  }

  return (
    <Shell route="review" layout="compact">
      <main className="compact-grid compact-page">
        <section className="review-source">
          <PageTitle kicker="Human review" title="Keep the words. Check the interpretation." body="Nothing enters business memory until a person confirms it." />

          {observation ? (
            <div className="source-block">
              <div className="source-meta">
                <BaseBadge>{sourceLabel(observation)}</BaseBadge>
                <span>{observation.language.toUpperCase()}</span>
                <span>{formatAge(observation.createdAt)}</span>
              </div>
              <blockquote>“{observation.rawText}”</blockquote>
              {observation.mediaDataUrl && <img className="review-media" src={observation.mediaDataUrl} alt="" />}
            </div>
          ) : (
            <BaseBanner tone="neutral">No pending observation. Capture a guest message first.</BaseBanner>
          )}
        </section>

        <section className="review-signals">
          <div className="section-heading">
            <div><span className="label-small">Local interpretation</span><h2>Proposed signals</h2></div>
            <div className="proof-inline"><span>~240 KB</span><span>0 network</span></div>
          </div>

          {observation && (
            <>
              <div className="selection-list">
                {observation.predictions.map((prediction) => {
                  const active = selected.has(prediction.label);
                  const sensitive = HUMAN_CONFIRM_REQUIRED.has(prediction.label);
                  return (
                    <button className={"selection-row " + (active ? "selected" : "")} key={prediction.label} onClick={() => toggle(prediction.label)}>
                      <span className="base-check">{active ? "✓" : ""}</span>
                      <span className="selection-copy">
                        <strong>{LABEL_META[prediction.label].title}</strong>
                        <small>{LABEL_META[prediction.label].description}</small>
                      </span>
                      <span className="selection-score">{formatPercent(prediction.score)}{sensitive && <em>Human confirm</em>}</span>
                    </button>
                  );
                })}
              </div>

              <BaseButton hierarchy="tertiary" size="small" shape="rect" onClick={() => setShowCorrections((value) => !value)}>
                {showCorrections ? "Close corrections" : "Add or correct a signal"}
              </BaseButton>

              {showCorrections && (
                <div className="correction-area">
                  <BaseButtonGroup
                    items={LABELS.filter((label) => label !== "UNKNOWN").map((label) => ({ value: label, label: LABEL_META[label].title }))}
                    value=""
                    onChange={(value) => toggle(value as SignalLabel)}
                    shape="pill"
                    size="small"
                  />
                </div>
              )}

              {hasSensitive && (
                <BaseBanner tone="warning">
                  <label className="sensitive-confirm"><input type="checkbox" checked={sensitiveConfirmed} onChange={(event) => setSensitiveConfirmed(event.target.checked)} />I checked the source words and explicitly confirm the sensitive requirement.</label>
                </BaseBanner>
              )}
            </>
          )}
        </section>
      </main>

      <DockedAction>
        <div className="compact-grid dock-grid">
          <div className="dock-copy"><span className="label-small">Human authority</span><span>Model scores are not calibrated probabilities.</span></div>
          <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={confirm} disabled={!observation || (hasSensitive && !sensitiveConfirmed)}>Confirm into memory</BaseButton>
        </div>
      </DockedAction>
    </Shell>
  );
}

function MemoryScreen() {
  const { rows } = useObservations();
  const memory = useMemo(() => buildMemory(rows), [rows]);
  const featured = memory.find((signal) => signal.label === "WANT_PRODUCT" && signal.visitCount >= 5) ?? memory[0] ?? null;
  const rest = featured ? memory.filter((signal) => signal.label !== featured.label) : memory;
  let previousCount: number | null = null;
  try {
    const previous = JSON.parse(sessionStorage.getItem("guestbook-last-accumulation") ?? "{}");
    if (featured && typeof previous[featured.label] === "number") previousCount = previous[featured.label];
  } catch {}
  const changed = featured && previousCount !== null && featured.visitCount > previousCount;

  return (
    <Shell route="memory" layout="compact">
      <main className="compact-grid compact-page">
        <section className="memory-title">
          <PageTitle kicker="Business memory" title="What keeps repeating?" body="A pattern exists only when confirmed observations from distinct visits keep pointing to the same thing." />
        </section>

        {featured ? (
          <>
            <section className="memory-count">
              <div className="count-line">
                {changed && <span>{previousCount}</span>}
                {changed && <b>→</b>}
                <strong>{featured.visitCount}</strong>
              </div>
              <div className="label-medium">independent visits</div>
              <BaseProgress value={Math.min(100, featured.visitCount * 12)} tone="positive" />
            </section>

            <section className="memory-feature">
              <div className="label-small">Strongest repeating signal</div>
              <h2>{featured.title}</h2>
              <p>{featured.description}</p>
              <BaseBanner tone="positive">Not a prediction. {featured.visitCount} confirmed source records from distinct visits.</BaseBanner>
              <div className="base-button-group">
                <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={() => go("/evidence?signal=" + featured.label)}>View evidence</BaseButton>
                <BaseButton hierarchy="secondary" size="medium" shape="rect" onClick={() => go("/decide")}>Review decision</BaseButton>
              </div>
            </section>

            <section className="memory-list-section">
              <div className="section-heading"><div><span className="label-small">Other signals</span><h2>Everything else in memory</h2></div></div>
              <div className="base-list">
                {rest.map((signal) => (
                  <button className="base-list-row" key={signal.label} onClick={() => go("/evidence?signal=" + signal.label)}>
                    <span><strong>{signal.title}</strong><small>{signal.description}</small></span>
                    <BaseBadge tone={signal.visitCount >= 3 ? "positive" : "neutral"}>{signal.visitCount} visits</BaseBadge>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="memory-empty"><div className="empty-state"><h2>No confirmed memory yet</h2><p>Capture and review an observation to begin.</p><BaseButton hierarchy="primary" size="medium" shape="rect" onClick={() => go("/")}>Open Guest</BaseButton></div></section>
        )}
      </main>
    </Shell>
  );
}

function EvidenceScreen() {
  const { rows } = useObservations();
  const memory = useMemo(() => buildMemory(rows), [rows]);
  const query = new URLSearchParams(window.location.search);
  const requested = query.get("signal") as SignalLabel | null;
  const signal = memory.find((item) => item.label === requested) ?? memory.find((item) => item.label === "WANT_PRODUCT") ?? memory[0] ?? null;

  return (
    <Shell route="evidence" layout="compact">
      <main className="compact-grid compact-page">
        <section className="evidence-title">
          <PageTitle kicker="Source evidence" title={signal ? signal.title : "Evidence"} body="Original words stay visible. Guestbook never needs to replace evidence with a generated summary." />
          {memory.length > 0 && (
            <div className="section-gap">
              <BaseButtonGroup
                items={memory.slice(0, 6).map((item) => ({ value: item.label, label: item.title }))}
                value={signal?.label ?? ""}
                onChange={(value) => go("/evidence?signal=" + value)}
                shape="pill"
                size="small"
              />
            </div>
          )}
        </section>

        <section className="evidence-summary">
          {signal && <>
            <div className="evidence-stat"><strong>{signal.visitCount}</strong><span>distinct visits</span></div>
            <p>{signal.description}</p>
          </>}
        </section>

        <section className="evidence-ledger">
          <div className="section-heading"><div><span className="label-small">Ledger</span><h2>Every source record</h2></div><span className="paragraph-small">{signal?.observations.length ?? 0} observations</span></div>
          <div className="evidence-rows">
            {(signal?.observations ?? []).map((observation, index) => (
              <article className="evidence-row" key={observation.id}>
                <div className="evidence-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="evidence-quote">“{observation.rawText}”</div>
                <div className="evidence-meta">
                  <BaseBadge tone={observation.isDemo ? "neutral" : "positive"}>{observation.isDemo ? "Demo" : "Real"}</BaseBadge>
                  <span>{sourceLabel(observation)}</span>
                  <span>{observation.language.toUpperCase()}</span>
                  <span>{formatAge(observation.createdAt)}</span>
                </div>
                {observation.mediaDataUrl && <img className="evidence-media" src={observation.mediaDataUrl} alt="" />}
              </article>
            ))}
          </div>
        </section>
      </main>
    </Shell>
  );
}

function DecideScreen() {
  const { rows } = useObservations();
  const repeated = useMemo(() => buildMemory(rows).filter((signal) => signal.visitCount >= 3), [rows]);
  const signal = repeated.find((item) => item.label === "WANT_PRODUCT") ?? repeated[0] ?? null;
  const [decision, setDecision] = useState(() => localStorage.getItem("guestbook-decision-" + (signal?.label ?? "none")) ?? "");

  useEffect(() => {
    setDecision(localStorage.getItem("guestbook-decision-" + (signal?.label ?? "none")) ?? "");
  }, [signal?.label]);

  function choose(value: string) {
    if (!signal) return;
    localStorage.setItem("guestbook-decision-" + signal.label, value);
    setDecision(value);
  }

  const copy = signal ? decisionCopy(signal) : null;

  return (
    <Shell route="decide" layout="compact">
      <main className="compact-grid compact-page">
        <section className="decide-title">
          <PageTitle kicker="Operator decision" title="Evidence stops here." body="Guestbook can show what repeats. It cannot decide what the business should become." />
        </section>

        {signal && copy ? (
          <>
            <section className="decision-main">
              <div className="decision-count"><strong>{signal.visitCount}</strong><span>distinct visits</span></div>
              <div className="label-small">Repeated signal</div>
              <h2>People keep asking to take something home.</h2>
              <h3>{copy.headline}</h3>
              <p>{copy.body}</p>
              <BaseButtonGroup
                items={[
                  { value: "Explore", label: "Explore" },
                  { value: "Not now", label: "Not now" },
                  { value: "Wrong signal", label: "Wrong signal" },
                ]}
                value={decision}
                onChange={choose}
                shape="rect"
                size="medium"
              />
              {decision && <BaseBanner tone={decision === "Wrong signal" ? "negative" : decision === "Explore" ? "positive" : "neutral"}>Decision saved locally: {decision}.</BaseBanner>}
            </section>

            <section className="decision-proof">
              <div className="section-heading"><div><span className="label-small">Why this is here</span><h2>Source-backed repetition</h2></div><BaseBadge tone="positive">{signal.visitCount} visits</BaseBadge></div>
              <div className="mini-evidence">
                {signal.observations.slice(0, 3).map((observation) => (
                  <div key={observation.id}><p>“{observation.rawText}”</p><span>{observation.isDemo ? "Demo visit" : sourceLabel(observation)}</span></div>
                ))}
              </div>
              <BaseButton hierarchy="secondary" size="small" shape="rect" onClick={() => go("/evidence?signal=" + signal.label)}>Open all evidence</BaseButton>
            </section>

            <section className="decision-boundary">
              <BaseBanner tone="accent">Guestbook does not set prices, order stock, send messages, change bookings, or take action automatically.</BaseBanner>
            </section>
          </>
        ) : (
          <section className="memory-empty"><div className="empty-state"><h2>Nothing has repeated enough yet</h2><p>Signals appear here after confirmation across at least three distinct visits.</p><BaseButton hierarchy="primary" size="medium" shape="rect" onClick={() => go("/memory")}>Open memory</BaseButton></div></section>
        )}
      </main>
    </Shell>
  );
}

function SystemScreen() {
  const { rows, refresh } = useObservations();
  const [tab, setTab] = useState("Offline");
  const [offlineReady, setOfflineReady] = useState(false);
  const browserVoiceAvailable = Boolean(getBrowserSpeechRecognition());
  const [labText, setLabText] = useState("How much is entry and can I pay by card?");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [benchmark, setBenchmark] = useState<{ f1: number; precision: number; recall: number; exactMatch: number; cases: number; weightBytes: number; contradictionGuardCases?: number; contradictionGuardPassed?: number } | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.ready.then(() => setOfflineReady(true)).catch(() => setOfflineReady(false));
  }, []);

  async function runInference() {
    const result = await activeClassifier.classify(labText);
    setPredictions(result.predictions);
    setInferenceMs(result.inferenceMs);
  }

  async function runBenchmark() {
    const result = await activeClassifier.benchmark();
    setBenchmark(result);
  }

  function exportMemory() {
    const clean = rows.filter((row) => row.status === "confirmed" && !row.isDemo).map((row) => ({
      id: row.id,
      visitId: row.visitId,
      source: row.source,
      language: row.language,
      createdAt: new Date(row.createdAt).toISOString(),
      rawText: row.rawText,
      confirmedLabels: row.confirmedLabels,
    }));
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "guestbook-memory.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function resetDemo() {
    await db.observations.clear();
    localStorage.removeItem("guestbook-decisions");
    sessionStorage.removeItem("guestbook-last-accumulation");
    sessionStorage.removeItem("guestbook-pending-id");
    await seedDemoData();
    await refresh();
    go("/memory");
  }

  return (
    <Shell route="system" layout="compact">
      <main className="compact-grid compact-page">
        <section className="system-title">
          <PageTitle kicker="System" title="What is actually running here?" body="Offline readiness, optional voice, model evidence, and local data controls in one place." />
          <div className="section-gap">
            <BaseButtonGroup
              items={["Offline", "Voice", "Model", "Data"].map((value) => ({ value, label: value }))}
              value={tab}
              onChange={setTab}
              shape="rect"
              size="small"
            />
          </div>
        </section>

        <section className="system-content">
          {tab === "Offline" && (
            <div className="system-stack">
              <BaseBanner tone={offlineReady ? "positive" : "warning"}>{offlineReady ? "Offline ready. App shell, local classifier, and IndexedDB are available." : "Preparing offline cache. Do not claim offline readiness yet."}</BaseBanner>
              <div className="system-list">
                <div><span>App shell</span><strong>{offlineReady ? "Cached" : "Preparing"}</strong></div>
                <div><span>Classifier</span><strong>~240 KB · local</strong></div>
                <div><span>Inference network</span><strong>0 requests</strong></div>
                <div><span>Business memory</span><strong>IndexedDB</strong></div>
              </div>
              <div className="proof-sequence">
                <div className="label-small">Cold proof</div>
                <ol><li>Wait for Offline ready.</li><li>Close the tab.</li><li>Disconnect.</li><li>Reopen Guestbook.</li><li>Enter an unseen sentence.</li><li>Classify, confirm, and reopen memory.</li></ol>
              </div>
            </div>
          )}

          {tab === "Voice" && (
            <div className="system-stack">
              <BaseBanner tone="accent">Voice is an optional connected input adapter. The critical Guestbook classifier remains local and offline.</BaseBanner>
              <div className="system-list">
                <div><span>Guestbook voice-model download</span><strong>0 MB</strong></div>
                <div><span>Browser speech API</span><strong>{browserVoiceAvailable ? "Available" : "Unavailable"}</strong></div>
                <div><span>Offline free-form speech</span><strong>Not claimed</strong></div>
                <div><span>Offline typed inference</span><strong>~240 KB · local</strong></div>
              </div>
              <BaseBanner tone="neutral">General free-form offline speech recognition does not fit a credible ~1 MB model budget. Guestbook therefore keeps speech connected and optional instead of hiding a tens-of-megabytes download behind the core flow.</BaseBanner>
            </div>
          )}

          {tab === "Model" && (
            <div className="model-grid">
              <div className="model-lab">
                <Field label="Observation" hint="Runs through the frozen local classifier.">
                  <Textarea rows={6} value={labText} onChange={(event) => setLabText(event.target.value)} />
                </Field>
                <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={runInference}>Run local inference</BaseButton>
                {inferenceMs !== null && <span className="paragraph-small">{inferenceMs.toFixed(2)} ms on this device</span>}
              </div>
              <div className="model-results">
                <div className="section-heading"><div><span className="label-small">Predictions</span><h2>Model output</h2></div></div>
                <div className="system-list">
                  {predictions.length ? predictions.map((prediction) => <div key={prediction.label}><span>{LABEL_META[prediction.label].title}</span><strong>{formatPercent(prediction.score)}</strong></div>) : <div><span>No run yet</span><strong>—</strong></div>}
                </div>
              </div>
              <div className="benchmark-panel">
                <div className="section-heading"><div><span className="label-small">Frozen stress set</span><h2>Regression evidence</h2></div><BaseButton hierarchy="secondary" size="small" shape="rect" onClick={runBenchmark}>Run benchmark</BaseButton></div>
                <div className="metric-row"><span>Micro F1</span><strong>{benchmark ? formatPercent(benchmark.f1) : "90.2%"}</strong></div>
                <div className="metric-row"><span>Precision</span><strong>{benchmark ? formatPercent(benchmark.precision) : "92.5%"}</strong></div>
                <div className="metric-row"><span>Recall</span><strong>{benchmark ? formatPercent(benchmark.recall) : "88.1%"}</strong></div>
                <div className="metric-row"><span>Exact match</span><strong>{benchmark ? formatPercent(benchmark.exactMatch) : "82.9%"}</strong></div>
                <div className="metric-row"><span>Contradiction guards</span><strong>{benchmark ? (benchmark.contradictionGuardPassed ?? 0) + "/" + (benchmark.contradictionGuardCases ?? 0) : "9 policy checks"}</strong></div>
                <BaseBanner tone="neutral">External probes: MASSIVE English 91.1%, Swahili 92.8%, Nairobi weak-label agreement 98.0%. These are not field accuracy.</BaseBanner>
              </div>
            </div>
          )}

          {tab === "Data" && (
            <div className="system-stack">
              <div className="system-list">
                <div><span>Local observations</span><strong>{rows.length}</strong></div>
                <div><span>Confirmed real records</span><strong>{rows.filter((row) => row.status === "confirmed" && !row.isDemo).length}</strong></div>
                <div><span>Demo records</span><strong>{rows.filter((row) => row.isDemo).length}</strong></div>
              </div>
              <div className="base-button-group">
                <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={exportMemory}>Export confirmed JSON</BaseButton>
                <BaseButton hierarchy="negative" size="medium" shape="rect" onClick={resetDemo}>Reset demo</BaseButton>
              </div>
              <BaseBanner tone="warning">Export excludes demo observations. Reset clears local test data and restores the canonical five product-request demo visits.</BaseBanner>
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}

export default function App() {
  useLocationKey();
  useEffect(() => { void seedDemoData(); }, []);
  const route = routeForPath(window.location.pathname);
  if (route === "review") return <ReviewScreen />;
  if (route === "memory") return <MemoryScreen />;
  if (route === "evidence") return <EvidenceScreen />;
  if (route === "decide") return <DecideScreen />;
  if (route === "system") return <SystemScreen />;
  return <GuestScreen />;
}
