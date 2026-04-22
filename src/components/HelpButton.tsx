import { useLocale } from "../i18n";
import "./HelpButton.css";

interface HelpButtonProps {
  onStart: () => void;
}

export function HelpButton({ onStart }: HelpButtonProps) {
  const { t } = useLocale();
  return (
    <button
      className="help-fab"
      data-tour="help-button"
      aria-label={t("common.helpAria")}
      title={t("common.helpTitle")}
      onClick={onStart}
    >
      ?
    </button>
  );
}
