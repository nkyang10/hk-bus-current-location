# Plan: Rename "香港巴士動態" to "九巴即時到站"

## Summary
Change the KMB landing page title from "香港巴士動態" (Hong Kong Bus Dynamics) to "九巴即時到站" (KMB Real-time Arrival) to match the CTB naming pattern "城巴即時到站".

## Files to Update

### 1. `js/ui.js` (line 20)
**Current:**
```js
: this.lang.t('香港巴士動態', 'HK Bus Tracker', '香港巴士动态')
```

**Change to:**
```js
: this.lang.t('九巴即時到站', 'KMB Bus Tracker', '九巴即时到站')
```

### 2. `index.html` (3 locations)
- Line 6: meta description
- Line 8: og:title
- Line 11: page title

**Change all instances of:**
- "香港巴士動態" → "九巴即時到站"
- "HK Bus Tracker" → "KMB Bus Tracker"

### 3. `README.md` (line 5)
**Change:**
- "香港巴士動態" → "九巴即時到站"

### 4. `tests/frontpage.spec.js` (3 test assertions)
- Line 40: `await expect(title).toContainText('香港巴士動態')`
- Line 86: `await expect(title).toContainText('巴士動態')`
- Line 108: `await expect(titleTc).toContainText('巴士動態')`

**Change all to:**
```js
await expect(...).toContainText('九巴即時到站')
```

## Impact
- Landing page title will now show "九巴即時到站" for KMB and "城巴即時到站" for CTB
- Browser tab title will show "九巴即時到站 — KMB Bus Tracker"
- Meta tags and social sharing will reflect the new name
- Tests will be updated to match new text

## Verification
After deployment, check:
1. Landing page shows "九巴即時到站" when KMB is selected
2. Landing page shows "城巴即時到站" when CTB is selected
3. Browser tab shows "九巴即時到站 — KMB Bus Tracker"
4. Run tests to ensure they pass
