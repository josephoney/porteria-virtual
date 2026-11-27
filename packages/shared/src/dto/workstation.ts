/**
 * Asignación del puesto de trabajo de una membresía de guardia.
 *
 * `null` desasigna y es idempotente: repetirlo devuelve el mismo resultado.
 */
export interface AssignWorkstationDto {
  accessPointId: string | null;
}
