/**
 * EtaManager — polls ETA for multiple service types, merges by seq.
 * Computes bus positions between stops using eta_seq (vehicle ID).
 * Public API: start(route, bound, types), stop(), getEtaMap(), getBusPositions(stops)
 */
class EtaManager {
  constructor(api) {
    this.api = api
    this._etaMap = {}
    this._allEta = []
    this._loading = false
    this._interval = null
    this._route = null
    this._bound = null
    this._types = []
    this._pollCount = 0
    this._abort = null
  }

  getEtaMap() { return this._etaMap }
  getAllEta() { return this._allEta }
  isLoading() { return this._loading }

  getBusPositions(stops) {
    if (!stops || stops.length < 2 || !this._allEta.length) return []

    const stopCoords = {}
    stops.forEach(s => { stopCoords[s.seq] = { lat: parseFloat(s.lat), lng: parseFloat(s.long) } })

    // Filter by current bound, group by bus (eta_seq)
    const buses = {}
    this._allEta.forEach(eta => {
      if (eta.dir !== this._bound) return
      if (!eta.eta) return
      const vid = `${eta.service_type}-${eta.eta_seq}`
      if (!buses[vid]) buses[vid] = []
      buses[vid].push({ seq: parseInt(eta.seq, 10), eta: new Date(eta.eta), svc: eta.service_type })
    })

    const now = new Date()
    const positions = []
    const AT_STOP_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

    for (const vid of Object.keys(buses)) {
      const stops = buses[vid].sort((a, b) => a.seq - b.seq)
      const nowTime = now.getTime()

      // Find the segment where now falls between stop[N].eta and stop[N+1].eta
      for (let i = 0; i < stops.length - 1; i++) {
        const cur = stops[i]
        const next = stops[i + 1]
        if (next.seq - cur.seq !== 1) continue
        
        const curTime = cur.eta.getTime()
        const nextTime = next.eta.getTime()
        
        // Skip if times are invalid
        if (nextTime <= curTime) continue
        
        // Check if now is between these two stops
        if (nowTime >= curTime && nowTime < nextTime) {
          const timeToNext = nextTime - nowTime
          const progress = (nowTime - curTime) / (nextTime - curTime)
          
          // Log time calculations for debugging
          Logger.api('BUS_TIME', `Bus ${vid}: stop ${cur.seq}→${next.seq}, now=${now.toISOString()}, cur=${cur.eta.toISOString()}, next=${next.eta.toISOString()}, timeToNext=${Math.round(timeToNext/1000)}s, progress=${progress.toFixed(3)}`)
          
          // Type 1: AT stop (arriving in < 2 minutes)
          if (timeToNext < AT_STOP_THRESHOLD_MS) {
            const coord = stopCoords[next.seq]
            if (coord && !isNaN(coord.lat)) {
              positions.push({
                lat: coord.lat,
                lng: coord.lng,
                etaSeq: vid,
                fromSeq: cur.seq,
                toSeq: next.seq,
                progress,
                type: 'at_stop',
              })
            }
          }
          // Type 2: BETWEEN stops (next stop >= 2 minutes away)
          else {
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
                type: 'between',
              })
            }
          }
          break // Bus found, move to next bus
        }
      }
    }

    return positions
  }

  start(route, bound, types) {
    this.stop()
    this._route = route
    this._bound = bound
    this._types = types
    this._poll()
    this._interval = setInterval(() => this._poll(), 30000)
  }

  stop() {
    if (this._interval) { clearInterval(this._interval); this._interval = null }
    if (this._abort) { this._abort.abort(); this._abort = null }
    this._route = null
    this._bound = null
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
      const all = results.filter(Boolean).flatMap(r => r.data || [])
      this._allEta = all

      // Build etaMap filtered by current bound
      const map = {}
      all.forEach(eta => {
        if (eta.dir !== this._bound) return
        const key = `${eta.seq}`
        if (!map[key]) map[key] = []
        map[key].push(eta)
      })
      this._etaMap = map
      Logger.api('ETA', `poll #${this._pollCount}: ${all.length} total, ${Object.keys(map).length} stops (bound=${this._bound})`)
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
