import { computed, reactive, ref } from 'vue';
import { createSampleSnapshot } from '../core/sample-data';
import { generatePlans } from '../core/plan-service';
import { detectRisks } from '../core/risk-engine';
import { applySuitcaseRemoval, previewSuitcaseRemoval, type RemovalPreview } from '../core/suitcase-removal';
import type { PackingItem, PackingSnapshot, PlanMode, Suitcase } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';

export interface PlannerDependencies { repository: PlannerRepository; printPort: PrintPort }

export function usePlanner({ repository, printPort }: PlannerDependencies) {
  const loaded = repository.load();
  const state = reactive<PackingSnapshot>(loaded.value);
  const notice = ref(loaded.warning ?? '');
  const isStale = ref(false);
  const pendingRemoval = ref<RemovalPreview | null>(null);
  const plans = computed(() => state.plans);
  const currentPlan = computed(() => state.plans[state.selectedPlan]);
  const risks = computed(() => detectRisks(currentPlan.value, state.suitcases, state.items));

  const save = () => repository.save(JSON.parse(JSON.stringify(state)) as PackingSnapshot);
  const markStale = () => { isStale.value = true; save(); };

  function addItem(item: PackingItem) { state.items.push(item); markStale(); }
  function updateItem(id: string, patch: Partial<PackingItem>) {
    const index = state.items.findIndex((item) => item.id === id);
    if (index >= 0) state.items[index] = { ...state.items[index], ...patch } as PackingItem;
    markStale();
  }
  function assignItem(id: string, suitcaseId: string | undefined) { updateItem(id, { suitcaseId }); }
  function removeItem(id: string) { state.items = state.items.filter((item) => item.id !== id); markStale(); }

  function addSuitcase() {
    const id = `suitcase-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    state.suitcases.push({ id, name: `行李箱 ${state.suitcases.length + 1}`, length: 55, width: 38, height: 24, maxWeight: 15 });
    markStale();
  }
  function updateSuitcase(id: string, patch: Partial<Suitcase>) {
    const index = state.suitcases.findIndex((suitcase) => suitcase.id === id);
    if (index >= 0) state.suitcases[index] = { ...state.suitcases[index], ...patch } as Suitcase;
    markStale();
  }

  /** 删除箱子：若箱内还有指定或已装物品，先给出重新分配预览，确认后才执行。 */
  function requestRemoveSuitcase(id: string) {
    const preview = previewSuitcaseRemoval(state, id);
    if (!preview) return;
    if (!preview.moves.length) {
      commitRemoval(id);
      notice.value = `已删除「${preview.suitcase.name}」`;
      return;
    }
    pendingRemoval.value = preview;
  }
  function confirmRemoveSuitcase() {
    const preview = pendingRemoval.value;
    if (!preview) return;
    commitRemoval(preview.suitcase.id);
    notice.value = `已删除「${preview.suitcase.name}」，受影响物品已按当前策略重新分配`;
    pendingRemoval.value = null;
  }
  function cancelRemoveSuitcase() { pendingRemoval.value = null; }
  /** 一次保存箱子列表、物品归属和重新计算的三套方案。 */
  function commitRemoval(id: string) {
    const next = applySuitcaseRemoval(state, id);
    state.suitcases = next.suitcases;
    state.items = next.items;
    state.plans = generatePlans(state.suitcases, state.items);
    isStale.value = false;
    save();
  }

  /** 重新规划：只移动未指定箱子的物品，用户指定的归属保持不变。 */
  function regenerate() {
    state.plans = generatePlans(state.suitcases, state.items);
    isStale.value = false;
    notice.value = '三套方案已重新计算（指定箱子的物品保持原位）';
    save();
  }
  function selectPlan(mode: PlanMode) { state.selectedPlan = mode; save(); }
  function resetSample() {
    const sample = createSampleSnapshot();
    Object.assign(state, sample);
    pendingRemoval.value = null;
    isStale.value = false;
    notice.value = '已恢复家庭出行示例';
    save();
  }

  return {
    state, notice, isStale, plans, currentPlan, risks, pendingRemoval,
    addItem, updateItem, assignItem, removeItem,
    addSuitcase, updateSuitcase, requestRemoveSuitcase, confirmRemoveSuitcase, cancelRemoveSuitcase,
    regenerate, selectPlan, resetSample,
    print: () => printPort.print(),
  };
}
