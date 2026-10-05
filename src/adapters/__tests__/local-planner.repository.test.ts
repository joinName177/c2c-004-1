import { beforeEach, describe, expect, it } from 'vitest';
import { LocalPlannerRepository } from '../local-planner.repository';
import { createSampleSnapshot } from '../../core/sample-data';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe('LocalPlannerRepository', () => {
  const storage = new MemoryStorage();
  beforeEach(() => storage.clear());

  it('round trips a planning snapshot including saved plans', () => {
    const repo = new LocalPlannerRepository(storage);
    const sample = createSampleSnapshot();
    const snapshot = { ...sample, suitcases: sample.suitcases.map((s, i) => i === 0 ? { ...s, length: 61 } : s) };
    repo.save(snapshot);
    const loaded = repo.load().value;
    expect(loaded.suitcases[0]!.length).toBe(61);
    expect(loaded.plans).toEqual(snapshot.plans);
  });

  it('returns sample data when storage is empty', () => {
    const result = new LocalPlannerRepository(storage).load();
    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.suitcases.length).toBeGreaterThan(0);
    expect(result.warning).toBeUndefined();
  });

  it('returns sample data and a warning for malformed JSON', () => {
    storage.setItem('c2c-004.planner', '{bad');
    const result = new LocalPlannerRepository(storage).load();
    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.warning).toContain('已恢复示例');
  });

  it('migrates a legacy single-suitcase snapshot', () => {
    storage.setItem('c2c-004.planner', JSON.stringify({
      suitcase: { length: 50, width: 30, height: 20, maxWeight: 12 },
      selectedPlan: 'minimal',
      items: [{ id: 'coat', name: '外套', category: '衣物', length: 30, width: 24, height: 5, weight: 0.6, priority: 3, mustHave: true }],
    }));
    const result = new LocalPlannerRepository(storage).load();
    expect(result.warning).toBeUndefined();
    expect(result.value.suitcases).toHaveLength(1);
    expect(result.value.suitcases[0]!.maxWeight).toBe(12);
    expect(result.value.selectedPlan).toBe('minimal');
    expect(result.value.plans.comfort.boxes).toHaveLength(1);
  });

  it('drops assignments pointing at unknown suitcases', () => {
    const sample = createSampleSnapshot();
    storage.setItem('c2c-004.planner', JSON.stringify({
      ...sample,
      items: sample.items.map((item) => ({ ...item, suitcaseId: 'ghost' })),
    }));
    const result = new LocalPlannerRepository(storage).load();
    expect(result.value.items.every((item) => item.suitcaseId === undefined)).toBe(true);
  });
});
