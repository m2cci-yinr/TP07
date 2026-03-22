import L from 'leaflet'

// marker rouge pour indiquer la localisation sélectionnée
const redMarker = new L.Icon({
	iconUrl: 'images/marker-icon-red.png',
	shadowUrl: 'images/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
})

export class MapManager {
	//-------------------------------------------------------------------------------------
	// Constructeur
	//-------------------------------------------------------------------------------------

	/**
	 * @param {string} mapId l'identifiant du div dans lequel la carte est affichée
	 * @param {number} lat latitude du point sur lequel la carte est centrée au départ
	 * @param {number} lon longitude du point sur lequel la carte est centrée au départ
	 * @param {number} zoomLevel niveau de zoom de la carte
	 * @param {Function} onMakerSelectedCallback callBack appelée quand un markeur est cliqué
	 */
	constructor(mapId, lat, lon, zoomLevel, onMakerSelectedCallback) {
		this.map = L.map(mapId).setView([lat, lon], zoomLevel) // this.map, l'objet Map qui gère la carte
		this.selectedMarker = null // le marqueur sélectionné sur la carte
		this.markersLayer = null // le layer (couche) qui contient tous les marqueurs
		this.locations = [] // store locations for calculating bounds*
		this.onMakerSelectedCallback = onMakerSelectedCallback;

		// création d'un fond de carte openstreet-map et ajout de celui-ci à la carte
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
			maxZoom: 18,
			tileSize: 512,
			zoomOffset: -1,
		}).addTo(this.map)

		// fermeture des popups quand la souris sort de la carte
		// car sinon on a un bug si un marqueur est sélectionné et son popup est ouvert
		// et que l'on fait une nouvelle recherche les marqueurs ne s'affichent pas correctement
		// et ne s'adpatent plus au zoom
		this.map.on('mouseout', () => {
			this.map.closePopup();
		}).on('click', () => {
			console.log("close");
			this.changeSelectedMarker(null);
			if (this.onMakerSelectedCallback) {
				this.onMakerSelectedCallback(null);
			};
		})
	}

	//-------------------------------------------------------------------------------------
	// Méthodes
	//-------------------------------------------------------------------------------------

	/**
	 * Création des marqueurs correspondant à un ensemble de lieux
	 *
	 * @param {array[Location]} locations : tableau d'objet locations définissant les marqueurs à afficher
	 *
	 * un objet Location est de la forme
	 *
	 * { name: "Méribel Village", lat: 45.4164656, lon: 6.5650613, country: "FR" }
	 *
	 */
	createMarkers(locations) {
		const self = this
		this.map.closePopup()
		// création d'un tableau de marqueurs
		let markers = []
		this.locations = locations
		for (let location of locations) {
			// créé un marqueur associé à chacune des locations
			location.marker = L.marker([location.lat, location.lon]);
			// association d'un fenêtre popup au marqueur
			location.marker.bindPopup(this.locationInfos(location));
			// Gérer l'événement de fermeture du popup
			// location.marker.on('popupclose', function () {
			// 	console.log('Popup fermé pour:', location.name)
			// 	self.selectedMarker = null;
			// 	self.onMakerSelectedCallback(null);
			// });
			// association d'un gestionnaire de clics pour le marqueur
			location.marker.on('click', function () {
				// Remettre l'icône par défaut si nécessaire si il y avait un marqueur déjà sélctionné
				// if (self.selectedMarker === this) {
				// 	this.setIcon(L.Marker.prototype.options.icon)
				// 	self.selectedMarker = null
				// }

				self.changeSelectedMarker(this)
				//		self.vueApp.sélectionnerLieu(location);
				if (self.onMakerSelectedCallback !== null) { self.onMakerSelectedCallback(location) };
			});

			// // rend le popup associé au marqueur visible dès que la souris est sur lui
			// location.marker.on('mouseover', function () {
			// 	this.openPopup()
			// })
			// // rend le popup associé au marker invisible dès que la souris n'est plus au dessus du marqueur
			// location.marker.on('mouseout', function () {
			// 	this.closePopup()
			// });
			markers.push(location.marker)
		}
		// on supprime les marqueurs déjà présents sur la carte
		this.removeMarkers()
		// on crée un nouveau layer pour les marqueurs correspondant à la carte
		if (markers.length > 0) {
			this.markersLayer = L.layerGroup(markers) // création du layer
			this.markersLayer.addTo(this.map) // ajout à la carte
			// this.changeSelectedMarker(markers[0]) // on sélectionne le premier marqueur
			this.fitAllMarkers() // ajuste la vue de la carte pour afficher tous les marqueurs
		} else {
			this.markersLayer = null
		}
	}


	/**
	 * change de marqueur sélectionné. L'icone du nouveau marqueur sélectionné est mis à rouge
	 * (alors que celui de l'ancien marqueur sélectionné redevient bleu) et la carte est centrée sur celui-ci.
	 * @param {Marker} marker le nouveau marqueur sélectionné
	 */
	changeSelectedMarker(marker) {
		console.log('changeSelected Marker')
		if (this.selectedMarker) {
			// il y avait un marqueur précédemment sélectionné,
			this.selectedMarker.setIcon(L.Marker.prototype.options.icon) // on associe à ce marqueur l'icone par défaut (bleu)
		}
		// marker est mémorisé dans l'état de l'objet MapManager 
		// comme étant le nouveau marqueur sélectionné
		this.selectedMarker = marker;
		marker?.setIcon(redMarker) // on associe au nouveau marqueur sélectionné une icone rouge
		// si un marqueur est sélectionné, centrer la carte dessus et zoomer
		if (marker) {
			try {
				const latlng = marker.getLatLng()
				// zoom cible — ajuster selon préférence (13 = ville, 15 = rue)
				const targetZoom = 14
				this.map.setView(latlng, targetZoom, { animate: true })
				// ouvrir le popup du marqueur sélectionné
				marker.openPopup()
			} catch (e) {
				console.error('Erreur lors du centrage/zoom sur le marqueur', e)
			}
		} else {
			// si on désélectionne (marker === null), réajuster la vue sur tous les marqueurs
			this.fitAllMarkers()
		}
	}

	/**
	 * retire de la carte, la couche correspondant aux marqueurs
	 */
	removeMarkers() {
		if (this.markersLayer) {
			// il existe déjà une couche pour les marqueurs , on la supprime
			this.map.removeLayer(this.markersLayer)
			this.selectedMarker = null
		}
	}

	/**
	 * @param {Location} location un objet Location
	 * @returns un chaîne de caractères donnant les informations sur un lieu donné
	 */
	locationInfos(location) {
		const dateString = location.date.toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		})
		return `${location.name} ${location.country}<br>(${dateString})`
	}

	/**
	 * Ajuste la vue de la carte pour afficher tous les marqueurs
	 */
	fitAllMarkers() {
		if (!this.locations || this.locations.length === 0) return

		const points = this.locations.map((loc) => [loc.lat, loc.lon])
		const bounds = L.latLngBounds(points)

		this.map.fitBounds(bounds, { padding: [20, 20] })
		if (this.map.getZoom() > 11) {
			this.map.setZoom(11);
		}
	}

	// le programme ci-dessus utilise la fonction map pour créer un tableaux de points
	// le code est équivalent à 
	// fitAllMarkers() {
	// 	if (this.locations && this.locations.length > 0) {
	// 		// calculate bounds manually from locations
	// 		let minLat = this.locations[0].lat;
	// 		let maxLat = this.locations[0].lat;
	// 		let minLon = this.locations[0].lon;
	// 		let maxLon = this.locations[0].lon;

	// 		// find min/max lat/lon
	// 		for (let location of this.locations) {
	// 			minLat = Math.min(minLat, location.lat);
	// 			maxLat = Math.max(maxLat, location.lat);
	// 			minLon = Math.min(minLon, location.lon);
	// 			maxLon = Math.max(maxLon, location.lon);
	// 		}

	// 		// create bounds and fit
	// 		const bounds = [[minLat, minLon], [maxLat, maxLon]];
	// 		this.map.fitBounds(bounds, { padding: [50, 50] });
	// 	}
	// }
}
