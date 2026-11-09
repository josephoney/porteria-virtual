import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectDescendants,
  collectSubtree,
  type LiteNode,
} from '../src/services/location-tree.service.js';

const tree: LiteNode[] = [
  { id: 'root', parentId: null, levelPosition: 1 },
  { id: 'floor-a', parentId: 'root', levelPosition: 2 },
  { id: 'floor-b', parentId: 'root', levelPosition: 2 },
  { id: 'unit-a1', parentId: 'floor-a', levelPosition: 3 },
  { id: 'unit-a2', parentId: 'floor-a', levelPosition: 3 },
  { id: 'unit-b1', parentId: 'floor-b', levelPosition: 3 },
  { id: 'unrelated', parentId: null, levelPosition: 1 },
];

describe('location tree service', () => {
  it('collects every descendant recursively, not only direct children', () => {
    const descendants = collectDescendants('root', tree).map((node) => node.id);

    assert.deepEqual(descendants.sort(), [
      'floor-a',
      'floor-b',
      'unit-a1',
      'unit-a2',
      'unit-b1',
    ]);
    assert.equal(descendants.includes('unrelated'), false);
  });

  it('includes the node itself in a subtree', () => {
    assert.deepEqual(collectSubtree('floor-a', tree).sort(), [
      'floor-a',
      'unit-a1',
      'unit-a2',
    ]);
  });

  it('returns an empty subtree for an unknown node', () => {
    assert.deepEqual(collectSubtree('does-not-exist', tree), []);
  });

  it('does not loop on a malformed cyclic tree', () => {
    const cyclic: LiteNode[] = [
      { id: 'a', parentId: 'b', levelPosition: 1 },
      { id: 'b', parentId: 'a', levelPosition: 2 },
    ];

    assert.equal(collectDescendants('a', cyclic).length, 1);
  });
});
