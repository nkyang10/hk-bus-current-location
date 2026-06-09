/**
 * EtaManager — polls ETA for multiple service types, merges by seq.
 * Public API: start(route, bound, types, stopIds), stop(), getEtaMap()
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
    this._stopIds = []
    this._pollCount = 0
    this._abort = null
    this._lastTimestamp = null
    this._converged = false
    this._isCtb = api instanceof CtbApiClient
  }

  getEtaMap() { return this._etaMap }
  getAllEta() { return this._allEta }
  isLoading() { return this._loading }

  start(route, bound, types, stopIds) {
    this.stop()
    this._route = route
    this._bound = bound
    this._types = types
    this._stopIds = stopIds || []
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
    this._stopIds = []
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
      let all = []
      let timestamps = []

      if (this._isCtb && this._stopIds.length) {
        const results = await Promise.all(
          this._stopIds.map(sid =>
            this.api.fetchEtaForStop(sid, this._route).catch(() => null)
          )
        )
        results.forEach(r => {
          if (r && r.data) {
            all = all.concat(r.data)
            if (r.data_timestamp) timestamps.push(r.data_timestamp)
          }
        })
      } else {
        const results = await Promise.all(
          this._types.map(svc => this.api.fetchRouteEta(this._route, svc).catch(() => null))
        )
        results.forEach(r => {
          if (r && r.data) {
            all = all.concat(r.data)
            if (r.data_timestamp) timestamps.push(r.data_timestamp)
          }
        })
      }

      if (all.length === 0) {
        Logger.api('ETA_EMPTY', `poll #${this._pollCount}: no ETA data`)
        if (this._pollCount > 3) {
          this._schedule(60)
        }
        this._allEta = []
        this._etaMap = {}
        return
      }

      const latestTs = timestamps.length > 0 ? timestamps.sort().pop() : null
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
