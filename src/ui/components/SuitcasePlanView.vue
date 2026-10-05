<script setup lang="ts">
import type { PackingItem, SuitcaseConfig, SuitcasePlan } from '../../core/models';
import PackingProjection from './PackingProjection.vue';

defineProps<{ suitcase: SuitcaseConfig; plan: SuitcasePlan; items: PackingItem[]; selectedId?: string }>();
const emit = defineEmits<{ select: [id: string] }>();
</script>

<template>
  <div class="canvas-panel suitcase-plan" :data-suitcase-plan="suitcase.id">
    <div class="canvas-head">
      <div><span>PACKING MAP</span><h2>{{ suitcase.name }}</h2></div>
      <div class="metrics">
        <span><b>{{ Math.round(plan.capacityRatio * 100) }}%</b>空间利用</span>
        <span><b>{{ plan.totalWeight.toFixed(1) }}</b>kg / {{ suitcase.maxWeight }}kg</span>
        <span><b>{{ plan.placements.length }}</b>件已装</span>
        <span><b>{{ plan.unplaced.length }}</b>件未装</span>
      </div>
    </div>
    <div class="projections">
      <PackingProjection view="top" :plan="plan" :suitcase="suitcase" :items="items" :selected-id="selectedId" @select="emit('select', $event)" />
      <PackingProjection view="side" :plan="plan" :suitcase="suitcase" :items="items" :selected-id="selectedId" @select="emit('select', $event)" />
    </div>
    <ul v-if="plan.unplaced.length" class="unplaced-list">
      <li v-for="entry in plan.unplaced" :key="entry.item.id"><b>{{ entry.item.name }}</b>（指定此箱）：{{ entry.reason }}</li>
    </ul>
  </div>
</template>
