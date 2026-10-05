import { describe, expect, it } from 'vitest';
import { generatePlans } from '../plan-service';
import type { PackingItem, Suitcase } from '../models';

const box: Suitcase = { id: 'box', name: '箱子', length: 10, width: 8, height: 6, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({ id, name: id, category: '衣物', length: 4, width: 2, height: 2, weight: 1, priority: 1, mustHave: false, ...overrides });

describe('generatePlans', () => {
  it('creates three named strategies', () => {
    const plans = generatePlans([box], [item('coat')]);
    expect(Object.keys(plans)).toEqual(['minimal', 'comfort', 'shopping']);
    expect(Object.values(plans).map((plan) => plan.name)).toEqual(['精简版', '舒适版', '购物版']);
  });

  it('places must-have and high-priority items first', () => {
    const plans = generatePlans([box], [item('low'), item('must', { mustHave: true }), item('high', { priority: 3 })]);
    expect(plans.comfort.boxes[0]!.placements.map((p) => p.itemId).slice(0, 2)).toEqual(['must', 'high']);
  });

  it('shopping mode reserves more free capacity than comfort mode', () => {
    const items = Array.from({ length: 8 }, (_, index) => item(`item-${index}`, { length: 5, width: 3, height: 2 }));
    const plans = generatePlans([box], items);
    expect(plans.shopping.usedVolume).toBeLessThanOrEqual(plans.comfort.usedVolume);
    expect(plans.shopping.unplaced.length).toBeGreaterThanOrEqual(plans.comfort.unplaced.length);
  });

  it('plans jointly across multiple suitcases for every strategy', () => {
    const small: Suitcase = { id: 'small', name: '小箱', length: 5, width: 4, height: 3, maxWeight: 3 };
    const items = Array.from({ length: 10 }, (_, index) => item(`item-${index}`));
    const plans = generatePlans([box, small], items);
    for (const plan of Object.values(plans)) {
      expect(plan.boxes.map((b) => b.suitcaseId)).toEqual(['box', 'small']);
      const placed = plan.boxes.reduce((sum, b) => sum + b.placements.length, 0);
      expect(placed).toBeGreaterThan(0);
    }
  });
});
