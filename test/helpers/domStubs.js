// Browser APIs that jsdom lacks but App.vue uses on mount (sticky header metrics, dialogs).
// Call installDomStubs() in beforeEach of a `@vitest-environment jsdom` test file and keep the
// returned `restore` for afterEach.
import { vi } from 'vitest'
import { createLocalStorageMock } from './storageMock'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

export function installDomStubs({ confirmAnswer = true } = {}) {
  const originals = {
    ResizeObserver: globalThis.ResizeObserver,
    confirm: globalThis.confirm,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
  }
  globalThis.ResizeObserver = ResizeObserverStub
  globalThis.confirm = vi.fn(() => confirmAnswer)
  Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true })
  Object.defineProperty(globalThis, 'sessionStorage', { value: createLocalStorageMock(), configurable: true })

  return function restore() {
    globalThis.ResizeObserver = originals.ResizeObserver
    globalThis.confirm = originals.confirm
    Object.defineProperty(globalThis, 'localStorage', { value: originals.localStorage, configurable: true })
    Object.defineProperty(globalThis, 'sessionStorage', { value: originals.sessionStorage, configurable: true })
  }
}

/** Puts `file` into a file input and fires `change`, as a user's pick in the file dialog does. */
export function chooseFile(input, file) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
