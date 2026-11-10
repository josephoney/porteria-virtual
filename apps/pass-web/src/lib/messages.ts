const MESSAGES: Record<string, string> = {
  not_found: 'Este link no existe o es inválido.',
  link_expired: 'Este link expiró. Pedile al residente que genere uno nuevo.',
  pass_used: 'Este pase ya fue utilizado.',
  gone: 'Este pase ya no está disponible.',
  revoked: 'Este pase fue revocado por el residente.',
  expired: 'Este pase expiró.',
  device_already_bound:
    'Este link ya está vinculado a otro dispositivo. Por seguridad, solo funciona en el primero que lo abrió.',
  not_bound: 'Este dispositivo todavía no está vinculado al pase.',
  invalid_pin: 'PIN incorrecto. Intentá de nuevo.',
  pin_locked: 'Demasiados intentos. Esperá 15 minutos antes de volver a probar.',
  not_valid_now: 'Estás fuera del horario permitido para este pase.',
  dynamic_qr_disabled: 'El acceso con QR no está habilitado.',
  invalid_or_expired_token: 'El QR venció. Esperá a que se genere uno nuevo.',
  request_failed: 'No pudimos completar la operación. Revisá tu conexión e intentá de nuevo.',
};

export const FINAL_CODES = new Set([
  'not_found',
  'link_expired',
  'pass_used',
  'gone',
  'revoked',
  'expired',
  'device_already_bound',
  'not_valid_now',
  'dynamic_qr_disabled',
]);

export function messageFor(code: string): string {
  return MESSAGES[code] ?? 'Ocurrió un error inesperado. Intentá de nuevo.';
}
