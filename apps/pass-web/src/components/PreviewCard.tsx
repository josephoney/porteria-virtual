import type { PublicPassPreview } from '@porteria/shared';
import { formatDateTime, formatTime } from '../lib/format';

interface PreviewCardProps {
  preview: PublicPassPreview;
  busy: boolean;
  error: string | null;
  onBind: () => void;
}

export function PreviewCard({ preview, busy, error, onBind }: PreviewCardProps) {
  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">{preview.communityName}</p>
        <h1>Pase de visita</h1>
        <p className="lead">
          Hola, {preview.visitorFirstName}. Este pase te permite ingresar a {preview.locationPath}.
        </p>

        <dl className="details">
          <div>
            <dt>Documento</dt>
            <dd>{preview.maskedDocument}</dd>
          </div>
          <div>
            <dt>Válido desde</dt>
            <dd>{formatDateTime(preview.validFrom)}</dd>
          </div>
          <div>
            <dt>Válido hasta</dt>
            <dd>{formatDateTime(preview.validUntil)}</dd>
          </div>
          {preview.timeFrom && preview.timeTo && (
            <div>
              <dt>Horario</dt>
              <dd>
                {formatTime(preview.timeFrom)}–{formatTime(preview.timeTo)}
              </dd>
            </div>
          )}
          {preview.vehiclePlate && (
            <div>
              <dt>Vehículo</dt>
              <dd>{preview.vehiclePlate}</dd>
            </div>
          )}
        </dl>

        {error && <p className="error">{error}</p>}

        <button className="primary" type="button" onClick={onBind} disabled={busy}>
          {busy ? 'Vinculando…' : 'Mostrar mi QR'}
        </button>
        <p className="hint">
          Este link se vincula a este dispositivo. Si lo abrís en otro, no va a funcionar.
        </p>
      </section>
    </main>
  );
}
