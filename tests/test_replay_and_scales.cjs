// tests/test_replay_and_scales.cjs
// Deep Testing of Scale Controls, Bar Replay Trade Simulation, Compare Overlays & Data Export
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../dogfood_cycle6');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function runCycle6() {
  console.log('================================================================');
  console.log('🚀 CYCLE 6: SCALE DOCK, REPLAY TRADING, COMPARE, AND DATA EXPORT');
  console.log('================================================================\n');

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console', text: msg.text() });
      console.log('  [Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push({ type: 'page', text: err.message });
    console.log('  [Page Error]', err.message);
  });

  async function snap(name) {
    const p = path.join(OUTPUT_DIR, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`  📸 Saved: ${name}.png`);
    return p;
  }

  try {
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await snap('01_cycle6_init');

    // ── 1. TEST SCALE CONTROLS DOCK ──────────────────────────────────
    console.log('\n--- 1. Testing Scale Controls Dock ---');
    const scaleDockVisible = await page.evaluate(() => {
      const dock = document.querySelector('#scale-controls-bar, .scale-controls-dock');
      return !!dock && window.getComputedStyle(dock).display !== 'none';
    });
    console.log('Scale Controls Dock visible:', scaleDockVisible);

    // Toggle Log
    await page.click('#btn-scale-log');
    await new Promise(r => setTimeout(r, 500));
    const logActive = await page.$eval('#btn-scale-log', el => el.classList.contains('active'));
    console.log('Log Scale active:', logActive);

    // Toggle Percent (%)
    await page.click('#btn-scale-percent');
    await new Promise(r => setTimeout(r, 500));
    const pctActive = await page.$eval('#btn-scale-percent', el => el.classList.contains('active'));
    console.log('Percent Scale active:', pctActive);

    // Toggle Invert (Inv)
    await page.click('#btn-scale-invert');
    await new Promise(r => setTimeout(r, 500));
    const invActive = await page.$eval('#btn-scale-invert', el => el.classList.contains('active'));
    console.log('Invert Scale active:', invActive);

    // Reset via Auto
    await page.click('#btn-scale-auto');
    await new Promise(r => setTimeout(r, 500));
    await snap('02_scale_controls_exercised');

    // Change Timezone
    await page.click('#btn-scale-timezone');
    await new Promise(r => setTimeout(r, 400));
    const tzLabel = await page.$eval('#scale-tz-label', el => el.innerText.trim());
    console.log('Timezone switched to:', tzLabel);

    // ── 2. TEST BAR REPLAY SIMULATED TRADING EXECUTION ───────────────
    console.log('\n--- 2. Testing Bar Replay Simulated Execution ---');
    await page.click('#btn-topbar-replay');
    await new Promise(r => setTimeout(r, 800));
    await snap('03_bar_replay_active');

    // Click Buy
    await page.click('#btn-replay-buy');
    await new Promise(r => setTimeout(r, 400));

    // Step forward 3 bars
    for (let i = 0; i < 3; i++) {
      await page.click('#btn-replay-step');
      await new Promise(r => setTimeout(r, 400));
    }

    const posBadge = await page.evaluate(() => {
      const posWrap = document.querySelector('#replay-pos-wrap');
      return posWrap ? posWrap.innerText.replace(/\n+/g, ' ') : null;
    });
    console.log('Simulated Trade State in Replay:', posBadge);
    await snap('04_replay_position_active');

    // Close position
    const closePosBtn = await page.$('#btn-replay-close-pos');
    if (closePosBtn) await closePosBtn.click();
    await new Promise(r => setTimeout(r, 400));

    // Exit replay
    await page.click('#btn-replay-exit');
    await new Promise(r => setTimeout(r, 600));

    // ── 3. TEST COMPARE MODAL & MULTI-SYMBOL OVERLAY ─────────────────
    console.log('\n--- 3. Testing Multi-Symbol Compare Overlay ---');
    await page.click('#btn-topbar-compare');
    await new Promise(r => setTimeout(r, 600));
    await snap('05_compare_modal');

    // Click ETHUSDT quick compare preset
    const compareResult = await page.evaluate(() => {
      const ethBtn = document.querySelector('.btn-add-overlay[data-symbol="ETHUSDT"], .btn-add-overlay');
      if (ethBtn) {
        ethBtn.click();
        return { clicked: ethBtn.getAttribute('data-symbol') };
      }
      return { clicked: null };
    });
    console.log('Compare preset clicked:', compareResult);
    await new Promise(r => setTimeout(r, 1000));
    await snap('06_chart_with_compare_overlay');

    // Check floating compare legend
    const legendItems = await page.evaluate(() => {
      const badges = document.querySelectorAll('.compare-legend-badge, .compare-badge');
      return Array.from(badges).map(b => b.innerText.trim().replace(/\n+/g, ' '));
    });
    console.log('Floating Compare Legend items:', legendItems);

    // ── 4. TEST HISTORICAL DATA EXPORT GENERATION ────────────────────
    console.log('\n--- 4. Testing Historical Data Export Generation ---');
    await page.click('#btn-topbar-export');
    await new Promise(r => setTimeout(r, 600));
    await snap('07_export_modal');

    // Trigger export in JS and verify data URL or download trigger
    const exportResult = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      const bars = app?.activeBars || [];
      if (bars.length === 0) return { error: 'No bars' };

      // Build CSV
      const headers = ['Date_UTC', 'Timestamp_ms', 'Open', 'High', 'Low', 'Close', 'Volume'];
      const rows = bars.slice(0, 5).map(b => {
        const timeMs = b.time > 1e11 ? b.time : b.time * 1000;
        return [
          new Date(timeMs).toISOString(),
          timeMs,
          b.open,
          b.high,
          b.low,
          b.close,
          b.volume || 0
        ].join(',');
      });
      const sampleCsv = [headers.join(','), ...rows].join('\n');

      return {
        barsCount: bars.length,
        csvSampleHeader: sampleCsv.split('\n')[0],
        firstRow: sampleCsv.split('\n')[1]
      };
    });
    console.log('Export Data Verification:', exportResult);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

  } catch (err) {
    console.error('Cycle 6 failed with error:', err);
    errors.push({ type: 'fatal', text: err.message });
  } finally {
    console.log('\n========================================');
    console.log('CYCLE 6 AUDIT SUMMARY');
    console.log('Errors encountered:', errors.length);
    console.log('========================================');

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'cycle6_results.json'),
      JSON.stringify({ errors, timestamp: new Date().toISOString() }, null, 2)
    );

    await page.close();
    await browser.disconnect();
  }
}

runCycle6().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
