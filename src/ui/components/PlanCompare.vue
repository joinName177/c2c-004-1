<script setup lang="ts">
import type { PackingPlan, PlanMode, Suitcase } from '../../core/models';
defineProps<{ plans: Record<PlanMode, PackingPlan>; selected: PlanMode; suitcases: Suitcase[] }>();
const emit = defineEmits<{ select: [mode: PlanMode] }>();
const placedCount = (plan: PackingPlan) => plan.boxes.reduce((sum, box) => sum + box.placements.length, 0);
const unplacedCount = (plan: PackingPlan) => plan.unplaced.length + plan.boxes.reduce((sum, box) => sum + box.unplaced.length, 0);
const maxWeight = (suitcases: Suitcase[]) => suitcases.reduce((sum, suitcase) => sum + suitcase.maxWeight, 0);
</script>

<template>
  <div class="plan-tabs">
    <button v-for="plan in plans" :key="plan.id" type="button" :data-plan="plan.id" :class="{ active: plan.id === selected }" @click="emit('select', plan.id)">
      <span>{{ plan.id === 'minimal' ? 'LIGHT' : plan.id === 'comfort' ? 'BALANCED' : 'RESERVE' }}</span>
      <strong>{{ plan.name }}</strong>
      <small>{{ placedCount(plan) }} 件入箱 · {{ unplacedCount(plan) }} 件未装 · {{ Math.round(plan.capacityRatio * 100) }}% 空间 · {{ plan.totalWeight.toFixed(1) }}/{{ maxWeight(suitcases) }}kg</small>
    </button>
  </div>
</template>
