import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { requestPersistentStorage } from "./storage/persistence";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

requestPersistentStorage();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
