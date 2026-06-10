<script setup>
import { useAppConfigStore } from '../stores/useAppConfigStore'

const { t } = useAppConfigStore()
</script>

<template>
  <div class="replacements-section">
    <h3>{{ t('tab_replacements', 'Replacements') }}</h3>

    <div class="replacements-row">
      <div class="field-group">
        <label class="field-label">
          {{ t('replace_string', 'Ersetze') }}
        </label>
        <input
          type="text"
          class="replacement-input"
        />
      </div>

      <div class="field-group">
        <label class="field-label">
          {{ t('replace_with', 'mit') }}
        </label>
        <input
          type="text"
          class="replacement-input"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.replacements-section {
  padding: 1.5rem;
}

.replacements-row {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.field-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.9rem;
  font-weight: 600;
}

.replacement-input {
  width: 100%;
  padding: 0.75rem 0.9rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #1f7a8c;
  }
}

@media (max-width: 768px) {
  .replacements-row {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>