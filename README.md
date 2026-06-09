<div align="center">
  <br/>
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%23E31837'/%3E%3Ctext x='16' y='23' font-size='18' font-weight='bold' fill='white' text-anchor='middle' font-family='Arial'%3EK%3C/text%3E%3C/svg%3E" alt="HK Bus Tracker" width="80" />
  <h1>🚌 HK Bus Tracker</h1>
  <h3>香港巴士動態 — 即時九巴路線預計到站時間</h3>
  <p>
    <strong>Real-time KMB & LWB Bus Arrival Tracking</strong>
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
    <img src="https://img.shields.io/badge/version-2.0.0-red.svg" alt="Version" />
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
    <img src="https://img.shields.io/badge/jQuery-3.7-0769AD?logo=jquery" alt="jQuery" />
    <img src="https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet" alt="Leaflet" />
    <img src="https://img.shields.io/badge/zero-backend-22c55e" alt="Zero Backend" />
    <img src="https://img.shields.io/badge/no%20build-required-8b5cf6" alt="No Build" />
  </p>
  <br/>
</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| **🔍 Route Search** | Search by route number (`1A`, `118`, `960`) |
| **⏱ Real-time ETA** | Live countdown per stop, auto-refresh every 30s |
| **🔄 Direction Toggle** | Switch Outbound (往程) / Inbound (返程) |
| **🗺 Route Map** | Interactive Leaflet map with stop markers + route path |
| **🔗 URL Shareable** | `?route=118&bound=O` — bookmark any route |
| **🌐 Multi-language** | 繁體中文 / English / 简体中文 toggle |
| **📌 Recent Routes** | Quick access to last 8 searches (localStorage) |
| **🛠 Multi-Service Merge** | Auto-discovers and merges all service types (e.g. route 118 types 1/2/3) |
| **🐛 Debug Panel** | Built-in logger with copy-to-clipboard |
| **📱 Mobile First** | Responsive design for all screen sizes |
| **⚡ No Build Step** | Open `index.html` in any browser — no npm, no CLI, no bundler |

### Example Routes

| URL | Description |
|---|---|
| `?route=1` | Route 1 outbound — Chuk Yuen Estate → Star Ferry |
| `?route=118` | Route 118 outbound — 3 service types merged |
| `?route=960&bound=I` | Route 960 inbound — Exhibition Centre → Tuen Mun |

---

## 🚀 Quick Start

### Option 1: Local HTTP Server (recommended)

```bash
# No npm needed — use any static server:
npx http-server -p 8080
# Python: python -m http.server 8080
# Then open http://localhost:8080/?route=118
```

### Option 2: Open directly (Firefox)

Open `index.html` in **Firefox** — Firefox allows `fetch()` from `file://` to CORS-enabled APIs.

### Option 3: Deploy to cloud

Drop the project folder on **Cloudflare Pages**, **Netlify**, or any static host.

---

## 📁 Project Structure

```
├── index.html           # Single page app (2KB)
├── css/
│   └── style.css        # All styles (~200 lines)
└── js/
    ├── logger.js         # Logger class — ring buffer, copy-to-clipboard
    ├── lang.js           # LanguageManager — i18n toggle (繁/EN/简)
    ├── api.js            # ApiClient — fetch with timeout + abort
    ├── route.js          # RouteManager — discover + merge service types
    ├── eta.js            # EtaManager — 30s polling
    ├── map.js            # MapManager — Leaflet wrapper
    ├── ui.js             # UIManager — jQuery DOM rendering
    └── app.js            # BusTrackerApp — main controller
```

**Zero build tools.** No package.json, no node_modules, no bundler.
Each JS file is a single class following OOP separation of concerns.

---

## 🔧 Usage

### URL Parameters

| Param | Values | Default | Example |
|---|---|---|---|
| `route` | Any KMB route | **required** | `?route=118` |
| `bound` | `O` (Outbound) / `I` (Inbound) | `O` | `?route=118&bound=I` |

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
│  index.html?route=118&bound=O                  │
│       │                                         │
│       ▼                                         │
│  BusTrackerApp (app.js)                         │
│  ├── RouteManager (route.js)                    │
│  │   ├── ApiClient.discoverServiceTypes()       │
│  │   ├── ApiClient.fetchRoute()                 │
│  │   ├── ApiClient.fetchRouteStops() × N types  │
│  │   └── merge stop lists                       │
│  ├── EtaManager (eta.js)                        │
│  │   └── ApiClient.fetchRouteEta() × N types    │
│  │   └── polls every 30s                        │
│  ├── MapManager (map.js)                        │
│  │   └── Leaflet + OpenStreetMap                │
│  ├── UIManager (ui.js)                          │
│  │   └── jQuery DOM rendering                   │
│  ├── Logger (logger.js)                         │
│  └── LanguageManager (lang.js)                  │
│                                                 │
└──────────────┬──────────────────────────────────┘
               │ HTTPS (CORS)
               ▼
