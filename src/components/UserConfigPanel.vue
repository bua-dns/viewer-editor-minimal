<script setup>
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useUserConfigStore } from '../stores/useUserConfigStore'

const props = defineProps({
  hasData: { type: Boolean, required: true },
})

const emit = defineEmits(['apply', 'download'])

const { t } = useAppConfigStore()
const {
  sortedConfigFieldEntries,
  hasUnappliedUserConfigChanges,
  draggedFieldKey,
  isUserConfigOpen,
  newFieldName,
  addFieldError,
  addUserConfigField,
  removeUserConfigField,
  startDrag,
  dropAt,
  endDrag,
} = useUserConfigStore()

function onTogglePanel() {
  isUserConfigOpen.value = !isUserConfigOpen.value
}

function onAddField() {
  addUserConfigField(t)
}
</script>

<template>
  <section class="user-config-panel" v-if="props.hasData">
    <div class="user-config-head" @click="onTogglePanel">
      <div class="user-config-title">{{ t('configurationTitle', 'Konfiguration') }}</div>
      <div v-if="isUserConfigOpen" class="user-config-actions">
        <button type="button" :disabled="!hasUnappliedUserConfigChanges" @click.stop="emit('apply')">
          {{ t('applyConfiguration', 'Konfiguration anwenden') }}
        </button>
        <button type="button" :disabled="!hasUnappliedUserConfigChanges" @click.stop="emit('download')">
          {{ t('downloadConfiguration', 'Konfiguration herunterladen') }}
        </button>
      </div>
      <span class="user-config-toggle-icon" aria-hidden="true">
        <span class="toggle-icon">{{ isUserConfigOpen ? '▴' : '▾' }}</span>
      </span>
    </div>

    <div v-if="isUserConfigOpen" class="user-config-grid">
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
      <p v-if="addFieldError" class="error user-config-error">{{ addFieldError }}</p>

      <div class="user-config-row user-config-row-head">
        <strong></strong>
        <strong>{{ t('configFieldHeader', 'Feld') }}</strong>
        <strong>{{ t('configTypeHeader', 'Typ') }}</strong>
        <strong>{{ t('configLabelHeader', 'Beschriftung') }}</strong>
        <strong>{{ t('configPlaceholderHeader', 'Eingabehinweis') }}</strong>
        <strong></strong>
      </div>

      <div
        v-for="entry in sortedConfigFieldEntries"
        :key="entry[0]"
        class="user-config-row"
        :class="{ 'is-dragging': draggedFieldKey === entry[0] }"
        draggable="true"
        @dragstart="startDrag(entry[0])"
        @dragover.prevent
        @drop="dropAt(entry[0])"
        @dragend="endDrag"
      >
        <div class="drag-handle" aria-hidden="true">⋮⋮</div>
        <div class="field-key">{{ entry[0] }}</div>
        <select v-model="entry[1].type">
          <option value="normal">{{ t('configTypeNormal', 'normal (string)') }}</option>
          <option value="text">{{ t('configTypeText', 'Textfeld (text)') }}</option>
          <option value="integer">{{ t('configTypeInteger', 'Zahl (integer)') }}</option>
          <option value="checkbox">{{ t('configTypeCheckbox', 'Ja/Nein (checkbox)') }}</option>
        </select>
        <input v-model="entry[1].label" type="text" :placeholder="t('configLabelInputPlaceholder', 'Label')" />
        <input v-model="entry[1].placeholder" type="text" :placeholder="t('configHintInputPlaceholder', 'Hinweis')" />
        <button type="button" class="remove-field-btn" @click.stop="removeUserConfigField(entry[0])">
          {{ t('removeFieldButton', 'Feld entfernen') }}
        </button>
      </div>
    </div>
  </section>
</template>
