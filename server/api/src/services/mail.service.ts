import config from '../config.js';

export type MailFailureReason = 'mail_not_configured' | 'send_failed';

export interface SendInvitationEmailInput {
  to: string;
  acceptUrl: string;
  role: string;
  expiresAt: Date;
  communityName?: string | null;
}

export interface SendInvitationEmailResult {
  sent: boolean;
  reason?: MailFailureReason;
}

const DEFAULT_FROM_NAME = 'Portería Virtual';

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Administrador de la organización',
  community_admin: 'Administrador de comunidad',
  admin: 'Administrador',
  operator: 'Operador',
  guard: 'Guardia de seguridad',
  owner: 'Propietario',
  tenant: 'Arrendatario',
  resident: 'Residente',
  staff: 'Personal',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? 'Usuario';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiry(value: Date): string {
  try {
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

interface ParsedFrom {
  address: string;
  name: string;
}

function parseFrom(value: string): ParsedFrom | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(.*?)\s*<([^<>]+)>\s*$/);
  const address = (match?.[2] ?? trimmed).trim();
  let name = (match?.[1] ?? '').trim();

  if (
    (name.startsWith('"') && name.endsWith('"')) ||
    (name.startsWith("'") && name.endsWith("'"))
  ) {
    name = name.slice(1, -1).trim();
  }

  if (!address || !address.includes('@')) return null;

  return { address, name: name || DEFAULT_FROM_NAME };
}

function buildBodies(input: SendInvitationEmailInput) {
  const communityName = input.communityName?.trim();
  const productName = communityName || DEFAULT_FROM_NAME;
  const label = roleLabel(input.role);
  const expiry = formatExpiry(input.expiresAt);
  const subject = `Invitación a ${productName}`;

  const intro = communityName
    ? `Has recibido una invitación para unirte a ${escapeHtml(communityName)} como ${escapeHtml(label)}.`
    : `Has recibido una invitación para unirte a ${escapeHtml(DEFAULT_FROM_NAME)} como ${escapeHtml(label)}.`;

  const safeUrl = escapeHtml(input.acceptUrl);

  const htmlbody = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background-color:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">Invitación a ${escapeHtml(productName)}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${intro}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background-color:#111827;color:#ffffff;text-decoration:none;font-weight:600;">Aceptar invitación</a>
        </p>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#374151;">
          Esta invitación vence el ${escapeHtml(expiry)}.
        </p>
        <p style="margin:16px 0 8px;font-size:13px;line-height:1.6;color:#4b5563;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </p>
        <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#4b5563;word-break:break-all;font-family:Consolas,monospace;">${safeUrl}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
          Si no esperabas esta invitación, ignora este correo.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const textbody = [
    `Invitación a ${productName}`,
    '',
    communityName
      ? `Has recibido una invitación para unirte a ${communityName} como ${label}.`
      : `Has recibido una invitación para unirte a ${DEFAULT_FROM_NAME} como ${label}.`,
    '',
    'Acepta la invitación en el siguiente enlace:',
    input.acceptUrl,
    '',
    `Esta invitación vence el ${expiry}.`,
    '',
    'Si no esperabas esta invitación, ignora este correo.',
  ].join('\n');

  return { subject, htmlbody, textbody };
}

function redactForLog(value: unknown, secrets: string[]): string {
  let text = String(value ?? '');
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join('[redacted]');
  }
  return text;
}

async function readProviderError(response: Response, secrets: string[]): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) return 'empty response';
    try {
      const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
      if (parsed.error) {
        return {
          code: parsed.error.code,
          message: redactForLog(parsed.error.message, secrets),
        };
      }
      return 'unexpected response shape';
    } catch {
      // ZeptoMail devuelve HTML (o vacío) en algunos 5xx: sin el cuerpo es
      // imposible saber si fue un problema del remitente, del token o de la
      // región, así que se guarda un fragmento corto y redactado.
      return {
        contentType: response.headers.get('content-type') ?? 'unknown',
        body: redactForLog(text, secrets).replace(/\s+/g, ' ').trim().slice(0, 400),
      };
    }
  } catch {
    return 'unreadable response';
  }
}

function createTimeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(10_000);
  }
  return undefined;
}

export async function sendInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<SendInvitationEmailResult> {
  // El panel de ZeptoMail muestra el header completo, así que es fácil pegar
  // "Zoho-enczapikey <token>" en ZEPTOMAIL_TOKEN. Si el esquema viaja
  // duplicado, el gateway responde 500 sin cuerpo y no deja rastro del motivo.
  const token = config.mail.zeptomailToken
    .trim()
    .replace(/^Zoho-enczapikey\s+/i, '')
    .trim();
  const from = config.mail.from.trim();

  if (!token || !from) {
    return { sent: false, reason: 'mail_not_configured' };
  }

  const parsedFrom = parseFrom(from);
  if (!parsedFrom) {
    console.warn('[mail] MAIL_FROM is invalid; invitation email was not sent');
    return { sent: false, reason: 'mail_not_configured' };
  }

  const apiUrl = config.mail.zeptomailApiUrl.replace(/\/+$/, '');
  const { subject, htmlbody, textbody } = buildBodies(input);

  const payload = {
    from: parsedFrom,
    to: [{ email_address: { address: input.to } }],
    subject,
    htmlbody,
    textbody,
  };

  try {
    const response = await fetch(`${apiUrl}/v1.1/email`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-enczapikey ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: createTimeoutSignal(),
    });

    if (!response.ok) {
      const providerError = await readProviderError(response, [token, input.acceptUrl]);
      console.error('[mail] ZeptoMail rejected the invitation email', {
        status: response.status,
        providerError,
      });
      return { sent: false, reason: 'send_failed' };
    }

    return { sent: true };
  } catch (err) {
    console.error('[mail] ZeptoMail request failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: 'send_failed' };
  }
}

export interface SendPasswordResetEmailInput {
  to: string;
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
  /** `activation` reutiliza el cuerpo con asunto y copy de bienvenida. */
  purpose?: 'reset' | 'activation';
}

export interface SendAccountActivationEmailInput {
  to: string;
  firstName: string;
  activationUrl: string;
  expiresInMinutes: number;
}

/**
 * Cuerpo del correo de recuperación, con la misma tarjeta que la invitación.
 *
 * El texto se escribe acá en UTF-8 y el transporte declara el charset: sin eso,
 * los acentos llegan como caracteres rotos al buzón. La variante `activation`
 * reutiliza la tarjeta y cambia el asunto y el copy: la cuenta la creó un
 * administrador y la persona todavía no eligió contraseña.
 */
