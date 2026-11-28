import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canHaveChildren, isLeafAt, resolveLeafLevel } from '@porteria/shared';

describe('resolveLeafLevel', () => {
  it('uses the branch depth when it is declared', () => {
    assert.equal(resolveLeafLevel(2, 3), 2);
    assert.equal(resolveLeafLevel(1, 3), 1);
    assert.equal(resolveLeafLevel(3, 3), 3);
  });

  it('falls back to the structure maximum when the branch has no depth', () => {
    assert.equal(resolveLeafLevel(null, 3), 3);
    assert.equal(resolveLeafLevel(undefined, 2), 2);
  });

  it('never exceeds the structure maximum', () => {
    assert.equal(resolveLeafLevel(3, 2), 2);
  });

  it('ignores invalid depths', () => {
    assert.equal(resolveLeafLevel(0, 3), 3);
    assert.equal(resolveLeafLevel(-1, 3), 3);
  });
});

describe('isLeafAt', () => {
  it('treats level 2 as the leaf of a two-level branch', () => {
    assert.equal(isLeafAt(2, 2, 3), true);
    assert.equal(isLeafAt(1, 2, 3), false);
    assert.equal(isLeafAt(3, 2, 3), false);
  });

  it('keeps the previous behavior when the branch uses the maximum', () => {
    assert.equal(isLeafAt(3, 3, 3), true);
    assert.equal(isLeafAt(2, 3, 3), false);
  });

  it('treats the root as the leaf of a one-level branch', () => {
    assert.equal(isLeafAt(1, 1, 3), true);
  });
});

describe('canHaveChildren', () => {
  it('stops a two-level branch at level 2', () => {
    assert.equal(canHaveChildren(1, 2, 3), true);
    assert.equal(canHaveChildren(2, 2, 3), false);
  });

  it('allows all three levels when the branch uses them', () => {
    assert.equal(canHaveChildren(1, 3, 3), true);
    assert.equal(canHaveChildren(2, 3, 3), true);
    assert.equal(canHaveChildren(3, 3, 3), false);
  });
});