┌───────────────────────────────────────────────┐
│        data.etabus.gov.hk (KMB Open Data)       │
│                                                 │
│  /v1/transport/kmb/route/                       │
│  /v1/transport/kmb/route/{r}/{b}/{s}            │
│  /v1/transport/kmb/route-stop/{r}/{b}/{s}       │
│  /v1/transport/kmb/stop/{stop_id}                │
│  /v1/transport/kmb/route-eta/{r}/{s}            │
└───────────────────────────────────────────────┘
```

### Data Flow

```
1. User opens ?route=118&bound=O
2. App.jsx parses URL params
3. RouteManager.load("118", "O"):
   a. ApiClient.discoverServiceTypes("118", "O") → [1, 2, 3]
   b. For each type: fetch route details + stop list
   c. Merge: union of all stop IDs, primary order from type 1
   d. For each unique stop: fetchStop() → name, lat, long
4. EtaManager.start("118", [1, 2, 3]):
   a. Every 30s: fetchRouteEta for each type
   b. Merge ETA by stop sequence
5. UIManager renders:
   - Stop list with ETA countdowns
   - Map with markers + polyline
```

---

## 📚 Class Reference

| Class | File | Responsibility |
|---|---|---|
| `Logger` | `logger.js` | Singleton ring buffer (500 entries), `getPlainText()`, exposed as `window.__BUS_LOG` |
| `LanguageManager` | `lang.js` | TC/EN/SC toggle, `t(tc, en, sc)` translation, localStorage persistence |
| `ApiClient` | `api.js` | All KMB API calls, bound conversion (`O`↔`outbound`), 10s timeout via AbortController |
| `RouteManager` | `route.js` | Service type discovery, multi-type merge, stop detail fetch, in-memory cache |
| `EtaManager` | `eta.js` | ETA polling (30s), multi-type merge, jQuery custom events (`eta:update`) |
| `MapManager` | `map.js` | Leaflet init, stop markers, route polyline, bounds fitting |
| `UIManager` | `ui.js` | All DOM via jQuery, landing/route/debug views, ETA formatting, error/loading/empty states |
| `BusTrackerApp` | `app.js` | URL parsing, event binding, navigation orchestration, history management |

---

## 🌐 API Reference

Data source: [data.gov.hk - KMB/LWB ETA](https://data.gov.hk/tc-data/dataset/hk-td-tis_21-etakmb)

| Endpoint | Description |
|---|---|
| `GET /route/` | List all routes with bound + service type |
| `GET /route/{r}/{b}/{s}` | Route details (`b` = `outbound`/`inbound`) |
| `GET /route-stop/{r}/{b}/{s}` | Stops in sequence |
| `GET /stop/{id}` | Stop name + lat/long |
| `GET /route-eta/{r}/{s}` | Real-time ETA (poll this every 30s) |

> **Bound:** Detail endpoints use `outbound`/`inbound`. Responses use `O`/`I`.
> The `ApiClient` handles conversion automatically.
> **Auth:** None — fully public. **ETA:** ISO 8601 or `null` if no bus scheduled.

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

Currently only KMB (九巴) and LWB (龍運) data is publicly available via the Government Open Data portal. Citybus does not yet have a public real-time API.

### Why can't I open `index.html` directly in Chrome?

Chrome blocks `fetch()` from `file://` for security. Use **Firefox** (which allows CORS from file://) or run any static server:

```bash
npx http-server -p 8080
python -m http.server 8080
```

### How is the route line drawn?

Stops are connected in sequence with a straight red polyline. KMB's API does not provide road geometry — this is an approximation using stop coordinates.

---

## 📄 License

MIT License. Data belongs to **KMB** / **HKSAR Government Transport Department**.

---

<div align="center">
  <sub>Built with jQuery + Leaflet + OpenStreetMap</sub>
  <br/>
  <sub>Data: <a href="https://data.gov.hk/tc-data/dataset/hk-td-tis_21-etakmb">data.gov.hk</a></sub>
  <br/>
  <sub>Zero backend &bull; Zero build &bull; No npm required</sub>
</div>
