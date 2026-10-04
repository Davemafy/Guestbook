import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { activeClassifier } from "./ai/classifier";
import { db } from "./storage/db";
import { seedDemoData } from "./data/demoData";
import { buildMemory, decisionCopy, type MemorySignal } from "./domain/memory";
import { HUMAN_CONFIRM_REQUIRED, LABELS, LABEL_META, type SignalLabel } from "./domain/labels";
import type { Observation, Prediction } from "./domain/observation";
import { createOfflineVoice, type OfflineVoiceController, type VoiceProgress } from "./voice/moonshine";


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
        <p>{subtitle ? subtitle + " · " : ""}{status}</p>
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
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<"install" | "cached" | "loading" | "ready" | "listening" | "error">(
    () => localStorage.getItem("guestbook-moonshine-voice-v1") ? "cached" : "install",
  );
  const [voiceProgress, setVoiceProgress] = useState<VoiceProgress | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const voiceRef = useRef<OfflineVoiceController | null>(null);
  const voiceBaseRef = useRef("");
  const copy = guestCopy[language];

  useEffect(() => {
    return () => {
      void voiceRef.current?.stop();
      voiceRef.current?.close();
      voiceRef.current = null;
    };
  }, []);

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

  async function submit() {
    if (text.trim().length < 3 || busy) return;
    if (voiceState === "listening") await stopVoice();
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

  const canInstall = language === "en" && (voiceState === "install" || voiceState === "cached" || voiceState === "error");
  const progressPercent = voiceProgress ? Math.round(voiceProgress.fraction * 100) : null;
  const progressSize = voiceProgress?.total
    ? `${((voiceProgress.loaded ?? 0) / 1024 / 1024).toFixed(1)} / ${(voiceProgress.total / 1024 / 1024).toFixed(1)} MB`
    : null;

  return (
    <Shell>
      <section className="capture-screen">
        <div className="capture-context">
          <span>VISITOR NOTE</span>
          <span>{language === "en" ? "ENGLISH" : "KISWAHILI"}</span>
          <span>{voiceState === "listening" ? "RECORDING LOCALLY" : "THIS DEVICE"}</span>
        </div>

        <div className="capture-heading">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
          </div>
          <p>{copy.helper}</p>
        </div>

        <div className="capture-workspace">
          <div className="transcript-column">
            <div className="transcript-head">
              <span>TRANSCRIPT</span>
              <span>EDITABLE BEFORE SAVE</span>
            </div>
            <textarea
              className="capture-transcript"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={copy.placeholder}
              rows={8}
              aria-label="Guest note"
            />
            <div className="transcript-meta">
              <span>{text.length} characters</span>
              <span>source words stay attached</span>
            </div>
          </div>

          <aside className={"capture-dock " + (voiceState === "listening" ? "listening" : "")}>
            <div className="capture-dock-top">
              <span>OFFLINE VOICE</span>
              <span>{language === "en" ? "MOONSHINE WASM" : "TYPE ONLY"}</span>
            </div>

            <button
              className="record-control"
              onClick={
                language !== "en" || voiceState === "loading"
                  ? undefined
                  : canInstall
                    ? prepareVoice
                    : voiceState === "ready"
                      ? startVoice
                      : voiceState === "listening"
                        ? stopVoice
                        : undefined
              }
              disabled={language !== "en" || voiceState === "loading"}
              aria-label={
                language !== "en" ? "Kiswahili typed input" :
                voiceState === "install" ? "Install offline voice" :
                voiceState === "cached" ? "Load cached offline voice" :
                voiceState === "loading" ? "Preparing offline voice" :
                voiceState === "ready" ? "Start offline voice" :
                voiceState === "listening" ? "Stop offline voice" :
                "Retry offline voice"
              }
            >
              <span className="record-ring">
                <span className="record-core" />
              </span>
            </button>

            <div className="record-bars" aria-hidden="true">
              {Array.from({ length: 11 }).map((_, index) => <i key={index} />)}
            </div>

            <div className="record-copy">
              <strong>
                {language === "sw" && "TYPE IN KISWAHILI"}
                {language === "en" && voiceState === "install" && "INSTALL VOICE ONCE"}
                {language === "en" && voiceState === "cached" && "LOAD CACHED VOICE"}
                {language === "en" && voiceState === "loading" && "PREPARING VOICE…"}
                {language === "en" && voiceState === "ready" && "TAP TO SPEAK"}
                {language === "en" && voiceState === "listening" && "LISTENING… TAP TO STOP"}
                {language === "en" && voiceState === "error" && "VOICE NEEDS ATTENTION"}
              </strong>
              <p>
                {language === "sw" && "Kiswahili stays fully offline through typed input in this build."}
                {language === "en" && voiceState === "install" && "Download the English speech pack once while connected. After that, transcription runs on this device."}
                {language === "en" && voiceState === "cached" && "The voice pack is already cached on this browser. Load it without downloading again."}
                {language === "en" && voiceState === "loading" && `Loading locally${progressPercent === null ? "" : ` · ${progressPercent}%`}${progressSize ? ` · ${progressSize}` : ""}`}
                {language === "en" && (voiceState === "ready" || voiceState === "listening") && "Audio stays on this device. No speech API and no Guestbook server."}
                {language === "en" && voiceState === "error" && (voiceError || "Typing remains available while voice is unavailable.")}
              </p>
              {voiceState === "loading" && (
                <div className="dock-progress" aria-label="Voice pack loading progress">
                  <span style={{ width: `${progressPercent ?? 8}%` }} />
                </div>
              )}
            </div>

            <div className="capture-trust">
              <span>~240 KB classifier</span>
              <span>0 inference requests</span>
            </div>
          </aside>
        </div>

        <div className="capture-footer">
          <div className="language-switch compact-switch" role="group" aria-label="Language">
            {(Object.keys(guestCopy) as Array<keyof typeof guestCopy>).map((key) => (
              <button key={key} className={language === key ? "language active" : "language"} onClick={() => setLanguage(key)}>
                {guestCopy[key].label}
              </button>
            ))}
          </div>
          <button className="capture-save" disabled={text.trim().length < 3 || busy} onClick={submit}>
            <span>{busy ? "INTERPRETING LOCALLY" : "REVIEW NOTE"}</span>
            <b>→</b>
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
          <div className="review-step"><span>01</span><p className="eyebrow">SOURCE · {observation.source.toUpperCase()}</p></div>
          <h1 className="screen-title">What the guest actually said.</h1>
          <blockquote className="source-quote">“{observation.rawText}”</blockquote>
          <p className="microcopy">Nothing below replaces the original words. Tap any signal to correct the model before it enters memory.</p>
        </div>
        <div className="review-panel">
          <div className="interpret-proof">
            <div><strong>~240 KB</strong><span>learned weights</span></div>
            <div><strong>0</strong><span>network inference</span></div>
            <div><strong>LOCAL</strong><span>on this device</span></div>
          </div>
          <div className="panel-head"><span><b>02</b> INTERPRETED LOCALLY</span><span>{observation.predictions[0]?.engine ?? "guestbook-micro-v1"}</span></div>
          <div className="prediction-list">
            {observation.predictions.map((prediction, index) => (
              <button key={prediction.label} className={selected.has(prediction.label) ? "prediction selected signal-reveal" : "prediction signal-reveal"} onClick={() => toggle(prediction.label)}>
                <span className="prediction-index">{String(index + 1).padStart(2, "0")}</span>
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
  const featured = memory.find((signal) => signal.label === "WANT_PRODUCT" && signal.visitCount >= 5) ?? memory[0] ?? null;
  const archive = featured ? memory.filter((signal) => signal.label !== featured.label) : memory;

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

      {featured && (
        <section className="memory-feature">
          <div className="memory-feature-meta">
            <span>REPEATING SIGNAL</span>
            <span>{featured.observations.length} SOURCE RECORDS</span>
          </div>
          <div className="memory-feature-grid">
            <div className="memory-feature-count">
              {previousCounts[featured.label] !== undefined && featured.visitCount > previousCounts[featured.label] ? (
                <strong className="feature-count-change">
                  <i>{previousCounts[featured.label]}</i>
                  <b>→</b>
                  {featured.visitCount}
                </strong>
              ) : (
                <strong>{featured.visitCount}</strong>
              )}
              <span>independent visits</span>
            </div>
            <div className="memory-feature-copy">
              <h2>{featured.title}</h2>
              <p>{featured.description}</p>
            </div>
          </div>

          <div className="feature-evidence">
            <div className="feature-evidence-head">
              <span>SOURCE EVIDENCE</span>
              <span>ORIGINAL WORDS · NOT GENERATED</span>
            </div>
            {featured.observations.slice(0, expanded === featured.label ? featured.observations.length : 3).map((obs, index) => (
              <article key={obs.id} className="feature-evidence-row">
                <div className="evidence-meta">
                  <strong>{String(index + 1).padStart(2, "0")}</strong>
                  <span>{obs.language.toUpperCase()}</span>
                  <span>{obs.isDemo ? "DEMO VISIT" : obs.source.toUpperCase()}</span>
                </div>
                <blockquote>“{obs.rawText}”</blockquote>
              </article>
            ))}
            {featured.observations.length > 3 && (
              <button className="ledger-link feature-more" onClick={() => setExpanded(expanded === featured.label ? null : featured.label)}>
                {expanded === featured.label ? "Show less evidence ↑" : "Show " + (featured.observations.length - 3) + " more sources ↓"}
              </button>
            )}
          </div>
        </section>
      )}

      {archive.length > 0 && (
        <section className="memory-archive">
          <div className="archive-head">
            <span>OTHER SIGNALS</span>
            <span>{archive.length} IN MEMORY</span>
          </div>
          {archive.map((signal, index) => (
            <article key={signal.label} className="archive-row">
              <div className="archive-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="archive-copy">
                <h3>{signal.title}</h3>
                <p>{signal.description}</p>
              </div>
              <div className="archive-count"><strong>{signal.visitCount}</strong><span>visits</span></div>
              <button className="archive-open" onClick={() => setExpanded(expanded === signal.label ? null : signal.label)}>
                {expanded === signal.label ? "Close" : "Sources"}
              </button>
              {expanded === signal.label && (
                <div className="archive-evidence">
                  {signal.observations.map((obs) => (
                    <div key={obs.id} className="evidence-item">
                      <span>{obs.language.toUpperCase()} · {obs.isDemo ? "DEMO VISIT" : obs.source.toUpperCase()}</span>
                      <p>“{obs.rawText}”</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

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

  const featured = signals.find((signal) => signal.label === "WANT_PRODUCT") ?? signals[0] ?? null;
  const rest = featured ? signals.filter((signal) => signal.label !== featured.label) : signals;

  return (
    <Shell operator>
      <section className="decision-intro">
        <p className="eyebrow">DECISION LAYER · HUMAN CONTROL</p>
        <h1>Evidence, not autopilot.</h1>
        <p>Guestbook does not decide what the business should become. It shows what keeps happening, links it to the source, and stops there.</p>
      </section>

      {featured && (() => {
        const copy = decisionCopy(featured);
        return (
          <section className="decision-conclusion">
            <div className="conclusion-topline">
              <span>STRONGEST REPEATING SIGNAL</span>
              <span>{featured.visitCount} INDEPENDENT VISITS</span>
            </div>
            <div className="conclusion-grid">
              <div className="conclusion-count"><strong>{featured.visitCount}</strong><span>pieces of confirmed evidence</span></div>
              <div className="conclusion-copy">
                <p className="conclusion-kicker">PEOPLE KEEP ASKING.</p>
                <h2>{copy.headline}</h2>
                <p className="decision-proof">Not a prediction. Not a generated recommendation. {featured.visitCount} source-backed observations.</p>
                <p>{copy.body}</p>
                <div className="decision-buttons">
                  {["Explore","Not now","Wrong signal"].map((option) => (
                    <button key={option} className={decisions[featured.label] === option ? "decision active" : "decision"} onClick={() => decide(featured.label, option)}>{option}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="conclusion-sources">
              {featured.observations.slice(0, 3).map((obs) => (
                <blockquote key={obs.id}>“{obs.rawText}”</blockquote>
              ))}
            </div>
          </section>
        );
      })()}

      {rest.length > 0 && (
        <section className="decision-secondary">
          <div className="archive-head"><span>OTHER DECISIONS</span><span>{rest.length} READY FOR REVIEW</span></div>
          {rest.map((signal) => {
            const copy = decisionCopy(signal);
            return (
              <article className="decision-row" key={signal.label}>
                <div><span className="decision-count">{signal.visitCount} visits</span><h3>{copy.headline}</h3></div>
                <div><p>{copy.body}</p><div className="decision-buttons">
                  {["Explore","Not now","Wrong signal"].map((option) => (
                    <button key={option} className={decisions[signal.label] === option ? "decision active" : "decision"} onClick={() => decide(signal.label, option)}>{option}</button>
                  ))}
                </div></div>
              </article>
            );
          })}
        </section>
      )}

      <button className="quiet-link back-link" onClick={() => go("/memory")}>← Back to evidence</button>
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
