import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultSimplifiedTemplate, planNestedGeneration } from '@porteria/shared';

const levelNames = ['Sector', 'Casa', 'Cuarto'];

describe('planNestedGeneration sequential', () => {
  it('numbers the elements of one level', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 3,
      levels: [{ count: 5, prefix: 'Sector' }],
      levelNames,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.total, 5);
    assert.deepEqual(
      plan.nodes.map((node) => node.name),
      ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5'],
    );
    assert.equal(plan.nodes.every((node) => node.levelPosition === 1), true);
  });

  it('uses letters when requested', () => {
    const plan = planNestedGeneration({
      anchorLevel: 2,
      leafLevel: 3,
      levels: [{ count: 3, prefix: 'Casa', sequence: 'letters' }],
      levelNames,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.deepEqual(
      plan.nodes.map((node) => node.name),
      ['Casa A', 'Casa B', 'Casa C'],
    );
  });

  it('applies leading zeros', () => {
    const oneZero = planNestedGeneration({
      anchorLevel: 3,
      leafLevel: 3,
      levels: [{ count: 2, prefix: 'Cuarto', padding: 1 }],
      levelNames,
    });
    assert.equal(oneZero.ok, true);
    if (!oneZero.ok) return;
    assert.deepEqual(
      oneZero.nodes.map((node) => node.name),
      ['Cuarto 01', 'Cuarto 02'],
    );

    const twoZeros = planNestedGeneration({
      anchorLevel: 3,
      leafLevel: 3,
      levels: [{ count: 2, prefix: 'Cuarto', padding: 2 }],
      levelNames,
    });
    assert.equal(twoZeros.ok, true);
    if (!twoZeros.ok) return;
    assert.deepEqual(
      twoZeros.nodes.map((node) => node.name),
      ['Cuarto 001', 'Cuarto 002'],
    );

    const noZeros = planNestedGeneration({
      anchorLevel: 3,
      leafLevel: 3,
      levels: [{ count: 11, prefix: 'Cuarto' }],
      levelNames,
    });
    assert.equal(noZeros.ok, true);
    if (!noZeros.ok) return;
    assert.deepEqual(
      noZeros.nodes.map((node) => node.name).slice(0, 2),
      ['Cuarto 1', 'Cuarto 2'],
    );
    assert.equal(noZeros.nodes[10].name, 'Cuarto 11');
  });
});

describe('planNestedGeneration by levels', () => {
  it('creates the whole tree: 5 sectors, 6 houses, 5 rooms', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 3,
      levels: [
        { count: 5, prefix: 'Sector' },
        { count: 6, prefix: 'Casa' },
        { count: 5, prefix: 'Cuarto' },
      ],
      levelNames,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;

    assert.equal(plan.total, 5 + 30 + 150);
    assert.equal(plan.nodes.filter((node) => node.levelPosition === 1).length, 5);
    assert.equal(plan.nodes.filter((node) => node.levelPosition === 2).length, 30);
    assert.equal(plan.nodes.filter((node) => node.levelPosition === 3).length, 150);

    // Las seis casas del primer sector cuelgan de la misma raíz.
    const firstSector = plan.nodes.findIndex((node) => node.levelPosition === 1);
    const houses = plan.nodes.filter((node) => node.levelPosition === 2).slice(0, 6);
    assert.equal(
      houses.every((house) => house.parentIndex === firstSector),
      true,
    );
  });

  it('only uses the contiguous enabled levels', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 3,
      levels: [
        { count: 2, prefix: 'Sector' },
        { enabled: false, count: 3, prefix: 'Casa' },
        { count: 4, prefix: 'Cuarto' },
      ],
      levelNames,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.total, 2);
  });

  it('rejects more levels than the branch allows', () => {
    const plan = planNestedGeneration({
      anchorLevel: 2,
      leafLevel: 2,
      levels: [
        { count: 2, prefix: 'Casa' },
        { count: 2, prefix: 'Cuarto' },
      ],
      levelNames,
    });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.equal(plan.code, 'invalid_params');
  });

  it('rejects a total above the limit', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 3,
      levels: [
        { count: 20, prefix: 'Sector' },
        { count: 20, prefix: 'Casa' },
        { count: 20, prefix: 'Cuarto' },
      ],
      levelNames,
    });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.equal(plan.code, 'limit_exceeded');
  });
});

describe('planNestedGeneration simplified names', () => {
  it('builds the composite name and code', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 3,
      levels: [
        { count: 1, prefix: 'Sector' },
        { count: 1, prefix: 'Casa' },
        { count: 5, prefix: 'Cuarto', padding: 1 },
      ],
      levelNames,
      simplified: true,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;

    const rooms = plan.nodes.filter((node) => node.levelPosition === 3);
    assert.equal(rooms[0].name, '1-101');
    assert.equal(rooms[0].code, '1-101');
    assert.equal(rooms[4].name, '1-105');
  });

  it('supports letters in the composite', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 3,
      levels: [
        { count: 1, prefix: 'Sector' },
        { count: 2, prefix: 'Casa', sequence: 'letters' },
        { count: 3, prefix: 'Cuarto', padding: 1 },
      ],
      levelNames,
      simplified: true,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    const rooms = plan.nodes.filter((node) => node.levelPosition === 3);
    assert.equal(rooms[2].name, '1-A03');
    assert.equal(rooms[5].name, '1-B03');
  });

  it('accepts a custom template', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 2,
      levels: [
        { count: 1, prefix: 'Sector' },
        { count: 2, prefix: 'Casa', padding: 1 },
      ],
      levelNames,
      simplified: true,
      template: 'S{1}-C{2}',
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.nodes[1].name, 'S1-C01');
  });

  it('offers a default template per level count', () => {
    assert.equal(defaultSimplifiedTemplate(1), '{1}');
    assert.equal(defaultSimplifiedTemplate(2), '{1}-{2}');
    assert.equal(defaultSimplifiedTemplate(3), '{1}-{2}{3}');
  });

  it('trims the trailing separator when a level has no children yet', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 3,
      levels: [{ count: 1, prefix: 'Albatroz', simplified: true }],
      levelNames,
      template: '{1}-{2}{3}',
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.nodes[0].name, '1');
  });

  it('mixes simplified and normal levels and supports the prefix token', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 2,
      levels: [
        { count: 1, prefix: 'Albatroz' },
        { count: 2, prefix: 'Casa', padding: 1, simplified: true },
      ],
      levelNames,
      template: '{p1} {1}-{2}',
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;

    assert.equal(plan.nodes[0].name, 'Albatroz 1');
    assert.equal(plan.nodes[0].code, null);
    assert.equal(plan.nodes[1].name, 'Albatroz 1-01');
    assert.equal(plan.nodes[1].code, 'Albatroz 1-01');
    assert.equal(plan.nodes[2].name, 'Albatroz 1-02');
  });

  it('simplifies every level when the request says so', () => {
    const plan = planNestedGeneration({
      anchorLevel: 1,
      leafLevel: 2,
      levels: [
        { count: 1, prefix: 'Albatroz' },
        { count: 1, prefix: 'Casa', padding: 1 },
      ],
      levelNames,
      simplified: true,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.nodes[0].name, '1');
    assert.equal(plan.nodes[1].name, '1-01');
  });
});
