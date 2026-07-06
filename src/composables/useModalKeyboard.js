import { onBeforeUnmount, onMounted } from 'vue'

export function useModalKeyboard({ isOpen, onClose }) {
  function onKeydown(event) {
    if (!isOpen() || event.key !== 'Escape') return
    event.stopPropagation()
    onClose()
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
  })
}
