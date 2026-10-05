<script setup lang="ts">
import { computed } from 'vue';
import type { PackingItem, PackingPlan, Suitcase } from '../../core/models';

const props = defineProps<{ plan: PackingPlan; suitcases: Suitcase[]; items: PackingItem[] }>();

const suitcaseName = computed(() => new Map(props.suitcases.map((suitcase) => [suitcase.id, suitcase.name])));

interface Row {
  item: PackingItem;
  assignedTo: string;
  placedIn?: string;
  reason?: string;
}

/** 总清单：整趟行程每件物品只出现一次，标明用户指定与系统实际落箱，未装物品给出原因。 */
const rows = computed<Row[]>(() => {
  const placed = new Map<string, string>();
  const missed = new Map<string, string>();
  for (const box of props.plan.boxes) {
    for (const placement of box.placements) placed.set(placement.itemId, suitcaseName.value.get(box.suitcaseId) ?? box.suitcaseId);
    for (const entry of box.unplaced) missed.set(entry.item.id, entry.reason);
  }
  for (const entry of props.plan.unplaced) missed.set(entry.item.id, entry.reason);
  return props.items.map((item) => ({
    item,
    assignedTo: item.suitcaseId ? suitcaseName.value.get(item.suitcaseId) ?? '已删除的箱子' : '系统分配',
    placedIn: placed.get(item.id),
    reason: missed.get(item.id),
  }));
});

const boxTotals = computed(() => props.plan.boxes.map((box) => ({
  id: box.suitcaseId,
  name: suitcaseName.value.get(box.suitcaseId) ?? box.suitcaseId,
  count: box.placements.length,
  weight: box.totalWeight,
})));
</script>

<template>
  <section class="panel checklist" data-testid="master-checklist">
    <div class="section-title">
      <div><span>04 / MASTER LIST</span><h2>整趟行程总清单</h2></div>
      <b>{{ rows.filter(row => row.placedIn).length }}/{{ rows.length }} 件已入箱</b>
    </div>
    <div class="box-totals">
      <span v-for="box in boxTotals" :key="box.id" class="box-total">{{ box.name }} · {{ box.count }} 件 · {{ box.weight.toFixed(1) }} kg</span>
      <span class="box-total grand">合计 {{ plan.totalWeight.toFixed(1) }} kg</span>
    </div>
    <table>
      <thead><tr><th>物品</th><th>必带</th><th>指定箱子</th><th>计划装入</th></tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="row.item.id" :class="{ missed: !row.placedIn }">
          <td>{{ row.item.name }}</td>
          <td>{{ row.item.mustHave ? '必带' : '可选' }}</td>
          <td>{{ row.assignedTo }}</td>
          <td v-if="row.placedIn">{{ row.placedIn }}</td>
          <td v-else class="missed-reason">未分配：{{ row.reason }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
