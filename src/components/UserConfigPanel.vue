<script setup>
import { computed, ref } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useUserConfigStore } from '../stores/useUserConfigStore'
import { getRegisteredFieldTypeOptions } from '../fields/fieldRegistry'
import AutosuggestFieldConfig from './config/AutosuggestFieldConfig.vue'

const props = defineProps({
  hasData: { type: Boolean, required: true },
  forceOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['apply'])

const { t } = useAppConfigStore()
const {
  sortedConfigFieldEntries,
  itemLabelField,
  markAsEditedBasis,
  hasUnappliedUserConfigChanges,
  draggedFieldKey,
  isUserConfigOpen,
  newFieldName,
  addFieldError,
  addUserConfigField,
  setFieldType,
  updateFieldAutosuggestConfig,
  setItemLabelField,
  setMarkAsEditedBasis,
  removeUserConfigField,
  startDrag,
  dropAt,
  endDrag,
} = useUserConfigStore()

const isPanelOpen = computed(() => props.forceOpen || isUserConfigOpen.value)
const fieldTypeOptions = getRegisteredFieldTypeOptions()
const itemLabelFieldOptions = computed(() => sortedConfigFieldEntries.value.map(([fieldKey]) => fieldKey))
const prefillFieldOptionsByFieldKey = computed(() => {
  const normalFieldKeys = sortedConfigFieldEntries.value
    .filter(([, config]) => config?.type === 'normal')
    .map(([fieldKey]) => fieldKey)

  const optionsByFieldKey = {}
  sortedConfigFieldEntries.value.forEach(([fieldKey]) => {
    optionsByFieldKey[fieldKey] = normalFieldKeys.filter((candidateKey) => candidateKey !== fieldKey)
  })
  return optionsByFieldKey
})
const autosuggestAdvancedCollapseToken = ref(0)

function onTogglePanel() {
  if (props.forceOpen) return
  isUserConfigOpen.value = !isUserConfigOpen.value
}

function onAddField() {
  addUserConfigField(t)
}

function onFieldTypeChange(fieldKey, nextType) {
  setFieldType(fieldKey, nextType)
}

function onAutosuggestConfigChange(fieldKey, nextAutosuggestConfig) {
  updateFieldAutosuggestConfig(fieldKey, nextAutosuggestConfig)
}

function onApplyConfiguration() {
  emit('apply')
  /*
   * Collapse token for all AutosuggestFieldConfig children:
   * incrementing a counter creates a new value every apply click, so every
   * watcher fires even if the previous state was already "collapsed".
   * This is intentionally fan-out signalling, not per-row state.
   */
  autosuggestAdvancedCollapseToken.value += 1
}

function onItemLabelFieldChange(event) {
  setItemLabelField(event.target.value)
}

function onMarkAsEditedBasisChange(event) {
  setMarkAsEditedBasis(event.target.value)
}
</script>

<template>
  <section class="user-config-panel" v-if="props.hasData">
    <div
      class="user-config-head"
      :class="{ 'is-static': props.forceOpen }"
      @click="onTogglePanel"
    >
      <div class="user-config-title">{{ t('configurationTitle', 'Konfiguration') }}</div>
      <div v-if="isPanelOpen" class="user-config-actions">
        <button type="button" :disabled="!hasUnappliedUserConfigChanges" @click.stop="onApplyConfiguration">
          {{ t('applyConfiguration', 'Konfiguration anwenden') }}
        </button>
      </div>
      <span v-if="!props.forceOpen" class="user-config-toggle-icon" aria-hidden="true">
        <span class="toggle-icon">{{ isPanelOpen ? '▴' : '▾' }}</span>
      </span>
    </div>

    <div v-if="isPanelOpen" class="user-config-grid">
      <div class="user-config-add-row">
        <strong>{{ t('addConfigurationField', 'Feld hinzufuegen') }}</strong>
        <input
          v-model="newFieldName"
          type="text"
          :placeholder="t('addFieldNamePlaceholder', 'Feldname (z. B. bemerkung)')"
          @click.stop
          @keydown.enter.prevent="onAddField"
        />
        <button type="button" @click.stop="onAddField">{{ t('addFieldButton', 'Hinzufuegen') }}</button>
      </div>

      <div class="user-config-label-row">
        <strong>{{ t('itemListLabelFieldLabel', 'Liste: Label-Feld') }}</strong>
        <select :value="itemLabelField" @change="onItemLabelFieldChange">
          <option value="">{{ t('itemListLabelFieldDefault', 'Standard (Nummer / inventory_number)') }}</option>
          <option v-for="fieldKey in itemLabelFieldOptions" :key="fieldKey" :value="fieldKey">{{ fieldKey }}</option>
        </select>
      </div>

      <div class="user-config-label-row">
        <strong>{{ t('markAsEditedBasisLabel', 'Liste: Mark-as-edited Basis') }}</strong>
        <select :value="markAsEditedBasis" @change="onMarkAsEditedBasisChange">
          <option value="">{{ t('markAsEditedBasisDefault', 'Keine Sortierung nach Bearbeitungsstand') }}</option>
          <option v-for="fieldKey in itemLabelFieldOptions" :key="`edited-basis-${fieldKey}`" :value="fieldKey">{{ fieldKey }}</option>
        </select>
      </div>

      <p v-if="addFieldError" class="error user-config-error">{{ addFieldError }}</p>

      <div class="user-config-row user-config-row-head">
        <strong></strong>
        <strong>{{ t('configFieldHeader', 'Feld') }}</strong>
        <strong>{{ t('configTypeHeader', 'Typ') }}</strong>
        <strong>{{ t('configLabelHeader', 'Beschriftung') }}</strong>
        <strong>{{ t('configPlaceholderHeader', 'Platzhalter') }}</strong>
        <strong>{{ t('configHintHeader', 'Hinweis') }}</strong>
        <strong>{{ t('configReadOnlyHeader', 'Nur Anzeige') }}</strong>
        <strong></strong>
      </div>

      <div
        v-for="entry in sortedConfigFieldEntries"
        :key="entry[0]"
        class="user-config-row"
        :class="{
          'is-dragging': draggedFieldKey === entry[0],
          'has-autosuggest-config': entry[1].type === 'wikidata-autosuggest',
        }"
        draggable="true"
        @dragstart="startDrag(entry[0])"
        @dragover.prevent
        @drop="dropAt(entry[0])"
        @dragend="endDrag"
      >
        <div class="drag-handle" aria-hidden="true">⋮⋮</div>
        <div class="field-key">{{ entry[0] }}</div>
        <select :value="entry[1].type" @change="onFieldTypeChange(entry[0], $event.target.value)">
          <option v-for="option in fieldTypeOptions" :key="option.value" :value="option.value">
            {{ t(option.labelKey, option.labelFallback) }}
          </option>
        </select>
        <input v-model="entry[1].label" type="text" :placeholder="t('configLabelInputPlaceholder', 'Label')" />
        <input v-model="entry[1].placeholder" type="text" :placeholder="t('configPlaceholderInputPlaceholder', 'z. B. Titel eingeben')" />
        <input v-model="entry[1].hint" type="text" :placeholder="t('configHintInputPlaceholder', 'z. B. Vollstaendigen Namen eintragen')" />
        <label v-if="entry[1].type !== 'wikidata-autosuggest'" class="readonly-toggle">
          <input v-model="entry[1].readOnly" type="checkbox" />
          <span>{{ t('configReadOnlyToggleLabel', 'Read-only') }}</span>
        </label>
        <span v-else class="readonly-na">-</span>
        <button type="button" class="remove-field-btn" @click.stop="removeUserConfigField(entry[0])">
          {{ t('removeFieldButton', 'Feld entfernen') }}
        </button>

        <div v-if="entry[1].type === 'wikidata-autosuggest'" class="user-config-autosuggest-row">
          <AutosuggestFieldConfig
            :model-value="entry[1].autosuggest"
            :prefill-field-options="prefillFieldOptionsByFieldKey[entry[0]] || []"
            :t="t"
            :collapse-advanced-token="autosuggestAdvancedCollapseToken"
            @update:model-value="onAutosuggestConfigChange(entry[0], $event)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.user-config-panel {
  grid-area: userconfig;
}

