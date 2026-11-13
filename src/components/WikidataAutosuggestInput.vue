<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useWikidataSearch } from '../composables/useWikidataSearch'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { isPlainObject } from '../domain/objects'

const props = defineProps({
  config: { type: Object, default: null },
  placeholder: { type: String, default: '' },
  prefillValue: { type: String, default: '' },
  prefillContext: { type: Object, default: null },
  prefillForceSearchToken: { type: Number, default: 0 },
  selectedEntities: { type: Array, default: () => [] },
})

const emit = defineEmits(['select'])

const { t } = useAppConfigStore()

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
// Set by the x button: the prefilled search term stays away until another item is opened.
const isPrefillDismissed = ref(false)

let debounceTimer = null
let requestId = 0
let activeSearchController = null
let suppressNextQueryWatcher = false

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

// The lookups after a pick take a moment. The editor is keyed per item, so moving to another item
// unmounts this input; the pending pick is then aborted and never written (review F5).
let pendingSelectionController = null

function abortPendingSelection() {
  pendingSelectionController?.abort()
  pendingSelectionController = null
}

async function selectEntity(entity) {
  abortPendingSelection()
  const controller = new AbortController()
  pendingSelectionController = controller

  const nextItem = await getEmitItem(entity, controller.signal)
  if (controller.signal.aborted) return
  pendingSelectionController = null

  emit('select', nextItem)
  query.value = ''
  suggestions.value = []
  requestError.value = nextItem.missingData ? MISSING_DATA_MESSAGE : ''
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

const MISSING_DATA_MESSAGE = 'Some Wikidata data could not be loaded. Use "Reload data" on the entity.'

function applyClaimSelection(nextItem, item) {
  if (!persistedClaimPropertyIds.value.length) {
    delete nextItem.ranking
    delete nextItem.prioritizationValues
  } else {
    nextItem.prioritizationValues = filterPrioritizationValues(item?.prioritizationValues, persistedClaimPropertyIds.value)
    if (!Object.keys(nextItem.prioritizationValues).length) delete nextItem.prioritizationValues
  }

  const geoNamesValues = deriveGeoNamesValues(nextItem.prioritizationValues)
  if (geoNamesValues.length) {
    nextItem.geoNames = geoNamesValues
  } else {
    delete nextItem.geoNames
  }
}

function logLookupFailure(context, error) {
  if (!isAbortError(error) && import.meta.env.DEV) {
    console.warn(`[wikidata] ${context} request failed`, error)
  }
}

/** Loads the configured statement data; returns the property ids whose request failed. */
async function loadStatementData(nextItem, signal) {
  if (!alsoGetDataFromProperties.value.length) return []

  const statementRequests = alsoGetDataFromProperties.value.map(async ({ propertyId }) => ({
    propertyId,
    statementData: await fetchStatementDataForEntity(nextItem.id, propertyId, { signal }),
  }))
  const settled = await Promise.allSettled(statementRequests)
  const nextStatementData = isPlainObject(nextItem.statementData) ? { ...nextItem.statementData } : {}
  const failedPropertyIds = []

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      nextStatementData[result.value.propertyId] = result.value.statementData
      return
    }
    failedPropertyIds.push(alsoGetDataFromProperties.value[index].propertyId)
    logLookupFailure('statement data', result.reason)
  })

  if (Object.keys(nextStatementData).length) nextItem.statementData = nextStatementData
  return failedPropertyIds
}

function pickLocalizedText(texts, fallbackLanguage, fallback) {
  return texts[fallbackLanguage] || texts.de || texts.en || fallback
}

// de/en from Wikidata; the search result's own text fills the result language when Wikidata has none.
function mergeLocalizedTexts(existing, fetched, fallbackLanguage, fallbackText) {
  const merged = { ...(isPlainObject(existing) ? existing : {}) }
  for (const language of ['de', 'en']) {
    merged[language] = readLocalizedTextValue(fetched?.[language])
  }
  if (fallbackLanguage === 'de' || fallbackLanguage === 'en') {
    merged[fallbackLanguage] = merged[fallbackLanguage] || fallbackText
  }
  return merged
}

