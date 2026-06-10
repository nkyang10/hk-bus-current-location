class LocationManager {
  constructor() {
    this._position = null
    this._watchId = null
    this._permitted = false
    this._watchers = []
  }

  requestPermission() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        Logger.warn('LOC', 'Geolocation not supported')
        resolve(false)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this._permitted = true
          this._updatePosition(pos)
          this._startWatching()
          resolve(true)
        },
        (err) => {
          this._permitted = false
          Logger.warn('LOC', 'Permission denied: ' + err.message)
          resolve(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }

  _startWatching() {
    if (this._watchId !== null) return
    this._watchId = navigator.geolocation.watchPosition(
      (pos) => this._updatePosition(pos),
      (err) => Logger.warn('LOC', 'Watch error: ' + err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  }

  _updatePosition(pos) {
    this._position = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    this._watchers.forEach(fn => fn(this._position))
  }

  onPosition(fn) {
    this._watchers.push(fn)
  }

  getPosition() {
    return this._position
  }

  isPermitted() {
    return this._permitted
  }

  getStatus() {
    if (!navigator.geolocation) return 'unavailable'
    if (this._permitted && this._position) return 'granted'
    if (this._permitted && !this._position) return 'unknown'
    if (!this._permitted) return 'denied'
    return 'unknown'
  }

  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000
    const toRad = (d) => d * Math.PI / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  getNearestStops(stops, count) {
    if (!this._position || !stops) return []
    const withDist = stops
      .filter(s => s.lat != null && s.long != null && isFinite(s.lat) && isFinite(s.long))
      .map(s => ({
        stop: s,
        distance: this.haversineDistance(this._position.lat, this._position.lng, s.lat, s.long),
      }))
      .sort((a, b) => a.distance - b.distance)
    return withDist.slice(0, count || 4)
  }

  async fetchWalkingDistance(from, to) {
    const url = `https://router.project-osrm.org/route/v1/walking/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
    try {
      const res = await fetch(url)
      const data = await res.json()
      if (data.routes && data.routes[0]) {
        return {
          distance: data.routes[0].distance,
          duration: data.routes[0].duration,
        }
      }
    } catch {
      Logger.warn('LOC', 'Walking distance fetch failed')
    }
    return null
  }

  async fetchWalkingRoute(from, to) {
    const url = `https://router.project-osrm.org/route/v1/walking/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full`
    try {
      const res = await fetch(url)
      const data = await res.json()
      if (data.routes && data.routes[0]) {
        return data.routes[0].geometry
      }
    } catch {
      Logger.warn('LOC', 'Walking route fetch failed')
    }
    return null
  }

  destroy() {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId)
      this._watchId = null
    }
    this._watchers = []
  }

  retry() {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId)
      this._watchId = null
    }
    this._position = null
    this._permitted = false
    return this.requestPermission()
  }
}
