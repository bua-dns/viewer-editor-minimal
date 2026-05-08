import { useUserConfigStore } from '../stores/useUserConfigStore'

export function useFieldMapping() {
  const { appliedUserConfigFields } = useUserConfigStore()

  function getFieldLabel(key) {
    return appliedUserConfigFields.value[key]?.label?.trim() || key
  }

  function getFieldInputType(key, value) {
    const configuredType = appliedUserConfigFields.value[key]?.type || 'normal'
    if (configuredType === 'integer') return 'number'
    if (configuredType === 'checkbox') return 'checkbox'
    if (configuredType === 'text') return 'textarea'
    if (configuredType === 'normal') return 'text'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'checkbox'
    return 'text'
  }

  function getFieldPlaceholder(key) {
    return appliedUserConfigFields.value[key]?.placeholder || ''
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
    getFieldInputType,
    getFieldPlaceholder,
    getDisplayedFieldKeys,
  }
}
