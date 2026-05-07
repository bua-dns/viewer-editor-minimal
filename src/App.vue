<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useViewerData } from './composables/useViewerData'

const fileInput = ref(null)
const {
  rawItems,
  searchQuery,
  selectedRawItem,
  filteredViewItems,
  selectedViewItem,
  isDirty,
  importFileName,
  errorMessage,
  hasData,
  importFromJsonText,
  selectItem,
  updateField,
  resetToImportedSnapshot,
  createExportPayload,
  markAsSaved,
  isEditableSimpleValue,
  looksLikeImageUrl,
} = useViewerData()

const isLightboxOpen = ref(false)
const lightboxImageSrc = ref('')
const lightboxImageLoadFailed = ref(false)
const sidebarImageLoadFailed = ref(false)
const failedListImages = ref(new Set())
const appendEditedTimestamp = ref(true)

const resultCountLabel = computed(() => {
  if (!hasData.value) return '0 / 0'
  return `${filteredViewItems.value.length} / ${rawItems.value.length}`
})

const selectedFilteredIndex = computed(() => {
  if (!selectedViewItem.value) return -1
  return filteredViewItems.value.findIndex((item) => item._uid === selectedViewItem.value._uid)
})

const canGoPrevious = computed(() => selectedFilteredIndex.value > 0)
const canGoNext = computed(
  () =>
    selectedFilteredIndex.value !== -1 &&
    selectedFilteredIndex.value < filteredViewItems.value.length - 1,
)

async function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const text = await file.text()
  importFromJsonText(text, file.name)
  event.target.value = ''
}

function triggerUpload() {
  fileInput.value?.click()
}

function onFieldInput(key, event) {
  updateField(key, event.target.value)
}

function onBooleanChange(key, event) {
  updateField(key, event.target.checked)
}

function clearSelection() {
  selectItem(null)
}

function onReset() {
  if (!isDirty.value) return
  const confirmed = globalThis.confirm('Aenderungen verwerfen und auf Import zuruecksetzen?')
  if (!confirmed) return
  resetToImportedSnapshot()
}

function onDownload() {
  const payload = createExportPayload()
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const importedBaseName = importFileName.value ? importFileName.value.replace(/\.json$/i, '') : 'data'
  const baseName = importedBaseName.replace(/-edited(?:-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})?$/i, '')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  link.href = url
  link.download = appendEditedTimestamp.value
    ? `${baseName}-edited-${timestamp}.json`
    : `${baseName}-edited.json`
  const downloadFileName = link.download
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  if (appendEditedTimestamp.value) {
    markAsSaved(downloadFileName)
  }
}

function openLightbox(url) {
  if (!url) return
  lightboxImageSrc.value = url
  lightboxImageLoadFailed.value = false
  isLightboxOpen.value = true
}

function listImageFailed(uid) {
  failedListImages.value.add(uid)
}

function hasListImageFailed(uid) {
  return failedListImages.value.has(uid)
}

function selectPreviousItem() {
  if (!canGoPrevious.value) return
  const previousItem = filteredViewItems.value[selectedFilteredIndex.value - 1]
  if (previousItem) selectItem(previousItem._uid)
}

function selectNextItem() {
  if (!canGoNext.value) return
  const nextItem = filteredViewItems.value[selectedFilteredIndex.value + 1]
  if (nextItem) selectItem(nextItem._uid)
}

function closeLightbox() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  }
  isLightboxOpen.value = false
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  const target = document.querySelector('.lightbox-content')
  if (target?.requestFullscreen) {
    await target.requestFullscreen()
  }
}

function beforeUnloadListener(event) {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

function keydownListener(event) {
  if (event.key === 'Escape' && isLightboxOpen.value) {
    closeLightbox()
    return
  }

  if (event.key === 'Escape' && selectedRawItem.value) {
    clearSelection()
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnloadListener)
  window.addEventListener('keydown', keydownListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadListener)
  window.removeEventListener('keydown', keydownListener)
})

watch(
  () => importFileName.value,
  () => {
    failedListImages.value = new Set()
    sidebarImageLoadFailed.value = false
    lightboxImageLoadFailed.value = false
  },
)

