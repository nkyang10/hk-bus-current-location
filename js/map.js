/**
 * MapManager — Leaflet map with stop markers and route polyline.
 * Public API: init(containerId), render(stops), destroy()
 */
class MapManager {
  constructor() {
    this._map = null
    this._markers = null
    this._polyline = null
  }

  init(containerId) {
    if (this._map) return
    this._map = L.map(containerId, { zoomControl: false }).setView([22.3193, 114.1694], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this._map)
    L.control.zoom({ position: 'bottomright' }).addTo(this._map)
    this._markers = L.layerGroup().addTo(this._map)
    this._polyline = L.layerGroup().addTo(this._map)
    Logger.map('INIT', 'Map created')
    // Fix initial render
    setTimeout(() => this._map.invalidateSize(), 200)
  }

  render(stops) {
    if (!this._map) return
    this._markers.clearLayers()
    this._polyline.clearLayers()

    const latLngs = []
    const bounds = []

    stops.forEach((stop, idx) => {
      const lat = parseFloat(stop.lat)
      const lng = parseFloat(stop.long)
      if (isNaN(lat) || isNaN(lng)) return

      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#E31837;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${idx + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const marker = L.marker([lat, lng], { icon })
        .bindPopup(`<b>${stop.name_tc || stop.name_en}</b><br/><span style="color:#666;font-size:11px">${stop.name_en || ''}</span>`)
      this._markers.addLayer(marker)
      latLngs.push([lat, lng])
      bounds.push([lat, lng])
    })

    if (latLngs.length > 1) {
      this._polyline.addLayer(L.polyline(latLngs, { color: '#E31837', weight: 3, opacity: 0.7 }))
    }

    if (bounds.length > 0) {
      this._map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 })
    }

    Logger.map('RENDER', `${latLngs.length} markers, ${latLngs.length > 1 ? 'polyline' : 'no polyline'}`)
  }

  invalidateSize() {
    if (this._map) setTimeout(() => this._map.invalidateSize(), 100)
  }

  destroy() {
    if (this._map) { this._map.remove(); this._map = null }
  }
}
