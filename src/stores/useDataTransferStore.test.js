import { afterEach, describe, expect, test } from 'vitest'
import { useDataTransferStore } from './useDataTransferStore'

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')

function setSessionStorage(getter) {
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: getter })
}

afterEach(() => {
  if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor)
  else delete globalThis.sessionStorage
  useDataTransferStore().setDataMode('json')
})

describe('useDataTransferStore', () => {
  test('remembers the data mode in sessionStorage', () => {
    const stored = new Map()
    setSessionStorage(() => ({ getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) }))
    const store = useDataTransferStore()

    expect(store.setDataMode('csv')).toBe(true)
    expect([...stored.values()]).toEqual(['csv'])
    store.dataMode.value = 'json'
    store.loadDataModeFromSession()
    expect(store.dataMode.value).toBe('csv')
  })

  test('keeps working when the browser blocks site storage', () => {
    setSessionStorage(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    const store = useDataTransferStore()

    expect(() => store.loadDataModeFromSession()).not.toThrow()
    expect(store.setDataMode('csv')).toBe(true)
    expect(store.dataMode.value).toBe('csv')
  })
})
