import { ApiError } from '@/api/client';

const MESSAGES: Record<string, string> = {
  network_error: 'No hay conexión con el servidor. Revisá la red y reintentá.',
  invalid_credentials: 'Email o contraseña incorrectos.',
  'Invalid email or password': 'Email o contraseña incorrectos.',
  forbidden: 'No tenés permisos para esta acción.',
  not_found: 'No encontramos ese pase.',
  gone: 'Este pase ya no está disponible.',
  link_expired: 'El link expiró. Regeneralo desde la app.',
  pass_used: 'Este pase ya fue utilizado.',
  not_bound: 'Este dispositivo no está vinculado al pase.',
  device_already_bound: 'Este link ya está vinculado a otro dispositivo.',
  invalid_pin: 'El PIN no es correcto.',
  pin_locked: 'Demasiados intentos. Probá de nuevo en unos minutos.',
  not_valid_now: 'El pase todavía no está vigente o está fuera del horario.',
  dynamic_qr_disabled: 'Los pases dinámicos están deshabilitados.',
  daily_limit_reached: 'Se alcanzó el límite de pases de hoy para esta unidad.',
  rate_limited: 'Demasiados intentos. Esperá un momento y reintentá.',
  recurring_not_available: 'Los pases recurrentes no están disponibles todavía.',
  allowed_days_reserved: 'Los días permitidos no están disponibles todavía.',
  invalid: 'Revisá los datos del formulario.',
  conflict: 'La operación no se pudo completar. Actualizá e intentá de nuevo.',
  scan_expired: 'El escaneo expiró. Volvé a escanear el QR.',
  scan_already_processed: 'Ese escaneo ya fue confirmado o rechazado.',
  token_already_used: 'Ese QR ya fue usado. Pedile al visitante que lo actualice.',
  invalid_or_expired_token: 'El QR no es válido o expiró.',
  no_active_shift: 'No tenés un turno abierto. Iniciá el turno antes de escanear.',
  not_on_shift_at_access_point:
    'No estás en turno en este punto de acceso. Cambiá de acceso o pedí ayuda al administrador.',
  foreign_community: 'Ese pase pertenece a otra comunidad.',
  wrong_direction: 'El sentido del escaneo no coincide con este punto de acceso.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? error.code;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}
