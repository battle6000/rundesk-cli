import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { bootstrapToken } from "./lib/token";
import "./index.css";

// Before anything renders, so the key is out of the address bar by the time the first
// frame is painted and no component ever has to know it was there.
bootstrapToken();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
