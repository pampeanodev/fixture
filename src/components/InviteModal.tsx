import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useLocale } from "../i18n";
import { QRDisplay } from "./QRDisplay";
import "./InviteModal.css";

interface InviteModalProps {
  roomId: string;
  onClose: () => void;
}

export function InviteModal({ roomId, onClose }: InviteModalProps) {
  const { createInvite, rooms } = useNostr();
  const { t } = useLocale();
  const room = rooms.find((r) => r.roomId === roomId);
  const isCreator = room?.role === "creator";
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;
  const openLink = `${baseUrl}/r/${roomId}`;
  const inviteLink = inviteCode ? `${baseUrl}/r/${roomId}?i=${inviteCode}` : null;
  const displayLink = inviteLink ?? openLink;

  function handleGenerate() {
    const code = createInvite(roomId);
    setInviteCode(code);
  }

  function handleCopy() {
    navigator.clipboard.writeText(displayLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("rooms.invite.title")}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        {isCreator && (
          <div className="modal-section">
            <button className="modal-btn" onClick={handleGenerate}>
              {t("rooms.invite.generateNew")}
            </button>
          </div>
        )}
        <div className="modal-section">
          <p className="invite-link-label">{t("rooms.invite.linkLabel")}</p>
          <code className="invite-link">{displayLink}</code>
          <button className="modal-btn" onClick={handleCopy}>
            {copied ? t("common.copied") : t("rooms.invite.copyLink")}
          </button>
        </div>
        <div className="modal-section invite-qr">
          <QRDisplay value={displayLink} size={200} />
        </div>
      </div>
    </div>
  );
}
