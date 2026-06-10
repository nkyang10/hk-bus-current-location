# Plan: Add OpenStreetMap to Bus Stop Listing Page

## Overview
Add a toggle button to switch between **ETA list view** and **Map view** on the same page with a single click.

**Key requirements:**
- Single click toggles between views (no page reload)
- Map must NOT load by default to save resources
- Both views exist on same page, only one visible at a time

## Data Source Research

### Current State
- Stop data already includes `lat` and `long` coordinates from `fetchStop()` API
- No route shape/geometry data available in current KMB/CTB APIs

### Solution: OSRM Routing API
Use Open Source Routing Machine to calculate road-following paths between stops:
```
https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?geometries=geojson
```

**Benefits:**
- Free (no API key required for development)
- Returns actual road paths as GeoJSON polylines
- Simple REST API, no complex setup

**Limitations:**
- Rate limits for production use (but acceptable for moderate traffic)
- May need fallback to straight lines if API fails

## Implementation Plan

### 1. UI Changes

#### Add View Toggle Button
**File:** `js/ui.js` - `renderRouteView()` method

Replace the map button with a toggle button in the toolbar (after language button):
```html
<button class="view-toggle-btn" id="viewToggleBtn">🗺️</button>
```

This button toggles between 📋 (list) and 🗺️ (map) icons.

#### Add Map Container
**File:** `js/ui.js` - `renderRouteView()` method

Add map container that will replace the stop list when active:
```html
<div class="view-container">
  <div class="stop-list" id="stopList"></div>
  <div class="map-view" id="mapView" style="display:none">
    <div id="routeMap" style="height: calc(100vh - 200px)"></div>
  </div>
</div>
```

### 2. Map Manager Module

**New file:** `js/map.js`

Create a `MapManager` class to handle:
- Lazy-loading Leaflet library
- Fetching OSRM route geometry
- Rendering map with stops and route path
- Displaying bus icons

