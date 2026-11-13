function trimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** `/api/x?y#z/` → `/api/x`, so collection paths from settings, rules and profiles compare reliably. */
export function normalizeCollectionPath(path) {
  const withoutQuery = trimmedString(path).split('#')[0].split('?')[0]
  return withoutQuery.replace(/\/+$/, '')
}

/** True when both paths name the same collection (query, fragment and trailing slashes ignored). */
export function sameCollectionPath(left, right) {
  return normalizeCollectionPath(left) === normalizeCollectionPath(right)
}
