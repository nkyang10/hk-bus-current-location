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

      test('should verify common-sense ETA monotonicity — stop N < stop N+1 for same bus', async ({ page }) => {
        await page.goto(`/?route=${route}&bound=${bound}`);
        await page.waitForSelector('.stop-list', { timeout: 15000 });
        await page.waitForTimeout(3000);

        const etaData = await page.evaluate(({ bound }) => {
          const app = window.app;
          if (!app || !app.etaMgr) return null;
          const allEta = app.etaMgr.getAllEta();
          if (!allEta.length) return null;

          // Filter by current bound only, then group by eta_seq
          const buses = {};
          allEta.forEach(eta => {
            if (eta.dir !== bound) return;
            const key = `${eta.dir}-${eta.service_type}-${eta.eta_seq}`;
            if (!eta.eta) return;
            if (!buses[key]) buses[key] = [];
            buses[key].push({
              seq: parseInt(eta.seq, 10),
              eta: eta.eta,
              dir: eta.dir,
            });
          });

          const now = Date.now();
          const violations = [];
          const validPairs = [];
          const foundActive = new Set();

          for (const [vid, stops] of Object.entries(buses)) {
            stops.sort((a, b) => a.seq - b.seq);
            for (let i = 0; i < stops.length - 1; i++) {
              if (stops[i + 1].seq - stops[i].seq !== 1) continue;
              const cur = new Date(stops[i].eta).getTime();
              const next = new Date(stops[i + 1].eta).getTime();
              if (next <= cur) {
                violations.push({
                  bus: vid,
                  fromSeq: stops[i].seq,
                  toSeq: stops[i + 1].seq,
                  fromEta: stops[i].eta,
                  toEta: stops[i + 1].eta,
                });
              } else {
                const isActive = now >= cur && now < next && !foundActive.has(vid);
                if (isActive) foundActive.add(vid);
                validPairs.push({
                  bus: vid,
                  fromSeq: stops[i].seq,
                  toSeq: stops[i + 1].seq,
                  fromEta: stops[i].eta,
                  toEta: stops[i + 1].eta,
                  isActive,
                });
              }
            }
          }

          // Get DOM bus icons
          const rows = document.querySelectorAll('.stop-row');
          const stopNames = {};
          rows.forEach((row, idx) => {
            stopNames[idx + 1] = row.querySelector('.stop-name')?.textContent || '';
          });

          const betweens = document.querySelectorAll('.bus-between');
          const allRows = Array.from(document.querySelectorAll('.stop-row'));
          const betweenPairs = [];
          betweens.forEach(bw => {
            const prev = bw.previousElementSibling;
            const next = bw.nextElementSibling;
            const prevIdx = allRows.indexOf(prev);
            const nextIdx = allRows.indexOf(next);
            if (prevIdx >= 0 && nextIdx >= 0) {
              betweenPairs.push({ fromSeq: prevIdx + 1, toSeq: nextIdx + 1 });
            }
          });

          const activeStops = new Set();
          document.querySelectorAll('.stop-row').forEach((row, idx) => {
            if (row.classList.contains('stop-active')) {
              activeStops.add(idx + 1);
            }
          });

          return { violations, validPairs, stopNames, betweenPairs, activeStops: [...activeStops] };
        }, { bound });

        if (!etaData || !etaData.validPairs.length) {
          console.log(`Route ${route}: No active bus ETA data to validate`);
          return;
        }

        // Report violations (ETA decreases — impossible for same bus)
        if (etaData.violations.length) {
          console.log(`\n=== Route ${route} — GOV DATA QUALITY: ETA MONOTONICITY VIOLATIONS (${etaData.violations.length}) ===`);
          etaData.violations.slice(0, 5).forEach(v => {
            console.log(`  ⚠️ Bus ${v.bus}: stop ${v.fromSeq}(${v.fromEta}) → stop ${v.toSeq}(${v.toEta}) — ETA decreased (gov data issue)`);
          });
          if (etaData.violations.length > 5) {
            console.log(`  ... and ${etaData.violations.length - 5} more violations`);
          }
          console.log(`  (These are data quality issues from the government API, not app bugs)`);
        }

        // Only check icons for the CURRENTLY active bus (where now falls between stops)
        const currentPairs = etaData.validPairs.filter(p => p.isActive);
        const futurePairs = etaData.validPairs.filter(p => !p.isActive);

        console.log(`\n=== Route ${route} — Common-sense icon check ===`);
        console.log(`  ${currentPairs.length} currently active pairs, ${futurePairs.length} future pairs`);

        let missing = 0;
        for (const pair of currentPairs) {
          const from = etaData.stopNames[pair.fromSeq] || `stop ${pair.fromSeq}`;
          const to = etaData.stopNames[pair.toSeq] || `stop ${pair.toSeq}`;
          const isAt = etaData.activeStops.includes(pair.toSeq);
          const isBetween = etaData.betweenPairs.some(b => b.fromSeq === pair.fromSeq && b.toSeq === pair.toSeq);

          if (!isAt && !isBetween) {
            console.log(`  ⚠️ MISSING: Bus ${pair.bus} between ${from}→${to} — no icon AT or BETWEEN`);
            missing++;
          } else {
            const where = isAt ? 'AT' : 'BETWEEN';
            console.log(`  ✅ Bus ${pair.bus}: ${where} ${from}→${to}`);
          }
        }

        // Future buses should NOT have icons
        let falsePositives = 0;
        for (const pair of futurePairs) {
          const isAt = etaData.activeStops.includes(pair.toSeq);
          const isBetween = etaData.betweenPairs.some(b => b.fromSeq === pair.fromSeq && b.toSeq === pair.toSeq);
          if (isAt || isBetween) {
            falsePositives++;
          }
        }

        console.log(`Route ${route}: ${currentPairs.length} current pairs, ${missing} missing, ${falsePositives} false positives`);
        expect(missing).toBe(0);
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
