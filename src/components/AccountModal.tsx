import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useLocale } from "../i18n";
import { QRDisplay } from "./QRDisplay";
import "./AccountModal.css";

interface AccountModalProps {
  onClose: () => void;
}

export function AccountModal({ onClose }: AccountModalProps) {
  const { exportIdentity } = useNostr();
  const { t } = useLocale();
  const exported = exportIdentity();
  const [showSeed, setShowSeed] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!exported) return null;

  function handleCopy() {
    navigator.clipboard.writeText(exported!.mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("account.title")}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-note">
          {t("account.note")}
        </div>
        <div className="modal-section">
          <h3>{t("account.seedSectionTitle")}</h3>
          <p className="modal-warning">{t("account.warning")}</p>
          {showSeed ? (
            <div className="seed-display">
              <code className="seed-words">{exported.mnemonic}</code>
              <button className="modal-btn" onClick={handleCopy}>
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>
          ) : (
            <button className="modal-btn" onClick={() => setShowSeed(true)}>
              {t("account.showSeed")}
            </button>
          )}
        </div>
        <div className="modal-section">
          <h3>{t("account.qrTitle")}</h3>
          <p className="modal-warning">{t("account.qrWarning")}</p>
          {showQR ? (
            <div className="qr-display">
              <QRDisplay value={exported.nsec} size={200} />
            </div>
          ) : (
            <button className="modal-btn" onClick={() => setShowQR(true)}>
              {t("account.showQR")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
