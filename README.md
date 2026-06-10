<div align="center">
  <br/>
  <img src="icon.svg" alt="HK Bus Tracker" width="80" />
  <h1>🚌 HK Bus Tracker</h1>
  <h3>九巴即時到站 — 即時九巴、龍運及城巴路線預計到站時間</h3>
  <p>
    <strong>Real-time KMB, LWB & CTB Bus Arrival Tracking</strong>
  </p>
  <p>
    <a href="#-features">Features</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-usage">Usage</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-class-diagram">Classes</a> •
    <a href="#%EF%B8%8F-troubleshooting">Troubleshooting</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-2.1.0-red.svg" alt="Version" />
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
    <img src="https://img.shields.io/badge/jQuery-3.7-0769AD?logo=jquery" alt="jQuery" />
    <img src="https://img.shields.io/badge/zero-backend-22c55e" alt="Zero Backend" />
    <img src="https://img.shields.io/badge/no%20build-required-8b5cf6" alt="No Build" />
  </p>
  <br/>
</div>

---

## ✨ Features

| Feature | Description |
|---|---|---|
| **🔍 Route Search** | Search by route number (`1A`, `118`, `960`) |
| **🏢 Company Toggle** | Switch between KMB (九巴) and CTB (城巴) live data |
| **⏱ Real-time ETA** | Live countdown per stop, smart auto-refresh |
| **🔄 Direction Toggle** | Switch Outbound (往程) / Inbound (返程) |
| **🔗 URL Shareable** | `?route=118&bound=O&company=kmb` — bookmark any route |
| **🌐 Multi-language** | 繁體中文 / English / 简体中文 toggle |
| **📌 Recent Routes** | Quick access to last 8 searches, remembers company context |
| **🛠 Multi-Service Merge** | Auto-discovers and merges all service types (e.g. route 118 types 1/2/3) |
| **🐛 Debug Panel** | Built-in logger with copy-to-clipboard |
| **🗺️ Map View** | Leaflet + OpenStreetMap with bus routes, stops, bus positions, and walking paths |
| **📍 User Location** | Geolocation-aware: nearest stop highlight, walking distance, walking path on map |
| **📱 Mobile First** | Responsive design for all screen sizes |
| **⚡ No Build Step** | Open `index.html` in any browser — no npm, no CLI, no bundler |

### Example Routes

| URL | Description |
|---|---|
| `?route=1` | KMB Route 1 outbound — Chuk Yuen Estate → Star Ferry |
| `?route=118` | KMB Route 118 outbound — 3 service types merged |
| `?route=960&bound=I` | KMB Route 960 inbound — Exhibition Centre → Tuen Mun |
| `?route=10&company=ctb` | CTB Route 10 — Kennedy Town → North Point |
| `?route=8&bound=I&company=ctb` | CTB Route 8 inbound — Exhibition Centre → Heng Fa Chuen |

---

## 🚀 Quick Start

### Option 1: Open directly (Firefox)

Open `index.html` in **Firefox** — Firefox supports `fetch()` from `file://`.

### Option 2: Deploy to cloud

Drop the project folder on **Cloudflare Pages**, **Netlify**, **GitHub Pages**, or any static host.

---

## 📁 Project Structure

```
├── index.html           # Single page app (2KB)
├── css/
│   └── style.css        # All styles
└── js/
    ├── logger.js         # Logger class — ring buffer, copy-to-clipboard
    ├── lang.js           # LanguageManager — i18n toggle (繁/EN/简)
    ├── api.js            # ApiClient + CtbApiClient — fetch with timeout + abort
    ├── route.js          # RouteManager — discover + merge service types
    ├── eta.js            # EtaManager — 30s polling (per-route for KMB, per-stop for CTB)
    ├── ui.js             # UIManager — jQuery DOM rendering
    ├── geo.js            # GeoUtils — OSRM route geometry, walking paths, haversine
    ├── map.js            # MapManager — Leaflet map view with stops/buses/routes
    ├── location.js       # LocationManager — geolocation with permission/watch/retry
    └── app.js            # BusTrackerApp — main controller, company toggle
```

**Zero build tools for the app.** `package.json` is only used for Playwright tests.
Each JS file is a single class following OOP separation of concerns.

---

## 🔧 Usage

### URL Parameters

| Param | Values | Default | Example |
|---|---|---|---|---|
| `route` | Any KMB or CTB route | **required** | `?route=118` |
| `bound` | `O` (Outbound) / `I` (Inbound) | `O` | `?route=118&bound=I` |
| `company` | `kmb` / `ctb` | `kmb` | `?route=10&company=ctb` |

> When no `service_type` is specified, the app auto-discovers all service types
> and merges them into a unified stop list with combined ETA.

### Language

Click the language button (繁 / EN / 简) to switch. Preference saved to `localStorage`.

### Debug Panel

Click the 🐛 button (bottom-right). **"Copy All Log"** exports all runtime logs.

---

