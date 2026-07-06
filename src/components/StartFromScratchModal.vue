<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useModalKeyboard } from '../composables/useModalKeyboard'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

const dialogTitleId = 'start-from-scratch-dialog-title'
const dialogDescriptionId = 'start-from-scratch-dialog-description'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  errorMessage: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'submit'])

const { t } = useAppConfigStore()

const inputMode = ref('single')
const singleUrl = ref('')
const csvText = ref('')
const csvFileInput = ref(null)
const csvFileName = ref('')
const csvFileError = ref('')
const modalRef = ref(null)
const previouslyFocusedElement = ref(null)

function getFocusableElements() {
  if (!modalRef.value) return []
  return Array.from(modalRef.value.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
    return element instanceof HTMLElement && element.getClientRects().length > 0
  })
}

function focusFirstElementInModal() {
  const focusableElements = getFocusableElements()
  const firstFocusableElement = focusableElements[0]
  if (firstFocusableElement) {
    firstFocusableElement.focus()
    return
  }

  modalRef.value?.focus()
}

function restorePreviousFocus() {
  if (previouslyFocusedElement.value instanceof HTMLElement && previouslyFocusedElement.value.isConnected) {
    previouslyFocusedElement.value.focus()
  }
  previouslyFocusedElement.value = null
}

function trapFocus(event) {
  if (event.key !== 'Tab' || !modalRef.value) return

  const focusableElements = getFocusableElements()
  if (!focusableElements.length) {
    event.preventDefault()
    modalRef.value.focus()
    return
  }

  const firstFocusableElement = focusableElements[0]
  const lastFocusableElement = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement

  if (event.shiftKey) {
    if (activeElement === firstFocusableElement || activeElement === modalRef.value) {
      event.preventDefault()
      lastFocusableElement.focus()
    }
    return
  }

  if (activeElement === lastFocusableElement) {
    event.preventDefault()
    firstFocusableElement.focus()
  }
}

watch(
  () => props.isOpen,
  async (isOpen, wasOpen) => {
    if (isOpen) {
      if (document.activeElement instanceof HTMLElement) {
        previouslyFocusedElement.value = document.activeElement
      }

      inputMode.value = 'single'
      singleUrl.value = ''
      csvText.value = ''
      csvFileName.value = ''
      csvFileError.value = ''

      await nextTick()
      focusFirstElementInModal()
      return
    }

    if (wasOpen) {
      await nextTick()
      restorePreviousFocus()
    }
  },
)

onBeforeUnmount(() => {
  restorePreviousFocus()
})

function onClose() {
  emit('close')
}

function onSubmit() {
  emit('submit', {
    mode: inputMode.value,
    singleUrl: singleUrl.value,
    csvText: csvText.value,
  })
}

function triggerCsvUpload() {
  csvFileInput.value?.click()
}

async function onCsvFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  try {
    csvText.value = await file.text()
    csvFileName.value = file.name
    csvFileError.value = ''
  } catch {
    csvFileError.value = t('startFromScratchCsvFileReadError', 'CSV-Datei konnte nicht gelesen werden.')
  }
}

useModalKeyboard({
  isOpen: () => props.isOpen,
  onClose,
})
</script>

<template>
  <div v-if="isOpen" class="scratch-modal-backdrop" @click.self="onClose">
    <div
      ref="modalRef"
      class="scratch-modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="dialogTitleId"
      :aria-describedby="dialogDescriptionId"
      tabindex="-1"
      @keydown="trapFocus"
    >
      <h2 :id="dialogTitleId">{{ t('startFromScratchDialogTitle', 'Neu beginnen') }}</h2>
      <p :id="dialogDescriptionId" class="scratch-sr-only">
        {{ t('startFromScratchDialogDescription', 'Dialog zum Erstellen einer neuen Vorlage per Einzel-URL oder CSV-Liste.') }}
      </p>

      <div class="scratch-mode-switch" :aria-label="t('startFromScratchDialogTitle', 'Neu beginnen')">
        <label>
          <input v-model="inputMode" type="radio" value="single" />
          <span>{{ t('startFromScratchSingleMode', 'Einzelne URL') }}</span>
        </label>
        <label>
          <input v-model="inputMode" type="radio" value="csv" />
          <span>{{ t('startFromScratchCsvMode', 'URL-Liste (CSV)') }}</span>
        </label>
      </div>

      <div v-if="inputMode === 'single'" class="scratch-input-block">
        <label for="start-from-scratch-url">{{ t('startFromScratchSingleLabel', 'Scan-URL') }}</label>
        <input
          id="start-from-scratch-url"
          v-model="singleUrl"
          type="url"
          placeholder="https://example.org/scan.jpg"
        />
      </div>

      <div v-else class="scratch-input-block">
        <label for="start-from-scratch-csv">{{ t('startFromScratchCsvLabel', 'CSV-Inhalt') }}</label>
        <div class="scratch-csv-upload-row">
          <button type="button" class="transfer-btn transfer-btn-mode" @click="triggerCsvUpload">
            {{ t('startFromScratchCsvUploadFile', 'CSV-Datei hochladen') }}
          </button>
          <span v-if="csvFileName" class="scratch-csv-file-name">{{ csvFileName }}</span>
        </div>
        <input
          ref="csvFileInput"
          type="file"
          accept=".csv,text/csv"
          class="scratch-hidden-file-input"
          @change="onCsvFileChange"
        />
        <textarea
          id="start-from-scratch-csv"
          v-model="csvText"
          rows="8"
          :placeholder="t('startFromScratchCsvPlaceholder', 'scan\nhttps://example.org/1.jpg\nhttps://example.org/2.jpg')"
        />
        <p class="scratch-hint">{{ t('startFromScratchCsvHint', "CSV mit Spalte 'scan' oder nur einer URL pro Zeile.") }}</p>
        <p v-if="csvFileError" class="scratch-error">{{ csvFileError }}</p>
      </div>

      <p v-if="errorMessage" class="scratch-error">{{ errorMessage }}</p>

      <div class="scratch-actions">
        <button type="button" class="transfer-btn transfer-btn-reset" @click="onClose">
          {{ t('cancel', 'Abbrechen') }}
        </button>
        <button type="button" class="transfer-btn transfer-btn-mode" @click="onSubmit">
          {{ t('startFromScratchCreate', 'Erstellen und herunterladen') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.scratch-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--ve-color-backdrop);
  display: grid;
  place-items: center;
  padding: var(--ve-space-4);
}

.scratch-modal {
  width: min(92vw, 620px);
  background: var(--ve-color-white);
  border: 1px solid var(--ve-color-border-default);
  border-radius: 12px;
  padding: var(--ve-space-4);
  display: grid;
  gap: var(--ve-space-3);
}

.scratch-modal h2 {
  margin: 0;
  font-size: 1.2rem;
}

.scratch-mode-switch {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ve-space-3);
}

.scratch-mode-switch label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.scratch-input-block {
  display: grid;
  gap: 0.4rem;
}

.scratch-csv-upload-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.scratch-csv-file-name {
  color: var(--ve-color-text-muted);
  font-size: 0.9rem;
}

.scratch-hidden-file-input {
  display: none;
}

.scratch-input-block input,
.scratch-input-block textarea {
  width: 100%;
}

.scratch-hint {
  margin: 0;
  color: var(--ve-color-text-muted);
  font-size: 0.9rem;
}

.scratch-error {
  margin: 0;
  color: var(--ve-color-danger);
  font-weight: 600;
}

.scratch-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ve-space-2);
}

.scratch-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
