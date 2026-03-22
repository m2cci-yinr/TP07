<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { nextEvents } from './data/locations.js'
import MapComponent from './components/MapComponent.vue'
import { VueDatePicker } from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css'

const theMapComponent = ref();     // référence vers le composant MapComponent
const selectedLocation = ref(null)
const dates = ref()
const selectedCountry = ref('')

function formateDate(date) {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const firstDate = computed(() => {
  return formateDate(nextEvents[0].date);
});

const lastDate = computed(() => {
  return formateDate(nextEvents[nextEvents.length - 1].date);
});

function onMarkerSelected(location) {
  // location === null when user clicks on the base map (MapManager already passes null)
  selectedLocation.value = location
}

onMounted(function () {
  theMapComponent.value.createMarkers(nextEvents)
});

// unique list of country codes from data, used for the selector
const countryNames = {
  FR: 'France',
  CH: 'Switzerland',
  IT: 'Italy',
  CA: 'Canada',
  US: 'United States',
  JP: 'Japan',
  KR: 'South Korea',
  DE: 'Germany',
  AT: 'Austria',
  BG: 'Bulgaria',
  AD: 'Andorra',
  ES: 'Spain',
  NO: 'Norway',
  SE: 'Sweden'
}

const countries = computed(() => {
  const codes = Array.from(new Set(nextEvents.map(e => e.country).filter(Boolean))).sort()
  return codes.map(c => ({ code: c, name: countryNames[c] || c }))
})

// filter events according to chosen date range and selected country
const filteredEvents = computed(() => {
  const range = dates.value
  let events = nextEvents
  if (range && range[0] && range[1]) {
    const start = new Date(range[0])
    start.setHours(0, 0, 0, 0)
    const end = new Date(range[1])
    end.setHours(23, 59, 59, 999)
    events = events.filter(ev => (ev.date >= start && ev.date <= end))
  }
  if (selectedCountry.value) {
    events = events.filter(ev => ev.country === selectedCountry.value)
  }
  return events
})

// apply filter when the user clicks the button
function applyFilter() {
  if (theMapComponent.value) {
    theMapComponent.value.createMarkers(filteredEvents.value)
  }
}

// when the date range changes, automatically apply the filter
watch(dates, (newVal) => {
  applyFilter()
  // default select first result when available
  const list = filteredEvents.value
  if (list && list.length) {
    selectEvent(list[0])
  } else {
    selectedLocation.value = null
  }
})

function selectEvent(ev) {
  selectedLocation.value = ev
  // if the map component has been initialized and markers exist, highlight the marker
  if (theMapComponent.value && ev && ev.marker) {
    theMapComponent.value.changeSelectedMarker(ev.marker)
  }
}

</script>

<template>
  <header class="app-header">
    <h1 class="title">Visualisez nos prochains événements
      <span class="badge">({{ filteredEvents.length }} lieux affichés)</span>
    </h1>
    <div class="subtitle">prévus du {{ firstDate }} au {{ lastDate }}</div>
  </header>

  <div class="controls">
    <div class="control-row">
      <label><b>Choisir une période&nbsp;:</b></label>
      <VueDatePicker v-model="dates" range />
    </div>

    <div class="control-row">
      <label><b>Filtrer par pays&nbsp;:</b></label>
      <select v-model="selectedCountry">
        <option value="">Tous les pays</option>
        <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.code }} - {{ c.name }}</option>
      </select>
      <button @click="applyFilter">Filtrer</button>
    </div>

  </div>

  <MapComponent ref="theMapComponent" mapId="theMap" @marker-selected="onMarkerSelected"></MapComponent>

  <div class="selection">
    <div class="selected-box">
      <div style="font-size: 20px;"><b>Événement sélectionné</b></div>
      <template v-if="selectedLocation">
        <ul>
          <li> <b>Lieu:</b> {{ selectedLocation.name }}</li>
          <li> <b>Date:</b> {{ formateDate(selectedLocation.date) }}</li>
        </ul>
      </template>
      <template v-else>
        <div>Aucun lieu sélectionné</div>
      </template>
    </div>

    <div class="results-list">
      <div style="font-weight:600; margin-top:8px">Lieux correspondant au filtre</div>
      <ul>
        <li v-for="(ev, idx) in filteredEvents" :key="idx">
          <button class="result-btn" @click="selectEvent(ev)">
            {{ ev.name }} — {{ formateDate(ev.date) }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.controls {
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.app-header {
  margin-bottom: 12px;
}
.title {
  font-size: 1.6rem;
  margin: 0;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 10px;
}
.subtitle {
  color: #555;
  font-size: 0.95rem;
  margin-top: 6px;
}
.badge {
  font-size: 0.85rem;
  background: rgba(0,0,0,0.06);
  padding: 4px 8px;
  border-radius: 12px;
  color: #222;
}
.selected-box {
  border: 1px solid rgba(0,0,0,0.06);
  padding: 8px;
  border-radius: 6px;
}
.results-list ul {
  list-style: none;
  padding: 0;
  margin: 6px 0 0 0;
  max-height: 180px;
  overflow: auto;
}
.result-btn {
  background: transparent;
  border: none;
  text-align: left;
  padding: 6px 8px;
  width: 100%;
  cursor: pointer;
}
.result-btn:hover {
  background: rgba(0,0,0,0.03);
}
</style>

