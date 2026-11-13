// True when a field value counts as filled: non-blank string, non-empty array or object, any other
// non-null value. Decides "edited" via the `markAsEditedBasis` field, which online fields are sent and
// whether two values count as equal in the save conflict check.
export function hasNonEmptyValue(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}
