/**
 * MapManager — lazy-loads Leaflet + renders route map with stops & bus icons.
 * Public API:
 *   load(stops, busPositions, isCtb, userPos) → Promise
 *   show() / hide() / isVisible()
 *   centerOnStop(stopInfo) / showWalkingPath(from, toStop) / clearWalkingPath()
 *   updateUserPosition(pos)
 */
class MapManager {
  constructor() {
    this._loaded = false
    this._map = null
    this._routeLayer = null
    this._stopMarkers = []
    this._busMarkers = []
    this._userMarker = null
    this._walkLayer = null
    this._walkStopMarker = null
  }

  async load(stops, busPositions, isCtb, userPos) {
    try {
      if (!this._loaded) {
        await this._loadLeaflet()
        this._loaded = true
      }
    } catch (e) {
      Logger.error('MAP', 'Leaflet load failed: ' + e.message)
      return
    }

    const $view = $('#mapView')
    if ($view.length === 0) return

    $view.show()

    if (!this._map || !this._hasContainer()) {
      if (this._map) { this._map.remove(); this._map = null }
      this._map = L.map('routeMap', { center: [22.3, 114.2], zoom: 12 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this._map)
    }

    this._clearLayers()

    const geometry = await GeoUtils.fetchRouteGeometry(stops)
    if (geometry) {
      try { this._drawRoute(geometry, isCtb) } catch (e) { Logger.warn('MAP', 'Route draw: ' + e.message) }
    }
    try { this._drawStops(stops) } catch (e) { Logger.warn('MAP', 'Stops draw: ' + e.message) }
    try { this._drawBuses(busPositions, stops) } catch (e) { Logger.warn('MAP', 'Buses draw: ' + e.message) }
    if (userPos) {
      try { this._drawUserLocation(userPos) } catch (e) { Logger.warn('MAP', 'User loc draw: ' + e.message) }
    }

    this._fitBoundsSafe(stops, userPos)
    setTimeout(() => this._map.invalidateSize(), 150)
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

  centerOnStop(stopInfo) {
    if (!this._map) return
    this.clearWalkingPath()
    this._map.setView([stopInfo.lat, stopInfo.lng], 16)
  }

  async showWalkingPath(from, toStop) {
    if (!this._map) return
    this.clearWalkingPath()

    const highlightIcon = L.divIcon({
      html: '<div class="stop-highlight-dot"></div>',
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })
    this._walkStopMarker = L.marker([toStop.lat, toStop.lng], { icon: highlightIcon }).addTo(this._map)

    const geometry = await GeoUtils.fetchWalkingRoute(from, { lat: toStop.lat, lng: toStop.lng })
    this._walkLayer = geometry
      ? L.geoJSON(geometry, {
          style: { color: '#3b82f6', weight: 5, opacity: 0.8, dashArray: '8,8' },
        }).addTo(this._map)
      : L.polyline([[from.lat, from.lng], [toStop.lat, toStop.lng]], {
          color: '#3b82f6', weight: 3, opacity: 0.6, dashArray: '10,10',
        }).addTo(this._map)
  }

  clearWalkingPath() {
    if (!this._map) return
    if (this._walkLayer) { this._map.removeLayer(this._walkLayer); this._walkLayer = null }
    if (this._walkStopMarker) { this._map.removeLayer(this._walkStopMarker); this._walkStopMarker = null }
  }

  updateUserPosition(pos) {
    if (this._userMarker) this._userMarker.setLatLng([pos.lat, pos.lng])
  }

  _hasContainer() {
    return !!document.getElementById('routeMap')
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
      script.onerror = () => reject(new Error('Leaflet CDN load failed'))
      document.head.appendChild(script)
    })
  }

  _clearLayers() {
    if (!this._map) return
    if (this._routeLayer) { this._map.removeLayer(this._routeLayer); this._routeLayer = null }
    if (this._userMarker) { this._map.removeLayer(this._userMarker); this._userMarker = null }
    this._stopMarkers.forEach(m => this._map.removeLayer(m))
    this._stopMarkers = []
    this._busMarkers.forEach(m => this._map.removeLayer(m))
    this._busMarkers = []
    this.clearWalkingPath()
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
      marker.bindPopup(`<b>${idx + 1}. ${this._stopName(stop, idx)}</b>`)
      this._stopMarkers.push(marker)
    })
  }

  _drawBuses(busPositions, stops) {
    const idxBySeq = {}
    stops.forEach((s, i) => { idxBySeq[s.seq] = i })

    busPositions.forEach(pos => {
      const idx = idxBySeq[pos.afterSeq]
      if (idx == null) return
      const cur = stops[idx]
      const next = stops[idx + 1]
      if (!cur || !next) return
      if (cur.lat == null || cur.long == null || next.lat == null || next.long == null) return
      if (!isFinite(cur.lat) || !isFinite(cur.long) || !isFinite(next.lat) || !isFinite(next.long)) return

      const icon = L.divIcon({
        html: '<span class="bus-map-icon">🚌</span>',
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      const lat = (cur.lat + next.lat) / 2
      const lng = (cur.long + next.long) / 2
      this._busMarkers.push(L.marker([lat, lng], { icon }).addTo(this._map))
    })
  }

  _fitBoundsSafe(stops, userPos) {
    try {
      const allLats = []
      const allLngs = []
      stops.forEach(s => {
        if (s.lat != null && isFinite(s.lat) && s.long != null && isFinite(s.long)) {
          allLats.push(s.lat)
          allLngs.push(s.long)
        }
      })
      if (userPos && isFinite(userPos.lat) && isFinite(userPos.lng)) {
        allLats.push(userPos.lat)
        allLngs.push(userPos.lng)
      }
      if (allLats.length === 0) { this._map.setView([22.3, 114.2], 11); return }

      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
      for (let i = 0; i < allLats.length; i++) {
        if (allLats[i] < minLat) minLat = allLats[i]
        if (allLats[i] > maxLat) maxLat = allLats[i]
        if (allLngs[i] < minLng) minLng = allLngs[i]
        if (allLngs[i] > maxLng) maxLng = allLngs[i]
      }
      this._map.fitBounds(L.latLngBounds([minLat, minLng], [maxLat, maxLng]), { padding: [50, 50] })
    } catch {
      this._map.setView([22.3, 114.2], 11)
    }
  }

  _stopName(stop, idx) {
    return stop.name_tc || stop.name_en || `Stop ${idx + 1}`
  }

  _drawUserLocation(pos) {
    const icon = L.divIcon({
      html: '<div class="user-loc-dot"><div class="user-loc-pulse"></div></div>',
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
    this._userMarker = L.marker([pos.lat, pos.lng], { icon }).addTo(this._map)
  }
}
