import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { QRDisplay } from "./QRDisplay";
import "./AccountModal.css";

interface AccountModalProps {
  onClose: () => void;
}

export function AccountModal({ onClose }: AccountModalProps) {
  const { exportIdentity } = useNostr();
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
          <h2>Mi cuenta</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-note">
          Tu identidad vive en este browser. Si compartís la computadora con otra persona, usá modo incógnito o un perfil separado — sino van a ver (y poder modificar) tus predicciones y salas.
        </div>
        <div className="modal-section">
          <h3>Seed phrase</h3>
          <p className="modal-warning">No la compartas con nadie. Quien tenga estas palabras puede acceder a tu identidad.</p>
          {showSeed ? (
            <div className="seed-display">
              <code className="seed-words">{exported.mnemonic}</code>
              <button className="modal-btn" onClick={handleCopy}>
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          ) : (
            <button className="modal-btn" onClick={() => setShowSeed(true)}>
              Mostrar seed phrase
            </button>
          )}
        </div>
        <div className="modal-section">
          <h3>QR code</h3>
          <p className="modal-warning">Este QR contiene tu clave privada. Solo usalo para migrar a otro dispositivo.</p>
          {showQR ? (
            <div className="qr-display">
              <QRDisplay value={exported.nsec} size={200} />
            </div>
          ) : (
            <button className="modal-btn" onClick={() => setShowQR(true)}>
              Mostrar QR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
