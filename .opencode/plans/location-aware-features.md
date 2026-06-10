# Location-Aware Bus Stop Enhancement Plan

## Overview

Add geolocation-based features to the HK Bus Tracker app:
1. Request location permission; gracefully degrade if denied
2. Auto-scroll stop list to nearest bus stop (centered in viewport)
3. Show user's current location on the map
4. Display walking distance to the nearest 4 bus stops
5. Click a bus stop to see a walking path from user to that stop

## Files to Create

### `js/location.js` — New `LocationManager` class

```
class LocationManager
├── requestPermission()           → Promise<boolean>
│   └── Calls navigator.geolocation.getCurrentPosition()
│       ├── On success: sets _permitted=true, stores position, starts watchPosition
│       └── On failure: sets _permitted=false, resolves false
├── _startWatching()              → starts navigator.geolocation.watchPosition()
├── _updatePosition(pos)          → stores {lat, lng}, notifies watchers
├── onPosition(fn)                → register callback for position updates
├── getPosition()                 → {lat, lng} | null
├── isPermitted()                 → boolean
├── haversineDistance(lat1,lng1,lat2,lng2) → meters (straight-line)
├── getNearestStops(stops, count) → [{stop, distance}] sorted ascending (top `count`)
├── fetchWalkingDistance(from,to) → Promise<{distance(m), duration(s)}> via OSRM walking
├── fetchWalkingRoute(from,to)    → Promise<GeoJSON LineString|null> via OSRM walking
└── destroy()                     → clearWatch + cleanup
```

**OSRM walking endpoint:** `https://router.project-osrm.org/route/v1/walking/{lng1},{lat1};{lng2},{lat2}?geometries=geojson&overview=full`

## Files to Modify

### 1. `index.html` (line ~25)

Add `<script src="js/location.js"></script>` **before** `js/app.js`:

```html
<script src="js/logger.js"></script>
<script src="js/lang.js"></script>
<script src="js/api.js"></script>
<script src="js/route.js"></script>
<script src="js/eta.js"></script>
<script src="js/ui.js"></script>
<script src="js/map.js"></script>
<script src="js/location.js"></script>   ← NEW
<script src="js/app.js"></script>
```

---

### 2. `js/app.js` — `BusTrackerApp`

**Constructor** (line 6-18):
- Add `this.locMgr = new LocationManager()`

**`init()`** (line 49-75):
- After existing init logic, call `this.locMgr.requestPermission()` (async, non-blocking)
- On permission granted, if currently viewing a route, trigger location-aware updates
- Register `this.locMgr.onPosition()` to re-render stop list distances and update map marker

**`_navigate()`** (line 188-232):
- After `renderStopList()`, if location permitted:
  - Call `this.ui.scrollToNearestStop(stops, this.locMgr)` to auto-scroll
  - Call `this.ui.showWalkingDistances(stops, this.locMgr)` to annotate nearest 4

**`eta:update` handler** (line 103-118):
- After `renderStopList()`, if location permitted:
  - Re-apply walking distances and re-scroll (only on first ETA update, not every poll)

**`view:toggle` handler** (line 125-135):
- Pass `this.locMgr.getPosition()` to `this.mapMgr.load()` as a new `userPos` parameter

**New event: `stop:click`**:
- Listen for `$(document).on('stop:click', ...)` 
- When a stop is clicked, if location permitted:
  - Switch to map view (if not already)
  - Call `this.mapMgr.showWalkingPath(userPos, stop)` to draw walking route

**`_tearDownRoute()`** (line 234-237):
- Call `this.mapMgr.clearWalkingPath()` to clean up

---

### 3. `js/ui.js` — `UIManager`

**`renderStopList()`** (line 177-215):
- Add `data-stop-id`, `data-lat`, `data-long` attributes to each `.stop-row` for click handling
- Add a CSS class hook for distance display

**New method: `scrollToNearestStop(stops, locMgr)`**:
```
1. Get nearest stop via locMgr.getNearestStops(stops, 1)
2. Find the DOM element: .stop-row[data-seq="{nearest.stop.seq}"]
3. Calculate scroll offset to center the row in the viewport:
   - const container = $('#stopList').parent() (the .view-container)
   - const rowTop = element offset relative to scrollable container
   - const containerHeight = container.height()
   - const scrollTarget = rowTop - containerHeight/2 + rowHeight/2
4. Animate scroll: container.animate({scrollTop: scrollTarget}, 400)
```

**New method: `showWalkingDistances(stops, locMgr)`**:
```
1. Get nearest 4 stops: locMgr.getNearestStops(stops, 4)
2. For each, call locMgr.fetchWalkingDistance(userPos, stopPos)
3. Update the DOM: for each nearest stop's .stop-row, append a walking distance badge:
   <span class="walk-dist">{distance}m · {duration}min</span>
4. Format: distance in meters (e.g. "120m"), duration in minutes (e.g. "2分鐘")
```

**New method: `bindStopClickEvents()`**:
```
$(document).on('click', '.stop-row', function() {
  const seq = $(this).data('seq')
  const lat = parseFloat($(this).data('lat'))
  const lng = parseFloat($(this).data('long'))
  const name = $(this).find('.stop-name').text()
  $(document).trigger('stop:click', [{ seq, lat, lng, name }])
})
```

Call `bindStopClickEvents()` once in constructor or init.

