<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  config: { type: Object, default: null },
  placeholder: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const query = ref('')
const suggestions = ref([])
const isLoading = ref(false)
const requestError = ref('')

let debounceTimer = null
let activeAbortController = null

const minChars = computed(() => {
  const value = Number(props.config?.minChars)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 2
})

const resultLimit = computed(() => {
  const value = Number(props.config?.limit)
  if (!Number.isFinite(value) || value <= 0) return 8
  return Math.min(Math.floor(value), 20)
})

const searchLanguages = computed(() => {
  const fromConfig = props.config?.searchLanguages
  if (Array.isArray(fromConfig)) {
    const normalized = fromConfig
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
    if (normalized.length) return normalized
  }

  const fallbackLanguage = String(props.config?.resultLanguage || 'en').trim().toLowerCase()
  return fallbackLanguage ? [fallbackLanguage] : ['en']
})

const resultLanguage = computed(() => {
  const configured = String(props.config?.resultLanguage || '').trim().toLowerCase()
  return configured || searchLanguages.value[0] || 'en'
})

const parsedManualEntity = computed(() => {
  const normalized = query.value.trim()
  if (!normalized) return null

  const match = normalized.match(/^(Q\d+)\s+(.+)$/i)
  if (!match) return null

  const [, id, label] = match
  const cleanedLabel = label.trim()
  if (!cleanedLabel) return null

  return {
    id: id.toUpperCase(),
    label: cleanedLabel,
  }
})

function selectEntity(entity) {
  emit('select', entity)
  query.value = ''
  suggestions.value = []
  requestError.value = ''
}

function normalizeWikidataSearchResult(entry) {
  const id = typeof entry?.id === 'string' ? entry.id.trim() : ''
  if (!id) return null

  const label = typeof entry?.label === 'string' && entry.label.trim() ? entry.label : id
  const result = {
    id,
    label,
  }

  if (typeof entry?.description === 'string' && entry.description.trim()) {
    result.description = entry.description
  }

  return result
}

function dedupeById(entries) {
  const seen = new Set()
  return entries.filter((entry) => {
    if (!entry?.id || seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })
}

async function fetchSearchResults(searchText) {
  if (activeAbortController) {
    activeAbortController.abort()
  }

  const abortController = new AbortController()
  activeAbortController = abortController

  isLoading.value = true
  requestError.value = ''

  try {
    const requests = searchLanguages.value.map(async (language) => {
      const queryParams = new URLSearchParams({
        action: 'wbsearchentities',
        format: 'json',
        type: 'item',
        search: searchText,
        language,
        uselang: resultLanguage.value,
        limit: String(resultLimit.value),
        origin: '*',
      })

      const response = await fetch(`https://www.wikidata.org/w/api.php?${queryParams.toString()}`, {
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = await response.json()
      return Array.isArray(payload?.search) ? payload.search : []
    })

    const responses = await Promise.all(requests)
    const merged = dedupeById(
      responses
        .flat()
        .map((entry) => normalizeWikidataSearchResult(entry))
        .filter(Boolean),
    )

    suggestions.value = merged.slice(0, resultLimit.value)
  } catch (error) {
    if (error?.name === 'AbortError') return
    suggestions.value = []
    requestError.value = 'Could not fetch Wikidata results.'
  } finally {
    if (activeAbortController === abortController) {
      isLoading.value = false
      activeAbortController = null
    }
  }
}

watch(
  () => query.value,
  (nextValue) => {
    const normalized = nextValue.trim()
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    if (normalized.length < minChars.value) {
      suggestions.value = []
      requestError.value = ''
      isLoading.value = false
      if (activeAbortController) {
        activeAbortController.abort()
        activeAbortController = null
      }
      return
    }

    debounceTimer = setTimeout(() => {
      fetchSearchResults(normalized)
    }, 250)
  },
)

function onEnterKey() {
  if (suggestions.value.length) {
    selectEntity(suggestions.value[0])
    return
  }

  if (parsedManualEntity.value) {
    selectEntity(parsedManualEntity.value)
  }
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (activeAbortController) activeAbortController.abort()
})
</script>

<template>
  <div class="wikidata-autosuggest-input">
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder || 'Q42 Douglas Adams'"
      @keydown.enter.prevent="onEnterKey"
    />

    <button type="button" :disabled="!parsedManualEntity" @click="selectEntity(parsedManualEntity)">
      Add
    </button>

    <p v-if="isLoading" class="wikidata-status-text">Searching Wikidata...</p>
    <p v-else-if="requestError" class="wikidata-status-text">{{ requestError }}</p>

    <ul v-if="suggestions.length" class="wikidata-suggestion-list">
      <li v-for="entry in suggestions" :key="`${entry.id}-${entry.label}`">
        <button type="button" class="wikidata-suggestion-item" @click="selectEntity(entry)">
          <span class="wikidata-suggestion-main">
            <strong>{{ entry.label || entry.id }}</strong>
            <small v-if="entry.description">{{ entry.description }}</small>
          </span>
          <span class="wikidata-suggestion-id">{{ entry.id }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.wikidata-autosuggest-input {
  display: grid;
  gap: 0.35rem;
}

.wikidata-suggestion-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-surface);
}

.wikidata-suggestion-list li + li {
  border-top: 1px solid var(--color-border-soft);
}

.wikidata-suggestion-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 0;
  color: var(--color-text);
  padding: 0.5rem 0.6rem;
}

.wikidata-suggestion-main {
  display: grid;
  gap: 0.05rem;
}

.wikidata-suggestion-item:hover,
.wikidata-suggestion-item:focus-visible {
  background: #f4f7fb;
}

.wikidata-suggestion-main small {
  color: var(--ve-color-text-muted);
}

.wikidata-suggestion-id {
  color: var(--ve-color-text-muted);
  font-family: var(--ve-font-family-mono);
  font-size: 0.82rem;
}

.wikidata-status-text {
  margin: 0;
  color: var(--ve-color-text-muted);
  font-size: 0.9rem;
}
</style>