/** Adds de/en labels and descriptions; returns false when the request failed. */
async function loadLocalizedTexts(nextItem, signal) {
  const fallbackLanguage = String(mergedConfig.value.resultLanguage || '').trim().toLowerCase()
  const labelFallback = readLocalizedTextValue(nextItem.label)
  const descriptionFallback = readLocalizedTextValue(nextItem.description)

  let localizedTexts
  try {
    localizedTexts = await fetchEntityLocalizedTexts(nextItem.id, { languages: ['de', 'en'], signal })
  } catch (error) {
    logLookupFailure('localized label/description', error)
    return false
  }

  const labels = mergeLocalizedTexts(nextItem.labels, localizedTexts.labels, fallbackLanguage, labelFallback)
  const descriptions = mergeLocalizedTexts(
    nextItem.descriptions,
    localizedTexts.descriptions,
    fallbackLanguage,
    descriptionFallback,
  )

  nextItem.labels = labels
  nextItem.descriptions = descriptions
  if (!labelFallback) nextItem.label = pickLocalizedText(labels, fallbackLanguage, nextItem.id)
  if (!descriptionFallback) nextItem.description = pickLocalizedText(descriptions, fallbackLanguage, '')
  return true
}

/**
 * The entity as stored: selected claim data plus the configured lookups. Failed lookups are
 * recorded in `missingData` (kept with the record), so an incomplete entity stays visible (F8).
 */
async function getEmitItem(item, signal) {
  const nextItem = { ...item }
  delete nextItem.missingData
  applyClaimSelection(nextItem, item)

  const entityId = typeof nextItem.id === 'string' ? nextItem.id.trim() : ''
  if (!entityId) return nextItem

  const [missingStatements, hasLocalizedTexts] = await Promise.all([
    loadStatementData(nextItem, signal),
    loadLocalizedTexts(nextItem, signal),
  ])

  if (missingStatements.length || !hasLocalizedTexts) {
    nextItem.missingData = { statements: missingStatements, labels: !hasLocalizedTexts }
  }
  return nextItem
}

/** Repeats the lookups for an already selected entity ("Reload data"). */
async function completeEntity(entity) {
  return getEmitItem(entity)
}

defineExpose({ completeEntity })

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

// Another item was opened: its prefill replaces the query, and the search runs unless the field
// already holds an entity.
function applyPrefillForNewContext(normalizedPrefill) {
  isPrefillDismissed.value = false
  if (query.value !== normalizedPrefill) {
    suppressNextQueryWatcher = true
    query.value = normalizedPrefill
  }
  lastAppliedPrefill.value = normalizedPrefill
  if (hasSelectedEntities.value) {
    suggestions.value = []
    requestError.value = ''
    isLoading.value = false
    return
  }
  scheduleSearch(normalizedPrefill)
}

watch(
  () => [props.prefillValue, props.prefillContext],
  ([nextValue, nextContext], previousTuple) => {
    const previousContext = Array.isArray(previousTuple) ? previousTuple[1] : undefined
    const normalizedPrefill = normalizePrefillValue(nextValue)
    const contextChanged = nextContext !== previousContext

    if (contextChanged) {
      applyPrefillForNewContext(normalizedPrefill)
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

    if (isPrefillDismissed.value) return

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

    isPrefillDismissed.value = false
    if (query.value !== normalizedPrefill) {
      suppressNextQueryWatcher = true
      query.value = normalizedPrefill
    }
    lastAppliedPrefill.value = normalizedPrefill
    scheduleSearch(normalizedPrefill)
  },
)

const isQueryPrefilled = computed(() => Boolean(lastAppliedPrefill.value) && query.value === lastAppliedPrefill.value)

function onClearPrefill() {
  isPrefillDismissed.value = true
  suppressNextQueryWatcher = true
  query.value = ''
  scheduleSearch('')
}

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
  abortPendingSelection()
})
</script>

<template>
  <div class="wikidata-autosuggest-input">
    <div class="wikidata-query-wrap" :class="{ 'is-prefilled': isQueryPrefilled }">
      <input
        v-model="query"
        type="text"
        :placeholder="placeholder || 'Q42 Douglas Adams'"
        @keydown.enter.prevent="onEnterKey"
      />
      <button
        v-if="isQueryPrefilled"
        type="button"
        class="prefill-clear-btn"
        :title="t('prefillClearSearchLabel', 'Clear prefilled search term')"
        :aria-label="t('prefillClearSearchLabel', 'Clear prefilled search term')"
        @click="onClearPrefill"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="feather feather-x"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

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

.wikidata-query-wrap {
  position: relative;
  display: grid;
}

.wikidata-query-wrap.is-prefilled input {
  padding-right: 2rem;
}

.prefill-clear-btn {
  position: absolute;
  top: 50%;
  right: 0.35rem;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ve-color-text-muted);
  cursor: pointer;
}

.prefill-clear-btn:hover,
.prefill-clear-btn:focus-visible {
  background: color-mix(in srgb, var(--ve-color-text-muted) 15%, transparent);
  color: var(--ve-color-text-strong);
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
