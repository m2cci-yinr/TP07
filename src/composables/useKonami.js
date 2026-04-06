/**
 * useKonami - Composition API composable
 *
 * Encapsulates the Konami-code detection logic so App.vue doesn't need to manage raw event listeners or index state directly.
 *
 * usage:
 * const { triggered } = useKonami(() => { showStarWars.value = true })
 *
 * Basically this extracts statefulbrowser-event logic that would otherwise clutter the component
 */

import { ref, onMounted, onUnmounted } from 'vue'

const KONAMI_SEQUENCE = [
  'ArrowUp','ArrowUp','ArrowDown','ArrowDown',
  'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight',
  'b','a',
]

/**
 * @param {Function} onSuccess  callback fired when the full sequence is entered
 * @returns {{ triggered: Ref<boolean> }}
 */
export function useKonami(onSuccess) {
  const triggered = ref(false)
  let idx = 0

  function handleKey(e) {
    if (e.key === KONAMI_SEQUENCE[idx]) {
      idx++
      if (idx === KONAMI_SEQUENCE.length) {
        triggered.value = true
        idx = 0
        onSuccess?.()
      }
    } else {
      idx = 0
    }
  }

  // useEventListener pattern - see useEventListener.js
  onMounted(()   => window.addEventListener('keydown', handleKey))
  onUnmounted(() => window.removeEventListener('keydown', handleKey))

  return { triggered }
}
