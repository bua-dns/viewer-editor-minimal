<script setup>
import { computed, ref, watch } from 'vue'
import { useFieldMapping } from '../composables/useFieldMapping'
import FieldEditorControl from './FieldEditorControl.vue'

const props = defineProps({
  selectedRawItem: { type: Object, required: true },
  selectedViewItem: { type: Object, default: null },
  includeConfiguredTypes: { type: Array, default: () => [] },
  excludeConfiguredTypes: { type: Array, default: () => [] },
  showRawDataDevPreview: { type: Boolean, default: false },
  rawDataToggleLabel: { type: String, default: 'show raw data' },
  rawDataHideLabel: { type: String, default: 'hide raw data' },
  copyRawDataLabel: { type: String, default: 'Copy raw data' },
  candidateApplyToLabel: { type: String, default: 'Apply to' },
  candidateChooseTargetLabel: { type: String, default: 'Select target in configuration' },
  isEditableSimpleValue: { type: Function, required: true },
  candidateAutosuggestPrefills: { type: Object, default: () => ({}) },
  // Field configuration to render with: '' = the primary collection, else a secondary one.
  configScope: { type: String, default: '' },
  // Prefix of the input ids; must differ between editors shown at the same time.
  fieldIdPrefix: { type: String, default: 'field' },
  // Field keys to show only (in this order) or to leave out; empty = no restriction.
  includeKeys: { type: Array, default: () => [] },
  excludeKeys: { type: Array, default: () => [] },
})

const emit = defineEmits(['field-change', 'accept-candidate'])

const {
  getFieldLabel,
  getFieldHint,
  getFieldConfig,
  getFieldWidth,
  isFieldReadOnly,
  getFieldEditorBinding,
  getPrefillProposal,
  getDisplayedFieldKeys,
} = useFieldMapping(props.configScope, { fieldIdPrefix: props.fieldIdPrefix })

// Fields whose prefill proposal was discarded with the x button. The editor is keyed per item, so
// this resets when another item is opened.
const dismissedProposalKeys = ref(new Set())

function getRowProposal(key, isReadOnly) {
  if (isReadOnly || dismissedProposalKeys.value.has(key)) return ''
  return getPrefillProposal(key, props.selectedRawItem)
}

function onDismissProposal(row) {
  dismissedProposalKeys.value.add(row.key)
}

const includeConfiguredTypeSet = computed(() =>
  new Set((Array.isArray(props.includeConfiguredTypes) ? props.includeConfiguredTypes : []).map((type) => String(type || '').trim()).filter(Boolean)),
)

const excludeConfiguredTypeSet = computed(() =>
  new Set((Array.isArray(props.excludeConfiguredTypes) ? props.excludeConfiguredTypes : []).map((type) => String(type || '').trim()).filter(Boolean)),
)

function shouldIncludeConfiguredType(configuredType) {
  const normalizedType = String(configuredType || '').trim()
  if (excludeConfiguredTypeSet.value.has(normalizedType)) return false
  if (includeConfiguredTypeSet.value.size === 0) return true
  return includeConfiguredTypeSet.value.has(normalizedType)
}

function selectRowKeys(keys) {
  const excludedKeys = new Set(props.excludeKeys)
  const keptKeys = keys.filter((key) => !excludedKeys.has(key))
  if (props.includeKeys.length === 0) return keptKeys
  return props.includeKeys.filter((key) => keptKeys.includes(key))
}

const displayedFieldKeys = computed(() => selectRowKeys(getDisplayedFieldKeys(props.selectedRawItem)))

