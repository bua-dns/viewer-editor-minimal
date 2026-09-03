<script setup>
import { computed } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useOnlineModeStore } from '../stores/useOnlineModeStore'
import { useReplacementsStore } from '../stores/useReplacementsStore'
import ReplacementsUnit from './ReplacementsUnit.vue'

const emit = defineEmits(['apply-replacements'])

const { t } = useAppConfigStore()
const { appMode } = useOnlineModeStore()
const { replacements, removeReplacement, applyStatus, lastApplyError, lastApplySummary } =
  useReplacementsStore()

const replacementEntries = computed(() =>
  Object.entries(replacements.value)
    .map(([field, mappings]) => ({
      field,
      entries: Object.entries(mappings || {}),
    }))
    .filter((group) => group.entries.length > 0),
)

const hasRules = computed(() => replacementEntries.value.length > 0)
const isApplying = computed(() => applyStatus.value === 'applying')

function formatMessage(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split('{' + key + '}').join(String(value)),
    String(template || ''),
  )
}

const applySummaryMessage = computed(() => {
  const summary = lastApplySummary.value
  if (applyStatus.value !== 'success' || !summary) return ''

  const totalItems = summary.changedItemCount + summary.remoteChangedItemCount
  if (!totalItems) {
    return t('replacementsApplyNoMatch', 'Keine Treffer - es wurde nichts geändert.')
  }

  if (summary.online) {
    return formatMessage(
      t(
        'replacementsApplyOnlineSummary',
        'Ersetzungen angewendet: {items} geladene Datensätze und {remoteItems} weitere Datensätze der Collection geändert ({fields} Felder).',
      ),
      {
        items: summary.changedItemCount,
        remoteItems: summary.remoteChangedItemCount,
        fields: summary.changedFieldCount + summary.remoteChangedFieldCount,
      },
    )
  }

  return formatMessage(
    t('replacementsApplyLocalSummary', 'Ersetzungen angewendet: {items} Datensätze, {fields} Felder geändert.'),
    { items: summary.changedItemCount, fields: summary.changedFieldCount },
  )
})

function onRemoveReplacement(field, searchText) {
  removeReplacement(field, searchText)
}

function onApplyReplacements() {
  emit('apply-replacements')
}
</script>

<template>
  <ReplacementsUnit @apply-replacements="onApplyReplacements" />
  <section class="replacements-panel">
    <div class="replacements-actions">
      <button type="button" class="transfer-btn transfer-btn-mode" :disabled="!hasRules || isApplying"
        @click="onApplyReplacements">
        {{
          isApplying
            ? t('replacementsApplyRunning', 'Ersetzungen werden angewendet ...')
            : t('replacementsApplyButton', 'Ersetzungen anwenden')
        }}
      </button>
      <p v-if="appMode === 'online'" class="replacements-note">
        {{
          t(
            'replacementsOnlineHint',
            'Ersetzungen werden auf die gesamte Collection angewendet und mit dem nächsten Speichern nach Strapi geschrieben.',
          )
        }}
      </p>
    </div>

    <p v-if="applySummaryMessage" class="replacements-status status-success">{{ applySummaryMessage }}</p>
    <p v-if="applyStatus === 'error'" class="replacements-status status-error">
      {{ lastApplyError || t('replacementsApplyFailed', 'Ersetzungen konnten nicht vollständig angewendet werden.') }}
    </p>

    <p v-if="!hasRules" class="replacements-note">
      {{ t('replacementsEmpty', 'Noch keine Ersetzungen erfasst.') }}
    </p>

    <div v-else class="replacements-list">
      <section v-for="group in replacementEntries" :key="group.field" class="replacements-group">
        <h3 class="replacements-group-title">{{ group.field }}</h3>
        <table class="replacements-table">
          <thead>
            <tr>
              <th>{{ t('replace_string', 'Ersetze') }}</th>
              <th>{{ t('replace_with', 'mit') }}</th>
              <th class="replacements-action-column"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in group.entries" :key="entry[0]">
              <td>{{ entry[0] }}</td>
              <td>{{ entry[1] }}</td>
              <td class="replacements-action-column">
                <button type="button" class="remove-rule-btn" :disabled="isApplying"
                  :aria-label="t('replacementsRemoveRule', 'Regel entfernen')"
                  @click="onRemoveReplacement(group.field, entry[0])">
                  ×
                </button>
              </td>
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

.replacements-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.replacements-note {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.replacements-status {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  font-weight: 600;
}

.replacements-status.status-success {
  color: var(--color-text-primary);
}

.replacements-status.status-error {
  color: #b3261e;
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

.replacements-action-column {
  width: 2.5rem;
  text-align: right;
}

.remove-rule-btn {
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1.2;
  cursor: pointer;
}

.remove-rule-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
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
