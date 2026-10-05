<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LocalPlannerRepository } from '../adapters/local-planner.repository';
import { BrowserPrintAdapter } from '../adapters/browser-print.adapter';
import { validateSuitcase } from '../core/packing-engine';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';
import { usePlanner } from './usePlanner';
import SuitcaseForm from './components/SuitcaseForm.vue';
import ItemEditor from './components/ItemEditor.vue';
import ItemList from './components/ItemList.vue';
import PackingProjection from './components/PackingProjection.vue';
import PlanCompare from './components/PlanCompare.vue';
import MasterChecklist from './components/MasterChecklist.vue';
import RemoveSuitcaseDialog from './components/RemoveSuitcaseDialog.vue';
import RiskPanel from './components/RiskPanel.vue';
import PrintSheet from './components/PrintSheet.vue';

const props = defineProps<{ repository?: PlannerRepository; printPort?: PrintPort }>();
const planner = usePlanner({ repository: props.repository ?? new LocalPlannerRepository(window.localStorage), printPort: props.printPort ?? new BrowserPrintAdapter() });
const selectedItem = ref('');
const activeSuitcaseId = ref(planner.state.suitcases[0]?.id ?? '');

const errorsBySuitcase = computed(() => new Map(planner.state.suitcases.map((suitcase) => [suitcase.id, validateSuitcase(suitcase)])));
const hasErrors = computed(() => [...errorsBySuitcase.value.values()].some((errors) => errors.length > 0));
const suitcaseById = computed(() => new Map(planner.state.suitcases.map((suitcase) => [suitcase.id, suitcase])));
const activeBox = computed(() => planner.currentPlan.value.boxes.find((box) => box.suitcaseId === activeSuitcaseId.value) ?? planner.currentPlan.value.boxes[0]);
const activeSuitcase = computed(() => activeBox.value ? suitcaseById.value.get(activeBox.value.suitcaseId) : undefined);

watch(() => planner.state.suitcases.map((suitcase) => suitcase.id), (ids) => {
  if (!ids.includes(activeSuitcaseId.value)) activeSuitcaseId.value = ids[0] ?? '';
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar"><div class="brand"><span class="brand-mark">PACK<br><b>WISE</b></span><div><small>TRAVEL LAB / 004</small><h1>行李箱空间规划师</h1></div></div><div class="header-actions"><span :class="{ stale: planner.isStale.value }">{{ planner.isStale.value ? '方案待更新' : '规划已同步' }}</span><button type="button" data-testid="print-button" @click="planner.print">打印清单</button><button type="button" class="primary" :disabled="hasErrors" @click="planner.regenerate">智能装箱 ↗</button></div></header>
    <main>
      <section class="hero"><div><small>SPACE, WEIGHT & PRIORITY</small><h2>一家人的行李，<em>一次规划清楚。</em></h2><p>多个行李箱联合规划：指定箱子或交给系统分配，必带优先，三套策略对比，整趟行程一张总清单。</p></div><div class="hero-stamp"><b>{{ planner.state.suitcases.length }}</b><span>SUITCASES<br>{{ planner.state.items.length }} ITEMS</span></div></section>
      <PlanCompare :plans="planner.plans.value" :selected="planner.state.selectedPlan" :suitcases="planner.state.suitcases" @select="planner.selectPlan" />
      <div class="workspace">
        <aside class="left-column">
          <div class="suitcase-list">
            <SuitcaseForm v-for="(suitcase, index) in planner.state.suitcases" :key="suitcase.id" :suitcase="suitcase" :index="index" :errors="errorsBySuitcase.get(suitcase.id) ?? []" @update="planner.updateSuitcase(suitcase.id, $event)" @remove="planner.requestRemoveSuitcase(suitcase.id)" />
            <button type="button" class="add-suitcase" data-testid="add-suitcase" @click="planner.addSuitcase">＋ 添加行李箱</button>
          </div>
          <section class="panel inventory"><div class="section-title"><div><span>02 / INVENTORY</span><h2>待装物品</h2></div><b>{{ planner.state.items.length }} 件</b></div><ItemEditor @add="planner.addItem" /><ItemList :items="planner.state.items" :suitcases="planner.state.suitcases" @remove="planner.removeItem" @toggle="(id, mustHave) => planner.updateItem(id, { mustHave })" @assign="planner.assignItem" /></section>
        </aside>
        <section class="right-column">
          <div class="canvas-panel">
            <div class="canvas-head"><div><span>03 / PACKING MAP</span><h2>{{ planner.currentPlan.value.name }}分箱图</h2></div><div class="metrics"><template v-if="activeBox && activeSuitcase"><span><b>{{ Math.round(activeBox.capacityRatio * 100) }}%</b>空间利用</span><span><b>{{ activeBox.totalWeight.toFixed(1) }}</b>kg 已装</span><span><b>{{ activeBox.unplaced.length }}</b>件未装</span></template></div></div>
            <div v-if="planner.currentPlan.value.boxes.length" class="box-tabs">
              <button v-for="box in planner.currentPlan.value.boxes" :key="box.suitcaseId" type="button" :data-box="box.suitcaseId" :class="{ active: box.suitcaseId === activeBox?.suitcaseId }" @click="activeSuitcaseId = box.suitcaseId">{{ suitcaseById.get(box.suitcaseId)?.name ?? box.suitcaseId }} · {{ box.placements.length }} 件</button>
            </div>
            <template v-if="activeBox && activeSuitcase">
              <div class="projections"><PackingProjection view="top" :box-plan="activeBox" :suitcase="activeSuitcase" :items="planner.state.items" :selected-id="selectedItem" @select="selectedItem = $event" /><PackingProjection view="side" :box-plan="activeBox" :suitcase="activeSuitcase" :items="planner.state.items" :selected-id="selectedItem" @select="selectedItem = $event" /></div>
              <p v-if="activeBox.unplaced.length" class="box-unplaced">本箱未装：<span v-for="entry in activeBox.unplaced" :key="entry.item.id">{{ entry.item.name }}（{{ entry.reason }}）</span></p>
              <p class="canvas-note">点击色块可在两个视图中同步定位物品。重新分配只移动未指定箱子的物品，不会改动你的指定。</p>
            </template>
            <p v-else class="canvas-note">暂无行李箱，请先在左侧添加。</p>
          </div>
          <MasterChecklist :plan="planner.currentPlan.value" :suitcases="planner.state.suitcases" :items="planner.state.items" />
          <RiskPanel :risks="planner.risks.value" />
        </section>
      </div>
      <p class="notice" aria-live="polite">{{ planner.notice.value }}</p>
    </main>
    <RemoveSuitcaseDialog v-if="planner.pendingRemoval.value" :preview="planner.pendingRemoval.value" :suitcases="planner.state.suitcases" @confirm="planner.confirmRemoveSuitcase" @cancel="planner.cancelRemoveSuitcase" />
    <PrintSheet :suitcases="planner.state.suitcases" :items="planner.state.items" :plan="planner.currentPlan.value" :risks="planner.risks.value" />
  </div>
</template>
