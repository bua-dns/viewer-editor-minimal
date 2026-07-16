<script setup>
import { computed } from 'vue'
import { useFieldMapping } from '../composables/useFieldMapping'
import ViewerWikidataField from './ViewerWikidataField.vue'

const props = defineProps({
  selectedRawItem: { type: Object, required: true },
  selectedViewItem: { type: Object, default: null },
  suspendedItemIndices: { type: Array, default: () => [] },
  suspendEditingLabel: { type: String, default: 'Suspend editing' },
  isEditableSimpleValue: { type: Function, required: true },
})

const emit = defineEmits(['field-change', 'toggle-suspend-editing'])

const { getFieldLabel, getFieldHint, isFieldReadOnly, getFieldEditorBinding, getDisplayedFieldKeys } = useFieldMapping()

const displayedFieldKeys = computed(() => getDisplayedFieldKeys(props.selectedRawItem))

const fieldRows = computed(() =>
  displayedFieldKeys.value.map((key) => {
    const value = props.selectedRawItem[key]
    return {
      key,
      value,
      label: getFieldLabel(key),
      hint: getFieldHint(key),
      isReadOnly: isFieldReadOnly(key),
      editorBinding: getFieldEditorBinding(key, value, props.selectedRawItem),
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
        <component
          :is="resolveEditorComponent(row.editorBinding.component)"
          v-if="shouldRenderEditor(row)"
          v-bind="row.editorBinding.componentProps"
          @[row.editorBinding.eventName]="onFieldDomEvent(row, $event)"
        />
        <pre v-else>{{ JSON.stringify(row.value) }}</pre>
        <p v-if="row.hint" class="field-hint">{{ row.hint }}</p>
      </div>
    </template>
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

.suspend-editing-row {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--ve-color-border-soft);
}

.suspend-editing-label {
  justify-content: space-between;
}
</style>
