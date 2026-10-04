import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { activeClassifier } from "./ai/classifier";
import { db } from "./storage/db";
import { seedDemoData } from "./data/demoData";
import { buildMemory, decisionCopy, type MemorySignal } from "./domain/memory";
import { HUMAN_CONFIRM_REQUIRED, LABELS, LABEL_META, type SignalLabel } from "./domain/labels";
import type { Observation, Prediction } from "./domain/observation";
import { createOfflineVoice, type OfflineVoiceController, type VoiceProgress } from "./voice/moonshine";


interface BrowserSpeechResultEvent {
  resultIndex: number;
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


type AppMode = "light" | "dark";
type NavTarget = "home" | "add" | "memory";
type IconName = "menu" | "back" | "home" | "profile" | "plus" | "heart" | "mic" | "send" | "attach" | "more";

function Icon({ name, size = 24, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  if (name === "menu") return <svg {...common}><rect x="6" y="6" width="12" height="2.5" rx="1.25" fill="currentColor"/><rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="currentColor"/><rect x="6" y="15.5" width="12" height="2.5" rx="1.25" fill="currentColor"/></svg>;
  if (name === "back") return <svg {...common} fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (name === "home") return <svg {...common} fill={filled ? "currentColor" : "none"}><path d="M4 10.5 12 4l8 6.5V20h-5v-5H9v5H4v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>;
  if (name === "profile") return <svg {...common} fill="none"><circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8"/><path d="M5.5 20c.7-4 3.1-6 6.5-6s5.8 2 6.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (name === "plus") return <svg {...common} fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>;
  if (name === "heart") return <svg {...common} fill={filled ? "currentColor" : "none"}><path d="M20.3 5.7a5 5 0 0 0-7.1 0L12 6.9l-1.2-1.2a5 5 0 0 0-7.1 7.1L12 21l8.3-8.2a5 5 0 0 0 0-7.1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>;
  if (name === "mic") return <svg {...common} fill="none"><rect x="8.2" y="3.3" width="7.6" height="11.1" rx="3.8" stroke="currentColor" strokeWidth="1.7"/><path d="M5.5 11.7a6.5 6.5 0 0 0 13 0M12 18.2V21M8.5 21h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
  if (name === "send") return <svg {...common} fill="none"><path d="m4 5 16 7-16 7 3-7-3-7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M7 12h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
  if (name === "attach") return <svg {...common} fill="none"><path d="m8.4 12.8 6.2-6.2a3.2 3.2 0 1 1 4.5 4.5l-8 8a5 5 0 0 1-7.1-7.1l8.1-8.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
  return <svg {...common}><circle cx="6" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="18" cy="12" r="1.7" fill="currentColor"/></svg>;
}

function formatRelative(timestamp: number) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + " hr ago";
  return Math.round(hours / 24) + " d ago";
}

function sourceName(observation: Observation) {
  if (observation.source === "guide") return "Guide note";
  if (observation.source === "operator") return "Operator note";
  if (observation.source === "demo") return "Guest visitor";
  return "Guest visitor";
}

function Avatar({ label, size = 32, outline = false, dark = false }: { label: string; size?: 24 | 32; outline?: boolean; dark?: boolean }) {
  const initial = label.trim().charAt(0).toUpperCase() || "G";
  return <span className={"ds-avatar " + (outline ? "outline" : "") + (dark ? " dark-avatar" : "")} style={{ width: size, height: size, fontSize: size === 24 ? 9 : 11 }}>{initial}</span>;
}

function RoundedTabs({ items, active, onChange, dark = false }: { items: Array<{ key: string; label: string }>; active: string; onChange: (key: string) => void; dark?: boolean }) {
  return (
    <nav className={"rounded-tabs " + (dark ? "dark-tabs" : "")} aria-label="Content views">
      {items.map((item) => (
        <button key={item.key} className={"ds-chip " + (active === item.key ? "active" : "")} onClick={() => onChange(item.key)}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function AppHeader({ title, subtitle, dark = false, back = false }: { title: string; subtitle?: string; dark?: boolean; back?: boolean }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => setOfflineReady(true)).catch(() => setOfflineReady(false));
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const status = online ? (offlineReady ? "Offline ready" : "Preparing offline") : "Offline";

  return (
    <header className={"ds-header " + (dark ? "dark-header" : "")}>
      <button className="menu-button" onClick={() => back ? window.history.back() : go("/memory")} aria-label={back ? "Go back" : "Open business memory"}>
        <Icon name={back ? "back" : "menu"} />
      </button>
      <div className="ds-title-block">
        <h1>{title}</h1>
        <p className="sr-only">{subtitle ? subtitle + " · " : ""}{status}</p>
      </div>
    </header>
  );
}

function BottomBar({ active, dark = false }: { active: NavTarget; dark?: boolean }) {
  return (
    <nav className={"tab-bar " + (dark ? "dark-tab-bar" : "")} aria-label="Primary navigation">
      <div className="tab-options">
        <button className={"nav-segment " + (active === "home" ? "active" : "")} onClick={() => go("/")}>
          <Icon name="home" filled={active === "home"} />
          <span>Home</span>
        </button>
        <button className={"add-button " + (active === "add" ? "current" : "")} onClick={() => go("/guest")} aria-label="Leave a message">
          <Icon name="plus" size={32} />
        </button>
        <button className={"nav-segment " + (active === "memory" ? "active" : "")} onClick={() => go("/memory")}>
          <Icon name="profile" filled={active === "memory"} />
          <span>Memory</span>
        </button>
      </div>
      <span className="home-indicator" />
    </nav>
  );
}

function Shell({ children, mode = "light", active = "home", hideNav = false }: { children: ReactNode; mode?: AppMode; active?: NavTarget; hideNav?: boolean }) {
  return (
    <main className={"app-shell " + mode}>
      {children}
      {!hideNav && <BottomBar active={active} dark={mode === "dark"} />}
    </main>
  );
}

function AvatarStack({ count = 3, dark = false }: { count?: number; dark?: boolean }) {
  return (
    <span className="avatar-stack" aria-hidden="true">
      {Array.from({ length: Math.min(3, Math.max(1, count)) }).map((_, index) => (
        <Avatar key={index} label={String.fromCharCode(71 + index)} size={24} outline dark={dark} />
      ))}
    </span>
  );
}

function GuestMedia({ src, label = "Guest photo" }: { src: string; label?: string }) {
  return (
    <div className="guest-media">
      <img src={src} alt="" />
      <span className="media-tag">{label}</span>
    </div>
  );
}

function EntryCard({
  observation,
  reacted,
  replies,
  onReact,
  onReply,
}: {
  observation: Observation;
  reacted: boolean;
  replies: string[];
  onReact: () => void;
  onReply: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [showReplies, setShowReplies] = useState(false);

  function submitReply() {
    const next = draft.trim();
    if (!next) return;
    onReply(next);
    setDraft("");
    setShowReplies(true);
  }

  return (
    <article className="guest-post">
      <div className="user-post-copy">
        <div className="user-title">
          <Avatar label={sourceName(observation)} />
          <div>
            <strong>{sourceName(observation)}</strong>
            <span>{formatRelative(observation.createdAt)}{observation.isDemo ? " · demo" : ""}</span>
          </div>
        </div>
        <p className="post-message">{observation.rawText}</p>
        {observation.mediaDataUrl && <GuestMedia src={observation.mediaDataUrl} />}
        <div className="user-likes-row">
          <button className="reply-summary" onClick={() => setShowReplies((value) => !value)}>
            <AvatarStack count={Math.max(1, replies.length)} />
            <span>{replies.length ? "View " + replies.length + (replies.length === 1 ? " reply" : " replies") : "Reply"}</span>
          </button>
          <button className={"reaction-button " + (reacted ? "reacted" : "")} onClick={onReact} aria-label="React to this entry">
            <Icon name="heart" size={16} filled={reacted} />
            <span>{reacted ? "1 reaction" : "React"}</span>
          </button>
        </div>
      </div>

      {showReplies && replies.map((reply, index) => (
        <div className="reply-card" key={index}>
          <Avatar label="Host" size={24} />
          <p><strong>Host</strong><span> · {reply}</span></p>
        </div>
      ))}

      <div className="comment-field">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitReply(); }} placeholder="Write reply" aria-label="Write reply" />
        <button onClick={submitReply} disabled={!draft.trim()} aria-label="Send reply"><Icon name="send" size={16} /></button>
      </div>
    </article>
  );
}

function Home() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [filter, setFilter] = useState("all");
  const [reactions, setReactions] = useState<Record<string, boolean>>(() => JSON.parse(localStorage.getItem("guestbook-reactions") ?? "{}"));
  const [replies, setReplies] = useState<Record<string, string[]>>(() => JSON.parse(localStorage.getItem("guestbook-replies") ?? "{}"));

  useEffect(() => {
    seedDemoData().then(() => db.observations.orderBy("createdAt").reverse().toArray()).then((rows) => setObservations(rows.filter((row) => row.status === "confirmed")));
  }, []);

  const visible = observations.filter((observation) => {
    if (filter === "all") return true;
    if (filter === "requests") return observation.confirmedLabels.some((label) => label.startsWith("WANT_"));
    if (filter === "needs") return observation.confirmedLabels.some((label) => label.startsWith("REQUIREMENT_") || label.startsWith("FRICTION_"));
    if (filter === "praise") return observation.confirmedLabels.some((label) => label === "PRAISE_EXPERIENCE" || label === "RETURN_REFERRAL");
    return true;
  });

  function toggleReaction(id: string) {
    const next = { ...reactions, [id]: !reactions[id] };
    setReactions(next);
    localStorage.setItem("guestbook-reactions", JSON.stringify(next));
  }

  function addReply(id: string, text: string) {
    const next = { ...replies, [id]: [...(replies[id] ?? []), text] };
    setReplies(next);
    localStorage.setItem("guestbook-replies", JSON.stringify(next));
  }

  return (
    <Shell active="home">
      <section className="home-hero">
        <AppHeader title="What guests are saying" subtitle="Guestbook · local memory" />
        <RoundedTabs
          active={filter}
          onChange={setFilter}
          items={[
            { key: "all", label: "All" },
            { key: "requests", label: "Requests" },
            { key: "needs", label: "Needs" },
            { key: "praise", label: "Praise" },
          ]}
        />
      </section>

      <section className="feed">
        {visible.slice(0, 7).map((observation) => (
          <EntryCard
            key={observation.id}
            observation={observation}
            reacted={Boolean(reactions[observation.id])}
            replies={replies[observation.id] ?? []}
            onReact={() => toggleReaction(observation.id)}
            onReply={(text) => addReply(observation.id, text)}
          />
        ))}
        {visible.length === 0 && <div className="empty-state">No entries in this view yet.</div>}
      </section>
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
  const [mediaDataUrl, setMediaDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<"install" | "cached" | "loading" | "ready" | "listening" | "error">(
    () => localStorage.getItem("guestbook-moonshine-voice-v1") ? "cached" : "install",
  );
  const [voiceProgress, setVoiceProgress] = useState<VoiceProgress | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [quickVoiceState, setQuickVoiceState] = useState<"idle" | "listening" | "unavailable">(
    () => getBrowserSpeechRecognition() ? "idle" : "unavailable",
  );
  const voiceRef = useRef<OfflineVoiceController | null>(null);
  const quickVoiceRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceBaseRef = useRef("");
  const copy = guestCopy[language];

  useEffect(() => {
    return () => {
      void voiceRef.current?.stop();
      voiceRef.current?.close();
      voiceRef.current = null;
      quickVoiceRef.current?.stop();
      quickVoiceRef.current = null;
    };
  }, []);

  function startQuickVoice() {
    if (language !== "en" || !navigator.onLine) {
      setVoiceError("Quick voice needs a connection. Type instead, or install the offline voice pack while connected.");
      return;
    }
    const Recognition = getBrowserSpeechRecognition();
    if (!Recognition) {
      setQuickVoiceState("unavailable");
      setVoiceError("This browser does not expose quick voice recognition.");
      return;
    }

    const recognition = new Recognition();
    const base = text.trim();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index++) {
        transcript += event.results[index]?.[0]?.transcript ?? "";
      }
      setText([base, transcript.trim()].filter(Boolean).join(base ? " " : ""));
    };
    recognition.onend = () => {
      quickVoiceRef.current = null;
      setQuickVoiceState("idle");
    };
    recognition.onerror = (event) => {
      quickVoiceRef.current = null;
      setQuickVoiceState("idle");
      setVoiceError(event.error === "not-allowed" ? "Allow microphone access in your browser and try again." : "Quick voice could not transcribe that. Type instead or retry.");
    };

    setVoiceError("");
    quickVoiceRef.current = recognition;
    setQuickVoiceState("listening");
    try {
      recognition.start();
    } catch {
      quickVoiceRef.current = null;
      setQuickVoiceState("idle");
      setVoiceError("Quick voice could not start on this browser.");
    }
  }

  function stopQuickVoice() {
    quickVoiceRef.current?.stop();
  }

  async function prepareVoice() {
    if (language !== "en" || voiceState === "loading" || voiceState === "listening") return;
    if (!navigator.onLine && voiceState === "install") {
      setVoiceError("Connect once to install the offline voice pack.");
      setVoiceState("error");
      return;
    }
    setVoiceError("");
    setVoiceProgress(null);
    setVoiceState("loading");
    try {
      voiceRef.current?.close();
      const controller = await createOfflineVoice({
        onText: (live) => {
          const next = [voiceBaseRef.current, live.trim()].filter(Boolean).join(voiceBaseRef.current ? " " : "");
          setText(next);
        },
        onLine: (finalText) => {
          const next = [voiceBaseRef.current, finalText.trim()].filter(Boolean).join(voiceBaseRef.current ? " " : "");
          setText(next);
        },
        onProgress: (progress) => setVoiceProgress(progress),
        onError: (error) => {
          setVoiceError(error.message || "Voice transcription failed.");
          setVoiceState("error");
        },
      });
      voiceRef.current = controller;
      await controller.load();
      localStorage.setItem("guestbook-moonshine-voice-v1", "cached");
      setVoiceProgress(null);
      setVoiceState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setVoiceError(message || "Could not load offline voice.");
      setVoiceState(localStorage.getItem("guestbook-moonshine-voice-v1") ? "cached" : "error");
    }
  }

  async function startVoice() {
    if (!voiceRef.current || voiceState !== "ready") return;
    voiceBaseRef.current = text.trim();
    setVoiceError("");
    setVoiceState("listening");
    try {
      await voiceRef.current.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setVoiceError(message || "Microphone access failed.");
      setVoiceState("ready");
    }
  }

  async function stopVoice() {
    if (!voiceRef.current) return;
    try {
      await voiceRef.current.stop();
    } finally {
      setVoiceState("ready");
    }
  }

  function attachMedia(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setMediaDataUrl(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (text.trim().length < 3 || busy) return;
    if (voiceState === "listening") await stopVoice();
    if (quickVoiceState === "listening") stopQuickVoice();
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
    await db.observations.add(observation);
    go("/review?id=" + encodeURIComponent(id));
  }

  const canPrepare = language === "en" && (voiceState === "install" || voiceState === "cached" || voiceState === "error");
  const progressKnown = Boolean(voiceProgress?.total && voiceProgress.total > 0);
  const progressPercent = progressKnown && voiceProgress ? Math.round(voiceProgress.fraction * 100) : null;
  const loadedMb = voiceProgress?.loaded ? (voiceProgress.loaded / 1024 / 1024).toFixed(1) : "0.0";
  const progressSize = progressKnown && voiceProgress?.total
    ? `${loadedMb} / ${(voiceProgress.total / 1024 / 1024).toFixed(1)} MB`
    : voiceProgress ? `${loadedMb} MB so far` : null;
  const progressFile = voiceProgress?.file?.split("/").pop();

  return (
    <Shell active="add">
      <AppHeader title="Leave a message" subtitle="Guest mode · no account" back />
      <RoundedTabs
        active={language}
        onChange={(key) => setLanguage(key as keyof typeof guestCopy)}
        items={[
          { key: "en", label: "English" },
          { key: "sw", label: "Kiswahili" },
        ]}
      />

      <section className="single-feed">
        <article className="guest-post composer-post">
          <div className="user-post-copy">
            <div className="user-title">
              <Avatar label="Guest" />
              <div><strong>Guest visitor</strong><span>Right now · this device</span></div>
            </div>
            <p className="composer-help">{copy.helper}</p>

            <div className="message-composer writing">
              <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.placeholder} rows={6} aria-label={copy.title} />
              {mediaDataUrl && <GuestMedia src={mediaDataUrl} label="Photo" />}
              <input
                ref={mediaInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) => attachMedia(event.target.files?.[0])}
                aria-label="Attach guest photo"
              />
              <div className="composer-actions">
                <button className="field-action labelled" onClick={() => mediaInputRef.current?.click()}><Icon name="attach" size={16} /><span>Photo</span></button>
                {language === "en" && (
                  <>
                    {quickVoiceState === "idle" && navigator.onLine && (
                      <button className="field-action labelled primary-voice" onClick={startQuickVoice}>
                        <Icon name="mic" size={16} /><span>Speak now</span>
                      </button>
                    )}
                    {quickVoiceState === "listening" && (
                      <button className="field-action labelled active-voice" onClick={stopQuickVoice}>
                        <Icon name="mic" size={16} /><span>Listening</span>
                      </button>
                    )}
                    {canPrepare && (
                      <button className="field-action labelled secondary-voice" onClick={prepareVoice}>
                        <Icon name="mic" size={16} /><span>{voiceState === "cached" ? "Load offline voice" : "Install offline voice · ~74 MB"}</span>
                      </button>
                    )}
                    {voiceState === "loading" && (
                      <span className="voice-caption">
                        {progressKnown
                          ? "Offline voice · " + progressPercent + "% · " + progressSize + (progressFile ? " · " + progressFile : "")
                          : "Offline voice downloading · " + (progressSize ?? "starting…") + (progressFile ? " · " + progressFile : "")}
                      </span>
                    )}
                    {voiceState === "ready" && <button className="field-action labelled secondary-voice" onClick={startVoice}><Icon name="mic" size={16} /><span>Speak offline</span></button>}
                    {voiceState === "listening" && <button className="field-action labelled active-voice" onClick={stopVoice}><Icon name="mic" size={16} /><span>Listening offline</span></button>}
                  </>
                )}
                {language === "sw" && <span className="voice-caption">Typed input · offline</span>}
                <span className="field-count">{text.length}</span>
              </div>
              {voiceState === "loading" && (
                <div className={"field-progress " + (progressKnown ? "" : "indeterminate")}>
                  <span style={progressKnown ? { width: progressPercent + "%" } : undefined} />
                </div>
              )}
              {voiceError && language === "en" && <p className="field-error">{voiceError}</p>}
            </div>
          </div>

          <button className="post-submit" disabled={text.trim().length < 3 || busy} onClick={submit}>
            <span>{busy ? "Understanding locally…" : copy.submit}</span>
            <Icon name="send" size={16} />
          </button>
        </article>

        <p className="screen-footnote">Speak now uses the browser speech service while connected. Offline voice is an optional ~74 MB on-device pack. The 240 KB Guestbook classifier and typed workflow still work offline.</p>
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
    <Shell active="add">
      <AppHeader title="Capture a visit" subtitle="Guide or operator note" back />
      <div className="stacked-tabs">
        <RoundedTabs
          active={source}
          onChange={(key) => setSource(key as "guide" | "operator")}
          items={[{ key: "guide", label: "Guide" }, { key: "operator", label: "Operator" }]}
        />
        <RoundedTabs
          active={language}
          onChange={setLanguage}
          items={[{ key: "en", label: "English" }, { key: "sw", label: "Kiswahili" }]}
        />
      </div>

      <section className="single-feed capture-later-feed">
        <article className="guest-post composer-post">
          <div className="user-post-copy">
            <div className="user-title">
              <Avatar label={source} />
              <div><strong>{source === "guide" ? "Guide note" : "Operator note"}</strong><span>Captured after the visit</span></div>
            </div>
            <p className="composer-help">Keep the visitor's words when they never touch the shared phone. Source and language stay attached.</p>
            <div className="message-composer writing">
              <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="They loved the roasting, said the road was difficult, and asked whether we sell beans." rows={6} autoFocus />
              <div className="composer-actions"><span className="voice-caption">{language === "sw" ? "Kiswahili" : "English"} · local note</span><span className="field-count">{text.length}</span></div>
            </div>
          </div>
          <button className="post-submit" disabled={text.trim().length < 3 || busy} onClick={submit}>
            <span>{busy ? "Understanding locally…" : "Review observation"}</span><Icon name="send" size={16} />
          </button>
        </article>
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
      setSelected(new Set((item?.predictions ?? []).filter((prediction) => prediction.label !== "UNKNOWN").map((prediction) => prediction.label)));
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

  if (loading) return <Shell active="add"><AppHeader title="Review message" subtitle="Loading local record" back /></Shell>;
  if (!observation) return <Shell active="add"><AppHeader title="Review message" subtitle="No pending note" back /><section className="single-feed"><div className="empty-state">No pending observation.</div></section></Shell>;

  return (
    <Shell active="add">
      <AppHeader title="Review message" subtitle="Human confirmation" back />
      <section className="single-feed review-feed">
        <article className="guest-post">
          <div className="user-post-copy">
            <div className="user-title">
              <Avatar label={sourceName(observation)} />
              <div><strong>{sourceName(observation)}</strong><span>{formatRelative(observation.createdAt)} · {observation.language.toUpperCase()}</span></div>
            </div>
            <p className="post-message">{observation.rawText}</p>
            {observation.mediaDataUrl && <GuestMedia src={observation.mediaDataUrl} />}
          </div>
        </article>

        <article className="guest-post review-post">
          <div className="user-post-copy">
            <div className="section-label-row"><strong>Guestbook understood</strong><span>~240 KB · 0 network</span></div>
            <div className="signal-chips">
              {observation.predictions.map((prediction) => {
                const selectedNow = selected.has(prediction.label);
                const needsConfirm = HUMAN_CONFIRM_REQUIRED.has(prediction.label);
                return (
                  <button
                    key={prediction.label}
                    className={"ds-chip signal-chip " + (selectedNow ? "active" : "") + (selectedNow && needsConfirm ? "human-check" : "")}
                    onClick={() => toggle(prediction.label)}
                  >
                    {LABEL_META[prediction.label].title} · {formatPercent(prediction.score)}
                  </button>
                );
              })}
            </div>
            <p className="small-copy">Tap a signal to correct it. Accessibility and dietary/safety signals require explicit human confirmation.</p>

            <details className="correction-panel">
              <summary>Add or correct a signal</summary>
              <div className="signal-chips correction-chips">
                {LABELS.filter((label) => label !== "UNKNOWN").map((label) => (
                  <button key={label} className={"ds-chip signal-chip " + (selected.has(label) ? "active" : "")} onClick={() => toggle(label)}>
                    {LABEL_META[label].title}
                  </button>
                ))}
              </div>
            </details>
          </div>
          <button className="post-submit" onClick={confirm}><span>Confirm into memory</span><Icon name="send" size={16} /></button>
        </article>

        <p className="screen-footnote">Original words stay attached. Guestbook interprets; a person decides what enters memory.</p>
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
  const featured = memory.find((signal) => signal.label === "WANT_PRODUCT" && signal.visitCount >= 5) ?? memory[0] ?? null;
  const ordered = featured ? [featured, ...memory.filter((signal) => signal.label !== featured.label)] : memory;

  return (
    <Shell mode="dark" active="memory">
      <section className="home-hero dark-hero">
        <AppHeader title="Business memory" subtitle="Confirmed patterns · local only" dark />
        <RoundedTabs
          active="signals"
          dark
          onChange={(key) => {
            if (key === "entries") go("/");
            if (key === "actions") go("/decide");
          }}
          items={[{ key: "signals", label: "Signals" }, { key: "entries", label: "Entries" }, { key: "actions", label: "Actions" }]}
        />
      </section>

      <section className="feed signal-feed">
        {ordered.map((signal, index) => {
          const changed = previousCounts[signal.label] !== undefined && signal.visitCount > previousCounts[signal.label];
          const open = expanded === signal.label;
          return (
            <article className="guest-post dark-post signal-post" key={signal.label}>
              <div className="user-post-copy">
                <div className="user-title">
                  <Avatar label={signal.title} dark />
                  <div>
                    <strong>{signal.title}</strong>
                    <span>{changed ? previousCounts[signal.label] + " → " + signal.visitCount + " visits · just now" : signal.visitCount + " independent visits"}</span>
                  </div>
                </div>
                <p className="post-message">{signal.description}</p>
                <div className="user-likes-row">
                  <button className="reply-summary dark-link" onClick={() => setExpanded(open ? null : signal.label)}>
                    <AvatarStack count={signal.observations.length} dark />
                    <span>{open ? "Hide evidence" : "View " + signal.observations.length + " sources"}</span>
                  </button>
                  {index === 0 && <span className="kit-badge">Repeating</span>}
                </div>
              </div>

              {open && signal.observations.map((observation) => (
                <div className="reply-card dark-reply" key={observation.id}>
                  <Avatar label={sourceName(observation)} size={24} dark />
                  <p><strong>{observation.isDemo ? "Demo visit" : sourceName(observation)}</strong><span> · {observation.rawText}</span></p>
                </div>
              ))}
            </article>
          );
        })}

        <div className="memory-tools">
          <button className="ds-chip dark-tool" onClick={() => go("/capture")}>Capture later</button>
          <button className="ds-chip dark-tool" onClick={() => exportMemory(observations)}>Export JSON</button>
          <button className="ds-chip active dark-action" onClick={() => go("/decide")}>Review actions</button>
        </div>
        <p className="screen-footnote dark-footnote">Demo visits remain visibly marked inside source evidence. New records stay in this browser via IndexedDB.</p>
      </section>
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

  const featured = signals.find((signal) => signal.label === "WANT_PRODUCT") ?? signals[0] ?? null;
  const ordered = featured ? [featured, ...signals.filter((signal) => signal.label !== featured.label)] : signals;

  return (
    <Shell mode="dark" active="memory">
      <section className="home-hero dark-hero">
        <AppHeader title="What should I act on?" subtitle="Evidence, not autopilot" dark back />
        <RoundedTabs
          active="actions"
          dark
          onChange={(key) => {
            if (key === "signals") go("/memory");
            if (key === "entries") go("/");
          }}
          items={[{ key: "signals", label: "Signals" }, { key: "actions", label: "Actions" }, { key: "entries", label: "Entries" }]}
        />
      </section>

      <section className="feed decision-feed">
        {ordered.map((signal, index) => {
          const copy = decisionCopy(signal);
          return (
            <article className="guest-post dark-post decision-post" key={signal.label}>
              <div className="user-post-copy">
                <div className="user-title">
                  <Avatar label={signal.title} dark />
                  <div><strong>{copy.headline}</strong><span>{signal.visitCount} independent visits{index === 0 ? " · strongest signal" : ""}</span></div>
                </div>
                <p className="post-message">{copy.body}</p>
                {index === 0 && <p className="small-copy dark-small-copy">Not a prediction. Not a generated recommendation. {signal.visitCount} source-backed observations.</p>}
                <div className="decision-buttons">
                  {["Explore", "Not now", "Wrong signal"].map((option) => (
                    <button key={option} className={"ds-chip decision-chip " + (decisions[signal.label] === option ? "active" : "")} onClick={() => decide(signal.label, option)}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              {index === 0 && signal.observations.slice(0, 3).map((observation) => (
                <div className="reply-card dark-reply" key={observation.id}>
                  <Avatar label={sourceName(observation)} size={24} dark />
                  <p><strong>{observation.isDemo ? "Demo visit" : sourceName(observation)}</strong><span> · {observation.rawText}</span></p>
                </div>
              ))}
            </article>
          );
        })}
        {ordered.length === 0 && <div className="empty-state dark-empty">No repeated signal has crossed the three-visit threshold yet.</div>}
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
    <Shell hideNav>
      <AppHeader title="Model lab" subtitle="Local inference" back />
      <section className="utility-stack">
        <article className="guest-post utility-post">
          <div className="user-post-copy">
            <div className="section-label-row"><strong>Observation</strong><span>On-device test</span></div>
            <div className="message-composer writing lab-composer">
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} />
            </div>
          </div>
          <button className="post-submit" onClick={run} disabled={running}><span>{running ? "Running locally…" : "Run local inference"}</span><Icon name="send" size={16} /></button>
        </article>

        <article className="guest-post utility-post">
          <div className="user-post-copy">
            <div className="section-label-row"><strong>Predictions</strong><span>{inferenceMs === null ? "—" : inferenceMs.toFixed(2) + " ms"}</span></div>
            <div className="signal-chips">
              {predictions.length === 0 ? <p className="small-copy">Run an observation.</p> : predictions.map((prediction) => (
                <span className="ds-chip active signal-chip" key={prediction.label}>{LABEL_META[prediction.label].title} · {formatPercent(prediction.score)}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="guest-post utility-post">
          <div className="user-post-copy">
            <div className="section-label-row"><strong>Frozen stress set</strong><span>Synthetic regression check</span></div>
            <div className="metric-list">
              <Metric label="Micro F1" value={report ? formatPercent(report.f1) : "—"} />
              <Metric label="Precision" value={report ? formatPercent(report.precision) : "—"} />
              <Metric label="Recall" value={report ? formatPercent(report.recall) : "—"} />
              <Metric label="Exact match" value={report ? formatPercent(report.exactMatch) : "—"} />
              <Metric label="Cases" value={report ? String(report.cases) : "35"} />
              <Metric label="Weights" value={report ? Math.round(report.weightBytes / 1024) + " KB" : "~240 KB"} />
              <Metric label="Network inference" value="0 requests" />
            </div>
          </div>
          <button className="post-submit secondary-submit" onClick={runBenchmark} disabled={running}><span>Run benchmark</span><Icon name="send" size={16} /></button>
        </article>

        <article className="guest-post utility-post">
          <div className="user-post-copy">
            <div className="section-label-row"><strong>External evidence</strong><span>Held out</span></div>
            <div className="metric-list">
              <Metric label="MASSIVE English" value="91.1%" />
              <Metric label="MASSIVE Swahili" value="92.8%" />
              <Metric label="Nairobi weak-label holdout" value="98.0%" />
              <Metric label="Training cases" value="2,687" />
              <Metric label="Dimensions" value="4,096" />
              <Metric label="Weights" value="240 KB" />
            </div>
            <p className="small-copy">Transfer probes, not field accuracy.</p>
          </div>
        </article>

        <article className="guest-post utility-post">
          <div className="user-post-copy">
            <div className="section-label-row"><strong>Recording utility</strong><span>Demo state</span></div>
            <p className="post-message">Clear local test entries and restore five marked product-request demo visits.</p>
            {resetMessage && <p className="small-copy">{resetMessage}</p>}
          </div>
          <button className="post-submit secondary-submit" onClick={resetDemo}><span>Reset demo</span><Icon name="send" size={16} /></button>
        </article>
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
