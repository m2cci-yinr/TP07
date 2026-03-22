<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { nextEvents } from './data/locations.js'
import MapComponent from './components/MapComponent.vue'
import { VueDatePicker } from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css'

// ── Refs ────────────────────────────────────────────────────
const theMapComponent = ref()
const selectedLocation = ref(null)
const dates = ref()
const selectedCountry = ref('')

// Easter egg: Konami code tracker
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']
const konamiProgress = ref(0)
const showStarWars = ref(false)

// Footer popup state
const showPopup = ref(false)    // which popup is shown: 'Ruohan' | 'Oksana' | false
const popupZooming = ref(false)

// Confetti state
const confettiActive = ref(false)

// ── Helpers ─────────────────────────────────────────────────
function formateDate(date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const firstDate = computed(() => formateDate(nextEvents[0].date))
const lastDate  = computed(() => formateDate(nextEvents[nextEvents.length - 1].date))

// ── Marker selection ─────────────────────────────────────────
function onMarkerSelected(location) {
  selectedLocation.value = location
}

onMounted(() => {
  theMapComponent.value.createMarkers(nextEvents)

  // Konami code listener
  window.addEventListener('keydown', e => {
    if (e.key === KONAMI[konamiProgress.value]) {
      konamiProgress.value++
      if (konamiProgress.value === KONAMI.length) {
        showStarWars.value = true
        konamiProgress.value = 0
      }
    } else {
      konamiProgress.value = 0
    }
  })
})

// ── Country list ─────────────────────────────────────────────
const countryNames = {
  FR:'France', CH:'Switzerland', IT:'Italy', CA:'Canada', US:'United States',
  JP:'Japan', KR:'South Korea', DE:'Germany', AT:'Austria', BG:'Bulgaria',
  AD:'Andorra', ES:'Spain', NO:'Norway', SE:'Sweden'
}
const countries = computed(() => {
  const codes = Array.from(new Set(nextEvents.map(e => e.country).filter(Boolean))).sort()
  return codes.map(c => ({ code: c, name: countryNames[c] || c }))
})

// ── Filtering ────────────────────────────────────────────────
const filteredEvents = computed(() => {
  const range = dates.value
  let events = nextEvents
  if (range && range[0] && range[1]) {
    const start = new Date(range[0]); start.setHours(0,0,0,0)
    const end   = new Date(range[1]); end.setHours(23,59,59,999)
    events = events.filter(ev => ev.date >= start && ev.date <= end)
  }
  if (selectedCountry.value) {
    events = events.filter(ev => ev.country === selectedCountry.value)
  }
  return events
})

function applyFilter() {
  if (theMapComponent.value) theMapComponent.value.createMarkers(filteredEvents.value)
}

watch(dates, () => {
  applyFilter()
  const list = filteredEvents.value
  if (list?.length) selectEvent(list[0])
  else selectedLocation.value = null
})

watch(selectedCountry, () => applyFilter())

function clearFilter() {
  dates.value = null
  selectedCountry.value = ''
  applyFilter()
  launchConfetti()
}

function selectEvent(ev) {
  selectedLocation.value = ev
  if (theMapComponent.value && ev?.marker) theMapComponent.value.changeSelectedMarker(ev.marker)
}

// ── haha fun confetti  cute right ! ─────────────────────────────────────────────────
function launchConfetti() {
  confettiActive.value = true
  setTimeout(() => confettiActive.value = false, 3000)
}

// ── Footer popups with our map zoom ──────────────────────────────
// Ruohan → Panzhihua  |  Oksana → Kyiv
//  we can change name, lat, lon, city as needed !!!
const teamMembers = [
  { key: 'ruohan', name: 'Ruohan', city: 'Panzhihua',  emoji: '🐼', lat: 26.5823, lon: 101.7187, zoom: 13 },
  { key: 'oksana', name: 'Oksana', city: 'Kyiv', emoji: '🌻', lat: 50.4504, lon: 30.5245,  zoom: 13 },
]

function openPopup(member) {
  showPopup.value = member.key
  popupZooming.value = true
  // fly the map to their city
  if (theMapComponent.value) {
    theMapComponent.value.flyTo(member.lat, member.lon, member.zoom)
  }
  setTimeout(() => popupZooming.value = false, 1200)
}

function closePopup() {
  showPopup.value = false
  // restore full markers view
  if (theMapComponent.value) theMapComponent.value.createMarkers(filteredEvents.value)
}

const currentMember = computed(() => teamMembers.find(m => m.key === showPopup.value) || null)
</script>

<template>
  <!-- ── Star Wars Easter Egg overlay ── -->
  <Transition name="fade">
    <div v-if="showStarWars" class="starwars-overlay" @click="showStarWars = false">
      <div class="starwars-scroll">
        <div class="starwars-text">
          <p class="starwars-ep">Episode VII</p>
          <h2 class="starwars-title">THE FORCE OF<br>GEO-MAPPING</h2>
          <p>
            A long time ago, in a university far, far away...
            two brave padawans tackled the mysteries of the
            Vue.js Composition API.
          </p>
          <p>
            Armed with Leaflet, a Vue DatePicker, and an
            unhealthy amount of caffeine, they set out to
            chart the ski resorts of the galaxy.
          </p>
          <p>
            Their professor, a wise Jedi Master of AWA,
            watched from the shadows...
            awaiting a passing grade worthy of the Force.
          </p>
          <p>May your markers always be red. 🔴</p>
          <p style="margin-top:60px; font-size:0.8em; color:#aaa">
            (click anywhere to close)
          </p>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── Confetti ── -->
  <div v-if="confettiActive" class="confetti-wrap" aria-hidden="true">
    <span v-for="i in 60" :key="i" class="confetti-piece"
      :style="{
        left: Math.random() * 100 + '%',
        animationDelay: Math.random() * 1.5 + 's',
        background: ['#ff79c6','#bd93f9','#8be9fd','#f1fa8c','#50fa7b','#ffb86c'][i % 6],
        width:  (8 + Math.random() * 8) + 'px',
        height: (8 + Math.random() * 8) + 'px',
      }"
    />
  </div>

  <!-- ── City popup ── -->
  <Transition name="popup-bounce">
    <div v-if="showPopup" class="city-popup">
      <button class="city-popup-close" @click="closePopup">✕</button>
      <div class="city-popup-emoji">{{ currentMember?.emoji }}</div>
      <div class="city-popup-title">{{ currentMember?.name }}</div>
      <div class="city-popup-city">is from {{ currentMember?.city }}!</div>
      <div v-if="popupZooming" class="city-popup-zoom">🗺️ Zooming in…</div>
    </div>
  </Transition>

  <!-- ── Header ── -->
  <header class="app-header">
    <div class="header-deco" aria-hidden="true">✦ ✧ ✦ ✧ ✦</div>
    <h1 class="title">
      <span class="title-pixel">⛷ NEXT EVENTS 2026</span>
      <span class="badge">{{ filteredEvents.length }} spots</span>
    </h1>
    <div class="subtitle">
      🗓 du <b>{{ firstDate }}</b> au <b>{{ lastDate }}</b>
    </div>
    <div class="header-deco small-hint" aria-hidden="true">
      ↑↑↓↓←→←→BA &nbsp;(try it 👀)
    </div>
  </header>

  <!-- ── Controls ── -->
  <section class="controls">
    <div class="control-card">
      <label class="control-label">🗓 Choisir une période</label>
      <VueDatePicker v-model="dates" range :dark="true" class="datepicker" />
    </div>

    <div class="control-card">
      <label class="control-label">🌍 Filtrer par pays</label>
      <div class="control-row">
        <select v-model="selectedCountry" class="retro-select">
          <option value="">✦ Tous les pays</option>
          <option v-for="c in countries" :key="c.code" :value="c.code">
            {{ c.code }} – {{ c.name }}
          </option>
        </select>
        <button class="retro-btn" @click="applyFilter">⚡ Filtrer</button>
        <button class="retro-btn clear-btn" @click="clearFilter">🎉 Clear</button>
      </div>
    </div>
  </section>

  <!-- ── Map ── -->
  <div class="map-wrap">
    <div class="map-corner tl">✦</div>
    <div class="map-corner tr">✦</div>
    <div class="map-corner bl">✦</div>
    <div class="map-corner br">✦</div>
    <MapComponent ref="theMapComponent" mapId="theMap" @marker-selected="onMarkerSelected" />
  </div>

  <!-- ── Selection + results ── -->
  <section class="selection">
    <div class="selected-box">
      <div class="box-title">📍 Événement sélectionné</div>
      <template v-if="selectedLocation">
        <div class="selected-name">{{ selectedLocation.name }}</div>
        <div class="selected-meta">
          <span class="chip">🌐 {{ selectedLocation.country }}</span>
          <span class="chip">📅 {{ formateDate(selectedLocation.date) }}</span>
        </div>
      </template>
      <template v-else>
        <div class="no-selection">Cliquez sur un marqueur 👆</div>
      </template>
    </div>

    <div class="results-list">
      <div class="box-title">🔍 Résultats du filtre</div>
      <ul>
        <li v-for="(ev, idx) in filteredEvents" :key="idx">
          <button class="result-btn" @click="selectEvent(ev)">
            <span class="result-dot">▶</span>
            {{ ev.name }} <span class="result-date">{{ formateDate(ev.date) }}</span>
          </button>
        </li>
        <li v-if="!filteredEvents.length" class="no-results">
          Aucun résultat 😢
        </li>
      </ul>
    </div>
  </section>

  <!-- ── Footer ── -->
  <footer class="app-footer">
    <div class="footer-webring">
      ✦ &nbsp;
      <span class="webring-link">⟨ prev</span>
      &nbsp;[&nbsp;<span class="webring-link">WEBRING</span>&nbsp;]&nbsp;
      <span class="webring-link">next ⟩</span>
      &nbsp; ✦
    </div>
    <div class="footer-made">
      Made with 💖 by
      <button
        v-for="m in teamMembers" :key="m.key"
        class="author-btn"
        @click="openPopup(m)"
        :style="{ '--glow': m.key === 'anne' ? 'var(--pink)' : 'var(--cyan)' }"
      >{{ m.name }}</button>
    </div>
    <div class="footer-hint">🤫 try the konami code</div>
    <div class="footer-badges">
      <span class="badge-retro">Made with Vue 3</span>
      <span class="badge-retro">Leaflet 🗺</span>
      <span class="badge-retro">Best viewed at 1920×1080</span>
      <span class="badge-retro">✦ AWA 2026 ✦</span>
    </div>
  </footer>
