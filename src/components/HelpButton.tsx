import "./HelpButton.css";

interface HelpButtonProps {
  onStart: () => void;
}

export function HelpButton({ onStart }: HelpButtonProps) {
  return (
    <button
      className="help-fab"
      data-tour="help-button"
      aria-label="Abrir tour de ayuda"
      title="Tour de esta pantalla"
      onClick={onStart}
    >
      ?
    </button>
  );
}
