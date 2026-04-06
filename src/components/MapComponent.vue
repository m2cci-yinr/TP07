<template>
  <div class="map-outer">
    
    <!-- basemap switcher -->
    <div class="basemap-bar" title="Fond de carte">
      <button
      v-for="bm in basemaps"
      :key="bm.id"
      class="bm-btn"
      :class="{ 'bm-btn--on': activeBasemap === bm.id }"
      @click="switchBasemap(bm)"
      :title="bm.label"
      >
      <span>{{ bm.icon }}</span>
      <span class="bm-label">{{ bm.label }}</span>
    </button>
  </div>
  
  <!-- overlay toggles -->
  <div class="overlay-bar">
    <button
    class="ov-btn"
    :class="{ 'ov-btn--on': heatmapVisible }"
    @click="toggleHeatmap"
    title="Densité des événements"
    >Densité</button>
    <button
    class="ov-btn"
    :class="{ 'ov-btn--on': choroVisible }"
    @click="toggleChoropleth"
    title="Choroplèthe par pays"
    >Choroplèthe</button>
    <button
    class="ov-btn"
    :class="{ 'ov-btn--on': measureMode }"
    @click="toggleMeasure"
    title="Outil de mesure de distance"
    >Mesurer distance</button>
  </div>
  
  <!-- display of measurement results  -->
  <Transition name="mfade">
    <div v-if="measureResult" class="measure-result">
      <span class="measure-dist">{{ measureResult }}</span>
      <button class="measure-clear" @click="clearMeasure" title="Effacer">✕</button>
    </div>
  </Transition>
  
  <div :id="props.mapId" class="map"></div>
</div>
</template>

<script setup>
import { onMounted, ref, inject } from 'vue'
import { MapManager } from '@/mapManager.js'
import { MAP_CONTEXT_KEY } from '@/mapContext.js'
import L from 'leaflet'

// inject: read shared state provided by App.vue 
// This is the consumer side of the provide/inject pattern. App.vue provides MAP_CONTEXT_KEY; then we inject it here without
// needing any prop to be passed through
const mapCtx = inject(MAP_CONTEXT_KEY, null)

const props = defineProps({
  mapId:     { type: String },
  zoomLevel: { type: Number, default: 1 },
  lat:       { type: Number, default: 45.1875602 },
  lon:       { type: Number, default: 5.7357819 },
})

const emit = defineEmits(['marker-selected'])

let mapManager = null

// Basemap catalogue with neat icons from the internet 
const basemaps = [
{
  id: 'osm', label: 'Carte Standard', icon: '',
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
  maxZoom: 19, tileSize: 512, zoomOffset: -1,
},
{
  id: 'dark', label: 'Sombre', icon: '🌑',
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '© <a href="https://carto.com/">CARTO</a>',
  maxZoom: 19, tileSize: 256, zoomOffset: 0,
},
{
  id: 'topo', label: 'Topo', icon: '⛰️',
  url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a>',
  maxZoom: 17, tileSize: 256, zoomOffset: 0,
},
{
  id: 'satellite', label: 'Satellite', icon: '🛰️',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: '© <a href="https://www.esri.com/">Esri</a>',
  maxZoom: 19, tileSize: 256, zoomOffset: 0, subdomains: '',
},
{
  id: 'watercolor', label: 'Aquarelle', icon: '🎨',
  url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
  attribution: '© <a href="https://stamen.com">Stamen</a> / <a href="https://stadiamaps.com">Stadia</a>',
  maxZoom: 16, tileSize: 256, zoomOffset: 0,
},
]

const activeBasemap = ref('osm')
let currentTile = null

// overlay state defined here
const heatmapVisible = ref(false)
const choroVisible   = ref(false)
const measureMode    = ref(false)
const measureResult  = ref('')

let heatmapLayer    = null
let clusterGroup    = null   // L.markerClusterGroup
let choroLayer      = null   // L.GeoJSON choropleth
let measureLayer    = null   // L.LayerGroup (measure points + line)
let measurePoints   = []     // raw [lat, lon] clicks for measurement

