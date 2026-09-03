import { computed, ref } from 'vue'

const replacements = ref({})
const replacementsSnapshot = ref({})
const applyStatus = ref('idle')
const lastApplyError = ref('')
const lastApplySummary = ref(null)

function serializeReplacements(value) {
  return JSON.stringify(value || {})
}

function clonePlainValue(value) {
  return JSON.parse(JSON.stringify(value ?? {}))
}

function initializeReplacements(payload = {}) {
  const nextValue = clonePlainValue(payload)
  replacements.value = nextValue
  replacementsSnapshot.value = clonePlainValue(nextValue)
  applyStatus.value = 'idle'
  lastApplyError.value = ''
  lastApplySummary.value = null
}

function addReplacement(field, replace, withText) {
  if (!field) return false
  if (!replace) return false

  if (!replacements.value[field]) {
    replacements.value[field] = {}
  }

  replacements.value[field][replace] = typeof withText === 'string' ? withText : String(withText ?? '')
  return true
}

function removeReplacement(field, replace) {
  const mapping = replacements.value[field]
  if (!mapping || typeof mapping !== 'object') return false
  if (!Object.prototype.hasOwnProperty.call(mapping, replace)) return false

  delete mapping[replace]
  if (!Object.keys(mapping).length) {
    delete replacements.value[field]
  }
  replacements.value = { ...replacements.value }
  return true
}

function createReplacementsPayload() {
  return clonePlainValue(replacements.value)
}

function clearReplacements() {
  replacements.value = {}
  replacementsSnapshot.value = {}
  applyStatus.value = 'idle'
  lastApplyError.value = ''
  lastApplySummary.value = null
}

function resetReplacements() {
  replacements.value = clonePlainValue(replacementsSnapshot.value)
}

/** Sync the baseline after the rules have been written to their backing store. */
function markReplacementsAsSaved() {
  replacementsSnapshot.value = clonePlainValue(replacements.value)
}

function beginReplacementsApply() {
  applyStatus.value = 'applying'
  lastApplyError.value = ''
  lastApplySummary.value = null
}

function finishReplacementsApply(summary) {
  applyStatus.value = 'success'
  lastApplyError.value = ''
  lastApplySummary.value = summary || null
}

function failReplacementsApply(message) {
  applyStatus.value = 'error'
  lastApplyError.value = String(message || 'Could not apply replacements.')
}

function clearReplacementsApplyFeedback() {
  if (applyStatus.value === 'success' || applyStatus.value === 'error') {
    applyStatus.value = 'idle'
  }
  lastApplyError.value = ''
  lastApplySummary.value = null
}

const hasReplacementsChanges = computed(
  () => serializeReplacements(replacements.value) !== serializeReplacements(replacementsSnapshot.value),
)

export function useReplacementsStore() {
  return {
    replacements,
    applyStatus,
    lastApplyError,
    lastApplySummary,
    initializeReplacements,
    addReplacement,
    removeReplacement,
    createReplacementsPayload,
    clearReplacements,
    resetReplacements,
    markReplacementsAsSaved,
    beginReplacementsApply,
    finishReplacementsApply,
    failReplacementsApply,
    clearReplacementsApplyFeedback,
    hasReplacementsChanges,
  }
}
