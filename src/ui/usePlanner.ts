import { computed, reactive, ref } from 'vue';
import { createSampleSnapshot } from '../core/sample-data';
import { generatePlans } from '../core/plan-service';
import { detectRisks } from '../core/risk-engine';
import type { PackingItem, PackingSnapshot, PlanMode, SuitcaseConfig } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';

export interface PlannerDependencies { repository: PlannerRepository; printPort: PrintPort }

export interface RemovalOutcome {
  item: PackingItem;
  /** 该物品此前是否被用户指定到待删除的箱子 */
  wasPinned: boolean;
  /** 重新分配后计划装入的箱子名称；为空表示无法分配 */
  targetSuitcaseName?: string;
  /** 无法分配时的原因 */
  reason?: string;
}

export interface SuitcaseRemovalPreview {
  suitcase: SuitcaseConfig;
  outcomes: RemovalOutcome[];
}

export function usePlanner({ repository, printPort }: PlannerDependencies) {
  const loaded = repository.load();
  const state = reactive<PackingSnapshot>(loaded.value);
  const notice = ref(loaded.warning ?? '');
  const isStale = ref(false);
  const plans = ref(generatePlans(state.suitcases, state.items));
  const currentPlan = computed(() => plans.value[state.selectedPlan]);
  const risks = computed(() => detectRisks(currentPlan.value, state.suitcases, state.items));

  const save = () => repository.save(JSON.parse(JSON.stringify(state)) as PackingSnapshot);
  const markStale = () => { isStale.value = true; save(); };

  function addItem(item: PackingItem) { state.items.push(item); markStale(); }
  function updateItem(id: string, patch: Partial<PackingItem>) {
    const index = state.items.findIndex((item) => item.id === id);
    if (index >= 0) state.items[index] = { ...state.items[index], ...patch } as PackingItem;
    markStale();
  }
  function removeItem(id: string) { state.items = state.items.filter((item) => item.id !== id); markStale(); }
  function assignItem(id: string, suitcaseId?: string) { updateItem(id, { suitcaseId }); }

  function addSuitcase() {
    const id = `case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    state.suitcases.push({ id, name: `箱子 ${state.suitcases.length + 1}`, length: 60, width: 40, height: 25, maxWeight: 15 });
    markStale();
  }
  function updateSuitcase(id: string, patch: Partial<SuitcaseConfig>) {
    const index = state.suitcases.findIndex((suitcase) => suitcase.id === id);
    if (index >= 0) state.suitcases[index] = { ...state.suitcases[index], ...patch } as SuitcaseConfig;
    markStale();
  }

  /**
   * 预览删除箱子后的重新分配结果，不修改任何状态。
   * 只有未指定箱子的物品会被系统重新分配；指定到该箱的物品视同取消指定。
   */
  function previewRemoveSuitcase(id: string): SuitcaseRemovalPreview | null {
    const suitcase = state.suitcases.find((entry) => entry.id === id);
    if (!suitcase) return null;
    const remainingSuitcases = state.suitcases.filter((entry) => entry.id !== id);
    const remainingItems = state.items.map((item) => (item.suitcaseId === id ? { ...item, suitcaseId: undefined } : item));
    const plan = generatePlans(remainingSuitcases, remainingItems)[state.selectedPlan];

    const affected = new Map<string, PackingItem>();
    for (const item of state.items) if (item.suitcaseId === id) affected.set(item.id, item);
    const currentSuitcasePlan = currentPlan.value.suitcases.find((entry) => entry.suitcaseId === id);
    for (const placement of currentSuitcasePlan?.placements ?? []) {
      const item = state.items.find((entry) => entry.id === placement.itemId);
      if (item) affected.set(item.id, item);
    }
    for (const { item } of currentSuitcasePlan?.unplaced ?? []) affected.set(item.id, item);

    const outcomes: RemovalOutcome[] = [...affected.values()].map((item) => {
      const target = plan.suitcases.find((entry) => entry.placements.some((placement) => placement.itemId === item.id));
      if (target) {
        const name = remainingSuitcases.find((entry) => entry.id === target.suitcaseId)?.name ?? '';
        return { item, wasPinned: item.suitcaseId === id, targetSuitcaseName: name };
      }
      const unassigned = plan.unassigned.find((entry) => entry.item.id === item.id);
      return { item, wasPinned: item.suitcaseId === id, reason: unassigned?.reason ?? '没有可用的行李箱' };
    });

    return { suitcase, outcomes };
  }

  /** 确认删除：一次保存箱子列表、物品归属和重新计算的结果 */
  function confirmRemoveSuitcase(id: string) {
    const suitcase = state.suitcases.find((entry) => entry.id === id);
    if (!suitcase) return;
    state.suitcases = state.suitcases.filter((entry) => entry.id !== id);
    state.items = state.items.map((item) => (item.suitcaseId === id ? { ...item, suitcaseId: undefined } : item));
    plans.value = generatePlans(state.suitcases, state.items);
    isStale.value = false;
    notice.value = `已删除「${suitcase.name}」，受影响物品已重新分配`;
    save();
  }

  function regenerate() { plans.value = generatePlans(state.suitcases, state.items); isStale.value = false; notice.value = '三套方案已重新计算'; save(); }
  function selectPlan(mode: PlanMode) { state.selectedPlan = mode; save(); }
  function resetSample() {
    const sample = createSampleSnapshot();
    Object.assign(state, sample);
    plans.value = generatePlans(state.suitcases, state.items);
    isStale.value = false;
    notice.value = '已恢复双箱示例';
    save();
  }

  return {
    state, notice, isStale, plans, currentPlan, risks,
    addItem, updateItem, removeItem, assignItem,
    addSuitcase, updateSuitcase, previewRemoveSuitcase, confirmRemoveSuitcase,
    regenerate, selectPlan, resetSample,
    print: () => printPort.print(),
  };
}
