import { and, eq, ne } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { organizations, communities } from '@porteria/database/schema';
import { isValidSlug, slugify, withSlugSuffix } from '@porteria/shared';

const db = createDb();

export class InvalidSlugError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSlugError';
  }
}

function baseSlug(desired: string | undefined, name: string): string {
  const candidate = (desired ?? slugify(name)).trim();
  if (!isValidSlug(candidate)) {
    throw new InvalidSlugError(
      'Slug inválido: usá minúsculas, números y guiones (3-60), sin palabras reservadas',
    );
  }
  return candidate;
}

async function organizationSlugExists(slug: string, excludeId?: string): Promise<boolean> {
  const conditions = excludeId
    ? and(eq(organizations.slug, slug), ne(organizations.id, excludeId))
    : eq(organizations.slug, slug);
  const [row] = await db.select({ id: organizations.id }).from(organizations).where(conditions).limit(1);
  return Boolean(row);
}

async function communitySlugExists(slug: string, excludeId?: string): Promise<boolean> {
  const conditions = excludeId
    ? and(eq(communities.slug, slug), ne(communities.id, excludeId))
    : eq(communities.slug, slug);
  const [row] = await db.select({ id: communities.id }).from(communities).where(conditions).limit(1);
  return Boolean(row);
}

export async function uniqueOrganizationSlug(
  desired: string | undefined,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = baseSlug(desired, name);
  for (let attempt = 1; attempt <= 100; attempt++) {
    const candidate = withSlugSuffix(base, attempt);
    if (!(await organizationSlugExists(candidate, excludeId))) return candidate;
  }
  throw new InvalidSlugError('No se pudo generar un slug único para la organización');
}

export async function uniqueCommunitySlug(
  desired: string | undefined,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = baseSlug(desired, name);
  for (let attempt = 1; attempt <= 100; attempt++) {
    const candidate = withSlugSuffix(base, attempt);
    if (!(await communitySlugExists(candidate, excludeId))) return candidate;
  }
  throw new InvalidSlugError('No se pudo generar un slug único para la comunidad');
}