// ─Track last locations for overlay rebuilds
let _lastLocations = null

// //  SKI ICON MARKER
function makeSkiIcon(selected = false) {
  // Hand-drawn SVG map pin - before, we used a png here, but actually here's some code
  // for classic teardrop pin with a small circle hole. This way we don't need external images. There are also two modes defined here
  // Normal mode : dark bg + amber border, whic matches the rest of our interace. Selected: red glow
  const body   = selected ? '#b85858' : '#1a1812'
  const stroke = selected ? '#d47070' : '#c8a45a'
  const glow   = selected ? 'filter:drop-shadow(0 0 4px #b85858)' : ''
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32" style="${glow}">
      <path
        d="M12 1 C6.477 1 2 5.477 2 11 C2 17.5 12 31 12 31 C12 31 22 17.5 22 11 C22 5.477 17.523 1 12 1 Z"
        fill="${body}" stroke="${stroke}" stroke-width="1.5"
      />
      <circle cx="12" cy="11" r="3.5" fill="${stroke}" opacity="0.9"/>
    </svg>`
  return L.divIcon({
    className:  '',
    html:       svg,
    iconSize:   [24, 32],
    iconAnchor: [12, 32],
    popupAnchor:[0, -32],
  })
}

//  LIFECYCLE
onMounted(() => {
  mapManager = new MapManager(
  props.mapId, props.lat, props.lon, props.zoomLevel, onSelectMarker
  )
  
  _patchMapManager()
  _applyBasemap(basemaps[0])
  _addMinimap()
  _addScaleBar()
  _initMeasureTool()
})

//  PATCH MAPMANAGER
function _patchMapManager() {
  if (!mapManager) return
  
  // Rich popup HTML
  mapManager.locationInfos = function(location) {
    const d = location.date.toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
    return `
      <div class="leaf-popup">
        <div class="leaf-popup-name">${location.name}</div>
        <div class="leaf-popup-meta">
          <span class="leaf-popup-chip">${location.country}</span>
          <span class="leaf-popup-chip">📅 ${d}</span>
        </div>
        <div class="leaf-popup-coords">${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}</div>
      </div>
    `
  }
  
  // Override changeSelectedMarker to use ski icon instead of red Leaflet pin
  const originalChange = mapManager.changeSelectedMarker.bind(mapManager)
  mapManager.changeSelectedMarker = function(marker) {
    // Restore previous selected marker to normal ski icon
    if (this.selectedMarker) {
      this.selectedMarker.setIcon(makeSkiIcon(false))
    }
    this.selectedMarker = marker
    if (marker) {
      marker.setIcon(makeSkiIcon(true))
      try {
        const latlng = marker.getLatLng()
        this.map.setView(latlng, 14, { animate: true })
        marker.openPopup()
      } catch (e) {
        console.error('[MapComponent] changeSelectedMarker:', e)
      }
    } else {
      this.fitAllMarkers()
    }
  }
}

//  BASEMAP
function _applyBasemap(bm) {
  if (!mapManager?.map) return
  if (currentTile) mapManager.map.removeLayer(currentTile)
  const opts = {
    attribution: bm.attribution,
    maxZoom:     bm.maxZoom,
    tileSize:    bm.tileSize,
    zoomOffset:  bm.zoomOffset,
  }
  if (bm.subdomains !== undefined) opts.subdomains = bm.subdomains
  currentTile = L.tileLayer(bm.url, opts).addTo(mapManager.map)
}

function switchBasemap(bm) {
  activeBasemap.value = bm.id
  _applyBasemap(bm)
}

//  SCALE BAR
function _addScaleBar() {
  L.control.scale({
    position: 'bottomleft', imperial: true, metric: true, maxWidth: 120,
  }).addTo(mapManager.map)
}

//  MINIMAP - this one is a really cool feautre ! 
//  Uses a second lightweight OSM tile layer rendered in a small
//  control in the bottom-right corner.
//  We build it manually (no plugin) using L.Control.

function _addMinimap() {
  // Custom Leaflet control
  const MiniMapControl = L.Control.extend({
    options: { position: 'bottomright' },
    
    onAdd(mainMap) {
      const container = L.DomUtil.create('div', 'minimap-container')
      container.style.cssText = `
        width:160px; height:120px;
        border:1px solid #302c22;
        background:#111009;
        position:relative;
        border-radius:2px;
        overflow:hidden;
        box-shadow:0 2px 8px rgba(0,0,0,0.6);
      `
      // Prevent click-through to main map
      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.disableScrollPropagation(container)
      
      // Inner div for the mini map
      const mapDiv = L.DomUtil.create('div', '', container)
      mapDiv.style.cssText = 'width:100%;height:100%;'
      
      // initialize after DOM is appended
      setTimeout(() => {
        const mini = L.map(mapDiv, {
          zoomControl:       false,
          attributionControl: false,
          dragging:          false,
          scrollWheelZoom:   false,
          doubleClickZoom:   false,
          boxZoom:           false,
          keyboard:          false,
          tap:               false,
        })
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 10, tileSize: 256, zoomOffset: 0,
        }).addTo(mini)
        
        // shadow rectangle showing the main map viewport
        let viewRect = null
        
        function syncMini() {
          const center = mainMap.getCenter()
          const zoom   = Math.max(0, mainMap.getZoom() - 5)
          mini.setView(center, zoom)
          
          // draw viewport bounds on minimap
          if (viewRect) mini.removeLayer(viewRect)
          viewRect = L.rectangle(mainMap.getBounds(), {
            color:       '#c8a45a',
            weight:      1.5,
            fillColor:   '#c8a45a',
            fillOpacity: 0.08,
          }).addTo(mini)
        }
        
        syncMini()
        mainMap.on('moveend zoomend', syncMini)
      }, 0)
      
      // Label
      const label = L.DomUtil.create('div', '', container)
      label.style.cssText = `
        position:absolute; bottom:3px; left:5px;
        font-family:'VT323',monospace; font-size:0.7rem;
        color:#887e6e; pointer-events:none; z-index:1000;
        letter-spacing:1px;
      `
      label.textContent = 'MINI MAP'
      
      return container
    },
  })
  
  new MiniMapControl().addTo(mapManager.map)
}

// ══════════════════════════════════════════════════════════════
//  MEASUREMENT TOOL
//  Click mode: first click = point A, second click = point B,
//  shows the Haversine great-circle distance.
//  Uses L.circleMarker + L.polyline drawn on a dedicated layer.
// ══════════════════════════════════════════════════════════════
function haversineKm(a, b) {
  const R = 6371
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const c = sinLat * sinLat +
  Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * sinLon * sinLon
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
}

function _initMeasureTool() {
  measureLayer = L.layerGroup().addTo(mapManager.map)
  
  mapManager.map.on('click', (e) => {
    if (!measureMode.value) return
    // Stop marker-deselect behaviour from MapManager for this click
    e.originalEvent._measureClick = true
    
    const pt = [e.latlng.lat, e.latlng.lng]
    measurePoints.push(pt)
    
    // Draw point
    L.circleMarker(pt, {
      radius:      5,
      fillColor:   '#6da898',
      fillOpacity: 1,
      color:       '#111009',
      weight:      1.5,
    }).addTo(measureLayer)
    
    if (measurePoints.length === 2) {
      // Draw line
      L.polyline(measurePoints, {
        color:     '#6da898',
        weight:    2,
        dashArray: '4 6',
        opacity:   0.85,
      }).addTo(measureLayer)
      
      const km = haversineKm(measurePoints[0], measurePoints[1])
      if (km < 1) {
        measureResult.value = `${Math.round(km * 1000)} m`
      } else {
        measureResult.value = `${km.toFixed(1)} km`
      }
      // Reset for next pair
      measurePoints = []
    } else {
      measureResult.value = 'Cliquez sur un 2ème point…'
    }
  })
}

function toggleMeasure() {
  measureMode.value = !measureMode.value
  if (!measureMode.value) clearMeasure()
  else {
    measureResult.value = 'Cliquez sur un point de départ…'
  }
  // Toggle cursor style
  const container = mapManager.map.getContainer()
  container.style.cursor = measureMode.value ? 'crosshair' : ''
}

function clearMeasure() {
  measurePoints = []
  measureResult.value = ''
  if (measureLayer) measureLayer.clearLayers()
}

//  HEATMAP (density overlay) - kinda like what we once did in qgis in L3
function _buildHeatmap(locations) {
  if (!mapManager?.map) return
  if (heatmapLayer) { mapManager.map.removeLayer(heatmapLayer); heatmapLayer = null }
  if (!locations?.length) return
  
  const RADIUS_KM = 300
  
  function haversine(a, b) {
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLon = (b.lon - a.lon) * Math.PI / 180
    const sinLat = Math.sin(dLat / 2)
    const sinLon = Math.sin(dLon / 2)
    const c = sinLat * sinLat +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    sinLon * sinLon
    return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
  }
  
  const counts = locations.map(loc =>
  locations.filter(other => haversine(loc, other) < RADIUS_KM).length
  )
  const maxCount = Math.max(...counts)
  
  const circles = locations.map((loc, i) => {
    const t = counts[i] / maxCount
    let r, g, b
    if (t < 0.5) {
      const s = t * 2
      r = Math.round(109 + s * (200 - 109))
      g = Math.round(168 + s * (164 - 168))
      b = Math.round(152 + s * (90  - 152))
    } else {
      const s = (t - 0.5) * 2
      r = Math.round(200 + s * (184 - 200))
      g = Math.round(164 + s * (88  - 164))
      b = Math.round(90  + s * (88  - 90))
    }
    const color = `rgb(${r},${g},${b})`
    return L.circleMarker([loc.lat, loc.lon], {
      radius:      8 + t * 22,
      fillColor:   color,
      fillOpacity: 0.18 + t * 0.32,
      color,
      weight:      1,
      opacity:     0.4 + t * 0.4,
    }).bindTooltip(
    `<b>${loc.name}</b><br>Densité locale : ${counts[i]} événements proches`,
    { className: 'leaf-tooltip' }
    )
  })
  
  heatmapLayer = L.layerGroup(circles).addTo(mapManager.map)
}

function toggleHeatmap() {
  heatmapVisible.value = !heatmapVisible.value
  if (!heatmapVisible.value) {
    if (heatmapLayer) { mapManager.map.removeLayer(heatmapLayer); heatmapLayer = null }
  } else if (_lastLocations) {
    _buildHeatmap(_lastLocations)
  }
}

//  CHOROPLETH OVERLAY
//
//  Fetches GeoJSON country borders, colours each country by event count


// Cached GeoJSON so we only fetch once per page load
let _geojsonCache = null
let _choroBuilding = false   // lock: prevents concurrent builds otherwise there was a bug before

function _clearChoropleth() {
  if (choroLayer) {
    mapManager?.map?.removeLayer(choroLayer)
    choroLayer = null
  }
}

// Count events per country code
function _countByCountry(locations) {
  const counts = {}
  for (const loc of locations) {
    counts[loc.country] = (counts[loc.country] || 0) + 1
  }
  return counts
}

// ISO2 (our data) - ISO3 (Natural Earth GeoJSON uses ISO_A3)
const ISO2_TO_ISO3 = {
  FR:'FRA', CH:'CHE', IT:'ITA', CA:'CAN', US:'USA',
  JP:'JPN', KR:'KOR', DE:'DEU', AT:'AUT', BG:'BGR',
  AD:'AND', ES:'ESP', NO:'NOR', SE:'SWE',
}

async function _buildChoropleth(locations) {
  if (!mapManager?.map) return
  if (!locations?.length) { _clearChoropleth(); return }
  
  // Block if a build is already running- prevents double layers - this is really important
  if (_choroBuilding) return
  _choroBuilding = true
  
  // Always clear any existing layer before we start building a new one
  _clearChoropleth()
  
  try {
    // Fetch GeoJSON only once - reuse cache on subsequent calls
    if (!_geojsonCache) {
      const res = await fetch(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
      )
      if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`)
      _geojsonCache = await res.json()
    }
    
    // If choropleth was toggled OFF while we were fetching, abort - don't add layer
    if (!choroVisible.value) return
    
    const counts   = _countByCountry(locations)
    const maxCount = Math.max(...Object.values(counts), 1)
    
    
    // this one is for proper colors for choropleth. there was a bug earlier during display, but it's fine now!
    function getColor(iso3) {
      const iso2 = Object.entries(ISO2_TO_ISO3).find(([, v]) => v === iso3)?.[0]
      const n    = iso2 ? (counts[iso2] || 0) : 0
      if (n === 0) return null
      
      // Log scale cause otherwise if we use normal scale, switzerland dominates and so we dont actually see color changes
      const t = Math.log(n + 1) / Math.log(maxCount + 1)  // 0→1
      
      if (t < 0.2)  return '#f5edd8'
      if (t < 0.4)  return '#e8c97a'
      if (t < 0.6)  return '#c8a45a'
      if (t < 0.8)  return '#d4732a'
      return '#b85858'
    }
    
    // One final guard: remove layer if it somehow appeared during the await
    _clearChoropleth()
    
    choroLayer = L.geoJSON(_geojsonCache, {
      style(feature) {
        const iso3  = feature.properties.ADM0_A3 || feature.properties.ISO_A3
        const color = getColor(iso3)
        if (!color) return { fillOpacity: 0, weight: 0 }
        return {
          fillColor:   color,
          fillOpacity: 0.8 + (counts[Object.entries(ISO2_TO_ISO3).find(([,v]) => v === iso3)?.[0]] || 0) / maxCount * 0.55,
          color:       '#302c22',   // use dark outline instead of fill colour
          weight:      0.8,
          opacity:     0.6,
        }
      },
      onEachFeature(feature, layer) {
        const iso3 = feature.properties.ADM0_A3 || feature.properties.ISO_A3
        const iso2 = Object.entries(ISO2_TO_ISO3).find(([, v]) => v === iso3)?.[0]
        const n    = iso2 ? (counts[iso2] || 0) : 0
        if (n > 0) {
          layer.bindTooltip(
          `<b>${feature.properties.NAME}</b><br>${n} événement${n > 1 ? 's' : ''}`,
          { className: 'leaf-tooltip', sticky: true }
          )
        }
      },
    }).addTo(mapManager.map)
    
    choroLayer.bringToBack()
    
  } catch (err) {
    console.error('[Choropleth]', err)
    _clearChoropleth()
    choroVisible.value = false
  } finally {
    // Always release the lock, even on error
    _choroBuilding = false
  }
}