export function buildPasswordResetBodies(input: SendPasswordResetEmailInput) {
  const productName = DEFAULT_FROM_NAME;
  const activation = input.purpose === 'activation';
  const subject = activation
    ? `Activa tu cuenta · ${productName}`
    : `Recupera tu contraseña · ${productName}`;
  const heading = activation ? 'Activa tu cuenta' : 'Recupera tu contraseña';
  const safeUrl = escapeHtml(input.resetUrl);
  const safeName = escapeHtml(input.firstName);
  const intro = activation
    ? `Hola ${safeName}, un administrador creó una cuenta para ti. Define tu contraseña para empezar a usarla.`
    : `Hola ${safeName}, recibimos una solicitud para cambiar la contraseña de tu cuenta.`;
  const cta = activation ? 'Definir mi contraseña' : 'Definir contraseña nueva';
  const footer = activation
    ? 'Si no esperabas esta cuenta, ignora este correo: nadie puede ingresar hasta que definas una contraseña.'
    : 'Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando y no se cierra ninguna sesión.';

  const htmlbody = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background-color:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">${escapeHtml(productName)}</p>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${heading}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${intro}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background-color:#111827;color:#ffffff;text-decoration:none;font-weight:600;">${cta}</a>
        </p>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#374151;">
          El enlace vence en ${input.expiresInMinutes} minutos y sólo se puede usar una vez.
        </p>
        <p style="margin:16px 0 8px;font-size:13px;line-height:1.6;color:#4b5563;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </p>
        <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#4b5563;word-break:break-all;font-family:Consolas,monospace;">${safeUrl}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
          ${footer}
        </p>
      </div>
    </div>
  </body>
</html>`;

  const textbody = [
    `${heading} · ${productName}`,
    '',
    activation
      ? `Hola ${input.firstName}, un administrador creó una cuenta para ti. Define tu contraseña para empezar a usarla.`
      : `Hola ${input.firstName}, recibimos una solicitud para cambiar la contraseña de tu cuenta.`,
    '',
    activation
      ? 'Define tu contraseña en el siguiente enlace:'
      : 'Define una contraseña nueva en el siguiente enlace:',
    input.resetUrl,
    '',
    `El enlace vence en ${input.expiresInMinutes} minutos y sólo se puede usar una vez.`,
    '',
    footer,
  ].join('\n');

  return { subject, htmlbody, textbody };
}

interface DeliveryBodies {
  subject: string;
  htmlbody: string;
  textbody: string;
}

/**
 * Transporte compartido por los correos con enlace de un solo uso.
 *
 * El mismo gateway sirve para recuperación y activación: sólo cambia el cuerpo.
 */
async function deliverWithZeptoMail(input: {
  to: string;
  bodies: DeliveryBodies;
  secret: string;
  kind: 'password reset' | 'account activation';
}): Promise<SendInvitationEmailResult> {
  const token = config.mail.zeptomailToken
    .trim()
    .replace(/^Zoho-enczapikey\s+/i, '')
    .trim();
  const from = config.mail.from.trim();

  if (!token || !from) {
    return { sent: false, reason: 'mail_not_configured' };
  }

  const parsedFrom = parseFrom(from);
  if (!parsedFrom) {
    console.warn(`[mail] MAIL_FROM is invalid; ${input.kind} email was not sent`);
    return { sent: false, reason: 'mail_not_configured' };
  }

  const apiUrl = config.mail.zeptomailApiUrl.replace(/\/+$/, '');

  try {
    const response = await fetch(`${apiUrl}/v1.1/email`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-enczapikey ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        from: parsedFrom,
        to: [{ email_address: { address: input.to } }],
        ...input.bodies,
      }),
      signal: createTimeoutSignal(),
    });

    if (!response.ok) {
      const providerError = await readProviderError(response, [token, input.secret]);
      console.error(`[mail] ZeptoMail rejected the ${input.kind} email`, {
        status: response.status,
        providerError,
      });
      return { sent: false, reason: 'send_failed' };
    }

    return { sent: true };
  } catch (err) {
    console.error('[mail] ZeptoMail request failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: 'send_failed' };
  }
}

/** Envía el enlace de recuperación con el mismo transporte que la invitación. */
export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput,
): Promise<SendInvitationEmailResult> {
  return deliverWithZeptoMail({
    to: input.to,
    bodies: buildPasswordResetBodies(input),
    secret: input.resetUrl,
    kind: 'password reset',
  });
}

/** Envía el enlace de activación de una cuenta creada por el administrador. */
export async function sendAccountActivationEmail(
  input: SendAccountActivationEmailInput,
): Promise<SendInvitationEmailResult> {
  return deliverWithZeptoMail({
    to: input.to,
    bodies: buildPasswordResetBodies({
      to: input.to,
      firstName: input.firstName,
      resetUrl: input.activationUrl,
      expiresInMinutes: input.expiresInMinutes,
      purpose: 'activation',
    }),
    secret: input.activationUrl,
    kind: 'account activation',
  });
}
