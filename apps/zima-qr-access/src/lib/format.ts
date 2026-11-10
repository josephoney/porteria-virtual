const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: string | Date): string {
  return dateFormatter.format(toDate(value));
}

export function formatTime(value: string | Date): string {
  return timeFormatter.format(toDate(value));
}

export function formatDateTime(value: string | Date): string {
  const date = toDate(value);
  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)}`;
}

export function formatValidity(from: string | Date, until: string | Date): string {
  return `${formatDateTime(from)} → ${formatDateTime(until)}`;
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Activo';
    case 'used':
      return 'Usado';
    case 'revoked':
      return 'Revocado';
    case 'expired':
      return 'Expirado';
    default:
      return status;
  }
}

export function presenceLabel(presence: string): string {
  return presence === 'inside' ? 'Dentro' : 'Fuera';
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'owner':
      return 'Propietario';
    case 'tenant':
      return 'Inquilino';
    case 'resident':
      return 'Residente';
    case 'guard':
      return 'Guardia';
    case 'operator':
      return 'Operador';
    case 'community_admin':
      return 'Administrador de comunidad';
    case 'org_admin':
      return 'Administrador de organización';
    default:
      return role;
  }
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
