<script setup lang="ts">
import type { Suitcase } from '../../core/models';
defineProps<{ suitcase: Suitcase; errors: string[]; index: number }>();
const emit = defineEmits<{ update: [patch: Partial<Suitcase>]; remove: [] }>();
const onName = (event: Event) => emit('update', { name: (event.target as HTMLInputElement).value });
const onNumber = (key: 'length' | 'width' | 'height' | 'maxWeight', event: Event) => emit('update', { [key]: Number((event.target as HTMLInputElement).value) } as Partial<Suitcase>);
</script>

<template>
  <section class="panel suitcase-form" :data-suitcase-id="suitcase.id">
    <div class="section-title">
      <div><span>01 / SUITCASE {{ index + 1 }}</span><h2><input class="suitcase-name" aria-label="箱子名称" :value="suitcase.name" @input="onName" /></h2></div>
      <button type="button" class="icon-button remove-suitcase" :aria-label="`删除 ${suitcase.name}`" @click="emit('remove')">×</button>
    </div>
    <div class="dimension-grid">
      <label>长度 <span>CM</span><input :aria-label="`${suitcase.name}长度`" type="number" min="1" :value="suitcase.length" @input="onNumber('length', $event)" /></label>
      <i>×</i>
      <label>宽度 <span>CM</span><input :aria-label="`${suitcase.name}宽度`" type="number" min="1" :value="suitcase.width" @input="onNumber('width', $event)" /></label>
      <i>×</i>
      <label>高度 <span>CM</span><input :aria-label="`${suitcase.name}高度`" type="number" min="1" :value="suitcase.height" @input="onNumber('height', $event)" /></label>
    </div>
    <label class="weight-field">最大承重 <span>{{ suitcase.maxWeight }} kg</span><input :aria-label="`${suitcase.name}承重`" type="range" min="1" max="35" step="0.5" :value="suitcase.maxWeight" @input="onNumber('maxWeight', $event)" /></label>
    <p v-for="error in errors" :key="error" class="field-error">{{ error }}</p>
  </section>
</template>
