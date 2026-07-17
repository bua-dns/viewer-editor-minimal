import { getRegisteredFieldTypes } from '../fields/fieldRegistry'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function validateImportedConfigPayload(configPayload) {
  if (!isPlainObject(configPayload)) {
    return { ok: false, error: 'JSON-Config ist ungueltig: config muss ein Objekt sein.' }
  }

  if (!isPlainObject(configPayload.fields)) {
    return { ok: false, error: 'JSON-Config ist ungueltig: config.fields muss ein Objekt sein.' }
  }

  if (configPayload.itemLabelField != null && typeof configPayload.itemLabelField !== 'string') {
    return { ok: false, error: 'JSON-Config ist ungueltig: config.itemLabelField muss ein String sein.' }
  }

  if (configPayload.markAsEditedBasis != null && typeof configPayload.markAsEditedBasis !== 'string') {
    return { ok: false, error: 'JSON-Config ist ungueltig: config.markAsEditedBasis muss ein String sein.' }
  }

  if (
    configPayload.showOnlyNonEmptyFields != null &&
    typeof configPayload.showOnlyNonEmptyFields !== 'boolean'
  ) {
    return {
      ok: false,
      error: 'JSON-Config ist ungueltig: config.showOnlyNonEmptyFields muss ein Boolean sein.',
    }
  }

  const itemLabelField = String(configPayload.itemLabelField || '').trim()
  if (itemLabelField && !Object.prototype.hasOwnProperty.call(configPayload.fields, itemLabelField)) {
    return {
      ok: false,
      error: `JSON-Config ist ungueltig: itemLabelField ${itemLabelField} ist kein vorhandenes Feld.`,
    }
  }

  const markAsEditedBasis = String(configPayload.markAsEditedBasis || '').trim()
  if (markAsEditedBasis && !Object.prototype.hasOwnProperty.call(configPayload.fields, markAsEditedBasis)) {
    return {
      ok: false,
      error: `JSON-Config ist ungueltig: markAsEditedBasis ${markAsEditedBasis} ist kein vorhandenes Feld.`,
    }
  }

  const allowedTypes = new Set(getRegisteredFieldTypes())
  const fieldEntries = Object.entries(configPayload.fields)

  for (const [key, fieldConfig] of fieldEntries) {
    if (!isPlainObject(fieldConfig)) {
      return { ok: false, error: `JSON-Config ist ungueltig: Feld ${key} muss ein Objekt sein.` }
    }

    const type = fieldConfig.type ?? 'normal'
    if (!allowedTypes.has(type)) {
      return { ok: false, error: `JSON-Config ist ungueltig: Feldtyp bei ${key} wird nicht unterstuetzt.` }
    }

    if (fieldConfig.label != null && typeof fieldConfig.label !== 'string') {
      return { ok: false, error: `JSON-Config ist ungueltig: label bei ${key} muss ein String sein.` }
    }

    if (fieldConfig.placeholder != null && typeof fieldConfig.placeholder !== 'string') {
      return { ok: false, error: `JSON-Config ist ungueltig: placeholder bei ${key} muss ein String sein.` }
    }

    if (fieldConfig.hint != null && typeof fieldConfig.hint !== 'string') {
      return { ok: false, error: `JSON-Config ist ungueltig: hint bei ${key} muss ein String sein.` }
    }

    if (fieldConfig.readOnly != null && typeof fieldConfig.readOnly !== 'boolean') {
      return { ok: false, error: `JSON-Config ist ungueltig: readOnly bei ${key} muss ein Boolean sein.` }
    }

    if (type === 'wikidata-autosuggest' && fieldConfig.readOnly != null) {
      return {
        ok: false,
        error: `JSON-Config ist ungueltig: readOnly bei ${key} ist fuer wikidata-autosuggest nicht erlaubt.`,
      }
    }

    if (fieldConfig.order != null && !Number.isFinite(fieldConfig.order)) {
      return { ok: false, error: `JSON-Config ist ungueltig: order bei ${key} muss eine Zahl sein.` }
    }

    if (fieldConfig.autosuggest != null && type !== 'wikidata-autosuggest') {
      return {
        ok: false,
        error: `JSON-Config ist ungueltig: autosuggest bei ${key} ist nur fuer wikidata-autosuggest erlaubt.`,
      }
    }

    if (fieldConfig.autosuggest != null && !isPlainObject(fieldConfig.autosuggest)) {
      return {
        ok: false,
        error: `JSON-Config ist ungueltig: autosuggest bei ${key} muss ein Objekt sein.`,
      }
    }

    if (isPlainObject(fieldConfig.autosuggest) && fieldConfig.autosuggest.prefillWith != null) {
      if (typeof fieldConfig.autosuggest.prefillWith !== 'string') {
        return {
          ok: false,
          error: `JSON-Config ist ungueltig: autosuggest.prefillWith bei ${key} muss ein String sein.`,
        }
      }

      const prefillWith = fieldConfig.autosuggest.prefillWith.trim()
      if (!prefillWith) continue

      if (!Object.prototype.hasOwnProperty.call(configPayload.fields, prefillWith)) {
        return {
          ok: false,
          error: `JSON-Config ist ungueltig: autosuggest.prefillWith bei ${key} verweist auf ein fehlendes Feld (${prefillWith}).`,
        }
      }

      const prefillSourceType = configPayload.fields[prefillWith]?.type ?? 'normal'
      if (prefillSourceType !== 'normal') {
        return {
          ok: false,
          error: `JSON-Config ist ungueltig: autosuggest.prefillWith bei ${key} muss auf ein normales String-Feld verweisen.`,
        }
      }
    }

    if (isPlainObject(fieldConfig.autosuggest) && fieldConfig.autosuggest.alsoGetDataFrom != null) {
      const alsoGetDataFrom = fieldConfig.autosuggest.alsoGetDataFrom

      if (typeof alsoGetDataFrom === 'string') {
        const normalized = alsoGetDataFrom.trim()
        if (normalized && !/^P\d+$/i.test(normalized)) {
          return {
            ok: false,
            error: `JSON-Config ist ungueltig: autosuggest.alsoGetDataFrom bei ${key} muss eine gueltige Property-ID sein (z. B. P31).`,
          }
        }
      } else if (Array.isArray(alsoGetDataFrom)) {
        for (const entry of alsoGetDataFrom) {
          const propertyId =
            typeof entry === 'string'
              ? entry
              : typeof entry?.propertyId === 'string'
                ? entry.propertyId
                : typeof entry?.property === 'string'
                  ? entry.property
                  : ''

          if (typeof entry !== 'string' && !isPlainObject(entry)) {
            return {
              ok: false,
              error: `JSON-Config ist ungueltig: autosuggest.alsoGetDataFrom bei ${key} muss nur Strings oder Objekte enthalten.`,
            }
          }

          if (isPlainObject(entry) && entry.label != null && typeof entry.label !== 'string') {
            return {
              ok: false,
              error: `JSON-Config ist ungueltig: autosuggest.alsoGetDataFrom.label bei ${key} muss ein String sein.`,
            }
          }

          if (isPlainObject(entry) && entry.propertyLabel != null && typeof entry.propertyLabel !== 'string') {
            return {
              ok: false,
              error: `JSON-Config ist ungueltig: autosuggest.alsoGetDataFrom.propertyLabel bei ${key} muss ein String sein.`,
            }
          }

          const normalized = String(propertyId || '').trim()
          if (normalized && !/^P\d+$/i.test(normalized)) {
            return {
              ok: false,
              error: `JSON-Config ist ungueltig: autosuggest.alsoGetDataFrom bei ${key} muss gueltige Property-IDs enthalten (z. B. P31).`,
            }
          }
        }
      } else {
        return {
          ok: false,
          error: `JSON-Config ist ungueltig: autosuggest.alsoGetDataFrom bei ${key} muss ein String oder ein Array sein.`,
        }
      }
    }
  }

  return { ok: true }
}
