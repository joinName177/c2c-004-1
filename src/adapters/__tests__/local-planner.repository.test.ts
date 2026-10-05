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

  it('round trips a planning snapshot', () => {
    const repo = new LocalPlannerRepository(storage);
    const sample = createSampleSnapshot();
    const snapshot = { ...sample, suitcases: sample.suitcases.map((s, i) => (i === 0 ? { ...s, length: 61 } : s)) };
    repo.save(snapshot);
    expect(repo.load().value.suitcases[0]?.length).toBe(61);
  });

  it('keeps item assignments through a reload', () => {
    const repo = new LocalPlannerRepository(storage);
    const sample = createSampleSnapshot();
    repo.save(sample);
    const loaded = repo.load().value;
    const camera = loaded.items.find((item) => item.id === 'camera');
    expect(camera?.suitcaseId).toBe('case-carry');
  });

  it('migrates legacy single-suitcase snapshots', () => {
    storage.setItem('c2c-004.planner', JSON.stringify({
      suitcase: { length: 50, width: 30, height: 20, maxWeight: 12 },
      selectedPlan: 'minimal',
      items: [{ id: 'coat', name: '外套', category: '衣物', length: 10, width: 10, height: 5, weight: 1, priority: 2, mustHave: true }],
    }));
    const result = new LocalPlannerRepository(storage).load();
    expect(result.warning).toBeUndefined();
    expect(result.value.suitcases).toHaveLength(1);
    expect(result.value.suitcases[0]?.length).toBe(50);
    expect(result.value.selectedPlan).toBe('minimal');
  });

  it('clears assignments pointing at deleted suitcases', () => {
    storage.setItem('c2c-004.planner', JSON.stringify({
      suitcases: [{ id: 'case-1', name: '登机箱', length: 50, width: 30, height: 20, maxWeight: 12 }],
      selectedPlan: 'comfort',
      items: [{ id: 'coat', name: '外套', category: '衣物', length: 10, width: 10, height: 5, weight: 1, priority: 2, mustHave: true, suitcaseId: 'gone' }],
    }));
    const result = new LocalPlannerRepository(storage).load();
    expect(result.value.items[0]?.suitcaseId).toBeUndefined();
  });

  it('returns sample data when storage is empty', () => {
    const result = new LocalPlannerRepository(storage).load();
    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.warning).toBeUndefined();
  });

  it('returns sample data and a warning for malformed JSON', () => {
    storage.setItem('c2c-004.planner', '{bad');
    const result = new LocalPlannerRepository(storage).load();
    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.warning).toContain('已恢复示例');
  });
});