```javascript
class MapManager {
  constructor() {
    this._loaded = false
    this._map = null
    this._routeLayer = null
    this._stopMarkers = []
    this._busMarkers = []
  }

  async load(stops, busPositions, isCtb) {
    // Lazy-load Leaflet CSS/JS
    if (!this._loaded) {
      await this._loadLeaflet()
      this._loaded = true
    }
    
    // Initialize map if not exists
    if (!this._map) {
      this._map = L.map('routeMap').setView([22.3, 114.2], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(this._map)
    }
    
    // Clear previous layers
    this._clearLayers()
    
    // Fetch route geometry from OSRM
    const routeGeometry = await this._fetchRouteGeometry(stops)
    
    // Draw route polyline
    if (routeGeometry) {
      this._drawRoute(routeGeometry, isCtb)
    }
    
    // Draw stop markers
    this._drawStops(stops)
    
    // Draw bus icons
    this._drawBuses(busPositions, stops)
    
    // Fit map to bounds
    this._fitBounds(stops)
  }

  _loadLeaflet() {
    return new Promise((resolve) => {
      // Load CSS
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
      
      // Load JS
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = resolve
      document.head.appendChild(script)
    })
  }

  _clearLayers() {
    if (this._routeLayer) {
      this._map.removeLayer(this._routeLayer)
      this._routeLayer = null
    }
    this._stopMarkers.forEach(m => this._map.removeLayer(m))
    this._stopMarkers = []
    this._busMarkers.forEach(m => this._map.removeLayer(m))
    this._busMarkers = []
  }

  async _fetchRouteGeometry(stops) {
    // Build OSRM URL with all stop coordinates
    const coords = stops
      .filter(s => s.lat && s.long)
      .map(s => `${s.long},${s.lat}`)
      .join(';')
    
    if (!coords) return null
    
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson`
    
    try {
      const res = await fetch(url)
      const data = await res.json()
      if (data.routes && data.routes[0]) {
        return data.routes[0].geometry
      }
    } catch (err) {
      console.warn('OSRM fetch failed, using straight lines', err)
    }
    return null
  }

  _drawRoute(geometry, isCtb) {
    const color = isCtb ? '#006847' : '#E31837'
    this._routeLayer = L.geoJSON(geometry, {
      style: { color, weight: 4, opacity: 0.7 }
    }).addTo(this._map)
  }

  _drawStops(stops) {
    stops.forEach((stop, idx) => {
      if (!stop.lat || !stop.long) return
      
      const marker = L.circleMarker([stop.lat, stop.long], {
        radius: 8,
        fillColor: '#fff',
        color: '#333',
        weight: 2,
        fillOpacity: 1
      }).addTo(this._map)
      
      const name = stop.name_tc || stop.name_en || `Stop ${idx + 1}`
      marker.bindPopup(`<b>${idx + 1}. ${name}</b>`)
      this._stopMarkers.push(marker)
    })
  }

  _drawBuses(busPositions, stops) {
    busPositions.forEach(pos => {
      const stop = stops.find(s => s.seq === pos.afterSeq)
      if (!stop || !stop.lat || !stop.long) return
      
      const icon = L.divIcon({
        html: '🚌',
        className: 'bus-map-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
      
      const marker = L.marker([stop.lat, stop.long], { icon }).addTo(this._map)
      this._busMarkers.push(marker)
    })
  }

  _fitBounds(stops) {
    const validStops = stops.filter(s => s.lat && s.long)
    if (validStops.length === 0) return
    
    const bounds = L.latLngBounds(validStops.map(s => [s.lat, s.long]))
    this._map.fitBounds(bounds, { padding: [50, 50] })
  }

  show() {
    $('#mapView').show()
    $('#stopList').hide()
    if (this._map) {
      setTimeout(() => this._map.invalidateSize(), 100)
    }
  }

  hide() {
    $('#mapView').hide()
    $('#stopList').show()
  }

  isVisible() {
    return $('#mapView').is(':visible')
  }
}
```

### 3. Integration

#### Load Map Manager
**File:** `index.html`

Add script tag after other JS files:
```html
<script src="js/map.js"></script>
```

#### Initialize in App
**File:** `js/app.js` - constructor

```javascript
this.mapMgr = new MapManager()
```

#### Wire Up Toggle Button
**File:** `js/ui.js` - `renderRouteView()` method

Add click handler after other event bindings:
```javascript
$('#viewToggleBtn').on('click', () => {
  $(document).trigger('view:toggle')
})
```

#### Handle View Toggle
**File:** `js/app.js` - `_bindEvents()` method

```javascript
$(document).on('view:toggle', async () => {
  const isMapView = this.mapMgr.isVisible()
  
  if (isMapView) {
    // Switch to list view
    this.mapMgr.hide()
    $('#viewToggleBtn').text('🗺️')
  } else {
    // Switch to map view
    const stops = this.routeMgr.getStops()
    const busPositions = this.ui._getBusPositions(stops, this.etaMgr.getEtaMap())
    await this.mapMgr.load(stops, busPositions, this._company === 'ctb')
    this.mapMgr.show()
    $('#viewToggleBtn').text('📋')
  }
})
```

#### Reset View on Navigation
**File:** `js/app.js` - `_navigate()` method

After rendering route view, ensure list view is shown:
```javascript
this.mapMgr.hide()
$('#viewToggleBtn').text('🗺️')
```

### 4. Styling

**File:** `css/style.css`

```css
/* View Toggle Button */
.view-toggle-btn {
  font-size: 16px; 
  border: none; 
  background: none;
  cursor: pointer; 
  padding: 4px 8px;
  transition: transform .15s;
}
.view-toggle-btn:hover { 
  transform: scale(1.1);
}

/* View Container */
.view-container {
  flex: 1;
  position: relative;
}

/* Map View */
.map-view {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f9fafb;
}

/* Bus Icon on Map */
.bus-map-icon {
  font-size: 24px;
  text-align: center;
  line-height: 28px;
}
```

## Performance Considerations

### Lazy Loading Strategy
1. **Leaflet library** (~40KB gzipped) - only loaded when toggle clicked
2. **OSRM API calls** - only made when map is shown
3. **Map tiles** - only loaded when map is visible

### Caching
- Cache OSRM route geometry in `MapManager` to avoid re-fetching on toggle
- Leaflet library stays in browser cache after first load

### Fallback
- If OSRM API fails, show straight lines between stops (still useful)
- If Leaflet fails to load, show error message

## Testing Checklist

- [ ] Toggle button appears in toolbar with 🗺️ icon
- [ ] Clicking button switches to map view (button shows 📋)
- [ ] Map shows route following actual roads
- [ ] Stop markers show with sequence numbers
- [ ] Bus icons appear between stops
- [ ] Map uses correct color (red for KMB, green for CTB)
- [ ] Clicking button again switches back to list view (button shows 🗺️)
- [ ] Switching bounds resets to list view
- [ ] Switching company resets to list view
- [ ] Map works on mobile devices
- [ ] No console errors when map not used
- [ ] Page load time unchanged when map not used
- [ ] Map resizes correctly when toggled
- [ ] Map remembers zoom/position when toggling back and forth

## Future Enhancements

1. **GTFS integration** - Use official route shapes from data.gov.hk if available
2. **Real-time bus positions** - Show actual bus locations if GPS data available
3. **Map interactions** - Click stop marker to scroll to stop in list
4. **Offline support** - Cache map tiles for offline use
5. **Alternative tile providers** - Add option for Mapbox, Stadia Maps, etc.
