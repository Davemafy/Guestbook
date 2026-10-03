import { useMemo, useState } from "react";
import { activeClassifier } from "./ai/classifier";
import type { Prediction } from "./domain/observation";
import { LABELS, type SignalLabel } from "./domain/labels";

function currentRoute() {
  return window.location.pathname;
}

export default function App() {
  const route = useMemo(currentRoute, []);
  if (route === "/lab") return <Lab />;
  return <Home />;
}

function Home() {
  return (
    <main className="page home">
      <header className="topbar">
        <strong>GUESTBOOK</strong>
        <span className={navigator.onLine ? "status online" : "status"}>{navigator.onLine ? "ONLINE" : "OFFLINE"}</span>
      </header>
      <section className="hero">
        <p className="eyebrow">SMALL AI · TOURISM</p>
        <h1>Every visit teaches the business.</h1>
        <p className="lede">Guestbook turns messy visitor comments into structured, inspectable business memory—locally, without cloud AI.</p>
        <a className="primary" href="/lab">Open model lab</a>
      </section>
      <footer>AI interprets. Evidence accumulates. Humans decide.</footer>
    </main>
  );
}

function Lab() {
  const [text, setText] = useState("The coffee roasting was amazing, my mother struggled with the steep walk, and can we buy beans afterward?");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [groundTruth, setGroundTruth] = useState<SignalLabel[]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function run() {
    const started = performance.now();
    const result = await activeClassifier.classify(text);
    setElapsed(performance.now() - started);
    setPredictions(result);
  }

  function toggleTruth(label: SignalLabel) {
    setGroundTruth((current) =>
      current.includes(label) ? current.filter((x) => x !== label) : [...current, label],
    );
  }

  return (
    <main className="page lab">
      <header className="topbar">
        <a href="/">GUESTBOOK</a>
        <span className={navigator.onLine ? "status online" : "status"}>{navigator.onLine ? "ONLINE" : "OFFLINE"}</span>
      </header>

      <section>
        <p className="eyebrow">MODEL LAB · BASELINE ONLY</p>
        <h1>Prove the hard part first.</h1>
        <p className="lede">This route is intentionally ugly and honest. The current engine is a deterministic keyword baseline. No trained fastText model or benchmark metrics are claimed yet.</p>
      </section>

      <section className="panel">
        <label htmlFor="observation">Observation</label>
        <textarea id="observation" value={text} onChange={(e) => setText(e.target.value)} rows={5} />
        <button className="primary" onClick={run}>Run baseline</button>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Predictions</h2>
          <span>{elapsed === null ? "not run" : elapsed.toFixed(2) + " ms"}</span>
        </div>
        {predictions.length === 0 ? <p className="muted">Run an observation.</p> : (
          <div className="signals">
            {predictions.map((p) => (
              <div className="signal" key={p.label}>
                <span>{p.label}</span>
                <small>{p.engine}{p.score === null ? "" : " · " + p.score.toFixed(3)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Ground truth</h2>
        <p className="muted">Manual labels for case-by-case checking. These are not persisted as benchmark results yet.</p>
        <div className="label-grid">
          {LABELS.map((label) => (
            <button
              key={label}
              className={groundTruth.includes(label) ? "label active" : "label"}
              onClick={() => toggleTruth(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="proof">
        <div><span>engine</span><strong>{activeClassifier.name}</strong></div>
        <div><span>trained model</span><strong>not yet</strong></div>
        <div><span>benchmark</span><strong>not yet</strong></div>
        <div><span>network state</span><strong>{navigator.onLine ? "online" : "offline"}</strong></div>
      </section>
    </main>
  );
}
