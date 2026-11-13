import { hasNonEmptyValue } from './valueChecks'

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(String(value))
  }
  return JSON.stringify(value ?? null)
}

/**
 * Compares two field values the way the server stores them: empty values (null, '', [], {})
 * are equal, numbers equal their string form, and object key order does not matter.
 */
export function isSameOnlineValue(left, right) {
  const leftIsEmpty = !hasNonEmptyValue(left)
  const rightIsEmpty = !hasNonEmptyValue(right)
  if (leftIsEmpty || rightIsEmpty) return leftIsEmpty && rightIsEmpty
  return stableStringify(left) === stableStringify(right)
}

/**
 * Returns the keys of `sentFields` that someone else changed on the server since the values in
 * `baselineFields` were loaded. A key is in conflict when the server value matches neither the
 * loaded value nor the value about to be sent. Keys without a baseline or without a server value
 * cannot be checked and are skipped.
 */
export function findConflictingFields({ sentFields, baselineFields, serverItem }) {
  return Object.keys(sentFields).filter((key) => {
    if (!Object.prototype.hasOwnProperty.call(baselineFields, key)) return false
    if (!Object.prototype.hasOwnProperty.call(serverItem, key)) return false

    const serverValue = serverItem[key]
    const isUnchangedOnServer = isSameOnlineValue(serverValue, baselineFields[key])
    const isAlreadyOurValue = isSameOnlineValue(serverValue, sentFields[key])
    return !isUnchangedOnServer && !isAlreadyOurValue
  })
}
