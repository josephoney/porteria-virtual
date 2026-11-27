/**
 * Reglas puras del puesto de trabajo.
 *
 * Viven fuera del servicio para poder probarlas sin base de datos: el servicio
 * resuelve la membresía y el acceso, y acá se decide si la asignación es válida.
 */

export type WorkstationErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'role_not_guard'
  | 'membership_requires_community'
  | 'access_point_inactive'
  | 'tenant_read_only';

const MANAGER_ROLES = ['org_admin', 'community_admin'];

export interface WorkstationRulesInput {
  /** El actor es administrador de plataforma (tenant read-only). */
  isPlatformAdmin: boolean;
  /** Rol del actor en su contexto activo. */
  actorRole: string;
  /** Rol de la membresía que recibe el puesto. */
  membershipRole: string;
  /** Comunidad de la membresía; null si es una membresía de organización. */
  membershipCommunityId: string | null;
  /** Acceso solicitado; null cuando se desasigna. */
  accessPointId: string | null;
  /** Acceso resuelto en la comunidad; null si no existe o no se pidió. */
  accessPoint: { active: boolean } | null;
}

/**
 * Devuelve el código de error o `null` cuando la asignación es válida.
 *
 * El orden importa: el caso más específico primero, para que el cliente reciba
 * el motivo real y no un `forbidden` genérico.
 */
export function evaluateWorkstationTarget(input: WorkstationRulesInput): WorkstationErrorCode | null {
  if (input.isPlatformAdmin) return 'tenant_read_only';
  if (!MANAGER_ROLES.includes(input.actorRole)) return 'forbidden';
  if (input.membershipRole !== 'guard') return 'role_not_guard';
  if (!input.membershipCommunityId) return 'membership_requires_community';

  if (input.accessPointId) {
    if (!input.accessPoint) return 'not_found';
    if (!input.accessPoint.active) return 'access_point_inactive';
  }

  return null;
}
