import { describe, expect, it } from 'vitest';
import { createSampleSnapshot } from '../../core/sample-data';
import { usePlanner } from '../usePlanner';
import type { PackingSnapshot } from '../../core/models';
import type { PlannerRepository } from '../../ports/planner-repository.port';

class MemoryRepository implements PlannerRepository {
  saved?: PackingSnapshot;
  saveCount = 0;
  constructor(private snapshot = createSampleSnapshot()) {}
  load() { return { value: structuredClone(this.snapshot) }; }
  save(snapshot: PackingSnapshot) { this.saved = structuredClone(snapshot); this.saveCount += 1; }
}

describe('usePlanner', () => {
  it('adds, updates and removes items while marking results stale', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    const initial = planner.state.items.length;
    planner.addItem({ id: 'new', name: '帽子', category: '衣物', length: 12, width: 12, height: 5, weight: 0.2, priority: 2, mustHave: false });
    expect(planner.state.items).toHaveLength(initial + 1);
    expect(planner.isStale.value).toBe(true);
    planner.updateItem('new', { name: '遮阳帽' });
    expect(planner.state.items.find((item) => item.id === 'new')?.name).toBe('遮阳帽');
    planner.removeItem('new');
    expect(planner.state.items).toHaveLength(initial);
  });

  it('regenerates plans and persists the selected mode', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    planner.updateSuitcase('case-carry', { maxWeight: 12 });
    expect(planner.isStale.value).toBe(true);
    planner.regenerate();
    planner.selectPlan('shopping');
    expect(planner.isStale.value).toBe(false);
    expect(planner.plans.value.shopping.name).toBe('购物版');
    expect(repository.saved?.selectedPlan).toBe('shopping');
  });

  it('assigns an item to a suitcase and keeps the pin after regeneration', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    planner.assignItem('jacket', 'case-check');
    planner.regenerate();
    const plan = planner.plans.value.comfort;
    expect(plan.suitcases.find((entry) => entry.suitcaseId === 'case-check')?.placements.map((p) => p.itemId)).toContain('jacket');
    expect(planner.state.items.find((item) => item.id === 'jacket')?.suitcaseId).toBe('case-check');
  });

  it('adds a suitcase and marks plans stale', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    planner.addSuitcase();
    expect(planner.state.suitcases).toHaveLength(3);
    expect(planner.isStale.value).toBe(true);
  });

  it('previews removal without mutating state', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    const before = JSON.stringify(planner.state);
    const preview = planner.previewRemoveSuitcase('case-carry');
    expect(preview?.suitcase.id).toBe('case-carry');
    expect(preview?.outcomes.length).toBeGreaterThan(0);
    expect(preview?.outcomes.find((outcome) => outcome.item.id === 'camera')?.wasPinned).toBe(true);
    expect(JSON.stringify(planner.state)).toBe(before);
  });

  it('confirms removal in one save: suitcase gone, pins cleared, results recomputed', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    const savesBefore = repository.saveCount;
    planner.confirmRemoveSuitcase('case-carry');
    expect(repository.saveCount).toBe(savesBefore + 1);
    expect(planner.state.suitcases.map((suitcase) => suitcase.id)).toEqual(['case-check']);
    expect(planner.state.items.every((item) => item.suitcaseId !== 'case-carry')).toBe(true);
    expect(planner.currentPlan.value.suitcases).toHaveLength(1);
    expect(planner.isStale.value).toBe(false);
    const placedIds = planner.currentPlan.value.suitcases.flatMap((entry) => entry.placements.map((p) => p.itemId));
    expect(new Set(placedIds).size).toBe(placedIds.length);
  });

  it('reproduces the same arrangement after a simulated reload', () => {
    const repository = new MemoryRepository();
    const first = usePlanner({ repository, printPort: { print() {} } });
    first.regenerate();
    const reloaded = usePlanner({ repository: { load: () => ({ value: structuredClone(repository.saved!) }), save() {} }, printPort: { print() {} } });
    expect(reloaded.plans.value).toEqual(first.plans.value);
  });
});
