<script setup>
import { computed } from 'vue'
import { useFieldMapping } from '../composables/useFieldMapping'

const props = defineProps({
  selectedRawItem: { type: Object, required: true },
  isEditableSimpleValue: { type: Function, required: true },
})

const emit = defineEmits(['field-change'])

const { getFieldLabel, getFieldEditorBinding, getDisplayedFieldKeys } = useFieldMapping()

const displayedFieldKeys = computed(() => getDisplayedFieldKeys(props.selectedRawItem))

const fieldRows = computed(() =>
  displayedFieldKeys.value.map((key) => {
    const value = props.selectedRawItem[key]
    return {
      key,
      value,
      label: getFieldLabel(key),
      editorBinding: getFieldEditorBinding(key, value),
    }
  }),
)

function onFieldDomEvent(row, event) {
  emit('field-change', row.key, row.editorBinding.readEventValue(event))
}
</script>

<template>
  <div class="field-grid">
    <template v-for="row in fieldRows" :key="row.key">
      <div class="field-row">
        <label :for="`field-${row.key}`">{{ row.label }}</label>
        <component
          :is="row.editorBinding.component"
          v-if="props.isEditableSimpleValue(row.value)"
          v-bind="row.editorBinding.componentProps"
          @[row.editorBinding.eventName]="onFieldDomEvent(row, $event)"
        />
        <pre v-else>{{ JSON.stringify(row.value) }}</pre>
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
</style>
