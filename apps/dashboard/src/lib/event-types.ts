/**
 * Catálogo legible de los eventos técnicos que llegan a `events`.
 *
 * El enum `EventType` de `@porteria/shared` solo cubre una parte: el flujo de
 * pases, la jerarquía de ubicaciones y la administración escriben sus propios
 * tipos. El Historial los muestra con nombre humano y deja pasar el valor crudo
 * como último recurso para no ocultar un evento nuevo.
 */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  'pass.entry': 'Ingreso de pase',
  'pass.exit': 'Salida de pase',
  'pass.rejected': 'Pase rechazado',
  'access.granted': 'Acceso autorizado',
  'access.denied': 'Acceso denegado',
  'visitor.registered': 'Visitante registrado',
  'visitor.access_granted': 'Visitante autorizado',
  'visitor.access_denied': 'Visitante denegado',
  'call.started': 'Llamada iniciada',
  'call.ended': 'Llamada finalizada',
  'call.missed': 'Llamada perdida',
  'door.open': 'Apertura de puerta',
  'door.opened': 'Puerta abierta',
  'door.closed': 'Puerta cerrada',
  'kiosk.online': 'Kiosco en línea',
  'kiosk.offline': 'Kiosco fuera de línea',
  'guard.checkin': 'Check-in de guardia',
  'guard.checkout': 'Check-out de guardia',
  'guard.ronda_started': 'Ronda iniciada',
  'guard.ronda_checkpoint': 'Punto de ronda',
  'guard.ronda_completed': 'Ronda completada',
  'guard.ronda_missed': 'Ronda omitida',
  'user.login': 'Inicio de sesión',
  'user.logout': 'Cierre de sesión',
  'user.created': 'Usuario creado',
  'user.updated': 'Usuario actualizado',
  'membership.created': 'Membresía creada',
  'membership.updated': 'Membresía actualizada',
  'person.created': 'Persona creada',
  'person.updated': 'Persona actualizada',
  'person.account_created': 'Cuenta creada',
  'organization.updated': 'Organización actualizada',
  'organization.profile.updated': 'Perfil de organización actualizado',
  'community.created': 'Comunidad creada',
  'community.updated': 'Comunidad actualizada',
  'location_section.created': 'Sección creada',
  'location_section.updated': 'Sección actualizada',
  'location_section.deleted': 'Sección eliminada',
  'location_structure.created': 'Estructura creada',
  'location_structure.updated': 'Estructura actualizada',
  'location_unit.created': 'Unidad creada',
  'location_unit.updated': 'Unidad actualizada',
  'location_node.created': 'Ubicación creada',
  'location_node.updated': 'Ubicación actualizada',
  'location_node.deleted': 'Ubicación eliminada',
  'location_resident.associated': 'Residente asociado',
  'asset.uploaded': 'Archivo cargado',
  'outbox.replayed': 'Evento reprocesado',
};

export const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType;
}
