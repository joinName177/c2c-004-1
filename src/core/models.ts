export type Dimensions = Readonly<{ length: number; width: number; height: number }>;
export type PlanMode = 'minimal' | 'comfort' | 'shopping';
export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface Suitcase extends Dimensions {
  id: string;
  name: string;
  maxWeight: number;
}

export interface PackingItem extends Dimensions {
  id: string;
  name: string;
  category: string;
  weight: number;
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile?: boolean;
  /** 用户指定的行李箱 id；缺省表示交给系统分配。 */
  suitcaseId?: string;
}

export interface Placement {
  itemId: string;
  x: number;
  y: number;
  z: number;
  dimensions: Dimensions;
}

export interface UnplacedItem {
  item: PackingItem;
  reason: string;
}

/** 单个行李箱的装箱结果。 */
export interface SuitcasePlan {
  suitcaseId: string;
  placements: Placement[];
  unplaced: UnplacedItem[];
  totalWeight: number;
  usedVolume: number;
  capacityRatio: number;
}

/** 一套策略下所有行李箱的联合装箱结果。 */
export interface PackingPlan {
  id: PlanMode;
  name: string;
  boxes: SuitcasePlan[];
  /** 任何行李箱都放不下的物品（含指定箱失效的物品）。 */
  unplaced: UnplacedItem[];
  totalWeight: number;
  usedVolume: number;
  capacityRatio: number;
}

export interface Risk {
  id: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  itemId?: string;
}

export interface PackingSnapshot {
  suitcases: Suitcase[];
  items: PackingItem[];
  selectedPlan: PlanMode;
  /** 最近一次计算并保存的三套方案，刷新后保持同一份安排。 */
  plans: Record<PlanMode, PackingPlan>;
}

export function itemVolume(item: Dimensions): number {
  return item.length * item.width * item.height;
}

export function suitcaseVolume(suitcase: Dimensions): number {
  return suitcase.length * suitcase.width * suitcase.height;
}
