# User Guide

## Getting Started

Open the app. You'll see a landing page with a search box.

### Search by Route Number

Type a KMB route number and press **GO**:

| Route | Description |
|---|---|
| `1` | Chuk Yuen Estate ↔ Star Ferry |
| `1A` | Sau Mau Ping ↔ Star Ferry |
| `118` | Cheung Sha Wan ↔ Siu Sai Wan (3 service types merged) |
| `960` | Tuen Mun ↔ Exhibition Centre |
| `968` | Tin Shui Wai ↔ Causeway Bay |

### URL Parameters

```
?route=118&bound=O
```

| Param | Values | Default | Description |
|---|---|---|---|
| `route` | Any KMB route | **required** | Route number |
| `bound` | `O` / `I` | `O` | Outbound or Inbound |

Service types are auto-discovered — just provide the route number.

## All Features

### Real-time ETA

Each stop shows a countdown:

| Display | Meaning |
|---|---|
| `5 分鐘 min` | Bus arriving in 5 minutes |
| `2 分鐘 min` | Bus arriving soon |
| `到站 Due` | Bus at stop now |
| `即將到站 Arriving` | Bus pulling in |
| `已開出 Departed` | Bus just left |
| `—` | No bus data available |

Auto-refreshes every **30 seconds**.

### Direction Toggle

Switch between **往程 Outbound / 返程 Inbound**. URL updates automatically.

### Multi-Service-Type Merging

Routes like 118 have multiple service types (regular + short workings). The app:

- Discovers all types automatically
- Merges stops into unified order
- Shows badges (`S1` `S2` `S3`) on stops with multiple types
- Combines ETA from all types

### Map

Shows numbered stop markers with a red route polyline. Click for stop names. Toggle with **Hide map / Show map**.

### Language

Click **繁 / EN / 简** to switch. Preference is saved in `localStorage`.

### Recent Routes

After searching, routes appear under "最近查詢 Recent" on the landing page (max 8).

### Sharing

Copy the URL from your browser:

```
https://yoursite.com/?route=118&bound=O
```

Anyone who opens it sees the same route.

### Debug Panel

Click the 🐛 button (bottom-right). Features:
- View all runtime logs (API calls, ETA polls, errors)
- Filter by keyword
- Auto-scroll toggle
- **"Copy All Log"** — copies everything for troubleshooting

The logger is also accessible as `window.__BUS_LOG` in the browser console.
