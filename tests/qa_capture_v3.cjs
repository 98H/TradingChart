// tests/qa_capture_v3.cjs
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/root/TradingChart/screenshots/qa_v3';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function runQACycle() {
  console.log('=== Starting QA Dogfooding Cycle v3 ===');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    protocolTimeout: 120000,
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

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[Browser Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.error('[Page Error]', err.message);
  });

  // ----------------------------------------------------
  // SECTION 1: Desktop Viewport (1440x900)
  // ----------------------------------------------------
  console.log('\n--- 1. Desktop Initial View (1440x900) ---');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  // Check positions of statusline and quick-trade
  const desktopCoords = await page.evaluate(() => {
    const sl = document.querySelector('.vela-statusline')?.getBoundingClientRect();
    const qt = document.querySelector('#chart-quick-trade')?.getBoundingClientRect();
    const topbar = document.querySelector('.vela-widget-topbar')?.getBoundingClientRect();
    return {
      statusline: sl ? { top: sl.top, left: sl.left, right: sl.right, bottom: sl.bottom } : null,
      quickTrade: qt ? { top: qt.top, left: qt.left, right: qt.right, bottom: qt.bottom } : null,
      topbar: topbar ? { top: topbar.top, bottom: topbar.bottom } : null,
      hasOverlap: sl && qt ? !(qt.left > sl.right || qt.right < sl.left || qt.top > sl.bottom || qt.bottom < sl.top) : false
    };
  });
  console.log('Desktop Coords & Overlap Check:', JSON.stringify(desktopCoords, null, 2));

  await page.screenshot({ path: path.join(OUT_DIR, '01_desktop_clean_layout.png') });

  // 2. Test Stepper & Quick Trade
  console.log('\n--- 2. Testing Stepper & Quick Trade ---');
  await page.click('#qt-qty-inc');
  await page.click('#qt-qty-inc');
  const qtyAfterInc = await page.$eval('#quick-trade-qty', el => el.value);
  console.log('Quantity after 2 increments:', qtyAfterInc);

  await page.click('#qt-toggle-btn');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT_DIR, '02_desktop_qt_minimized.png') });

  await page.click('#qt-collapsed-trigger');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT_DIR, '03_desktop_qt_restored.png') });

  // 3. Test Time Range Bar Active Highlighting
  console.log('\n--- 3. Testing Time Range Bar Active Highlighting ---');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.vela-bb-range')).find(b => b.innerText.trim() === '7D');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, '04_desktop_timerange_7d_active.png') });

  // 4. Test Bottom Panel Tabs & Expansion
  console.log('\n--- 4. Testing Bottom Panel Expansion & Tabs ---');
  await page.click('.panel-tab[data-view="pine"]');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, '05_desktop_bottom_pine_expanded.png') });

  await page.click('#btn-toggle-bottom-panel');
  await new Promise(r => setTimeout(r, 400));

  // 5. Test Desktop Persian Mode
  console.log('\n--- 5. Testing Desktop Persian Mode ---');
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '06_desktop_persian_mode.png') });

  // Switch back to EN for clean slate
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 400));

  // ----------------------------------------------------
  // SECTION 2: Mobile Viewport (390x844 iPhone 14)
  // ----------------------------------------------------
  console.log('\n--- 6. Mobile Portrait Initial View (390x844) ---');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const mobileInitState = await page.evaluate(() => {
    const qt = document.querySelector('#chart-quick-trade');
    const pill = document.querySelector('#qt-collapsed-trigger');
    const mb = document.querySelector('.vela-mobilebar');
    return {
      qtMinimized: qt?.classList.contains('minimized'),
      pillVisible: pill && window.getComputedStyle(pill).display !== 'none',
      mobileBarVisible: mb && window.getComputedStyle(mb).display !== 'none'
    };
  });
  console.log('Mobile Initial State:', JSON.stringify(mobileInitState, null, 2));

  await page.screenshot({ path: path.join(OUT_DIR, '07_mobile_clean_initial.png') });

  // 7. Open Quick Trade on Mobile
  console.log('\n--- 7. Testing Mobile Quick Trade Modal ---');
  await page.click('#qt-collapsed-trigger');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT_DIR, '08_mobile_quick_trade_open.png') });

  await page.click('#qt-toggle-btn');
  await new Promise(r => setTimeout(r, 400));

  // 8. Test Mobile More Drawer
  console.log('\n--- 8. Testing Mobile More Drawer ---');
  await page.evaluate(() => {
    document.querySelector('.vela-mb-more')?.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '09_mobile_more_drawer_all_panels.png') });

  const drawerRows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.vela-md-row')).map(r => r.innerText.trim());
  });
  console.log('Drawer Rows Count:', drawerRows.length);
  console.log('Drawer Rows List:', drawerRows);

  // Close drawer
  await page.evaluate(() => {
    const d = document.querySelector('.vela-drawer');
    const closeBtn = document.querySelector('.vela-drawer-close-custom');
    if (closeBtn) closeBtn.click();
    else if (d) d.style.display = 'none';
  });
  await new Promise(r => setTimeout(r, 400));

  // 9. Test Mobile Alerts Sheet
  console.log('\n--- 9. Testing Mobile Alerts Sheet ---');
  await page.evaluate(() => window.app.chartManager.togglePanel('alerts', true));
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '10_mobile_alerts_sheet_with_chips.png') });

  // Test toggling alert active/paused
  await page.click('.toggle-alert-btn');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT_DIR, '11_mobile_alert_toggled_pause.png') });

  await page.evaluate(() => window.app.chartManager.togglePanel('alerts', false));
  await new Promise(r => setTimeout(r, 400));

  // 10. Test Mobile Trade Journal View
  console.log('\n--- 10. Testing Mobile Trade Journal View ---');
  await page.evaluate(() => {
    window.app.switchWorkspace('journal');
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '12_mobile_trade_journal.png') });

  // 11. Test Mobile Persian Mode across Journal and More Drawer
  console.log('\n--- 11. Testing Mobile Persian Mode ---');
  await page.evaluate(() => window.app.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '13_mobile_persian_journal.png') });

  // Switch back to Quant chart view in Persian mode
  await page.evaluate(() => window.app.switchWorkspace('quant'));
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, '14_mobile_persian_chart.png') });

  // Open More Drawer in Persian mode
  await page.evaluate(() => {
    document.querySelector('.vela-mb-more')?.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '15_mobile_persian_more_drawer.png') });

  const persianDrawerRows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.vela-md-row')).map(r => r.innerText.trim());
  });
  console.log('Persian Drawer Rows:', persianDrawerRows);

  await browser.close();

  console.log('\n=== QA Dogfooding Cycle v3 Complete ===');
  console.log(`Console Errors: ${consoleErrors.length}`);
  console.log(`Page Errors: ${pageErrors.length}`);
}

runQACycle().catch(err => {
  console.error('QA Cycle Error:', err);
  process.exit(1);
});
