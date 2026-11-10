import { eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { locationStructures, locationUnits } from '@porteria/database/schema';

const db = createDb();

export async function buildLocationPath(locationUnitId: string): Promise<string | null> {
  const [unit] = await db
    .select({
      name: locationUnits.name,
      parentId: locationUnits.parentId,
      structureName: locationStructures.name,
    })
    .from(locationUnits)
    .innerJoin(locationStructures, eq(locationUnits.structureId, locationStructures.id))
    .where(eq(locationUnits.id, locationUnitId))
    .limit(1);

  if (!unit) return null;

  const parts = [unit.structureName, unit.name];
  let parentId: string | null = unit.parentId;

  for (let depth = 0; depth < 10; depth += 1) {
    if (!parentId) break;
    const currentId = parentId;
    const [parent] = await db
      .select({ name: locationUnits.name, parentId: locationUnits.parentId })
      .from(locationUnits)
      .where(eq(locationUnits.id, currentId))
      .limit(1);
    if (!parent) break;
    parts.splice(1, 0, parent.name);
    parentId = parent.parentId;
  }

  return parts.join(' / ');
}
