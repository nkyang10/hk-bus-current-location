/**
 * EtaManager — polls ETA for multiple service types, merges by seq.
 * Computes bus positions between stops using eta_seq (vehicle ID).
 * Public API: start(route, types), stop(), getEtaMap(), getBusPositions(stops)
 */
class EtaManager {
  constructor(api) {
    this.api = api
    this._etaMap = {}
    this._allEta = []
    this._loading = false
    this._interval = null
    this._route = null
    this._types = []
    this._pollCount = 0
    this._abort = null
  }

  getEtaMap() { return this._etaMap }
  getAllEta() { return this._allEta }
  isLoading() { return this._loading }

  /**
   * Compute interpolated positions for each bus between stops.
   * Returns array of { lat, lng, etaSeq, fromStop, toStop, progress }
   */
  getBusPositions(stops) {
    if (!stops || stops.length < 2 || !this._allEta.length) return []

    // Build lookup: stopSeq -> lat/lng
    const stopCoords = {}
    stops.forEach(s => { stopCoords[s.seq] = { lat: parseFloat(s.lat), lng: parseFloat(s.long) } })

    // Group all ETA items by eta_seq (bus vehicle ID)
    const buses = {}
    this._allEta.forEach(eta => {
      const vid = `${eta.service_type}-${eta.eta_seq}`
      if (!eta.eta) return
      if (!buses[vid]) buses[vid] = []
      buses[vid].push({ seq: parseInt(eta.seq, 10), eta: new Date(eta.eta), svc: eta.service_type })
    })

    const now = new Date()
    const positions = []

    for (const vid of Object.keys(buses)) {
      const stops = buses[vid].sort((a, b) => a.seq - b.seq)
      for (let i = 0; i < stops.length - 1; i++) {
        const cur = stops[i]
        const next = stops[i + 1]
        // Skip non-consecutive stops
        if (next.seq - cur.seq !== 1) continue

        const curTime = cur.eta.getTime()
        const nextTime = next.eta.getTime()
        const nowTime = now.getTime()

        // Bus is between cur and next if now is between their ETA times
        if (nowTime >= curTime && nowTime < nextTime && nextTime > curTime) {
          const progress = (nowTime - curTime) / (nextTime - curTime)
          const from = stopCoords[cur.seq]
          const to = stopCoords[next.seq]
          if (from && to && !isNaN(from.lat) && !isNaN(to.lat)) {
            positions.push({
              lat: from.lat + (to.lat - from.lat) * progress,
              lng: from.lng + (to.lng - from.lng) * progress,
              etaSeq: vid,
              fromSeq: cur.seq,
              toSeq: next.seq,
              progress,
            })
          }
        }
      }
    }

    return positions
  }

  start(route, types) {
    this.stop()
    this._route = route
    this._types = types
    this._poll()
    this._interval = setInterval(() => this._poll(), 30000)
  }

  stop() {
    if (this._interval) { clearInterval(this._interval); this._interval = null }
    if (this._abort) { this._abort.abort(); this._abort = null }
    this._route = null
    this._types = []
    this._etaMap = {}
    this._allEta = []
  }

  async _poll() {
    if (!this._route || this._types.length === 0) return

    if (this._abort) this._abort.abort()
    const controller = new AbortController()
    this._abort = controller

    this._pollCount++
    this._loading = true
    $(document).trigger('eta:loading', [true])

    try {
      const results = await Promise.all(
        this._types.map(svc => this.api.fetchRouteEta(this._route, svc).catch(() => null))
      )
      this._allEta = results.filter(Boolean).flatMap(r => r.data || [])
      const map = {}
      this._allEta.forEach(eta => {
        const key = `${eta.seq}`
        if (!map[key]) map[key] = []
        map[key].push(eta)
      })
      this._etaMap = map
      Logger.api('ETA', `poll #${this._pollCount}: ${this._allEta.length} items across ${this._types.length} types`)
      $(document).trigger('eta:update', [map])
    } catch (err) {
      if (err.name === 'AbortError') return
      Logger.warn('ETA', `poll #${this._pollCount} failed`, { error: err.message })
    } finally {
      this._loading = false
      $(document).trigger('eta:loading', [false])
    }
  }
}
