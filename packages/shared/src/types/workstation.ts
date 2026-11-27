import type { AccessPointDirection, AccessPointType } from '../enums/index.js';

/**
 * Puesto de trabajo asignado a una membresía de guardia.
 *
 * Es una vista plana del acceso por defecto: `accessPointId` es null cuando la
 * membresía no tiene puesto, y en ese caso el resto de los campos también.
 */
export interface WorkstationAssignment {
  membershipId: string;
  communityId: string | null;
  accessPointId: string | null;
  name: string | null;
  type: AccessPointType | null;
  direction: AccessPointDirection | null;
  active: boolean | null;
}

/**
 * Resultado de asignar o desasignar un puesto.
 *
 * `appliesNextShift` viaja cuando el guardia tiene un turno abierto: el turno
 * conserva su acceso y el cambio se aplica al siguiente.
 */
export interface WorkstationAssignmentResult extends WorkstationAssignment {
  appliesNextShift?: boolean;
  activeShiftAccessPointId?: string | null;
}

/** Guardia asignado a un acceso, con su estado de turno. */
export interface AccessPointGuard {
  membershipId: string;
  personId: string;
  personName: string;
  email: string | null;
  onShift: boolean;
  shiftId: string | null;
}

export interface AccessPointGuardListResponse {
  items: AccessPointGuard[];
}
