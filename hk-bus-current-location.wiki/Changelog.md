# Changelog

## 2.0.0 (2026-06-09)

Complete rewrite — jQuery-based, zero-build SPA.

### Changed
- **Architecture:** React + Vite → vanilla JS classes + jQuery
- **Zero build tools:** No npm, no package.json, no bundler
- **All JS as ES6 classes:** Logger, LanguageManager, ApiClient, RouteManager, EtaManager, MapManager, UIManager, BusTrackerApp
- **CSS rewritten:** Pure CSS, no Tailwind — ~200 lines, no build step
- **Single HTML page:** `v2/index.html` with CDN-loaded jQuery + Leaflet

### Features retained
- Real-time KMB/LWB ETA with 30s auto-refresh
- Multi-service-type merging (route 118 types 1/2/3)
- URL param routing (`?route=118&bound=O`)
- Leaflet map with stop markers + polyline
- Multi-language (繁/EN/简)
- Debug panel with copy-to-clipboard
- Recent routes (localStorage)
- Mobile-first responsive design

### Removed
- React 18 dependency
- Vite build system
- Tailwind CSS
- npm/Node.js requirements
- `v1/` directory (migrated to `v2/`)

## 1.0.0 (2026-06-09)

Initial release with React + Vite.
