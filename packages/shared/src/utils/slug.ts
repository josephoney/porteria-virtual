export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 60;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'app',
  'auth',
  'c',
  'login',
  'platform',
  'public',
  'www',
  'kiosk',
  'resident',
  'static',
  'health',
]);

export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (base.length <= SLUG_MAX_LENGTH) return base;
  return base.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= SLUG_MIN_LENGTH &&
    slug.length <= SLUG_MAX_LENGTH &&
    SLUG_PATTERN.test(slug) &&
    !RESERVED_SLUGS.has(slug)
  );
}

export function withSlugSuffix(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  const maxBase = SLUG_MAX_LENGTH - suffix.length;
  return `${base.slice(0, maxBase).replace(/-+$/g, '')}${suffix}`;
}
