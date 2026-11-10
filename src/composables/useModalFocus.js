// Focus handling of a modal dialog: on open, remember the focused element and focus the first
// control in the dialog; keep Tab inside the dialog; on close, give focus back.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * @param {object} options `isOpen()` getter; `onOpen()` runs before the first control is focused
 *   (e.g. to reset the form). Returns `modalRef` (bind to the dialog element) and `trapFocus`
 *   (bind to its `keydown`).
 */
export function useModalFocus({ isOpen, onOpen = () => {} }) {
  const modalRef = ref(null)
  let previouslyFocusedElement = null

  function getFocusableElements() {
    if (!modalRef.value) return []
    return Array.from(modalRef.value.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (element) => element instanceof HTMLElement && element.getClientRects().length > 0,
    )
  }

  function focusFirstElement() {
    const [first] = getFocusableElements()
    if (first) {
      first.focus()
      return
    }
    modalRef.value?.focus()
  }

  function restorePreviousFocus() {
    if (previouslyFocusedElement instanceof HTMLElement && previouslyFocusedElement.isConnected) {
      previouslyFocusedElement.focus()
    }
    previouslyFocusedElement = null
  }

  function wrapFocus(event, focusableElements) {
    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]
    const active = document.activeElement
    const leavesAtStart = event.shiftKey && (active === first || active === modalRef.value)
    const leavesAtEnd = !event.shiftKey && active === last
    if (leavesAtStart) {
      event.preventDefault()
      last.focus()
    } else if (leavesAtEnd) {
      event.preventDefault()
      first.focus()
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab' || !modalRef.value) return
    const focusableElements = getFocusableElements()
    if (!focusableElements.length) {
      event.preventDefault()
      modalRef.value.focus()
      return
    }
    wrapFocus(event, focusableElements)
  }

  watch(isOpen, async (open, wasOpen) => {
    if (open) {
      if (document.activeElement instanceof HTMLElement) previouslyFocusedElement = document.activeElement
      onOpen()
      await nextTick()
      focusFirstElement()
      return
    }
    if (wasOpen) {
      await nextTick()
      restorePreviousFocus()
    }
  })

  onBeforeUnmount(restorePreviousFocus)

  return { modalRef, trapFocus }
}
