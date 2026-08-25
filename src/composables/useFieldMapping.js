import { useUserConfigStore } from '../stores/useUserConfigStore'
import { createFieldEditorBinding } from '../fields/fieldRegistry'

export function useFieldMapping() {
  const { appliedUserConfigFields, appliedShowOnlyNonEmptyFields } = useUserConfigStore()
  const ALLOWED_FIELD_WIDTHS = new Set(['33%', '50%', '100%'])

  function getFieldConfig(key) {
    const fieldConfig = appliedUserConfigFields.value[key]
    return fieldConfig && typeof fieldConfig === 'object' ? fieldConfig : null
  }

  function isAutosuggestFieldType(type) {
    return type === 'wikidata-autosuggest' || type === 'wikidata_autosuggest'
  }

  function isFieldValueEmpty(value) {
    if (value == null) return true
    if (typeof value === 'string') return value === ''
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.keys(value).length === 0
    return false
  }

  function getFieldLabel(key) {
    return appliedUserConfigFields.value[key]?.label?.trim() || key
  }

  function getFieldPlaceholder(key) {
    return appliedUserConfigFields.value[key]?.placeholder || ''
  }

  function getFieldHint(key) {
    return appliedUserConfigFields.value[key]?.hint || ''
  }

  function getFieldWidth(key) {
    const configured = String(appliedUserConfigFields.value[key]?.fieldWidth || '').trim()
    if (ALLOWED_FIELD_WIDTHS.has(configured)) return configured
    return '100%'
  }

  function isFieldReadOnly(key) {
    const fieldConfig = getFieldConfig(key)
    if (!fieldConfig || isAutosuggestFieldType(fieldConfig.type)) return false
    return Boolean(fieldConfig.readOnly)
  }

  function getAutosuggestPrefillValue(fieldConfig, selectedRawItem) {
    const prefillWithFieldKey = String(fieldConfig?.autosuggest?.prefillWith || '').trim()
    if (!prefillWithFieldKey || !selectedRawItem || typeof selectedRawItem !== 'object') {
      return ''
    }

    const sourceValue = selectedRawItem[prefillWithFieldKey]
    return typeof sourceValue === 'string' ? sourceValue : ''
  }

  function getFieldEditorBinding(key, value, selectedRawItem = null, candidateAutosuggestPrefills = {}) {
    const fieldConfig = getFieldConfig(key)
    const candidateAutosuggestPrefill =
      candidateAutosuggestPrefills && typeof candidateAutosuggestPrefills === 'object'
        ? candidateAutosuggestPrefills[key]
        : null
    const hasCandidateAutosuggestPrefill = typeof candidateAutosuggestPrefill?.value === 'string'

    return createFieldEditorBinding({
      fieldId: `field-${key}`,
      configuredType: fieldConfig?.type,
      value,
      placeholder: getFieldPlaceholder(key),
      readOnly: Boolean(fieldConfig?.readOnly && !isAutosuggestFieldType(fieldConfig?.type)),
      autosuggestConfig: fieldConfig?.autosuggest,
      autosuggestPrefillValue: hasCandidateAutosuggestPrefill
        ? candidateAutosuggestPrefill.value
        : getAutosuggestPrefillValue(fieldConfig, selectedRawItem),
      autosuggestPrefillContext: selectedRawItem,
      autosuggestForceSearchToken: Number(candidateAutosuggestPrefill?.token) || 0,
      candidateConfig: fieldConfig?.candidate,
    })
  }

  function getDisplayedFieldKeys(selectedRawItem) {
    if (!selectedRawItem) return []
    const isOnlineDraft = selectedRawItem?.__onlineMeta?.isDraft === true
    const keys = Object.keys(selectedRawItem).filter((key) => {
      if (key === 'scan') return false
      if (key === 'suspendEditing') return false
      if (key === '__onlineMeta') return false
      if (!appliedShowOnlyNonEmptyFields.value) return true
      if (isOnlineDraft) return true
      if (isAutosuggestFieldType(appliedUserConfigFields.value[key]?.type)) return true
      return !isFieldValueEmpty(selectedRawItem[key])
    })
    return keys.sort((a, b) => {
      const aOrder = appliedUserConfigFields.value[a]?.order ?? Number.MAX_SAFE_INTEGER
      const bOrder = appliedUserConfigFields.value[b]?.order ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.localeCompare(b)
    })
  }

  return {
    getFieldLabel,
    getFieldPlaceholder,
    getFieldHint,
    getFieldWidth,
    getFieldConfig,
    isFieldReadOnly,
    getFieldEditorBinding,
    getDisplayedFieldKeys,
  }
}
