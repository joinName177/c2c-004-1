<script setup lang="ts">
import { computed } from 'vue';
import type { RemovalPreview } from '../../core/suitcase-removal';
import type { Suitcase } from '../../core/models';

const props = defineProps<{ preview: RemovalPreview; suitcases: Suitcase[] }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
const nameOf = computed(() => new Map(props.suitcases.map((suitcase) => [suitcase.id, suitcase.name])));
const moved = computed(() => props.preview.moves.filter((move) => move.toSuitcaseId));
const stranded = computed(() => props.preview.moves.filter((move) => !move.toSuitcaseId));
</script>

<template>
  <div class="removal-overlay" data-testid="removal-preview" role="dialog" aria-modal="true">
    <div class="removal-dialog">
      <h2>删除「{{ preview.suitcase.name }}」？</h2>
      <p class="removal-summary">
        箱内还有 {{ preview.moves.length }} 件相关物品。删除后它们的指定会被解除，并按当前策略在剩余箱子中重新分配；其他箱子的指定保持不变。
      </p>
      <ul v-if="moved.length" class="removal-list">
        <li v-for="move in moved" :key="move.item.id">✓ {{ move.item.name }} → {{ nameOf.get(move.toSuitcaseId!) ?? move.toSuitcaseId }}</li>
      </ul>
      <ul v-if="stranded.length" class="removal-list stranded">
        <li v-for="move in stranded" :key="move.item.id">× {{ move.item.name }} 无法装入：{{ move.reason }}</li>
      </ul>
      <p v-if="!preview.hasRemainingSuitcase" class="removal-warning">删除后没有任何行李箱，所有物品都会处于未分配状态。</p>
      <div class="removal-actions">
        <button type="button" data-testid="cancel-removal" @click="emit('cancel')">取消</button>
        <button type="button" class="danger" data-testid="confirm-removal" @click="emit('confirm')">确认删除并重新分配</button>
      </div>
    </div>
  </div>
</template>