watch(
  () => selectedRawItem.value?.scan,
  () => {
    sidebarImageLoadFailed.value = false
  },
)
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <h1>Viewer Editor Minimal</h1>
      <div class="actions">
        <label class="download-option">
          <input v-model="appendEditedTimestamp" type="checkbox" />
          <span>Dateiname mit Timestamp</span>
        </label>
        <button type="button" @click="triggerUpload">JSON hochladen</button>
        <button type="button" :disabled="!hasData || !isDirty" @click="onDownload">JSON herunterladen</button>
        <button type="button" :disabled="!isDirty" @click="onReset">Reset</button>
        <input ref="fileInput" type="file" accept="application/json" @change="onFileChange" />
      </div>
    </header>

    <main class="content-grid" :class="{ 'content-grid-selected': !!selectedRawItem }">
      <section class="toolbar-panel">
        <div>
          <p class="meta" v-if="importFileName">Datei: {{ importFileName }}</p>
          <p class="meta" v-else>Noch keine Datei geladen</p>
        </div>
        <label class="search-wrap">
          <span>Suche</span>
          <input v-model="searchQuery" type="search" placeholder="Volltext ueber alle Felder" />
        </label>
        <p class="meta">Treffer: {{ resultCountLabel }}</p>
        <p v-if="isDirty" class="dirty">Ungespeicherte Aenderungen</p>
      </section>

      <section class="list-panel" @click="clearSelection">
        <h2>Items</h2>
        <p v-if="!hasData" class="meta">Nach dem Upload erscheinen hier die Eintraege.</p>
        <p v-else-if="filteredViewItems.length === 0" class="meta">Keine Treffer zur Suchanfrage.</p>
        <ul v-else class="card-grid">
          <li v-for="item in filteredViewItems" :key="item._uid">
            <button
              type="button"
              class="item-card"
              :class="{ active: selectedViewItem && selectedViewItem._uid === item._uid }"
              @click.stop="selectItem(item._uid)"
            >
              <div class="card-media">
                <img
                  v-if="looksLikeImageUrl(rawItems[item._index]?.scan) && !hasListImageFailed(item._uid)"
                  :src="rawItems[item._index]?.scan"
                  alt="Scan Vorschau"
                  @error="listImageFailed(item._uid)"
                />
                <div v-else class="scan-fallback">Scan nicht verfuegbar</div>
              </div>
              <div class="card-caption">
                {{ rawItems[item._index]?.inventory_number || `#${item._index + 1}` }}
              </div>
            </button>
          </li>
        </ul>
      </section>

      <aside v-if="selectedRawItem" class="sidebar-panel">
        <div class="sidebar-head">
          <button type="button" class="sidebar-close" @click="clearSelection" aria-label="Sidebar schliessen">
            ×
          </button>
        </div>
        <div class="sidebar-detail-grid">
          <div class="scan-column">
            <div class="scan-nav" v-if="filteredViewItems.length > 1">
              <button type="button" :disabled="!canGoPrevious" @click="selectPreviousItem">←</button>
              <span class="scan-nav-index">{{ selectedFilteredIndex + 1 }} / {{ filteredViewItems.length }}</span>
              <button type="button" :disabled="!canGoNext" @click="selectNextItem">→</button>
            </div>
            <div class="scan-preview-wrap" v-if="looksLikeImageUrl(selectedRawItem.scan)">
              <img
                v-if="!sidebarImageLoadFailed"
                :src="selectedRawItem.scan"
                alt="Scan Vorschau"
                class="scan-preview"
                @error="sidebarImageLoadFailed = true"
                @click="openLightbox(selectedRawItem.scan)"
              />
              <div v-else class="scan-fallback">Scan nicht verfuegbar</div>
            </div>
            <div v-else class="scan-fallback">Scan nicht verfuegbar</div>
          </div>

          <div class="field-grid">
            <template v-for="(value, key) in selectedRawItem" :key="key">
              <div v-if="key !== 'scan'" class="field-row">
                <label :for="`field-${key}`">{{ key }}</label>
                <template v-if="isEditableSimpleValue(value)">
                  <input
                    v-if="typeof value === 'string' || value === null || typeof value === 'number'"
                    :id="`field-${key}`"
                    :type="typeof value === 'number' ? 'number' : 'text'"
                    :value="value === null ? '' : value"
                    @input="onFieldInput(key, $event)"
                  />
                  <input
                    v-else-if="typeof value === 'boolean'"
                    :id="`field-${key}`"
                    type="checkbox"
                    :checked="value"
                    @change="onBooleanChange(key, $event)"
                  />
                </template>
                <pre v-else>{{ JSON.stringify(value) }}</pre>
              </div>
            </template>
          </div>
        </div>
      </aside>

      <section class="status-panel">
        <p v-if="importFileName">Datei: {{ importFileName }}</p>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        <p v-else-if="!hasData">Bitte eine gueltige JSON-Datei hochladen.</p>
      </section>
    </main>

    <div v-if="isLightboxOpen" class="lightbox" @click.self="closeLightbox">
      <div class="lightbox-content">
        <div class="lightbox-actions">
          <button type="button" @click="toggleFullscreen">Fullscreen</button>
          <button type="button" @click="closeLightbox">Schliessen</button>
        </div>
        <img
          v-if="!lightboxImageLoadFailed"
          :src="lightboxImageSrc"
          alt="Scan gross"
          class="lightbox-image"
          @error="lightboxImageLoadFailed = true"
        />
        <div v-else class="scan-fallback scan-fallback-large">Scan nicht verfuegbar</div>
      </div>
    </div>
  </div>
</template>
