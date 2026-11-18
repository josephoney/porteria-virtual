import type { BitacoraEntryDto } from '@porteria/shared';

export type ActivityTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface ActivityItem {
  id: string;
  movement: string;
  tone: ActivityTone;
  visitor: string | null;
  document: string | null;
  vehiclePlate: string | null;
  destination: string | null;
  reason: string | null;
  /** Static schedule rule of the pass at the moment of the event. */
  rule: string | null;
  /** Group that arrived with the visitor, exactly as the audit snapshot stored it. */
  companions: Array<{ name: string; document: string | null }>;
  createdAt: string;
}

const REASON_TEXTS: Record<string, string> = {
  pass_used: 'El pase ya fue utilizado.',
  revoked: 'El pase fue revocado.',
  expired: 'El pase está expirado.',
  not_valid_now: 'El pase no está vigente en este momento.',
  out_of_days: 'Hoy no es un día autorizado para este pase.',
  out_of_schedule: 'El pase está fuera del horario permitido.',
  daily_uses_exhausted: 'El pase ya agotó los usos permitidos para hoy.',
  wrong_direction: 'El sentido del escaneo no coincide con este acceso.',
  token_already_used: 'Ese QR ya fue usado.',
  denied_by_guard: 'El guardia denegó el acceso.',
};

/** One shared wording for the denial reasons, used by the scan result too. */
export function reasonText(reason: string | null): string {
  if (!reason) return 'Escaneo denegado.';
  return REASON_TEXTS[reason] ?? reason;
}

function objectField(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Companion snapshots live in the untyped `details` object of the audit entry.
 * Anything that is not a complete companion is skipped instead of rendered as
 * an empty name.
 */
function companionsField(value: unknown): Array<{ name: string; document: string | null }> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const companion = objectField(item);
    if (!companion) return [];

    const firstName = textField(companion.firstName);
    const lastName = textField(companion.lastName);
    const name = [firstName, lastName].filter(Boolean).join(' ');
    const document = textField(companion.document);

    if (!name && !document) return [];
    return [{ name: name || 'Acompañante', document }];
  });
}

function movementFor(type: string): { movement: string; tone: ActivityTone } {
  switch (type) {
    case 'pass_entry':
      return { movement: 'Ingreso', tone: 'success' };
    case 'pass_exit':
      return { movement: 'Egreso', tone: 'info' };
    case 'pass_rejected':
      return { movement: 'Rechazado', tone: 'danger' };
    case 'scan_denied':
      return { movement: 'Denegado', tone: 'danger' };
    case 'shift_start':
      return { movement: 'Inicio de turno', tone: 'neutral' };
    case 'shift_end':
      return { movement: 'Cierre de turno', tone: 'neutral' };
    default:
      return { movement: 'Registro', tone: 'neutral' };
  }
}

/**
 * Turns a bitacora row into what the guard needs to read at a glance. The
 * visitor and the plate live in `details`, which is untyped on purpose, so every
 * read goes through a guard.
 */
export function toActivityItem(entry: BitacoraEntryDto): ActivityItem {
  const { movement, tone } = movementFor(entry.type);
  const visitor = objectField(entry.details.visitor);
  const firstName = textField(visitor?.firstName);
  const lastName = textField(visitor?.lastName);
  const name = [firstName, lastName].filter(Boolean).join(' ');

  return {
    id: entry.id,
    movement,
    tone,
    // A shift event has no visitor: the name that matters is the guard who acted.
    visitor: name || (entry.type.startsWith('shift') ? entry.authorName : null),
    document: textField(visitor?.document),
    vehiclePlate: textField(entry.details.vehiclePlate),
    destination: textField(entry.details.destinationName) ?? entry.destinationPath,
    reason: textField(entry.details.reason),
    rule: textField(entry.details.rule),
    companions: companionsField(entry.details.companions),
    createdAt: entry.createdAt,
  };
}
