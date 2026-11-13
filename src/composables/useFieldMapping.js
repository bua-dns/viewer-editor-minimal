import { useUserConfigStore } from '../stores/useUserConfigStore'
import { createFieldEditorBinding, supportsPrefill } from '../fields/fieldRegistry'
import { isCreatedItem } from './createdItems'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Field config lookups of one configuration scope ('' = the primary collection). `fieldIdPrefix`
 * makes the input ids unique when several item editors are shown at once.
 */
export function useFieldMapping(configScope = '', { fieldIdPrefix = 'field' } = {}) {
  const { appliedUserConfigFields, appliedShowOnlyNonEmptyFields } = useUserConfigStore(configScope)
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

  // The text of the field named in `prefillWith`, or '' when there is none.
  function getPrefillSourceValue(fieldConfig, selectedRawItem) {
    const sourceKey = String(fieldConfig?.prefillWith || '').trim()
    if (!sourceKey || !isPlainObject(selectedRawItem)) return ''
    const sourceValue = selectedRawItem[sourceKey]
    return typeof sourceValue === 'string' ? sourceValue : ''
  }

  // Non-autosuggest fields: the proposal shown in an empty field until it is accepted or dismissed.
  // Autosuggest fields use the prefill as search term instead (see getFieldEditorBinding).
  function getPrefillProposal(key, selectedRawItem) {
    const fieldConfig = getFieldConfig(key)
    if (!fieldConfig || isAutosuggestFieldType(fieldConfig.type)) return ''
    if (!supportsPrefill(fieldConfig.type)) return ''
    if (!isFieldValueEmpty(selectedRawItem?.[key])) return ''
    return getPrefillSourceValue(fieldConfig, selectedRawItem).trim()
  }

  function getFieldEditorBinding(key, value, selectedRawItem = null, candidateAutosuggestPrefills = {}) {
    const fieldConfig = getFieldConfig(key)
    const candidateAutosuggestPrefill =
      candidateAutosuggestPrefills && typeof candidateAutosuggestPrefills === 'object'
        ? candidateAutosuggestPrefills[key]
        : null
    const hasCandidateAutosuggestPrefill = typeof candidateAutosuggestPrefill?.value === 'string'

    return createFieldEditorBinding({
      fieldId: `${fieldIdPrefix}-${key}`,
      configuredType: fieldConfig?.type,
      value,
      placeholder: getFieldPlaceholder(key),
      readOnly: Boolean(fieldConfig?.readOnly && !isAutosuggestFieldType(fieldConfig?.type)),
      autosuggestConfig: fieldConfig?.autosuggest,
      autosuggestPrefillValue: hasCandidateAutosuggestPrefill
        ? candidateAutosuggestPrefill.value
        : getPrefillSourceValue(fieldConfig, selectedRawItem),
      autosuggestPrefillContext: selectedRawItem,
      autosuggestForceSearchToken: Number(candidateAutosuggestPrefill?.token) || 0,
      candidateConfig: fieldConfig?.candidate,
    })
  }

  // Hidden fields stay in the data (e.g. as autosuggest prefill source) but get no editor row.
  function isFieldHidden(key) {
    return getFieldConfig(key)?.hidden === true
  }

  function getDisplayedFieldKeys(selectedRawItem) {
    if (!selectedRawItem) return []
    // Items created in this session keep their empty fields visible so they can be filled.
    const isNewItem = selectedRawItem?.__onlineMeta?.isDraft === true || isCreatedItem(selectedRawItem)
    const keys = Object.keys(selectedRawItem).filter((key) => {
      if (key === 'scan') return false
      if (key === 'suspendEditing') return false
      if (key === '__onlineMeta') return false
      if (isFieldHidden(key)) return false
      if (!appliedShowOnlyNonEmptyFields.value) return true
      if (isNewItem) return true
      if (isAutosuggestFieldType(appliedUserConfigFields.value[key]?.type)) return true
      if (getPrefillProposal(key, selectedRawItem)) return true
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
    isFieldHidden,
    getFieldEditorBinding,
    getPrefillProposal,
    getDisplayedFieldKeys,
  }
}
