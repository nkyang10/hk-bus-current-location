# Architecture

## Overview

Zero-backend, single-page application. All logic runs in the browser. All data comes directly from the KMB Open Data API.

## System Diagram

```
┌────────────────────────────────────────┐
│            Browser (client-side)        │
│                                         │
│  index.html?route=118&bound=O          │
│       │                                 │
│       ▼                                 │
│  BusTrackerApp                          │
│  ├── RouteManager                       │
│  │   ├── discoverServiceTypes() → [1,2,3]│
│  │   ├── fetchRoute(118, O, 1)          │
│  │   ├── fetchRouteStops(118, O, 1)     │
│  │   ├── fetchRouteStops(118, O, 2)     │
│  │   ├── fetchRouteStops(118, O, 3)     │
│  │   └── merge + fetchStop() each       │
│  ├── EtaManager (30s polling)           │
│  │   ├── fetchRouteEta(118, 1)          │
│  │   ├── fetchRouteEta(118, 2)          │
│  │   └── fetchRouteEta(118, 3)          │
│  ├── MapManager (Leaflet)               │
│  ├── UIManager (jQuery DOM)             │
│  ├── Logger (ring buffer)               │
│  └── LanguageManager (i18n)             │
│                                         │
└──────────────┬──────────────────────────┘
               │ HTTPS
               ▼
┌────────────────────────────────────────┐
│      data.etabus.gov.hk (KMB API)       │
│                                         │
│  /route/                                │
│  /route/{r}/{b}/{s}                     │
│  /route-stop/{r}/{b}/{s}                │
│  /stop/{id}                              │
│  /route-eta/{r}/{s}                     │
└────────────────────────────────────────┘
```

## Class Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     BusTrackerApp                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Properties: route, bound                               │  │
│  │ Methods: init(), _navigate(), _searchRoute(),          │  │
│  │          _bindEvents(), _updateUrl()                   │  │
│  └──────────┬──────────┬──────────┬──────────┬───────────┘  │
│             │          │          │          │              │
│     ┌───────▼──┐ ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌────▼─┐ │
│     │RouteMgr  │ │EtaMgr  │ │MapMgr  │ │UIMgr   │ │LangM │ │
│     │(route.js)│ │(eta.js)│ │(map.js)│ │(ui.js) │ │(lang)│ │
│     └──────┬───┘ └───┬────┘ └────────┘ └────────┘ └──────┘ │
│            │         │                                       │
│     ┌──────▼─────────▼──────┐                               │
│     │    ApiClient (api.js)  │                               │
│     │    fetch() + timeout   │                               │
│     └───────────────────────┘                               │
│     ┌───────────────────────┐                               │
│     │    Logger (logger.js)  │                               │
│     │    ring buffer 500     │                               │
│     └───────────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

## Key Decisions

### 1. Multi-Service-Type Merging

KMB routes can have multiple service types (e.g., 118 has types 1, 2, 3). The app:

1. `discoverServiceTypes()` fetches the route list and extracts unique types
2. For each type, fetches stops via `fetchRouteStops()`
3. Merges: creates a union of all stop IDs, ordered by primary type (type 1) first
4. For each merged stop, records which service types serve it (shown as badges)
5. ETA is fetched per-type and merged by stop sequence number

### 2. Bound Conversion

KMB API responses use `O`/`I` but detail endpoints expect `outbound`/`inbound`. The `ApiClient` handles this transparently.

### 3. AbortController Pattern

Every fetch has **two abort layers**:

| Layer | Location | Action |
|---|---|---|
| Timeout | `ApiClient._fetch()` | 10s |
| Navigation | `RouteManager.load()` | Aborts on route/bound change |
| Cleanup | `EtaManager.stop()` | Aborts on unmount |

### 4. ETA Matching by `seq`

The `/route-eta/{route}/{svc}` endpoint returns ETA keyed by `seq` (stop sequence number), not `stop` (stop ID). The `EtaManager` stores ETA in `etaMap[String(seq)]`.

### 5. Zero Build Philosophy

No bundler, no transpiler, no package manager. jQuery (CDN) + vanilla JS classes. This means:
- Zero maintenance for build tools
- Instant startup
- Easy to inspect and debug
- 100% transparent code

## Data Flow

```
1. User opens ?route=118&bound=O
2. BusTrackerApp parses URL params
3. UIManager.renderRouteView("118", "O") draws the UI shell
4. RouteManager.load("118", "O"):
   a. discoverServiceTypes() → [1, 2, 3]
   b. fetch + merge stops across all types
   c. fetch stop details (names, coordinates)
5. UIManager.renderStopList(stops) shows stops
6. MapManager.render(stops) draws map
7. EtaManager.start("118", [1, 2, 3]) begins 30s polling
8. On each poll: fetchRouteEta for each type, merge, trigger eta:update event
9. UIManager re-renders stop list with fresh ETA
```

## Event System

The app uses jQuery custom events for decoupled communication:

| Event | Emitter | Listener |
|---|---|---|
| `nav:landing` | Back button | App → UIManager |
| `nav:bound` | BoundToggle | App → RouteManager, EtaManager |
| `nav:retry` | Error retry button | App → RouteManager |
| `ui:toggleMap` | Map toggle button | App → MapManager |
| `map:show` | UIManager | MapManager.invalidateSize() |
| `eta:loading` | EtaManager | UIManager (show/hide eta bar) |
| `eta:update` | EtaManager | UIManager (re-render stop list) |
| `debug:toggle` | Debug button | UIManager |
