import { packAcrossSuitcases } from './packing-engine';
import type { MultiPackingPlan, PackingItem, PlanMode, SuitcaseConfig } from './models';

export function generatePlans(suitcases: SuitcaseConfig[], items: PackingItem[]): Record<PlanMode, MultiPackingPlan> {
  return {
    minimal: packAcrossSuitcases(suitcases, items, 'minimal'),
    comfort: packAcrossSuitcases(suitcases, items, 'comfort'),
    shopping: packAcrossSuitcases(suitcases, items, 'shopping'),
  };
}
