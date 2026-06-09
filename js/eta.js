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
   * Determines bus icon placement using DISPLAYED minutes (same as stop list).
   * This guarantees the icon always matches what the user sees.
   *
   * For each stop, finds the nearest future bus ETA and computes displayed
   * minutes using Math.floor (same as UIManager._formatEta).
   *
   *   diffMin = 0 → "到站 Due"     → 🚌 AT this stop
   *   diffMin = 1 → "1 分鐘"       → 🚌 AT this stop (approaching)
   *   diffMin >= 2 → "2+ 分鐘"     → 🚌 BETWEEN prev stop and this stop
   */
  computePlacements(stops) {
    const atStop = new Set()
    const between = []
    const mapPositions = []

    if (!stops || stops.length < 2) return { atStop, between, mapPositions }

    // Build coord lookup + compute displayed minutes per stop
    const stopCoords = {}
    const stopMinutes = {} // seq → displayed diffMin (Math.floor)
    const now = Date.now()

    stops.forEach(s => {
      stopCoords[s.seq] = { lat: parseFloat(s.lat), lng: parseFloat(s.long) }

      // Find nearest future bus ETA at this stop (same as _formatEta)
      const items = (this._etaMap[String(s.seq)] || []).filter(e => e.eta)
      const future = items
        .map(e => ({ eta: new Date(e.eta), raw: e }))
        .filter(e => e.eta.getTime() > now - 120000) // allow 2min grace for "just departed"
        .sort((a, b) => a.eta.getTime() - b.eta.getTime())

      if (future.length) {
        const diffMs = future[0].eta.getTime() - now
        stopMinutes[s.seq] = Math.floor(diffMs / 60000)
      }
    })

    // Find the stop with the smallest displayed minutes (closest bus)
    const seqs = stops.map(s => s.seq).filter(s => stopMinutes[s] !== undefined)
    if (!seqs.length) return { atStop, between, mapPositions }

    const bestSeq = seqs.reduce((a, b) => stopMinutes[a] < stopMinutes[b] ? a : b)
    const bestMin = stopMinutes[bestSeq]
    const bestIdx = stops.findIndex(s => s.seq === bestSeq)

    Logger.api('PLACEMENT', `closest bus at stop ${bestSeq}: ${bestMin} min`)

    if (bestMin <= 1) {
      // Type 1: bus AT this stop (display shows "到站" or "1 分鐘")
      atStop.add(bestSeq)
      const coord = stopCoords[bestSeq]
      if (coord && !isNaN(coord.lat)) {
        mapPositions.push({ lat: coord.lat, lng: coord.lng, type: 'at_stop', fromSeq: bestSeq, toSeq: bestSeq, progress: 0 })
      }
    } else {
      // Type 2: bus BETWEEN previous and this stop (display shows "2+ 分鐘")
      const prevSeq = bestIdx > 0 ? stops[bestIdx - 1].seq : null
      if (prevSeq !== null) {
        atStop.add(bestSeq)
        between.push({ fromSeq: prevSeq, toSeq: bestSeq })

        const from = stopCoords[prevSeq]
        const to = stopCoords[bestSeq]
        if (from && to && !isNaN(from.lat) && !isNaN(to.lat)) {
          // Estimate progress: if bestMin is minutes to next stop, interpolate
          // e.g., if stop N shows 5 min and stop N-1 showed 2 min (3 min gap), bus is ~60% of way
          const prevMin = stopMinutes[prevSeq] !== undefined ? stopMinutes[prevSeq] : bestMin - 3
          const gap = Math.max(bestMin - prevMin, 1)
          const elapsed = bestMin - prevMin
          const progress = gap > 0 ? Math.min(elapsed / gap, 0.95) : 0.5

          mapPositions.push({
            lat: from.lat + (to.lat - from.lat) * progress,
            lng: from.lng + (to.lng - from.lng) * progress,
            type: 'between', fromSeq: prevSeq, toSeq: bestSeq, progress,
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
