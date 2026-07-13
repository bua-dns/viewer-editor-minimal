import { useUserConfigStore } from '../stores/useUserConfigStore'
import { createFieldEditorBinding } from '../fields/fieldRegistry'

export function useFieldMapping() {
  const { appliedUserConfigFields } = useUserConfigStore()

  function getFieldLabel(key) {
    return appliedUserConfigFields.value[key]?.label?.trim() || key
  }

  function getFieldPlaceholder(key) {
    return appliedUserConfigFields.value[key]?.placeholder || ''
  }

  function getFieldHint(key) {
    return appliedUserConfigFields.value[key]?.hint || ''
  }

  function isFieldReadOnly(key) {
    const fieldConfig = appliedUserConfigFields.value[key]
    if (!fieldConfig || fieldConfig.type === 'wikidata-autosuggest') return false
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

  function getFieldEditorBinding(key, value, selectedRawItem = null) {
    const fieldConfig = appliedUserConfigFields.value[key]
    return createFieldEditorBinding({
      fieldId: `field-${key}`,
      configuredType: fieldConfig?.type,
      value,
      placeholder: getFieldPlaceholder(key),
      readOnly: Boolean(fieldConfig?.readOnly && fieldConfig?.type !== 'wikidata-autosuggest'),
      autosuggestConfig: fieldConfig?.autosuggest,
      autosuggestPrefillValue: getAutosuggestPrefillValue(fieldConfig, selectedRawItem),
      autosuggestPrefillContext: selectedRawItem,
    })
  }

  function getDisplayedFieldKeys(selectedRawItem) {
    if (!selectedRawItem) return []
    const keys = Object.keys(selectedRawItem).filter((key) => key !== 'scan')
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
    isFieldReadOnly,
    getFieldEditorBinding,
    getDisplayedFieldKeys,
  }
}
