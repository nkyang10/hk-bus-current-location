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
    return 'denied'
  }

  getNearestStops(stops, count) {
    return GeoUtils.getNearestStops(this._position, stops, count)
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
