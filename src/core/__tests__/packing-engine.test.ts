import { describe, expect, it } from 'vitest';
import { packAcrossSuitcases, packItems, validateSuitcase } from '../packing-engine';
import type { PackingItem, Suitcase, SuitcaseConfig } from '../models';

const suitcase = (overrides: Partial<Suitcase> = {}): Suitcase => ({ length: 10, width: 8, height: 6, maxWeight: 10, ...overrides });
const named = (id: string, overrides: Partial<Suitcase> = {}): SuitcaseConfig => ({ id, name: id, ...suitcase(), ...overrides });
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: id, category: '衣物', length: 3, width: 2, height: 1, weight: 1, priority: 2, mustHave: false, ...overrides,
});

describe('validateSuitcase', () => {
  it('rejects each non-positive capacity', () => {
    expect(validateSuitcase(suitcase({ height: 0 }))).toContain('行李箱高度必须大于 0');
    expect(validateSuitcase(suitcase({ maxWeight: -1 }))).toContain('承重必须大于 0');
  });
});

describe('packItems', () => {
  it('allows total weight exactly at the suitcase limit', () => {
    const plan = packItems(suitcase({ maxWeight: 2 }), [item('a'), item('b')], 'comfort');
    expect(plan.placements).toHaveLength(2);
    expect(plan.totalWeight).toBe(2);
  });

  it('uses rotation when the original orientation does not fit', () => {
    const plan = packItems(suitcase({ length: 4, width: 3, height: 2 }), [item('rotated', { length: 2, width: 4, height: 3 })], 'comfort');
    expect(plan.placements[0]?.dimensions).toEqual({ length: 4, width: 3, height: 2 });
  });

  it('keeps placements inside bounds and non-overlapping', () => {
    const plan = packItems(suitcase(), [item('a'), item('b'), item('c')], 'comfort');
    expect(plan.placements.every((p) => p.x + p.dimensions.length <= 10 && p.y + p.dimensions.width <= 8 && p.z + p.dimensions.height <= 6)).toBe(true);
    expect(new Set(plan.placements.map((p) => `${p.x}:${p.y}:${p.z}`)).size).toBe(3);
  });

  it('returns deterministic coordinates and an unplaced reason', () => {
    const inputs = [item('a'), item('huge', { length: 30 })];
    expect(packItems(suitcase(), inputs, 'comfort')).toEqual(packItems(suitcase(), inputs, 'comfort'));
    expect(packItems(suitcase(), inputs, 'comfort').unplaced[0]?.reason).toContain('空间');
  });
});

describe('packAcrossSuitcases', () => {
  it('packs every item at most once and never double-counts weight', () => {
    const suitcases = [named('small'), named('big', { length: 20, maxWeight: 20 })];
    const items = Array.from({ length: 12 }, (_, index) => item(`item-${index}`));
    const plan = packAcrossSuitcases(suitcases, items, 'comfort');

    const placedIds = plan.suitcases.flatMap((entry) => entry.placements.map((placement) => placement.itemId));
    expect(new Set(placedIds).size).toBe(placedIds.length);
    const unassignedIds = plan.unassigned.map((entry) => entry.item.id);
    expect(placedIds.filter((id) => unassignedIds.includes(id))).toEqual([]);
    expect(placedIds.length + unassignedIds.length).toBe(items.length);
    expect(plan.totalWeight).toBeCloseTo(placedIds.length * 1);
    expect(plan.totalWeight).toBeCloseTo(plan.suitcases.reduce((sum, entry) => sum + entry.totalWeight, 0));
  });

  it('keeps user-pinned items in their designated suitcase', () => {
    const suitcases = [named('a'), named('b')];
    const pinned = item('pinned', { suitcaseId: 'a' });
    const plan = packAcrossSuitcases(suitcases, [pinned], 'comfort');
    expect(plan.suitcases.find((entry) => entry.suitcaseId === 'a')?.placements.map((p) => p.itemId)).toEqual(['pinned']);
    expect(plan.suitcases.find((entry) => entry.suitcaseId === 'b')?.placements).toEqual([]);
  });

  it('never moves a pinned item elsewhere to improve fill rate', () => {
    const suitcases = [named('tiny', { maxWeight: 0.5 }), named('roomy', { maxWeight: 50 })];
    const pinned = item('heavy', { weight: 5, mustHave: true, suitcaseId: 'tiny' });
    const plan = packAcrossSuitcases(suitcases, [pinned], 'comfort');
    const tiny = plan.suitcases.find((entry) => entry.suitcaseId === 'tiny')!;
    const roomy = plan.suitcases.find((entry) => entry.suitcaseId === 'roomy')!;
    expect(tiny.placements).toEqual([]);
    expect(tiny.unplaced[0]?.item.id).toBe('heavy');
    expect(tiny.unplaced[0]?.reason).toContain('指定箱子放不下');
    expect(roomy.placements).toEqual([]);
    expect(plan.unassigned).toEqual([]);
  });

  it('keeps other suitcases valid results when one overflows', () => {
    const suitcases = [named('a', { maxWeight: 1 }), named('b', { maxWeight: 50 })];
    const items = [item('stuck', { weight: 5, suitcaseId: 'a' }), item('free', { weight: 2 })];
    const plan = packAcrossSuitcases(suitcases, items, 'comfort');
    expect(plan.suitcases.find((entry) => entry.suitcaseId === 'a')?.unplaced).toHaveLength(1);
    expect(plan.suitcases.find((entry) => entry.suitcaseId === 'b')?.placements.map((p) => p.itemId)).toEqual(['free']);
  });

  it('lists reasons when a free item fits nowhere', () => {
    const suitcases = [named('a', { maxWeight: 1 }), named('b', { maxWeight: 2 })];
    const plan = packAcrossSuitcases(suitcases, [item('too-heavy', { weight: 10 })], 'comfort');
    expect(plan.unassigned).toHaveLength(1);
    expect(plan.unassigned[0]?.reason).toContain('无法装入任何箱子');
    expect(plan.unassigned[0]?.reason).toContain('承重');
  });

  it('prioritizes must-have items when capacity is limited', () => {
    const suitcases = [named('only', { maxWeight: 2 })];
    const items = [item('optional', { weight: 2 }), item('required', { weight: 2, mustHave: true })];
    const plan = packAcrossSuitcases(suitcases, items, 'comfort');
    const placedIds = plan.suitcases[0]?.placements.map((p) => p.itemId);
    expect(placedIds).toEqual(['required']);
    expect(plan.unassigned.map((entry) => entry.item.id)).toEqual(['optional']);
  });

  it('is deterministic so a refresh reproduces the same arrangement', () => {
    const suitcases = [named('a'), named('b', { length: 14 })];
    const items = [item('x'), item('y', { suitcaseId: 'b' }), item('z', { mustHave: true }), item('w')];
    expect(packAcrossSuitcases(suitcases, items, 'shopping')).toEqual(packAcrossSuitcases(suitcases, items, 'shopping'));
  });
});
