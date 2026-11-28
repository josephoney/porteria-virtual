import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planNodeGeneration } from '@porteria/shared';

const sequential = (count: number, extra: Record<string, unknown> = {}) => ({
  params: { mode: 'sequential' as const, count, prefix: 'Casa', ...extra },
  anchorLevel: 2,
  leafLevel: 2,
});

describe('planNodeGeneration sequential', () => {
  it('numbers the units from 1 to N', () => {
    const plan = planNodeGeneration(sequential(50));
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.total, 50);
    assert.equal(plan.nodes[0].name, 'Casa 1');
    assert.equal(plan.nodes[49].name, 'Casa 50');
    assert.equal(plan.nodes.every((node) => node.levelPosition === 2), true);
  });

  it('applies padding and suffix', () => {
    const plan = planNodeGeneration(sequential(3, { padding: 3, suffix: 'A' }));
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.nodes[0].name, 'Casa 001A');
  });

  it('only applies at the leaf of the branch', () => {
    const plan = planNodeGeneration({
      params: { mode: 'sequential', count: 3, prefix: 'Torre' },
      anchorLevel: 1,
      leafLevel: 3,
    });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.equal(plan.code, 'mode_not_applicable');
  });

  it('rejects a count above the limit', () => {
    const plan = planNodeGeneration(sequential(301));
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.equal(plan.code, 'limit_exceeded');
  });

  it('rejects a missing count', () => {
    const plan = planNodeGeneration({
      params: { mode: 'sequential', prefix: 'Casa' },
      anchorLevel: 2,
      leafLevel: 2,
    });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.equal(plan.code, 'invalid_params');
  });
});

describe('planNodeGeneration floors', () => {
  it('creates floors and numbered units', () => {
    const plan = planNodeGeneration({
      params: { mode: 'floors', floors: 5, perFloor: 6 },
      anchorLevel: 1,
      leafLevel: 2,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;

    assert.equal(plan.total, 5 + 5 * 6);
    const floorNames = plan.nodes.filter((node) => node.levelPosition === 1).map((node) => node.name);
    assert.deepEqual(floorNames, ['Piso 1', 'Piso 2', 'Piso 3', 'Piso 4', 'Piso 5']);

    const unitNames = plan.nodes.filter((node) => node.levelPosition === 2).map((node) => node.name);
    assert.equal(unitNames[0], '101');
    assert.equal(unitNames[5], '106');
    assert.equal(unitNames[6], '201');
    assert.equal(unitNames[29], '506');
  });

  it('links units to their floor', () => {
    const plan = planNodeGeneration({
      params: { mode: 'floors', floors: 2, perFloor: 2 },
      anchorLevel: 1,
      leafLevel: 2,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    // Índices: 0 piso, 1-2 unidades, 3 piso, 4-5 unidades.
    assert.equal(plan.nodes[1].parentIndex, 0);
    assert.equal(plan.nodes[2].parentIndex, 0);
    assert.equal(plan.nodes[4].parentIndex, 3);
  });

  it('requires one level for floors and one for units', () => {
    const sameLevel = planNodeGeneration({
      params: { mode: 'floors', floors: 2, perFloor: 2 },
      anchorLevel: 3,
      leafLevel: 3,
    });
    assert.equal(sameLevel.ok, false);
    if (sameLevel.ok) return;
    assert.equal(sameLevel.code, 'mode_not_applicable');
  });

  it('rejects too many floors or units per floor', () => {
    const tooManyFloors = planNodeGeneration({
      params: { mode: 'floors', floors: 51, perFloor: 1 },
      anchorLevel: 1,
      leafLevel: 2,
    });
    assert.equal(tooManyFloors.ok, false);

    const tooManyUnits = planNodeGeneration({
      params: { mode: 'floors', floors: 1, perFloor: 51 },
      anchorLevel: 1,
      leafLevel: 2,
    });
    assert.equal(tooManyUnits.ok, false);
  });

  it('rejects a total above the node limit', () => {
    const plan = planNodeGeneration({
      params: { mode: 'floors', floors: 50, perFloor: 50 },
      anchorLevel: 1,
      leafLevel: 2,
    });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.equal(plan.code, 'limit_exceeded');
  });
});

describe('planNodeGeneration branch', () => {
  it('rejects an anchor deeper than the branch', () => {
    const plan = planNodeGeneration({
      params: { mode: 'sequential', count: 2, prefix: 'A' },
      anchorLevel: 3,
      leafLevel: 2,
    });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.equal(plan.code, 'branch_level_exceeded');
  });
});
