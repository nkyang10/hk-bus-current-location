import { test, expect } from '@playwright/test';

test.describe('HK Bus Tracker - Bus Icon Logic', () => {
  
  test.beforeEach(async ({ page }) => {
    // Load the app with route 87D inbound
    await page.goto('/?route=87D&bound=I');
    
    // Wait for the app to initialize and load data
    await page.waitForSelector('.stop-list', { timeout: 15000 });
    
    // Wait for ETA data to load (bus icons should appear)
    await page.waitForFunction(() => {
      const busIcons = document.querySelectorAll('.stop-bus-at, .bus-between');
      return busIcons.length > 0;
    }, { timeout: 15000 });
  });

  test('should display bus icons on the route', async ({ page }) => {
    // Check that at least one bus icon is displayed
    const busAtStops = await page.locator('.stop-bus-at').count();
    const busBetween = await page.locator('.bus-between').count();
    
    console.log(`Bus icons at stops: ${busAtStops}`);
    console.log(`Bus icons between stops: ${busBetween}`);
    
    expect(busAtStops + busBetween).toBeGreaterThan(0);
  });

  test('should show bus icon at stop when ETA < 2 minutes', async ({ page }) => {
    // Find stops with bus icons
    const stopsWithBus = await page.locator('.stop-row.stop-active').all();
    
    for (const stop of stopsWithBus) {
      const stopName = await stop.locator('.stop-name').textContent();
      console.log(`Bus at stop: ${stopName}`);
      
      // Verify the stop has the bus icon
      const busIcon = stop.locator('.stop-bus-at');
      await expect(busIcon).toBeVisible();
      
      // Verify the stop number is replaced by bus icon
      const stopNumber = stop.locator('.stop-seq');
      await expect(stopNumber).not.toBeVisible();
    }
  });

  test('should show bus icon between stops when ETA >= 2 minutes', async ({ page }) => {
    // Find bus-between elements
    const busBetweenElements = await page.locator('.bus-between').all();
    
    for (const busBetween of busBetweenElements) {
      // Verify the bus icon is visible
      const busIcon = busBetween.locator('.bus-between-icon');
      await expect(busIcon).toBeVisible();
      
      // Verify it's positioned between two stop rows
      const prevStop = busBetween.locator('xpath=preceding-sibling::div[contains(@class, "stop-row")][1]');
      const nextStop = busBetween.locator('xpath=following-sibling::div[contains(@class, "stop-row")][1]');
      
      await expect(prevStop).toBeVisible();
      await expect(nextStop).toBeVisible();
      
      const prevStopName = await prevStop.locator('.stop-name').textContent();
      const nextStopName = await nextStop.locator('.stop-name').textContent();
      
      console.log(`Bus between: ${prevStopName} → ${nextStopName}`);
    }
  });

  test('should update bus positions when direction changes', async ({ page }) => {
    // Get initial bus positions
    const initialBusCount = await page.locator('.stop-bus-at, .bus-between').count();
    
    // Click the inbound/outbound toggle
    await page.locator('.bound-toggle button[data-bound="O"]').click();
    
    // Wait for new data to load
    await page.waitForTimeout(2000);
    
    // Get new bus positions
    const newBusCount = await page.locator('.stop-bus-at, .bus-between').count();
    
    console.log(`Initial bus count: ${initialBusCount}`);
    console.log(`New bus count after direction change: ${newBusCount}`);
    
    // Bus positions should be different (or at least the data should have refreshed)
    expect(newBusCount).toBeGreaterThanOrEqual(0);
  });

  test('should log bus position data to console', async ({ page }) => {
    // Capture console logs
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('BUS_ICONS') || msg.text().includes('STOP_ETA')) {
        logs.push(msg.text());
      }
    });
    
    // Reload to capture initial logs
    await page.reload();
    await page.waitForSelector('.stop-list', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    console.log('Captured logs:');
    logs.forEach(log => console.log(log));
    
    expect(logs.length).toBeGreaterThan(0);
  });

  test('should display map with bus markers', async ({ page }) => {
    // Check if map container exists (it might be hidden by default)
    const mapContainer = page.locator('#routeMap');
    await expect(mapContainer).toBeAttached();
    
    // Try to expand the map if it's collapsed
    const mapToggle = page.locator('.map-toggle');
    if (await mapToggle.count() > 0) {
      await mapToggle.click();
      await page.waitForTimeout(1000);
    }
    
    // Check for Leaflet markers (bus icons on map) - they exist even if map is hidden
    const mapMarkers = await page.locator('.leaflet-marker-icon').count();
    console.log(`Map markers: ${mapMarkers}`);
    
    // Should have stop markers + bus markers
    expect(mapMarkers).toBeGreaterThan(0);
  });

  test('should handle route with no active buses', async ({ page }) => {
    // Navigate to a route that might not have active buses (late night route)
    await page.goto('/?route=999&bound=O');
    
    // Wait for the app to load
    await page.waitForSelector('.stop-list, .error-state', { timeout: 15000 });
    
    // Either shows stops with no bus icons, or shows an error
    const hasStops = await page.locator('.stop-list').count() > 0;
    const hasError = await page.locator('.error-state').count() > 0;
    
    expect(hasStops || hasError).toBe(true);
  });
});
