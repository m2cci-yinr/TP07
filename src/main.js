import { createApp } from 'vue'
import App from './App.vue'
import 'leaflet/dist/leaflet.css'
// leaflet.markercluster CSS - must come after leaflet.css
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
// import the plugin to attach L.markerClusterGroup to L
import 'leaflet.markercluster'

createApp(App).mount('#app')
