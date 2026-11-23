import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  isPermanentPass,
  passAction,
  PASS_ACTION_LABEL,
  passTicketState,
  type PassQrResponse,
  type PassTicketTone,
  type PublicPassPreview,
} from '@porteria/shared';
import { ApiError, getQr, getStatus } from '../api';
import { formatDateTime, formatRemaining, formatTime } from '../lib/format';

interface QrViewProps {
  token: string;
  preview: PublicPassPreview;
  onExit: (code: string) => void;
}

const TICKET_TONE_BACKGROUNDS: Record<PassTicketTone, string> = {
  success: '#39C27F',
  warning: '#F2B84B',
  danger: '#F26D6D',
  neutral: '#E2E8F0',
};

const TICKET_TONE_TEXT: Record<PassTicketTone, string> = {
  success: '#081018',
  warning: '#081018',
  danger: '#081018',
  neutral: '#0B1220',
};

// El token se renueva al llegar a cero. El servidor acepta unos segundos de
// desfase, así que el QR que quedó en pantalla sigue sirviendo mientras llega
// el siguiente.
const QR_REFRESH_AT_SECONDS = 0;

export function QrView({ token, preview, onExit }: QrViewProps) {
  const [qr, setQr] = useState<PassQrResponse | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [presence, setPresence] = useState(preview.presenceState);
  const [status, setStatus] = useState(preview.status);
  const [exitCount, setExitCount] = useState(preview.exitCount);
  const [remainingUses, setRemainingUses] = useState(preview.remainingUses);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  // Momento de vencimiento medido con el reloj del dispositivo. Se recalcula
  // en cada respuesta a partir del TTL, no del `expiresAt` del servidor.
  const deadlineRef = useRef(0);

  const refreshQr = useCallback(async () => {
    try {
      const next = await getQr(token);
      deadlineRef.current = Date.now() + next.expiresInSeconds * 1000;
      setSeconds(next.expiresInSeconds);
      setQr(next);
    } catch (error) {
      if (error instanceof ApiError) onExitRef.current(error.code);
      else onExitRef.current('request_failed');
    }
  }, [token]);

  useEffect(() => {
    void refreshQr();

    const statusTimer = window.setInterval(() => {
      void (async () => {
        try {
          const next = await getStatus(token);
          setPresence(next.presenceState);
          setStatus(next.status);
          setExitCount(next.exitCount);
          setRemainingUses(next.remainingUses);
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
      window.clearInterval(statusTimer);
    };
  }, [refreshQr, token]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSeconds(remaining);
      // Se renueva al vencer, para que el conteo llegue a cero de verdad.
      if (deadlineRef.current > 0 && remaining <= QR_REFRESH_AT_SECONDS) {
        deadlineRef.current = 0;
        void refreshQr();
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [refreshQr]);

  const ticket = passTicketState({
    type: preview.type,
    status,
    presenceState: presence,
    recurrence: preview.recurrence,
    maxUses: preview.maxUses,
    exitCount,
    validUntil: preview.validUntil,
    rule: { remainingUses },
  });

  // Lo que hará este QR ahora: dejar entrar o dejar salir.
  const action = passAction({ type: preview.type, presenceState: presence });

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">{preview.communityName}</p>
        <h1>{preview.visitorFirstName}</h1>
        <p className="muted">{preview.locationPath}</p>

        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            margin: '12px 0 20px',
            padding: '14px 16px',
            borderRadius: 14,
            background: TICKET_TONE_BACKGROUNDS[ticket.tone],
            color: TICKET_TONE_TEXT[ticket.tone],
          }}
        >
          <span
            aria-hidden="true"
            style={{
              color: TICKET_TONE_TEXT[ticket.tone],
              fontSize: 22,
              lineHeight: '22px',
            }}
          >
            {ticket.icon}
          </span>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{ticket.label}</p>
            <p className="muted" style={{ margin: '2px 0 0', color: 'inherit', opacity: 0.78 }}>
              {ticket.detail}
            </p>
          </div>
        </div>

        <p
          style={{
            margin: '0 0 10px',
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {PASS_ACTION_LABEL[action]}
        </p>

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
            <dd>
              {isPermanentPass(preview.validUntil)
                ? 'Sin fecha de fin'
                : formatDateTime(preview.validUntil)}
            </dd>
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
          {preview.companionCount > 0 && (
            <div>
              <dt>Acompañantes</dt>
              <dd>{preview.companionCount}</dd>
            </div>
          )}
        </dl>

        <p className="hint">
          Muestra este QR en la portería. Se renueva automáticamente cada{' '}
          {qr?.expiresInSeconds ?? 24} segundos.
        </p>
      </section>
    </main>
  );
}
