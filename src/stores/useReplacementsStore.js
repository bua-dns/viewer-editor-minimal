import { computed, ref } from 'vue'

const replacements = ref({})
const replacementsSnapshot = ref({})

function serializeReplacements(value) {
  return JSON.stringify(value || {})
}

function initializeReplacements(payload = {}) {
  const nextValue = JSON.parse(JSON.stringify(payload || {}))
  replacements.value = nextValue
  replacementsSnapshot.value = JSON.parse(JSON.stringify(nextValue))
}

function addReplacement(field, replace, withText) {
  if (!field) return
  if (!replace) return

  if (!replacements.value[field]) {
    replacements.value[field] = {}
  }

  replacements.value[field][replace] = withText
}

function createReplacementsPayload() {
  return JSON.parse(JSON.stringify(replacements.value))
}

function clearReplacements() {
  replacements.value = {}
  replacementsSnapshot.value = {}
}

function resetReplacements() {
  replacements.value = JSON.parse(JSON.stringify(replacementsSnapshot.value || {}))
}

const hasReplacementsChanges = computed(
  () => serializeReplacements(replacements.value) !== serializeReplacements(replacementsSnapshot.value),
)

export function useReplacementsStore() {
  return {
    replacements,
    initializeReplacements,
    addReplacement,
    createReplacementsPayload,
    clearReplacements,
    resetReplacements,
    hasReplacementsChanges,
  }
}
