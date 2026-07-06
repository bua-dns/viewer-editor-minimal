<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useWikidataSearch } from '../composables/useWikidataSearch'

const props = defineProps({
  config: { type: Object, default: null },
  placeholder: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const DEFAULT_CONFIG = {
  searchLanguages: ['de', 'en'],
  resultLanguage: 'de',
  minChars: 2,
  limit: 10,
  prioritize: {
    claimPresence: {
      weight: 0,
      includeInEmitData: false,
      showInSuggestion: false,
      defs: [],
    },
    claimValueMatch: {
      weight: 0,
      includeInEmitData: false,
      showInSuggestion: false,
      defs: [],
    },
  },
}

const query = ref('')
const suggestions = ref([])
const isLoading = ref(false)
const requestError = ref('')

let debounceTimer = null
let requestId = 0
let activeSearchController = null

function isAbortError(error) {
  return Boolean(error) && (error.name === 'AbortError' || error.code === 20)
}

function abortActiveSearch() {
  if (!activeSearchController) {
    return
  }

  activeSearchController.abort()
  activeSearchController = null
}

const mergedConfig = computed(() => {
  const incomingConfig = props.config || {}
  const incomingPrioritize = incomingConfig.prioritize || {}

  return {
    ...DEFAULT_CONFIG,
    ...incomingConfig,
    prioritize: {
      ...DEFAULT_CONFIG.prioritize,
      ...incomingPrioritize,
      claimPresence: {
        ...DEFAULT_CONFIG.prioritize.claimPresence,
        ...(incomingPrioritize.claimPresence || {}),
      },
      claimValueMatch: {
        ...DEFAULT_CONFIG.prioritize.claimValueMatch,
        ...(incomingPrioritize.claimValueMatch || {}),
      },
    },
  }
})

const minChars = computed(() => Number(mergedConfig.value.minChars) || DEFAULT_CONFIG.minChars)
const effectiveLimit = computed(() => {
  const parsed = Number(mergedConfig.value.limit)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CONFIG.limit
  }
  return Math.min(Math.floor(parsed), 50)
})

function getPropertyIdsForPrioritizeRule(ruleName, defs) {
  if (!Array.isArray(defs)) {
    return []
  }

  if (ruleName === 'claimPresence') {
    return defs.filter((propertyId) => typeof propertyId === 'string' && propertyId.trim())
  }

  if (ruleName === 'claimValueMatch') {
    return defs
      .map((definition) => definition?.property)
      .filter((propertyId) => typeof propertyId === 'string' && propertyId.trim())
  }

  return []
}

function collectPropertyIdsByFlag(flagName) {
  const prioritizeConfig = mergedConfig.value.prioritize || {}
  const propertyIds = new Set()

  for (const [ruleName, ruleConfig] of Object.entries(prioritizeConfig)) {
    if (!ruleConfig?.[flagName]) {
      continue
    }

    for (const propertyId of getPropertyIdsForPrioritizeRule(ruleName, ruleConfig.defs)) {
      propertyIds.add(propertyId)
    }
  }

  return Array.from(propertyIds)
}

const suggestionPropertyIds = computed(() => collectPropertyIdsByFlag('showInSuggestion'))
const emitPropertyIds = computed(() => collectPropertyIdsByFlag('includeInEmitData'))
const showSuggestionMetadata = computed(() => suggestionPropertyIds.value.length > 0)

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
  emit('select', getEmitItem(entity))
  query.value = ''
  suggestions.value = []
  requestError.value = ''
}

function filterPrioritizationValues(prioritizationValues, propertyIds) {
  if (!prioritizationValues || typeof prioritizationValues !== 'object' || !propertyIds.length) {
    return {}
  }

  const filteredValues = {}

  for (const propertyId of propertyIds) {
    const values = prioritizationValues[propertyId]
    if (Array.isArray(values) && values.length) {
      filteredValues[propertyId] = values
    }
  }

  return filteredValues
}

function getSuggestionPrioritizationValuesText(item) {
  const filteredValues = filterPrioritizationValues(
    item?.prioritizationValues,
    suggestionPropertyIds.value,
  )

  const parts = Object.entries(filteredValues)
    .filter(([, values]) => Array.isArray(values) && values.length)
    .map(([propertyId, values]) => `${propertyId}: ${values.join(', ')}`)

  return parts.join(' | ')
}

function getEmitItem(item) {
  const nextItem = { ...item }
  const shouldIncludeClaimData = emitPropertyIds.value.length > 0

  if (!shouldIncludeClaimData) {
    delete nextItem.ranking
    delete nextItem.prioritizationValues
    return nextItem
  }

  nextItem.prioritizationValues = filterPrioritizationValues(
    item?.prioritizationValues,
    emitPropertyIds.value,
  )

  if (!Object.keys(nextItem.prioritizationValues).length) {
    delete nextItem.prioritizationValues
  }

  return nextItem
}

const { search } = useWikidataSearch()

watch(
  () => query.value,
  (nextValue) => {
    const normalized = nextValue.trim()

    abortActiveSearch()

    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    if (normalized.length < minChars.value) {
      suggestions.value = []
      requestError.value = ''
      isLoading.value = false
      return
    }

    debounceTimer = setTimeout(async () => {
      const currentRequestId = ++requestId
      const controller = new AbortController()

      activeSearchController = controller
      isLoading.value = true
      requestError.value = ''

      try {
        const searchResults = await search(normalized, {
          searchLanguages: mergedConfig.value.searchLanguages,
          resultLanguage: mergedConfig.value.resultLanguage,
          limit: effectiveLimit.value,
          prioritize: mergedConfig.value.prioritize,
          signal: controller.signal,
        })

        if (currentRequestId === requestId) {
          suggestions.value = searchResults
        }
      } catch (error) {
        if (isAbortError(error)) {
          return
        }

        if (currentRequestId === requestId) {
          suggestions.value = []
          requestError.value = error instanceof Error ? error.message : 'Could not fetch Wikidata results.'
        }
      } finally {
        if (activeSearchController === controller) {
          activeSearchController = null
        }

        if (currentRequestId === requestId) {
          isLoading.value = false
        }
      }
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
  abortActiveSearch()
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
            <small v-if="showSuggestionMetadata && entry.ranking" class="wikidata-suggestion-meta">
              Rank: {{ entry.ranking.score }}
            </small>
            <small
              v-if="showSuggestionMetadata && getSuggestionPrioritizationValuesText(entry)"
              class="wikidata-suggestion-meta wikidata-suggestion-meta--mono"
            >
              {{ getSuggestionPrioritizationValuesText(entry) }}
            </small>
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

.wikidata-suggestion-meta {
  font-size: 0.75rem;
}

.wikidata-suggestion-meta--mono {
  font-family: var(--ve-font-family-mono);
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
