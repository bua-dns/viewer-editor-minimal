<script setup>
import { computed } from 'vue'
import { useFieldMapping } from '../composables/useFieldMapping'

const props = defineProps({
  selectedRawItem: { type: Object, required: true },
  isEditableSimpleValue: { type: Function, required: true },
})

const emit = defineEmits(['field-input', 'boolean-change'])

const { getFieldLabel, getFieldInputType, getFieldPlaceholder, getDisplayedFieldKeys } = useFieldMapping()

const displayedFieldKeys = computed(() => getDisplayedFieldKeys(props.selectedRawItem))

function onInput(key, event) {
  emit('field-input', key, event.target.value)
}

function onBooleanInput(key, event) {
  emit('boolean-change', key, event.target.checked)
}
</script>

<template>
  <div class="field-grid">
    <template v-for="key in displayedFieldKeys" :key="key">
      <div class="field-row">
        <label :for="`field-${key}`">{{ getFieldLabel(key) }}</label>
        <template v-if="props.isEditableSimpleValue(props.selectedRawItem[key])">
          <textarea
            v-if="getFieldInputType(key, props.selectedRawItem[key]) === 'textarea'"
            :id="`field-${key}`"
            :placeholder="getFieldPlaceholder(key)"
            :value="props.selectedRawItem[key] === null ? '' : props.selectedRawItem[key]"
            @input="onInput(key, $event)"
          />
          <input
            v-else-if="getFieldInputType(key, props.selectedRawItem[key]) !== 'checkbox'"
            :id="`field-${key}`"
            :type="getFieldInputType(key, props.selectedRawItem[key])"
            :placeholder="getFieldPlaceholder(key)"
            :value="props.selectedRawItem[key] === null ? '' : props.selectedRawItem[key]"
            @input="onInput(key, $event)"
          />
          <input
            v-else
            :id="`field-${key}`"
            type="checkbox"
            :checked="Boolean(props.selectedRawItem[key])"
            @change="onBooleanInput(key, $event)"
          />
        </template>
        <pre v-else>{{ JSON.stringify(props.selectedRawItem[key]) }}</pre>
      </div>
    </template>
  </div>
</template>
