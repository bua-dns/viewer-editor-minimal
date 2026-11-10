// The derivation rules of the open online data source (`viewer-setting.mappings`), and saving one
// rule back. Loaded with the online settings, cleared when the data source closes.
import { ref } from 'vue'
import { normalizeDerivationRules, upsertRuleForSource } from '../composables/derivationRules'
import { updateViewerMappingsInStrapi } from '../services/strapiMappings'
import { useAuthStore } from './useAuthStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'

const rules = ref([])
const saveStatus = ref('idle')
const lastSaveError = ref('')

function initializeDerivationRules(mappings) {
  rules.value = normalizeDerivationRules(mappings)
  saveStatus.value = 'idle'
  lastSaveError.value = ''
}

function clearDerivationRules() {
  initializeDerivationRules(null)
}

/** Stores `rule` in place of the rule with the same source; the other rules are kept. */
async function saveDerivationRule(rule, { updateMappings = updateViewerMappingsInStrapi } = {}) {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()
  if (!connectionProfile.value) {
    saveStatus.value = 'error'
    lastSaveError.value = 'No saved connection profile found.'
    return { ok: false, error: lastSaveError.value }
  }

  saveStatus.value = 'saving'
  lastSaveError.value = ''
  try {
    const stored = await updateMappings({
      profile: connectionProfile.value,
      token: token.value || '',
      mappings: upsertRuleForSource(rules.value, rule),
    })
    rules.value = normalizeDerivationRules(stored)
    saveStatus.value = 'saved'
    return { ok: true }
  } catch (error) {
    saveStatus.value = 'error'
    lastSaveError.value = String(error?.message || 'Could not save the derivation rule.')
    return { ok: false, error: lastSaveError.value }
  }
}

export function useDerivationRulesStore() {
  return {
    rules,
    saveStatus,
    lastSaveError,
    initializeDerivationRules,
    clearDerivationRules,
    saveDerivationRule,
  }
}