</template>

<style>
/* ── Import base ─────────────────────────────────────────── */
:root {
  --pink:   #ff79c6;
  --purple: #bd93f9;
  --cyan:   #8be9fd;
  --yellow: #f1fa8c;
  --green:  #50fa7b;
  --orange: #ffb86c;
  --bg:     #0d0d1a;
  --panel:  rgba(255,255,255,0.05);
  --border: rgba(255,255,255,0.14);
  --text:   #f8f8f2;
  --muted:  #a0a0c0;
}

/* ── DatePicker override for dark theme ─────────────────── */
.dp__theme_dark { --dp-background-color: #1a1a2e; }
</style>

<style scoped>
/* ── Layout ─────────────────────────────────────────────── */
.app-header {
  text-align: center;
  padding: 32px 16px 16px;
}
.header-deco {
  font-family: 'VT323', monospace;
  font-size: 1.4rem;
  color: var(--purple);
  letter-spacing: 6px;
  margin-bottom: 8px;
}
.header-deco.small-hint {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 10px;
  letter-spacing: 2px;
  opacity: 0.6;
}
.title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}
.title-pixel {
  font-family: 'Press Start 2P', monospace;
  font-size: clamp(0.7rem, 2.5vw, 1.1rem);
  background: linear-gradient(90deg, var(--pink), var(--purple), var(--cyan));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: hue-shift 4s linear infinite;
  text-shadow: none;
  line-height: 1.6;
}
@keyframes hue-shift {
  0%   { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}
.badge {
  font-family: 'VT323', monospace;
  font-size: 1.1rem;
  background: var(--panel);
  border: 1px solid var(--border);
  padding: 4px 12px;
  border-radius: 20px;
  color: var(--yellow);
  -webkit-text-fill-color: var(--yellow);
}
.subtitle {
  font-size: 0.9rem;
  color: var(--muted);
  margin-top: 8px;
}
.subtitle b { color: var(--cyan); }

/* ── Controls ───────────────────────────────────────────── */
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 0 24px 20px;
  justify-content: center;
}
.control-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 240px;
}
.control-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  color: var(--purple);
  letter-spacing: 1px;
  text-transform: uppercase;
}
.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.retro-select {
  background: #1a1a2e;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  font-family: var(--body);
  font-size: 0.85rem;
  cursor: pointer;
}
.retro-select:focus { outline: 2px solid var(--purple); }

