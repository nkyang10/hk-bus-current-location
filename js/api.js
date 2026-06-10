/**
 * ApiClient — handles all KMB Open Data API calls.
 * Features: bound conversion, 10s timeout, AbortController support.
 */
class ApiClient {
  constructor() {
    this.BASE = 'https://data.etabus.gov.hk/v1/transport/kmb'
    this.TIMEOUT = 10000
    this._boundMap = {
      O: 'outbound', I: 'inbound',
      outbound: 'O', inbound: 'I',
    }
  }

  toApiBound(b) { return this._boundMap[b] || b }
  fromApiBound(b) { return this._boundMap[b] || b }

  async _fetch(url, signal) {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), this.TIMEOUT)
    const sig = signal ? this._combine(signal, controller.signal) : controller.signal
    const short = url.replace(this.BASE, '')

    Logger.api('FETCH', short)
    const start = Date.now()
    try {
      const res = await fetch(url, { signal: sig, cache: 'no-cache' })
      const elapsed = Date.now() - start
      if (!res.ok) {
        Logger.api('HTTP_ERR', `${short} → ${res.status}`, { status: res.status })
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const json = await res.json()
      const len = json.data ? (Array.isArray(json.data) ? json.data.length : 1) : 0
      Logger.api('OK', `${short} (${elapsed}ms, ${len} items)`)
      return json
    } catch (err) {
      if (err.name === 'AbortError') {
        Logger.api('TIMEOUT', `${short} ≥${this.TIMEOUT}ms`)
        throw err
      }
      Logger.api('FAIL', `${short} → ${err.message}`)
      throw err
    } finally {
      clearTimeout(tid)
    }
  }

  _combine(s1, s2) {
    const c = new AbortController()
    const fn = () => c.abort()
    s1.addEventListener('abort', fn, { once: true })
    s2.addEventListener('abort', fn, { once: true })
    if (s1.aborted || s2.aborted) c.abort()
    return c.signal
  }

  async fetchRouteList() {
    return this._fetch(`${this.BASE}/route/`)
  }

  async discoverServiceTypes(route, bound) {
    const list = await this.fetchRouteList()
    if (!list.data) return []
    const matching = list.data.filter(r => r.route === route && r.bound === bound)
    return [...new Set(matching.map(r => r.service_type))].sort()
  }

  async fetchRoute(route, bound, svc) {
    const b = this.toApiBound(bound)
    return this._fetch(`${this.BASE}/route/${route}/${b}/${svc}`)
  }

  async fetchRouteStops(route, bound, svc) {
    const b = this.toApiBound(bound)
    return this._fetch(`${this.BASE}/route-stop/${route}/${b}/${svc}`)
  }

  async fetchStop(stopId, signal) {
    return this._fetch(`${this.BASE}/stop/${stopId}`, signal)
  }

  async fetchRouteEta(route, svc) {
    return this._fetch(`${this.BASE}/route-eta/${route}/${svc}`)
  }
}

/**
 * CtbApiClient — handles all CTB (Citybus) V2 Open Data API calls.
 * API base: https://rt.data.gov.hk/v2/transport/citybus
 */
class CtbApiClient {
  constructor() {
    this.BASE = 'https://rt.data.gov.hk/v2/transport/citybus'
    this.TIMEOUT = 10000
    this._boundMap = {
      O: 'outbound', I: 'inbound',
      outbound: 'O', inbound: 'I',
    }
  }

  toApiBound(b) { return this._boundMap[b] || b }
  fromApiBound(b) { return this._boundMap[b] || b }

  async _fetch(url, signal) {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), this.TIMEOUT)
    const sig = signal ? this._combine(signal, controller.signal) : controller.signal
    const short = url.replace(this.BASE, '')

    Logger.api('CTB_FETCH', short)
    const start = Date.now()
    try {
      const res = await fetch(url, { signal: sig, cache: 'no-cache' })
      const elapsed = Date.now() - start
      if (!res.ok) {
        Logger.api('CTB_ERR', `${short} → ${res.status}`, { status: res.status })
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const json = await res.json()
      const len = json.data ? (Array.isArray(json.data) ? json.data.length : 1) : 0
      Logger.api('CTB_OK', `${short} (${elapsed}ms, ${len} items)`)
      return json
    } catch (err) {
      if (err.name === 'AbortError') {
        Logger.api('CTB_TIMEOUT', `${short} ≥${this.TIMEOUT}ms`)
        throw err
      }
      Logger.api('CTB_FAIL', `${short} → ${err.message}`)
      throw err
    } finally {
      clearTimeout(tid)
    }
  }

  _combine(s1, s2) {
    const c = new AbortController()
    const fn = () => c.abort()
    s1.addEventListener('abort', fn, { once: true })
    s2.addEventListener('abort', fn, { once: true })
    if (s1.aborted || s2.aborted) c.abort()
    return c.signal
  }

  async fetchRouteList() {
    return this._fetch(`${this.BASE}/route/CTB`)
  }

  async discoverServiceTypes(route, bound) {
    const list = await this.fetchRouteList()
    if (!list.data) return []
    const matching = list.data.filter(r => r.route === route)
    if (matching.length === 0) return []
    return [1]
  }

  async fetchRoute(route, bound, svc) {
    return this._fetch(`${this.BASE}/route/CTB/${route}`)
  }

  async fetchRouteStops(route, bound, svc) {
    const b = this.toApiBound(bound || 'O')
    return this._fetch(`${this.BASE}/route-stop/CTB/${route}/${b}`)
  }

  async fetchStop(stopId, signal) {
    return this._fetch(`${this.BASE}/stop/${stopId}`, signal)
  }

  async fetchEtaForStop(stopId, route) {
    return this._fetch(`${this.BASE}/eta/CTB/${stopId}/${route}`)
  }
}
