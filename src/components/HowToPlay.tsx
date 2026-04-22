import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../i18n";
import { useFixture } from "../context/FixtureContext";
import { renderInlineEmphasis } from "../i18n/inlineEmphasis";
import { Illustration } from "./howToPlay/illustrations";
import { individualSteps, roomSteps, type Step } from "./howToPlay/steps";
import "./HowToPlay.css";

type Mode = "individual" | "room";

type WizardState =
  | { screen: "mode-select" }
  | { screen: "wizard"; mode: Mode; stepIndex: number };

interface HowToPlayProps {
  onClose: () => void;
}

function stepsFor(mode: Mode): readonly Step[] {
  return mode === "individual" ? individualSteps : roomSteps;
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  const { t } = useLocale();
  const { dispatch } = useFixture();
  const [state, setState] = useState<WizardState>({ screen: "mode-select" });

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.screen === "mode-select") return prev;
      if (prev.stepIndex === 0) return { screen: "mode-select" };
      return { ...prev, stepIndex: prev.stepIndex - 1 };
    });
  }, []);

  const goNext = useCallback(() => {
    setState((prev) => {
      if (prev.screen === "mode-select") return prev;
      const total = stepsFor(prev.mode).length;
      if (prev.stepIndex >= total - 1) return prev;
      return { ...prev, stepIndex: prev.stepIndex + 1 };
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goBack();
      else if (e.key === "ArrowRight") goNext();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goBack, goNext, onClose]);

  function pickMode(mode: Mode) {
    setState({ screen: "wizard", mode, stepIndex: 0 });
  }

  function goToRooms() {
    dispatch({ type: "SET_VIEW", view: { type: "rooms" } });
    onClose();
  }

  const isWizard = state.screen === "wizard";
  const currentStep = isWizard ? stepsFor(state.mode)[state.stepIndex] : null;
  const total = isWizard ? stepsFor(state.mode).length : 0;
  const isLastStep = isWizard && state.stepIndex === total - 1;
  const isIndividualCta = isWizard && state.mode === "individual" && isLastStep;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="htp-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="htp-modal-header">
          <h2>{currentStep ? t(currentStep.titleKey) : t("howToPlay.modeSelect.title")}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t("howToPlay.nav.close")}>
            &times;
          </button>
        </div>

        <div className="htp-modal-body">
          {!isWizard ? (
            <>
              <p className="htp-modal-subtitle">{t("howToPlay.modeSelect.subtitle")}</p>
              <div className="htp-mode-grid">
                <button className="htp-mode-card" onClick={() => pickMode("individual")}>
                  <h3>{t("howToPlay.modeSelect.individualCard.title")}</h3>
                  <p>{t("howToPlay.modeSelect.individualCard.subtitle")}</p>
                </button>
                <button className="htp-mode-card" onClick={() => pickMode("room")}>
                  <h3>{t("howToPlay.modeSelect.roomCard.title")}</h3>
                  <p>{t("howToPlay.modeSelect.roomCard.subtitle")}</p>
                </button>
              </div>
            </>
          ) : (
            <>
              <Illustration id={currentStep!.illustration} />
              <div className="htp-step-body">
                <p>{renderInlineEmphasis(t(currentStep!.bodyKey))}</p>
              </div>
            </>
          )}
        </div>

        {isWizard && (
          <div className="htp-modal-footer">
            <button className="htp-btn" onClick={goBack}>{t("howToPlay.nav.back")}</button>
            <span className="htp-step-counter">
              {t("howToPlay.nav.stepCounter")
                .replace("{current}", String(state.stepIndex + 1))
                .replace("{total}", String(total))}
            </span>
            {isIndividualCta ? (
              <div className="htp-footer-actions">
                <button className="htp-btn" onClick={onClose}>{t("howToPlay.nav.close")}</button>
                <button className="htp-btn htp-btn-primary" onClick={goToRooms}>
                  {t("howToPlay.individual.ctaRooms")}
                </button>
              </div>
            ) : isLastStep ? (
              <button className="htp-btn htp-btn-primary" onClick={onClose}>
                {t("howToPlay.nav.done")}
              </button>
            ) : (
              <button className="htp-btn htp-btn-primary" onClick={goNext}>
                {t("howToPlay.nav.next")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
