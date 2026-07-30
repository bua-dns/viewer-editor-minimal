<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useWikidataSearch } from '../composables/useWikidataSearch'

const props = defineProps({
  config: { type: Object, default: null },
  placeholder: { type: String, default: '' },
  prefillValue: { type: String, default: '' },
  prefillContext: { type: Object, default: null },
  prefillForceSearchToken: { type: Number, default: 0 },
  selectedEntities: { type: Array, default: () => [] },
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
const lastAppliedPrefill = ref('')

let debounceTimer = null
let requestId = 0
let activeSearchController = null
let suppressNextQueryWatcher = false

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readLocalizedTextValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

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
    return defs
      .map((definition) => {
        if (typeof definition === 'string') return definition
        if (typeof definition?.propertyId === 'string') return definition.propertyId
        if (typeof definition?.property === 'string') return definition.property
        return ''
      })
      .map((propertyId) => String(propertyId || '').trim())
      .filter(Boolean)
  }

  if (ruleName === 'claimValueMatch') {
    return defs
      .map((definition) => definition?.property)
      .map((propertyId) => String(propertyId || '').trim())
      .filter(Boolean)
  }

  return []
}

function normalizePrefillValue(value) {
  return String(value || '').trim()
}

function getPropertyLabelForPrioritizeRule(ruleName, definition) {
  if (!definition || typeof definition !== 'object') {
    return ''
  }

  if (ruleName === 'claimPresence') {
    if (typeof definition.propertyLabel === 'string' && definition.propertyLabel.trim()) {
      return definition.propertyLabel.trim()
    }
    if (typeof definition.label === 'string' && definition.label.trim()) {
      return definition.label.trim()
    }
    return ''
  }

  if (ruleName === 'claimValueMatch') {
    if (typeof definition.label === 'string' && definition.label.trim()) {
      return definition.label.trim()
    }
    return ''
  }

  return ''
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
const persistedClaimPropertyIds = computed(() =>
  Array.from(new Set([...emitPropertyIds.value, ...suggestionPropertyIds.value])),
)
const showSuggestionMetadata = computed(() => suggestionPropertyIds.value.length > 0)
function normalizeAlsoGetDataFromPropertyDefs(value) {
  if (typeof value === 'string') {
    return [
      {
        propertyId: value,
        label: '',
      },
    ]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => {
    if (typeof entry === 'string') {
      return {
        propertyId: entry,
        label: '',
      }
    }

    return {
      propertyId:
        typeof entry?.propertyId === 'string'
          ? entry.propertyId
          : typeof entry?.property === 'string'
            ? entry.property
            : '',
      label:
        typeof entry?.label === 'string'
          ? entry.label
          : typeof entry?.propertyLabel === 'string'
            ? entry.propertyLabel
            : '',
    }
  })
}

const alsoGetDataFromProperties = computed(() => {
  const defs = normalizeAlsoGetDataFromPropertyDefs(mergedConfig.value.alsoGetDataFrom)
  const seen = new Set()
  const normalizedDefs = []

  for (const definition of defs) {
    const normalizedPropertyId = String(definition?.propertyId || '').trim().toUpperCase()
    if (!/^P\d+$/.test(normalizedPropertyId) || seen.has(normalizedPropertyId)) {
      continue
    }

    seen.add(normalizedPropertyId)
    normalizedDefs.push({
      propertyId: normalizedPropertyId,
      label: String(definition?.label || '').trim(),
    })
  }

  return normalizedDefs
})

const suggestionPropertyLabels = computed(() => {
  const prioritizeConfig = mergedConfig.value.prioritize || {}
  const labelsByPropertyId = {}

  for (const [ruleName, ruleConfig] of Object.entries(prioritizeConfig)) {
    if (!ruleConfig?.showInSuggestion || !Array.isArray(ruleConfig.defs)) {
      continue
    }

    for (const definition of ruleConfig.defs) {
      const propertyIds = getPropertyIdsForPrioritizeRule(ruleName, [definition])
      if (!propertyIds.length) {
        continue
      }

      const label = getPropertyLabelForPrioritizeRule(ruleName, definition)
      if (!label) {
        continue
      }

      const propertyId = propertyIds[0]
      if (!labelsByPropertyId[propertyId]) {
        labelsByPropertyId[propertyId] = label
      }
    }
  }

  return labelsByPropertyId
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

const normalizedSelectedEntities = computed(() =>
  (Array.isArray(props.selectedEntities) ? props.selectedEntities : [])
    .filter((entity) => isPlainObject(entity) && typeof entity.id === 'string' && entity.id.trim())
    .map((entity) => ({
      ...entity,
      id: entity.id.trim(),
      label:
        typeof entity.label === 'string' && entity.label.trim()
          ? entity.label.trim()
          : entity.id.trim(),
    })),
)

const selectedEntityIds = computed(() => new Set(normalizedSelectedEntities.value.map((entity) => entity.id)))
const hasSelectedEntities = computed(() => normalizedSelectedEntities.value.length > 0)
const visibleSuggestions = computed(() =>
  suggestions.value.filter((entry) => !selectedEntityIds.value.has(entry.id)),
)

async function selectEntity(entity) {
  const nextItem = await getEmitItem(entity)
  emit('select', nextItem)
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

function deriveGeoNamesValues(prioritizationValues) {
  const values = prioritizationValues?.P1566
  if (!Array.isArray(values) || !values.length) {
    return []
  }

  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  )
}

function getSuggestionPrioritizationValuesText(item) {
  const filteredValues = filterPrioritizationValues(
    item?.prioritizationValues,
    suggestionPropertyIds.value,
  )

  const parts = Object.entries(filteredValues)
    .filter(([, values]) => Array.isArray(values) && values.length)
    .map(([propertyId, values]) => {
      const propertyLabel = suggestionPropertyLabels.value[propertyId]
      const displayLabel = propertyLabel ? `${propertyLabel} (${propertyId})` : propertyId
      return `${displayLabel}: ${values.join(', ')}`
    })

  return parts.join(' | ')
}

async function getEmitItem(item) {
  const nextItem = { ...item }
  const shouldIncludeClaimData = persistedClaimPropertyIds.value.length > 0
  const fallbackLanguage = String(mergedConfig.value.resultLanguage || '').trim().toLowerCase()
  const labelFallback = readLocalizedTextValue(nextItem.label)
  const descriptionFallback = readLocalizedTextValue(nextItem.description)

  if (!shouldIncludeClaimData) {
    delete nextItem.ranking
    delete nextItem.prioritizationValues
  } else {
    nextItem.prioritizationValues = filterPrioritizationValues(
      item?.prioritizationValues,
      persistedClaimPropertyIds.value,
    )

    if (!Object.keys(nextItem.prioritizationValues).length) {
      delete nextItem.prioritizationValues
    }
  }

  const geoNamesValues = deriveGeoNamesValues(nextItem.prioritizationValues)
  if (geoNamesValues.length) {
    nextItem.geoNames = geoNamesValues
  } else {
    delete nextItem.geoNames
  }

  if (
    alsoGetDataFromProperties.value.length &&
    typeof nextItem.id === 'string' &&
    nextItem.id.trim()
  ) {
    const statementRequests = alsoGetDataFromProperties.value.map(async ({ propertyId }) => ({
      propertyId,
      statementData: await fetchStatementDataForEntity(nextItem.id, propertyId),
    }))

    const settled = await Promise.allSettled(statementRequests)
    const existingStatementData = isPlainObject(nextItem.statementData) ? nextItem.statementData : {}
    const nextStatementData = { ...existingStatementData }

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        nextStatementData[result.value.propertyId] = result.value.statementData
        continue
      }

      if (!isAbortError(result.reason) && import.meta.env.DEV) {
        console.warn('[wikidata] statement data request failed', result.reason)
      }
    }

    if (Object.keys(nextStatementData).length) {
      nextItem.statementData = nextStatementData
    }
  }

  if (typeof nextItem.id === 'string' && nextItem.id.trim()) {
    try {
      const localizedTexts = await fetchEntityLocalizedTexts(nextItem.id, {
        languages: ['de', 'en'],
      })

      const labels = isPlainObject(nextItem.labels) ? { ...nextItem.labels } : {}
      const descriptions = isPlainObject(nextItem.descriptions) ? { ...nextItem.descriptions } : {}

      labels.de = readLocalizedTextValue(localizedTexts.labels?.de)
      labels.en = readLocalizedTextValue(localizedTexts.labels?.en)
      descriptions.de = readLocalizedTextValue(localizedTexts.descriptions?.de)
      descriptions.en = readLocalizedTextValue(localizedTexts.descriptions?.en)

      if (fallbackLanguage === 'de' || fallbackLanguage === 'en') {
        if (!labels[fallbackLanguage] && labelFallback) {
          labels[fallbackLanguage] = labelFallback
        }
        if (!descriptions[fallbackLanguage] && descriptionFallback) {
          descriptions[fallbackLanguage] = descriptionFallback
        }
      }

      nextItem.labels = labels
      nextItem.descriptions = descriptions

      if (!readLocalizedTextValue(nextItem.label)) {
        nextItem.label = labels[fallbackLanguage] || labels.de || labels.en || nextItem.id
      }

      if (!readLocalizedTextValue(nextItem.description)) {
        nextItem.description =
          descriptions[fallbackLanguage] || descriptions.de || descriptions.en || ''
      }
    } catch (error) {
      if (!isAbortError(error) && import.meta.env.DEV) {
        console.warn('[wikidata] localized label/description request failed', error)
      }
    }
  }

  return nextItem
}

const { search, fetchStatementDataForEntity, fetchEntityLocalizedTexts } = useWikidataSearch()

function scheduleSearch(normalized) {
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
}

watch(
  () => [props.prefillValue, props.prefillContext],
  ([nextValue, nextContext], previousTuple) => {
    const previousContext = Array.isArray(previousTuple) ? previousTuple[1] : undefined
    const normalizedPrefill = normalizePrefillValue(nextValue)
    const contextChanged = nextContext !== previousContext

    if (contextChanged) {
      if (query.value !== normalizedPrefill) {
        suppressNextQueryWatcher = true
        query.value = normalizedPrefill
      }
      lastAppliedPrefill.value = normalizedPrefill
      if (hasSelectedEntities.value) {
        suggestions.value = []
        requestError.value = ''
        isLoading.value = false
      } else {
        scheduleSearch(normalizedPrefill)
      }
      return
    }

    if (!normalizedPrefill) {
      if (query.value === lastAppliedPrefill.value) {
        suppressNextQueryWatcher = true
        query.value = ''
      }
      lastAppliedPrefill.value = ''
      return
    }

    if (!query.value.trim() || query.value === lastAppliedPrefill.value) {
      query.value = normalizedPrefill
      lastAppliedPrefill.value = normalizedPrefill
    }
  },
  { immediate: true },
)

watch(
  () => query.value,
  (nextValue) => {
    if (suppressNextQueryWatcher) {
      suppressNextQueryWatcher = false
      return
    }

    const normalized = nextValue.trim()
    scheduleSearch(normalized)
  },
)

watch(
  () => props.prefillForceSearchToken,
  (nextToken, previousToken) => {
    if (!Number.isFinite(nextToken) || nextToken <= 0) return
    if (nextToken === previousToken) return

    const normalizedPrefill = normalizePrefillValue(props.prefillValue)
    if (!normalizedPrefill) return

    if (query.value !== normalizedPrefill) {
      suppressNextQueryWatcher = true
      query.value = normalizedPrefill
    }
    lastAppliedPrefill.value = normalizedPrefill
    scheduleSearch(normalizedPrefill)
  },
)

function onEnterKey() {
  if (visibleSuggestions.value.length) {
    selectEntity(visibleSuggestions.value[0])
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

    <p v-if="isLoading" class="wikidata-status-text">Searching Wikidata...</p>
    <p v-else-if="requestError" class="wikidata-status-text">{{ requestError }}</p>

    <ul v-if="visibleSuggestions.length" class="wikidata-suggestion-list">
      <li v-for="entry in visibleSuggestions" :key="`${entry.id}-${entry.label}`">
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
  gap: 0.45rem;
}

.wikidata-suggestion-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow-y: auto;
  max-height: 9rem;
  background: var(--color-surface);
}

.wikidata-suggestion-list li + li {
  border-top: 1px solid var(--color-border-soft);
}

.wikidata-suggestion-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
  gap: 0.12rem;
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
