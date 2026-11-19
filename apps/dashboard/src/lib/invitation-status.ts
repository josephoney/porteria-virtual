const INVITATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  revoked: 'Cancelada',
  expired: 'Vencida',
};

export function invitationStatusLabel(status: string): string {
  return INVITATION_STATUS_LABELS[status] ?? status;
}
