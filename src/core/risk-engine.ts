import { rotationsOf } from './geometry';
import type { PackingItem, PackingPlan, Risk, Suitcase } from './models';

export function detectRisks(plan: PackingPlan, suitcases: Suitcase[], items: PackingItem[]): Risk[] {
  const risks: Risk[] = [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const bySuitcase = new Map(suitcases.map((suitcase) => [suitcase.id, suitcase]));

  if (!suitcases.length) {
    risks.push({ id: 'no-suitcase', severity: 'critical', title: '没有可用的行李箱', message: '请先添加至少一个行李箱再重新规划。' });
    return risks;
  }

  for (const box of plan.boxes) {
    const suitcase = bySuitcase.get(box.suitcaseId);
    if (!suitcase) continue;
    if (box.totalWeight > suitcase.maxWeight) risks.push({ id: `overweight-${suitcase.id}`, severity: 'critical', title: `「${suitcase.name}」超重`, message: `超出承重 ${(box.totalWeight - suitcase.maxWeight).toFixed(1)} kg，请移除重物或改放其他箱子。` });
    else if (box.totalWeight / suitcase.maxWeight > 0.9) risks.push({ id: `near-weight-${suitcase.id}`, severity: 'warning', title: `「${suitcase.name}」接近承重上限`, message: '建议预留至少 10% 承重余量。' });
    if (box.capacityRatio > 0.9) risks.push({ id: `high-volume-${suitcase.id}`, severity: 'warning', title: `「${suitcase.name}」空间接近满载`, message: '空间利用率超过 90%，返程新增物品可能无法装入。' });
  }

  const allUnplaced = [...plan.unplaced, ...plan.boxes.flatMap((box) => box.unplaced)];
  for (const { item } of allUnplaced) {
    const fitsSomewhere = suitcases.some((suitcase) => rotationsOf(item).some((d) => d.length <= suitcase.length && d.width <= suitcase.width && d.height <= suitcase.height));
    if (!fitsSomewhere) risks.push({ id: `oversized-${item.id}`, severity: 'critical', title: `${item.name} 尺寸越界`, message: '任意旋转方向都无法放入任何行李箱。', itemId: item.id });
    if (item.mustHave) risks.push({ id: `missing-${item.id}`, severity: 'critical', title: `必需品未装入：${item.name}`, message: '请调整清单、改用更大行李箱或增加箱子。', itemId: item.id });
  }

  for (const box of plan.boxes) {
    const suitcase = bySuitcase.get(box.suitcaseId);
    if (!suitcase) continue;
    for (const placement of box.placements) {
      const item = byId.get(placement.itemId);
      if (!item) continue;
      if (item.weight >= suitcase.maxWeight * 0.25 && placement.z > suitcase.height * 0.5) {
        risks.push({ id: `high-${item.id}`, severity: 'warning', title: `${item.name} 重心偏高`, message: `在「${suitcase.name}」中位置偏高，将重物移到箱体底部，降低翻倒和挤压风险。`, itemId: item.id });
      }
      if (item.fragile) {
        const hasLoadAbove = box.placements.some((other) => other.itemId !== item.id
          && other.z >= placement.z + placement.dimensions.height
          && other.x < placement.x + placement.dimensions.length && other.x + other.dimensions.length > placement.x
          && other.y < placement.y + placement.dimensions.width && other.y + other.dimensions.width > placement.y);
        if (hasLoadAbove) risks.push({ id: `fragile-${item.id}`, severity: 'warning', title: `${item.name} 受到上方挤压`, message: `在「${suitcase.name}」中受压，请移到上层或增加缓冲保护。`, itemId: item.id });
      }
    }
  }

  if (!risks.length) risks.push({ id: 'all-clear', severity: 'info', title: '装载状态良好', message: '各箱重量、空间和摆放风险均在合理范围内。' });
  return risks;
}