.user-config-head {
  display: flex;
  align-items: center;
  gap: var(--ve-space-3);
  margin-bottom: var(--ve-space-3);
  cursor: pointer;
}

.user-config-head.is-static {
  cursor: default;
}

.user-config-title {
  color: var(--ve-color-text-strong);
  font-weight: 700;
  font-size: 1.25rem;
  margin-right: auto;
}

.user-config-toggle-icon {
  background: transparent;
  color: var(--ve-color-text-muted);
  padding: 0.1rem 0.3rem;
  border-radius: 6px;
}

.toggle-icon {
  color: var(--ve-color-text-muted);
  font-size: 1.3em;
  line-height: 1;
}

.user-config-actions {
  display: inline-flex;
  gap: var(--ve-space-2);
}

.user-config-grid {
  display: grid;
  gap: 0.4rem;
}

.user-config-add-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 1.6fr) auto;
  gap: var(--ve-space-2);
  align-items: center;
  margin-bottom: 0.35rem;
}

.user-config-error {
  margin: 0 0 var(--ve-space-1);
}

.user-config-label-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 1.6fr);
  gap: var(--ve-space-2);
  align-items: center;
  margin-bottom: 0.35rem;
}

.user-config-row {
  display: grid;
  grid-template-columns:
    34px
    minmax(160px, 1.05fr)
    minmax(140px, 0.85fr)
    minmax(140px, 0.8fr)
    minmax(165px, 1fr)
    minmax(185px, 1.1fr)
    minmax(116px, 0.6fr)
    auto;
  gap: var(--ve-space-2);
  align-items: center;
}

.readonly-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ve-color-text-muted);
}

.readonly-na {
  color: var(--ve-color-text-soft);
  text-align: center;
}

.user-config-row.has-autosuggest-config {
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  padding: 0.45rem;
}

.user-config-autosuggest-row {
  grid-column: 2 / -1;
  padding: 0.1rem 0 0.45rem;
}

.user-config-row.has-autosuggest-config .user-config-autosuggest-row {
  padding: 0.2rem 0 0;
}

.remove-field-btn {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.user-config-row.is-dragging {
  opacity: 0.55;
}

.drag-handle {
  user-select: none;
  cursor: grab;
  text-align: center;
  color: var(--ve-color-text-soft);
  font-weight: 700;
}

.user-config-row-head {
  color: var(--ve-color-text-muted);
  font-size: 0.9rem;
}

.field-key {
  font-family: var(--ve-font-family-mono);
  font-size: 0.9rem;
  color: var(--ve-color-text-strong);
}

@media (max-width: 768px) {
  .user-config-row {
    grid-template-columns: 1fr;
  }

  .user-config-add-row {
    grid-template-columns: 1fr;
  }

  .user-config-label-row {
    grid-template-columns: 1fr;
  }
}
</style>