const fieldRows = computed(() =>
  displayedFieldKeys.value.map((key) => {
    const value = props.selectedRawItem[key]
    const fieldConfig = getFieldConfig(key)
    const candidateTargetField =
      fieldConfig?.type === 'candidate' ? String(fieldConfig?.candidate?.targetField || '').trim() : ''
    const candidateTargetConfig = candidateTargetField ? getFieldConfig(candidateTargetField) : null

    return {
      key,
      value,
      label: getFieldLabel(key),
      hint: getFieldHint(key),
      fieldWidth: getFieldWidth(key),
      isReadOnly: isFieldReadOnly(key),
      prefillProposal: getRowProposal(key, isFieldReadOnly(key)),
      fieldConfig,
      configuredType: String(fieldConfig?.type || '').trim(),
      candidateTargetField,
      candidateTargetType: candidateTargetConfig?.type || null,
      candidateTargetLabel: candidateTargetField ? getFieldLabel(candidateTargetField) : '',
      fieldId: `${props.fieldIdPrefix}-${key}`,
      editorBinding: getFieldEditorBinding(key, value, props.selectedRawItem, props.candidateAutosuggestPrefills),
    }
  }).filter((row) => shouldIncludeConfiguredType(row.configuredType)),
)

function onFieldChange(row, nextValue) {
  emit('field-change', row.key, nextValue, row.editorBinding.resolvedType)
}

function shouldRenderEditor(row) {
  if (row.editorBinding.resolvedType === 'wikidata-autosuggest') return true
  return props.isEditableSimpleValue(row.value)
}

function isCandidateRow(row) {
  return row.editorBinding.resolvedType === 'candidate'
}

function canAcceptCandidate(row) {
  if (!isCandidateRow(row)) return false
  if (!row.candidateTargetField || !row.candidateTargetType) return false
  return String(row.value || '').trim().length > 0
}

function getCandidateButtonText(row) {
  if (!row.candidateTargetField || !row.candidateTargetLabel) {
    return props.candidateChooseTargetLabel
  }
  return `${props.candidateApplyToLabel} ${row.candidateTargetLabel}`
}

function onAcceptCandidate(row) {
  if (!canAcceptCandidate(row)) return
  emit('accept-candidate', {
    candidateField: row.key,
    targetField: row.candidateTargetField,
    candidateValue: row.value,
    targetConfiguredType: row.candidateTargetType,
  })
}

const isRawDataPreviewVisible = ref(false)

const selectedItemUid = computed(() => props.selectedViewItem?._uid || null)

watch(
  () => selectedItemUid.value,
  () => {
    isRawDataPreviewVisible.value = false
  },
)

const rawDataPreviewText = computed(() => JSON.stringify(props.selectedRawItem || {}, null, 2))

function onRawDataToggle() {
  isRawDataPreviewVisible.value = !isRawDataPreviewVisible.value
}

async function onCopyRawData() {
  const text = rawDataPreviewText.value
  if (!text) return

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
</script>

<template>
  <div class="field-grid">
    <template v-for="row in fieldRows" :key="row.key">
      <div class="field-row" :class="[`field-width-${row.fieldWidth.replace('%', '')}`, {
        'is-readonly': row.isReadOnly,
        'is-checkbox': row.editorBinding.resolvedType === 'checkbox',
      }]">
        <label :for="row.fieldId" class="field-label">
          <span>{{ row.label }}</span>
          <small v-if="row.isReadOnly" class="field-readonly-badge">read-only</small>
        </label>
        <div v-if="isCandidateRow(row) && shouldRenderEditor(row)" class="candidate-editor-inline">
          <FieldEditorControl
            :binding="row.editorBinding"
            :proposal="row.prefillProposal"
            @change="onFieldChange(row, $event)"
            @dismiss-proposal="onDismissProposal(row)"
          />
          <button
            type="button"
            class="candidate-accept-btn"
            :disabled="!canAcceptCandidate(row)"
            :aria-label="getCandidateButtonText(row)"
            :title="getCandidateButtonText(row)"
            @click="onAcceptCandidate(row)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="feather feather-arrow-down"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </button>
        </div>
        <FieldEditorControl
          v-else-if="shouldRenderEditor(row)"
          :binding="row.editorBinding"
          :proposal="row.prefillProposal"
          @change="onFieldChange(row, $event)"
          @dismiss-proposal="onDismissProposal(row)"
        />
        <pre v-else>{{ JSON.stringify(row.value) }}</pre>
        <p v-if="row.hint" class="field-hint">{{ row.hint }}</p>
      </div>
    </template>
    <div v-if="props.showRawDataDevPreview" class="field-row raw-data-row">
      <div class="raw-data-actions">
        <button type="button" class="raw-data-toggle" @click="onRawDataToggle">
          {{ isRawDataPreviewVisible ? props.rawDataHideLabel : props.rawDataToggleLabel }}
        </button>
        <button type="button" class="raw-data-toggle" @click="onCopyRawData">{{ props.copyRawDataLabel }}</button>
      </div>
      <pre v-if="isRawDataPreviewVisible" class="raw-data-preview">{{ rawDataPreviewText }}</pre>
    </div>
  </div>
