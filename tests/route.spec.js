import { test, expect } from '@playwright/test'

test.describe('Route Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should search a KMB route and show stops', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    const stops = page.locator('.stop-row')
    await expect(stops.first()).toBeVisible()
    expect(await stops.count()).toBeGreaterThan(1)
  })

  test('should show route number in header after search', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.route-number', { timeout: 15000 })
    await expect(page.locator('.route-number')).toHaveText('1')
  })

  test('should show bound toggle buttons', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.bound-toggle .bound-btn', { timeout: 15000 })
    const btns = page.locator('.bound-toggle .bound-btn')
    const count = await btns.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('should show error for invalid route', async ({ page }) => {
    await page.fill('#searchInput', 'ZZZZZZ')
    await page.click('.search-btn')
    await page.waitForSelector('.error-state', { timeout: 15000 })
    const error = page.locator('.error-state')
    await expect(error).toBeVisible()
  })
})

test.describe('Route ETA Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should show ETA values after loading route', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    const etas = page.locator('.eta-val')
    const count = await etas.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('should show company label on route view', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('#routeCompany', { timeout: 15000 })
    await expect(page.locator('#routeCompany')).toContainText('KMB')
  })
})

test.describe('Map Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should show map toggle button when route is loaded', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    const btn = page.locator('#mapToggleBtn')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveText('🗺️')
  })

  test('should toggle to map view on click', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    await page.click('#mapToggleBtn')
    const btn = page.locator('#mapToggleBtn')
    await expect(btn).toHaveText('📋', { timeout: 10000 })
    const mapView = page.locator('#mapView')
    await expect(mapView).toBeVisible()
  })

  test('should toggle map button icon between map and list', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    const btn = page.locator('#mapToggleBtn')

    await page.click('#mapToggleBtn')
    await expect(btn).toHaveText('📋')

    await page.click('#mapToggleBtn')
    await expect(btn).toHaveText('🗺️')
  })

  test('should hide map button after navigating to landing', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    await page.click('#backBtn')
    const btn = page.locator('#mapToggleBtn')
    await expect(btn).not.toBeVisible()
  })
})

test.describe('Back Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should return to landing via back button', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    await page.click('#backBtn')
    await page.waitForSelector('.landing', { timeout: 5000 })
    await expect(page.locator('.landing')).toBeVisible()
  })
})

test.describe('URL Parameters', () => {
  test('should load route from URL query params', async ({ page }) => {
    await page.goto('/?route=1&bound=O&company=kmb')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    const routeNum = page.locator('.route-number')
    await expect(routeNum).toHaveText('1')
  })

  test('should load CTB route via URL company param', async ({ page }) => {
    await page.goto('/?route=5B&bound=O&company=ctb')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    await expect(page.locator('#routeCompany')).toContainText('CTB')
  })
})

test.describe('Language on Route View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should preserve language when navigating to route', async ({ page }) => {
    await page.click('#langBtn')
    await expect(page.locator('#langBtn')).toHaveText('EN')

    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.stop-row', { timeout: 15000 })
    await expect(page.locator('#langBtn')).toHaveText('EN')
  })

  test('should switch language on route view', async ({ page }) => {
    await page.fill('#searchInput', '1')
    await page.click('.search-btn')
    await page.waitForSelector('.stop-row', { timeout: 15000 })

    await page.click('#langBtn')
    await expect(page.locator('#langBtn')).toHaveText('EN')

    await page.click('#langBtn')
    await expect(page.locator('#langBtn')).toHaveText('简')
  })
})

test.describe('Debug Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should open and close debug panel', async ({ page }) => {
    await page.click('#debugBtn')
    await expect(page.locator('#debugPanel')).toBeVisible()
    await page.click('#debugPanel', { position: { x: 10, y: 10 } })
    await expect(page.locator('#debugPanel')).not.toBeVisible()
  })

  test('should show log entries in debug panel', async ({ page }) => {
    await page.click('#debugBtn')
    await page.waitForSelector('#debugPanel', { timeout: 5000 })
    const logBody = page.locator('#debugBody')
    await expect(logBody).not.toBeEmpty()
  })
})
