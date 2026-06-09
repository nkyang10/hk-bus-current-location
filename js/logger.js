/**
 * Logger — singleton runtime logger with ring buffer.
 * Stores up to MAX_LOG entries for debugging and copy-to-clipboard.
 */
const Logger = (() => {
  const MAX_LOG = 500
  const store = []
  let seq = 0

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
    ui(c, m, d) { return add('UI', c, m, d) },

    getAll() { return [...store] },
    clear() { store.length = 0; seq = 0 },

    getPlainText() {
      return store.map(e => {
        let line = `[${new Date(e.ts).toLocaleTimeString()}] ${e.level} ${e.cat}: ${e.msg}`
        if (e.data) line += `\n    data: ${e.data}`
        return line
      }).join('\n')
    },

    get size() { return store.length },
  }
})()

window.__BUS_LOG = Logger