</template>

<style scoped lang="scss">
.field-grid {
  // Die Feldbreiten (33 / 50 / 100 %) gelten erst, wenn die Spalte breit genug ist; gemessen
  // wird die Breite des Feldbereichs selbst, nicht der Viewport.
  container: field-grid / inline-size;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.75rem;
}

.field-row {
  display: grid;
  grid-column: 1 / -1;
  gap: 0.35rem;
}

.field-row.field-width-33 {
  grid-column: span 2;
}

.field-row.field-width-50 {
  grid-column: span 3;
}

.field-row.field-width-100 {
  grid-column: 1 / -1;
}

// Checkbox fields: the box in front of its label on one line, a hint below the label.
.field-row.is-checkbox {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 0.5rem;
}

.field-row.is-checkbox > :not(.field-label, .field-hint) {
  grid-row: 1;
  grid-column: 1;
  display: flex;
  align-items: center;
}

// Without the browser's default margin and at text size, the box centres on the label's line.
.field-row.is-checkbox :deep(input[type='checkbox']) {
  margin: 0;
  width: 1.05em;
  height: 1.05em;
}

.field-row.is-checkbox > .field-label {
  grid-row: 1;
  grid-column: 2;
  cursor: pointer;
}

.field-row.is-checkbox > .field-hint {
  grid-column: 2;
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.field-readonly-badge {
  color: var(--ve-color-text-muted);
  font-weight: 500;
  font-size: 0.78rem;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}

.field-row.is-readonly {
  opacity: 0.82;
}

.field-row.is-readonly :deep(input[readonly]),
.field-row.is-readonly :deep(textarea[readonly]),
.field-row.is-readonly :deep(input:disabled) {
  background: color-mix(in srgb, var(--color-surface) 60%, #f3f5f8);
  border-color: color-mix(in srgb, var(--ve-color-border-soft) 78%, #c4ccd7);
  color: var(--ve-color-text-muted);
  cursor: not-allowed;
}

.field-hint {
  margin: 0;
  color: var(--ve-color-text-muted);
  font-size: 0.84rem;
}

.candidate-accept-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  padding: 0.2rem;
  flex: 0 0 auto;
}

.candidate-editor-inline {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.candidate-editor-inline > .field-editor-control {
  flex: 1 1 auto;
  min-width: 0;
}

.raw-data-row {
  grid-column: 1 / -1;
  gap: 0.5rem;
}

.raw-data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.raw-data-toggle {
  justify-self: start;
  font: inherit;
}

.raw-data-preview {
  margin: 0;
  padding: 0.65rem;
  max-height: 18rem;
  overflow: auto;
  border: 1px solid var(--ve-color-border-soft);
  border-radius: 0.35rem;
  background: hsl(0, 0%, 10%);
  font-size: 0.82rem;
  line-height: 1.35;
}

// Mittlere Breite: Drittel-Felder werden zu halben Feldern.
@container field-grid (max-width: 36rem) {
  .field-row.field-width-33 {
    grid-column: span 3;
  }
}

// Schmale Spalte: alle Felder volle Breite, eines pro Zeile.
@container field-grid (max-width: 24rem) {
  .field-row.field-width-33,
  .field-row.field-width-50 {
    grid-column: 1 / -1;
  }
}
</style>
