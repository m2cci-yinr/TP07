<template>
    <div :id="props.mapId" class="map">
        <!-- Your content here -->
    </div>
</template>

<script setup>
import L from 'leaflet';
import { onMounted, ref } from 'vue';
import { MapManager } from '@/mapManager.js';

const props = defineProps({
    mapId: { type: String },
    zoomLevel: { type: Number, default: 1 },
    lat: { type: Number, default: 45.1875602 },
    lon: { type: Number, default: 5.7357819 }
});

let mapManager = null;

onMounted(function () {
    mapManager = new MapManager(props.mapId, props.lat, props.lon, props.zoomLevel, onSelectMarker);
});

function createMarkers(lieux) {
    mapManager.createMarkers(lieux);
}

function changeSelectedMarker(marker) {
    mapManager.changeSelectedMarker(marker);
}

// Lorsque l'utilisateur clique sur un marqueur un événément 'marker-selected'
// est émis par le MapComponent
const emit = defineEmits(['marker-selected']);

function onSelectMarker(location) {
    emit('marker-selected', location);
}

// méthodes que le composant parent pourra utiliser
defineExpose({ createMarkers, changeSelectedMarker });

</script>

<style scoped>
.map {
    width: 100%;
    height: 500px;
    border: solid 1px;
}
</style>