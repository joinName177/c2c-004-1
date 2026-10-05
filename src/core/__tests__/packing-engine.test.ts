import { describe, expect, it } from 'vitest';
import { packAcrossSuitcases, packItems, validateSuitcase } from '../packing-engine';
import type { PackingItem, Suitcase } from '../models';

const suitcase = (overrides: Partial<Suitcase> = {}): Suitcase => ({ id: 'box', name: '箱子', length: 10, width: 8, height: 6, maxWeight: 10, ...overrides });
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
  const big = suitcase({ id: 'big', name: '大箱' });
  const small = suitcase({ id: 'small', name: '小箱', length: 4, width: 3, height: 2, maxWeight: 2 });

  it('distributes unassigned items across suitcases without double packing or double counting', () => {
    const items = Array.from({ length: 6 }, (_, index) => item(`i-${index}`));
    const plan = packAcrossSuitcases([big, small], items, 'comfort');
    const placedIds = plan.boxes.flatMap((box) => box.placements.map((p) => p.itemId));
    expect(new Set(placedIds).size).toBe(placedIds.length);
    expect(placedIds.length + plan.unplaced.length).toBe(items.length);
    expect(plan.totalWeight).toBe(plan.boxes.reduce((sum, box) => sum + box.totalWeight, 0));
    expect(placedIds.length).toBeGreaterThan(0);
  });

  it('keeps user-assigned items in their suitcase even when another has room', () => {
    const plan = packAcrossSuitcases([big, small], [item('mine', { suitcaseId: 'small' })], 'comfort');
    expect(plan.boxes.find((box) => box.suitcaseId === 'small')?.placements.map((p) => p.itemId)).toEqual(['mine']);
    expect(plan.boxes.find((box) => box.suitcaseId === 'big')?.placements).toHaveLength(0);
  });

  it('never moves an assigned item that does not fit, and reports the reason', () => {
    const oversized = item('too-big', { suitcaseId: 'small', length: 30 });
    const plan = packAcrossSuitcases([big, small], [oversized], 'comfort');
    const smallBox = plan.boxes.find((box) => box.suitcaseId === 'small')!;
    expect(smallBox.placements).toHaveLength(0);
    expect(smallBox.unplaced[0]?.item.id).toBe('too-big');
    expect(smallBox.unplaced[0]?.reason).toContain('小箱');
    expect(plan.boxes.find((box) => box.suitcaseId === 'big')?.placements).toHaveLength(0);
  });

  it('keeps other suitcases results when one overflows, and lists per-item reasons', () => {
    const items = [item('assigned-ok', { suitcaseId: 'big' }), item('assigned-heavy', { suitcaseId: 'small', weight: 5 }), item('loose')];
    const plan = packAcrossSuitcases([big, small], items, 'comfort');
    const bigBox = plan.boxes.find((box) => box.suitcaseId === 'big')!;
    const smallBox = plan.boxes.find((box) => box.suitcaseId === 'small')!;
    expect(bigBox.placements.map((p) => p.itemId)).toContain('assigned-ok');
    expect(smallBox.unplaced[0]?.item.id).toBe('assigned-heavy');
    expect(smallBox.unplaced[0]?.reason).toContain('承重');
    // 未指定物品仍被装入且只装入一次
    expect(plan.boxes.flatMap((box) => box.placements).filter((p) => p.itemId === 'loose')).toHaveLength(1);
  });

  it('packs must-have items before optional ones across suitcases', () => {
    const items = [item('optional', { weight: 9 }), item('vital', { mustHave: true, weight: 9 })];
    const plan = packAcrossSuitcases([suitcase({ maxWeight: 10 })], items, 'comfort');
    expect(plan.boxes[0]!.placements.map((p) => p.itemId)).toEqual(['vital']);
    expect(plan.unplaced[0]?.item.id).toBe('optional');
  });

  it('reports items assigned to a missing suitcase as unplaced', () => {
    const plan = packAcrossSuitcases([big], [item('ghost', { suitcaseId: 'gone' })], 'comfort');
    expect(plan.unplaced[0]?.item.id).toBe('ghost');
    expect(plan.unplaced[0]?.reason).toContain('不存在');
  });

  it('is deterministic for the same inputs', () => {
    const items = [item('a'), item('b', { suitcaseId: 'small' }), item('c', { mustHave: true })];
    expect(packAcrossSuitcases([big, small], items, 'minimal')).toEqual(packAcrossSuitcases([big, small], items, 'minimal'));
  });
});
