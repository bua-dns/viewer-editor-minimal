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
  isEditableSimpleValue,
  looksLikeImageUrl,
} = useViewerData()

const isLightboxOpen = ref(false)
const lightboxImageSrc = ref('')
const lightboxImageLoadFailed = ref(false)
const sidebarImageLoadFailed = ref(false)
const failedListImages = ref(new Set())

const resultCountLabel = computed(() => {
  if (!hasData.value) return '0 / 0'
  return `${filteredViewItems.value.length} / ${rawItems.value.length}`
})

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
  const baseName = importFileName.value ? importFileName.value.replace(/\.json$/i, '') : 'data'
  link.href = url
  link.download = `${baseName}-edited.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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

      <section class="list-panel">
        <h2>Items</h2>
        <p v-if="!hasData" class="meta">Nach dem Upload erscheinen hier die Eintraege.</p>
        <p v-else-if="filteredViewItems.length === 0" class="meta">Keine Treffer zur Suchanfrage.</p>
        <ul v-else class="card-grid">
          <li v-for="item in filteredViewItems" :key="item._uid" @click="selectItem(item._uid)">
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

      <aside class="sidebar-panel">
        <p v-if="!selectedRawItem" class="meta">Kein Item ausgewaehlt.</p>
        <div v-else class="sidebar-detail-grid">
          <div class="scan-column">
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
            <div v-for="(value, key) in selectedRawItem" :key="key" class="field-row">
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
