/**
 * useEventListener - Composition API composable
 * A generic wrapper around addEventListener / removeEventListener that automatically cleans up when the component is unmounted.
 */

import { onMounted, onUnmounted, isRef } from 'vue'

/**
 * @param {EventTarget | Ref<EventTarget>} target
 * @param {string}   event    event name, e.g. 'keydown'
 * @param {Function} handler  event callback
 * @param {object}   [options] optional addEventListener options
 */
export function useEventListener(target, event, handler, options) {
  // Resolve Vue Refs so callers can pass template refs directly
  const getTarget = () => isRef(target) ? target.value : target

  onMounted(() => {
    const el = getTarget()
    el?.addEventListener(event, handler, options)
  })

  onUnmounted(() => {
    const el = getTarget()
    el?.removeEventListener(event, handler, options)
  })
}
