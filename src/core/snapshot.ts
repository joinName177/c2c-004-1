import type { PackingItem, PackingSnapshot, SuitcaseConfig } from './models';

const PLAN_MODES = ['minimal', 'comfort', 'shopping'] as const;

function normalizeSuitcases(raw: unknown): SuitcaseConfig[] | null {
  if (!Array.isArray(raw)) return null;
  const suitcases: SuitcaseConfig[] = [];
  for (const entry of raw) {
    const candidate = entry as Partial<SuitcaseConfig>;
    if (!candidate || typeof candidate !== 'object') return null;
    const { length, width, height, maxWeight } = candidate;
    if (![length, width, height, maxWeight].every((value) => typeof value === 'number')) return null;
    suitcases.push({
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `case-${suitcases.length + 1}`,
      name: typeof candidate.name === 'string' && candidate.name ? candidate.name : `箱子 ${suitcases.length + 1}`,
      length: length as number,
      width: width as number,
      height: height as number,
      maxWeight: maxWeight as number,
    });
  }
  return suitcases;
}

/**
 * 读取本地快照时做兼容处理：
 * - 旧版单箱数据（suitcase 字段）迁移为 suitcases 数组；
 * - 物品指向已不存在箱子的指定会被清空，交回系统分配。
 */
export function normalizeSnapshot(raw: unknown): PackingSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<PackingSnapshot> & { suitcase?: { length: number; width: number; height: number; maxWeight: number } };

  let suitcases = normalizeSuitcases(candidate.suitcases);
  if (!suitcases && candidate.suitcase && typeof candidate.suitcase === 'object') {
    suitcases = normalizeSuitcases([{ id: 'case-1', name: '行李箱', ...candidate.suitcase }]);
  }
  if (!suitcases || !Array.isArray(candidate.items)) return null;

  const known = new Set(suitcases.map((suitcase) => suitcase.id));
  const items: PackingItem[] = (candidate.items as PackingItem[])
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({
      ...item,
      suitcaseId: item.suitcaseId && known.has(item.suitcaseId) ? item.suitcaseId : undefined,
    }));

  const selectedPlan = PLAN_MODES.includes(candidate.selectedPlan as (typeof PLAN_MODES)[number])
    ? (candidate.selectedPlan as PackingSnapshot['selectedPlan'])
    : 'comfort';

  return { suitcases, items, selectedPlan };
}
