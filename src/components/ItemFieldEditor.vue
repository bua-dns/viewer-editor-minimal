<script setup>
import { computed, ref, watch } from 'vue'
import { useFieldMapping } from '../composables/useFieldMapping'
import ViewerWikidataField from './ViewerWikidataField.vue'

const props = defineProps({
  selectedRawItem: { type: Object, required: true },
  selectedViewItem: { type: Object, default: null },
  suspendedItemIndices: { type: Array, default: () => [] },
  suspendEditingLabel: { type: String, default: 'Suspend editing' },
  showRawDataDevPreview: { type: Boolean, default: false },
  rawDataToggleLabel: { type: String, default: 'show raw data' },
  rawDataHideLabel: { type: String, default: 'hide raw data' },
  copyRawDataLabel: { type: String, default: 'Copy raw data' },
  candidateApplyToLabel: { type: String, default: 'Apply to' },
  candidateChooseTargetLabel: { type: String, default: 'Select target in configuration' },
  isEditableSimpleValue: { type: Function, required: true },
  candidateAutosuggestPrefills: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['field-change', 'toggle-suspend-editing', 'accept-candidate'])

const { getFieldLabel, getFieldHint, getFieldConfig, isFieldReadOnly, getFieldEditorBinding, getDisplayedFieldKeys } = useFieldMapping()

const displayedFieldKeys = computed(() => getDisplayedFieldKeys(props.selectedRawItem))

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
      isReadOnly: isFieldReadOnly(key),
      fieldConfig,
      candidateTargetField,
      candidateTargetType: candidateTargetConfig?.type || null,
      candidateTargetLabel: candidateTargetField ? getFieldLabel(candidateTargetField) : '',
      editorBinding: getFieldEditorBinding(
        key,
        value,
        props.selectedRawItem,
        props.candidateAutosuggestPrefills,
      ),
    }
  }),
)

function onFieldDomEvent(row, event) {
  emit('field-change', row.key, row.editorBinding.readEventValue(event), row.editorBinding.resolvedType)
}

function resolveEditorComponent(componentId) {
  if (componentId === 'ViewerWikidataField') return ViewerWikidataField
  return componentId
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

const isSuspendEditingChecked = computed(() => {
  const selectedIndex = props.selectedViewItem?._index
  if (!Number.isInteger(selectedIndex)) return false
  return props.suspendedItemIndices.includes(selectedIndex)
})

function onSuspendEditingChange(event) {
  const uid = props.selectedViewItem?._uid
  if (!uid) return
  emit('toggle-suspend-editing', { uid, checked: event.target.checked })
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
    <div class="field-row suspend-editing-row">
      <label class="field-label suspend-editing-label" for="field-suspend-editing">
        <span>{{ props.suspendEditingLabel }}</span>
        <input
          :key="props.selectedViewItem?._uid || 'field-suspend-editing'"
          id="field-suspend-editing"
          type="checkbox"
          :checked="isSuspendEditingChecked"
          @change="onSuspendEditingChange"
        />
      </label>
    </div>
    <template v-for="row in fieldRows" :key="row.key">
      <div class="field-row" :class="{ 'is-readonly': row.isReadOnly }">
        <label :for="`field-${row.key}`" class="field-label">
          <span>{{ row.label }}</span>
          <small v-if="row.isReadOnly" class="field-readonly-badge">read-only</small>
        </label>
        <div v-if="isCandidateRow(row) && shouldRenderEditor(row)" class="candidate-editor-inline">
          <component
            :is="resolveEditorComponent(row.editorBinding.component)"
            v-bind="row.editorBinding.componentProps"
            @[row.editorBinding.eventName]="onFieldDomEvent(row, $event)"
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
        <component
          :is="resolveEditorComponent(row.editorBinding.component)"
          v-else-if="shouldRenderEditor(row)"
          v-bind="row.editorBinding.componentProps"
          @[row.editorBinding.eventName]="onFieldDomEvent(row, $event)"
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
  display: grid;
  gap: 0.75rem;
}

.field-row {
  display: grid;
  gap: 0.35rem;
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

.candidate-editor-inline :deep(input),
.candidate-editor-inline :deep(textarea) {
  flex: 1 1 auto;
  min-width: 0;
}

.suspend-editing-row {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--ve-color-border-soft);
}

.suspend-editing-label {
  justify-content: space-between;
}

.raw-data-row {
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
</style>
