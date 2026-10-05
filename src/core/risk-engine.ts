import { rotationsOf } from './geometry';
import type { MultiPackingPlan, PackingItem, Risk, SuitcaseConfig, SuitcasePlan } from './models';

function detectSuitcaseRisks(plan: SuitcasePlan, suitcase: SuitcaseConfig, items: PackingItem[]): Risk[] {
  const risks: Risk[] = [];
  const byId = new Map(items.map((item) => [item.id, item]));

  if (plan.totalWeight > suitcase.maxWeight) {
    risks.push({ id: `${suitcase.id}-overweight`, severity: 'critical', title: `「${suitcase.name}」超重`, message: `超出承重 ${(plan.totalWeight - suitcase.maxWeight).toFixed(1)} kg，请移除重物。`, suitcaseId: suitcase.id });
  } else if (plan.totalWeight / suitcase.maxWeight > 0.9) {
    risks.push({ id: `${suitcase.id}-near-weight`, severity: 'warning', title: `「${suitcase.name}」接近承重上限`, message: '建议预留至少 10% 承重余量。', suitcaseId: suitcase.id });
  }
  if (plan.capacityRatio > 0.9) {
    risks.push({ id: `${suitcase.id}-high-volume`, severity: 'warning', title: `「${suitcase.name}」空间接近满载`, message: '空间利用率超过 90%，返程新增物品可能无法装入。', suitcaseId: suitcase.id });
  }

  for (const { item } of plan.unplaced) {
    const oversized = rotationsOf(item).every((d) => d.length > suitcase.length || d.width > suitcase.width || d.height > suitcase.height);
    if (oversized) risks.push({ id: `${suitcase.id}-oversized-${item.id}`, severity: 'critical', title: `${item.name} 尺寸越界`, message: `任意旋转方向都无法放入指定的「${suitcase.name}」。`, itemId: item.id, suitcaseId: suitcase.id });
    if (item.mustHave) risks.push({ id: `${suitcase.id}-missing-${item.id}`, severity: 'critical', title: `必需品未装入：${item.name}`, message: `指定的「${suitcase.name}」放不下，请调整指定或更换箱子。`, itemId: item.id, suitcaseId: suitcase.id });
  }

  for (const placement of plan.placements) {
    const item = byId.get(placement.itemId);
    if (!item) continue;
    if (item.weight >= suitcase.maxWeight * 0.25 && placement.z > suitcase.height * 0.5) {
      risks.push({ id: `${suitcase.id}-high-${item.id}`, severity: 'warning', title: `${item.name} 重心偏高`, message: `在「${suitcase.name}」中位置偏高，将重物移到箱体底部。`, itemId: item.id, suitcaseId: suitcase.id });
    }
    if (item.fragile) {
      const hasLoadAbove = plan.placements.some((other) => other.itemId !== item.id
        && other.z >= placement.z + placement.dimensions.height
        && other.x < placement.x + placement.dimensions.length && other.x + other.dimensions.length > placement.x
        && other.y < placement.y + placement.dimensions.width && other.y + other.dimensions.width > placement.y);
      if (hasLoadAbove) risks.push({ id: `${suitcase.id}-fragile-${item.id}`, severity: 'warning', title: `${item.name} 受到上方挤压`, message: '请移到上层或增加缓冲保护。', itemId: item.id, suitcaseId: suitcase.id });
    }
  }

  return risks;
}

export function detectRisks(plan: MultiPackingPlan, suitcases: SuitcaseConfig[], items: PackingItem[]): Risk[] {
  const risks: Risk[] = [];

  for (const suitcase of suitcases) {
    const suitcasePlan = plan.suitcases.find((entry) => entry.suitcaseId === suitcase.id);
    if (suitcasePlan) risks.push(...detectSuitcaseRisks(suitcasePlan, suitcase, items));
  }

  for (const { item } of plan.unassigned) {
    const oversized = rotationsOf(item).every((d) => suitcases.every((s) => d.length > s.length || d.width > s.width || d.height > s.height));
    if (oversized && suitcases.length) risks.push({ id: `oversized-${item.id}`, severity: 'critical', title: `${item.name} 尺寸越界`, message: '任意旋转方向都无法放入任何行李箱。', itemId: item.id });
    if (item.mustHave) risks.push({ id: `missing-${item.id}`, severity: 'critical', title: `必需品未装入：${item.name}`, message: '所有箱子都放不下，请调整清单或增加行李箱。', itemId: item.id });
  }

  if (!risks.length) risks.push({ id: 'all-clear', severity: 'info', title: '装载状态良好', message: '重量、空间和摆放风险均在合理范围内。' });
  return risks;
}