## 🧱 Architecture

### System Diagram

```
┌───────────────────────────────────────────────┐
│              Browser (no server)               │
│                                                 │
│  index.html?route=118&bound=O&company=kmb      │
│       │                                         │
│       ▼                                         │
│  BusTrackerApp (app.js)                         │
│  ├── RouteManager (route.js)                    │
│  │   ├── ApiClient.discoverServiceTypes()       │
│  │   ├── ApiClient.fetchRoute()                 │
│  │   ├── ApiClient.fetchRouteStops() × N types  │
│  │   └── merge stop lists                       │
│  ├── EtaManager (eta.js)                        │
│  │   ├── KMB: fetchRouteEta() × N types         │
│  │   └── CTB: fetchEtaForStop() × N stops      │
│  │   └── polls smartly (10s initial, 60s after stable)                        │
│  ├── MapManager (map.js)                        │
│  │   ├── Leaflet map with OSM tiles             │
│  │   ├── GeoUtils.fetchRouteGeometry() (OSRM)   │
│  │   ├── GeoUtils.fetchWalkingRoute() (OSRM)    │
│  │   └── Draws route, stops, buses, user        │
│  ├── LocationManager (location.js)              │
│  │   ├── geolocation permission flow            │
│  │   ├── watchPosition & real-time update       │
│  │   └── nearest-stop matching                  │
│  ├── GeoUtils (geo.js)                          │
│  │   ├── OSRM driving profile → bus route       │
│  │   ├── OSRM foot profile → walking path       │
│  │   └── haversine distance calculation         │
│  ├── UIManager (ui.js)                          │
│  │   └── jQuery DOM rendering                   │
│  ├── Logger (logger.js)                         │
│  └── LanguageManager (lang.js)                  │
│                                                 │
│  Company toggle → creates ApiClient or          │
│                    CtbApiClient                  │
└──────────────┬──────────────────────────────────┘
               │ HTTPS (CORS)
               ▼
┌─────────────────────────┐  ┌──────────────────────────┐
│  data.etabus.gov.hk     │  │  rt.data.gov.hk           │
│  (KMB Open Data)        │  │  (CTB Open Data V2)       │
│                         │  │                           │
│  /v1/transport/kmb/     │  │  /v2/transport/citybus/   │
│  ├ route/               │  │  ├ route/CTB              │
│  ├ route/{r}/{b}/{s}    │  │  ├ route/CTB/{r}         │
│  ├ route-stop/{r}/{b}/{s}│  │  ├ route-stop/CTB/{r}/  │
│  ├ stop/{id}            │  │  │   {outbound|inbound}   │
│  └ route-eta/{r}/{s}    │  │  ├ stop/{id}             │
│                         │  │  └ eta/CTB/{stop}/{r}    │
└─────────────────────────┘  └──────────────────────────┘
```

### Data Flow

#### KMB

```
1. User opens ?route=118&bound=O&company=kmb
2. BusTrackerApp parses URL params
3. RouteManager.load("118", "O"):
   a. ApiClient.discoverServiceTypes("118", "O") → [1, 2, 3]
   b. For each type: fetch route details + stop list
   c. Merge: union of all stop IDs, primary order from type 1
   d. For each unique stop: fetchStop() → name, lat, long
4. EtaManager.start("118", [1, 2, 3]):
   a. Smart polling: 10s initially, 60s after data stabilizes
   b. Merge ETA by stop sequence
5. UIManager renders stop list with ETA countdowns
```

#### CTB

```
1. User opens ?route=10&bound=O&company=ctb
2. BusTrackerApp creates CtbApiClient
3. RouteManager.load("10", "O"):
   a. CtbApiClient.discoverServiceTypes("10") → [1]
   b. fetchRoute("10") → route detail
   c. fetchRouteStops("10", "outbound") → 37 stops with stop IDs
   d. For each stop: fetchStop(id) → name, lat, long
4. EtaManager.start("10", [1], stopIds):
   a. Smart polling: 10s initially, 60s after data stabilizes
   b. Merge ETA by stop sequence
```

---

## 📚 Class Reference

| Class | File | Responsibility |
|---|---|---|
| `Logger` | `logger.js` | Singleton ring buffer (500 entries), `getPlainText()`, exposed as `window.__BUS_LOG` |
| `LanguageManager` | `lang.js` | TC/EN/SC toggle, `t(tc, en, sc)` translation, localStorage persistence |
| `ApiClient` | `api.js` | KMB API calls, bound conversion (`O`↔`outbound`), 10s timeout via AbortController |
| `CtbApiClient` | `api.js` | CTB V2 API calls, uppercase `CTB`, full bound words (`outbound`/`inbound`) |
| `RouteManager` | `route.js` | Service type discovery, multi-type merge, stop detail fetch, in-memory cache; auto-detects KMB vs CTB |
| `EtaManager` | `eta.js` | ETA polling (10s→60s adaptive), multi-type merge (KMB) / per-stop parallel fetch (CTB), jQuery custom events |
| `UIManager` | `ui.js` | All DOM via jQuery, landing/route/debug views, company toggle, ETA formatting, error/loading/empty states |
| `GeoUtils` | `geo.js` | OSRM driving/foot routing for route geometry + walking paths, haversine distance, nearest-stop finder |
| `MapManager` | `map.js` | Lazy-loaded Leaflet map, draws bus route / stops / bus icons / user location / walking path |
| `LocationManager` | `location.js` | Geolocation API with permission flow, `watchPosition`, auto-retry |
| `BusTrackerApp` | `app.js` | URL parsing, company selection, event binding, navigation orchestration, history management |

