<script setup>
import { ref, computed, watch, nextTick, provide } from 'vue'
import { nextEvents } from './data/locations.js'
import MapComponent from './components/MapComponent.vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

// Composables
import { useKonami }        from './composables/useKonami.js'
import { useEventListener } from './composables/useEventListener.js'
import { useWeather }       from './composables/useWeather.js'

// provide/inject key
import { MAP_CONTEXT_KEY } from './mapContext.js'

//  OPENWEATHERMAP API KEY
//  the key is precised in src/config.js
const _cfgModules = import.meta.glob('./config.js', { eager: true })
const _cfg = _cfgModules['./config.js'] ?? {}
const OWM_API_KEY = _cfg.OWM_API_KEY ?? ''

//  SPLASH
const splashDone    = ref(false)
const splashLeaving = ref(false)

function enterApp() {
  splashLeaving.value = true
  startMusicOnEnter()
  setTimeout(() => { splashDone.value = true }, 600)
}

//  CORE STATE
const theMapComponent  = ref()
const selectedLocation = ref(null)
const dates            = ref()
const selectedCountry  = ref('')
const sidebarOpen      = ref(true)

// ── Easter eggs 
const showStarWars = ref(false)
const swCanvas     = ref(null)

watch(showStarWars, async (val) => {
  if (!val) return
  await nextTick()
  const canvas = swCanvas.value
  if (!canvas) return
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000008'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const tiers = [
  { count: 300, minR: 0.3, maxR: 0.8, minA: 0.3, maxA: 0.7 },
  { count: 150, minR: 0.8, maxR: 1.3, minA: 0.6, maxA: 0.9 },
  { count:  50, minR: 1.3, maxR: 2.2, minA: 0.85, maxA: 1.0 },
  ]
  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      const r = tier.minR + Math.random() * (tier.maxR - tier.minR)
      const a = tier.minA + Math.random() * (tier.maxA - tier.minA)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`
      ctx.fill()
    }
  }
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    ctx.beginPath()
    ctx.arc(x, y, 0.9 + Math.random() * 0.8, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(180,210,255,${(0.5 + Math.random() * 0.5).toFixed(2)})`
    ctx.fill()
  }
})

// useKonami composable: replaces the raw keydown listener + index state
useKonami(() => { showStarWars.value = true })

// useEventListener composable: handles Enter-to-skip-splash cleanly,
// with automatic cleanup on unmount (no memory leak).
useEventListener(window, 'keydown', (e) => {
  if (e.key === 'Enter' && !splashDone.value) enterApp()
  
  // Single shared buffer for all keyword shortcuts
  _helpBuf += e.key.toLowerCase()
  clearTimeout(_helpTimer)
  _helpTimer = setTimeout(() => { _helpBuf = '' }, 1200)
  
  if (_helpBuf.endsWith('brr'))  { toggleSnow();          _helpBuf = '' }
  if (_helpBuf.endsWith('help')) { showHelp.value = true; _helpBuf = '' }
})


// Footer popup 
const showPopup    = ref(false)
const popupZooming = ref(false)

// Confetti - pre-generated stable data ; appears when filter is "reset"
const confettiActive = ref(false)
const CONFETTI_COLORS = ['#c8a45a','#6da898','#b85858','#ede8dc','#a07040']
const confettiPieces = Array.from({ length: 60 }, (_, i) => ({
  left:  (Math.random() * 100).toFixed(2) + '%',
  delay: (Math.random() * 1.4).toFixed(3) + 's',
  bg:    CONFETTI_COLORS[i % 5],
  w:     (6 + Math.random() * 8).toFixed(1) + 'px',
  h:     (6 + Math.random() * 8).toFixed(1) + 'px',
}))

// Mode Neige 
const snowActive = ref(false)
const snowPieces = Array.from({ length: 80 }, (_, i) => ({
  left:     (Math.random() * 100).toFixed(2) + '%',
  delay:    (Math.random() * 8).toFixed(2) + 's',
  duration: (4 + Math.random() * 6).toFixed(2) + 's',
  size:     (4 + Math.random() * 6).toFixed(1) + 'px',
  drift:    (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 30).toFixed(1),
}))

function toggleSnow() {
  snowActive.value = !snowActive.value
  document.body.classList.toggle('snow-mode', snowActive.value)
}

// "help" modal
const showHelp   = ref(false)
let   _helpBuf   = ''
let   _helpTimer = null

// Music player state
const musicPlaying  = ref(false)
const musicError    = ref(null)
let audioEl = null

function _initAudio() {
  if (audioEl) return
  audioEl = new Audio('/audio/bg-music.mp3')
  audioEl.loop = true
  audioEl.volume = 0.4
  audioEl.addEventListener('error', () => {
    musicError.value = 'Fichier audio introuvable — déposez un .mp3 dans public/audio/'
    musicPlaying.value = false
  })
}

// Called by enterApp — starts music as soon as the user clicks/presses
// Enter on the splash screen. The browser allows play() here because it
// is triggered directly by a user gesture (click or keypress).
function startMusicOnEnter() {
  try {
    _initAudio()
    audioEl.play().then(() => {
      musicPlaying.value = true
    }).catch(() => {
      // Silently ignore if browser blocks it - user can click the button
    })
  } catch (_) {}
}

function toggleMusic() {
  try {
    _initAudio()
    if (musicPlaying.value) {
      audioEl.pause()
      musicPlaying.value = false
    } else {
      musicError.value = null
      audioEl.play().then(() => {
        musicPlaying.value = true
      }).catch(err => {
        musicError.value = `Lecture bloquée : ${err.message}`
        musicPlaying.value = false
      })
    }
  } catch (err) {
    console.error('[music]', err)
    musicError.value = err.message
  }
}


