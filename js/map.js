/**
 * MapManager — lazy-loads Leaflet + renders route map with stops & bus icons.
 * Public API:
 *   load(stops, busPositions, isCtb)  → Promise
 *   show()
 *   hide()
 *   isVisible()
 */
class MapManager {
  constructor() {
    this._loaded = false
    this._map = null
    this._routeLayer = null
    this._stopMarkers = []
    this._busMarkers = []
    this._initCoords = null
  }

  async load(stops, busPositions, isCtb) {
    if (!this._loaded) {
      await this._loadLeaflet()
      this._loaded = true
    }

    const $view = $('#mapView')
    if ($view.length === 0) return

    $view.show()

    if (!this._map) {
      this._map = L.map('routeMap', {
        center: [22.3, 114.2],
        zoom: 12,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this._map)
    }

    this._clearLayers()

    try {
      const geometry = await this._fetchRouteGeometry(stops)
      if (geometry) {
        try { this._drawRoute(geometry, isCtb) } catch (e) { Logger.warn('MAP', 'Route draw: ' + e.message) }
      }
      try { this._drawStops(stops) } catch (e) { Logger.warn('MAP', 'Stops draw: ' + e.message) }
      try { this._drawBuses(busPositions, stops) } catch (e) { Logger.warn('MAP', 'Buses draw: ' + e.message) }
    } catch (err) {
      Logger.warn('MAP', 'Other error: ' + err.message)
    }

    this._fitBoundsSafe(stops)

    setTimeout(() => this._map.invalidateSize(), 150)
  }

  _loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) { resolve(); return }
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = resolve
      script.onerror = () => reject(new Error('Leaflet failed to load'))
      document.head.appendChild(script)
    })
  }

  _clearLayers() {
    if (!this._map) return
    if (this._routeLayer) { this._map.removeLayer(this._routeLayer); this._routeLayer = null }
    this._stopMarkers.forEach(m => this._map.removeLayer(m))
    this._stopMarkers = []
    this._busMarkers.forEach(m => this._map.removeLayer(m))
    this._busMarkers = []
  }

  async _fetchRouteGeometry(stops) {
    const valid = stops.filter(s => s.lat && s.long)
    if (valid.length < 2) return null

    const coords = valid.map(s => `${s.long},${s.lat}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`

    try {
      const res = await fetch(url)
      const data = await res.json()
      if (data.routes && data.routes[0]) {
        return data.routes[0].geometry
      }
    } catch {
      Logger.warn('OSRM', 'Route fetch failed, fallback to straight lines')
    }
    return null
  }

  _drawRoute(geometry, isCtb) {
    const color = isCtb ? '#006847' : '#E31837'
    this._routeLayer = L.geoJSON(geometry, {
      style: { color, weight: 4, opacity: 0.7 },
    }).addTo(this._map)
  }

  _drawStops(stops) {
    stops.forEach((stop, idx) => {
      if (stop.lat == null || stop.long == null || !isFinite(stop.lat) || !isFinite(stop.long)) return
      const marker = L.circleMarker([stop.lat, stop.long], {
        radius: 7,
        fillColor: '#fff',
        color: '#374151',
        weight: 2,
        fillOpacity: 1,
      }).addTo(this._map)
      const name = this._stopName(stop, idx)
      marker.bindPopup(`<b>${idx + 1}. ${name}</b>`)
      this._stopMarkers.push(marker)
    })
  }

  _drawBuses(busPositions, stops) {
    busPositions.forEach(pos => {
      const cur = stops.find(s => s.seq === pos.afterSeq)
      const next = stops[stops.indexOf(cur) + 1]
      if (!cur || !next) return
      if (cur.lat == null || cur.long == null || next.lat == null || next.long == null) return
      if (!isFinite(cur.lat) || !isFinite(cur.long) || !isFinite(next.lat) || !isFinite(next.long)) return
      const lat = (cur.lat + next.lat) / 2
      const lng = (cur.long + next.long) / 2
      const icon = L.divIcon({
        html: '<span class="bus-map-icon">🚌</span>',
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      const marker = L.marker([lat, lng], { icon }).addTo(this._map)
      this._busMarkers.push(marker)
    })
  }

  _fitBoundsSafe(stops) {
    try {
      const lats = stops.filter(s => s.lat != null && isFinite(s.lat)).map(s => s.lat)
      const lngs = stops.filter(s => s.long != null && isFinite(s.long)).map(s => s.long)
      if (lats.length === 0 || lngs.length === 0) { this._map.setView([22.3, 114.2], 11); return }
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      )
      this._map.fitBounds(bounds, { padding: [50, 50] })
    } catch {
      this._map.setView([22.3, 114.2], 11)
    }
  }

  _stopName(stop, idx) {
    return stop.name_tc || stop.name_en || `Stop ${idx + 1}`
  }

  show() {
    if (this._map) {
      $('#mapView').show()
      setTimeout(() => this._map.invalidateSize(), 150)
    }
  }

  hide() {
    $('#mapView').hide()
  }

  isVisible() {
    return $('#mapView').is(':visible')
  }
}
