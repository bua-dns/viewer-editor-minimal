<script setup>
import UserConfigPanel from './UserConfigPanel.vue'

defineProps({
  hasData: { type: Boolean, required: true },
  allowWithoutData: { type: Boolean, default: false },
})

const emit = defineEmits(['apply'])

function onApply() {
  emit('apply')
}
</script>

<template>
  <section class="configuration-panel">
    <UserConfigPanel :has-data="hasData" :allow-without-data="allowWithoutData" :force-open="true" @apply="onApply" />
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
