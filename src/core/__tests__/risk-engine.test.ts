import { describe, expect, it } from 'vitest';
import { detectRisks } from '../risk-engine';
import type { MultiPackingPlan, PackingItem, SuitcaseConfig, SuitcasePlan } from '../models';

const suitcase: SuitcaseConfig = { id: 'case-1', name: '登机箱', length: 10, width: 8, height: 6, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({ id, name: id, category: '其他', length: 2, width: 2, height: 2, weight: 1, priority: 2, mustHave: false, ...overrides });
const suitcasePlan = (overrides: Partial<SuitcasePlan> = {}): SuitcasePlan => ({ suitcaseId: 'case-1', placements: [], unplaced: [], totalWeight: 0, usedVolume: 0, capacityRatio: 0, ...overrides });
const basePlan = (suitcases: SuitcasePlan[] = [suitcasePlan()], unassigned: MultiPackingPlan['unassigned'] = []): MultiPackingPlan => ({
  id: 'comfort', name: '舒适版', suitcases, unassigned,
  totalWeight: suitcases.reduce((sum, entry) => sum + entry.totalWeight, 0),
  usedVolume: suitcases.reduce((sum, entry) => sum + entry.usedVolume, 0),
  capacityRatio: 0,
});

describe('detectRisks', () => {
  it('reports overweight and high volume per suitcase', () => {
    const plan = basePlan([suitcasePlan({ totalWeight: 11, usedVolume: 460, capacityRatio: 0.96 })]);
    expect(detectRisks(plan, [suitcase], []).map((risk) => risk.id)).toEqual(expect.arrayContaining(['case-1-overweight', 'case-1-high-volume']));
  });

  it('reports an oversized pinned item that does not fit its suitcase', () => {
    const huge = item('huge', { length: 11, suitcaseId: 'case-1' });
    const plan = basePlan([suitcasePlan({ unplaced: [{ item: huge, reason: '指定箱子放不下：没有可用的连续空间' }] })]);
    expect(detectRisks(plan, [suitcase], [huge]).some((risk) => risk.id === 'case-1-oversized-huge')).toBe(true);
  });

  it('reports fragile items with a box stacked above', () => {
    const glass = item('glass', { fragile: true });
    const top = item('top');
    const plan = basePlan([suitcasePlan({ placements: [
      { itemId: 'glass', x: 0, y: 0, z: 0, dimensions: { length: 2, width: 2, height: 2 } },
      { itemId: 'top', x: 0, y: 0, z: 2, dimensions: { length: 2, width: 2, height: 2 } },
    ] })]);
    expect(detectRisks(plan, [suitcase], [glass, top]).some((risk) => risk.id === 'case-1-fragile-glass')).toBe(true);
  });

  it('reports heavy items placed high', () => {
    const heavy = item('heavy', { weight: 4 });
    const plan = basePlan([suitcasePlan({ placements: [{ itemId: 'heavy', x: 0, y: 0, z: 4, dimensions: { length: 2, width: 2, height: 2 } }] })]);
    expect(detectRisks(plan, [suitcase], [heavy]).some((risk) => risk.id === 'case-1-high-heavy')).toBe(true);
  });

  it('marks an unassigned must-have item as critical', () => {
    const required = item('passport', { mustHave: true });
    const plan = basePlan([suitcasePlan()], [{ item: required, reason: '无法装入任何箱子' }]);
    expect(detectRisks(plan, [suitcase], [required])).toContainEqual(expect.objectContaining({ id: 'missing-passport', severity: 'critical' }));
  });

  it('flags items too large for every suitcase', () => {
    const huge = item('huge', { length: 30 });
    const plan = basePlan([suitcasePlan()], [{ item: huge, reason: '无法装入任何箱子' }]);
    expect(detectRisks(plan, [suitcase], [huge]).some((risk) => risk.id === 'oversized-huge')).toBe(true);
  });
});
