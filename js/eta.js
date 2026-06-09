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
   * Determines bus icon placement using per-stop DISPLAYED minutes.
   * Finds the single stop with the smallest displayed minutes (closest bus).
   *
   *   diffMin <= 1 → 🚌 AT that stop (shows "到站" or "1 分鐘")
   *   diffMin >= 2 → 🚌 BETWEEN prev stop and that stop (shows "2+ 分鐘")
   */
  computePlacements(stops) {
    const atStop = new Set()
    const between = []
    const mapPositions = []

    if (!stops || stops.length < 2) return { atStop, between, mapPositions }

    const stopCoords = {}
    const stopMinutes = {} // seq → displayed minutes (Math.floor)
    const now = Date.now()

    stops.forEach(s => {
      stopCoords[s.seq] = { lat: parseFloat(s.lat), lng: parseFloat(s.long) }

      // Find nearest future ETA at this stop (from bound-filtered etaMap)
      const items = (this._etaMap[String(s.seq)] || []).filter(e => e.eta)
      const future = items
        .map(e => ({ eta: new Date(e.eta) }))
        .filter(e => e.eta.getTime() > now - 120000)
        .sort((a, b) => a.eta.getTime() - b.eta.getTime())

      if (future.length) {
        const diffMs = future[0].eta.getTime() - now
        stopMinutes[s.seq] = Math.floor(diffMs / 60000)
      }
    })

    // Find the single stop with the smallest displayed minutes
    const seqs = stops.map(s => s.seq).filter(s => stopMinutes[s] !== undefined)
    if (!seqs.length) return { atStop, between, mapPositions }

    const bestSeq = seqs.reduce((a, b) => stopMinutes[a] < stopMinutes[b] ? a : b)
    const bestMin = stopMinutes[bestSeq]
    const bestIdx = stops.findIndex(s => s.seq === bestSeq)

    Logger.api('PLACEMENT', `closest bus at stop ${bestSeq} (${bestMin} min)`)

    if (bestMin <= 1) {
      // 🚌 AT this stop — arriving in 0-1 minutes
      atStop.add(bestSeq)
      const coord = stopCoords[bestSeq]
      if (coord && !isNaN(coord.lat)) {
        mapPositions.push({ lat: coord.lat, lng: coord.lng, type: 'at_stop', fromSeq: bestSeq, toSeq: bestSeq, progress: 0 })
      }
    } else {
      // 🚌 BETWEEN previous and this stop — 2+ minutes away
      const prevSeq = bestIdx > 0 ? stops[bestIdx - 1].seq : null
      if (prevSeq !== null) {
        atStop.add(bestSeq)
        between.push({ fromSeq: prevSeq, toSeq: bestSeq })
        const from = stopCoords[prevSeq]
        const to = stopCoords[bestSeq]
        if (from && to && !isNaN(from.lat) && !isNaN(to.lat)) {
          mapPositions.push({
            lat: from.lat + (to.lat - from.lat) * 0.5,
            lng: from.lng + (to.lng - from.lng) * 0.5,
            type: 'between', fromSeq: prevSeq, toSeq: bestSeq, progress: 0.5,
          })
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
