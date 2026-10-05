import { intersects, rotationsOf } from './geometry';
import {
  itemVolume,
  suitcaseVolume,
  type MultiPackingPlan,
  type PackingItem,
  type Placement,
  type PlanMode,
  type Suitcase,
  type SuitcaseConfig,
  type SuitcasePlan,
  type UnplacedItem,
} from './models';

const PLAN_NAMES: Record<PlanMode, string> = { minimal: '精简版', comfort: '舒适版', shopping: '购物版' };
const RESERVE: Record<PlanMode, number> = { minimal: 0.8, comfort: 1, shopping: 0.65 };

export function validateSuitcase(suitcase: Suitcase): string[] {
  const errors: string[] = [];
  if (!(suitcase.length > 0)) errors.push('行李箱长度必须大于 0');
  if (!(suitcase.width > 0)) errors.push('行李箱宽度必须大于 0');
  if (!(suitcase.height > 0)) errors.push('行李箱高度必须大于 0');
  if (!(suitcase.maxWeight > 0)) errors.push('承重必须大于 0');
  return errors;
}

function ordered(items: PackingItem[], mode: PlanMode): PackingItem[] {
  return [...items].sort((a, b) => {
    const required = Number(b.mustHave) - Number(a.mustHave);
    if (required) return required;
    const priority = b.priority - a.priority;
    if (priority) return priority;
    const tiebreak = mode === 'shopping' ? a.weight - b.weight : itemVolume(b) - itemVolume(a);
    return tiebreak || a.id.localeCompare(b.id);
  });
}

function candidatePoints(placements: Placement[]) {
  const points = [{ x: 0, y: 0, z: 0 }];
  for (const p of placements) {
    points.push(
      { x: p.x + p.dimensions.length, y: p.y, z: p.z },
      { x: p.x, y: p.y + p.dimensions.width, z: p.z },
      { x: p.x, y: p.y, z: p.z + p.dimensions.height },
    );
  }
  return points.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
}

type PlaceFailure = 'invalid' | 'weight' | 'volume' | 'space';

const FAILURE_REASONS: Record<PlaceFailure, string> = {
  invalid: '尺寸或重量无效',
  weight: '超过当前方案承重预留',
  volume: '超过当前方案空间预留',
  space: '没有可用的连续空间',
};

export function failureReason(failure: PlaceFailure): string {
  return FAILURE_REASONS[failure];
}

function isInvalid(item: PackingItem): boolean {
  return [item.length, item.width, item.height, item.weight].some((value) => !(value > 0));
}

/**
 * 单个箱子的增量装箱器。tryPlace 失败时不改变内部状态，
 * 因此可以安全地在多个箱子间依次尝试同一件物品。
 */
class SuitcasePacker {
  readonly placements: Placement[] = [];
  totalWeight = 0;
  usedVolume = 0;

  private readonly capacity: number;
  private readonly maxWeight: number;

  constructor(private readonly suitcase: Suitcase, mode: PlanMode) {
    this.capacity = suitcaseVolume(suitcase) * RESERVE[mode];
    this.maxWeight = suitcase.maxWeight * RESERVE[mode];
  }

  get freeCapacity(): number {
    return this.capacity - this.usedVolume;
  }

  tryPlace(item: PackingItem): { placement?: Placement; failure?: PlaceFailure } {
    if (isInvalid(item)) return { failure: 'invalid' };
    if (this.totalWeight + item.weight > this.maxWeight) return { failure: 'weight' };
    if (this.usedVolume + itemVolume(item) > this.capacity) return { failure: 'volume' };

    for (const point of candidatePoints(this.placements)) {
      for (const dimensions of rotationsOf(item)) {
        const candidate: Placement = { itemId: item.id, ...point, dimensions };
        const inBounds = candidate.x + dimensions.length <= this.suitcase.length
          && candidate.y + dimensions.width <= this.suitcase.width
          && candidate.z + dimensions.height <= this.suitcase.height;
        if (inBounds && this.placements.every((placed) => !intersects(candidate, placed))) {
          this.placements.push(candidate);
          this.totalWeight += item.weight;
          this.usedVolume += itemVolume(item);
          return { placement: candidate };
        }
      }
    }
    return { failure: 'space' };
  }
}

