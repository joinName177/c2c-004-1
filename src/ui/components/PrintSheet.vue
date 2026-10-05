<script setup lang="ts">
import type { MultiPackingPlan, PackingItem, Risk, SuitcaseConfig } from '../../core/models';

const props = defineProps<{ suitcases: SuitcaseConfig[]; items: PackingItem[]; plan: MultiPackingPlan; risks: Risk[] }>();

function suitcaseName(id: string) {
  return props.suitcases.find((suitcase) => suitcase.id === id)?.name ?? '';
}
function placedIn(itemId: string) {
  return props.plan.suitcases.find((entry) => entry.placements.some((placement) => placement.itemId === itemId));
}
</script>

<template>
  <section class="print-sheet">
    <h1>行李箱空间规划单</h1>
    <p>{{ suitcases.map((s) => `${s.name} ${s.length}×${s.width}×${s.height} cm / 限重 ${s.maxWeight} kg`).join('　·　') }}</p>
    <h2>{{ plan.name }} · 总清单</h2>
    <ol>
      <li v-for="item in items" :key="item.id">{{ placedIn(item.id) ? `□（${suitcaseName(placedIn(item.id)!.suitcaseId)}）` : '×（未装）' }} {{ item.name }} — {{ item.weight }} kg</li>
    </ol>
    <h3>风险提示</h3>
    <p v-for="risk in risks" :key="risk.id">{{ risk.title }}：{{ risk.message }}</p>
  </section>
</template>
