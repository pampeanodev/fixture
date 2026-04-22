import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import { useLocale } from "../i18n";
import "./Onboarding.css";

export function Onboarding() {
  const { setupIdentity, restoreIdentityFromMnemonic } = useNostr();
  const { dispatch } = useFixture();
  const { t } = useLocale();
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
      setError(t("onboarding.invalidMnemonic"));
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <h1>{t("onboarding.title")}</h1>
        <p>{t("onboarding.subtitle")}</p>
        <input
          type="text"
          placeholder={t("onboarding.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="onboarding-input"
        />
        {!restoreMode ? (
          <>
            <button className="onboarding-btn primary" onClick={handleCreate} disabled={!name.trim()}>
              {t("onboarding.createButton")}
            </button>
            <button className="onboarding-btn secondary" onClick={() => setRestoreMode(true)}>
              {t("onboarding.restoreCta")}
            </button>
          </>
        ) : (
          <>
            <textarea
              placeholder={t("onboarding.restoreTextarea")}
              value={mnemonic}
              onChange={(e) => { setMnemonic(e.target.value); setError(""); }}
              className="onboarding-textarea"
              rows={3}
            />
            {error && <p className="onboarding-error">{error}</p>}
            <button className="onboarding-btn primary" onClick={handleRestore} disabled={!mnemonic.trim()}>
              {t("onboarding.restoreButton")}
            </button>
            <button className="onboarding-btn secondary" onClick={() => setRestoreMode(false)}>
              {t("onboarding.backButton")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
