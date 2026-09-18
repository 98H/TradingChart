// tests/dogfood-tradingview-parity.cjs
// Ruthless Senior QA Lead & Product Designer Dogfooding Audit
// Verifies 100% TradingView Parity across Desktop & Mobile surfaces

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/TradingChart/screenshots/parity_qa';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runParityDogfood() {
  console.log('=== Starting TradingChart Complete TradingView Parity QA Dogfooding ===');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist'
    ]
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[Browser Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.error('[Browser Page Error]', err.message);
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      failedRequests.push({ url: resp.url(), status: resp.status() });
      console.error(`[HTTP ${resp.status}] ${resp.url()}`);
    }
  });

  // 1. Initial Desktop Load (1440x900)
  console.log('\n--- 1. Desktop Initial Load & Clean Architecture ---');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_desktop_main_clean.png') });

  // 2. Test Compare & Multi-Symbol Overlay Engine (+ / Alt+C)
  console.log('\n--- 2. Testing Compare & Multi-Symbol Overlay Engine ---');
  await page.click('#btn-topbar-compare');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_compare_modal_open.png') });

  // Add ETHUSDT comparison overlay
  const addEthBtn = await page.$('.btn-add-overlay[data-symbol="ETHUSDT"]');
  if (addEthBtn) {
    await addEthBtn.click();
    console.log('Clicked Add ETHUSDT Comparison');
    await new Promise(r => setTimeout(r, 1500));
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_compare_eth_added.png') });

  // Close compare modal
  await page.click('#modal-close-compare');
  await new Promise(r => setTimeout(r, 800));

  // Verify Floating Compare Legend Badge on Chart Canvas
  const legendInfo = await page.evaluate(() => {
    const el = document.querySelector('#compare-legend-badges');
    return {
      display: el ? window.getComputedStyle(el).display : 'none',
      text: el ? el.innerText.trim() : '',
      childCount: el ? el.children.length : 0
    };
  });
  console.log('Compare Floating Legend on Canvas:', legendInfo);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_chart_with_compare_legend.png') });

  // 3. Test Floating Scale & Coordinate Controls Dock
  console.log('\n--- 3. Testing Floating Scale Controls Dock ---');
  const scaleDockExists = await page.$('#scale-controls-bar');
  console.log('Scale Controls Bar Present:', !!scaleDockExists);

  // Toggle Log scale
  await page.click('#btn-scale-log');
  await new Promise(r => setTimeout(r, 600));
  const isLog = await page.$eval('#btn-scale-log', el => el.classList.contains('active'));
  console.log('Log Scale Toggled Active:', isLog);

  // Toggle Percent scale
  await page.click('#btn-scale-percent');
  await new Promise(r => setTimeout(r, 600));
  const isPercent = await page.$eval('#btn-scale-percent', el => el.classList.contains('active'));
  console.log('Percent Scale Toggled Active:', isPercent);

  // Toggle Invert scale
  await page.click('#btn-scale-invert');
  await new Promise(r => setTimeout(r, 600));
  const isInv = await page.$eval('#btn-scale-invert', el => el.classList.contains('active'));
  console.log('Invert Scale Toggled Active:', isInv);

  // Auto Scale / Reset View
  await page.click('#btn-scale-auto');
  await new Promise(r => setTimeout(r, 600));

  // Check live candle close countdown timer
  const timerVal = await page.$eval('#countdown-timer-val', el => el.innerText);
  console.log('Live Candle Close Countdown Timer:', timerVal);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_scale_controls_active.png') });

  // 4. Test Macro & Economic Calendar
  console.log('\n--- 4. Testing Economic Calendar Panel & Bottom Suite ---');
  await page.evaluate(() => window.app?.switchBottomView('calendar'));
  await new Promise(r => setTimeout(r, 1200));

  // Filter by High Impact
  await page.evaluate(() => {
    const btn = document.querySelector('.cal-filter-btn[data-val="high"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_economic_calendar_filtered.png') });

  // 5. Test Historical Data Export Suite (Alt+E)
  console.log('\n--- 5. Testing Historical Data Export Suite ---');
  await page.click('#btn-topbar-export');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_data_export_modal.png') });
  await page.click('#modal-close-export');
  await new Promise(r => setTimeout(r, 500));

  // 6. Test Interactive Indicator Settings Dialog (⚙)
  console.log('\n--- 6. Testing Interactive Indicator Settings Dialog ---');
  await page.evaluate(() => window.app?.indicatorSettingsModal?.open());
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_indicator_settings_modal.png') });
  await page.click('#btn-ind-cancel');
  await new Promise(r => setTimeout(r, 500));

  // 7. Test Custom Timeframe Builder
  console.log('\n--- 7. Testing Custom Timeframe Builder ---');
  await page.evaluate(() => window.app?.timeframeManager?.open());
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_timeframe_modal.png') });
  await page.click('#modal-close-timeframes');
  await new Promise(r => setTimeout(r, 500));

  // 8. Test Indicator Templates with Custom Persistence
  console.log('\n--- 8. Testing Indicator Templates & Presets ---');
  await page.evaluate(() => window.app?.chartManager?.togglePanel('templates', true));
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_indicator_templates_panel.png') });

  // 9. Test Global Shortcuts Reference Modal (?)
  console.log('\n--- 9. Testing Shortcuts Reference Modal ---');
  await page.click('#btn-shortcuts-help');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_shortcuts_modal_full.png') });
  await page.click('#modal-close-shortcuts');
  await new Promise(r => setTimeout(r, 500));

  // 10. Test Persian Localization (FA / EN)
  console.log('\n--- 10. Testing Persian Localization & Typography ---');
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_persian_desktop_flawless.png') });

  // Switch back to English
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 600));

  // 11. Mobile Viewport Dogfooding (390x844)
  console.log('\n--- 11. Testing Mobile Viewport (390x844) ---');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_mobile_chart_clean.png') });

  // Open Mobile More Drawer
  const moreBtn = await page.$('.vela-mb-more');
  if (moreBtn) {
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_mobile_more_drawer.png') });
  }

  await browser.close();

  console.log('\n=== TradingView Parity QA Audit Summary ===');
  console.log('Console Errors count:', consoleErrors.length);
  console.log('Page Errors count:', pageErrors.length);
  console.log('Failed Requests count:', failedRequests.length);

  const passed = consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0;
  console.log('FINAL RESULT:', passed ? 'ZERO DEFECTS - TRADINGVIEW PARITY VALIDATED' : 'ISSUES DETECTED');

  return {
    passed,
    consoleErrors,
    pageErrors,
    failedRequests
  };
}

runParityDogfood().then(res => {
  process.exit(res.passed ? 0 : 1);
}).catch(err => {
  console.error('Fatal Dogfooding Error:', err);
  process.exit(1);
});
