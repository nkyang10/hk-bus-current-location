# Troubleshooting

## "路線不存在 Route not found"

**Cause:** The route number doesn't exist in KMB's database.

**Fix:** Double-check the route number. KMB operates most HK routes but some are Citybus-only.

## No ETA (all "—")

**Cause:** No buses currently running.

**Fix:** Try during daytime hours (~06:00–00:00). Most routes don't operate 24/7.

## "載入失敗 Load failed"

**Cause:** API is unreachable or network issue.

**Fix:**
- Check internet connection
- The KMB API may be down — wait and retry
- Click the **重試 Retry** button

## Map not showing

**Cause:** Leaflet container may be hidden when initialized.

**Fix:** Toggle the map off and on using "Hide map / Show map". The `MapManager.invalidateSize()` call on toggle resolves this.

## Can't open in Chrome from file://

**Cause:** Chrome blocks `fetch()` from `file://` URLs.

**Fix:**
- Use **Firefox** (allows CORS from file://)
- Or run any static server: `npx http-server -p 8080`
- Or use Chrome with `--allow-file-access-from-files` flag

## Debug panel shows no logs

**Cause:** No API calls have been made yet.

**Fix:** Navigate to a route first. The logger starts capturing from page load.

## ETA shows "Scheduled Bus"

**Cause:** The API provides timetable times instead of real-time GPS.

**Note:** Normal for early morning / late night. The `rmk_en` field indicates "Scheduled Bus" when no real-time data is available.

## Service type badges not showing

**Cause:** The route only has one service type (most routes).

**Fix:** This is normal. Only routes like 118 have multiple types.

## Language won't change

**Cause:** `localStorage` may be disabled or cleared.

**Fix:** Enable `localStorage` in browser settings. The default is 繁體中文.

## Copy Log doesn't work

**Cause:** Clipboard API may be blocked by browser permissions.

**Fix:** The app falls back to `document.execCommand('copy')`. Ensure the page has user focus when clicking.
