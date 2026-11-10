import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { PassQrResponse, PublicPassPreview } from '@porteria/shared';
import { ApiError, getQr, getStatus } from '../api';
import { formatDateTime, formatRemaining, formatTime } from '../lib/format';

interface QrViewProps {
  token: string;
  preview: PublicPassPreview;
  onExit: (code: string) => void;
}

function statusLabel(
  status: PublicPassPreview['status'],
  presence: PublicPassPreview['presenceState'],
): string {
  if (status === 'used') return 'Utilizado';
  if (status === 'revoked') return 'Revocado';
  if (status === 'expired') return 'Expirado';
  return presence === 'inside' ? 'Dentro' : 'Fuera';
}

export function QrView({ token, preview, onExit }: QrViewProps) {
  const [qr, setQr] = useState<PassQrResponse | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [presence, setPresence] = useState(preview.presenceState);
  const [status, setStatus] = useState(preview.status);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const refreshQr = useCallback(async () => {
    try {
      const next = await getQr(token);
      setQr(next);
    } catch (error) {
      if (error instanceof ApiError) onExitRef.current(error.code);
      else onExitRef.current('request_failed');
    }
  }, [token]);

  useEffect(() => {
    void refreshQr();
    const qrTimer = window.setInterval(() => {
      void refreshQr();
    }, 20_000);

    const statusTimer = window.setInterval(() => {
      void (async () => {
        try {
          const next = await getStatus(token);
          setPresence(next.presenceState);
          setStatus(next.status);
          if (next.status !== 'active') {
            onExitRef.current(next.status === 'used' ? 'pass_used' : next.status);
          }
        } catch (error) {
          if (error instanceof ApiError && error.code !== 'not_bound') {
            onExitRef.current(error.code);
          }
        }
      })();
    }, 5_000);

    return () => {
      window.clearInterval(qrTimer);
      window.clearInterval(statusTimer);
    };
  }, [refreshQr, token]);

  useEffect(() => {
    if (!qr) return;
    const update = () =>
      setSeconds(Math.max(0, Math.round((new Date(qr.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [qr]);

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">{preview.communityName}</p>
        <h1>{preview.visitorFirstName}</h1>
        <p className="muted">{preview.locationPath}</p>

        <div className="qr-box">
          {qr ? (
            <>
              <QRCodeSVG
                value={qr.token}
                size={280}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#0b1220"
              />
              <p className="hint">Se actualiza solo · {formatRemaining(seconds)}</p>
            </>
          ) : (
            <div className="qr-placeholder">
              <span className="spinner" aria-hidden="true" />
              <span>Generando QR…</span>
            </div>
          )}
        </div>

        <dl className="details">
          <div>
            <dt>Documento</dt>
            <dd>{preview.maskedDocument}</dd>
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
          <div>
            <dt>Estado</dt>
            <dd>{statusLabel(status, presence)}</dd>
          </div>
        </dl>

        <p className="hint">
          Mostrá este QR en la portería. Se renueva automáticamente cada 24 segundos.
        </p>
      </section>
    </main>
  );
}
