import { describe, expect, it } from 'vitest';
import { detectRisks } from '../risk-engine';
import type { PackingItem, PackingPlan, Suitcase, SuitcasePlan } from '../models';

const suitcase: Suitcase = { id: 'box', name: '主箱', length: 10, width: 8, height: 6, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({ id, name: id, category: '其他', length: 2, width: 2, height: 2, weight: 1, priority: 2, mustHave: false, ...overrides });
const boxPlan = (overrides: Partial<SuitcasePlan> = {}): SuitcasePlan => ({ suitcaseId: 'box', placements: [], unplaced: [], totalWeight: 0, usedVolume: 0, capacityRatio: 0, ...overrides });
const basePlan = (boxes: SuitcasePlan[] = [boxPlan()], unplaced: PackingPlan['unplaced'] = []): PackingPlan => ({
  id: 'comfort', name: '舒适版', boxes, unplaced,
  totalWeight: boxes.reduce((sum, box) => sum + box.totalWeight, 0),
  usedVolume: boxes.reduce((sum, box) => sum + box.usedVolume, 0),
  capacityRatio: 0,
});

describe('detectRisks', () => {
  it('reports overweight and high volume per suitcase', () => {
    const plan = basePlan([boxPlan({ totalWeight: 11, usedVolume: 460, capacityRatio: 0.96 })]);
    expect(detectRisks(plan, [suitcase], []).map((risk) => risk.id)).toEqual(expect.arrayContaining(['overweight-box', 'high-volume-box']));
  });

  it('reports an item that fits no suitcase as oversized', () => {
    const huge = item('huge', { length: 11 });
    const plan = basePlan([boxPlan()], [{ item: huge, reason: '没有可用的连续空间' }]);
    expect(detectRisks(plan, [suitcase], [huge]).some((risk) => risk.id === 'oversized-huge')).toBe(true);
  });

  it('does not call an item oversized when another suitcase can hold it', () => {
    const tall = item('tall', { length: 11 });
    const bigger: Suitcase = { ...suitcase, id: 'big', name: '大箱', length: 20 };
    const plan = basePlan([boxPlan()], [{ item: tall, reason: '没有可用的连续空间' }]);
    expect(detectRisks(plan, [suitcase, bigger], [tall]).some((risk) => risk.id === 'oversized-tall')).toBe(false);
  });

  it('reports fragile items with a box stacked above', () => {
    const glass = item('glass', { fragile: true });
    const top = item('top');
    const plan = basePlan([boxPlan({ placements: [
      { itemId: 'glass', x: 0, y: 0, z: 0, dimensions: { length: 2, width: 2, height: 2 } },
      { itemId: 'top', x: 0, y: 0, z: 2, dimensions: { length: 2, width: 2, height: 2 } },
    ] })]);
    expect(detectRisks(plan, [suitcase], [glass, top]).some((risk) => risk.id === 'fragile-glass')).toBe(true);
  });

  it('reports heavy items placed high', () => {
    const heavy = item('heavy', { weight: 4 });
    const plan = basePlan([boxPlan({ placements: [{ itemId: 'heavy', x: 0, y: 0, z: 4, dimensions: { length: 2, width: 2, height: 2 } }] })]);
    expect(detectRisks(plan, [suitcase], [heavy]).some((risk) => risk.id === 'high-heavy')).toBe(true);
  });

  it('marks an omitted must-have item as critical', () => {
    const required = item('passport', { mustHave: true });
    const plan = basePlan([boxPlan()], [{ item: required, reason: '空间不足' }]);
    expect(detectRisks(plan, [suitcase], [required])).toContainEqual(expect.objectContaining({ id: 'missing-passport', severity: 'critical' }));
  });

  it('flags box-specific unplaced reasons from assigned suitcases', () => {
    const stuck = item('stuck', { mustHave: true, suitcaseId: 'box' });
    const plan = basePlan([boxPlan({ unplaced: [{ item: stuck, reason: '指定装入「主箱」：超过当前方案承重预留' }] })]);
    expect(detectRisks(plan, [suitcase], [stuck]).some((risk) => risk.id === 'missing-stuck')).toBe(true);
  });

  it('warns when there is no suitcase at all', () => {
    const plan = basePlan([]);
    expect(detectRisks(plan, [], []).some((risk) => risk.id === 'no-suitcase')).toBe(true);
  });
});