export function packItems(suitcase: Suitcase, items: PackingItem[], mode: PlanMode): SuitcasePlan {
  const packer = new SuitcasePacker(suitcase, mode);
  const unplaced: UnplacedItem[] = [];

  for (const item of ordered(items, mode)) {
    const result = packer.tryPlace(item);
    if (result.failure) unplaced.push({ item, reason: FAILURE_REASONS[result.failure] });
  }

  return {
    suitcaseId: '',
    placements: packer.placements,
    unplaced,
    totalWeight: packer.totalWeight,
    usedVolume: packer.usedVolume,
    capacityRatio: suitcaseVolume(suitcase) ? packer.usedVolume / suitcaseVolume(suitcase) : 0,
  };
}

/**
 * 多箱联合规划：
 * 1. 用户指定了箱子的物品只尝试该箱，放不下就记为该箱未装，绝不挪动用户的指定；
 * 2. 未指定的物品按“必带优先、优先级次之”的顺序交给系统分配，
 *    优先塞进剩余空间最小的可用箱子；
 * 3. 每件物品只处理一次，不会重复装入或重复计重；
 *    任何箱子放不下都不影响其他箱子已得到的有效结果。
 */
export function packAcrossSuitcases(suitcases: SuitcaseConfig[], items: PackingItem[], mode: PlanMode): MultiPackingPlan {
  const packers = new Map(suitcases.map((suitcase) => [suitcase.id, new SuitcasePacker(suitcase, mode)]));
  const pinnedUnplaced = new Map<string, UnplacedItem[]>(suitcases.map((suitcase) => [suitcase.id, []]));
  const unassigned: UnplacedItem[] = [];

  const known = new Set(suitcases.map((suitcase) => suitcase.id));
  const pinned = new Map<string, PackingItem[]>();
  const free: PackingItem[] = [];
  for (const item of items) {
    if (item.suitcaseId && known.has(item.suitcaseId)) {
      const group = pinned.get(item.suitcaseId) ?? [];
      group.push(item);
      pinned.set(item.suitcaseId, group);
    } else {
      free.push(item);
    }
  }

  for (const suitcase of suitcases) {
    const packer = packers.get(suitcase.id)!;
    for (const item of ordered(pinned.get(suitcase.id) ?? [], mode)) {
      const result = packer.tryPlace(item);
      if (result.failure) {
        pinnedUnplaced.get(suitcase.id)!.push({ item, reason: `指定箱子放不下：${FAILURE_REASONS[result.failure]}` });
      }
    }
  }

  for (const item of ordered(free, mode)) {
    if (isInvalid(item)) {
      unassigned.push({ item, reason: FAILURE_REASONS.invalid });
      continue;
    }
    const attempts: string[] = [];
    const candidates = [...suitcases].sort((a, b) => {
      const diff = packers.get(a.id)!.freeCapacity - packers.get(b.id)!.freeCapacity;
      return diff || suitcases.indexOf(a) - suitcases.indexOf(b);
    });
    let placed = false;
    for (const suitcase of candidates) {
      const result = packers.get(suitcase.id)!.tryPlace(item);
      if (!result.failure) {
        placed = true;
        break;
      }
      attempts.push(`${suitcase.name}：${FAILURE_REASONS[result.failure]}`);
    }
    if (!placed) {
      unassigned.push({ item, reason: attempts.length ? `无法装入任何箱子（${attempts.join('；')}）` : '没有可用的行李箱' });
    }
  }

  const suitcasePlans: SuitcasePlan[] = suitcases.map((suitcase) => {
    const packer = packers.get(suitcase.id)!;
    return {
      suitcaseId: suitcase.id,
      placements: packer.placements,
      unplaced: pinnedUnplaced.get(suitcase.id)!,
      totalWeight: packer.totalWeight,
      usedVolume: packer.usedVolume,
      capacityRatio: suitcaseVolume(suitcase) ? packer.usedVolume / suitcaseVolume(suitcase) : 0,
    };
  });

  const totalWeight = suitcasePlans.reduce((sum, plan) => sum + plan.totalWeight, 0);
  const usedVolume = suitcasePlans.reduce((sum, plan) => sum + plan.usedVolume, 0);
  const totalCapacity = suitcases.reduce((sum, suitcase) => sum + suitcaseVolume(suitcase), 0);

  return {
    id: mode,
    name: PLAN_NAMES[mode],
    suitcases: suitcasePlans,
    unassigned,
    totalWeight,
    usedVolume,
    capacityRatio: totalCapacity ? usedVolume / totalCapacity : 0,
  };
}
