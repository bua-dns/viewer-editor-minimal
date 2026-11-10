<script setup>
// Confirmation for "Derive item": shows the target collection and the values of the new item,
// says when pending changes will be saved first, then reports the created item or the error.
import { computed } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useModalKeyboard } from '../composables/useModalKeyboard'
import { useModalFocus } from '../composables/useModalFocus'

const props = defineProps({
  // State from useItemDerivation: { isOpen, phase, targetPath, preview, willSaveFirst, created, error }
  dialog: { type: Object, required: true },
  title: { type: String, required: true },
})

const emit = defineEmits(['confirm', 'close'])
const { t } = useAppConfigStore()

const isOpen = computed(() => props.dialog.isOpen)
const isRunning = computed(() => props.dialog.phase === 'running')
const canConfirm = computed(() => props.dialog.phase === 'preview')
const showsPreview = computed(() => ['preview', 'running'].includes(props.dialog.phase))

function formatValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function onClose() {
  if (!isRunning.value) emit('close')
}

const { modalRef, trapFocus } = useModalFocus({ isOpen: () => isOpen.value })
useModalKeyboard({ isOpen: () => isOpen.value, onClose })
</script>

<template>
  <div v-if="dialog.isOpen" class="derive-modal-backdrop" @click.self="onClose">
    <div
      ref="modalRef"
      class="derive-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="derive-item-dialog-title"
      tabindex="-1"
      @keydown="trapFocus"
    >
      <h2 id="derive-item-dialog-title">{{ title }}</h2>
      <p class="derive-target">
        {{ t('deriveTargetLabel', 'Target collection') }}: <code>{{ dialog.targetPath }}</code>
      </p>

      <p v-if="dialog.phase === 'loading'" class="derive-hint">
        {{ t('deriveLoading', 'Reading the source item…') }}
      </p>

      <template v-if="showsPreview">
        <table v-if="dialog.preview.length" class="derive-preview">
          <thead>
            <tr>
              <th scope="col">{{ t('deriveFieldColumn', 'Field') }}</th>
              <th scope="col">{{ t('deriveValueColumn', 'Value') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in dialog.preview" :key="row.field">
              <td><code>{{ row.field }}</code></td>
              <td>{{ formatValue(row.value) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="derive-hint">
          {{ t('deriveNoValues', 'No mapped field has a value; the new item gets only the link to this item.') }}
        </p>
        <p v-if="dialog.willSaveFirst" class="derive-notice">
          {{ t('deriveSavesFirst', 'There are unsaved changes. They will be saved first, then the new item is created from the saved state.') }}
        </p>
      </template>

      <p v-if="dialog.phase === 'done'" class="derive-success" role="status">
        {{ t('deriveCreated', 'Item created') }}:
        <strong v-if="dialog.created?.label">{{ dialog.created.label }}</strong>
        <span v-if="dialog.created?.id"> (ID <code>{{ dialog.created.id }}</code>)</span>
      </p>
      <p v-if="dialog.phase === 'error'" class="derive-error" role="alert">{{ dialog.error }}</p>

      <div class="derive-actions">
        <button type="button" class="transfer-btn transfer-btn-reset" :disabled="isRunning" @click="onClose">
          {{ canConfirm || isRunning ? t('cancel', 'Cancel') : t('close', 'Close') }}
        </button>
        <button v-if="canConfirm || isRunning" type="button" class="transfer-btn transfer-btn-mode" :disabled="!canConfirm"
          @click="emit('confirm')">
          {{ isRunning ? t('deriveRunning', 'Creating…') : t('deriveConfirm', 'Create item') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.derive-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--ve-color-backdrop);
  display: grid;
  place-items: center;
  padding: var(--ve-space-4);
}

.derive-modal {
  width: min(92vw, 620px);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--ve-color-white);
  border: 1px solid var(--ve-color-border-default);
  border-radius: 12px;
  padding: var(--ve-space-4);
  display: grid;
  gap: var(--ve-space-3);
}

.derive-modal h2 {
  margin: 0;
  font-size: 1.2rem;
}

.derive-target,
.derive-hint,
.derive-notice,
.derive-success,
.derive-error {
  margin: 0;
}

.derive-hint {
  color: var(--ve-color-text-muted);
}

.derive-notice {
  font-weight: 600;
}

.derive-error {
  color: var(--ve-color-danger);
  font-weight: 600;
}

.derive-preview {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--ve-color-border-default);
    overflow-wrap: anywhere;
  }
}

.derive-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ve-space-2);
}
</style>
