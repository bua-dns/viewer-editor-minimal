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
  // Keys found in the loaded items; the ones without configuration can be added from here.
  dataFieldKeys: { type: Array, default: () => [] },
  // Online: the collection's fields from Strapi, see composables/useRemoteFieldModel.js
  // ({ source, fields, status, errorMessage }). Offered for adding next to the keys in the items.
  remoteFieldModel: { type: Object, default: null },
  // Shown above the form when no data is loaded.
  noDataHint: { type: String, default: '' },
})

const emit = defineEmits(['apply', 'reload-remote-field-model'])

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
  addUserConfigFieldsFromDataKeys,
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
const RESERVED_DATA_KEYS = new Set(['scan', 'suspendEditing', '__onlineMeta'])
const remoteFields = computed(() =>
  Array.isArray(props.remoteFieldModel?.fields) ? props.remoteFieldModel.fields : [],
)
const remoteFieldModelStatus = computed(() => props.remoteFieldModel?.status || 'idle')
const hasRemoteFieldModel = computed(() => Boolean(props.remoteFieldModel?.source))
// Fields of the data model first (in schema order, with their Strapi type), then keys that only the
// loaded items have; without the ones already configured.
const unconfiguredFieldEntries = computed(() => {
  const configuredKeys = new Set(sortedConfigFieldEntries.value.map(([fieldKey]) => fieldKey))
  const dataKeyEntries = props.dataFieldKeys.map((key) => ({ key, strapiType: '', suggestedType: 'normal' }))
  const entriesByKey = new Map()
  for (const entry of [...remoteFields.value, ...dataKeyEntries]) {
    if (!entriesByKey.has(entry.key)) entriesByKey.set(entry.key, entry)
  }
  return Array.from(entriesByKey.values()).filter(
    (entry) => !RESERVED_DATA_KEYS.has(entry.key) && !configuredKeys.has(entry.key),
  )
})
// The add-field dropdown: the unconfigured fields, plus "custom name" for a free text input. Without
// any field to offer (offline, nothing loaded) only the text input is shown.
const CUSTOM_FIELD_OPTION = '__custom__'
const selectedFieldOption = ref('')
const showCustomFieldInput = computed(
  () => !unconfiguredFieldEntries.value.length || selectedFieldOption.value === CUSTOM_FIELD_OPTION,
)
const canAddField = computed(() => showCustomFieldInput.value || Boolean(selectedFieldOption.value))
const addFieldSelectPlaceholder = computed(() =>
  hasRemoteFieldModel.value
    ? t('addFieldSelectFromModel', '- Feld aus dem Datenmodell waehlen -')
    : t('addFieldSelectFromData', '- Feld aus den Daten waehlen -'),
)
const addFieldSelectTitle = computed(() => {
  const selectedEntry = unconfiguredFieldEntries.value.find((entry) => entry.key === selectedFieldOption.value)
  return selectedEntry ? fieldEntryTitle(selectedEntry) : ''
})

// "Add all" leaves out structured fields (relations, components, JSON): as text fields they can
// neither be edited nor searched. They can still be added one by one from the dropdown.
const addAllFieldEntries = computed(() => unconfiguredFieldEntries.value.filter((entry) => !entry.isStructured))
const addAllTitle = computed(() =>
  addAllFieldEntries.value.length < unconfiguredFieldEntries.value.length
    ? t('dataKeysAddAllSkipsStructured', 'Structured fields (relations, components, JSON) are not added.')
    : '',
)

function fieldOptionLabel(entry) {
  return entry.strapiType ? `${entry.key} (${entry.strapiType})` : entry.key
}
const remoteFieldModelNote = computed(() => {
  if (remoteFieldModelStatus.value === 'loading') {
    return t('remoteFieldModelLoading', 'Loading the data model from Strapi ...')
  }
  if (remoteFieldModelStatus.value === 'error') {
    return `${t('remoteFieldModelError', 'The data model could not be loaded')}: ${props.remoteFieldModel.errorMessage}`
  }
  if (props.remoteFieldModel?.source === 'sample') {
    return t(
      'remoteFieldModelSampleNote',
      'The schema is not readable for this role (Strapi permission "Content-type-builder: getContentTypes"), so the fields were taken from one sample item. Relations without read permission may be missing.',
    )
  }
  if (remoteFieldModelStatus.value === 'ready' && !unconfiguredFieldEntries.value.length) {
    return t('remoteFieldsAllConfigured', 'All fields of the data model are configured.')
  }
  return ''
})
function fieldEntryTitle(entry) {
  if (!entry.strapiType) return ''
  if (!entry.isStructured) return `Strapi: ${entry.strapiType}`
  return `Strapi: ${entry.strapiType} - ${t('remoteFieldStructuredNote', 'structured value, the viewer edits it only partly')}`
}
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
  if (showCustomFieldInput.value) {
    addUserConfigField(t)
    return
  }
  const selectedEntry = unconfiguredFieldEntries.value.find((entry) => entry.key === selectedFieldOption.value)
  if (!selectedEntry) return
  addFieldEntries([selectedEntry])
  selectedFieldOption.value = ''
  addFieldError.value = ''
}

