<script setup>
import { computed } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useReplacementsStore } from '../stores/useReplacementsStore'
import ReplacementsUnit from './ReplacementsUnit.vue'

const { t } = useAppConfigStore()
const { replacements } = useReplacementsStore()

const replacementEntries = computed(() =>
  Object.entries(replacements.value)
    .map(([field, mappings]) => ({
      field,
      entries: Object.entries(mappings || {}),
    }))
    .filter((group) => group.entries.length > 0),
)
</script>

<template>
  <ReplacementsUnit />
  <section class="replacements-panel">
    <!-- <UserReplacementsPanel :has-data="true" :force-open="true" /> -->
    <div v-if="replacementEntries.length" class="replacements-list">
      <section v-for="group in replacementEntries" :key="group.field" class="replacements-group">
        <h3 class="replacements-group-title">{{ group.field }}</h3>
        <table class="replacements-table">
          <thead>
            <tr>
              <th>{{ t('replace_string', 'Ersetze') }}</th>
              <th>{{ t('replace_with', 'mit') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in group.entries" :key="entry[0]">
              <td>{{ entry[0] }}</td>
              <td>{{ entry[1] }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.replacements-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.replacements-list {
  display: grid;
  gap: 1.5rem;
}

.replacements-group {
  padding: 1rem 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.replacements-group-title {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.replacements-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.replacements-table th,
.replacements-table td {
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--color-border-soft);
  vertical-align: top;
}

.replacements-table th {
  color: var(--color-text-primary);
  font-weight: 700;
  background: var(--color-surface);
}

.replacements-table td {
  color: var(--color-text-primary);
  font-weight: 500;
}

@media (max-width: 768px) {
  .replacements-group {
    padding: 0.85rem 1rem;
  }

  .replacements-table th,
  .replacements-table td {
    padding: 0.45rem 0.5rem;
  }
}
</style>
