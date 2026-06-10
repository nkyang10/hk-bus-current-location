/**
 * GeoUtils — shared geospatial utilities.
 *   fetchRouteGeometry(stops)          → Promise<GeoJSON|null>
 *   fetchWalkingRoute(from, to)        → Promise<GeoJSON|null>
 *   fetchWalkingDistance(from, to)     → Promise<{distance,duration}|null>
 *   haversineDistance(lat1,lng1,lat2,lng2) → number (meters)
 *   getNearestStops(pos, stops, count) → [{stop, distance}]
 */
const GeoUtils = (() => {
  const BRouterBase = 'https://brouter.de/brouter'

  function _brouterUrl(from, to) {
    return `${BRouterBase}?lonlats=${from.lng},${from.lat}|${to.lng},${to.lat}&profile=foot&format=geojson&nogil=1`
  }

  function _parseBrouter(text) {
    let data
    try { data = JSON.parse(text) } catch { return null }
    if (!data.features || data.features.length === 0) return null
    return data.features[0]
  }

  function fetchRouteGeometry(stops) {
    const valid = stops.filter(s => s.lat != null && s.long != null && isFinite(s.lat) && isFinite(s.long))
    if (valid.length < 2) return Promise.resolve(null)

    const coords = valid.map(s => `${s.long},${s.lat}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`

    return fetch(url)
      .then(res => {
        if (!res.ok) { Logger.warn('GEO', `OSRM HTTP ${res.status}`); return null }
        return res.json()
      })
      .then(data => {
        if (data && data.routes && data.routes[0]) return data.routes[0].geometry
        Logger.warn('GEO', 'OSRM: no routes')
        return null
      })
      .catch(err => {
        Logger.warn('GEO', `OSRM error: ${err.message}`)
        return null
      })
  }

  function fetchWalkingRoute(from, to) {
    return fetch(_brouterUrl(from, to))
      .then(res => {
        if (!res.ok) { Logger.warn('GEO', `BRouter HTTP ${res.status}`); return null }
        return res.text()
      })
      .then(text => {
        if (!text) return null
        const feature = _parseBrouter(text)
        return feature ? feature.geometry : null
      })
      .catch(err => {
        Logger.warn('GEO', `BRouter error: ${err.message}`)
        return null
      })
  }

  function fetchWalkingDistance(from, to) {
    return fetch(_brouterUrl(from, to), { mode: 'cors' })
      .then(res => {
        if (!res.ok) { Logger.warn('GEO', `BRouter dist HTTP ${res.status}`); return null }
        return res.text()
      })
      .then(text => {
        if (!text) return null
        const feature = _parseBrouter(text)
        if (!feature) return null
        const p = feature.properties
        return {
          distance: Math.round(p['track-length'] || p.distance || 0),
          duration: Math.round((p['total-time'] || p.time || 0) / 60)
        }
      })
      .catch(err => {
        Logger.warn('GEO', `BRouter dist error: ${err.message}`)
        return null
      })
  }

  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000
    const toRad = d => d * Math.PI / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  function getNearestStops(pos, stops, count) {
    if (!pos || !stops) return []
    const withDist = stops
      .filter(s => s.lat != null && s.long != null && isFinite(s.lat) && isFinite(s.long))
      .map(s => ({
        stop: s,
        distance: haversineDistance(pos.lat, pos.lng, s.lat, s.long)
      }))
      .sort((a, b) => a.distance - b.distance)
    return withDist.slice(0, count || 4)
  }

  return {
    fetchRouteGeometry,
    fetchWalkingRoute,
    fetchWalkingDistance,
    haversineDistance,
    getNearestStops,
  }
})()
