import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FixtureProvider } from "./context/FixtureContext";
import { NostrProvider } from "./context/NostrContext";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NostrProvider>
      <FixtureProvider>
        <App />
      </FixtureProvider>
    </NostrProvider>
  </StrictMode>
);