//  HELPERS
function fmt(date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const firstDate = computed(() => fmt(nextEvents[0].date))
const lastDate  = computed(() => fmt(nextEvents[nextEvents.length - 1].date))


//  NEXT-30-DAYS INDICATOR
//  computed + watch showcase
const eventsInNext30Days = computed(() => {
  const now   = new Date()
  const limit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  now.setHours(0, 0, 0, 0)
  return nextEvents.filter(ev => ev.date >= now && ev.date <= limit).length
})

watch(eventsInNext30Days, (val) => {
  console.log(`[AWA] ${val} événement(s) dans les 30 prochains jours.`)
})

//  filtes
const countryNames = {
  FR:'France', CH:'Suisse', IT:'Italie', CA:'Canada', US:'États-Unis',
  JP:'Japon', KR:'Corée du Sud', DE:'Allemagne', AT:'Autriche', BG:'Bulgarie',
  AD:'Andorre', ES:'Espagne', NO:'Norvège', SE:'Suède',
}

const countries = computed(() => {
  const codes = [...new Set(nextEvents.map(e => e.country).filter(Boolean))].sort()
  return codes.map(c => ({ code: c, name: countryNames[c] || c }))
})

const filteredEvents = computed(() => {
  let evs = nextEvents
  const range = dates.value
  if (range?.[0] && range?.[1]) {
    const s = new Date(range[0]); s.setHours(0,0,0,0)
    const e = new Date(range[1]); e.setHours(23,59,59,999)
    evs = evs.filter(ev => ev.date >= s && ev.date <= e)
  }
  if (selectedCountry.value) evs = evs.filter(ev => ev.country === selectedCountry.value)
  return evs
})

const filterActive = computed(() => !!(dates.value?.[0] || selectedCountry.value))

function applyFilter() {
  theMapComponent.value?.createMarkers(filteredEvents.value)
}

watch(dates, () => {
  applyFilter()
  filteredEvents.value.length ? selectEvent(filteredEvents.value[0]) : (selectedLocation.value = null)
})
watch(selectedCountry, () => { applyFilter(); selectedLocation.value = null })

function clearFilter() {
  dates.value          = null
  selectedCountry.value = ''
  selectedLocation.value = null
  applyFilter()
  launchConfetti()
}

function selectEvent(ev) {
  selectedLocation.value = ev
  if (ev?.marker) theMapComponent.value?.changeSelectedMarker(ev.marker)
}

//  MARKER SELECTION (event emitted from child MapComponent)
function onMarkerSelected(location) {
  selectedLocation.value = location
}

//  WEATHER (OpenWeatherMap + fetch)
//
//  watchEffect inside useWeather automatically re-fetches whenever selectedLocation changes - so no manual watch() call is needed
//
//  weatherCoords is a computed that maps selectedLocation {lat, lon} which is what useWeather watches internally via watchEffect
// ══════════════════════════════════════════════════════════════
const weatherCoords = computed(() =>
selectedLocation.value
? { lat: selectedLocation.value.lat, lon: selectedLocation.value.lon }
: null
)

const { weather, loading: weatherLoading, error: weatherError } = useWeather(weatherCoords, OWM_API_KEY)

watch(splashDone, async (val) => {
  if (val) {
    await nextTick()
    theMapComponent.value?.createMarkers(nextEvents)
  }
})

//  confetti
function launchConfetti() {
  confettiActive.value = true
  setTimeout(() => { confettiActive.value = false }, 3200)
}

//  Team footer - has our names + cities
const teamMembers = [
{ key:'p1', name:'👆 Ruohan', city:'Panzhihua', emoji:'🐼', lat:26.582347, lon:101.718637, zoom:13 },
{ key:'p2', name:'👆 Oksana', city:'Kyiv', emoji:'🌻', lat:50.450001, lon:30.523333, zoom:13 },
]
const currentMember = computed(() => teamMembers.find(m => m.key === showPopup.value) ?? null)

function openPopup(m) {
  showPopup.value    = m.key
  popupZooming.value = true
  theMapComponent.value?.flyTo(m.lat, m.lon, m.zoom)
  setTimeout(() => { popupZooming.value = false }, 1400)
}
function closePopup() {
  showPopup.value = false
  theMapComponent.value?.createMarkers(filteredEvents.value)
}

//  provide / inject
//  We expose key reactive state to any descendant component via provide(), using a Symbol key from mapContext.js.
//  Any child can call inject(MAP_CONTEXT_KEY) to get this object
//
//  To simpligy, MapComponent uses it to read filteredEvents count for the cluster badge label, without App having to pass a prop
// ══════════════════════════════════════════════════════════════
provide(MAP_CONTEXT_KEY, {
  filteredEvents,
  selectedLocation,
  selectEvent,
  totalEvents: nextEvents.length,
  applyFilter,
})
</script>

<template>
  
  <!-- splash screen  -->
  <Transition v-if="!splashDone" name="splash-up">
    <div
    class="splash"
    :class="{ leaving: splashLeaving }"
    @click="enterApp"
    >
    <div class="splash-scanlines" aria-hidden="true"></div>
    
    <div class="splash-gif-wrap">
      <img src="/images/dancing.gif" alt="dancing cat" class="splash-gif" />
    </div>
    
    <div class="splash-body">
      <p class="splash-pre">— AWA · 2026 · Ruohan & Oksana —</p>
      <h1 class="splash-title">TP n° 7</h1>
      <p class="splash-sub">Visualisation d'événements futurs</p>
      
      <button class="splash-btn" @click.stop="enterApp">
        [ APPUYER ]
      </button>
      <p class="splash-hint">Pour une expérience optimale, activer le son</p>
    </div>
    
    <span class="c tl">┌</span>
    <span class="c tr">┐</span>
    <span class="c bl">└</span>
    <span class="c br">┘</span>
  </div>
</Transition>

<!--main APPLICATION ! -->
<div v-else class="shell">
  
  <!-- our Star Wars easter egg -->
  <Transition name="fade">
    <div v-if="showStarWars" class="sw-overlay" @click="showStarWars = false">
      <canvas class="sw-stars" ref="swCanvas" aria-hidden="true"></canvas>
      <div class="sw-vignette" aria-hidden="true"></div>
      <div class="sw-scroll">
        <p class="sw-ep">Episode VII</p>
        <h2 class="sw-title">THE FORCE<br>OF GEO-MAPPING</h2>
        <p>A long time ago, in a university far, far away…<br>
          two brave padawans tackled the mysteries<br>
          of the Vue.js Composition API.</p>
          <p>Armed with Leaflet, a DatePicker, and lots<br>
            of enthusiasm, they charted<br>
            the ski resorts of the galaxy.</p>
            <p>Their professor - a wise Jedi Master of AWA -<br>
              watched from the shadows.</p>
              <p>May the map be with you.</p>
              <p style="margin-top:56px;font-size:0.75em;opacity:.5">(click to close)</p>
            </div>
          </div>
        </Transition>
        
        <!-- confetti -->
        <div v-if="confettiActive" class="confetti-wrap" aria-hidden="true">
          <span
          v-for="(p, i) in confettiPieces" :key="i"
          class="confetti-piece"
          :style="{
            left:           p.left,
            animationDelay: p.delay,
            background:     p.bg,
            width:          p.w,
            height:         p.h,
          }"
          />
        </div>
        
        <!-- neige-->
        <div v-if="snowActive" class="snow-wrap" aria-hidden="true">
          <span
          v-for="(p, i) in snowPieces" :key="i"
          class="snowflake"
          :style="{
            left:            p.left,
            animationDelay:  p.delay,
            animationDuration: p.duration,
            width:           p.size,
            height:          p.size,
            '--drift':       p.drift + 'px',
          }"
          >❄</span>
        </div>
        
        
        <!--help popup -->
        <Transition name="fade">
          <div v-if="showHelp" class="help-overlay" @click.self="showHelp = false">
            <div class="help-modal">
              <div class="help-titlebar">
                <span class="help-title">C:\GEOMAS\AIDE.EXE</span>
                <button class="help-close" @click="showHelp = false">■</button>
              </div>
              <div class="help-body">
                <p class="help-prompt">C:\> <span class="help-cursor">_</span></p>
                
                <div class="help-qa">
                  <p class="help-q">&gt; Vous avez des questions ?</p>
                  <p class="help-a">On ne sait pas. Demandez les CCI.<br>On est en GEOMAS.</p>
                  <img src="/images/about/img1.jpg" alt="" class="help-img" onerror="this.style.display='none'" />
                </div>
                
                <div class="help-qa">
                  <p class="help-q">&gt; C'est quoi cci ?</p>
                  <p class="help-a">Le geomas qui ne sait pas faire des cartes.</p>
                  <img src="/images/about/img2.jpg" alt="" class="help-img" onerror="this.style.display='none'" />
                </div>
                
                <div class="help-qa">
                  <p class="help-q">&gt; Pourquoi je ris ? Pourquoi je code ?</p>
                  <p class="help-a"></p>
                  <img src="/images/about/img3.gif" alt="" class="help-img" onerror="this.style.display='none'" />
                </div>
                
                <div class="help-qa">
                  <p class="help-q">&gt; État du projet</p>
                  <p class="help-a">We are doing our best. ?</p>
                  <img src="/images/about/img4.gif" alt="" class="help-img" onerror="this.style.display='none'" />
                  
                  <img src="/images/about/pegasus1.gif" alt="" class="help-img" onerror="this.style.display='none'" />
                  <p class="help-a">La fin.</p>
                </div>
                
                <div class="help-shortcuts">
                  <p class="help-section">RACCOURCIS CLAVIER</p>
                  <table class="help-table">
                    <tr><td>↑↑↓↓←→←→BA</td><td>Easter egg Star Wars</td></tr>
                    <tr><td>Brr</td><td>Mode neige ❄</td></tr>
                    <tr><td>HELP (tapez)</td><td>Cette fenêtre</td></tr>
                    <tr><td>↵ ENTRÉE</td><td>Passer le splash</td></tr>
                  </table>
                </div>
                
                <p class="help-prompt" style="margin-top:16px">C:\> <span class="help-cursor">_</span></p>
              </div>
            </div>
          </div>
        </Transition>
        
        <!-- City popup -->
        <Transition name="pop">
          <div v-if="showPopup" class="city-popup">
            <button class="popup-close" @click="closePopup">✕</button>
            <div class="popup-emoji">{{ currentMember?.emoji }}</div>
            <div class="popup-name">{{ currentMember?.name }}</div>
            <div class="popup-city">vient de {{ currentMember?.city }}</div>
            <div v-if="popupZooming" class="popup-zoom">» zoom en cours…</div>
          </div>
        </Transition>
        
        <!-- header-->
        <header class="hdr">
          <div class="hdr-left">
            <p class="hdr-pre">✦ PROCHAINS EVENEMENTS 2026 ✦</p>
            <h1
            class="hdr-title"
            :class="{ 'hdr-title--jitter': filterActive && filteredEvents.length === 0 }"
            >
            WORLD SKI EVENTS
            <span v-if="filterActive" class="badge badge--filter">● FILTRE ACTIF</span>
            <span v-else              class="badge">{{ filteredEvents.length }} résultats</span>
          </h1>
          <p class="hdr-sub">du {{ firstDate }} au {{ lastDate }}</p>
          
          <div v-if="eventsInNext30Days > 0" class="next30">
            <span class="next30-dot">◆</span>
            <span>
              <b>{{ eventsInNext30Days }}</b> événement{{ eventsInNext30Days > 1 ? 's' : '' }}
              dans les 30 prochains jours
            </span>
          </div>
        </div>
        
        <div class="hdr-controls">
          <!-- Date picker -->
          <div class="ctrl-card">
            <label class="ctrl-lbl">PERIODE</label>
            <VueDatePicker v-model="dates" range :dark="true" class="dp" />
          </div>
          
          <!-- Country filter -->
          <div class="ctrl-card">
            <label class="ctrl-lbl">PAYS</label>
            <div class="ctrl-row">
              <select v-model="selectedCountry" class="retro-sel">
                <option value="">Tous les pays</option>
                <option v-for="c in countries" :key="c.code" :value="c.code">
                  {{ c.code }} – {{ c.name }}
                </option>
              </select>
              <button class="btn btn--alt" @click="clearFilter">RESET</button>
            </div>
          </div>
        </div>
        
        <!-- Sidebar toggle -->
        <button
        class="sidebar-tog"
        @click="sidebarOpen = !sidebarOpen"
        :title="sidebarOpen ? 'Réduire' : 'Étendre'"
        >
        {{ sidebarOpen ? '▶' : '◀' }}
      </button>
    </header>
    
    <!--MAIN: MAP + SIDEBAR-->
    <div class="content">
      
      <div class="map-area">
        <div class="map-frame">
          <span class="corner tl" aria-hidden="true">┌</span>
          <span class="corner tr" aria-hidden="true">┐</span>
          <span class="corner bl" aria-hidden="true">└</span>
          <span class="corner br" aria-hidden="true">┘</span>
          <MapComponent
          ref="theMapComponent"
          mapId="theMap"
          @marker-selected="onMarkerSelected"
          />
        </div>
      </div>
      
      <!--  Sidebar -->
      <Transition name="slide">
        <aside v-if="sidebarOpen" class="sidebar">
          
          <!-- Selected event -->
          <section class="sb-section">
            <h2 class="sb-title">SELECTIONNE</h2>
            
            <div v-if="selectedLocation" class="sel-card">
              <p class="sel-name">{{ selectedLocation.name }}</p>
              <div class="sel-chips">
                <span class="chip">{{ selectedLocation.country }}</span>
                <span class="chip">{{ fmt(selectedLocation.date) }}</span>
              </div>
              <p class="sel-coords">
                <span class="coord-key">lat</span>{{ selectedLocation.lat.toFixed(4) }}
                <span class="coord-key">lon</span>{{ selectedLocation.lon.toFixed(4) }}
              </p>
              
              <!-- Weather panel - from our weather TP !!
              Shows live weather for the selected location.
              Uses useWeather composable (fetch + watchEffect) + error handling shown inline with v-if/v-else chain-->
              <div class="weather-panel">
                <!-- Loading state -->
                <div v-if="weatherLoading" class="weather-loading">
                  <span class="weather-spinner">◌</span> météo…
                </div>
                
                <!-- API key not configured -->
                <div v-else-if="!OWM_API_KEY" class="weather-na">
                  <span class="weather-na-icon">🌤</span>
                  <span>Ajoutez votre clé OpenWeatherMap<br>dans <code>src/config.js</code></span>
                </div>
                
                <!-- Error state: from gestion des erreurs -->
                <div v-else-if="weatherError" class="weather-err">
                  <span>⚠ {{ weatherError }}</span>
                </div>
                
                <!-- Success state -->
                <div v-else-if="weather" class="weather-data">
                  <div class="weather-main">
                    <img
                    :src="`https://openweathermap.org/img/wn/${weather.icon}.png`"
                    :alt="weather.desc"
                    class="weather-icon"
                    />
                    <span class="weather-temp">{{ weather.temp }}°C</span>
                  </div>
                  <p class="weather-desc">{{ weather.desc }}</p>
                  <div class="weather-details">
                    <span>💨 {{ weather.wind }} km/h</span>
                    <span>💧 {{ weather.humidity }}%</span>
                    <span>🌡 ressenti {{ weather.feels }}°C</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else class="sel-empty">
              <p class="sel-empty-icon">🗺</p>
              <p>Cliquez sur un marqueur</p>
              <p class="sel-empty-hint">ou choisissez dans la liste</p>
            </div>
          </section>
          
          <!-- Results list -->
          <section class="sb-section sb-results">
            <h2 class="sb-title">
              🔍 RÉSULTATS
              <span class="res-count">{{ filteredEvents.length }}</span>
            </h2>
            
            <TransitionGroup
            v-if="filteredEvents.length > 0"
            tag="ul"
            name="list"
            class="res-list"
            >
            <li v-for="ev in filteredEvents" :key="ev.name + ev.date.getTime()">
              <button
              class="res-btn"
              :class="{ 'res-btn--on': selectedLocation === ev }"
              @click="selectEvent(ev)"
              >
              <span class="res-arrow">›</span>
              <span class="res-name">{{ ev.name }}</span>
              <span class="res-date">{{ fmt(ev.date) }}</span>
            </button>
          </li>
        </TransitionGroup>
        
        <div v-else class="res-empty">
          <p class="res-empty-icon">😿</p>
          <p class="res-empty-title">Aucun résultat</p>
          <p class="res-empty-hint">Essayez d'élargir la période<br>ou de changer de pays</p>
          <button class="btn btn--alt" style="margin-top:14px;font-size:0.48rem" @click="clearFilter">
            RÉINITIALISER
          </button>
        </div>
      </section>
      
    </aside>
  </Transition>
