export type Dimensions = Readonly<{ length: number; width: number; height: number }>;
export type PlanMode = 'minimal' | 'comfort' | 'shopping';
export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface Suitcase extends Dimensions {
  maxWeight: number;
}

export interface SuitcaseConfig extends Suitcase {
  id: string;
  name: string;
}

export interface PackingItem extends Dimensions {
  id: string;
  name: string;
  category: string;
  weight: number;
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile?: boolean;
  /** 用户指定的箱子 id；为空表示交给系统分配 */
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

export interface SuitcasePlan {
  suitcaseId: string;
  placements: Placement[];
  /** 指定装入该箱但放不下的物品（不会被挪到别的箱子） */
  unplaced: UnplacedItem[];
  totalWeight: number;
  usedVolume: number;
  capacityRatio: number;
}

export interface MultiPackingPlan {
  id: PlanMode;
  name: string;
  suitcases: SuitcasePlan[];
  /** 系统分配后仍无法装入任何箱子的物品 */
  unassigned: UnplacedItem[];
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
  suitcaseId?: string;
}

export interface PackingSnapshot {
  suitcases: SuitcaseConfig[];
  items: PackingItem[];
  selectedPlan: PlanMode;
}

export function itemVolume(item: Dimensions): number {
  return item.length * item.width * item.height;
}

export function suitcaseVolume(suitcase: Dimensions): number {
  return suitcase.length * suitcase.width * suitcase.height;
}
