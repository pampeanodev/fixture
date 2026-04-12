import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FixtureProvider } from "./context/FixtureContext";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FixtureProvider>
      <App />
    </FixtureProvider>
  </StrictMode>
);
