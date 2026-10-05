<script setup lang="ts">
import { computed } from 'vue';
import type { MultiPackingPlan, PlanMode, SuitcaseConfig } from '../../core/models';

const props = defineProps<{ plans: Record<PlanMode, MultiPackingPlan>; selected: PlanMode; suitcases: SuitcaseConfig[] }>();
const emit = defineEmits<{ select: [mode: PlanMode] }>();
const totalMaxWeight = computed(() => props.suitcases.reduce((sum, suitcase) => sum + suitcase.maxWeight, 0));
const placedCount = (plan: MultiPackingPlan) => plan.suitcases.reduce((sum, entry) => sum + entry.placements.length, 0);
</script>

<template>
  <div class="plan-tabs">
    <button v-for="plan in plans" :key="plan.id" type="button" :data-plan="plan.id" :class="{ active: plan.id === selected }" @click="emit('select', plan.id)">
      <span>{{ plan.id === 'minimal' ? 'LIGHT' : plan.id === 'comfort' ? 'BALANCED' : 'RESERVE' }}</span>
      <strong>{{ plan.name }}</strong>
      <small>{{ placedCount(plan) }} 件 · {{ Math.round(plan.capacityRatio * 100) }}% 空间 · {{ plan.totalWeight.toFixed(1) }}/{{ totalMaxWeight }}kg</small>
    </button>
  </div>
</template>