.retro-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  padding: 8px 14px;
  border: 2px solid var(--purple);
  background: transparent;
  color: var(--purple);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.retro-btn:hover {
  background: var(--purple);
  color: #0d0d1a;
  box-shadow: 0 0 16px var(--purple);
  transform: scale(1.05);
}
.clear-btn { border-color: var(--pink); color: var(--pink); }
.clear-btn:hover { background: var(--pink); color: #0d0d1a; box-shadow: 0 0 16px var(--pink); }

/* ── Map wrap ────────────────────────────────────────────── */
.map-wrap {
  position: relative;
  margin: 0 24px;
  border: 2px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 0 40px rgba(189,147,249,0.15), inset 0 0 30px rgba(0,0,0,0.4);
}
.map-corner {
  position: absolute;
  z-index: 500;
  font-size: 1.2rem;
  color: var(--purple);
  animation: corner-pulse 2s ease-in-out infinite;
  pointer-events: none;
}
.tl { top: 8px;  left: 10px; }
.tr { top: 8px;  right: 10px; }
.bl { bottom: 8px; left: 10px; }
.br { bottom: 8px; right: 10px; }
@keyframes corner-pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 1;   }
}

/* ── Selection + results ────────────────────────────────── */
.selection {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 20px 24px;
}
.selected-box, .results-list {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 18px;
  flex: 1 1 240px;
}
.box-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  color: var(--cyan);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.selected-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--pink);
  margin-bottom: 8px;
}
.selected-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  font-size: 0.8rem;
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 3px 10px;
  color: var(--yellow);
}
.no-selection {
  color: var(--muted);
  font-style: italic;
  font-size: 0.9rem;
}

