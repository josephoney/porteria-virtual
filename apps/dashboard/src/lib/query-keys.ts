/**
 * Claves de cache compartidas entre pantallas.
 *
 * Dos pantallas que piden el mismo recurso con los mismos parámetros deben usar
 * la misma clave: así comparten cache, se deduplican los requests y una
 * invalidación alcanza a ambas.
 */
export const queryKeys = {
  /** Comunidades del alcance del usuario (`GET /api/communities`). */
  tenantCommunities: ['communities', 'tenant'] as const,
  /** Agrupadores de todas las comunidades del alcance. */
  buildings: ['sections', { pageSize: 100 }] as const,
  /** Página filtrada de secciones (`GET /api/sections`). */
  sectionsList: (params: { page: number; communityId: string; type: string; search: string }) =>
    ['sections', 'list', params] as const,
  /** Unidades de todas las comunidades del alcance. */
  units: ['units', { pageSize: 100 }] as const,
  /** Invitaciones del alcance del usuario. */
  invitations: ['invitations'] as const,
  /** Sólo el total de usuarios, para las tarjetas del dashboard. */
  usersTotal: ['users', 'total'] as const,
  /** Organizaciones de la plataforma (superadmin). */
  platformOrganizations: ['platform', 'organizations', { pageSize: 100 }] as const,
  /** Comunidades de la plataforma (superadmin), paginadas. */
  platformCommunities: ['platform', 'communities', { pageSize: 100 }] as const,
  /** Usuarios de la plataforma (superadmin). */
  platformUsers: ['platform', 'users', { pageSize: 100 }] as const,
};