**Modify `renderStopList()` HTML generation** (around line 201):
```javascript
// Change from:
html += `<div class="stop-row" data-seq="${i + 1}">`

// To:
html += `<div class="stop-row" data-seq="${i + 1}" data-stop-id="${stop.stopId}" data-lat="${stop.lat}" data-long="${stop.long}">`
```

Also add a placeholder for walking distance:
```javascript
html += `<div class="stop-eta-col">${etaText.html}<div class="walk-dist-slot" data-seq="${i + 1}"></div></div>`
```

---

### 4. `js/map.js` — `MapManager`

**Constructor** (line 10-17):
- Add `this._userMarker = null` and `this._walkLayer = null`

**`load(stops, busPositions, isCtb, userPos)`** — new `userPos` parameter:
- After drawing stops/buses, if `userPos` is provided:
  - Call `this._drawUserLocation(userPos)`
- Adjust `_fitBoundsSafe` to optionally include user position in bounds

**New method: `_drawUserLocation(pos)`**:
```javascript
_drawUserLocation(pos) {
  if (this._userMarker) this._map.removeLayer(this._userMarker)
  const icon = L.divIcon({
    html: '<div class="user-loc-dot"><div class="user-loc-pulse"></div></div>',
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
  this._userMarker = L.marker([pos.lat, pos.lng], { icon }).addTo(this._map)
}
```

**New method: `updateUserPosition(pos)`**:
- Updates the user marker position without full reload
- Called from `locMgr.onPosition()` callback

**New method: `async showWalkingPath(from, toStop)`**:
```javascript
async showWalkingPath(from, toStop) {
  this.clearWalkingPath()
  const geometry = await this.fetchWalkingRoute(from, { lat: toStop.lat, lng: toStop.long })
  if (!geometry) return
  this._walkLayer = L.geoJSON(geometry, {
    style: { color: '#3b82f6', weight: 5, opacity: 0.8, dashArray: '8,8' }
  }).addTo(this._map)
  
  // Highlight the clicked stop with a larger marker
  const highlightIcon = L.divIcon({
    html: '<div class="stop-highlight-dot"></div>',
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
  this._walkStopMarker = L.marker([toStop.lat, toStop.long], { icon: highlightIcon }).addTo(this._map)
  
  // Fit bounds to show both user and stop
  const bounds = L.latLngBounds([from.lat, from.lng], [toStop.lat, toStop.long])
  this._map.fitBounds(bounds, { padding: [60, 60] })
}
```

**New method: `clearWalkingPath()`**:
```javascript
clearWalkingPath() {
  if (this._walkLayer) { this._map.removeLayer(this._walkLayer); this._walkLayer = null }
  if (this._walkStopMarker) { this._map.removeLayer(this._walkStopMarker); this._walkStopMarker = null }
}
```

**`_clearLayers()`** (line 74-81):
- Also clear `_userMarker` and `_walkLayer`

---

### 5. `css/style.css` — New styles

**Walking distance badge:**
```css
.walk-dist-slot {
  margin-top: 2px;
}
.walk-dist {
  display: inline-block;
  font-size: 10px;
  color: #3b82f6;
  font-weight: 500;
  background: #eff6ff;
  border-radius: 4px;
  padding: 1px 6px;
  margin-top: 2px;
}
```

**Nearest stop highlight (subtle background):**
```css
.stop-row.nearest-stop {
  background: #f0f9ff;
}
```

**Stop row clickable cursor:**
```css
.stop-row {
  cursor: pointer;
}
```

**User location dot on map:**
```css
.user-loc-dot {
  width: 14px;
  height: 14px;
  background: #3b82f6;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(59,130,246,0.5);
  position: relative;
}
.user-loc-pulse {
  position: absolute;
  inset: -8px;
  border: 2px solid rgba(59,130,246,0.3);
  border-radius: 50%;
  animation: userLocPulse 2s ease-out infinite;
}
@keyframes userLocPulse {
  0% { transform: scale(0.5); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}
```

**Stop highlight on map (when walking path shown):**
```css
.stop-highlight-dot {
  width: 16px;
  height: 16px;
  background: #3b82f6;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(59,130,246,0.6);
}
```

---

## Implementation Order

| Step | File | Action |
|------|------|--------|
| 1 | `js/location.js` | Create new file |
| 2 | `index.html` | Add script tag |
| 3 | `css/style.css` | Add new styles |
| 4 | `js/map.js` | Add user location + walking path methods |
| 5 | `js/ui.js` | Add scroll, distance display, click events |
| 6 | `js/app.js` | Wire everything together |

## Key Design Decisions

1. **Graceful degradation**: If `requestPermission()` returns `false`, all location features are silently skipped — no UI changes, no errors. The app works exactly as before.

2. **Haversine for nearest detection, OSRM for display**: Straight-line distance is used to quickly find the nearest stops (no network needed), then OSRM walking API is called only for the nearest 4 to get accurate walking distance/duration.

3. **Auto-scroll only on first load**: The scroll-to-nearest only happens once when the stop list first renders (not on every ETA update), to avoid disrupting the user's scroll position.

4. **Walking path uses OSRM walking profile**: Same routing engine already used for bus routes, but with `/walking/` profile instead of `/driving/`.

5. **Position updates via watchPosition**: The user marker on the map updates in real-time as the user moves, using `watchPosition` with `maximumAge: 5000` for battery efficiency.

6. **Stop click triggers map view**: Clicking a stop row automatically switches to map view (if in list view) and draws the walking path.
