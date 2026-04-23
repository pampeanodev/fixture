import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "./i18n";
import { FixtureProvider } from "./context/FixtureContext";
import { NostrProvider } from "./context/NostrContext";
import App from "./App";
import "./styles/tokens.css";
import "./styles/modal.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <NostrProvider>
        <FixtureProvider>
          <App />
        </FixtureProvider>
      </NostrProvider>
    </LocaleProvider>
  </StrictMode>
);
