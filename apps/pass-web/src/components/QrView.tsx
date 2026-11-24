import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  isPermanentPass,
  passAction,
  PASS_ACTION_LABEL,
  passTicketState,
  type PassQrResponse,
  type PublicPassPreview,
} from '@porteria/shared';
import { ApiError, acceptConsent, getQr, getStatus } from '../api';
import { formatDateTime, formatRemaining, formatTime } from '../lib/format';
import { TICKET_TONE_BACKGROUNDS, TICKET_TONE_TEXT } from '../lib/ticket-tone';

interface QrViewProps {
  token: string;
  preview: PublicPassPreview;
  onExit: (code: string) => void;
}

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
  // El aviso se acepta una vez por pase. Mientras no esté aceptado no se pide
  // el QR: mostrar el código sin la autorización registrada dejaría el acceso
  // sin prueba de consentimiento.
  const [consentAccepted, setConsentAccepted] = useState(preview.consent.accepted);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
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
      if (error instanceof ApiError) {
        // El servidor es la autoridad: si el consentimiento falta, se pide acá
        // aunque la vista previa lo diera por aceptado.
        if (error.code === 'consent_required') setConsentAccepted(false);
        else onExitRef.current(error.code);
      } else {
        onExitRef.current('request_failed');
      }
    }
  }, [token]);

  const handleAcceptConsent = useCallback(async () => {
    setAccepting(true);
    setConsentError(null);
    try {
      await acceptConsent(token);
      setConsentAccepted(true);
    } catch {
      setConsentError('No se pudo registrar la autorización. Intenta de nuevo.');
    } finally {
      setAccepting(false);
    }
  }, [token]);

  useEffect(() => {
    if (!consentAccepted) return;
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
  }, [consentAccepted, refreshQr, token]);

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

        {consentAccepted ? (
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
        ) : (
          <div className="consent">
            <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Antes de mostrar el QR</h2>
            <p className="lead" style={{ marginTop: 0 }}>
              Para controlar el acceso, la portería registra tu nombre y tu documento. La comunidad
              conserva esos datos durante el plazo de su política y después reemplaza la identidad
              por un valor anónimo: el registro del ingreso permanece, tus datos personales no.
            </p>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => setConsentChecked(event.target.checked)}
              />
              <span>
                He leído el aviso y autorizo el tratamiento de mis datos para controlar el acceso.
              </span>
            </label>
            <details className="consent-notice">
              <summary>Leer el aviso completo</summary>
              <p>
                En este acceso se registran tu nombre y tu documento para controlar la entrada y
                atender incidentes. El documento se anonimiza pasados los días que defina la
                comunidad y tu nombre queda en la constancia del residente que autorizó la visita.
                Puedes pedir el aviso completo en la portería o a quien autorizó tu visita, y
                ejercer tus derechos ante la administración de la comunidad.
              </p>
            </details>
            {consentError && <p className="error">{consentError}</p>}
            <button
              className="primary"
              type="button"
              disabled={!consentChecked || accepting}
              onClick={() => void handleAcceptConsent()}
            >
              {accepting ? 'Registrando…' : 'Aceptar y mostrar el QR'}
            </button>
            <p className="hint">
              Puedes pedir el aviso completo en la portería o a quien autorizó tu visita.
            </p>
          </div>
        )}

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

        {consentAccepted && (
          <p className="hint">
            Muestra este QR en la portería. Se renueva automáticamente cada{' '}
            {qr?.expiresInSeconds ?? 24} segundos.
          </p>
        )}
        <a className="secondary-link" href="/p/mis-pases">
          Mis pases
        </a>
      </section>
    </main>
  );
}
