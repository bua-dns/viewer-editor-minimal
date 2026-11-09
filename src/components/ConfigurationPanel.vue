<script setup>
import UserConfigPanel from './UserConfigPanel.vue'

defineProps({
  hasData: { type: Boolean, required: true },
  allowWithoutData: { type: Boolean, default: false },
  dataFieldKeys: { type: Array, default: () => [] },
  remoteFieldModel: { type: Object, default: null },
  noDataHint: { type: String, default: '' },
})

const emit = defineEmits(['apply', 'reload-remote-field-model'])

function onApply() {
  emit('apply')
}
</script>

<template>
  <section class="configuration-panel">
    <UserConfigPanel
      :has-data="hasData"
      :allow-without-data="allowWithoutData"
      :data-field-keys="dataFieldKeys"
      :remote-field-model="remoteFieldModel"
      :no-data-hint="noDataHint"
      :force-open="true"
      @apply="onApply"
      @reload-remote-field-model="emit('reload-remote-field-model')"
    />
  </section>
</template>

<style scoped lang="scss">
.configuration-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}
</style>
