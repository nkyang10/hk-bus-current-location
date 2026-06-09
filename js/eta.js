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
   * Per-stop bus placement using DISPLAYED minutes.
   *
   * 1. Closest stop (smallest minutes):
   *      <= 1 → 🚌 AT that stop
   *      >= 2 → 🚌 BETWEEN prev and that stop
   * 2. For every consecutive pair (N, N+1):
   *      IF stop N+1 >= 2 min AND stop N > stop N+1 min
   *      → bus passed N, heading to N+1 → 🚌 BETWEEN N and N+1
   */
  computePlacements(stops) {
    const atStop = new Set()
    const between = []
    const mapPositions = []

    if (!stops || stops.length < 2) return { atStop, between, mapPositions }

    const stopCoords = {}
    const m = {} // stopMinutes: seq → displayed minutes (Math.floor)
    const now = Date.now()

    stops.forEach(s => {
      stopCoords[s.seq] = { lat: parseFloat(s.lat), lng: parseFloat(s.long) }
      const items = (this._etaMap[String(s.seq)] || []).filter(e => e.eta)
      const future = items
        .map(e => ({ eta: new Date(e.eta) }))
        .filter(e => e.eta.getTime() > now - 120000)
        .sort((a, b) => a.eta.getTime() - b.eta.getTime())
      if (future.length) {
        m[s.seq] = Math.floor((future[0].eta.getTime() - now) / 60000)
      }
    })

    const seqs = stops.map(s => s.seq).filter(s => m[s] !== undefined)
    if (!seqs.length) return { atStop, between, mapPositions }

    // 1. Closest stop globally
    const bestSeq = seqs.reduce((a, b) => m[a] < m[b] ? a : b)
    const bestMin = m[bestSeq]
    const bestIdx = stops.findIndex(s => s.seq === bestSeq)

    Logger.api('PLACEMENT', `closest at stop ${bestSeq} (${bestMin} min)`)

    if (bestMin <= 1) {
      atStop.add(bestSeq)
      const c = stopCoords[bestSeq]
      if (c && !isNaN(c.lat)) mapPositions.push({ lat: c.lat, lng: c.lng, type: 'at_stop', fromSeq: bestSeq, toSeq: bestSeq, progress: 0 })
    } else {
      const prev = bestIdx > 0 ? stops[bestIdx - 1].seq : null
      if (prev !== null) {
        atStop.add(bestSeq)
        between.push({ fromSeq: prev, toSeq: bestSeq })
        const f = stopCoords[prev]; const t = stopCoords[bestSeq]
        if (f && t && !isNaN(f.lat)) mapPositions.push({ lat: (f.lat + t.lat) / 2, lng: (f.lng + t.lng) / 2, type: 'between', fromSeq: prev, toSeq: bestSeq, progress: 0.5 })
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
