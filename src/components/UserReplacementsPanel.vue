<script setup>
import { computed } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useUserConfigStore } from '../stores/useUserConfigStore'

const props = defineProps({
  hasData: { type: Boolean, required: true },
  forceOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['apply'])

const { t } = useAppConfigStore()
const {
  isUserConfigOpen,
  newFieldName,
  addFieldError,
  hasUnappliedUserConfigChanges,
  addUserConfigField,
} = useUserConfigStore()

const isPanelOpen = computed(() => props.forceOpen || isUserConfigOpen.value)

function onTogglePanel() {
  if (props.forceOpen) return
  isUserConfigOpen.value = !isUserConfigOpen.value
}

function onAddField() {
  addUserConfigField(t)
}
</script>

<template>
  <section class="user-replacements-panel" v-if="props.hasData">
    <div
      class="user-replacements-head"
      :class="{ 'is-static': props.forceOpen }"
      @click="onTogglePanel"
    >
      <div class="user-replacements-title">{{ t('replacementsTitle', 'Ersetzungen') }}</div>
      <div v-if="isPanelOpen" class="user-replacements-actions">
        <button type="button" :disabled="!hasUnappliedUserConfigChanges" @click.stop="emit('apply')">
          {{ t('applyConfiguration', 'Konfiguration anwenden') }}
        </button>
      </div>
      <span v-if="!props.forceOpen" class="user-replacements-toggle-icon" aria-hidden="true">
        <span class="toggle-icon">{{ isPanelOpen ? '▴' : '▾' }}</span>
      </span>
    </div>

    <div v-if="isPanelOpen" class="user-replacements-grid">
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

      <p v-if="addFieldError" class="user-replacements-error">{{ addFieldError }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.user-replacements-panel {
  grid-area: userconfig;
}

.user-replacements-head {
  display: flex;
  align-items: center;
  gap: var(--ve-space-3);
  margin-bottom: var(--ve-space-3);
  cursor: pointer;
}

.user-replacements-head.is-static {
  cursor: default;
}

.user-replacements-title {
  color: var(--ve-color-text-strong);
  font-weight: 700;
  font-size: 1.25rem;
  margin-right: auto;
}

.user-replacements-toggle-icon {
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

.user-replacements-actions {
  display: inline-flex;
  gap: var(--ve-space-2);
}

.user-replacements-grid {
  display: grid;
  gap: 0.4rem;
}

.user-replacements-add-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 1.6fr) auto;
  gap: var(--ve-space-2);
  align-items: center;
  margin-bottom: 0.35rem;
}

.user-replacements-error {
  margin: 0 0 var(--ve-space-1);
}

.user-replacements-row {
  display: grid;
  grid-template-columns: 34px minmax(180px, 1.2fr) minmax(170px, 1fr) minmax(170px, 1fr) minmax(220px, 1.3fr) auto;
  gap: var(--ve-space-2);
  align-items: center;
}

.remove-field-btn {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.user-replacements-row.is-dragging {
  opacity: 0.55;
}

.drag-handle {
  user-select: none;
  cursor: grab;
  text-align: center;
  color: var(--ve-color-text-soft);
  font-weight: 700;
}

.user-replacements-row-head {
  color: var(--ve-color-text-muted);
  font-size: 0.9rem;
}

.field-key {
  font-family: var(--ve-font-family-mono);
  font-size: 0.9rem;
  color: var(--ve-color-text-strong);
}

@media (max-width: 768px) {
  .user-replacements-row {
    grid-template-columns: 1fr;
  }

  .user-replacements-add-row {
    grid-template-columns: 1fr;
  }
}
</style>
