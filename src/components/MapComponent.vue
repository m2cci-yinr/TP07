<template>
  <div :id="props.mapId" class="map"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import { MapManager } from '@/mapManager.js';

const props = defineProps({
  mapId:     { type: String },
  zoomLevel: { type: Number, default: 1 },
  lat:       { type: Number, default: 45.1875602 },
  lon:       { type: Number, default: 5.7357819 }
});

let mapManager = null;

onMounted(() => {
  mapManager = new MapManager(props.mapId, props.lat, props.lon, props.zoomLevel, onSelectMarker);
});

function createMarkers(lieux) {
  mapManager.createMarkers(lieux);
}

function changeSelectedMarker(marker) {
  mapManager.changeSelectedMarker(marker);
}

// ── flyTo: animate map to any lat/lon/zoom (used by footer author buttons)
function flyTo(lat, lon, zoom = 13) {
  if (mapManager?.map) {
    mapManager.map.flyTo([lat, lon], zoom, { animate: true, duration: 1.4 });
  }
}

const emit = defineEmits(['marker-selected']);
function onSelectMarker(location) {
  emit('marker-selected', location);
}

defineExpose({ createMarkers, changeSelectedMarker, flyTo });
</script>

<style scoped>
.map {
  width: 100%;
  height: 520px;
}
</style>
