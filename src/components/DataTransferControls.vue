<script setup>
import { computed, ref } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useDataTransferStore } from '../stores/useDataTransferStore'

const props = defineProps({
  hasData: { type: Boolean, required: true },
  isDirty: { type: Boolean, required: true },
  showSampleDataButton: { type: Boolean, default: true },
})

const emit = defineEmits(['file-selected', 'download', 'reset', 'mode-changed', 'load-sample-data'])

const fileInput = ref(null)
const { t } = useAppConfigStore()
const { appendEditedTimestamp, dataMode, uploadAccept, setDataMode } = useDataTransferStore()

const uploadButtonLabel = computed(() =>
  dataMode.value === 'csv' ? t('uploadCsv', 'CSV hochladen') : t('uploadJson', 'JSON hochladen'),
)

const downloadButtonLabel = computed(() =>
  dataMode.value === 'csv' ? t('downloadCsv', 'CSV herunterladen') : t('downloadJson', 'JSON herunterladen'),
)

function triggerUpload() {
  fileInput.value?.click()
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  if (file) emit('file-selected', file)
  event.target.value = ''
}

function onModeChange(nextMode) {
  const changed = setDataMode(nextMode)
  if (changed) emit('mode-changed', nextMode)
}
</script>

<template>
  <label class="download-option">
    <input v-model="appendEditedTimestamp" type="checkbox" />
    <span>{{ t('downloadWithTimestamp', 'Dateiname mit Timestamp') }}</span>
  </label>

  <div class="data-mode-switch" :aria-label="t('dataModeAria', 'Datenmodus waehlen')">
    <button type="button" class="mode-btn" :class="{ active: dataMode === 'json' }" @click="onModeChange('json')">
      {{ t('dataModeJson', 'JSON') }}
    </button>
    <button type="button" class="mode-btn" :class="{ active: dataMode === 'csv' }" @click="onModeChange('csv')">
      {{ t('dataModeCsv', 'CSV') }}
    </button>
  </div>

  <button v-if="props.showSampleDataButton" type="button" class="transfer-btn transfer-btn-mode" @click="emit('load-sample-data')">
    {{ t('useSampleData', 'Mit Beispieldaten arbeiten') }}
  </button>
  <button type="button" class="transfer-btn transfer-btn-mode" @click="triggerUpload">{{ uploadButtonLabel }}</button>
  <button type="button" class="transfer-btn transfer-btn-mode" :disabled="!props.hasData || !props.isDirty" @click="emit('download')">
    {{ downloadButtonLabel }}
  </button>
  <button type="button" class="transfer-btn transfer-btn-reset" :disabled="!props.isDirty" @click="emit('reset')">
    {{ t('reset', 'Reset') }}
  </button>

  <input ref="fileInput" type="file" :accept="uploadAccept" @change="onFileChange" />
</template>

<style scoped lang="scss">
.download-option {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--ve-color-text-muted);
  font-size: 0.95rem;
}

.data-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.35rem;
  border: 1px solid color-mix(in srgb, var(--color-secondary) 35%, #cbd5e1);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-secondary) 8%, #f8fafc);
}

.mode-btn {
  background: color-mix(in srgb, var(--color-secondary) 14%, #e2e8f0);
  color: color-mix(in srgb, var(--color-secondary) 78%, #0f172a);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 600;
}

.mode-btn.active {
  background: var(--color-secondary);
  color: var(--ve-color-white);
  border-color: var(--color-secondary);
  box-shadow: 0 0 0 2px var(--ve-color-white);
}

.transfer-btn {
  white-space: nowrap;
}

.transfer-btn-mode {
  width: 11.5rem;
}

.transfer-btn-reset {
  min-width: 4.8rem;
}

.download-option input[type='checkbox'] {
  width: auto;
  accent-color: var(--color-primary);
}
</style>
