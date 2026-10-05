<script setup lang="ts">
import { computed, ref } from 'vue';
import { LocalPlannerRepository } from '../adapters/local-planner.repository';
import { BrowserPrintAdapter } from '../adapters/browser-print.adapter';
import { validateSuitcase } from '../core/packing-engine';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';
import { usePlanner, type SuitcaseRemovalPreview } from './usePlanner';
import SuitcaseManager from './components/SuitcaseManager.vue';
import ItemEditor from './components/ItemEditor.vue';
import ItemList from './components/ItemList.vue';
import SuitcasePlanView from './components/SuitcasePlanView.vue';
import MasterChecklist from './components/MasterChecklist.vue';
import PlanCompare from './components/PlanCompare.vue';
import RiskPanel from './components/RiskPanel.vue';
import PrintSheet from './components/PrintSheet.vue';
import RemoveSuitcaseDialog from './components/RemoveSuitcaseDialog.vue';

const props = defineProps<{ repository?: PlannerRepository; printPort?: PrintPort }>();
const planner = usePlanner({ repository: props.repository ?? new LocalPlannerRepository(window.localStorage), printPort: props.printPort ?? new BrowserPrintAdapter() });
const selectedItem = ref('');
const pendingRemoval = ref<SuitcaseRemovalPreview | null>(null);

const errors = computed(() => Object.fromEntries(planner.state.suitcases.map((suitcase) => [suitcase.id, validateSuitcase(suitcase)])));
const hasErrors = computed(() => Object.values(errors.value).some((list) => list.length > 0));

function suitcaseById(id: string) {
  return planner.state.suitcases.find((suitcase) => suitcase.id === id);
}

function requestRemoveSuitcase(id: string) {
  const preview = planner.previewRemoveSuitcase(id);
  if (!preview) return;
  if (preview.outcomes.length === 0) planner.confirmRemoveSuitcase(id);
  else pendingRemoval.value = preview;
}

function confirmRemoval() {
  if (pendingRemoval.value) planner.confirmRemoveSuitcase(pendingRemoval.value.suitcase.id);
  pendingRemoval.value = null;
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar"><div class="brand"><span class="brand-mark">PACK<br><b>WISE</b></span><div><small>TRAVEL LAB / 004</small><h1>行李箱空间规划师</h1></div></div><div class="header-actions"><span :class="{ stale: planner.isStale.value }">{{ planner.isStale.value ? '方案待更新' : '规划已同步' }}</span><button type="button" data-testid="print-button" @click="planner.print">打印清单</button><button type="button" class="primary" :disabled="hasErrors" @click="planner.regenerate">智能装箱 ↗</button></div></header>
    <main>
      <section class="hero"><div><small>SPACE, WEIGHT & PRIORITY</small><h2>把每一寸空间，<em>留给真正重要的。</em></h2><p>录入多只行李箱与清单，指定箱子或交给系统分配，比较三种策略后再出发。</p></div><div class="hero-stamp"><b>{{ planner.state.items.length }}</b><span>ITEMS<br>TO PACK</span></div></section>
      <PlanCompare :plans="planner.plans.value" :selected="planner.state.selectedPlan" :suitcases="planner.state.suitcases" @select="planner.selectPlan" />
      <div class="workspace">
        <aside class="left-column">
          <SuitcaseManager :suitcases="planner.state.suitcases" :errors="errors" @update="planner.updateSuitcase" @add="planner.addSuitcase" @remove="requestRemoveSuitcase" />
          <section class="panel inventory"><div class="section-title"><div><span>02 / INVENTORY</span><h2>待装物品</h2></div><b>{{ planner.state.items.length }} 件</b></div><ItemEditor @add="planner.addItem" /><ItemList :items="planner.state.items" :suitcases="planner.state.suitcases" @remove="planner.removeItem" @toggle="(id, mustHave) => planner.updateItem(id, { mustHave })" @assign="planner.assignItem" /></section>
        </aside>
        <section class="right-column">
          <div class="canvas-panel plan-overview"><div class="canvas-head"><div><span>03 / {{ planner.currentPlan.value.name }}</span><h2>分箱摆放方案</h2></div><div class="metrics"><span><b>{{ Math.round(planner.currentPlan.value.capacityRatio * 100) }}%</b>总空间利用</span><span><b>{{ planner.currentPlan.value.totalWeight.toFixed(1) }}</b>kg 已装</span><span><b>{{ planner.currentPlan.value.unassigned.length }}</b>件未分配</span></div></div><p class="canvas-note">点击色块可在俯视与侧视图中同步定位物品。重新分配只移动未指定箱子的物品，不会改动你的指定。</p></div>
          <SuitcasePlanView v-for="suitcasePlan in planner.currentPlan.value.suitcases" :key="suitcasePlan.suitcaseId" :suitcase="suitcaseById(suitcasePlan.suitcaseId)!" :plan="suitcasePlan" :items="planner.state.items" :selected-id="selectedItem" @select="selectedItem = $event" />
          <section v-if="planner.currentPlan.value.unassigned.length" class="panel unassigned-panel"><div class="section-title"><div><span>UNASSIGNED</span><h2>未分配物品</h2></div><b>{{ planner.currentPlan.value.unassigned.length }} 件</b></div><ul class="unplaced-list"><li v-for="entry in planner.currentPlan.value.unassigned" :key="entry.item.id"><b>{{ entry.item.name }}</b>：{{ entry.reason }}</li></ul></section>
          <MasterChecklist :plan="planner.currentPlan.value" :suitcases="planner.state.suitcases" :items="planner.state.items" />
          <RiskPanel :risks="planner.risks.value" />
        </section>
      </div>
      <p class="notice" aria-live="polite">{{ planner.notice.value }}</p>
    </main>
    <RemoveSuitcaseDialog v-if="pendingRemoval" :preview="pendingRemoval" @confirm="confirmRemoval" @cancel="pendingRemoval = null" />
    <PrintSheet :suitcases="planner.state.suitcases" :items="planner.state.items" :plan="planner.currentPlan.value" :risks="planner.risks.value" />
  </div>
</template>
