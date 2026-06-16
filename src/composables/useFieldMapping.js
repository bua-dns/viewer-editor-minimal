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

  function getFieldEditorBinding(key, value) {
    const fieldConfig = appliedUserConfigFields.value[key]
    return createFieldEditorBinding({
      fieldId: `field-${key}`,
      configuredType: fieldConfig?.type,
      value,
      placeholder: getFieldPlaceholder(key),
      autosuggestConfig: fieldConfig?.autosuggest,
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
    getFieldEditorBinding,
    getDisplayedFieldKeys,
  }
}
