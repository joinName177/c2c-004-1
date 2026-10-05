import { packAcrossSuitcases } from './packing-engine';
import type { PackingItem, PackingPlan, PlanMode, Suitcase } from './models';

export function generatePlans(suitcases: Suitcase[], items: PackingItem[]): Record<PlanMode, PackingPlan> {
  return {
    minimal: packAcrossSuitcases(suitcases, items, 'minimal'),
    comfort: packAcrossSuitcases(suitcases, items, 'comfort'),
    shopping: packAcrossSuitcases(suitcases, items, 'shopping'),
  };
}