function toggleChoropleth() {
  choroVisible.value = !choroVisible.value
  if (!choroVisible.value) {
    _clearChoropleth()
  } else if (_lastLocations) {
    _buildChoropleth(_lastLocations)
  }
}

//MARKER CLUSTERING - this is like what we did in TP back in L3 or M1, the webscraping for restaurants
//
//leaflet.markercluster groups nearby markers into cluster icons that show the count. Clusters split as you zoom in.
//
// However, instead of adding markers directly to the map, we add them to an L.markerClusterGroup, which handles all grouping/ungrouping automatically
//
//  There's a fallback: if the plugin isn't loaded, we fall back to plain mapManager.createMarkers()
// ══════════════════════════════════════════════════════════════
function _setupClusters(locations) {
  // Remove previous cluster group
  if (clusterGroup) {
    mapManager.map.removeLayer(clusterGroup)
    clusterGroup = null
  }
  
  // Check if plugin is available
  if (typeof L.markerClusterGroup !== 'function') {
    console.warn('[MapComponent] leaflet.markercluster not loaded — falling back to plain markers')
    mapManager.createMarkers(locations)
    return
  }
  
  clusterGroup = L.markerClusterGroup({
    // Style the cluster icons to match our dark theme
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount()
      const size  = count < 10 ? 32 : count < 50 ? 38 : 44
      return L.divIcon({
        html: `<div class="cluster-icon cluster-icon--${count < 10 ? 'sm' : count < 50 ? 'md' : 'lg'}">${count}</div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
      })
    },
    maxClusterRadius:        60,
    spiderfyOnMaxZoom:       true,
    showCoverageOnHover:     false,
    zoomToBoundsOnClick:     true,
    disableClusteringAtZoom: 10,
  })
  
  // Build markers directly (bypassing MapManager.createMarkers so we can add to the cluster group instead of to the map directly)
  const self = mapManager
  for (const location of locations) {
    location.marker = L.marker([location.lat, location.lon], {
      icon: makeSkiIcon(false),
    })
    location.marker.bindPopup(mapManager.locationInfos(location))
    location.marker.on('click', function() {
      mapManager.changeSelectedMarker(this)
      onSelectMarker(location)
    })
    clusterGroup.addLayer(location.marker)
  }
  
  // Store locations in mapManager for fitAllMarkers
  mapManager.locations = locations
  mapManager.selectedMarker = null
  mapManager.markersLayer = clusterGroup
  mapManager.map.addLayer(clusterGroup)
  mapManager.fitAllMarkers()
}

// ══════════════════════════════════════════════════════════════
//  PUBLIC API (exposed to App.vue via template ref)
// ══════════════════════════════════════════════════════════════
function createMarkers(lieux) {
  _lastLocations = lieux
  _setupClusters(lieux)
  if (heatmapVisible.value) _buildHeatmap(lieux)
  if (choroVisible.value) {
    // clear immediately so the old layer disappears at once (before async fetch)
    _clearChoropleth()
    _buildChoropleth(lieux)
  }
}

function changeSelectedMarker(marker) {
  mapManager.changeSelectedMarker(marker)
}

function flyTo(lat, lon, zoom = 13) {
  mapManager?.map?.flyTo([lat, lon], zoom, { animate: true, duration: 1.4 })
}

function onSelectMarker(location) {
  emit('marker-selected', location)
}

defineExpose({ createMarkers, changeSelectedMarker, flyTo })
</script>

<style scoped>
.map-outer { position:relative; width:100%; height:100%; }
.map { width:100%; height:100%; min-height:300px; }

/* Basemap switcher */
.basemap-bar {
  position:absolute; top:10px; left:50%; transform:translateX(-50%);
  z-index:500; display:flex; gap:2px;
  background:rgba(17,16,9,0.88); border:1px solid #302c22; border-radius:2px;
  padding:3px 5px; backdrop-filter:blur(8px);
}
.bm-btn {
  display:flex; align-items:center; gap:4px;
  background:transparent; border:1px solid transparent; border-radius:2px;
  padding:4px 9px; color:#887e6e; font-family:'Nunito',sans-serif;
  font-size:0.7rem; font-weight:600; cursor:pointer;
  transition:color 0.15s, background 0.15s, border-color 0.15s; white-space:nowrap;
}
.bm-btn:hover { color:#ede8dc; background:rgba(255,255,255,0.05); }
.bm-btn--on   { color:#c8a45a; border-color:#c8a45a; background:rgba(200,164,90,0.1); }
.bm-label { font-size:0.66rem; letter-spacing:0.3px; }

/* Overlay bar */
.overlay-bar {
  position:absolute; top:48px; left:50%; transform:translateX(-50%);
  z-index:500; display:flex; gap:4px;
}
.ov-btn {
  background:rgba(17,16,9,0.88); border:1px solid #302c22; border-radius:2px;
  padding:3px 10px; color:#887e6e; font-family:'Nunito',sans-serif;
  font-size:0.68rem; font-weight:600; cursor:pointer;
  transition:color 0.15s, border-color 0.15s, background 0.15s;
  backdrop-filter:blur(6px); white-space:nowrap;
}
.ov-btn:hover { color:#ede8dc; background:rgba(255,255,255,0.05); }
.ov-btn--on   { color:#6da898; border-color:#6da898; background:rgba(109,168,152,0.12); }

/* Measurement result badge */
.measure-result {
  position:absolute; bottom:80px; left:50%; transform:translateX(-50%);
  z-index:500; display:flex; align-items:center; gap:8px;
  background:rgba(17,16,9,0.92); border:1px solid #6da898;
  border-radius:2px; padding:6px 14px; backdrop-filter:blur(8px);
}
.measure-dist  { font-family:'Press Start 2P',monospace; font-size:0.62rem; color:#6da898; letter-spacing:1px; }
.measure-clear { background:none; border:none; color:#887e6e; cursor:pointer; font-size:0.8rem; padding:0 2px; }
.measure-clear:hover { color:#6da898; }
.mfade-enter-active,.mfade-leave-active { transition:opacity 0.2s; }
.mfade-enter-from,.mfade-leave-to { opacity:0; }
</style>

<!-- Global styles -Leaflet popups, tooltips, custom markers -->
<style>

/* ── Cluster icons ── */
.cluster-icon {
  display:flex; align-items:center; justify-content:center;
  border-radius:50%;
  font-family:'Press Start 2P',monospace;
  font-size:0.42rem;
  color:#ede8dc;
  background:rgba(26,24,18,0.92);
  border:2px solid #c8a45a;
  box-shadow:0 2px 8px rgba(0,0,0,0.5);
  transition:transform 0.15s;
}
.cluster-icon:hover { transform:scale(1.1); }
.cluster-icon--sm { width:32px; height:32px; border-color:#6da898; font-size:0.4rem; }
.cluster-icon--md { width:38px; height:38px; border-color:#c8a45a; font-size:0.42rem; }
.cluster-icon--lg { width:44px; height:44px; border-color:#b85858; font-size:0.44rem; }

/* ── Rich popup card ── */
.leaf-popup { font-family:'Nunito',sans-serif; min-width:160px; }
.leaf-popup-name { font-weight:700; font-size:0.92rem; color:#ede8dc; margin-bottom:6px; line-height:1.3; }
.leaf-popup-meta { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:5px; }
.leaf-popup-chip {
  font-size:0.72rem; background:rgba(255,248,220,0.06);
  border:1px solid #302c22; border-radius:2px; padding:1px 6px; color:#6da898;
}
.leaf-popup-coords { font-family:'VT323',monospace; font-size:0.78rem; color:#887e6e; }

/* ── Leaflet popup theme ── */
.leaflet-popup-content-wrapper {
  background:#1a1812 !important; border:1px solid #302c22 !important;
  border-radius:2px !important; box-shadow:0 4px 20px rgba(0,0,0,0.6) !important;
  color:#ede8dc !important;
}
.leaflet-popup-tip         { background:#1a1812 !important; }
.leaflet-popup-close-button { color:#887e6e !important; }
.leaflet-popup-close-button:hover { color:#c8a45a !important; }

/* ── Tooltip theme ── */
.leaf-tooltip,
.leaflet-tooltip.leaf-tooltip {
  background:#1a1812; border:1px solid #302c22; border-radius:2px;
  color:#ede8dc; font-family:'Nunito',sans-serif; font-size:0.78rem;
  padding:4px 8px; box-shadow:0 2px 8px rgba(0,0,0,0.5);
}
.leaflet-tooltip.leaf-tooltip::before { border-top-color:#302c22; }

/* ── Scale control ── */
.leaflet-control-scale-line {
  background:rgba(26,24,18,0.85) !important; border-color:#c8a45a !important;
  color:#c8a45a !important; font-family:'VT323',monospace !important;
  font-size:0.82rem !important; border-radius:0 !important;
}

/* ── Cluster group animations (from markercluster) ── */
.leaflet-cluster-anim .leaflet-marker-icon,
.leaflet-cluster-anim .leaflet-marker-shadow {
  transition: transform 0.3s ease-out, opacity 0.3s ease-in;
}
</style>
