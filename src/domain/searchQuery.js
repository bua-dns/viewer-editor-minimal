// Shared rules for the list search, used by the local filter and by the collection-wide search.

// A query filters only from this many characters on (after trimming).
export const MIN_SEARCH_QUERY_LENGTH = 3

export function normalizeSearchQuery(query) {
  return String(query ?? '').trim().toLowerCase()
}

export function isSearchQueryActive(query) {
  return normalizeSearchQuery(query).length >= MIN_SEARCH_QUERY_LENGTH
}

// Whitespace-separated, lowercased tokens; empty when the query is too short to filter.
export function tokenizeSearchQuery(query) {
  if (!isSearchQueryActive(query)) return []
  return normalizeSearchQuery(query).split(/\s+/).filter(Boolean)
}
