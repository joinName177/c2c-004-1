<script setup lang="ts">
import type { SuitcaseRemovalPreview } from '../usePlanner';

defineProps<{ preview: SuitcaseRemovalPreview }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <div class="dialog-backdrop" data-testid="remove-suitcase-dialog">
    <div class="dialog" role="dialog" aria-modal="true">
      <h2>删除「{{ preview.suitcase.name }}」？</h2>
      <p class="dialog-note">该箱涉及 {{ preview.outcomes.length }} 件物品。删除后指定到该箱的物品将改为系统分配，以下是重新分配预览：</p>
      <ul class="dialog-outcomes">
        <li v-for="outcome in preview.outcomes" :key="outcome.item.id">
          <b>{{ outcome.item.name }}</b>
          <span v-if="outcome.wasPinned" class="tag">原指定此箱</span>
          <template v-if="outcome.targetSuitcaseName">→ 移至「{{ outcome.targetSuitcaseName }}」</template>
          <span v-else class="fail">→ 无法分配：{{ outcome.reason }}</span>
        </li>
      </ul>
      <div class="dialog-actions">
        <button type="button" data-testid="cancel-remove" @click="emit('cancel')">取消</button>
        <button type="button" class="primary" data-testid="confirm-remove" @click="emit('confirm')">确认删除并保存</button>
      </div>
    </div>
  </div>
</template>