</div><!-- /content -->

<!-- FOOTER
in the left column:  names + sources badges + hints like konami code
in the right column : music button-->
<footer class="ftr">
  
  <!-- Left column -->
  <div class="ftr-left">
    <div class="ftr-row">
      <span class="ftr-dim">Made with ♥ by</span>
      <button
      v-for="m in teamMembers"
      :key="m.key"
      class="author-btn"
      @click="openPopup(m)"
      >{{ m.name }}</button>
    </div>
    <div class="ftr-badges">
      <span class="fbadge">Vue 3</span>
      <span class="fbadge">Leaflet</span>
      <span class="fbadge">Composition API</span>
      <span class="fbadge">AWA 2026</span>
    </div>
    <p class="ftr-dim ftr-konami">↑ ↑ ↓ ↓ ← → ← → B A - Essayez Konami code 👀 | Tapez "Brr" pour neige ❄ | "HELP" pour aide</p>
  </div>
  
  <!-- center: two image rows
  row 1 - classic size 88×31 antipixels (public/images/antipixels/)
  Rrw 2 - bigger square stamps up to 100px (public/images/stamps/)
  Images hide themselves if file missing (onerror) -->
  <div class="ftr-center">
    <div class="ftr-antipixels">
      <a href="https://marginalia-search.com/search?query=eye+health&sst=SE-5e934be0cfc57c46"         target="_blank" rel="noopener"><img src="/images/antipixels/vue.gif"    alt="Vue"  class="antipixel" onerror="this.style.display='none'" /></a>
      <a href="https://github.com/m2cci/m2cci-2526-pi-G03/tree/master"     target="_blank" rel="noopener"><img src="/images/antipixels/fun.gif"  alt="BestGroupEver" class="antipixel" onerror="this.style.display='none'" /></a>
      <a href="https://fr.wikipedia.org/wiki/Chronologie_des_observations_d%27ovnis_en_France"          target="_blank" rel="noopener"><img src="/images/antipixels/ufo.gif"     alt="UFO"    class="antipixel" onerror="this.style.display='none'" /></a>
      <a href="https://neal.fun/not-a-robot/" target="_blank" rel="noopener"><img src="/images/antipixels/fic002.gif"      alt="BeepBop"     class="antipixel" onerror="this.style.display='none'" /></a>
      <a href="https://pointerpointer.com/" target="_blank" rel="noopener"><img src="/images/antipixels/proweb_teal2.gif"      alt="oldweb"     class="antipixel" onerror="this.style.display='none'" /></a>
    </div>
    <!-- bigger square stamps -->
    <div class="ftr-stamps">
      <img src="/images/stamps/stamp1.gif" alt="" class="stamp" onerror="this.style.display='none'" />
      <img src="/images/stamps/stamp2.jpg" alt="" class="stamp" onerror="this.style.display='none'" />
      <img src="/images/stamps/stamp4.gif" alt="" class="stamp" onerror="this.style.display='none'" />
      
      <img src="/images/stamps/stamp3.gif" alt="" class="stamp" onerror="this.style.display='none'" />
      
    </div>
  </div>
  
  <!-- Right column :  toggle for snow (Neige) mode  + music player -->
  <div class="ftr-music">
    <button
    class="snow-btn"
    :class="{ 'snow-btn--on': snowActive }"
    @click="toggleSnow"
    title="Mode neige (ou tapez SS)"
    >❄ {{ snowActive ? 'STOP' : 'NEIGE' }}</button>
    <button
    class="music-btn"
    :class="{ 'music-btn--playing': musicPlaying }"
    @click="toggleMusic"
    :title="musicPlaying ? 'Pause musique' : 'Jouer musique'"
    >
    <span class="music-note" aria-hidden="true">{{ musicPlaying ? '⏸' : '♪' }}</span>
    <span class="music-label">{{ musicPlaying ? 'PAUSE' : 'MUSIQUE' }}</span>
    <span v-if="musicPlaying" class="music-bars" aria-hidden="true">
      <span class="bar"></span>
      <span class="bar"></span>
      <span class="bar"></span>
    </span>
  </button>
  <p v-if="musicError" class="music-error">{{ musicError }}</p>
