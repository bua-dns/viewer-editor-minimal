<script setup>
import { ref, watch } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'

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

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return
    inputMode.value = 'single'
    singleUrl.value = ''
    csvText.value = ''
    csvFileName.value = ''
    csvFileError.value = ''
  },
)

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
</script>

<template>
  <div v-if="isOpen" class="scratch-modal-backdrop" @click.self="onClose">
    <div class="scratch-modal" role="dialog" aria-modal="true" :aria-label="t('startFromScratchDialogTitle', 'Neu beginnen')">
      <h2>{{ t('startFromScratchDialogTitle', 'Neu beginnen') }}</h2>

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
  background: rgba(15, 23, 42, 0.52);
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
  color: var(--ve-color-danger, #b91c1c);
  font-weight: 600;
}

.scratch-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ve-space-2);
}
</style>
