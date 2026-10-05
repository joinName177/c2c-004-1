<script setup lang="ts">
import type { PackingItem, PackingPlan, Risk, Suitcase } from '../../core/models';
defineProps<{ suitcases: Suitcase[]; items: PackingItem[]; plan: PackingPlan; risks: Risk[] }>();
const nameOf = (suitcases: Suitcase[], id: string) => suitcases.find((suitcase) => suitcase.id === id)?.name ?? id;
const itemName = (items: PackingItem[], id: string) => items.find((item) => item.id === id)?.name ?? id;
const itemWeight = (items: PackingItem[], id: string) => items.find((item) => item.id === id)?.weight ?? 0;
</script>

<template>
  <section class="print-sheet">
    <h1>行李箱空间规划单</h1>
    <p>{{ suitcases.length }} 个行李箱 · 总限重 {{ suitcases.reduce((sum, s) => sum + s.maxWeight, 0) }} kg</p>
    <h2>{{ plan.name }}（多箱联合规划）</h2>
    <div v-for="box in plan.boxes" :key="box.suitcaseId" class="print-box">
      <h3>{{ nameOf(suitcases, box.suitcaseId) }} — {{ box.placements.length }} 件 · {{ box.totalWeight.toFixed(1) }} kg</h3>
      <ol>
        <li v-for="placement in box.placements" :key="placement.itemId">□ {{ itemName(items, placement.itemId) }} — {{ itemWeight(items, placement.itemId) }} kg</li>
        <li v-for="entry in box.unplaced" :key="entry.item.id">× {{ entry.item.name }}（{{ entry.reason }}）</li>
      </ol>
    </div>
    <h3>未分配物品</h3>
    <ol>
      <li v-for="entry in plan.unplaced" :key="entry.item.id">× {{ entry.item.name }}（{{ entry.reason }}）</li>
    </ol>
    <h3>风险提示</h3>
    <p v-for="risk in risks" :key="risk.id">{{ risk.title }}：{{ risk.message }}</p>
  </section>
</template>
