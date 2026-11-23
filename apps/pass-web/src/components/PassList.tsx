import { useEffect, useState } from 'react';
import type { DevicePassEntry } from '@porteria/shared';
import { ApiError, getPasses } from '../api';
import { messageFor } from '../lib/messages';
import { TICKET_TONE_BACKGROUNDS } from '../lib/ticket-tone';

function PassRow({ entry }: { entry: DevicePassEntry }) {
  const content = (
    <>
      <p className="pass-item-destination">{entry.locationPath}</p>
      <p className="pass-item-community">{entry.communityName}</p>
      <p className="pass-item-state">
        <span
          className="pass-state-dot"
          aria-hidden="true"
          style={{ background: TICKET_TONE_BACKGROUNDS[entry.ticket.tone] }}
        />
        {entry.ticket.label}
      </p>
      <p className="pass-item-detail">{entry.ticket.detail}</p>
      <p className="pass-item-holder">Titular: {entry.visitorFirstName}</p>
    </>
  );

  if (!entry.actionable) {
    return (
      <li>
        <div className="pass-item pass-item-history">
          {content}
          <span className="pass-item-cta">Historial</span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <a className="pass-item pass-item-actionable" href={`/p/${encodeURIComponent(entry.token)}`}>
        {content}
        <span className="pass-item-cta">Ver QR →</span>
      </a>
    </li>
  );
}

export function PassList() {
  const [passes, setPasses] = useState<DevicePassEntry[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await getPasses();
        if (!cancelled) setPasses(data.passes);
      } catch (error) {
        if (!cancelled) setErrorCode(error instanceof ApiError ? error.code : 'request_failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (errorCode) {
    return (
      <main className="page">
        <section className="card">
          <p className="eyebrow">Mis pases</p>
          <h1>Algo salió mal</h1>
          <p className="lead">{messageFor(errorCode)}</p>
          <button className="primary" type="button" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Pase de visita</p>
        <h1>Mis pases</h1>

        {passes === null && (
          <div className="loading-card">
            <span className="spinner" aria-hidden="true" />
            <p className="lead">Cargando tus pases…</p>
          </div>
        )}

        {passes !== null && passes.length === 0 && (
          <p className="lead">
            Todavía no hay pases en este dispositivo. Abre el link que te compartieron y aparecerá
            aquí.
          </p>
        )}

        {passes !== null && passes.length > 0 && (
          <>
            <p className="lead">Elige un pase para mostrar su QR.</p>
            <ul className="pass-list">
              {passes.map((entry) => (
                <PassRow key={entry.passId} entry={entry} />
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
