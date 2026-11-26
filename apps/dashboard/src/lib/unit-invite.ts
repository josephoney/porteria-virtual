/**
 * Tipos legacy de unidad que no representan una vivienda y, por lo tanto, no
 * admiten ocupantes. El resto de los tipos puede recibir propietarios,
 * arrendatarios o residentes.
 */
const NON_OCCUPIABLE_TYPES = new Set(['parking', 'storage']);

interface UnitInviteCandidate {
  status: string;
  levelPosition?: number;
  levelCount?: number;
  metadata?: { legacyType?: string | null } | null;
}

/**
 * Devuelve el motivo por el que una unidad no puede recibir una invitación de
 * residente, o `null` cuando sí es apta. Sirve para alinear la UI con la
 * validación del servidor: sólo hojas activas.
 */
export function unitInviteIssue(unit: UnitInviteCandidate): string | null {
  if (unit.status !== 'active') return 'La unidad está inactiva o archivada.';
  if (
    unit.levelPosition !== undefined &&
    unit.levelCount !== undefined &&
    unit.levelPosition !== unit.levelCount
  ) {
    return 'Sólo se puede invitar a unidades hoja.';
  }
  if (unit.metadata?.legacyType && NON_OCCUPIABLE_TYPES.has(unit.metadata.legacyType)) {
    return 'Este tipo de unidad no admite ocupantes.';
  }
  return null;
}
