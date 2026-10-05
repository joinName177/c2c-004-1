import { intersects, rotationsOf } from './geometry';
import { itemVolume, suitcaseVolume, type PackingItem, type PackingPlan, type Placement, type PlanMode, type Suitcase, type SuitcasePlan, type UnplacedItem } from './models';

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
    return mode === 'shopping' ? a.weight - b.weight : itemVolume(b) - itemVolume(a) || a.id.localeCompare(b.id);
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

/** 单个行李箱的装箱器：累计已装物品，逐件尝试放置，保证不重复计重、不重复装入。 */
class BoxPacker {
  readonly placements: Placement[] = [];
  totalWeight = 0;
  usedVolume = 0;
  private readonly capacity: number;
  private readonly maxWeight: number;

  constructor(readonly suitcase: Suitcase, mode: PlanMode) {
    this.capacity = suitcaseVolume(suitcase) * RESERVE[mode];
    this.maxWeight = suitcase.maxWeight * RESERVE[mode];
  }

  get remainingVolume(): number {
    return this.capacity - this.usedVolume;
  }

  attempt(item: PackingItem): { ok: true } | { ok: false; reason: string } {
    if ([item.length, item.width, item.height, item.weight].some((value) => !(value > 0))) {
      return { ok: false, reason: '尺寸或重量无效' };
    }
    if (this.totalWeight + item.weight > this.maxWeight) return { ok: false, reason: '超过当前方案承重预留' };
    if (this.usedVolume + itemVolume(item) > this.capacity) return { ok: false, reason: '超过当前方案空间预留' };

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
          return { ok: true };
        }
      }
    }
    return { ok: false, reason: '没有可用的连续空间' };
  }

  result(): SuitcasePlan {
    const volume = suitcaseVolume(this.suitcase);
    return {
      suitcaseId: this.suitcase.id,
      placements: [...this.placements],
      unplaced: [],
      totalWeight: this.totalWeight,
      usedVolume: this.usedVolume,
      capacityRatio: volume ? this.usedVolume / volume : 0,
    };
  }
}

/** 单箱装箱：保留给测试与内部复用，结果等价于联合规划中只有一个箱子的情形。 */
export function packItems(suitcase: Suitcase, items: PackingItem[], mode: PlanMode): SuitcasePlan {
  const packer = new BoxPacker(suitcase, mode);
  const unplaced: UnplacedItem[] = [];
  for (const item of ordered(items, mode)) {
    const outcome = packer.attempt(item);
    if (!outcome.ok) unplaced.push({ item, reason: outcome.reason });
  }
  return { ...packer.result(), unplaced };
}

/**
 * 多箱联合规划：
 * 1. 用户指定了箱子的物品只进入该箱，放不下时记入该箱未装清单并保留原因，绝不被挪到别的箱子；
 * 2. 未指定的物品按“必带优先、再可选”的顺序，由系统按剩余空间最紧的箱子优先分配；
 * 3. 每件物品最多装入一个箱子，重量与体积只计入所装箱子一次。
 */
export function packAcrossSuitcases(suitcases: Suitcase[], items: PackingItem[], mode: PlanMode): PackingPlan {
  const packers = suitcases.map((suitcase) => new BoxPacker(suitcase, mode));
  const byId = new Map(packers.map((packer) => [packer.suitcase.id, packer]));
  const boxUnplaced = new Map<string, UnplacedItem[]>(suitcases.map((suitcase) => [suitcase.id, []]));
  const unplaced: UnplacedItem[] = [];
  const assigned = new Map<string, PackingItem[]>();
  const pool: PackingItem[] = [];

  for (const item of items) {
    if (item.suitcaseId) {
      if (byId.has(item.suitcaseId)) {
        const list = assigned.get(item.suitcaseId) ?? [];
        list.push(item);
        assigned.set(item.suitcaseId, list);
      } else {
        unplaced.push({ item, reason: '指定的行李箱不存在，请重新指定或改为系统分配' });
      }
    } else {
      pool.push(item);
    }
  }

  // 先满足用户指定：指定物品只尝试自己的箱子。
  for (const [suitcaseId, list] of assigned) {
    const packer = byId.get(suitcaseId)!;
    for (const item of ordered(list, mode)) {
      const outcome = packer.attempt(item);
      if (!outcome.ok) boxUnplaced.get(suitcaseId)!.push({ item, reason: `指定装入「${packer.suitcase.name}」：${outcome.reason}` });
    }
  }

  // 再安排系统分配：必带物品优先，每件物品只进第一个能容纳它的箱子。
  for (const item of ordered(pool, mode)) {
    const candidates = [...packers].sort((a, b) => a.remainingVolume - b.remainingVolume || suitcases.indexOf(a.suitcase) - suitcases.indexOf(b.suitcase));
    const reasons: string[] = [];
    let done = false;
    for (const packer of candidates) {
      const outcome = packer.attempt(item);
      if (outcome.ok) { done = true; break; }
      reasons.push(`${packer.suitcase.name}：${outcome.reason}`);
    }
    if (!done) unplaced.push({ item, reason: reasons.length ? reasons.join('；') : '没有可用的行李箱' });
  }

  const boxes = packers.map((packer) => ({ ...packer.result(), unplaced: boxUnplaced.get(packer.suitcase.id) ?? [] }));
  const totalWeight = boxes.reduce((sum, box) => sum + box.totalWeight, 0);
  const usedVolume = boxes.reduce((sum, box) => sum + box.usedVolume, 0);
  const totalVolume = suitcases.reduce((sum, suitcase) => sum + suitcaseVolume(suitcase), 0);
  return { id: mode, name: PLAN_NAMES[mode], boxes, unplaced, totalWeight, usedVolume, capacityRatio: totalVolume ? usedVolume / totalVolume : 0 };
}
