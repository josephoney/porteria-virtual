export interface LiteNode {
  id: string;
  parentId: string | null;
  levelPosition: number;
}

function groupByParent(nodes: LiteNode[]): Map<string, LiteNode[]> {
  const byParent = new Map<string, LiteNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }
  return byParent;
}

export function collectDescendants(
  nodeId: string,
  allNodes: LiteNode[],
): LiteNode[] {
  const byParent = groupByParent(allNodes);
  const result: LiteNode[] = [];
  const visited = new Set<string>([nodeId]);
  const queue = [...(byParent.get(nodeId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    result.push(current);
    queue.push(...(byParent.get(current.id) ?? []));
  }

  return result;
}

export function collectSubtree(nodeId: string, allNodes: LiteNode[]): string[] {
  const node = allNodes.find((item) => item.id === nodeId);
  if (!node) return [];
  return [nodeId, ...collectDescendants(nodeId, allNodes).map((item) => item.id)];
}
