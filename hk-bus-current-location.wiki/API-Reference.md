# API Reference

## Base URL

```
https://data.etabus.gov.hk/v1/transport/kmb
```

All endpoints return JSON with the following structure:

```json
{
  "status": 0,
  "msg": "",
  "count": 0,
  "data": [ ... ]
}
```

## Authentication

None. This is public open data provided by the Hong Kong Government.

## Endpoints

### Route List

```
GET /route/
```

Returns all KMB/LWB routes with bound and service type.

**Example:** `GET /route/`

```json
{
  "data": [
    { "route": "1", "bound": "O", "service_type": "1",
      "orig_en": "CHUK YUEN ESTATE", "dest_en": "STAR FERRY" },
    { "route": "1", "bound": "I", "service_type": "1",
      "orig_en": "STAR FERRY", "dest_en": "CHUK YUEN ESTATE" }
  ]
}
```

| Field | Description |
|---|---|
| `route` | Route number |
| `bound` | `O` = Outbound, `I` = Inbound |
| `service_type` | `1` = Regular, `2`/`3` = Short working/variant |
| `orig_en/tc/sc` | Origin stop name |
| `dest_en/tc/sc` | Destination stop name |

**Note:** `bound` in responses uses `O`/`I`. Detail endpoints expect `outbound`/`inbound`.

### Route Details

```
GET /route/{route}/{bound}/{service_type}
```

**Example:** `GET /route/118/outbound/1`

Returns a single route object with orig/dest names.

### Route-Stop List (all routes)

```
GET /route-stop/
```

Returns all route-stop mappings. Use for batch processing.

### Route-Stop Details

```
GET /route-stop/{route}/{bound}/{service_type}
```

**Example:** `GET /route-stop/118/outbound/1`

Returns ordered stops for a route:

```json
{
  "data": [
    { "route": "118", "bound": "O", "service_type": "1", "seq": "1",
      "stop": "494C28331301B811" },
    { "route": "118", "bound": "O", "service_type": "1", "seq": "2",
      "stop": "1E88575F644EF7D4" }
  ]
}
```

### Stop Details

```
GET /stop/{stop_id}
```

**Example:** `GET /stop/494C28331301B811`

```json
{
  "data": {
    "stop": "494C28331301B811",
    "name_en": "CHEUNG SHA WAN (SHAM MONG ROAD) BUS TERMINUS",
    "name_tc": "長沙灣(深旺道)巴士總站",
    "name_sc": "長沙灣(深旺道)巴士總站",
    "lat": "22.330274",
    "long": "114.148592"
  }
}
```

### Route ETA (recommended for polling)

```
GET /route-eta/{route}/{service_type}
```

**Example:** `GET /route-eta/118/1`

Returns real-time ETA for all stops on a route. **This is the endpoint polled every 30s.**

```json
{
  "data": [
    {
      "co": "KMB",
      "route": "118",
      "dir": "O",
      "service_type": 1,
      "seq": 1,
      "dest_en": "SIU SAI WAN (ISLAND RESORT)",
      "eta_seq": 1,
      "eta": "2026-06-09T09:30:00+08:00",
      "rmk_en": "Scheduled Bus",
      "data_timestamp": "2026-06-09T09:29:47+08:00"
    }
  ]
}
```

| Field | Description |
|---|---|
| `co` | Company code (`KMB`) |
| `dir` | Direction (`O`/`I`) |
| `seq` | Stop sequence number (matches route-stop) |
| `eta_seq` | Bus number (1st bus, 2nd bus at same stop) |
| `eta` | ISO 8601 timestamp, or `null` if no data |
| `rmk_en/tc/sc` | Remark text (e.g., "Scheduled Bus", delay info) |

### Stop ETA

```
GET /eta/{stop_id}/{route}/{service_type}
```

ETA for one specific stop.

### Stop-All-Routes

```
GET /stop-eta/{stop_id}
```

All routes serving a given stop, with ETA for each.

## Data Notes

- **Bound conversion:** App code handles `O`→`outbound` / `I`→`inbound` automatically
- **ETA matching:** ETA is matched to stops by `seq` (sequence number), not `stop` ID
- **`eta: null`** means no bus is currently scheduled — check operating hours
- **Service types:** Type `1` is the regular/full route; types `2+` are short-working variants
- **`rmk_en`** of `"Scheduled Bus"` means the time is from schedule, not real-time GPS
- **No road geometry:** The API does not provide GPS bus positions or route polylines
