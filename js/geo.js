/**
 * GeoUtils — shared geospatial utilities.
 *   fetchRouteGeometry(stops)          → Promise<GeoJSON|null>
 *   fetchWalkingRoute(from, to)        → Promise<GeoJSON|null>
 *   fetchWalkingDistance(from, to)     → Promise<{distance,duration}|null>
 *   haversineDistance(lat1,lng1,lat2,lng2) → number (meters)
 *   getNearestStops(pos, stops, count) → [{stop, distance}]
 */
const GeoUtils = (() => {
  const OSRM = 'https://router.project-osrm.org/route/v1'

  function _fetchOsrm(profile, coordList) {
    const url = `${OSRM}/${profile}/${coordList}?geometries=geojson&overview=full`
    return fetch(url)
      .then(res => {
        if (!res.ok) { Logger.warn('GEO', `OSRM ${profile} HTTP ${res.status}`); return null }
        return res.json()
      })
      .then(data => {
        if (data && data.routes && data.routes[0]) return data.routes[0]
        Logger.warn('GEO', `OSRM ${profile}: no routes`)
        return null
      })
      .catch(err => {
        Logger.warn('GEO', `OSRM ${profile} error: ${err.message}`)
        return null
      })
  }

  function _coordsStr(points) {
    return points.map(p => `${p.long != null ? p.long : p.lng},${p.lat}`).join(';')
  }

  function fetchRouteGeometry(stops) {
    const valid = stops.filter(s => s.lat != null && s.long != null && isFinite(s.lat) && isFinite(s.long))
    if (valid.length < 2) return Promise.resolve(null)
    return _fetchOsrm('driving', _coordsStr(valid)).then(r => r ? r.geometry : null)
  }

  function fetchWalkingRoute(from, to) {
    return _fetchOsrm('foot', _coordsStr([from, to])).then(r => r ? r.geometry : null)
  }

  function fetchWalkingDistance(from, to) {
    return _fetchOsrm('foot', _coordsStr([from, to])).then(r => {
      if (!r) return null
      return {
        distance: Math.round(r.distance),
        duration: Math.round(r.duration / 60)
      }
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
