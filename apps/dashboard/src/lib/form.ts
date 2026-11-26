/**
 * Helpers for the form pattern documented in `docs/design-system.md`.
 *
 * Every inline message uses the `<id>-error` convention, so the control can
 * point at it with `aria-describedby` and screen readers announce the same text
 * the user sees. Validators return an empty string when the value is valid.
 */

export interface FieldA11y {
  'aria-invalid': boolean;
  'aria-describedby'?: string;
}

/** ARIA attributes that link a control to its inline error message. */
export function fieldA11y(id: string, error?: string): FieldA11y {
  return {
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : undefined,
  };
}

export function requiredError(value: string, label: string): string {
  return value.trim() === '' ? `${label} es obligatorio.` : '';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(value: string, label = 'El correo'): string {
  const trimmed = value.trim();
  if (trimmed === '') return `${label} es obligatorio.`;
  return EMAIL_PATTERN.test(trimmed) ? '' : `${label} no tiene un formato válido.`;
}

const PHONE_PATTERN = /^\+?[\d\s().-]{6,30}$/;
const DOCUMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .-]{3,49}$/;

/** Optional values: an empty string is valid and means "not provided". */
export function optionalPhoneError(value: string, label = 'El teléfono'): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  return PHONE_PATTERN.test(trimmed) ? '' : `${label} no tiene un formato válido.`;
}

export function optionalDocumentError(value: string, label = 'El documento'): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  return DOCUMENT_PATTERN.test(trimmed) ? '' : `${label} no tiene un formato válido.`;
}

export function minLengthError(value: string, min: number, label: string): string {
  if (value === '') return '';
  return value.length < min ? `${label} debe tener al menos ${min} caracteres.` : '';
}

/** Collects the messages so callers can bail out before hitting the API. */
export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
