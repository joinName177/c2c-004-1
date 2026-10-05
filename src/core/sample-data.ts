import type { PackingItem, PackingSnapshot } from './models';
import { generatePlans } from './plan-service';

const seed = (id: string, name: string, category: string, dimensions: [number, number, number], weight: number, priority: 1 | 2 | 3, mustHave = false, fragile = false, suitcaseId?: string): PackingItem => ({
  id, name, category, length: dimensions[0], width: dimensions[1], height: dimensions[2], weight, priority, mustHave, fragile, suitcaseId,
});

export function createSampleSnapshot(): PackingSnapshot {
  const snapshot = {
    suitcases: [
      { id: 'checked', name: '托运大箱', length: 68, width: 45, height: 26, maxWeight: 20 },
      { id: 'cabin', name: '登机箱', length: 52, width: 35, height: 23, maxWeight: 10 },
    ],
    selectedPlan: 'comfort' as const,
    items: [
      seed('jacket', '轻薄外套', '衣物', [30, 24, 5], 0.65, 3, true),
      seed('shoes', '运动鞋', '鞋履', [31, 20, 12], 0.9, 3, true),
      seed('camera', '微单相机', '数码', [18, 14, 10], 0.72, 2, false, true, 'cabin'),
      seed('toiletry', '洗漱包', '洗护', [22, 14, 8], 0.48, 3, true),
      seed('kid-clothes', '儿童换洗衣物', '衣物', [28, 22, 9], 0.8, 3, true),
      seed('medicine', '常备药盒', '随身', [15, 10, 6], 0.3, 3, true, false, 'cabin'),
      seed('book', '旅行读物', '随身', [21, 15, 2], 0.38, 1),
      seed('gifts', '伴手礼预留盒', '预留', [24, 18, 9], 0.2, 1),
    ],
  };
  return { ...snapshot, plans: generatePlans(snapshot.suitcases, snapshot.items) };
}