</div>

</footer>

</div><!-- /shell -->

</template>

<style>
/* Global tokens */
:root {
  --cream:   #ede8dc;
  --dim:     #887e6e;
  --bg:      #111009;
  --bg2:     #1a1812;
  --bg3:     #221f17;
  --border:  #302c22;
  --accent:  #c8a45a;
  --accent2: #6da898;
  --red:     #b85858;
  --panel:   rgba(255,248,220,0.03);
}
.dp__theme_dark { --dp-background-color: #1a1812; --dp-border-color: #302c22; }
</style>

<style scoped>

/* SPLASH
*/
.splash {
  position: fixed; inset: 0; z-index: 5000;
  background: var(--bg);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  cursor: pointer; overflow: hidden;
  border: 1px solid var(--border);
}
.splash-scanlines {
  position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(
  to bottom, transparent 0, transparent 3px,
  rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px
  );
  animation: scanmove 10s linear infinite;
}
@keyframes scanmove { to { background-position: 0 100px; } }
.splash-gif-wrap {
  margin-bottom: 28px;
  filter: drop-shadow(0 0 14px var(--accent));
  animation: float 2.4s ease-in-out infinite;
}
@keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
.splash-gif { width: clamp(72px,14vw,128px); image-rendering: pixelated; }
.splash-body { display:flex; flex-direction:column; align-items:center; gap:12px; text-align:center; }
.splash-pre  { font-family:'VT323',monospace; font-size:1.1rem; color:var(--dim); letter-spacing:4px; }
.splash-title {
  font-family:'Press Start 2P',monospace;
  font-size: clamp(1.2rem,5vw,2.6rem);
  color: var(--accent); line-height:1.5;
  animation: glow-pulse 2s ease-in-out infinite;
}
@keyframes glow-pulse {
  0%,100% { text-shadow: 0 0 12px rgba(200,164,90,0.3); }
  50%      { text-shadow: 0 0 28px rgba(200,164,90,0.65); }
}
.splash-sub  { font-family:'VT323',monospace; font-size:1.05rem; color:var(--dim); }
.splash-btn  {
  margin-top:10px;
  font-family:'Press Start 2P',monospace;
  font-size: clamp(0.5rem,1.4vw,0.68rem);
  background:transparent; border:1px solid var(--accent);
  color:var(--accent); padding:12px 24px; border-radius:2px;
  cursor:pointer; letter-spacing:2px;
  animation: blink-border 1.6s step-end infinite;
  transition: background 0.2s, color 0.2s;
}
.splash-btn:hover { background:var(--accent); color:var(--bg); }
@keyframes blink-border { 0%,49%{border-color:var(--accent);} 50%,99%{border-color:transparent;} }
.splash-hint { font-size:0.68rem; color:var(--dim); opacity:0.45; }
.c { position:absolute; font-family:'VT323',monospace; font-size:2rem; color:var(--border); line-height:1; }
.tl{top:14px;left:18px;} .tr{top:14px;right:18px;} .bl{bottom:14px;left:18px;} .br{bottom:14px;right:18px;}
.splash-up-leave-active { transition: transform 0.55s cubic-bezier(.8,0,.2,1), opacity 0.4s; }
.splash-up-leave-to     { transform:translateY(-100%); opacity:0; }

/* 
APP SHELL */
.shell { display:flex; flex-direction:column; height:100vh; overflow:hidden; background:var(--bg); }

/* HEADER */
.hdr {
  flex-shrink:0; display:flex; align-items:center; gap:20px; flex-wrap:wrap;
  padding:10px 18px 8px; border-bottom:1px solid var(--border); background:var(--bg2);
}
.hdr-left { flex-shrink:0; }
.hdr-pre  { font-family:'VT323',monospace; font-size:0.85rem; color:var(--dim); letter-spacing:3px; margin-bottom:1px; }
.hdr-title {
  font-family:'Press Start 2P',monospace;
  font-size: clamp(0.5rem,1.8vw,0.78rem);
  color:var(--accent); display:flex; align-items:center; gap:10px; flex-wrap:wrap; line-height:2;
}
.hdr-sub { font-size:0.75rem; color:var(--dim); margin-top:1px; }
.badge {
  font-family:'VT323',monospace; font-size:0.85rem;
  background:var(--panel); border:1px solid var(--border);
  padding:1px 8px; border-radius:2px; color:var(--dim); letter-spacing:1px;
}
.badge--filter {
  color:var(--red); border-color:var(--red); background:rgba(184,88,88,0.1);
  animation: filter-pulse 1.4s ease-in-out infinite;
}
@keyframes filter-pulse { 0%,100%{opacity:0.7;} 50%{opacity:1;} }
.next30 {
  display:flex; align-items:center; gap:6px; margin-top:4px;
  font-family:'VT323',monospace; font-size:0.95rem; color:var(--accent2); letter-spacing:0.5px;
}
.next30-dot { font-size:0.55rem; animation: dot-blink 1.2s step-end infinite; }
@keyframes dot-blink { 0%,49%{opacity:1;} 50%,100%{opacity:0;} }
.next30 b { color:var(--cream); }
.hdr-controls { display:flex; gap:10px; flex-wrap:wrap; flex:1; min-width:0; align-items:flex-end; }
.ctrl-card {
  background:var(--bg3); border:1px solid var(--border); border-radius:2px;
  padding:7px 12px; display:flex; flex-direction:column; gap:6px; min-width:160px;
}
.ctrl-lbl { font-family:'Press Start 2P',monospace; font-size:0.42rem; color:var(--dim); letter-spacing:1.5px; }
.ctrl-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.retro-sel {
  background:var(--bg2); color:var(--cream); border:1px solid var(--border);
  border-radius:2px; padding:5px 8px; font-family:'Nunito',sans-serif; font-size:0.82rem; cursor:pointer;
}
.retro-sel:focus { outline:1px solid var(--accent); }
.btn {
  font-family:'Press Start 2P',monospace; font-size:0.44rem; padding:6px 12px;
  border:1px solid var(--accent); background:transparent; color:var(--accent);
  border-radius:2px; cursor:pointer; letter-spacing:1px; transition:all 0.12s; white-space:nowrap;
}
.btn:hover { background:var(--accent); color:var(--bg); }
.btn--alt  { border-color:var(--accent2); color:var(--accent2); }
.btn--alt:hover { background:var(--accent2); color:var(--bg); }
.sidebar-tog {
  margin-left:auto; flex-shrink:0;
  background:var(--bg3); border:1px solid var(--border); color:var(--dim);
  padding:5px 11px; border-radius:2px; cursor:pointer; font-size:0.8rem; transition:color 0.15s;
}
.sidebar-tog:hover { color:var(--accent); border-color:var(--accent); }

/* CONTENT */
.content { flex:1; display:flex; overflow:hidden; }
.map-area { flex:1; overflow:hidden; position:relative; }
.map-frame { position:relative; width:100%; height:100%; border:1px solid var(--border); }
.corner {
  position:absolute; z-index:500;
  font-family:'VT323',monospace; font-size:1.4rem; color:var(--accent);
  opacity:0.35; pointer-events:none;
  animation: corner-blink 3s ease-in-out infinite;
}
.tl{top:4px;left:6px;} .tr{top:4px;right:6px;} .bl{bottom:4px;left:6px;} .br{bottom:4px;right:6px;}
@keyframes corner-blink { 0%,100%{opacity:0.25;} 50%{opacity:0.55;} }

/* SIDEBAR */
.sidebar {
  width:272px; flex-shrink:0; display:flex; flex-direction:column;
  background:var(--bg2); border-left:1px solid var(--border); overflow:hidden;
}
.slide-enter-active { transition:width 0.28s ease, opacity 0.25s ease; }
.slide-leave-active { transition:width 0.22s ease, opacity 0.18s ease; }
.slide-enter-from, .slide-leave-to { width:0; opacity:0; }
.sb-section { padding:14px 12px; border-bottom:1px solid var(--border); flex-shrink:0; }
.sb-results { flex:1; overflow:hidden; display:flex; flex-direction:column; border-bottom:none; }
.sb-title {
  font-family:'Press Start 2P',monospace; font-size:0.42rem; color:var(--dim);
  letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px;
  display:flex; align-items:center; gap:8px;
}
.res-count {
  font-family:'VT323',monospace; font-size:0.95rem;
  background:var(--bg3); border:1px solid var(--border);
  border-radius:2px; padding:0 5px; color:var(--accent2); letter-spacing:1px;
}
.sel-card {
  background:var(--bg3); border:1px solid var(--border);
  border-left:3px solid var(--accent); padding:10px 12px; border-radius:2px;
}
.sel-name { font-size:0.92rem; font-weight:700; color:var(--cream); margin-bottom:6px; line-height:1.3; }
.sel-chips { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:6px; }
.chip {
  font-family:'VT323',monospace; font-size:0.85rem;
  background:var(--bg2); border:1px solid var(--border);
  border-radius:2px; padding:1px 7px; color:var(--accent2); letter-spacing:0.5px;
}
.sel-coords { font-family:'VT323',monospace; font-size:0.82rem; color:var(--dim); }
.coord-key { color:var(--accent); margin-right:3px; }
.sel-empty { text-align:center; padding:14px 8px; color:var(--dim); font-size:0.82rem; line-height:1.7; }
.sel-empty-icon { font-size:1.8rem; margin-bottom:6px; }
.sel-empty-hint { font-size:0.72rem; opacity:0.6; }

/* Weather panel */
.weather-panel {
  margin-top:10px; padding-top:10px;
  border-top:1px solid var(--border);
  font-size:0.78rem;
}
.weather-loading {
  color:var(--dim); display:flex; align-items:center; gap:6px;
  font-family:'VT323',monospace; font-size:0.9rem;
}
.weather-spinner { animation: spin 1s linear infinite; display:inline-block; }
@keyframes spin { to { transform:rotate(360deg); } }
.weather-na {
  color:var(--dim); font-size:0.72rem; line-height:1.6;
  display:flex; gap:6px; align-items:flex-start;
}
.weather-na-icon { font-size:1.1rem; flex-shrink:0; }
.weather-na code { color:var(--accent2); font-size:0.68rem; }
.weather-err { color:var(--red); font-size:0.72rem; line-height:1.5; }
.weather-data {}
.weather-main { display:flex; align-items:center; gap:4px; }
.weather-icon { width:32px; height:32px; }
.weather-temp { font-family:'Press Start 2P',monospace; font-size:0.7rem; color:var(--accent); }
.weather-desc { color:var(--dim); font-size:0.72rem; margin:2px 0 5px; text-transform:capitalize; }
.weather-details {
  display:flex; gap:8px; flex-wrap:wrap;
  font-family:'VT323',monospace; font-size:0.85rem; color:var(--accent2);
}

/* Results list */
.res-list {
  list-style:none; padding:0; margin:0; overflow-y:auto; flex:1;
  scrollbar-width:thin; scrollbar-color:var(--border) transparent;
}
.res-btn {
  display:flex; align-items:center; gap:5px; width:100%;
  background:transparent; border:none; color:var(--cream);
  padding:6px 8px; font-family:'Nunito',sans-serif; font-size:0.8rem;
  cursor:pointer; border-radius:2px; text-align:left; transition:background 0.12s;
}
.res-btn:hover { background:var(--bg3); }
.res-btn--on { background:rgba(200,164,90,0.1); border-left:2px solid var(--accent); color:var(--accent); }
.res-arrow { color:var(--dim); font-size:0.7rem; flex-shrink:0; }
.res-name  { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.res-date  { color:var(--dim); font-size:0.72rem; flex-shrink:0; margin-left:auto; padding-left:4px; }
.list-enter-active { transition:opacity 0.22s ease, transform 0.22s ease; }
.list-leave-active { transition:opacity 0.14s ease, transform 0.14s ease; position:absolute; }
.list-enter-from { opacity:0; transform:translateX(-10px); }
.list-leave-to   { opacity:0; transform:translateX( 10px); }
.list-move       { transition:transform 0.22s ease; }
.res-empty { text-align:center; padding:24px 10px; color:var(--dim); line-height:1.8; }
.res-empty-icon  { font-size:2rem; margin-bottom:8px; animation:shake .5s; }
@keyframes shake { 0%,100%{transform:translateX(0);} 25%,75%{transform:translateX(-3px);} 50%{transform:translateX(3px);} }
.res-empty-title { color:var(--cream); font-weight:700; font-size:0.9rem; }
.res-empty-hint  { font-size:0.76rem; }

/* FOOTER */
.ftr {
  flex-shrink:0; border-top:1px solid var(--border); background:var(--bg2);
  padding:8px 18px;
  display:flex; align-items:center; gap:16px; flex-wrap:wrap;
}
.ftr-left { display:flex; flex-direction:column; gap:5px; }
.ftr-row  { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ftr-dim  { font-size:0.78rem; color:var(--dim); }
.author-btn {
  font-family:'Press Start 2P',monospace; font-size:0.70rem;
  background:transparent; border:1px solid var(--accent); color:var(--accent);
  padding:4px 10px; border-radius:2px; cursor:pointer; letter-spacing:1px; transition:all 0.15s;
}
.author-btn:hover { background:var(--accent); color:var(--bg); transform:scale(1.06); }
.ftr-badges { display:flex; gap:5px; flex-wrap:wrap; }
.fbadge {
  font-family:'VT323',monospace; font-size:0.82rem;
  border:1px solid var(--border); border-radius:2px; padding:1px 6px;
  color:var(--dim); background:var(--panel);
  animation: fbadge-flicker 7s ease-in-out infinite;
}
.fbadge:nth-child(2){animation-delay:1.5s;} .fbadge:nth-child(3){animation-delay:3s;} .fbadge:nth-child(4){animation-delay:0.8s;}
@keyframes fbadge-flicker { 0%,100%{opacity:0.4;} 50%{opacity:0.9;color:var(--accent);border-color:var(--accent);} }
.ftr-konami { font-size:0.72rem; opacity:0.75; }

/* antipixels-related */
.ftr-antipixels {
  display:flex; align-items:center; gap:4px; flex-wrap:wrap;
  flex:1;
}
.antipixel {
  display:block; width:88px; height:31px;
  image-rendering:pixelated;
  border:1px solid var(--border);
  opacity:0.75; transition:opacity 0.15s, border-color 0.15s;
}
.antipixel:hover { opacity:1; border-color:var(--accent); }

/* music player button */
.ftr-music { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
.music-btn {
  display:flex; align-items:center; gap:6px;
  font-family:'Press Start 2P',monospace; font-size:0.42rem;
  background:var(--bg3); border:1px solid var(--border);
  color:var(--dim); padding:6px 12px; border-radius:2px;
  cursor:pointer; letter-spacing:1px; transition:all 0.15s;
  white-space:nowrap;
}
.music-btn:hover { border-color:var(--accent2); color:var(--accent2); }
.music-btn--playing { border-color:var(--accent2); color:var(--accent2); background:rgba(109,168,152,0.08); }
.music-note  { font-size:0.9rem; }
.music-label { font-size:0.52rem; }
.music-bars  { display:flex; align-items:flex-end; gap:2px; height:10px; }
.music-bars .bar {
  width:3px; background:var(--accent2); border-radius:1px;
  animation: bar-dance 0.6s ease-in-out infinite alternate;
}
.music-bars .bar:nth-child(1){height:4px; animation-delay:0s;}
.music-bars .bar:nth-child(2){height:8px; animation-delay:0.15s;}
.music-bars .bar:nth-child(3){height:5px; animation-delay:0.3s;}
@keyframes bar-dance { to { height:10px; } }
.music-error {
  font-size:0.62rem; color:var(--red); max-width:200px;
  text-align:right; line-height:1.4;
}

/*OVERLAYS: popup for city, star wars, confetti */
.city-popup {
  position:fixed; bottom:70px; right:22px; z-index:1000;
  background:var(--bg2); border:1px solid var(--accent); border-radius:2px;
  padding:18px 22px; box-shadow:0 0 24px rgba(200,164,90,0.2);
  text-align:center; min-width:160px;
}
.popup-close { position:absolute; top:7px; right:10px; background:none; border:none; color:var(--dim); cursor:pointer; font-size:0.8rem; }
.popup-close:hover { color:var(--accent); }
.popup-emoji { font-size:2rem; margin-bottom:6px; }
.popup-name  { font-family:'Press Start 2P',monospace; font-size:0.62rem; color:var(--accent); margin-bottom:3px; }
.popup-city  { font-family:'VT323',monospace; font-size:1rem; color:var(--accent2); }
.popup-zoom  { font-family:'VT323',monospace; font-size:0.85rem; color:var(--dim); margin-top:6px; animation:blink .6s step-end infinite; }
@keyframes blink { 50%{opacity:0;} }

.sw-overlay {
  position:fixed; inset:0; z-index:2000; overflow:hidden;
  display:flex; align-items:flex-end; justify-content:center;
  perspective:300px;
  background:#000008;
}
.sw-stars {
  position:absolute; inset:0; width:100%; height:100%;
  pointer-events:none; z-index:0;
}
.sw-overlay .sw-vignette {
  position:absolute; bottom:0; left:0; right:0; height:35%;
  background: linear-gradient(to top, #000008 0%, transparent 100%);
  pointer-events:none; z-index:1;
}
.sw-scroll {
  position:relative; z-index:2;
  width:60%; max-width:500px; transform-origin:bottom center;
  transform:rotateX(25deg); animation:sw-roll 28s linear; padding-bottom:80px;
}
.sw-ep    { text-align:center; font-family:'VT323',monospace; font-size:1rem; color:#888; margin-bottom:10px; }
.sw-title { font-family:'Press Start 2P',monospace; font-size:1.6rem; color:#c8a45a; text-align:center; line-height:1.6; margin-bottom:20px; }
.sw-scroll p { font-family:'VT323',monospace; font-size:1.2rem; color:#c8a45a; text-align:justify; line-height:1.8; margin-bottom:14px; }
@keyframes sw-roll { from{transform:rotateX(25deg) translateY(120%);} to{transform:rotateX(25deg) translateY(-320%);} }

.confetti-wrap  { position:fixed; inset:0; pointer-events:none; z-index:1500; overflow:hidden; }
.confetti-piece { position:absolute; top:-20px; border-radius:2px; animation:confetti-fall 2.6s ease-in forwards; }
@keyframes confetti-fall { 0%{transform:translateY(0) rotate(0deg);opacity:1;} 100%{transform:translateY(105vh) rotate(540deg);opacity:0;} }

.fade-enter-active,.fade-leave-active{transition:opacity 0.35s;}
.fade-enter-from,.fade-leave-to{opacity:0;}
.pop-enter-active{animation:pop-in 0.35s;}
.pop-leave-active{animation:pop-in 0.18s reverse;}
@keyframes pop-in{0%{transform:scale(0.6);opacity:0;}70%{transform:scale(1.05);opacity:1;}100%{transform:scale(1);}}

/* Snow mode*/
.snow-wrap { position:fixed; inset:0; pointer-events:none; z-index:1400; overflow:hidden; }
.snowflake {
  position:absolute; top:-20px;
  color:#ede8dc; font-size:inherit; opacity:0.8;
  animation: snow-fall var(--dur, 6s) linear infinite;
  user-select:none; pointer-events:none;
}
/* custom property --drift controls horizontal wobble for the snow */
@keyframes snow-fall {
  0%   { transform: translateY(0)      translateX(0);           opacity: 0.9; }
  50%  { transform: translateY(50vh)   translateX(var(--drift)); opacity: 0.7; }
  100% { transform: translateY(110vh)  translateX(0);           opacity: 0; }
}


/* 
TITLE JITTER (0 results) this will look fun when you select dates with 0 results, kinda like  an old-style-glith*/
.hdr-title--jitter { animation: jitter 0.5s ease-in-out; }
@keyframes jitter {
  0%,100%{ transform:translateX(0); }
  10%    { transform:translateX(-6px) rotate(-1deg); }
  20%    { transform:translateX(6px)  rotate(1deg); }
  30%    { transform:translateX(-8px) rotate(-1.5deg); }
  40%    { transform:translateX(8px)  rotate(1.5deg); }
  50%    { transform:translateX(-5px); }
  60%    { transform:translateX(5px); }
  70%    { transform:translateX(-3px); }
  80%    { transform:translateX(3px); }
  90%    { transform:translateX(-1px); }
}

/* 
SNOW BUTTON */
.snow-btn {
  font-family:'Press Start 2P',monospace; font-size:0.42rem;
  background:var(--bg3); border:1px solid var(--border);
  color:var(--dim); padding:5px 10px; border-radius:2px;
  cursor:pointer; letter-spacing:1px; transition:all 0.15s;
  white-space:nowrap; margin-bottom:4px;
}
.snow-btn:hover { border-color:var(--cream); color:var(--cream); }
.snow-btn--on   { border-color:#ede8dc; color:#ede8dc; background:rgba(237,232,220,0.07); }

/* FOOTER STAMPS (bigger square images) */
.ftr-center   { display:flex; flex-direction:column; gap:5px; flex:1; }
.ftr-stamps   { display:flex; align-items:flex-end; gap:5px; flex-wrap:wrap; }
.stamp {
  display:block;
  width: auto; height:auto;
  max-width:100px; max-height:100px;
  min-width:40px; min-height:40px;
  object-fit:contain;
  image-rendering:pixelated;
  border:1px solid var(--border);
  opacity:0.8; transition:opacity 0.15s, border-color 0.15s;
}
.stamp:hover { opacity:1; border-color:yellow; }

/* HELP / ABOUT MODAL - styled to look kinda like an old terminal */
.help-overlay {
  position:fixed; inset:0; z-index:3000;
  background:rgba(0,0,0,0.82);
  display:flex; align-items:center; justify-content:center;
  padding:20px;
}
.help-modal {
  background:#0a0a0a; border:2px solid var(--accent);
  max-width:600px; width:100%; max-height:85vh;
  display:flex; flex-direction:column;
  font-family:'VT323',monospace;
  box-shadow: 0 0 40px rgba(200,164,90,0.25);
}
.help-titlebar {
  background:var(--accent); color:var(--bg);
  display:flex; justify-content:space-between; align-items:center;
  padding:3px 8px; flex-shrink:0;
}
.help-title  { font-family:'Press Start 2P',monospace; font-size:0.5rem; letter-spacing:1px; }
.help-close  {
  background:var(--bg3); border:1px solid var(--bg); color:var(--accent);
  font-family:'Press Start 2P',monospace; font-size:0.4rem;
  padding:2px 6px; cursor:pointer; line-height:1.4;
}
.help-close:hover { background:var(--red); color:#fff; }
.help-body { padding:16px 18px; overflow-y:auto; flex:1; color:var(--cream); }
.help-prompt { font-size:1rem; color:var(--accent2); margin-bottom:12px; }
.help-cursor { animation:blink .8s step-end infinite; }
@keyframes blink { 50%{opacity:0;} }
.help-qa { margin-bottom:18px; }
.help-q  { font-size:1.1rem; color:var(--accent); margin-bottom:4px; }
.help-a  { font-size:1rem; color:var(--cream); line-height:1.5; margin-bottom:8px; }
.help-img {
  display:block;
  width:150px; height:150px;
  object-fit:cover;
  image-rendering:pixelated;
  border:1px solid var(--border);
  margin-top:6px;
}
.help-section { font-size:0.85rem; color:var(--accent2); letter-spacing:2px; margin-bottom:6px; border-bottom:1px solid var(--border); padding-bottom:4px; }
.help-shortcuts { margin-top:14px; }
.help-table { border-collapse:collapse; width:100%; font-size:0.95rem; }
.help-table td { padding:3px 10px 3px 0; color:var(--dim); vertical-align:top; }
.help-table tr td:first-child { color:var(--accent); font-size:0.85rem; white-space:nowrap; min-width:140px; }
</style>

