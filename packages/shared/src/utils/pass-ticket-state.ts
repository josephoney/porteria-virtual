import type { PassStatus, PassType, PresenceState } from '../enums/index.js';
import type { PassRecurrence, PassRuleSummary } from '../types/pass.js';

export type PassTicketTone = 'success' | 'warning' | 'danger' | 'neutral';

export type PassTicketKind =
  | 'pending'
  | 'inside'
  | 'reentry'
  | 'exhausted'
  | 'used'
  | 'expired'
  | 'revoked';

export interface PassTicketState {
  kind: PassTicketKind;
  tone: PassTicketTone;
  label: string;
  detail: string;
  /** A glyph the UI can render next to the label without another dependency. */
  icon: string;
}

/** The fields the ticket needs; both the mobile detail and the public page have them. */
export interface PassTicketPass {
  type: PassType;
  status: PassStatus;
  presenceState: PresenceState;
  recurrence: PassRecurrence;
  maxUses: number;
  exitCount: number;
  validUntil: Date | string;
  rule?: Pick<PassRuleSummary, 'remainingUses'> | null;
}

/** What the current QR token does: it lets the holder in, or lets them out. */
export type PassAction = 'entry' | 'exit';

/**
 * A holder who is inside leaves, so the same pass flips from entry to exit
 * without issuing a new one.
 */
export function passAction(pass: Pick<PassTicketPass, 'type' | 'presenceState'>): PassAction {
  if (pass.presenceState === 'inside' && pass.type !== 'entry_only') return 'exit';
  return 'entry';
}

export const PASS_ACTION_LABEL: Record<PassAction, string> = {
  entry: 'Ingreso',
  exit: 'Salida',
};

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function remainingUses(pass: PassTicketPass) {
  if (pass.rule) return Math.max(0, pass.rule.remainingUses);
  if (pass.type === 'entry_only') return 1;
  // Without the server rule (older public payloads) this is the best estimate.
  return Math.max(0, pass.maxUses - pass.exitCount);
}

/**
 * The QR token rotates every few seconds; the pass state does not. This helper
 * derives what the holder should see from the pass itself, never from the token
 * or the local timer.
 */
export function passTicketState(pass: PassTicketPass, now = new Date()): PassTicketState {
  const until = pass.validUntil instanceof Date ? pass.validUntil : new Date(pass.validUntil);

  if (pass.status === 'revoked') {
    return {
      kind: 'revoked',
      tone: 'danger',
      label: 'Revocado',
      detail: 'Este pase fue revocado por el residente.',
      icon: '✕',
    };
  }

  if (pass.status === 'expired' || until.getTime() < now.getTime()) {
    return {
      kind: 'expired',
      tone: 'neutral',
      label: 'Vencido',
      detail: `Venció el ${formatDate(until)}.`,
      icon: '⌛',
    };
  }

  if (pass.status === 'used') {
    return {
      kind: 'used',
      tone: 'danger',
      label: 'Usado',
      detail: 'Este pase ya no se puede usar.',
      icon: '✓',
    };
  }

  if (pass.presenceState === 'inside') {
    return {
      kind: 'inside',
      tone: 'warning',
      label: 'Adentro · esperando salida',
      detail: 'El guardia debe registrar la salida para cerrar el uso.',
      icon: '•',
    };
  }

  const remaining = remainingUses(pass);

  if (pass.type === 'entry_only') {
    return {
      kind: 'pending',
      tone: 'success',
      label: 'Pendiente de ingreso',
      detail: 'El pase se consume al entrar.',
      icon: '→',
    };
  }

  if (remaining <= 0) {
    if (pass.recurrence === 'once') {
      return {
        kind: 'used',
        tone: 'danger',
        label: 'Usado',
        detail: 'No quedan usos en este pase.',
        icon: '✓',
      };
    }

    return {
      kind: 'exhausted',
      tone: 'danger',
      label: 'Sin usos hoy',
      detail: 'Hoy ya no puede entrar. Se renueva el próximo día permitido.',
      icon: '!',
    };
  }

  if (pass.exitCount > 0) {
    return {
      kind: 'reentry',
      tone: 'success',
      label: 'Puede volver a entrar',
      detail: `${remaining === 1 ? 'Queda 1 uso' : `Quedan ${remaining} usos`} hoy.`,
      icon: '↩',
    };
  }

  return {
    kind: 'pending',
    tone: 'success',
    label: 'Pendiente de ingreso',
    detail: 'El QR está listo para entrar.',
    icon: '→',
  };
}
