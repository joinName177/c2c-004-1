<script setup lang="ts">
import type { SuitcaseConfig } from '../../core/models';

defineProps<{ suitcases: SuitcaseConfig[]; errors: Record<string, string[]> }>();
const emit = defineEmits<{
  update: [id: string, patch: Partial<SuitcaseConfig>];
  add: [];
  remove: [id: string];
}>();

function onNumber(id: string, key: 'length' | 'width' | 'height' | 'maxWeight', event: Event) {
  emit('update', id, { [key]: Number((event.target as HTMLInputElement).value) });
}
</script>

<template>
  <section class="panel suitcase-form">
    <div class="section-title"><div><span>01 / SUITCASES</span><h2>行李箱配置</h2></div><b>{{ suitcases.length }} 只</b></div>
    <article v-for="(suitcase, index) in suitcases" :key="suitcase.id" class="suitcase-card" :data-suitcase-id="suitcase.id">
      <header class="suitcase-head">
        <input class="suitcase-name" :aria-label="`箱子 ${index + 1} 名称`" :value="suitcase.name" @input="emit('update', suitcase.id, { name: ($event.target as HTMLInputElement).value })" />
        <button class="icon-button" type="button" :disabled="suitcases.length <= 1" :aria-label="`删除箱子 ${suitcase.name}`" @click="emit('remove', suitcase.id)">×</button>
      </header>
      <div class="dimension-grid">
        <label>长度 <span>CM</span><input :aria-label="`${suitcase.name}长度`" type="number" min="1" :value="suitcase.length" @input="onNumber(suitcase.id, 'length', $event)" /></label>
        <i>×</i>
        <label>宽度 <span>CM</span><input :aria-label="`${suitcase.name}宽度`" type="number" min="1" :value="suitcase.width" @input="onNumber(suitcase.id, 'width', $event)" /></label>
        <i>×</i>
        <label>高度 <span>CM</span><input :aria-label="`${suitcase.name}高度`" type="number" min="1" :value="suitcase.height" @input="onNumber(suitcase.id, 'height', $event)" /></label>
      </div>
      <label class="weight-field">最大承重 <span>{{ suitcase.maxWeight }} kg</span><input type="range" min="1" max="35" step="0.5" :value="suitcase.maxWeight" @input="onNumber(suitcase.id, 'maxWeight', $event)" /></label>
      <p v-for="error in errors[suitcase.id] ?? []" :key="error" class="field-error">{{ error }}</p>
    </article>
    <button class="add-suitcase" type="button" data-testid="add-suitcase" @click="emit('add')">＋ 添加行李箱</button>
  </section>
</template>
