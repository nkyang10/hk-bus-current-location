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

  _decodePolyline(encoded) {
    const coordinates = []
    let index = 0
    let lat = 0
    let lng = 0

    while (index < encoded.length) {
      let shift = 0
      let result = 0
      let byte

      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)

      lat += (result & 1) ? ~(result >> 1) : (result >> 1)

      shift = 0
      result = 0

      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)

      lng += (result & 1) ? ~(result >> 1) : (result >> 1)

      coordinates.push([lat / 1e6, lng / 1e6])
    }

    return coordinates
  }

  async fetchWalkingDistance(from, to) {
    const url = 'https://valhalla1.openstreetmap.de/route'
    const body = {
      locations: [
        { lon: from.lng, lat: from.lat, search_radius: 100, type: 'break' },
        { lon: to.lng, lat: to.lat, search_radius: 100, type: 'break' }
      ],
      costing: 'pedestrian',
      directions_options: { units: 'meters' }
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        Logger.warn('LOC', `Valhalla HTTP error: ${res.status}`)
        return null
      }
      const data = await res.json()
      if (data.trip && data.trip.legs && data.trip.legs.length > 0) {
        return {
          distance: data.trip.legs[0].summary.length,
          duration: data.trip.legs[0].summary.time
        }
      }
      Logger.warn('LOC', 'Valhalla: no route found')
    } catch (err) {
      Logger.warn('LOC', `Walking distance fetch failed: ${err.message}`)
    }
    return null
  }

  async fetchWalkingRoute(from, to) {
    const url = 'https://valhalla1.openstreetmap.de/route'
    const body = {
      locations: [
        { lon: from.lng, lat: from.lat, search_radius: 100, type: 'break' },
        { lon: to.lng, lat: to.lat, search_radius: 100, type: 'break' }
      ],
      costing: 'pedestrian',
      directions_options: { units: 'meters' }
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        Logger.warn('LOC', `Valhalla HTTP error: ${res.status}`)
        return null
      }
      const data = await res.json()
      if (data.trip && data.trip.legs && data.trip.legs.length > 0) {
        const encoded = data.trip.legs[0].shape
        const coords = this._decodePolyline(encoded)
        return {
          type: 'LineString',
          coordinates: coords.map(c => [c[1], c[0]])
        }
      }
      Logger.warn('LOC', 'Valhalla: no route found')
    } catch (err) {
      Logger.warn('LOC', `Walking route fetch failed: ${err.message}`)
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
