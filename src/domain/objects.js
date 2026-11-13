/** A non-null, non-array object, e.g. a parsed JSON object. */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
