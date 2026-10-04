import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRightIcon,
  ChatCenteredDotsIcon,
  CheckCircleIcon,
  CheckSquareOffsetIcon,
  ClockIcon,
  CompassIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  FileTextIcon,
  GearSixIcon,
  HardDriveIcon,
  ImageIcon,
  InfoIcon,
  LockSimpleIcon,
  MicrophoneIcon,
  QuotesIcon,
  ShieldCheckIcon,
  TrendUpIcon,
  TranslateIcon,
  TrashIcon,
  UserCheckIcon,
  UsersThreeIcon,
  WarningCircleIcon,
  WifiHighIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
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
type BannerTone = "positive" | "warning" | "negative";
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
    body: "Tell them what stood out, what was difficult, or what you’d come back for.",
    field: "Your note",
    placeholder: "What worked? What was confusing? What would make the visit better?",
  },
  sw: {
    language: "Kiswahili",
    title: "Mwenyeji anapaswa kujua nini?",
    body: "Mwambie kilichokuvutia, kilichokuwa kigumu, au kile ungependa kurudia.",
    field: "Ujumbe wako",
    placeholder: "Nini kilifanya kazi? Nini kilikuwa kigumu? Nini kingeboresha ziara?",
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

function BaseBanner({ tone, children }: { tone: BannerTone; children: ReactNode }) {
  return <div className={"base-banner " + tone}>{children}</div>;
}

function DockedAction({ children }: { children: ReactNode }) {
  return <div className="docked-action">{children}</div>;
}

function RouteIcon({ route, active, size = 18 }: { route: Route; active: boolean; size?: number }) {
  const props = {
    size,
    weight: active ? "fill" as const : "regular" as const,
    "aria-hidden": true,
  };
  if (route === "guest") return <ChatCenteredDotsIcon {...props} />;
  if (route === "review") return <CheckSquareOffsetIcon {...props} />;
  if (route === "memory") return <DatabaseIcon {...props} />;
  if (route === "evidence") return <FileTextIcon {...props} />;
  if (route === "decide") return <CompassIcon {...props} />;
  return <GearSixIcon {...props} />;
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
            {NAV.filter((item) => item.key !== "system").map((item) => (
              <button key={item.key} className={route === item.key ? "active" : ""} onClick={() => go(item.path)}>
                <RouteIcon route={item.key} active={route === item.key} size={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="nav-status">
            <span className={"status-pip " + (!online || offlineReady ? "positive" : "warning")} />
            <span>{status}</span>
          </div>
          <button className={"nav-system-link " + (route === "system" ? "active" : "")} onClick={() => go("/system")} aria-label="System" title="System">
            <RouteIcon route="system" active={route === "system"} size={18} />
          </button>
        </div>
      </header>

      {children}

      <nav className="base-bottom-navigation" aria-label="Primary mobile navigation">
        {mobileNav.map((item) => (
          <button key={item.key} className={route === item.key ? "active" : ""} onClick={() => go(item.path)}>
            <RouteIcon route={item.key} active={route === item.key} size={20} />
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
  const pageHiddenRef = useRef(document.visibilityState === "hidden");
  const resumeGraceUntilRef = useRef(0);
  const beginRecognitionRef = useRef<() => void>(() => {});
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
      // Android Chrome can expose successive cumulative hypotheses as separate
      // result entries ("the" → "the whole" → "the whole should"). Folding
      // those entries by overlap prevents the hypotheses themselves becoming
      // duplicated user text.
      let sessionTranscript = "";
      for (let index = 0; index < event.results.length; index++) {
        const transcript = event.results[index]?.[0]?.transcript?.trim() ?? "";
        if (transcript) sessionTranscript = reconcileVoiceTranscript(sessionTranscript, transcript);
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

      const lifecycleInterruption =
        pageHiddenRef.current ||
        document.visibilityState === "hidden" ||
        Date.now() < resumeGraceUntilRef.current;

      if (lifecycleInterruption && (error === "network" || error === "aborted" || error === "no-speech")) {
        setVoiceError("");
        return;
      }

      if (error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture") {
        wantsListeningRef.current = false;
        setVoiceState("error");
        setVoiceError(
          error === "audio-capture"
            ? "Microphone is unavailable. Close other apps using the mic and try again."
            : error === "service-not-allowed"
              ? "Chrome's speech-recognition service is unavailable for this session. Reload the page or type instead."
              : "Chrome denied microphone access. Check this site's microphone permission and your computer privacy settings.",
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
      if (pageHiddenRef.current || document.visibilityState === "hidden") {
        setVoiceError("");
        return;
      }

      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (wantsListeningRef.current && !pageHiddenRef.current) beginRecognitionSession();
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

  beginRecognitionRef.current = beginRecognitionSession;

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.visibilityState === "hidden";
      pageHiddenRef.current = hidden;

      if (hidden) {
        if (restartTimerRef.current !== null) {
          window.clearTimeout(restartTimerRef.current);
          restartTimerRef.current = null;
        }

        if (wantsListeningRef.current) {
          setVoiceError("");
          setSpeechActive(false);
          voiceRef.current?.stop();
        }
        return;
      }

      if (!wantsListeningRef.current) return;

      // Mobile browsers intentionally tear down connected speech services while
      // backgrounded. Resume quietly once the page is foregrounded again.
      setVoiceError("");
      setVoiceState("listening");
      resumeGraceUntilRef.current = Date.now() + 2500;

      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (wantsListeningRef.current && !pageHiddenRef.current) beginRecognitionRef.current();
      }, 350);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  async function startVoice() {
    if (!navigator.onLine) {
      setVoiceError("Voice transcription needs a connection on this device. Typing and Guestbook AI still work offline.");
      setVoiceState("error");
      return;
    }

    if (!getBrowserSpeechRecognition()) {
      setVoiceState("unavailable");
      setVoiceError("This browser does not expose speech recognition. Type instead.");
      return;
    }

    const isLikelyMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    // Desktop Chrome can expose SpeechRecognition before it has completed a
    // normal microphone permission handshake. Ask for the mic briefly, release
    // it immediately, then let SpeechRecognition own the microphone. Keep this
    // off mobile because a concurrent getUserMedia stream interferes with
    // Android Chrome speech recognition.
    if (!isLikelyMobile && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        wantsListeningRef.current = false;
        setVoiceState("error");
        setVoiceError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Microphone access is blocked by Chrome or your computer privacy settings."
            : name === "NotFoundError"
              ? "No microphone is available on this computer."
              : "The microphone could not be opened. Check your computer audio settings and try again.",
        );
        return;
      }
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
          <PageTitle title={copy.title} body={copy.body} />

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
            <Field label={copy.field} meta={text.length + "/1000"} hint={language === "sw" ? "Huhitaji akaunti." : "No account needed."}>
              <Textarea rows={9} maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.placeholder} />
            </Field>
            <div className="composer-controls">
              <button className="composer-icon-action" type="button" onClick={() => mediaRef.current?.click()} aria-label="Add photo" title="Add photo">
                <ImageIcon size={20} weight="regular" aria-hidden="true" />
              </button>
              {voiceState !== "listening" && voiceState !== "unavailable" && (
                <button className="composer-icon-action" type="button" onClick={() => void startVoice()} aria-label="Speak" title="Speak">
                  <MicrophoneIcon size={20} weight="regular" aria-hidden="true" />
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
              <div><span><ImageIcon size={16} weight="regular" aria-hidden="true" /> Photo added</span><BaseButton hierarchy="tertiary" size="small" shape="rect" onClick={() => setMediaDataUrl("")}>Remove</BaseButton></div>
            </div>
          )}

          <input ref={mediaRef} className="sr-only" type="file" accept="image/*" onChange={(event) => attachPhoto(event.target.files?.[0])} />

          {voiceState === "unavailable" && <div className="inline-note"><InfoIcon size={18} weight="regular" aria-hidden="true" /> Voice isn’t available here. You can still type your note.</div>}
          {voiceError && <BaseBanner tone="negative">{voiceError}</BaseBanner>}
        </section>

        <aside className="guest-context" aria-label="About your feedback">
          <div className="guest-facts">
            <div><ShieldCheckIcon size={22} weight="regular" aria-hidden="true" /><span>No account needed</span></div>
            <div><UserCheckIcon size={22} weight="regular" aria-hidden="true" /><span>The host reviews it</span></div>
            <div><TrendUpIcon size={22} weight="regular" aria-hidden="true" /><span>Repeat requests stand out</span></div>
          </div>
        </aside>
      </main>

      <DockedAction>
        <div className="normal-grid dock-grid">
          <div className="dock-copy"><LockSimpleIcon size={18} weight="regular" aria-hidden="true" /><span>No sign-in. Your words stay with this visit.</span></div>
          <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={submit} disabled={text.trim().length < 3 || busy}>
            <span>{busy ? "Sending…" : "Send feedback"}</span>
            {!busy && <ArrowRightIcon size={18} weight="bold" aria-hidden="true" />}
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
          <PageTitle title="Review this visit" body="Check what Guestbook picked up before it joins your memory." />

          {observation ? (
            <div className="source-block">
              <div className="source-meta">
                <span><UserCheckIcon size={16} weight="regular" aria-hidden="true" />{sourceLabel(observation)}</span>
                <span><TranslateIcon size={16} weight="regular" aria-hidden="true" />{observation.language.toUpperCase()}</span>
                <span><ClockIcon size={16} weight="regular" aria-hidden="true" />{formatAge(observation.createdAt)}</span>
              </div>
              <blockquote>“{observation.rawText}”</blockquote>
              {observation.mediaDataUrl && <img className="review-media" src={observation.mediaDataUrl} alt="" />}
            </div>
          ) : (
            <div className="empty-inline"><InfoIcon size={18} weight="regular" aria-hidden="true" /> No visit is waiting for review.</div>
          )}
        </section>

        <section className="review-signals">
          <div className="section-heading">
            <div><h2>Does this look right?</h2><p>Keep only what the guest actually meant.</p></div>
          </div>

          {observation && (
            <>
              <div className="selection-list">
                {observation.predictions.map((prediction) => {
                  const active = selected.has(prediction.label);
                  const sensitive = HUMAN_CONFIRM_REQUIRED.has(prediction.label);
                  return (
                    <button className={"selection-row " + (active ? "selected" : "")} key={prediction.label} onClick={() => toggle(prediction.label)}>
                      <span className="base-check">{active && <CheckCircleIcon size={20} weight="fill" aria-hidden="true" />}</span>
                      <span className="selection-copy">
                        <strong>{LABEL_META[prediction.label].title}</strong>
                        <small>{LABEL_META[prediction.label].description}</small>
                      </span>
                      {sensitive && <span className="sensitive-mark"><WarningCircleIcon size={18} weight="regular" aria-hidden="true" /> Check</span>}
                    </button>
                  );
                })}
              </div>

              <BaseButton hierarchy="tertiary" size="small" shape="rect" onClick={() => setShowCorrections((value) => !value)}>
                {showCorrections ? "Hide other options" : "Something missing?"}
              </BaseButton>

              {showCorrections && (
                <div className="correction-area">
                  <div className="correction-list">
                    {LABELS.filter((label) => label !== "UNKNOWN").map((label) => {
                      const active = selected.has(label);
                      return (
                        <button
                          type="button"
                          className={"correction-choice " + (active ? "selected" : "")}
                          key={label}
                          aria-pressed={active}
                          onClick={() => toggle(label)}
                        >
                          <span>{active && <CheckCircleIcon size={18} weight="fill" aria-hidden="true" />}{LABEL_META[label].title}</span>
                          <small>{LABEL_META[label].description}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasSensitive && (
                <BaseBanner tone="warning">
                  <label className="sensitive-confirm"><input type="checkbox" checked={sensitiveConfirmed} onChange={(event) => setSensitiveConfirmed(event.target.checked)} />The guest clearly mentioned this accessibility, dietary, or safety need.</label>
                </BaseBanner>
              )}
            </>
          )}
        </section>
      </main>

      <DockedAction>
        <div className="compact-grid dock-grid">
          <div className="dock-copy"><UserCheckIcon size={18} weight="regular" aria-hidden="true" /><span>You decide what gets remembered.</span></div>
          <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={confirm} disabled={!observation || (hasSensitive && !sensitiveConfirmed)}>
            <span>Confirm</span><ArrowRightIcon size={18} weight="bold" aria-hidden="true" />
          </BaseButton>
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
          <PageTitle title="What guests keep bringing up" body="Only feedback you confirmed across different visits shows up here." />
        </section>

        {featured ? (
          <>
            <section className="memory-feature">
              <div className={"memory-evidence-line " + (changed ? "changed" : "")}>
                <UsersThreeIcon size={20} weight="regular" aria-hidden="true" />
                <strong>{featured.visitCount} visits</strong>
                {changed && <span className="memory-new-evidence"><TrendUpIcon size={16} weight="bold" aria-hidden="true" />+{featured.visitCount - (previousCount ?? featured.visitCount)} new</span>}
              </div>
              <h2>{featured.title}</h2>
              <p>{featured.description}</p>
              <div className="memory-proof-note"><CheckCircleIcon size={18} weight="fill" aria-hidden="true" /> Confirmed by you across different visits.</div>
              <div className="base-button-group">
                <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={() => go("/evidence?signal=" + featured.label)}><QuotesIcon size={18} weight="regular" aria-hidden="true" /><span>See comments</span></BaseButton>
                <BaseButton hierarchy="secondary" size="medium" shape="rect" onClick={() => go("/decide")}><CompassIcon size={18} weight="regular" aria-hidden="true" /><span>Decide</span></BaseButton>
              </div>
            </section>

            <section className="memory-list-section">
              <div className="section-heading"><div><h2>Other patterns</h2><p>Confirmed themes from your recent visits.</p></div></div>
              <div className="base-list">
                {rest.map((signal) => (
                  <button className="base-list-row" key={signal.label} onClick={() => go("/evidence?signal=" + signal.label)}>
                    <span><strong>{signal.title}</strong><small>{signal.description}</small></span>
                    <span className="row-meta"><UsersThreeIcon size={16} weight="regular" aria-hidden="true" />{signal.visitCount}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="memory-empty"><div className="empty-state"><DatabaseIcon size={28} weight="regular" aria-hidden="true" /><h2>Nothing in memory yet</h2><p>Review a guest note first. Repeated themes will collect here.</p><BaseButton hierarchy="primary" size="medium" shape="rect" onClick={() => go("/")}>Open Guest</BaseButton></div></section>
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
          <PageTitle title="Where this came from" body="Read the original guest comments behind a pattern." />
          {memory.length > 0 && (
            <label className="signal-switcher">
              <span>Showing</span>
              <select value={signal?.label ?? ""} onChange={(event) => go("/evidence?signal=" + event.target.value)}>
                {memory.slice(0, 12).map((item) => <option key={item.label} value={item.label}>{item.title}</option>)}
              </select>
            </label>
          )}
        </section>

        <section className="evidence-summary">
          {signal && <>
            <UsersThreeIcon size={22} weight="regular" aria-hidden="true" />
            <div><h2>{signal.title}</h2><p>{signal.description}</p></div>
            <strong>{signal.visitCount} visits</strong>
          </>}
        </section>

        <section className="evidence-ledger">
          <div className="section-heading"><div><h2>Guest comments</h2><p>Exactly what was said on each visit.</p></div><span className="paragraph-small">{signal?.observations.length ?? 0}</span></div>
          <div className="evidence-rows">
            {(signal?.observations ?? []).map((observation) => (
              <article className="evidence-row" key={observation.id}>
                <QuotesIcon className="evidence-quote-icon" size={22} weight="fill" aria-hidden="true" />
                <div className="evidence-quote">“{observation.rawText}”</div>
                <div className="evidence-meta">
                  <span>{observation.isDemo ? <InfoIcon size={15} weight="regular" aria-hidden="true" /> : <UserCheckIcon size={15} weight="regular" aria-hidden="true" />}{observation.isDemo ? "Demo" : sourceLabel(observation)}</span>
                  <span><TranslateIcon size={15} weight="regular" aria-hidden="true" />{observation.language.toUpperCase()}</span>
                  <span><ClockIcon size={15} weight="regular" aria-hidden="true" />{formatAge(observation.createdAt)}</span>
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
          <PageTitle title="Worth acting on?" body="Guestbook brings the pattern and the comments. You make the call." />
        </section>

        {signal && copy ? (
          <>
            <section className="decision-main">
              <div className="decision-pattern"><TrendUpIcon size={18} weight="bold" aria-hidden="true" /><span>{signal.title}</span></div>
              <div className="decision-source-line"><UsersThreeIcon size={18} weight="regular" aria-hidden="true" />{signal.visitCount} confirmed visits</div>
              <h2>{copy.headline}</h2>
              <p>{copy.body}</p>
              <div className="decision-choice-grid" role="group" aria-label="Decision">
                <button className={decision === "Explore" ? "selected" : ""} type="button" onClick={() => choose("Explore")}><CompassIcon size={20} weight={decision === "Explore" ? "fill" : "regular"} aria-hidden="true" /><span>Explore it</span></button>
                <button className={decision === "Not now" ? "selected" : ""} type="button" onClick={() => choose("Not now")}><ClockIcon size={20} weight={decision === "Not now" ? "fill" : "regular"} aria-hidden="true" /><span>Not now</span></button>
                <button className={decision === "Wrong signal" ? "selected" : ""} type="button" onClick={() => choose("Wrong signal")}><XCircleIcon size={20} weight={decision === "Wrong signal" ? "fill" : "regular"} aria-hidden="true" /><span>Not relevant</span></button>
              </div>
              {decision && <div className={"decision-state " + (decision === "Wrong signal" ? "negative" : decision === "Explore" ? "positive" : "neutral")}><CheckCircleIcon size={18} weight="fill" aria-hidden="true" />Saved: {decision === "Wrong signal" ? "Not relevant" : decision}</div>}
            </section>

            <section className="decision-proof">
              <div className="section-heading"><div><h2>What guests said</h2><p>A few of the comments behind this pattern.</p></div><span className="paragraph-small">{signal.visitCount}</span></div>
              <div className="mini-evidence">
                {signal.observations.slice(0, 3).map((observation) => (
                  <div key={observation.id}><QuotesIcon size={18} weight="fill" aria-hidden="true" /><p>“{observation.rawText}”</p><span>{observation.isDemo ? "Demo visit" : sourceLabel(observation)}</span></div>
                ))}
              </div>
              <BaseButton hierarchy="secondary" size="small" shape="rect" onClick={() => go("/evidence?signal=" + signal.label)}><QuotesIcon size={16} weight="regular" aria-hidden="true" /><span>See all comments</span></BaseButton>
            </section>

            <section className="decision-boundary">
              <ShieldCheckIcon size={28} weight="regular" aria-hidden="true" />
              <div><h2>You stay in control.</h2><p>Guestbook never sends messages, changes bookings, orders stock, or takes action for you.</p></div>
            </section>
          </>
        ) : (
          <section className="memory-empty"><div className="empty-state"><CompassIcon size={28} weight="regular" aria-hidden="true" /><h2>No decision needed yet</h2><p>A decision appears after the same theme shows up in at least three confirmed visits.</p><BaseButton hierarchy="primary" size="medium" shape="rect" onClick={() => go("/memory")}>See memory</BaseButton></div></section>
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
          <PageTitle title="System & data" body="Check offline mode, voice, model tests, and what is saved on this device." />
          <div className="system-tabs" role="tablist" aria-label="System sections">
            <button type="button" className={tab === "Offline" ? "active" : ""} onClick={() => setTab("Offline")}><WifiHighIcon size={18} weight={tab === "Offline" ? "fill" : "regular"} aria-hidden="true" /><span>Offline</span></button>
            <button type="button" className={tab === "Voice" ? "active" : ""} onClick={() => setTab("Voice")}><MicrophoneIcon size={18} weight={tab === "Voice" ? "fill" : "regular"} aria-hidden="true" /><span>Voice</span></button>
            <button type="button" className={tab === "Model" ? "active" : ""} onClick={() => setTab("Model")}><GearSixIcon size={18} weight={tab === "Model" ? "fill" : "regular"} aria-hidden="true" /><span>Model</span></button>
            <button type="button" className={tab === "Data" ? "active" : ""} onClick={() => setTab("Data")}><HardDriveIcon size={18} weight={tab === "Data" ? "fill" : "regular"} aria-hidden="true" /><span>Data</span></button>
          </div>
        </section>

        <section className="system-content">
          {tab === "Offline" && (
            <div className="system-stack">
              <BaseBanner tone={offlineReady ? "positive" : "warning"}>{offlineReady ? "Ready to work offline." : "Finishing offline setup…"}</BaseBanner>
              <div className="system-list">
                <div><span>App shell</span><strong>{offlineReady ? "Cached" : "Preparing"}</strong></div>
                <div><span>Classifier</span><strong>~240 KB · local</strong></div>
                <div><span>Inference network</span><strong>0 requests</strong></div>
                <div><span>Business memory</span><strong>IndexedDB</strong></div>
              </div>
              <details className="proof-sequence">
                <summary>Test offline mode</summary>
                <ol><li>Wait for “Ready to work offline.”</li><li>Close the tab and disconnect.</li><li>Reopen Guestbook.</li><li>Add a new typed note, review it, and open Memory.</li></ol>
              </details>
            </div>
          )}

          {tab === "Voice" && (
            <div className="system-stack">
              <div className="system-note"><MicrophoneIcon size={20} weight="regular" aria-hidden="true" /><div><strong>Voice needs a connection.</strong><span>Typing, review, memory, evidence, and decisions still work offline.</span></div></div>
              <div className="system-list">
                <div><span>Guestbook voice-model download</span><strong>0 MB</strong></div>
                <div><span>Browser speech API</span><strong>{browserVoiceAvailable ? "Available" : "Unavailable"}</strong></div>
                <div><span>Offline free-form speech</span><strong>Not claimed</strong></div>
                <div><span>Offline typed inference</span><strong>~240 KB · local</strong></div>
              </div>
              <div className="system-caveat"><InfoIcon size={18} weight="regular" aria-hidden="true" /><span>Guestbook does not hide a large speech model download behind the voice button.</span></div>
            </div>
          )}

          {tab === "Model" && (
            <div className="model-grid">
              <div className="model-lab">
                <Field label="Test phrase" hint="Runs through the same model used in Review.">
                  <Textarea rows={6} value={labText} onChange={(event) => setLabText(event.target.value)} />
                </Field>
                <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={runInference}><GearSixIcon size={18} weight="regular" aria-hidden="true" /><span>Test model</span></BaseButton>
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
                <div className="metric-row"><span>Learned weights</span><strong>245,820 bytes</strong></div>
                <div className="metric-row"><span>Training cases</span><strong>2,687</strong></div>
                <div className="metric-row"><span>Decision threshold</span><strong>0.60</strong></div>
                <div className="metric-row"><span>Inference network</span><strong>0 requests</strong></div>
                <div className="metric-row"><span>Micro F1</span><strong>{benchmark ? formatPercent(benchmark.f1) : "90.2%"}</strong></div>
                <div className="metric-row"><span>Precision</span><strong>{benchmark ? formatPercent(benchmark.precision) : "92.5%"}</strong></div>
                <div className="metric-row"><span>Recall</span><strong>{benchmark ? formatPercent(benchmark.recall) : "88.1%"}</strong></div>
                <div className="metric-row"><span>Exact match</span><strong>{benchmark ? formatPercent(benchmark.exactMatch) : "82.9%"}</strong></div>
                <div className="metric-row"><span>Contradiction guards</span><strong>{benchmark ? (benchmark.contradictionGuardPassed ?? 0) + "/" + (benchmark.contradictionGuardCases ?? 0) : "9 policy checks"}</strong></div>
                <div className="system-caveat">The frozen 35-case set is synthetic regression evidence, not field accuracy.</div>
              </div>

              <div className="benchmark-panel">
                <div className="section-heading"><div><h2>Model evolution</h2></div></div>
                <div className="system-list">
                  <div><span>First synthetic-only model · Nairobi stress sample</span><strong>79.8% UNKNOWN</strong></div>
                  <div><span>First model · untouched Kiswahili transfer</span><strong>0.3%</strong></div>
                  <div><span>Decision</span><strong>Rejected</strong></div>
                  <div><span>Promoted model · MASSIVE English</span><strong>91.1%</strong></div>
                  <div><span>Promoted model · MASSIVE Kiswahili</span><strong>92.8%</strong></div>
                  <div><span>Held-out Nairobi weak-label agreement</span><strong>98.0%</strong></div>
                </div>
                <div className="system-caveat">MASSIVE is a semantic-transfer probe. Nairobi uses weak supervision. Neither result is claimed as tourism field accuracy.</div>
              </div>

              <div className="benchmark-panel">
                <div className="section-heading"><div><h2>Why learned AI here?</h2></div></div>
                <div className="system-list">
                  <div><span>Synthetic rules · micro F1</span><strong>93.0%</strong></div>
                  <div><span>Guestbook Micro · synthetic micro F1</span><strong>90.2%</strong></div>
                  <div><span>Rules · MASSIVE English</span><strong>16.7%</strong></div>
                  <div><span>Guestbook Micro · MASSIVE English</span><strong>91.1%</strong></div>
                  <div><span>Rules · MASSIVE Kiswahili</span><strong>2.3%</strong></div>
                  <div><span>Guestbook Micro · MASSIVE Kiswahili</span><strong>92.8%</strong></div>
                </div>
                <div className="system-note"><strong>Use deterministic code where it works.</strong><span>The learned model exists only for messy-language interpretation. Distinct-visit counting, evidence grouping, thresholds, persistence, and the final business decision remain deterministic or human-controlled.</span></div>
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
                <BaseButton hierarchy="primary" size="medium" shape="rect" onClick={exportMemory}><DownloadSimpleIcon size={18} weight="bold" aria-hidden="true" /><span>Export data</span></BaseButton>
                <BaseButton hierarchy="negative" size="medium" shape="rect" onClick={resetDemo}><TrashIcon size={18} weight="bold" aria-hidden="true" /><span>Reset demo</span></BaseButton>
              </div>
              <BaseBanner tone="warning">Export includes confirmed real visits only. Reset restores the demo data.</BaseBanner>
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
