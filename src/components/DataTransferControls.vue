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
