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
  }

  return { ok: true }
}
