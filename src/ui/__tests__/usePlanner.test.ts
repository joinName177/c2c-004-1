import { describe, expect, it } from 'vitest';
import { createSampleSnapshot } from '../../core/sample-data';
import { usePlanner } from '../usePlanner';
import type { PackingSnapshot } from '../../core/models';
import type { PlannerRepository } from '../../ports/planner-repository.port';

class MemoryRepository implements PlannerRepository {
  saved?: PackingSnapshot;
  constructor(private snapshot = createSampleSnapshot()) {}
  load() { return { value: structuredClone(this.snapshot) }; }
  save(snapshot: PackingSnapshot) { this.saved = structuredClone(snapshot); }
}

const create = (repository: MemoryRepository) => usePlanner({ repository, printPort: { print() {} } });

describe('usePlanner', () => {
  it('adds, updates and removes items while marking results stale', () => {
    const repository = new MemoryRepository();
    const planner = create(repository);
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
    const planner = create(repository);
    planner.updateSuitcase(planner.state.suitcases[0]!.id, { maxWeight: 12 });
    expect(planner.isStale.value).toBe(true);
    planner.regenerate();
    planner.selectPlan('shopping');
    expect(planner.isStale.value).toBe(false);
    expect(planner.plans.value.shopping.name).toBe('购物版');
    expect(repository.saved?.selectedPlan).toBe('shopping');
  });

  it('assigns an item to a suitcase and keeps the assignment after regenerate', () => {
    const repository = new MemoryRepository();
    const planner = create(repository);
    const target = planner.state.suitcases[1]!.id;
    planner.assignItem('jacket', target);
    planner.regenerate();
    const box = planner.plans.value.comfort.boxes.find((candidate) => candidate.suitcaseId === target)!;
    expect(box.placements.map((placement) => placement.itemId)).toContain('jacket');
    expect(repository.saved?.items.find((item) => item.id === 'jacket')?.suitcaseId).toBe(target);
  });

  it('restores persisted plans on reload so the arrangement survives refresh', () => {
    const repository = new MemoryRepository();
    const first = create(repository);
    first.regenerate();
    const savedPlans = repository.saved!.plans;
    const second = usePlanner({ repository: { load: () => ({ value: structuredClone(repository.saved!) }), save() {} }, printPort: { print() {} } });
    expect(second.plans.value).toEqual(savedPlans);
  });

  it('deletes an empty suitcase immediately without a preview', () => {
    const repository = new MemoryRepository();
    const planner = create(repository);
    planner.addSuitcase();
    const added = planner.state.suitcases[planner.state.suitcases.length - 1]!;
    planner.requestRemoveSuitcase(added.id);
    expect(planner.pendingRemoval.value).toBeNull();
    expect(planner.state.suitcases.some((suitcase) => suitcase.id === added.id)).toBe(false);
  });

  it('previews reallocation before deleting an occupied suitcase, then saves everything on confirm', () => {
    const repository = new MemoryRepository();
    const planner = create(repository);
    const cabin = planner.state.suitcases.find((suitcase) => suitcase.id === 'cabin')!;
    planner.requestRemoveSuitcase(cabin.id);
    const preview = planner.pendingRemoval.value;
    expect(preview?.suitcase.id).toBe('cabin');
    expect(preview?.moves.length).toBeGreaterThan(0);
    // 预览阶段不改动状态
    expect(planner.state.suitcases.some((suitcase) => suitcase.id === 'cabin')).toBe(true);
    planner.confirmRemoveSuitcase();
    expect(planner.pendingRemoval.value).toBeNull();
    expect(planner.state.suitcases.map((suitcase) => suitcase.id)).toEqual(['checked']);
    expect(planner.state.items.every((item) => item.suitcaseId !== 'cabin')).toBe(true);
    // 一次保存：箱子、物品归属和三套方案一致
    expect(repository.saved?.suitcases.map((suitcase) => suitcase.id)).toEqual(['checked']);
    expect(repository.saved?.plans.comfort.boxes.map((box) => box.suitcaseId)).toEqual(['checked']);
    const placedIds = repository.saved!.plans.comfort.boxes.flatMap((box) => box.placements.map((placement) => placement.itemId));
    expect(new Set(placedIds).size).toBe(placedIds.length);
  });

  it('cancelling the preview keeps the suitcase and assignments untouched', () => {
    const repository = new MemoryRepository();
    const planner = create(repository);
    planner.requestRemoveSuitcase('cabin');
    expect(planner.pendingRemoval.value).not.toBeNull();
    planner.cancelRemoveSuitcase();
    expect(planner.pendingRemoval.value).toBeNull();
    expect(planner.state.suitcases.some((suitcase) => suitcase.id === 'cabin')).toBe(true);
    expect(planner.state.items.find((item) => item.id === 'camera')?.suitcaseId).toBe('cabin');
  });
});
