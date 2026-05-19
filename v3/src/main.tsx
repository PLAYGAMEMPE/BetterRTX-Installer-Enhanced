import React from "react";
import ReactDOM from "react-dom/client";
import { MemoizedApp as App } from "./components/App";
import "@fontsource-variable/martian-mono";
import "./styles.css";
import "./i18n";

// Mount React app
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
