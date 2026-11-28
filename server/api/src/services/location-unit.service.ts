import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { locationStructures, locationUnits } from '@porteria/database/schema';
import { isLeafAt, resolveLeafLevel } from '@porteria/shared';

const db = createDb();

export type LocationUnitValidation =
  | {
      ok: true;
      locationUnitId: string;
      communityId: string;
      levelPosition: number;
      levelCount: number;
      /** Nivel en el que termina la rama de este nodo. */
      leafLevel: number;
    }
  | { ok: false; code: 'not_found' | 'not_leaf' };

/**
 * Valida que la ubicación sea una hoja de su **rama**.
 *
 * `level_count` de la estructura es el máximo de la comunidad; una rama puede
 * terminar antes (una torre de apartamentos dentro de un club con hotel), por
 * eso se compara contra `branch_level_count` con respaldo en el máximo.
 */
export async function validateLocationUnit(
  locationUnitId: string,
  communityId: string,
): Promise<LocationUnitValidation> {
  const [row] = await db
    .select({
      id: locationUnits.id,
      communityId: locationUnits.communityId,
      levelPosition: locationUnits.levelPosition,
      branchLevelCount: locationUnits.branchLevelCount,
      levelCount: locationStructures.levelCount,
    })
    .from(locationUnits)
    .innerJoin(
      locationStructures,
      eq(locationUnits.structureId, locationStructures.id),
    )
    .where(
      and(
        eq(locationUnits.id, locationUnitId),
        eq(locationUnits.communityId, communityId),
      ),
    )
    .limit(1);

  if (!row) return { ok: false, code: 'not_found' };

  const leafLevel = resolveLeafLevel(row.branchLevelCount, row.levelCount);
  if (!isLeafAt(row.levelPosition, row.branchLevelCount, row.levelCount)) {
    return { ok: false, code: 'not_leaf' };
  }

  return {
    ok: true,
    locationUnitId: row.id,
    communityId: row.communityId,
    levelPosition: row.levelPosition,
    levelCount: row.levelCount,
    leafLevel,
  };
}
