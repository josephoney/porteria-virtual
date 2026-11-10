import { useState } from 'react';
import type { PublicPassPreview } from '@porteria/shared';

interface PinFormProps {
  preview: PublicPassPreview;
  busy: boolean;
  error: string | null;
  locked: boolean;
  onSubmit: (pin: string) => void;
}

export function PinForm({ preview, busy, error, locked, onSubmit }: PinFormProps) {
  const [pin, setPin] = useState('');

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">{preview.communityName}</p>
        <h1>Ingresá el PIN</h1>
        <p className="lead">El residente te compartió un PIN de 4 dígitos para abrir este pase.</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (pin.length === 4 && !locked) onSubmit(pin);
          }}
        >
          <input
            className="pin-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            autoFocus
            aria-label="PIN de 4 dígitos"
            disabled={busy || locked}
          />

          {error && <p className="error">{error}</p>}

          <button className="primary" type="submit" disabled={busy || locked || pin.length !== 4}>
            {busy ? 'Verificando…' : 'Continuar'}
          </button>
        </form>

        <p className="hint">Si no tenés el PIN, pedile al residente que te lo comparta de nuevo.</p>
      </section>
    </main>
  );
}
