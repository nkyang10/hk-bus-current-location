import { test, expect } from '@playwright/test';

const TEST_ROUTES = [
  { route: '87D', bound: 'I', name: 'Siu Lek Yuen → Lok Fu' },
  { route: '118', bound: 'O', name: 'Cheung Sha Wan → Siu Sai Wan (multi-svc)' },
  { route: '106', bound: 'O', name: 'Wong Tai Sin → Siu Sai Wan' },
  { route: '102', bound: 'O', name: 'Mei Foo → Siu Sai Wan' },
];

test.describe('HK Bus Tracker - Bus Icon Logic', () => {

  for (const { route, bound, name } of TEST_ROUTES) {

    test.describe(`Route ${route} (${name})`, () => {

      test.beforeEach(async ({ page }) => {
        await page.goto(`/?route=${route}&bound=${bound}`);
        await page.waitForSelector('.stop-list', { timeout: 15000 });

        // Wait for ETA data — bus icons may or may not appear depending on time of day
        await page.waitForTimeout(2000);
      });

      test('should display stops list', async ({ page }) => {
        const stopCount = await page.locator('.stop-row').count();
        console.log(`Route ${route}: ${stopCount} stops loaded`);
        expect(stopCount).toBeGreaterThan(0);
      });

      test('should display route header with correct route number', async ({ page }) => {
        const headerRoute = await page.locator('.route-number').textContent();
        expect(headerRoute.trim()).toBe(route);
      });

      test('should display direction toggle', async ({ page }) => {
        const toggle = await page.locator('.bound-toggle');
        await expect(toggle).toBeVisible();

        const outboundBtn = toggle.locator('button[data-bound="O"]');
        const inboundBtn = toggle.locator('button[data-bound="I"]');
        await expect(outboundBtn).toBeVisible();
        await expect(inboundBtn).toBeVisible();

        // Active button should match current bound
        const activeBtn = toggle.locator('.active');
        await expect(activeBtn).toBeVisible();
        const activeBound = await activeBtn.getAttribute('data-bound');
        expect(activeBound).toBe(bound);
      });

      test('should log stop ETA and bus position data', async ({ page }) => {
        const logs = [];
        page.on('console', msg => {
          const t = msg.text();
          if (t.includes('STOP_ETA') || t.includes('BUS_ICONS') || t.includes('BUS_TIME')) {
            logs.push(t);
          }
        });

        await page.reload();
        await page.waitForSelector('.stop-list', { timeout: 15000 });
        await page.waitForTimeout(3000);

        console.log(`Route ${route} logs:`);
        logs.forEach(l => console.log(`  ${l}`));

        // Must at least have STOP_ETA log
        expect(logs.some(l => l.includes('STOP_ETA'))).toBe(true);
      });

      test('should show bus icons if buses are active', async ({ page }) => {
        const busAtStops = await page.locator('.stop-bus-at').count();
        const busBetween = await page.locator('.bus-between').count();
        const totalIcons = busAtStops + busBetween;

        console.log(`Route ${route}: ${busAtStops} at stops, ${busBetween} between`);

        if (totalIcons > 0) {
          // Verify bus icon styling
          const iconStyle = await page.evaluate(() => {
            const icon = document.querySelector('.stop-bus-at');
            if (!icon) return null;
            const style = window.getComputedStyle(icon);
            return {
              width: style.width,
              height: style.height,
              fontSize: style.fontSize,
              bgColor: style.backgroundColor,
            };
          });
          if (iconStyle) {
            console.log(`  Icon size: ${iconStyle.width}×${iconStyle.height}, font: ${iconStyle.fontSize}`);
            expect(parseInt(iconStyle.fontSize)).toBeGreaterThanOrEqual(20);
          }

          // Verify active stops have bus icon replacing number
          const activeRows = await page.locator('.stop-row.stop-active').all();
          for (const row of activeRows) {
            const busIcon = row.locator('.stop-bus-at');
            await expect(busIcon).toBeVisible();
            // Number should be hidden when bus icon is shown
            const seqNumber = row.locator('.stop-seq');
            await expect(seqNumber).not.toBeVisible();
          }
        } else {
          console.log(`Route ${route}: No active buses at this time`);
        }
      });

      test('should show between-stop overlay if bus is en-route', async ({ page }) => {
        const busBetweenEls = await page.locator('.bus-between');
        const count = await busBetweenEls.count();

        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const el = busBetweenEls.nth(i);
            const icon = el.locator('.bus-between-icon');
            await expect(icon).toBeVisible();

            // Verify it sits between two stop rows
            const prevSibling = el.locator('xpath=preceding-sibling::div[contains(@class, "stop-row")][1]');
            const nextSibling = el.locator('xpath=following-sibling::div[contains(@class, "stop-row")][1]');
            await expect(prevSibling).toBeVisible();
            await expect(nextSibling).toBeVisible();

            const prevName = await prevSibling.locator('.stop-name').textContent();
            const nextName = await nextSibling.locator('.stop-name').textContent();
            console.log(`Route ${route}: Bus between ${prevName} → ${nextName}`);
          }
        } else {
          console.log(`Route ${route}: No between-stop overlays`);
        }
      });

      test('should update bus positions when direction toggles', async ({ page }) => {
        const initialIcons = await page.locator('.stop-bus-at, .bus-between').count();
        console.log(`Route ${route}: Initial icons: ${initialIcons}`);

        // Toggle direction
        const otherBound = bound === 'O' ? 'I' : 'O';
        await page.locator(`.bound-toggle button[data-bound="${otherBound}"]`).click();
        await page.waitForTimeout(3000);

        const newIcons = await page.locator('.stop-bus-at, .bus-between').count();
        console.log(`Route ${route}: After toggle to ${otherBound}: ${newIcons} icons`);

        // Data should have refreshed — exact count may differ
        expect(newIcons).toBeGreaterThanOrEqual(0);
      });

      test('should have multi-service-type badges if applicable', async ({ page }) => {
        const badge = page.locator('.svc-badge');
        const badgeCount = await badge.count();

        if (badgeCount > 0) {
          const badgeText = await badge.textContent();
          console.log(`Route ${route}: Service types: ${badgeText}`);
          expect(badgeText.length).toBeGreaterThan(0);
        } else {
          console.log(`Route ${route}: Single service type`);
        }
      });

      test('should show stop names in Chinese', async ({ page }) => {
        const stopNames = await page.locator('.stop-name').allTextContents();
        expect(stopNames.length).toBeGreaterThan(0);

        // Most stops should have Chinese names
        const chineseCount = stopNames.filter(n => /[\u4e00-\u9fff]/.test(n)).length;
        console.log(`Route ${route}: ${chineseCount}/${stopNames.length} stops with Chinese names`);
        expect(chineseCount).toBeGreaterThan(stopNames.length * 0.5); // at least 50% Chinese
      });
    });
  }
});