// Adds the fields and gives each the viewer type proposed for its Strapi type (text, integer, ...).
function addFieldEntries(entries) {
  const suggestedTypeByKey = new Map(entries.map((entry) => [entry.key, entry.suggestedType]))
  for (const fieldKey of addUserConfigFieldsFromDataKeys(entries.map((entry) => entry.key))) {
    const suggestedType = suggestedTypeByKey.get(fieldKey)
    if (suggestedType && suggestedType !== 'normal') setFieldType(fieldKey, suggestedType)
  }
}

function onAddAllFieldEntries() {
  addFieldEntries(addAllFieldEntries.value)
  selectedFieldOption.value = ''
}

function onReloadRemoteFieldModel() {
  emit('reload-remote-field-model')
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
      <p v-if="props.noDataHint" class="user-config-no-data-hint">{{ props.noDataHint }}</p>

      <div class="user-config-add-row">
        <strong>{{ t('addConfigurationField', 'Feld hinzufuegen') }}</strong>
        <div class="user-config-add-controls">
          <select
            v-if="unconfiguredFieldEntries.length"
            v-model="selectedFieldOption"
            :title="addFieldSelectTitle"
            @click.stop
          >
            <option value="">{{ addFieldSelectPlaceholder }}</option>
            <option v-for="entry in unconfiguredFieldEntries" :key="`field-option-${entry.key}`" :value="entry.key">
              {{ fieldOptionLabel(entry) }}
            </option>
            <option :value="CUSTOM_FIELD_OPTION">{{ t('addFieldCustomOption', 'Eigener Feldname ...') }}</option>
          </select>
          <input
            v-if="showCustomFieldInput"
            v-model="newFieldName"
            type="text"
            :placeholder="t('addFieldNamePlaceholder', 'Feldname (z. B. bemerkung)')"
            @click.stop
            @keydown.enter.prevent="onAddField"
          />
          <button type="button" :disabled="!canAddField" @click.stop="onAddField">
            {{ t('addFieldButton', 'Hinzufuegen') }}
          </button>
          <button
            v-if="addAllFieldEntries.length > 1"
            type="button"
            :title="addAllTitle"
            @click.stop="onAddAllFieldEntries"
          >
            {{ t('dataKeysAddAll', 'Add all') }}
          </button>
          <button
            v-if="remoteFieldModelStatus !== 'idle'"
            type="button"
            :disabled="remoteFieldModelStatus === 'loading'"
            @click.stop="onReloadRemoteFieldModel"
          >
            {{ t('remoteFieldModelReload', 'Reload data model') }}
          </button>
        </div>
      </div>
      <p
        v-if="remoteFieldModelNote"
        class="user-config-add-note"
        :class="{ error: remoteFieldModelStatus === 'error' }"
      >
        {{ remoteFieldModelNote }}
      </p>
      <p
        v-if="!sortedConfigFieldEntries.length && unconfiguredFieldEntries.length"
        class="user-config-add-note"
      >
        {{
          t(
            'dataKeysNoConfigNote',
            'This data source has no field configuration yet. Add the fields you want to edit, then apply the configuration.',
          )
        }}
      </p>

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
        <strong>{{ t('configDisplayHeader', 'Anzeige') }}</strong>
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
        <div class="display-toggles">
          <label v-if="entry[1].type !== 'wikidata-autosuggest'" class="readonly-toggle">
            <input v-model="entry[1].readOnly" type="checkbox" />
            <span>{{ t('configReadOnlyToggleLabel', 'Read-only') }}</span>
          </label>
          <label class="readonly-toggle" :title="t('configHiddenToggleTitle', 'Feld bleibt in den Daten (z. B. als Prefill-Quelle), erscheint aber nicht im Editor')">
            <input v-model="entry[1].hidden" type="checkbox" />
            <span>{{ t('configHiddenToggleLabel', 'Hidden') }}</span>
          </label>
        </div>
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
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 1.6fr);
  gap: var(--ve-space-2);
  align-items: center;
  margin-bottom: 0.35rem;
}

.user-config-add-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ve-space-2);
  min-width: 0;
}

.user-config-add-controls select,
.user-config-add-controls input {
  flex: 1 1 14rem;
  min-width: 0;
}

.user-config-add-note {
  margin: 0 0 0.35rem;
}

.user-config-error {
  margin: 0 0 var(--ve-space-1);
}

.user-config-no-data-hint {
  margin: 0 0 0.35rem;
  color: var(--ve-color-text-soft);
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

.display-toggles {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
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
