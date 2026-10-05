import { createSampleSnapshot } from '../core/sample-data';
import { generatePlans } from '../core/plan-service';
import type { PackingItem, PackingSnapshot, PlanMode, Suitcase } from '../core/models';
import type { LoadResult, PlannerRepository } from '../ports/planner-repository.port';

const KEY = 'c2c-004.planner';
const MODES: PlanMode[] = ['minimal', 'comfort', 'shopping'];

/** 兼容旧版单箱快照，并兜底补齐缺失的方案结果。 */
function migrate(raw: unknown): PackingSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Partial<PackingSnapshot> & { suitcase?: Omit<Suitcase, 'id' | 'name'> };
  let suitcases: Suitcase[] | undefined;
  if (Array.isArray(value.suitcases) && value.suitcases.length) {
    suitcases = value.suitcases.map((suitcase, index) => ({
      id: suitcase.id || `suitcase-${index + 1}`,
      name: suitcase.name || `行李箱 ${index + 1}`,
      length: suitcase.length, width: suitcase.width, height: suitcase.height, maxWeight: suitcase.maxWeight,
    }));
  } else if (value.suitcase && typeof value.suitcase === 'object') {
    suitcases = [{ id: 'main', name: '行李箱', ...value.suitcase }];
  }
  if (!suitcases || !Array.isArray(value.items)) return undefined;
  const known = new Set(suitcases.map((suitcase) => suitcase.id));
  const items: PackingItem[] = value.items.map((item) => ({
    ...item,
    suitcaseId: item.suitcaseId && known.has(item.suitcaseId) ? item.suitcaseId : undefined,
  }));
  const selectedPlan = MODES.includes(value.selectedPlan as PlanMode) ? value.selectedPlan as PlanMode : 'comfort';
  const plans = value.plans && MODES.every((mode) => value.plans?.[mode]?.boxes) ? value.plans : generatePlans(suitcases, items);
  return { suitcases, items, selectedPlan, plans };
}

export class LocalPlannerRepository implements PlannerRepository {
  constructor(private readonly storage: Storage) {}

  load(): LoadResult<PackingSnapshot> {
    const raw = this.storage.getItem(KEY);
    if (!raw) return { value: createSampleSnapshot() };
    try {
      const migrated = migrate(JSON.parse(raw));
      if (migrated) return { value: migrated };
      return { value: createSampleSnapshot(), warning: '本地数据无法读取，已恢复示例。' };
    } catch {
      return { value: createSampleSnapshot(), warning: '本地数据无法读取，已恢复示例。' };
    }
  }

  save(snapshot: PackingSnapshot): void {
    this.storage.setItem(KEY, JSON.stringify(snapshot));
  }
}
