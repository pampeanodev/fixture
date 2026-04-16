import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import "./Onboarding.css";

export function Onboarding() {
  const { setupIdentity, restoreIdentityFromMnemonic } = useNostr();
  const { dispatch } = useFixture();
  const [name, setName] = useState("");
  const [restoreMode, setRestoreMode] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    setupIdentity();
    dispatch({ type: "SET_PLAYER_NAME", name: name.trim() });
  }

  function handleRestore() {
    if (!mnemonic.trim()) return;
    try {
      restoreIdentityFromMnemonic(mnemonic.trim());
      if (name.trim()) dispatch({ type: "SET_PLAYER_NAME", name: name.trim() });
    } catch {
      setError("Seed phrase invalida. Verifica las 12 palabras.");
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <h1>Mundial 2026</h1>
        <p>Competi con tus amigos prediciendo resultados.</p>
        <input
          type="text"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="onboarding-input"
        />
        {!restoreMode ? (
          <>
            <button className="onboarding-btn primary" onClick={handleCreate} disabled={!name.trim()}>
              Empezar
            </button>
            <button className="onboarding-btn secondary" onClick={() => setRestoreMode(true)}>
              Ya tengo cuenta
            </button>
          </>
        ) : (
          <>
            <textarea
              placeholder="Escribi tus 12 palabras separadas por espacios"
              value={mnemonic}
              onChange={(e) => { setMnemonic(e.target.value); setError(""); }}
              className="onboarding-textarea"
              rows={3}
            />
            {error && <p className="onboarding-error">{error}</p>}
            <button className="onboarding-btn primary" onClick={handleRestore} disabled={!mnemonic.trim()}>
              Restaurar
            </button>
            <button className="onboarding-btn secondary" onClick={() => setRestoreMode(false)}>
              Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}
