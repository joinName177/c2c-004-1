import { describe, expect, it } from 'vitest';
import { applySuitcaseRemoval, previewSuitcaseRemoval } from '../suitcase-removal';
import { generatePlans } from '../plan-service';
import type { PackingItem, PackingSnapshot, Suitcase } from '../models';

const big: Suitcase = { id: 'big', name: '大箱', length: 10, width: 8, height: 6, maxWeight: 10 };
const small: Suitcase = { id: 'small', name: '小箱', length: 4, width: 3, height: 2, maxWeight: 2 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: id, category: '衣物', length: 3, width: 2, height: 1, weight: 1, priority: 2, mustHave: false, ...overrides,
});

function snapshot(items: PackingItem[], suitcases: Suitcase[] = [big, small]): PackingSnapshot {
  return { suitcases, items, selectedPlan: 'comfort', plans: generatePlans(suitcases, items) };
}

describe('previewSuitcaseRemoval', () => {
  it('reassigns affected items to remaining suitcases without touching other assignments', () => {
    const items = [item('keep', { suitcaseId: 'big' }), item('move-me', { suitcaseId: 'small' }), item('loose')];
    const state = snapshot(items);
    const preview = previewSuitcaseRemoval(state, 'small')!;
    expect(preview.suitcase.id).toBe('small');
    const move = preview.moves.find((entry) => entry.item.id === 'move-me');
    expect(move?.toSuitcaseId).toBe('big');
    expect(preview.moves.some((entry) => entry.item.id === 'keep')).toBe(false);
    // 预览不修改原状态
    expect(state.items.find((entry) => entry.id === 'move-me')?.suitcaseId).toBe('small');
  });

  it('includes items currently placed in the suitcase even if system-assigned', () => {
    const state = snapshot([item('auto')]);
    expect(state.plans.comfort.boxes.flatMap((box) => box.placements).length).toBe(1);
    const placedIn = state.plans.comfort.boxes.find((box) => box.placements.length)?.suitcaseId!;
    const preview = previewSuitcaseRemoval(state, placedIn)!;
    expect(preview.moves.map((entry) => entry.item.id)).toContain('auto');
  });

  it('reports items that cannot fit anywhere after removal', () => {
    const items = [item('huge', { suitcaseId: 'big', length: 30 })];
    const state = snapshot(items);
    const preview = previewSuitcaseRemoval(state, 'big')!;
    const move = preview.moves.find((entry) => entry.item.id === 'huge');
    expect(move?.toSuitcaseId).toBeUndefined();
    expect(move?.reason).toBeTruthy();
  });

  it('flags when no suitcase remains', () => {
    const state = snapshot([item('only')], [big]);
    const preview = previewSuitcaseRemoval(state, 'big')!;
    expect(preview.hasRemainingSuitcase).toBe(false);
  });

  it('returns undefined for an unknown suitcase', () => {
    expect(previewSuitcaseRemoval(snapshot([]), 'ghost')).toBeUndefined();
  });
});

describe('applySuitcaseRemoval', () => {
  it('removes the suitcase and clears assignments in one step', () => {
    const items = [item('a', { suitcaseId: 'small' }), item('b', { suitcaseId: 'big' }), item('c')];
    const next = applySuitcaseRemoval(snapshot(items), 'small');
    expect(next.suitcases.map((suitcase) => suitcase.id)).toEqual(['big']);
    expect(next.items.find((entry) => entry.id === 'a')?.suitcaseId).toBeUndefined();
    expect(next.items.find((entry) => entry.id === 'b')?.suitcaseId).toBe('big');
    expect(next.items.find((entry) => entry.id === 'c')?.suitcaseId).toBeUndefined();
  });
});
