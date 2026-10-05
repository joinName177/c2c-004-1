<script setup lang="ts">
import { computed } from 'vue';
import type { MultiPackingPlan, PackingItem, SuitcaseConfig } from '../../core/models';

const props = defineProps<{ plan: MultiPackingPlan; suitcases: SuitcaseConfig[]; items: PackingItem[] }>();

interface ChecklistRow {
  item: PackingItem;
  pinnedName?: string;
  targetName?: string;
  reason?: string;
}

const suitcaseName = computed(() => new Map(props.suitcases.map((suitcase) => [suitcase.id, suitcase.name])));

const rows = computed<ChecklistRow[]>(() => props.items.map((item) => {
  const pinnedName = item.suitcaseId ? suitcaseName.value.get(item.suitcaseId) : undefined;
  const target = props.plan.suitcases.find((entry) => entry.placements.some((placement) => placement.itemId === item.id));
  if (target) return { item, pinnedName, targetName: suitcaseName.value.get(target.suitcaseId) };
  const pinnedFailure = props.plan.suitcases.flatMap((entry) => entry.unplaced).find((entry) => entry.item.id === item.id);
  if (pinnedFailure) return { item, pinnedName, reason: pinnedFailure.reason };
  const unassigned = props.plan.unassigned.find((entry) => entry.item.id === item.id);
  return { item, pinnedName, reason: unassigned?.reason ?? '未分配' };
}));

const placedCount = computed(() => rows.value.filter((row) => row.targetName).length);
</script>

<template>
  <section class="panel checklist" data-testid="master-checklist">
    <div class="section-title"><div><span>04 / MASTER LIST</span><h2>总清单 · {{ plan.name }}</h2></div><b>{{ placedCount }}/{{ items.length }} 件已装 · {{ plan.totalWeight.toFixed(1) }} kg</b></div>
    <table>
      <thead><tr><th>物品</th><th>必带</th><th>指定箱</th><th>计划装箱</th><th>状态</th></tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="row.item.id" :class="{ unpacked: !row.targetName }">
          <td>{{ row.item.name }}<small>{{ row.item.weight }} kg</small></td>
          <td>{{ row.item.mustHave ? '必带' : '可选' }}</td>
          <td>{{ row.pinnedName ?? '系统分配' }}</td>
          <td>{{ row.targetName ?? '—' }}</td>
          <td><span v-if="row.targetName" class="status ok">已装</span><span v-else class="status fail">未装：{{ row.reason }}</span></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
