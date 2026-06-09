/**
 * EtaManager — polls ETA for multiple service types, merges by seq.
 * Public API: start(route, bound, types), stop(), getEtaMap(), computePlacements(stops)
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
    this._lastTimestamp = null
    this._converged = false
  }

  getEtaMap() { return this._etaMap }
  getAllEta() { return this._allEta }
  isLoading() { return this._loading }

  /**
   * Single function that determines where every bus icon should go.
   * Returns:
   *   atStop: Set<seq>        — stop numbers whose circle is replaced by 🚌
   *   between: [{fromSeq,toSeq}] — pairs that get a 🚌 overlay between rows
   *   mapPositions: [...]     — {lat, lng, type, fromSeq, toSeq, progress} for map
   */
  computePlacements(stops) {
    const atStop = new Set()
    const between = []
    const mapPositions = []

    if (!stops || stops.length < 2 || !this._allEta.length) return { atStop, between, mapPositions }

    // Build coordinate lookup
    const stopCoords = {}
    stops.forEach(s => { stopCoords[s.seq] = { lat: parseFloat(s.lat), lng: parseFloat(s.long) } })

    // Group ETA by bound + bus (eta_seq)
    const buses = {}
    this._allEta.forEach(eta => {
      if (eta.dir !== this._bound) return
      if (!eta.eta) return
      const vid = `${eta.service_type}-${eta.eta_seq}`
      if (!buses[vid]) buses[vid] = []
      buses[vid].push({ seq: parseInt(eta.seq, 10), eta: new Date(eta.eta) })
    })

    const now = Date.now()
    const AT_MS = 90 * 1000

    for (const vid of Object.keys(buses)) {
      const sorted = buses[vid].sort((a, b) => a.seq - b.seq)
      for (let i = 0; i < sorted.length - 1; i++) {
        const cur = sorted[i]
        const next = sorted[i + 1]
        if (next.seq - cur.seq !== 1) continue

        const curT = cur.eta.getTime()
        const nextT = next.eta.getTime()
        if (nextT <= curT) continue

        if (now >= curT && now < nextT) {
          const timeToNext = nextT - now
          const progress = (now - curT) / (nextT - curT)

          Logger.api('BUS_TIME', `Bus ${vid}: stop ${cur.seq}→${next.seq}, now=${new Date(now).toISOString()}, cur=${cur.eta.toISOString()}, next=${next.eta.toISOString()}, timeToNext=${Math.round(timeToNext/1000)}s, progress=${progress.toFixed(3)}`)

          if (timeToNext < AT_MS) {
            // Type 1: AT destination stop
            atStop.add(next.seq)
            const coord = stopCoords[next.seq]
            if (coord && !isNaN(coord.lat)) {
              mapPositions.push({ lat: coord.lat, lng: coord.lng, type: 'at_stop', fromSeq: cur.seq, toSeq: next.seq, progress })
            }
          } else {
            // Type 2: BETWEEN stops
            atStop.add(next.seq)
            between.push({ fromSeq: cur.seq, toSeq: next.seq })
            const from = stopCoords[cur.seq]
            const to = stopCoords[next.seq]
            if (from && to && !isNaN(from.lat) && !isNaN(to.lat)) {
              mapPositions.push({
                lat: from.lat + (to.lat - from.lat) * progress,
                lng: from.lng + (to.lng - from.lng) * progress,
                type: 'between', fromSeq: cur.seq, toSeq: next.seq, progress,
              })
            }
          }
          break
        }
      }
    }

    return { atStop, between, mapPositions }
  }

  start(route, bound, types) {
    this.stop()
    this._route = route
    this._bound = bound
    this._types = types
    this._lastTimestamp = null
    this._converged = false
    this._poll()
    this._schedule(10)
  }

  stop() {
    if (this._interval) { clearInterval(this._interval); this._interval = null }
    if (this._abort) { this._abort.abort(); this._abort = null }
    this._route = null
    this._bound = null
    this._types = []
    this._etaMap = {}
    this._allEta = []
    this._converged = false
    this._lastTimestamp = null
  }

  _schedule(sec) {
    if (this._interval) clearInterval(this._interval)
    this._interval = setInterval(() => this._poll(), sec * 1000)
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

      const latestTs = all.length ? all[0].data_timestamp : null
      if (latestTs && latestTs === this._lastTimestamp) {
        Logger.api('ETA_SKIP', `poll #${this._pollCount}: timestamp unchanged (${latestTs}) ${this._converged ? 'settled 60s' : 'fast 10s'}`)
        return
      }

      if (this._lastTimestamp !== null) {
        this._converged = true
        this._schedule(60)
      }
      this._lastTimestamp = latestTs
      this._allEta = all

      const map = {}
      all.forEach(eta => {
        if (eta.dir !== this._bound) return
        const key = `${eta.seq}`
        if (!map[key]) map[key] = []
        map[key].push(eta)
      })
      this._etaMap = map

      Logger.api('ETA', `poll #${this._pollCount}: ${all.length} total, ${Object.keys(map).length} stops (bound=${this._bound}) ts=${latestTs}`)
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
