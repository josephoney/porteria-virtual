import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { locationStructures, locationUnits } from '@porteria/database/schema';

const db = createDb();

export type LocationUnitValidation =
  | {
      ok: true;
      locationUnitId: string;
      communityId: string;
      levelPosition: number;
      levelCount: number;
    }
  | { ok: false; code: 'not_found' | 'not_leaf' };

export async function validateLocationUnit(
  locationUnitId: string,
  communityId: string,
): Promise<LocationUnitValidation> {
  const [row] = await db
    .select({
      id: locationUnits.id,
      communityId: locationUnits.communityId,
      levelPosition: locationUnits.levelPosition,
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
  if (row.levelPosition !== row.levelCount) {
    return { ok: false, code: 'not_leaf' };
  }

  return {
    ok: true,
    locationUnitId: row.id,
    communityId: row.communityId,
    levelPosition: row.levelPosition,
    levelCount: row.levelCount,
  };
}
