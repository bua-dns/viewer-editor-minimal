function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeEntity(candidate) {
  if (!isPlainObject(candidate)) return null
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
  if (!id) return null
  const label = typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label : id
  return {
    ...candidate,
    id,
    label,
  }
}

function createEntityFromString(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!/^Q\d+$/i.test(normalized)) return null
  const id = normalized.toUpperCase()
  return { id, label: id }
}

function dedupeByEntityId(entities) {
  const seen = new Set()
  return entities.filter((entity) => {
    if (seen.has(entity.id)) return false
    seen.add(entity.id)
    return true
  })
}

export function normalizeWikidataAutosuggestValue(value) {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeEntity(entry))
      .filter(Boolean)
    return dedupeByEntityId(normalized)
  }

  if (isPlainObject(value)) {
    const entity = normalizeEntity(value)
    return entity ? [entity] : []
  }

  const entityFromString = createEntityFromString(value)
  return entityFromString ? [entityFromString] : []
}