---

## 🌐 API Reference

### KMB (九巴)

Base: `data.etabus.gov.hk/v1/transport/kmb`  
Data source: [data.gov.hk - KMB/LWB ETA](https://data.gov.hk/tc-data/dataset/hk-td-tis_21-etakmb)

| Endpoint | Description |
|---|---|
| `GET /route/` | List all routes with bound + service type |
| `GET /route/{r}/{b}/{s}` | Route details (`b` = `outbound`/`inbound`) |
| `GET /route-stop/{r}/{b}/{s}` | Stops in sequence |
| `GET /stop/{id}` | Stop name + lat/long |
| `GET /route-eta/{r}/{s}` | Real-time ETA per route (smart polling: 10s→60s) |

> **Bound:** Detail endpoints use `outbound`/`inbound`. Responses use `O`/`I`.  
> **Auth:** None — fully public. **ETA:** ISO 8601 or `null` if no bus scheduled.

### CTB (城巴)

Base: `rt.data.gov.hk/v2/transport/citybus`  
Data source: [data.gov.hk - CTB ETA](https://data.gov.hk/tc-data/dataset/ctb-eta-transport-realtime-eta)

| Endpoint | Description |
|---|---|
| `GET /route/CTB` | List all CTB routes (403 routes, no bound field) |
| `GET /route/CTB/{r}` | Route details |
| `GET /route-stop/CTB/{r}/{outbound|inbound}` | Stops in sequence (uses full bound words) |
| `GET /stop/{id}` | Stop name + lat/long (6-digit stop ID, e.g. `002403`) |
| `GET /eta/CTB/{stop}/{r}` | Real-time ETA per stop (must call for each stop in parallel) |

> **Company ID:** Must be uppercase `CTB` in URL paths.  
> **Bound:** Use full words `outbound`/`inbound` in URLs; responses use `O`/`I`.  
> **ETA:** Per-stop endpoint — the app fetches all stops in parallel via `Promise.all`.  
> **Auth:** None — fully public.

### OSRM Routing (Map Geometry)

Used by `GeoUtils` to draw bus route polylines and walking paths on the map.

| Endpoint | Profile | Usage |
|---|---|---|
| `routing.openstreetmap.de/routed-car/route/v1/driving/{lng,lat};...` | driving | Bus route geometry between consecutive stops |
| `routing.openstreetmap.de/routed-foot/route/v1/driving/{lng,lat};...` | foot | Walking path from user to a clicked stop |

Response: `{ code: "Ok", routes: [{ geometry: GeoJSON LineString, distance: meters, duration: seconds }] }`  
Falls back to straight-line polyline if API is unavailable.

---

## ☁️ Deploy

```bash
# Just upload the whole folder to any static host:
# Cloudflare Pages, Netlify, GitHub Pages, Vercel, S3, etc.
```

No build step required. The `index.html` works as-is.

---

## ❓ FAQ

### Why no React/Vite?

The app has simple UI requirements — it doesn't need virtual DOM, SSR, or a component tree. jQuery keeps the codebase small (~330 KB gzipped) and understandable. Zero build tools means zero maintenance.

### Does this work for Citybus (城巴)?

Yes! CTB (城巴) is now supported using the [data.gov.hk CTB V2 API](https://data.gov.hk/tc-data/dataset/ctb-eta-transport-realtime-eta). Click the **CTB** button in the toolbar to switch. All former NWFB routes merged into CTB since July 2023 are also available under company ID `CTB`.

Note: The app was originally KMB-only. CTB routes do not have service types or bound fields in the route list. Route-stop and ETA use different URL patterns (uppercase `CTB`, full bound words, per-stop ETA).

### Why can't I open `index.html` directly in Chrome?

Chrome/Edge block `fetch()` from `file://` for security. Use **Firefox** instead.

---

## 📄 License

MIT License. Data belongs to **KMB** / **Citybus Limited** / **HKSAR Government Transport Department**.

---

<div align="center">
  <sub>Built with jQuery — Data: <a href="https://data.gov.hk/tc-data/dataset/hk-td-tis_21-etakmb">KMB</a> · <a href="https://data.gov.hk/tc-data/dataset/ctb-eta-transport-realtime-eta">CTB</a> — data.gov.hk</sub>
</div>
