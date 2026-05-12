<script setup>
const props = defineProps({
  importFileName: {
    type: String,
    default: '',
  },
  isDirty: {
    type: Boolean,
    default: false,
  },
  noFileLoadedLabel: {
    type: String,
    required: true,
  },
  unsavedChangesLabel: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <section class="toolbar-panel">
    <div>
      <p v-if="!props.importFileName" class="meta">{{ props.noFileLoadedLabel }}</p>
    </div>
    <p v-if="props.isDirty" class="dirty">{{ props.unsavedChangesLabel }}</p>
  </section>
</template>

<style scoped lang="scss">
.toolbar-panel {
  grid-area: toolbar;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ve-space-4);
}

.meta {
  margin: 0;
  color: var(--ve-color-text-soft);
}

.dirty {
  margin: 0;
  color: var(--ve-color-success);
  font-weight: 600;
}

@media (max-width: 768px) {
  .toolbar-panel {
    flex-direction: column;
    align-items: stretch;
  }

}
</style>