.results-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--purple) transparent;
}
.result-btn {
  background: transparent;
  border: none;
  color: var(--text);
  text-align: left;
  padding: 6px 8px;
  width: 100%;
  cursor: pointer;
  font-family: var(--body);
  font-size: 0.85rem;
  border-radius: 6px;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.result-btn:hover { background: rgba(255,255,255,0.06); }
.result-dot { color: var(--purple); font-size: 0.65rem; }
.result-date { color: var(--muted); font-size: 0.78rem; margin-left: auto; }
.no-results { padding: 8px; color: var(--muted); font-style: italic; font-size: 0.85rem; }

/* ── Footer ─────────────────────────────────────────────── */
.app-footer {
  text-align: center;
  padding: 28px 16px 20px;
  border-top: 1px solid var(--border);
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}
.footer-webring {
  font-family: 'VT323', monospace;
  font-size: 1.2rem;
  color: var(--purple);
  letter-spacing: 2px;
}
.webring-link {
  color: var(--cyan);
  cursor: pointer;
  transition: color 0.2s;
}
.webring-link:hover { color: var(--pink); }

.footer-made {
  font-size: 0.9rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}
.author-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  background: transparent;
  border: 2px solid var(--glow, var(--pink));
  color: var(--glow, var(--pink));
  padding: 5px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}
