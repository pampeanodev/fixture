import { useState } from "react";
import { useLocale } from "../i18n";
import { CafecitoButton } from "./CafecitoButton";
import { QRDisplay } from "./QRDisplay";
import "./DonateModal.css";

interface DonateModalProps {
  lightningAddress: string;
  cafecitoUsername: string;
  onClose: () => void;
}

export function DonateModal({ lightningAddress, cafecitoUsername, onClose }: DonateModalProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(lightningAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("donate.title")}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-section">
          <p className="donate-intro">
            {t("donate.intro")}
          </p>

          <div className="donate-method">
            <h3 className="donate-method-label">{t("donate.cafecitoSection")}</h3>
            <div className="donate-cafecito">
              <CafecitoButton
                username={cafecitoUsername}
                label={t("donate.cafecitoCta")}
              />
            </div>
          </div>

          <div className="donate-divider" role="separator" aria-orientation="horizontal">
            <span>{t("donate.or")}</span>
          </div>

          <div className="donate-method">
            <h3 className="donate-method-label">{t("donate.lightningSection")}</h3>
            <div className="donate-address">
              <code className="donate-address-text">{lightningAddress}</code>
              <button className="modal-btn" onClick={handleCopy}>
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>

            <div className="qr-display">
              <QRDisplay value={`lightning:${lightningAddress}`} size={220} />
            </div>

            <p className="donate-help">
              {t("donate.help")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
