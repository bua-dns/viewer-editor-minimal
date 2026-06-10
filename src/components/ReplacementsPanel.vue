<script setup>
import UserReplacementsPanel from './UserReplacementsPanel.vue'
</script>

<template>
  <section class="replacements-panel">
    <UserReplacementsPanel :has-data="true" :force-open="true" />
  </section>
</template>

<style scoped lang="scss">
.replacements-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}
</style>
