/**
 * Logger — singleton runtime logger with ring buffer and debug snapshot.
 * Stores up to MAX_LOG entries, plus a snapshot of the last ETA + stops data
 * for reproducing bus position issues.
 */
const Logger = (() => {
  const MAX_LOG = 500
  const store = []
  let seq = 0

  // Debug snapshot — stores latest ETA and stop data
  let _snapshot = {
    currentTime: null,
    route: null,
    bound: null,
    stopCount: 0,
    etaTotalCount: 0,
    sampleEtaItems: [],
    sampleStops: [],
  }

  function safeStringify(obj) {
    try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
  }

  function add(level, cat, msg, data) {
    const entry = {
      id: ++seq,
      ts: new Date().toISOString(),
      level,
      cat,
      msg,
      data: data !== undefined ? safeStringify(data) : undefined,
    }
    store.push(entry)
    if (store.length > MAX_LOG) store.splice(0, store.length - MAX_LOG)
    if (window.console) {
      const prefix = `[${cat}] ${level}`
      data ? console.log(prefix, msg, data) : console.log(prefix, msg)
    }
    return entry
  }

  return {
    info(c, m, d) { return add('INFO', c, m, d) },
    warn(c, m, d) { return add('WARN', c, m, d) },
    error(c, m, d) { return add('ERROR', c, m, d) },
    api(c, m, d) { return add('API', c, m, d) },
    route(c, m, d) { return add('ROUTE', c, m, d) },
    map(c, m, d) { return add('MAP', c, m, d) },
    ui(c, m, d) { return add('UI', c, m, d) },

    /** Store a debug snapshot for issue reproduction */
    setSnapshot(snap) { _snapshot = { ...snap, currentTime: new Date().toISOString() } },

    getAll() { return [...store] },
    clear() { store.length = 0; seq = 0 },

    getPlainText() {
      const lines = store.map(e => {
        let line = `[${new Date(e.ts).toLocaleTimeString()}] ${e.level} ${e.cat}: ${e.msg}`
        if (e.data) line += `\n    data: ${e.data}`
        return line
      })

      // Append debug snapshot at the end
      if (_snapshot.route) {
        lines.push('')
        lines.push('=== DEBUG SNAPSHOT (for issue reproduction) ===')
        lines.push(`Time: ${_snapshot.currentTime}`)
        lines.push(`Route: ${_snapshot.route} bound=${_snapshot.bound}`)
        lines.push(`Stops: ${_snapshot.stopCount}, ETA items: ${_snapshot.etaTotalCount}`)

        if (_snapshot.sampleEtaItems.length) {
          lines.push('Sample ETA items (first 5):')
          _snapshot.sampleEtaItems.forEach(e => {
            lines.push(`  seq=${e.seq} dir=${e.dir} eta_seq=${e.eta_seq} eta=${e.eta} rmk=${e.rmk_en || ''} svc=${e.service_type}`)
          })
        }
        if (_snapshot.sampleStops.length) {
          lines.push('Sample stops (first 3 + last 3):')
          _snapshot.sampleStops.forEach(s => {
            lines.push(`  seq=${s.seq} id=${s.stopId} name=${s.name_en} lat=${s.lat} lng=${s.long}`)
          })
        }
      }
      return lines.join('\n')
    },

    get size() { return store.length },
    get snapshot() { return _snapshot },
  }
})()

window.__BUS_LOG = Logger
