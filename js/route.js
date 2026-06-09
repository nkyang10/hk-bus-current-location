/**
 * RouteManager — discovers service types, fetches stops, merges.
 * 
 * Public API:
 *   load(route, bound)        → Promise
 *   getRouteInfo()            → route detail object
 *   getStops()               → merged stop array
 *   getServiceTypes()         → [1, 2, ...]
 */
class RouteManager {
  constructor(api) {
    this.api = api
    this._routeInfo = null
    this._stops = []
    this._serviceTypes = []
    this._abort = null
    this._cache = {}
  }

  getRouteInfo() { return this._routeInfo }
  getStops() { return this._stops }
  getServiceTypes() { return this._serviceTypes }

  async load(route, bound) {
    // Abort any in-flight request
    if (this._abort) this._abort.abort()
    const controller = new AbortController()
    this._abort = controller
    const signal = controller.signal

    const key = `${route}-${bound}`
    if (this._cache[key]) {
      Logger.route('CACHE', key)
      const c = this._cache[key]
      this._routeInfo = c.routeInfo
      this._stops = c.stops
      this._serviceTypes = c.serviceTypes
      return
    }

    Logger.route('LOAD', `${route} bound=${bound}`)

    const types = await this.api.discoverServiceTypes(route, bound)
    if (signal.aborted) return
    if (types.length === 0) throw new Error('NOT_FOUND')

    this._serviceTypes = types
    Logger.route('TYPES', `[${types.join(',')}]`)

    // Fetch each service type's route + stops
    const details = (await Promise.all(
      types.map(async svc => {
        if (signal.aborted) return null
        try {
          const [routeRes, stopsRes] = await Promise.all([
            this.api.fetchRoute(route, bound, svc),
            this.api.fetchRouteStops(route, bound, svc),
          ])
          if (signal.aborted) return null
          return { svc, routeData: routeRes.data, routeStops: stopsRes.data || [] }
        } catch { return null }
      })
    )).filter(Boolean)

    if (signal.aborted || details.length === 0) return
    if (details.length === 0) throw new Error('LOAD_FAILED')

    const primary = details[0]
    this._routeInfo = primary.routeData

    // Merge stops across service types
    const stopSet = new Map()
    const svcMap = {}

    for (const d of details) {
      for (const rs of d.routeStops) {
        if (!stopSet.has(rs.stop)) {
          stopSet.set(rs.stop, { stopId: rs.stop, seq: parseInt(rs.seq, 10), bound: rs.bound })
        }
        if (!svcMap[rs.stop]) svcMap[rs.stop] = []
        if (!svcMap[rs.stop].includes(d.svc)) svcMap[rs.stop].push(d.svc)
      }
    }

    // Ordered union: primary stops first, then any extras
    const ordered = []
    const added = new Set()
    for (const rs of primary.routeStops) {
      ordered.push(rs.stop)
      added.add(rs.stop)
    }
    for (const d of details.slice(1)) {
      for (const rs of d.routeStops) {
        if (!added.has(rs.stop)) {
          ordered.push(rs.stop)
          added.add(rs.stop)
        }
      }
    }

    // Fetch stop details (name, lat/long)
    const stopDetails = (await Promise.all(
      ordered.map(async (stopId, idx) => {
        if (signal.aborted) return null
        const entry = stopSet.get(stopId)
        try {
          const res = await this.api.fetchStop(stopId, signal)
          if (signal.aborted) return null
          return {
            seq: idx + 1,
            stopId,
            serviceTypes: svcMap[stopId] || [1],
            ...(res.data || {}),
          }
        } catch {
          if (signal.aborted) return null
          Logger.warn('STOP', `Fallback for ${stopId}`)
          return { seq: idx + 1, stopId, serviceTypes: svcMap[stopId] || [1], name_tc: `站點`, name_en: `Stop ${stopId}`, lat: null, long: null }
        }
      })
    )).filter(Boolean)

    if (signal.aborted) return
    this._stops = stopDetails
    this._cache[key] = { routeInfo: this._routeInfo, stops: this._stops, serviceTypes: this._serviceTypes }

    Logger.route('DONE', `${route} bound=${bound} → ${this._stops.length} stops across ${types.length} types`)
  }

  abort() {
    if (this._abort) { this._abort.abort(); this._abort = null }
  }
}
