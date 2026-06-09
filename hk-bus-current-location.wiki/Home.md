# 🚌 HK Bus Tracker Wiki

Welcome! This wiki documents **HK Bus Tracker v2** — a pure client-side, zero-build, jQuery-based SPA for real-time KMB/LWB bus arrival tracking.

## 📖 Pages

| Page | Description |
|---|---|
| [[Home]] | You are here |
| [[User-Guide]] | How to use the app, URL params, all features |
| [[API-Reference]] | KMB Open Data API endpoints and data formats |
| [[Architecture]] | System design, class diagram, data flow |
| [[Development]] | Project structure, class reference, coding conventions |
| [[Deployment]] | Deploying to any static host |
| [[Troubleshooting]] | Common issues and solutions |
| [[Changelog]] | Version history |

## ✨ Quick Links

- **Try it:** `http://localhost:8080/?route=118` (after starting any static server)
- **GitHub:** [nkyang10/hk-bus-current-location](https://github.com/nkyang10/hk-bus-current-location)
- **Data:** [data.gov.hk - KMB ETA](https://data.gov.hk/tc-data/dataset/hk-td-tis_21-etakmb)
- **Zero backend, zero build** — just open in a browser

## 🚀 One-Line Start

```bash
npx http-server -p 8080
# then open http://localhost:8080/?route=1
```

(Or open `v2/index.html` in Firefox — no server needed.)
