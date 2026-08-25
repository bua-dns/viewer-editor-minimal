<script setup>
import { computed, ref } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useUserConfigStore } from '../stores/useUserConfigStore'
import { getRegisteredFieldTypeOptions } from '../fields/fieldRegistry'
import AutosuggestFieldConfig from './config/AutosuggestFieldConfig.vue'

const props = defineProps({
  hasData: { type: Boolean, required: true },
  allowWithoutData: { type: Boolean, default: false },
  forceOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['apply'])

const { t } = useAppConfigStore()
const {
  sortedConfigFieldEntries,
  itemLabelField,
  markAsEditedBasis,
  showOnlyNonEmptyFields,
  hierarchyFields,
  firstLevelStaticList,
  hasUnappliedUserConfigChanges,
  draggedFieldKey,
  isUserConfigOpen,
  newFieldName,
  addFieldError,
  addUserConfigField,
  setFieldType,
  updateFieldAutosuggestConfig,
  updateFieldCandidateConfig,
  setItemLabelField,
  setMarkAsEditedBasis,
  setShowOnlyNonEmptyFields,
  addHierarchyField,
  updateHierarchyFieldAt,
  removeHierarchyFieldAt,
  setFirstLevelStaticListFromText,
  removeUserConfigField,
  startDrag,
  dropAt,
  endDrag,
} = useUserConfigStore()

const isPanelOpen = computed(() => props.forceOpen || isUserConfigOpen.value)
const canRenderConfig = computed(() => props.hasData || props.allowWithoutData)
const fieldTypeOptions = getRegisteredFieldTypeOptions()
const fieldWidthOptions = [
  { value: '33%', labelKey: 'configFieldWidth33', labelFallback: '33% (3 per row)' },
  { value: '50%', labelKey: 'configFieldWidth50', labelFallback: '50% (2 per row)' },
  { value: '100%', labelKey: 'configFieldWidth100', labelFallback: '100% (1 per row)' },
]
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
const candidateTargetFieldOptionsByFieldKey = computed(() => {
  const optionsByFieldKey = {}
  const entries = sortedConfigFieldEntries.value

  entries.forEach(([fieldKey]) => {
    optionsByFieldKey[fieldKey] = entries
      .filter(([candidateKey, config]) => candidateKey !== fieldKey && config?.type !== 'candidate')
      .map(([candidateKey]) => candidateKey)
  })

  return optionsByFieldKey
})

const candidateValidationError = computed(() => {
  for (const [fieldKey, fieldConfig] of sortedConfigFieldEntries.value) {
    if (fieldConfig?.type !== 'candidate') continue

    const targetField = String(fieldConfig?.candidate?.targetField || '').trim()
    const availableTargets = new Set(candidateTargetFieldOptionsByFieldKey.value[fieldKey] || [])
    if (!targetField || !availableTargets.has(targetField)) {
      return t(
        'candidateTargetFieldError',
        `Candidate field ${fieldKey} needs a valid target field (non-candidate).`,
      )
    }
  }

  return ''
})

const firstLevelStaticListText = computed({
  get: () => firstLevelStaticList.value.join('\n'),
  set: (nextValue) => setFirstLevelStaticListFromText(nextValue),
})

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

function onCandidateTargetFieldChange(fieldKey, event) {
  const nextTargetField = event.target.value
  const current =
    sortedConfigFieldEntries.value.find(([key]) => key === fieldKey)?.[1]?.candidate || {}
  updateFieldCandidateConfig(fieldKey, {
    ...current,
    targetField: nextTargetField,
  })
}

function onCandidateInputTypeChange(fieldKey, event) {
  const nextInputType = event.target.value
  const current =
    sortedConfigFieldEntries.value.find(([key]) => key === fieldKey)?.[1]?.candidate || {}
  updateFieldCandidateConfig(fieldKey, {
    ...current,
    inputType: nextInputType,
  })
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

function onShowOnlyNonEmptyFieldsChange(event) {
  setShowOnlyNonEmptyFields(event.target.checked)
}

function onAddHierarchyField() {
  addHierarchyField()
}

function onHierarchyFieldInput(index, event) {
  updateHierarchyFieldAt(index, event.target.value)
}

function onRemoveHierarchyField(index) {
  removeHierarchyFieldAt(index)
}
</script>

<template>
  <section class="user-config-panel" v-if="canRenderConfig">
    <div
      class="user-config-head"
      :class="{ 'is-static': props.forceOpen }"
      @click="onTogglePanel"
    >
      <div class="user-config-title">{{ t('configurationTitle', 'Konfiguration') }}</div>
      <div v-if="isPanelOpen" class="user-config-actions">
        <button
          type="button"
          :disabled="!hasUnappliedUserConfigChanges || Boolean(candidateValidationError)"
          @click.stop="onApplyConfiguration"
        >
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

      <div class="user-config-toggle-row">
        <strong>{{ t('showOnlyNonEmptyFieldsLabel', 'Sidebar: Nur nicht-leere Felder anzeigen') }}</strong>
        <label class="general-config-checkbox">
          <input
            type="checkbox"
            :checked="showOnlyNonEmptyFields"
            @change="onShowOnlyNonEmptyFieldsChange"
          />
          <span>{{ t('showOnlyNonEmptyFieldsToggle', 'Aktivieren') }}</span>
        </label>
      </div>

      <div class="user-config-label-row user-config-hierarchy-row">
        <strong>{{ t('hierarchyFieldsLabel', 'Hierarchie-Felder') }}</strong>
        <div class="hierarchy-fields-editor">
          <div
            v-for="(fieldKey, index) in hierarchyFields"
            :key="`hierarchy-field-${index}`"
            class="hierarchy-fields-editor-row"
          >
            <input
              type="text"
              :value="fieldKey"
              :placeholder="t('hierarchyFieldPlaceholder', 'z. B. level_1')"
              @input="onHierarchyFieldInput(index, $event)"
            />
            <button type="button" class="remove-field-btn" @click.stop="onRemoveHierarchyField(index)">
              {{ t('removeFieldButton', 'Feld entfernen') }}
            </button>
          </div>
          <button type="button" @click.stop="onAddHierarchyField">
            {{ t('hierarchyAddField', 'Hierarchie-Feld hinzufuegen') }}
          </button>
        </div>
      </div>

      <div class="user-config-label-row user-config-hierarchy-row">
        <strong>{{ t('hierarchyFirstLevelStaticListLabel', 'Hierarchie: Preset-Liste Ebene 1') }}</strong>
        <textarea
          v-model="firstLevelStaticListText"
          rows="5"
          :placeholder="t('hierarchyFirstLevelStaticListPlaceholder', '001\n002\n003')"
        />
      </div>

      <p v-if="addFieldError" class="error user-config-error">{{ addFieldError }}</p>
      <p v-if="candidateValidationError" class="error user-config-error">{{ candidateValidationError }}</p>

      <div class="user-config-row user-config-row-head">
        <strong></strong>
        <strong>{{ t('configFieldHeader', 'Feld') }}</strong>
        <strong>{{ t('configTypeHeader', 'Typ') }}</strong>
        <strong>{{ t('configLabelHeader', 'Beschriftung') }}</strong>
        <strong>{{ t('configFieldWidthHeader', 'Feldbreite') }}</strong>
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
          'has-candidate-config': entry[1].type === 'candidate',
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
        <select v-model="entry[1].fieldWidth">
          <option v-for="option in fieldWidthOptions" :key="`field-width-${option.value}`" :value="option.value">
            {{ t(option.labelKey, option.labelFallback) }}
          </option>
        </select>
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
        <div v-if="entry[1].type === 'candidate'" class="user-config-candidate-row">
          <label class="candidate-config-field">
            <span>{{ t('candidateTargetFieldLabel', 'Ziel-Feld') }}</span>
            <select
              :value="entry[1].candidate?.targetField || ''"
              @change="onCandidateTargetFieldChange(entry[0], $event)"
            >
              <option value="">{{ t('candidateTargetFieldPlaceholder', 'Bitte auswaehlen') }}</option>
              <option
                v-for="fieldKey in candidateTargetFieldOptionsByFieldKey[entry[0]] || []"
                :key="`candidate-target-${entry[0]}-${fieldKey}`"
                :value="fieldKey"
              >
                {{ fieldKey }}
              </option>
            </select>
          </label>

          <label class="candidate-config-field">
            <span>{{ t('candidateInputTypeLabel', 'Eingabe-Modus') }}</span>
            <select
              :value="entry[1].candidate?.inputType || 'normal'"
              @change="onCandidateInputTypeChange(entry[0], $event)"
            >
              <option value="normal">{{ t('candidateInputTypeNormal', 'Einzeilig (normal)') }}</option>
              <option value="text">{{ t('candidateInputTypeText', 'Mehrzeilig (text)') }}</option>
            </select>
          </label>
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

.user-config-toggle-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 1.6fr);
  gap: var(--ve-space-2);
  align-items: center;
  margin-bottom: 0.35rem;
}

.user-config-hierarchy-row {
  align-items: flex-start;
}

.hierarchy-fields-editor {
  display: grid;
  gap: var(--ve-space-2);
}

.hierarchy-fields-editor-row {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto;
  gap: var(--ve-space-2);
}

.general-config-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

  .user-config-row {
    display: grid;
    grid-template-columns:
      34px
      minmax(145px, 1fr)
      minmax(130px, 0.8fr)
      minmax(130px, 0.8fr)
      minmax(140px, 0.75fr)
      minmax(150px, 0.95fr)
      minmax(170px, 1.05fr)
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

.user-config-row.has-candidate-config {
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

.user-config-candidate-row {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 0.55rem;
  padding: 0.2rem 0 0;
}

.candidate-config-field {
  display: grid;
  gap: 0.3rem;
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

  .user-config-toggle-row {
    grid-template-columns: 1fr;
  }

  .user-config-candidate-row {
    grid-template-columns: 1fr;
  }
}
</style>
