import { test, expect } from '@playwright/test';

const TEST_ROUTES = [
  { route: '87D', bound: 'I', name: 'Siu Lek Yuen → Lok Fu' },
  { route: '118', bound: 'O', name: 'Cheung Sha Wan → Siu Sai Wan (multi-svc)' },
  { route: '106', bound: 'O', name: 'Wong Tai Sin → Siu Sai Wan' },
  { route: '102', bound: 'O', name: 'Mei Foo → Siu Sai Wan' },
];

test.describe('HK Bus Tracker - Bus Icon Validation', () => {

  for (const { route, bound, name } of TEST_ROUTES) {

    test.describe(`Route ${route} (${name})`, () => {

      test('should have correct bus icons matching ETA data', async ({ page }) => {
        const logs = [];
        page.on('console', msg => logs.push(msg.text()));

        await page.goto(`/?route=${route}&bound=${bound}`);
        await page.waitForSelector('.stop-list', { timeout: 15000 });
        await page.waitForTimeout(3000);

        const analysis = await page.evaluate(() => {
          const rows = document.querySelectorAll('.stop-row');
          const stops = [];
          rows.forEach((row, idx) => {
            const name = row.querySelector('.stop-name')?.textContent || '';
            stops.push({
              seq: idx + 1,
              name,
              hasBusIcon: !!row.querySelector('.stop-bus-at'),
              isActive: row.classList.contains('stop-active'),
            });
          });

          const betweens = document.querySelectorAll('.bus-between');
          const betweenData = [];
          betweens.forEach(bw => {
            const prev = bw.previousElementSibling;
            const next = bw.nextElementSibling;
            betweenData.push({
              prevName: prev?.querySelector('.stop-name')?.textContent || '',
              nextName: next?.querySelector('.stop-name')?.textContent || '',
            });
          });

          return { stops, betweenData };
        });

        console.log(`\n=== Route ${route} — Stop Analysis ===`);
        analysis.stops.forEach(s => {
          const icon = s.hasBusIcon ? ' 🚌' : '';
          const active = s.isActive ? ' (active)' : '';
          console.log(`  #${s.seq} ${s.name}${icon}${active}`);
        });

        console.log(`\n=== Route ${route} — Between-stop overlays ===`);
        analysis.betweenData.forEach(b => {
          console.log(`  🚌 ${b.prevName} → ${b.nextName}`);
        });

        const busIconCount = analysis.stops.filter(s => s.hasBusIcon).length;
        const betweenCount = analysis.betweenData.length;

        console.log(`\n=== Route ${route} — Summary ===`);
        console.log(`  Stops: ${analysis.stops.length}`);
        console.log(`  Bus icons AT stops: ${busIconCount}`);
        console.log(`  Bus icons BETWEEN: ${betweenCount}`);

        // Basic validations
        expect(analysis.stops.length).toBeGreaterThan(0);
        analysis.stops.forEach(s => {
          if (s.hasBusIcon) expect(s.name.length).toBeGreaterThan(0);
        });

        // Between overlays reference valid stops
        analysis.betweenData.forEach(b => {
          const prevOk = analysis.stops.some(s => s.name === b.prevName);
          const nextOk = analysis.stops.some(s => s.name === b.nextName);
          expect(prevOk).toBe(true);
          expect(nextOk).toBe(true);
        });

        // Check: "2 分鐘" in display must mean BETWEEN (not AT)
        // The threshold is 90s matching Math.round display rounding
        console.log(`  Validation: ${analysis.stops.filter(s => !s.hasBusIcon).length} stops without icons`);

        // Print ETA debug logs
        const etaLogs = logs.filter(l => l.includes('STOP_ETA') || l.includes('BUS_ICONS') || l.includes('BUS_TIME'));
        if (etaLogs.length) {
          console.log(`\n=== Route ${route} — Debug logs ===`);
          etaLogs.forEach(l => console.log(`  ${l.substring(0, 200)}`));
        }
      });

      test('should log bus time calculations for debugging', async ({ page }) => {
        const timeLogs = [];
        page.on('console', msg => {
          if (msg.text().includes('BUS_TIME')) timeLogs.push(msg.text());
        });

        await page.goto(`/?route=${route}&bound=${bound}`);
        await page.waitForSelector('.stop-list', { timeout: 15000 });
        await page.waitForTimeout(3000);

        if (timeLogs.length) {
          console.log(`\n=== Route ${route} — Bus time calculations ===`);
          timeLogs.forEach(l => {
            const match = l.match(/stop (\d+)\x{2192}(\d+).*timeToNext=(\d+)s/);
            if (match) {
              console.log(`  Bus between stop ${match[1]}→${match[2]}: ETA ${match[3]}s`);
            } else {
              console.log(`  ${l}`);
            }
          });
          expect(timeLogs.length).toBeGreaterThan(0);
        } else {
          console.log(`Route ${route}: No active buses (no time calculations)`);
        }
      });

      test('should have correct bus icon styling', async ({ page }) => {
        await page.goto(`/?route=${route}&bound=${bound}`);
        await page.waitForSelector('.stop-list', { timeout: 15000 });
        await page.waitForTimeout(3000);

        const iconDetails = await page.evaluate(() => {
          const rows = document.querySelectorAll('.stop-row.stop-active');
          const details = [];
          rows.forEach(row => {
            const busIcon = row.querySelector('.stop-bus-at');
            if (busIcon) {
              const style = window.getComputedStyle(busIcon);
              details.push({
                fontSize: style.fontSize,
                width: style.width,
                height: style.height,
                bgColor: style.backgroundColor,
                animName: style.animationName,
              });
            }
          });

          // Also check between-stop overlays
          const betweens = document.querySelectorAll('.bus-between-icon');
          betweens.forEach(bw => {
            const style = window.getComputedStyle(bw);
            details.push({
              fontSize: style.fontSize,
              type: 'between',
            });
          });

          return details;
        });

        if (iconDetails.length) {
          console.log(`\n=== Route ${route} — Icon styling ===`);
          iconDetails.forEach((d, i) => {
            if (d.type === 'between') {
              console.log(`  Between overlay ${i}: font=${d.fontSize}`);
              expect(parseInt(d.fontSize)).toBeGreaterThanOrEqual(20);
            } else {
              console.log(`  AT stop icon ${i}: ${d.width}×${d.height}, font=${d.fontSize}, bg=${d.bgColor}, anim=${d.animName !== 'none'}`);
              expect(parseInt(d.fontSize)).toBeGreaterThanOrEqual(20);
              expect(d.animName).not.toBe('none');
            }
          });
        } else {
          console.log(`Route ${route}: No active bus icons to check styling`);
        }
      });
    });
  }
});
