interface CallingScreenProps {
  onCancel: () => void;
}

export function CallingScreen({ onCancel }: CallingScreenProps) {
  return (
    <div className="screen active" id="screen-calling">
      <div className="calling-animation">
        <svg viewBox="0 0 24 24">
          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
        </svg>
      </div>
      <div className="calling-title">CONECTANDO…</div>
      <div className="calling-sub">Aguarde, comunicando con portería</div>
      <button className="btn-cancel" onClick={onCancel}>
        CANCELAR
      </button>
    </div>
  );
}
