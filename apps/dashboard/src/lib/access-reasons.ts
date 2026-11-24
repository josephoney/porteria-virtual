/**
 * Reason codes the scan flow stores in `details.reason`. The reports and the
 * readable bitácora must name them the same way, so both read this map.
 */
export const accessReasonLabels: Record<string, string> = {
  denied_by_guard: 'Denegado por el guardia',
  pass_used: 'Pase ya utilizado',
  revoked: 'Pase revocado',
  expired: 'Pase vencido',
  not_valid_now: 'Fuera de vigencia',
  out_of_days: 'Día no autorizado',
  out_of_schedule: 'Fuera del horario permitido',
  daily_uses_exhausted: 'Sin usos disponibles hoy',
  wrong_direction: 'Sentido de acceso incorrecto',
  token_already_used: 'QR ya utilizado',
  invalid_or_expired_token: 'Código inválido o vencido',
};

/** Fallback for a code the UI does not know yet: show it, never hide it. */
export function accessReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'Sin motivo';
  return accessReasonLabels[reason] ?? reason;
}
