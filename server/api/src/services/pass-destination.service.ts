import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { locationStructures, locationUnits, memberships } from '@porteria/database/schema';
import type { DestinationKind, DestinationSummary } from '@porteria/shared';

const db = createDb();

/** Separator for the human readable destination path. */
export const DESTINATION_PATH_SEPARATOR = ' › ';

export interface DestinationNodeRow {
  id: string;
  communityId: string;
  structureId: string;
  parentId: string | null;
  levelPosition: number;
  levelCount: number;
  name: string;
  code: string | null;
  sectionType: string | null;
  status: 'active' | 'inactive';
}

export interface CommunityTree {
  nodes: Map<string, DestinationNodeRow>;
  children: Map<string, DestinationNodeRow[]>;
}

export interface ResolvedDestination extends DestinationSummary {
  communityId: string;
  structureId: string;
  levelPosition: number;
  levelCount: number;
  active: boolean;
  childCount: number;
}

/** Loads every node of a community in one query, indexed for tree walking. */
export async function loadCommunityTree(communityId: string): Promise<CommunityTree> {
  const rows = await db
    .select({
      id: locationUnits.id,
      communityId: locationUnits.communityId,
      structureId: locationUnits.structureId,
      parentId: locationUnits.parentId,
      levelPosition: locationUnits.levelPosition,
      levelCount: locationStructures.levelCount,
      name: locationUnits.name,
      code: locationUnits.code,
      sectionType: locationUnits.sectionType,
      status: locationUnits.status,
    })
    .from(locationUnits)
    .innerJoin(locationStructures, eq(locationUnits.structureId, locationStructures.id))
    .where(eq(locationUnits.communityId, communityId));

  const nodes = new Map<string, DestinationNodeRow>();
  const children = new Map<string, DestinationNodeRow[]>();

  for (const row of rows) {
    const node: DestinationNodeRow = row;
    nodes.set(node.id, node);
    if (!node.parentId) continue;
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node);
    children.set(node.parentId, siblings);
  }

  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  return { nodes, children };
}

/**
 * Walks up to the level-1 ancestor. The level-1 section decides whether the
 * node is a residence or a common area, so a single hierarchy serves both.
 */
export function resolveDestinationFromTree(
  tree: CommunityTree,
  locationUnitId: string,
): ResolvedDestination | null {
  const node = tree.nodes.get(locationUnitId);
  if (!node) return null;

  const chain: DestinationNodeRow[] = [];
  const seen = new Set<string>();
  let cursor: DestinationNodeRow | undefined = node;

  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parentId ? tree.nodes.get(cursor.parentId) : undefined;
  }

  const root = chain[0] ?? node;
  const kind: DestinationKind = root.sectionType === 'common_area' ? 'common_area' : 'home';
  const active = chain.every((entry) => entry.status === 'active');
  const childCount = (tree.children.get(node.id) ?? []).length;

  return {
    id: node.id,
    name: node.name,
    path: chain.map((entry) => entry.name).join(DESTINATION_PATH_SEPARATOR),
    kind,
    communityId: node.communityId,
    structureId: node.structureId,
    levelPosition: node.levelPosition,
    levelCount: node.levelCount,
    active,
    childCount,
  };
}

export async function resolveDestinationById(
  locationUnitId: string,
): Promise<ResolvedDestination | null> {
  const [row] = await db
    .select({ communityId: locationUnits.communityId })
    .from(locationUnits)
    .where(eq(locationUnits.id, locationUnitId))
    .limit(1);

  if (!row) return null;

  const tree = await loadCommunityTree(row.communityId);
  return resolveDestinationFromTree(tree, locationUnitId);
}

/**
 * A `common_area` section root is a container: it only becomes a destination
 * when it has no children. Any other node in the subtree is authorizable as is,
 * because a common area does not need a third level.
 */
export function isAuthorizableCommonArea(destination: ResolvedDestination): boolean {
  return destination.levelPosition !== 1 || destination.childCount === 0;
}

function toSummary(destination: ResolvedDestination): DestinationSummary {
  return {
    id: destination.id,
    name: destination.name,
    path: destination.path,
    kind: destination.kind,
  };
}

/**
 * Destinations a resident may authorize: their own leaf units plus every active
 * node of the community common-area branches.
 */
export async function listAuthorizableDestinations(
  personId: string,
  communityId: string,
): Promise<DestinationSummary[]> {
  const tree = await loadCommunityTree(communityId);
  const destinations = new Map<string, DestinationSummary>();

  const ownUnits = await db
    .select({ locationUnitId: memberships.locationUnitId })
    .from(memberships)
    .where(
      and(
        eq(memberships.personId, personId),
        eq(memberships.communityId, communityId),
        eq(memberships.status, 'active'),
      ),
    );

  for (const row of ownUnits) {
    if (!row.locationUnitId) continue;
    const destination = resolveDestinationFromTree(tree, row.locationUnitId);
    if (!destination || !destination.active) continue;
    if (destination.kind !== 'home') continue;
    if (destination.levelPosition !== destination.levelCount) continue;
    destinations.set(destination.id, toSummary(destination));
  }

  for (const node of tree.nodes.values()) {
    const destination = resolveDestinationFromTree(tree, node.id);
    if (!destination || !destination.active) continue;
    if (destination.kind !== 'common_area') continue;
    if (!isAuthorizableCommonArea(destination)) continue;
    destinations.set(destination.id, toSummary(destination));
  }

  return [...destinations.values()].sort((a, b) => a.path.localeCompare(b.path, 'es'));
}
