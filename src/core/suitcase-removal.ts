import { packAcrossSuitcases } from './packing-engine';
import type { PackingItem, PackingSnapshot, Suitcase } from './models';

export interface RemovalMove {
  item: PackingItem;
  /** 重新分配后落入的箱子；undefined 表示没有任何箱子能容纳。 */
  toSuitcaseId?: string;
  reason?: string;
}

export interface RemovalPreview {
  suitcase: Suitcase;
  /** 受影响的物品及其去向（保持当前选中策略口径）。 */
  moves: RemovalMove[];
  /** 删除后是否还有可用行李箱。 */
  hasRemainingSuitcase: boolean;
}

/**
 * 删除行李箱前的重新分配预览：
 * 被删箱子中“用户指定”与“当前方案装入”的物品都会解除指定，按当前策略在剩余箱子中重新分配；
 * 其他箱子的指定关系不变。该函数只试算，不修改任何状态。
 */
export function previewSuitcaseRemoval(snapshot: PackingSnapshot, suitcaseId: string): RemovalPreview | undefined {
  const suitcase = snapshot.suitcases.find((candidate) => candidate.id === suitcaseId);
  if (!suitcase) return undefined;
  const remaining = snapshot.suitcases.filter((candidate) => candidate.id !== suitcaseId);
  const plan = snapshot.plans[snapshot.selectedPlan];
  const affectedIds = new Set<string>();
  for (const item of snapshot.items) if (item.suitcaseId === suitcaseId) affectedIds.add(item.id);
  for (const placement of plan?.boxes.find((box) => box.suitcaseId === suitcaseId)?.placements ?? []) affectedIds.add(placement.itemId);

  const items = snapshot.items.map((item) => affectedIds.has(item.id) ? { ...item, suitcaseId: undefined } : item);
  const trial = packAcrossSuitcases(remaining, items, snapshot.selectedPlan);
  const moves: RemovalMove[] = [];
  for (const itemId of affectedIds) {
    const item = snapshot.items.find((candidate) => candidate.id === itemId);
    if (!item) continue;
    const box = trial.boxes.find((candidate) => candidate.placements.some((placement) => placement.itemId === itemId));
    if (box) {
      moves.push({ item, toSuitcaseId: box.suitcaseId });
    } else {
      const missed = trial.unplaced.find((entry) => entry.item.id === itemId)
        ?? trial.boxes.flatMap((candidate) => candidate.unplaced).find((entry) => entry.item.id === itemId);
      moves.push({ item, reason: missed?.reason ?? '没有可用的行李箱' });
    }
  }
  moves.sort((a, b) => Number(b.item.mustHave) - Number(a.item.mustHave) || a.item.id.localeCompare(b.item.id));
  return { suitcase, moves, hasRemainingSuitcase: remaining.length > 0 };
}

/** 确认删除：一次性返回删除箱子、解除物品指定后的新箱子列表与物品清单（纯函数，由控制器统一保存）。 */
export function applySuitcaseRemoval(snapshot: PackingSnapshot, suitcaseId: string): { suitcases: Suitcase[]; items: PackingItem[] } {
  return {
    suitcases: snapshot.suitcases.filter((candidate) => candidate.id !== suitcaseId),
    items: snapshot.items.map((item) => item.suitcaseId === suitcaseId ? { ...item, suitcaseId: undefined } : item),
  };
}
