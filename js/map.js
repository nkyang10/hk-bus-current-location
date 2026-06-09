/**
 * MapManager — Leaflet map with stop markers, route polyline, and live bus positions.
 * Public API: init(containerId), render(stops, busPositions), invalidateSize(), destroy()
 */
class MapManager {
  constructor() {
    this._map = null
    this._markers = null
    this._polyline = null
    this._busLayer = null
  }

  init(containerId) {
    if (this._map) return
    this._map = L.map(containerId, { zoomControl: false }).setView([22.3193, 114.1694], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this._map)
    L.control.zoom({ position: 'bottomright' }).addTo(this._map)
    this._markers = L.layerGroup().addTo(this._map)
    this._polyline = L.layerGroup().addTo(this._map)
    this._busLayer = L.layerGroup().addTo(this._map)
    setTimeout(() => this._map.invalidateSize(), 200)
    Logger.map('INIT', 'Map created')
  }

  render(stops, busPositions) {
    if (!this._map) return
    this._markers.clearLayers()
    this._polyline.clearLayers()
    this._busLayer.clearLayers()

    const latLngs = []
    const bounds = []

    // Draw stops as numbered markers
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

    // Route polyline
    if (latLngs.length > 1) {
      this._polyline.addLayer(L.polyline(latLngs, { color: '#E31837', weight: 3, opacity: 0.7 }))
    }

    // Draw live bus positions
    if (busPositions && busPositions.length) {
      busPositions.forEach(bus => {
        const busIcon = L.divIcon({
          className: '',
          html: `<div style="
            background:#2563eb; color:white; width:44px; height:44px; border-radius:6px;
            display:flex; align-items:center; justify-content:center; font-size:26px;
            border:3px solid white; box-shadow:0 3px 12px rgba(0,0,0,0.5);
            transform:rotate(90deg);">🚌</div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        })
        const marker = L.marker([bus.lat, bus.lng], { icon: busIcon, zIndexOffset: 1000 })
          .bindPopup(`<b>Bus ${bus.etaSeq}</b><br/>Stop ${bus.fromSeq} → Stop ${bus.toSeq}<br/>${Math.round(bus.progress * 100)}%`)
        this._busLayer.addLayer(marker)
      })
    }

    // Fit bounds
    if (bounds.length > 0) {
      this._map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 })
    }

    Logger.map('RENDER', `${latLngs.length} stops, ${busPositions ? busPositions.length : 0} buses`)
  }

  invalidateSize() {
    if (this._map) setTimeout(() => this._map.invalidateSize(), 100)
  }

  destroy() {
    if (this._map) { this._map.remove(); this._map = null }
  }
}