.author-btn:hover {
  background: var(--glow, var(--pink));
  color: #0d0d1a;
  box-shadow: 0 0 20px var(--glow, var(--pink));
  transform: scale(1.08) rotate(-2deg);
}

.footer-hint {
  font-size: 0.72rem;
  color: var(--muted);
  opacity: 0.5;
  font-style: italic;
}

.footer-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 4px;
}
.badge-retro {
  font-family: 'VT323', monospace;
  font-size: 0.9rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  color: var(--muted);
  background: var(--panel);
  animation: badge-flicker 6s ease-in-out infinite;
}
.badge-retro:nth-child(2) { animation-delay: 1.2s; }
.badge-retro:nth-child(3) { animation-delay: 2.5s; }
.badge-retro:nth-child(4) { animation-delay: 0.7s; }
@keyframes badge-flicker {
  0%,100% { opacity: 0.6; }
  50%      { opacity: 1; color: var(--yellow); border-color: var(--yellow); }
}

/* ── City popup ─────────────────────────────────────────── */
.city-popup {
  position: fixed;
  bottom: 90px;
  right: 28px;
  z-index: 1000;
  background: #1a1a2e;
  border: 2px solid var(--pink);
  border-radius: 16px;
  padding: 22px 28px;
  box-shadow: 0 0 40px rgba(255,121,198,0.4);
  text-align: center;
  min-width: 180px;
}
.city-popup-close {
  position: absolute;
  top: 8px; right: 12px;
  background: none; border: none;
  color: var(--muted); font-size: 1rem;
  cursor: pointer;
}
.city-popup-close:hover { color: var(--pink); }
.city-popup-emoji { font-size: 2.4rem; margin-bottom: 6px; }
.city-popup-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.75rem;
  color: var(--pink);
  margin-bottom: 4px;
}
.city-popup-city { color: var(--cyan); font-size: 0.9rem; }
.city-popup-zoom {
  font-size: 0.75rem;
  color: var(--yellow);
  margin-top: 8px;
  animation: blink 0.6s step-end infinite;
}
@keyframes blink { 50% { opacity: 0; } }

/* ── Star Wars overlay ──────────────────────────────────── */
.starwars-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  perspective: 300px;
  cursor: pointer;
}
.starwars-scroll {
  width: 60%;
  max-width: 520px;
  transform-origin: bottom center;
  transform: rotateX(25deg);
  animation: sw-scroll 30s linear;
  padding-bottom: 80px;
}
.starwars-text {
  color: #ffe81f;
  font-family: 'VT323', monospace;
  font-size: 1.4rem;
  line-height: 1.9;
  text-align: justify;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.starwars-ep {
  text-align: center;
  font-size: 1.1rem;
  color: #aaa;
}
.starwars-title {
  text-align: center;
  font-size: 2rem;
  color: #ffe81f;
  font-family: 'Press Start 2P', monospace;
  line-height: 1.5;
}
@keyframes sw-scroll {
  from { transform: rotateX(25deg) translateY(120%); }
  to   { transform: rotateX(25deg) translateY(-300%); }
}

/* ── Confetti ───────────────────────────────────────────── */
.confetti-wrap {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1500;
  overflow: hidden;
}
.confetti-piece {
  position: absolute;
  top: -20px;
  border-radius: 3px;
  animation: confetti-fall 2.5s ease-in forwards;
}
@keyframes confetti-fall {
  0%   { transform: translateY(0)    rotate(0deg);   opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}

/* ── Transitions ────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.popup-bounce-enter-active { animation: bounce-in 0.4s; }
.popup-bounce-leave-active { animation: bounce-in 0.2s reverse; }
@keyframes bounce-in {
  0%   { transform: scale(0.5); opacity: 0; }
  70%  { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); }
}
</style>
