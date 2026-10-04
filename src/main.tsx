import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { requestPersistentStorage } from "./storage/persistence";

const CHUNK_RECOVERY_KEY = "guestbook-chunk-recovered";

async function recoverFromStaleChunk(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  const staleChunk =
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("ChunkLoadError");

  if (!staleChunk || sessionStorage.getItem(CHUNK_RECOVERY_KEY) === "1") return;

  sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("guestbook-shell-")).map((key) => caches.delete(key)));
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
  } finally {
    window.location.reload();
  }
}

window.addEventListener("unhandledrejection", (event) => {
  void recoverFromStaleChunk(event.reason);
});

window.addEventListener("error", (event) => {
  void recoverFromStaleChunk(event.error ?? event.message);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      await registration.update();

      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch {
      // Guestbook still runs online if service-worker registration fails.
    }
  });
}

requestPersistentStorage();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
