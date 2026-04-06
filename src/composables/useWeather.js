/**
 * useWeather - Composition API composable
 *
 * Fetches current weather for a lat/lon pair using the OpenWeatherMap API.
 * Includes:
 *   • "using APIs Web with fetch" (like what we did in TP on weather)
 *   • Error handling with try/catch in Vue (like the TP on weather + errors)
 *   • watchEffect - automatically re-fetches whenever the coordinates change
 * (no need to manually call the function; watchEffect tracks its own deps)
 *
 * The API key is defined in src/config.js 
 * + that file is gitignored (so we never commit our keys)
 * 
 * If no key is provided the composable returns an "unavailable" state
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   const coords = ref({ lat: 45.19, lon: 5.73 })
 *   const { weather, loading, error } = useWeather(coords)
 *
 *   // weather.value = {
 *   //   temp: 4,           °C
 *   //   feels: 1,
 *   //   desc: 'neige légère',
 *   //   icon: '13d',       OWM icon code
 *   //   wind: 12,          km/h
 *   //   humidity: 78,      %
 *   //   city: 'Méribel'
 *   // }
 */

import { ref, watchEffect } from 'vue'

const BASE = 'https://api.openweathermap.org/data/2.5/weather'

/**
 * @param {Ref<{lat:number, lon:number} | null>} coordsRef  reactive coords
 * @param {string} apiKey  OpenWeatherMap API key
 * @returns {{ weather: Ref, loading: Ref<boolean>, error: Ref<string|null> }}
 */
export function useWeather(coordsRef, apiKey) {
  const weather = ref(null)
  const loading = ref(false)
  const error   = ref(null)

  /**
   * watchEffect:
   *   - Runs immediately on creation (no { immediate: true } needed)
   *   - Automatically tracks reactive dependencies read inside it
   *   - Re-runs whenever coordsRef.value changes
   *   - Much cleaner than watch(coords, fetch, { immediate: true })
   *
   * Difference bewteen watchEffect and watch :
   *   watch()      - we specify WHAT to watch
   *   watchEffect  - it figures out WHAT it reads and watches that
   */
  watchEffect(async () => {
    const coords = coordsRef.value
    if (!coords || !apiKey) {
      weather.value = null
      return
    }

    loading.value = true
    error.value   = null

    try {
      const url = `${BASE}?lat=${coords.lat}&lon=${coords.lon}&units=metric&lang=fr&appid=${apiKey}`
      const res = await fetch(url)

      // Error handling - for gestion des exceptions
      if (!res.ok) {
        // HTTP errors (401 bad key, 429 rate limit, etc.) are not thrown by fetch -
        // we must check res.ok manually and throw ourselves.
        throw new Error(`OpenWeatherMap API error ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      weather.value = {
        temp:     Math.round(data.main.temp),
        feels:    Math.round(data.main.feels_like),
        desc:     data.weather[0].description,
        icon:     data.weather[0].icon,
        wind:     Math.round(data.wind.speed * 3.6), // m/s → km/h
        humidity: data.main.humidity,
        city:     data.name,
      }
    } catch (err) {
      // Catches both network errors (fetch threw) and our manual throws above
      console.error('[useWeather]', err)
      error.value = err.message
      weather.value = null
    } finally {
      loading.value = false
    }
  })

  return { weather, loading, error }
}
