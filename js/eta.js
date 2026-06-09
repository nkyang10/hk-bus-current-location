/**
 * EtaManager — polls ETA for multiple service types, merges by seq.
 * Public API: start(route, types), stop(), getEtaMap()
 */
class EtaManager {
  constructor(api) {
    this.api = api
    this._etaMap = {}
    this._loading = false
    this._interval = null
    this._route = null
    this._types = []
    this._pollCount = 0
    this._abort = null
  }

  getEtaMap() { return this._etaMap }
  isLoading() { return this._loading }

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
      const allEta = results.filter(Boolean).flatMap(r => r.data || [])
      const map = {}
      allEta.forEach(eta => {
        const key = `${eta.seq}`
        if (!map[key]) map[key] = []
        map[key].push(eta)
      })
      this._etaMap = map
      Logger.api('ETA', `poll #${this._pollCount}: ${allEta.length} items across ${this._types.length} types`)
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
