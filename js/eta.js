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
   * Determines bus icon placement PER BUS (eta_seq), using DISPLAYED minutes.
   * Each active bus gets its own icon — at its closest stop or between stops.
   *
   *   diffMin <= 1 → 🚌 AT that stop
   *   diffMin >= 2 → 🚌 BETWEEN prev stop and that stop
   */
  computePlacements(stops) {
    const atStop = new Set()
    const between = []
    const mapPositions = []

    if (!stops || stops.length < 2) return { atStop, between, mapPositions }

    const stopCoords = {}
    stops.forEach(s => { stopCoords[s.seq] = { lat: parseFloat(s.lat), lng: parseFloat(s.long) } })

    // Group ETA by bus (eta_seq), filtered by current bound
    const buses = {}
    this._allEta.forEach(eta => {
      if (eta.dir !== this._bound) return
      if (!eta.eta) return
      const vid = `${eta.service_type}-${eta.eta_seq}`
      if (!buses[vid]) buses[vid] = []
      buses[vid].push({ seq: parseInt(eta.seq, 10), eta: new Date(eta.eta) })
    })

    const now = Date.now()

    for (const vid of Object.keys(buses)) {
      const sorted = buses[vid].sort((a, b) => a.seq - b.seq)

      // Compute displayed minutes (Math.floor) for each stop this bus serves
      let bestSeq = null, bestMin = Infinity
      for (const s of sorted) {
        const diffMs = s.eta.getTime() - now
        if (diffMs < -120000) continue // departed >2min ago
        const min = Math.floor(diffMs / 60000)
        if (min < 0 && diffMs < -60000) continue // negative floor with <1min grace
        const adjMin = min < 0 ? 0 : min
        if (adjMin < bestMin) {
          bestMin = adjMin
          bestSeq = s.seq
        }
      }

      if (bestSeq === null) continue // no valid stop for this bus

      const bestIdx = stops.findIndex(s => s.seq === bestSeq)
      Logger.api('PLACEMENT', `Bus ${vid}: closest at stop ${bestSeq} (${bestMin} min)`)

      if (bestMin <= 1) {
        atStop.add(bestSeq)
        const coord = stopCoords[bestSeq]
        if (coord && !isNaN(coord.lat)) {
          mapPositions.push({ lat: coord.lat, lng: coord.lng, type: 'at_stop', fromSeq: bestSeq, toSeq: bestSeq, progress: 0 })
        }
      } else {
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
