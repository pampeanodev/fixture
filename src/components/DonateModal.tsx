import { useState } from "react";
import { QRDisplay } from "./QRDisplay";
import "./DonateModal.css";

interface DonateModalProps {
  lightningAddress: string;
  onClose: () => void;
}

export function DonateModal({ lightningAddress, onClose }: DonateModalProps) {
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
          <h2>⚡ Apoyar el proyecto</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-section">
          <p className="donate-intro">
            Si el proyecto te sirve, podés dejar un tip con cualquier wallet Lightning.
          </p>

          <div className="donate-address">
            <code className="donate-address-text">{lightningAddress}</code>
            <button className="modal-btn" onClick={handleCopy}>
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          <div className="qr-display">
            <QRDisplay value={`lightning:${lightningAddress}`} size={220} />
          </div>

          <p className="donate-help">
            Escaneá el QR con tu wallet, o pegá la dirección en el campo "Send".
            También funciona como zap desde cualquier cliente Nostr.
          </p>
        </div>
      </div>
    </div>
  );
}
