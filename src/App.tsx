import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { activeClassifier } from "./ai/classifier";
import { db } from "./storage/db";
import { seedDemoData } from "./data/demoData";
import { buildMemory, decisionCopy, type MemorySignal } from "./domain/memory";
import { HUMAN_CONFIRM_REQUIRED, LABELS, LABEL_META, type SignalLabel } from "./domain/labels";
import type { Observation, Prediction } from "./domain/observation";


interface BrowserSpeechResult extends ArrayLike<{ transcript: string }> {
  isFinal: boolean;
}

interface BrowserSpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechResult>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onsoundstart: (() => void) | null;
  onsoundend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
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

function joinTranscript(base: string, addition: string) {
  return [base.trim(), addition.trim()].filter(Boolean).join(" ").slice(0, 1000);
}

function reconcileVoiceTranscript(committed: string, incoming: string) {
  const cleanCommitted = committed.trim();
  const cleanIncoming = incoming.trim();
  if (!cleanCommitted) return cleanIncoming.slice(0, 1000);
  if (!cleanIncoming) return cleanCommitted.slice(0, 1000);
  if (cleanCommitted === cleanIncoming) return cleanCommitted.slice(0, 1000);

  const committedWords = cleanCommitted.split(/\s+/);
  const incomingWords = cleanIncoming.split(/\s+/);
  const normalize = (word: string) => word.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const committedNorm = committedWords.map(normalize);
  const incomingNorm = incomingWords.map(normalize);
  const minLength = Math.min(committedNorm.length, incomingNorm.length);

  // Android Chrome can replay the current utterance from its beginning after
  // silence/restart. When the new snapshot substantially shares the existing
  // prefix, it is a replacement/extension of the same utterance, not new text.
  let commonPrefix = 0;
  while (commonPrefix < minLength && committedNorm[commonPrefix] === incomingNorm[commonPrefix]) {
    commonPrefix++;
  }

  let positionalMatches = 0;
  for (let index = 0; index < minLength; index++) {
    if (committedNorm[index] === incomingNorm[index]) positionalMatches++;
  }

  const prefixReplay =
    minLength >= 3 &&
    commonPrefix >= Math.min(6, minLength) &&
    positionalMatches / minLength >= 0.72;

  if (prefixReplay) {
    return (incomingWords.length >= committedWords.length ? cleanIncoming : cleanCommitted).slice(0, 1000);
  }

  // Normal continuation: remove only an exact suffix→prefix overlap.
  let overlap = 0;
  for (let size = minLength; size >= 1; size--) {
    let matches = true;
    for (let index = 0; index < size; index++) {
      if (committedNorm[committedNorm.length - size + index] !== incomingNorm[index]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      overlap = size;
      break;
    }
  }

  return joinTranscript(cleanCommitted, incomingWords.slice(overlap).join(" "));
}

type Route = "guest" | "review" | "memory" | "evidence" | "decide" | "system";
type BannerTone = "accent" | "positive" | "warning" | "negative" | "neutral";
type ButtonHierarchy = "primary" | "secondary" | "tertiary" | "negative";
type ButtonSize = "small" | "medium";
type ButtonShape = "rect";

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
  shape = "rect",
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

function PageTitle({ title, body }: { title: string; body?: string }) {
  return (
    <div className="page-title">
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

function VoiceActivityVisualizer({ active, speaking, pulse }: { active: boolean; speaking: boolean; pulse: number }) {
  const bars = [0.58, 0.82, 0.46, 1, 0.7, 0.5, 0.9, 0.62, 0.78, 0.42, 0.88, 0.56];
  return (
    <div className={"voice-activity " + (active ? "active " : "") + (speaking ? "speaking" : "")} aria-hidden="true" data-pulse={pulse}>
      {bars.map((height, index) => (
        <span
          key={index}
          style={{
            height: Math.round(height * 100) + "%",
            animationDelay: -(index * 73) + "ms",
            animationDuration: 640 + (index % 4) * 90 + "ms",
          }}
        />
      ))}
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.9-9.9a4 4 0 0 1 5.66 5.66l-9.9 9.9a2 2 0 0 1-2.83-2.83l9.19-9.19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
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
  const [speechActive, setSpeechActive] = useState(false);
  const [voicePulse, setVoicePulse] = useState(0);
  const voiceRef = useRef<BrowserSpeechRecognition | null>(null);
  const wantsListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const voiceBaseRef = useRef("");
  const voiceCommittedRef = useRef("");
  const voiceSegmentRef = useRef("");
  const mediaRef = useRef<HTMLInputElement | null>(null);
  const copy = guestCopy[language];

  useEffect(() => () => {
    wantsListeningRef.current = false;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    voiceRef.current?.stop();
    voiceRef.current = null;
  }, []);

  function attachPhoto(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setMediaDataUrl(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  function beginRecognitionSession() {
    const Recognition = getBrowserSpeechRecognition();
    if (!Recognition || !wantsListeningRef.current) return;

    const recognition = new Recognition();
    recognition.lang = language === "sw" ? "sw-KE" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      voiceRef.current = recognition;
      setVoiceState("listening");
      setVoiceError("");
      setVoicePulse((value) => value + 1);
    };
    recognition.onaudiostart = () => setVoicePulse((value) => value + 1);
    recognition.onsoundstart = () => {
      setSpeechActive(true);
      setVoicePulse((value) => value + 1);
    };
    recognition.onspeechstart = () => {
      setSpeechActive(true);
      setVoicePulse((value) => value + 1);
    };
    recognition.onspeechend = () => setSpeechActive(false);
    recognition.onsoundend = () => setSpeechActive(false);
    recognition.onaudioend = () => setSpeechActive(false);

    recognition.onresult = (event) => {
      // event.results is the recognizer's current authoritative session
      // snapshot. Rebuild it from scratch instead of appending changed items.
      let sessionTranscript = "";
      for (let index = 0; index < event.results.length; index++) {
        const transcript = event.results[index]?.[0]?.transcript?.trim() ?? "";
        if (transcript) sessionTranscript = joinTranscript(sessionTranscript, transcript);
      }

      voiceSegmentRef.current = sessionTranscript;
      const liveVoice = reconcileVoiceTranscript(voiceCommittedRef.current, sessionTranscript);
      setText(joinTranscript(voiceBaseRef.current, liveVoice));
      setSpeechActive(true);
      setVoicePulse((value) => value + 1);
    };

    recognition.onerror = (event) => {
      const error = event.error ?? "";
      voiceRef.current = null;
      setSpeechActive(false);

      if (error === "aborted" && !wantsListeningRef.current) return;

      if (error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture") {
        wantsListeningRef.current = false;
        setVoiceState("error");
        setVoiceError(
          error === "audio-capture"
            ? "Microphone is unavailable. Close other apps using the mic and try again."
            : "Allow microphone access and try again.",
        );
        return;
      }

      if (error === "network") {
        setVoiceError("Voice service lost its connection. Reconnecting…");
      } else if (error !== "no-speech") {
        setVoiceError("Voice paused unexpectedly. Reconnecting…");
      }
    };

    recognition.onend = () => {
      voiceRef.current = null;
      setSpeechActive(false);

      if (voiceSegmentRef.current) {
        voiceCommittedRef.current = reconcileVoiceTranscript(voiceCommittedRef.current, voiceSegmentRef.current);
        voiceSegmentRef.current = "";
        setText(joinTranscript(voiceBaseRef.current, voiceCommittedRef.current));
      }

      if (!wantsListeningRef.current) {
        setVoiceState("idle");
        return;
      }

      setVoiceState("listening");
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (wantsListeningRef.current) beginRecognitionSession();
      }, 220);
    };

    try {
      recognition.start();
    } catch {
      voiceRef.current = null;
      if (wantsListeningRef.current) {
        if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (wantsListeningRef.current) beginRecognitionSession();
        }, 350);
      }
    }
  }

  function startVoice() {
    if (!navigator.onLine) {
      setVoiceError("Voice transcription needs a connection on this phone. Typing and Guestbook AI still work offline.");
      setVoiceState("error");
      return;
    }

    if (!getBrowserSpeechRecognition()) {
      setVoiceState("unavailable");
      setVoiceError("This browser does not expose speech recognition. Type instead.");
      return;
    }

    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    wantsListeningRef.current = true;
    voiceBaseRef.current = text.trim().slice(0, 1000);
    voiceCommittedRef.current = "";
    voiceSegmentRef.current = "";
    setVoiceError("");
    setSpeechActive(false);
    setVoiceState("listening");
    beginRecognitionSession();
  }

  function stopVoice() {
    wantsListeningRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    voiceRef.current?.stop();
    voiceRef.current = null;
    setSpeechActive(false);
    setVoiceState("idle");
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
                <PaperclipIcon />
              </button>
              {voiceState !== "listening" && voiceState !== "unavailable" && (
                <button className="composer-voice-button" type="button" onClick={() => void startVoice()} aria-label="Speak now">
                  <MicIcon />
                  <span>Speak now</span>
                </button>
              )}
              {voiceState === "listening" && (
                <div className="listening-control">
                  <span className="listening-label"><span className="record-dot" />Listening</span>
                  <VoiceActivityVisualizer active={voiceState === "listening"} speaking={speechActive} pulse={voicePulse} />
                  <button className="stop-listening" type="button" onClick={stopVoice}>Stop</button>
                </div>
              )}
            </div>
          </div>

          {mediaDataUrl && (
            <div className="media-preview">
              <img src={mediaDataUrl} alt="" />
              <div><span>Attached photo</span><BaseButton hierarchy="tertiary" size="small" shape="rect" onClick={() => setMediaDataUrl("")}>Remove</BaseButton></div>
            </div>
          )}

          <input ref={mediaRef} className="sr-only" type="file" accept="image/*" onChange={(event) => attachPhoto(event.target.files?.[0])} />

          {voiceState === "unavailable" && <div className="inline-note">Voice is unavailable in this browser. Typing and local Guestbook inference still work offline.</div>}
          {voiceError && <BaseBanner tone="negative">{voiceError}</BaseBanner>}
        </section>

        <aside className="guest-context">
          <div className="context-rule">
            <h2 className="context-heading">What happens next</h2>
            <div className="context-step"><strong>Interpret</strong><p>~240 KB classifier. No inference request.</p></div>
            <div className="context-step"><strong>Review</strong><p>A person confirms or corrects the signals.</p></div>
            <div className="context-step"><strong>Remember</strong><p>Only confirmed evidence accumulates across distinct visits.</p></div>
          </div>
        </aside>
      </main>

      <DockedAction>
        <div className="normal-grid dock-grid">
          <div className="dock-copy"><strong>Source stays attached</strong><span>Guest words remain evidence, not a generated summary.</span></div>
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
          <PageTitle title="Keep the words. Check the interpretation." body="Nothing enters business memory until a person confirms it." />

          {observation ? (
            <div className="source-block">
              <div className="source-meta">
                <strong>{sourceLabel(observation)}</strong>
                <span>{observation.language.toUpperCase()}</span>
                <span>{formatAge(observation.createdAt)}</span>
              </div>
              <blockquote>“{observation.rawText}”</blockquote>
              {observation.mediaDataUrl && <img className="review-media" src={observation.mediaDataUrl} alt="" />}
            </div>
          ) : (
            <div className="empty-inline">No pending observation. Capture a guest message first.</div>
          )}
        </section>

        <section className="review-signals">
          <div className="section-heading">
            <div><h2>Proposed signals</h2></div>
            <div className="proof-inline"><span>~240 KB local classifier</span><span>No inference request</span></div>
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
                    shape="rect"
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
          <div className="dock-copy"><strong>Human authority</strong><span>Model scores are not calibrated probabilities.</span></div>
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
          <PageTitle title="What keeps repeating?" body="A pattern exists only when confirmed observations from distinct visits keep pointing to the same thing." />
        </section>

        {featured ? (
          <>
            <section className="memory-feature">
              <div className={"memory-evidence-line " + (changed ? "changed" : "")}>
                <strong>{changed && previousCount !== null ? previousCount + " → " + featured.visitCount : featured.visitCount}</strong>
                <span>independent visits</span>
                {changed && <span className="memory-new-evidence">New evidence</span>}
              </div>
              <h2>{featured.title}</h2>
              <p>{featured.description}</p>
              <div className="memory-proof-note">Confirmed source records from distinct visits. This is observed repetition, not a prediction.</div>
              <div className="base-button-group">
                <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={() => go("/evidence?signal=" + featured.label)}>View evidence</BaseButton>
                <BaseButton hierarchy="secondary" size="medium" shape="rect" onClick={() => go("/decide")}>Review decision</BaseButton>
              </div>
            </section>

            <section className="memory-list-section">
              <div className="section-heading"><div><h2>Everything else in memory</h2></div></div>
              <div className="base-list">
                {rest.map((signal) => (
                  <button className="base-list-row" key={signal.label} onClick={() => go("/evidence?signal=" + signal.label)}>
                    <span><strong>{signal.title}</strong><small>{signal.description}</small></span>
                    <span className="row-meta">{signal.visitCount} visits</span>
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
          <PageTitle title={signal ? signal.title : "Evidence"} body="Original words stay visible. Guestbook never needs to replace evidence with a generated summary." />
          {memory.length > 0 && (
            <div className="section-gap">
              <BaseButtonGroup
                items={memory.slice(0, 6).map((item) => ({ value: item.label, label: item.title }))}
                value={signal?.label ?? ""}
                onChange={(value) => go("/evidence?signal=" + value)}
                shape="rect"
                size="small"
              />
            </div>
          )}
        </section>

        <section className="evidence-summary">
          {signal && <>
            <strong>{signal.visitCount} distinct visits</strong>
            <p>{signal.description}</p>
          </>}
        </section>

        <section className="evidence-ledger">
          <div className="section-heading"><div><h2>Every source record</h2></div><span className="paragraph-small">{signal?.observations.length ?? 0} observations</span></div>
          <div className="evidence-rows">
            {(signal?.observations ?? []).map((observation) => (
              <article className="evidence-row" key={observation.id}>
                <div className="evidence-quote">“{observation.rawText}”</div>
                <div className="evidence-meta">
                  <strong>{observation.isDemo ? "Demo source" : "Confirmed source"}</strong>
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
          <PageTitle title="Evidence stops here." body="Guestbook can show what repeats. It cannot decide what the business should become." />
        </section>

        {signal && copy ? (
          <>
            <section className="decision-main">
              <div className="decision-source-line">Based on {signal.visitCount} distinct visits</div>
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
              {decision && <div className={"decision-state " + (decision === "Wrong signal" ? "negative" : decision === "Explore" ? "positive" : "neutral")}>Decision saved locally: {decision}.</div>}
            </section>

            <section className="decision-proof">
              <div className="section-heading"><div><h2>Source-backed repetition</h2></div><span className="paragraph-small">{signal.visitCount} source records</span></div>
              <div className="mini-evidence">
                {signal.observations.slice(0, 3).map((observation) => (
                  <div key={observation.id}><p>“{observation.rawText}”</p><span>{observation.isDemo ? "Demo visit" : sourceLabel(observation)}</span></div>
                ))}
              </div>
              <BaseButton hierarchy="secondary" size="small" shape="rect" onClick={() => go("/evidence?signal=" + signal.label)}>Open all evidence</BaseButton>
            </section>

            <section className="decision-boundary">
              <h2>Guestbook stops before action.</h2>
              <p>It does not set prices, order stock, send messages, change bookings, or act automatically.</p>
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
          <PageTitle title="What is actually running here?" body="Offline readiness, optional voice, model evidence, and local data controls in one place." />
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
                <h2>Cold proof</h2>
                <ol><li>Wait for Offline ready.</li><li>Close the tab.</li><li>Disconnect.</li><li>Reopen Guestbook.</li><li>Enter an unseen sentence.</li><li>Classify, confirm, and reopen memory.</li></ol>
              </div>
            </div>
          )}

          {tab === "Voice" && (
            <div className="system-stack">
              <div className="system-note"><strong>Voice is optional and connected.</strong><span>The critical Guestbook classifier remains local and offline.</span></div>
              <div className="system-list">
                <div><span>Guestbook voice-model download</span><strong>0 MB</strong></div>
                <div><span>Browser speech API</span><strong>{browserVoiceAvailable ? "Available" : "Unavailable"}</strong></div>
                <div><span>Offline free-form speech</span><strong>Not claimed</strong></div>
                <div><span>Offline typed inference</span><strong>~240 KB · local</strong></div>
              </div>
              <div className="system-caveat">General free-form offline speech recognition does not fit a credible ~1 MB model budget. Guestbook keeps speech connected and optional instead of hiding a tens-of-megabytes download behind the core flow.</div>
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
                <div className="section-heading"><div><h2>Model output</h2></div></div>
                <div className="system-list">
                  {predictions.length ? predictions.map((prediction) => <div key={prediction.label}><span>{LABEL_META[prediction.label].title}</span><strong>{formatPercent(prediction.score)}</strong></div>) : <div><span>No run yet</span><strong>—</strong></div>}
                </div>
              </div>
              <div className="benchmark-panel">
                <div className="section-heading"><div><h2>Regression evidence</h2></div><BaseButton hierarchy="secondary" size="small" shape="rect" onClick={runBenchmark}>Run benchmark</BaseButton></div>
                <div className="metric-row"><span>Micro F1</span><strong>{benchmark ? formatPercent(benchmark.f1) : "90.2%"}</strong></div>
                <div className="metric-row"><span>Precision</span><strong>{benchmark ? formatPercent(benchmark.precision) : "92.5%"}</strong></div>
                <div className="metric-row"><span>Recall</span><strong>{benchmark ? formatPercent(benchmark.recall) : "88.1%"}</strong></div>
                <div className="metric-row"><span>Exact match</span><strong>{benchmark ? formatPercent(benchmark.exactMatch) : "82.9%"}</strong></div>
                <div className="metric-row"><span>Contradiction guards</span><strong>{benchmark ? (benchmark.contradictionGuardPassed ?? 0) + "/" + (benchmark.contradictionGuardCases ?? 0) : "9 policy checks"}</strong></div>
                <div className="system-caveat">External probes: MASSIVE English 91.1%, Swahili 92.8%, Nairobi weak-label agreement 98.0%. These are not field accuracy.</div>
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
