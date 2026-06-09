# Development

## Project Structure

```
v2/
├── index.html           # Single HTML page (~2KB)
├── css/
│   └── style.css        # All styles, ~200 lines
└── js/
    ├── logger.js         # Logger — singleton, 500-entry ring buffer
    ├── lang.js           # LanguageManager — i18n (繁/EN/简)
    ├── api.js            # ApiClient — fetch wrapper, timeout, bound conversion
    ├── route.js          # RouteManager — multi-service-type discovery & merge
    ├── eta.js            # EtaManager — 30s polling, event-driven
    ├── map.js            # MapManager — Leaflet integration
    ├── ui.js             # UIManager — jQuery DOM, all views + debug panel
    └── app.js            # BusTrackerApp — main controller, URL routing
```

**No package.json, no node_modules, no build step.**

## Class Reference

### Logger (`logger.js`)

```js
Logger.info(category, message, data?)
Logger.warn(category, message, data?)
Logger.error(category, message, data?)
Logger.api(category, message, data?)
Logger.route(category, message, data?)
Logger.ui(category, message, data?)
Logger.getAll()          // → Array of log entries
Logger.getPlainText()    // → formatted string for copy
Logger.clear()
Logger.size              // → current count
```

Singleton pattern (IIFE). Stored in `window.__BUS_LOG`.

### LanguageManager (`lang.js`)

```js
const lang = new LanguageManager()
lang.lang          // → 'tc' | 'en' | 'sc'
lang.label         // → '繁' | 'EN' | '简'
lang.setLang('en')
lang.toggle()
lang.t('中文', 'English', '中文(简)')
```

### ApiClient (`api.js`)

```js
const api = new ApiClient()
api.toApiBound('O')     // → 'outbound'
api.fromApiBound('outbound') // → 'O'
await api.fetchRouteList()
await api.discoverServiceTypes('118', 'O')  // → [1, 2, 3]
await api.fetchRoute('118', 'O', 1)
await api.fetchRouteStops('118', 'O', 1)
await api.fetchStop('494C28331301B811')
await api.fetchRouteEta('118', 1)
```

All fetches have 10s timeout via `AbortController`.

### RouteManager (`route.js`)

```js
const rm = new RouteManager(api)
await rm.load('118', 'O')
rm.getRouteInfo()        // → { orig_en, dest_en, ... }
rm.getStops()            // → merged stop array
rm.getServiceTypes()     // → [1, 2, 3]
rm.abort()
```

Caches results by `<route>-<bound>` key.

### EtaManager (`eta.js`)

```js
const em = new EtaManager(api)
em.start('118', [1, 2, 3])   // begins polling
em.stop()                     // stops polling
em.getEtaMap()                // → { '1': [...], '2': [...], ... }
em.isLoading()
```

Triggers jQuery events: `eta:loading`, `eta:update`.

### MapManager (`map.js`)

```js
const mm = new MapManager()
mm.init('routeMap')     // container element ID
mm.render(stops)         // draw markers + polyline
mm.invalidateSize()      // call after show/hide
mm.destroy()
```

### UIManager (`ui.js`)

```js
const ui = new UIManager(languageManager)
ui.renderLanding()
ui.renderRouteView(route, bound, serviceTypes)
ui.renderStopList(stops, etaMap)
ui.showStopListLoading()
ui.showError(message)
ui.showEtaLoading(bool)
ui.updateRouteInfo(routeData)
ui.updateBoundToggle(bound)
ui.toggleMap()
ui.renderDebugButton()
ui.openDebugPanel()
ui.closeDebugPanel()
```

## Coding Conventions

- **Classes** — ES6 `class` syntax, one class per file
- **Methods** — camelCase, public methods documented
- **DOM** — jQuery exclusively (`$('#id')`, `$(document).on()`)
- **Events** — jQuery custom events for cross-component communication
- **API** — All `fetch()` calls go through `ApiClient._fetch()`
- **Logging** — Every significant action logged via `Logger.*()`
- **States** — Every view handles: loading → loaded/error → retry
- **No comments** in production code — self-documenting

## Adding a New Feature

1. Add any new API calls to `api.js`
2. Add business logic to the appropriate manager (`route.js`, `eta.js`, etc.)
3. Add DOM rendering to `ui.js`
4. Wire events in `app.js`

## Testing

Test with these URLs:

| URL | What to verify |
|---|---|
| `/?route=1` | Simple single-type route loads correctly |
| `/?route=118` | Multi-type merge shows S1/S2/S3 badges |
| `/?route=INVALID` | Error message with retry button |
| `/?route=960&bound=I` | Inbound direction works |
| (no params) | Landing page, recent routes, language toggle |
| Debug 🐛 | Copy All Log captures all entries |
