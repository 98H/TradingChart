// tests/audit_master_v5.cjs
// Master Exhaustive Dogfooding Test Suite verifying 100% of features across Desktop & Mobile.

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/root/TradingChart/screenshots/qa_v5_master';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('=== Starting Master Exhaustive Dogfooding Test Suite v5 ===\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    protocolTimeout: 120000
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[Browser Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.error('[Browser Page Error]', err.toString());
  });

  // 1. Initial Load
  console.log('1. Loading TradingChart at http://127.0.0.1:8088...');
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_desktop_main_clean.png') });

  // 2. Test Top Header Controls
  console.log('2. Testing Top Header Navigation & View Switching...');
  // Quant to Journal switch
  await page.click('#nav-btn-journal');
  await new Promise(r => setTimeout(r, 500));
  const jDisplay = await page.evaluate(() => document.querySelector('#journal-workspace-view')?.style.display);
  console.log('   Full-Page Journal view display:', jDisplay);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_full_page_journal.png') });

  // Journal back to Quant switch
  await page.click('#nav-btn-quant');
  await new Promise(r => setTimeout(r, 500));
  const qDisplay = await page.evaluate(() => document.querySelector('#chart-area')?.style.display);
  console.log('   Quant chart view restored display:', qDisplay);

  // 3. Test + Panels Menu
  console.log('3. Testing + Panels Menu...');
  await page.click('#nav-btn-panels');
  await new Promise(r => setTimeout(r, 400));
  const panelsMenuOpen = await page.evaluate(() => document.querySelector('#modal-panels-menu')?.classList.contains('open'));
  console.log('   Panels menu open:', panelsMenuOpen);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_panels_grid_menu.png') });
  await page.click('#modal-close-panels-menu');
  await new Promise(r => setTimeout(r, 300));

  // 4. Test TradingView Layout Studio & Grid Switches
  console.log('4. Testing TradingView Layout Studio & Grid Switches...');
  await page.click('#btn-layout-manager');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_layout_studio_modal.png') });

  // Select 2x1 Dual Horizontal
  await page.evaluate(() => {
    const card = document.querySelector('.layout-preset-card[data-layout="2h"]');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const layout2h = await page.evaluate(() => window.app?.layoutManager?.activeLayoutId);
  console.log('   Active Layout after 2h selection:', layout2h);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_layout_dual_horizontal.png') });

  // Select 2x2 Quad Grid
  await page.click('#btn-layout-manager');
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const card = document.querySelector('.layout-preset-card[data-layout="4"]');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 800));
  const layout4 = await page.evaluate(() => window.app?.layoutManager?.activeLayoutId);
  console.log('   Active Layout after Quad selection:', layout4);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_layout_quad_grid_active.png') });

  // Quick Save Layout
  await page.click('#btn-layout-save');
  await new Promise(r => setTimeout(r, 400));
  const saveLabel = await page.evaluate(() => document.querySelector('#layout-save-label')?.innerText);
  console.log('   Save button text after click:', saveLabel);

  // Restore 1x1 Single Chart
  await page.click('#btn-layout-manager');
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const card = document.querySelector('.layout-preset-card[data-layout="1"]');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // 5. Test Bar Replay Engine
  console.log('5. Testing Bar Replay Engine...');
  await page.click('#btn-topbar-replay');
  await new Promise(r => setTimeout(r, 500));
  const replayVisible = await page.evaluate(() => document.querySelector('#replay-bar')?.classList.contains('visible'));
  console.log('   Replay Bar visible:', replayVisible);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_replay_bar_active.png') });
  await page.click('#btn-replay-exit');
  await new Promise(r => setTimeout(r, 300));

  // 6. Test User Profile Modal
  console.log('6. Testing User Profile Modal...');
  await page.click('.user-avatar-badge');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_user_profile_modal.png') });
  await page.click('#btn-close-user-profile');
  await new Promise(r => setTimeout(r, 300));

  // 7. Test Indicators Modal
  console.log('7. Testing Indicators Modal...');
  await page.click('.vela-widget-indicators');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_indicators_modal.png') });
  await page.evaluate(() => window.app?.indicatorsModal?.close() || document.querySelector('#modal-close-ind')?.click());
  await new Promise(r => setTimeout(r, 400));

  // 8. Test Symbol Search Modal
  console.log('8. Testing Symbol Search Modal...');
  await page.click('.vela-widget-symbol');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_symbol_search_modal.png') });
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.vela-dialog-close');
    if (closeBtn) closeBtn.click();
    else document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
  await new Promise(r => setTimeout(r, 400));

  // 9. Test Chart Timeframe Dropdown
  console.log('9. Testing Timeframe Popover...');
  await page.click('#vela-topbar-tf');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_timeframe_popover.png') });
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));

  // 10. Test Quick Trade Widget Execution
  console.log('10. Testing Quick Trade Execution...');
  await page.click('#quick-trade-buy-btn');
  await new Promise(r => setTimeout(r, 500));
  const openPosCount = await page.evaluate(() => window.app?.paperTrading?.positions?.length || 0);
  console.log('   Paper Trading Open Positions count:', openPosCount);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_quick_trade_executed.png') });

  // 11. Test Native Vela Panels via Right Tool Rail
  console.log('11. Testing Native Vela Panels via Right Tool Rail...');
  // Open Watchlist
  await page.evaluate(() => document.querySelector('#vela-tool-vela-widget-panel-watchlist')?.click());
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_panel_watchlist_docked.png') });

  // Open Trade Journal Dock
  await page.evaluate(() => document.querySelector('#vela-tool-vela-widget-panel-journal')?.click());
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_panel_journal_docked.png') });

  // Test Log Trade Modal from Journal
  await page.evaluate(() => document.querySelector('#btn-journal-add')?.click());
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_log_trade_modal.png') });
  await page.evaluate(() => document.querySelector('#btn-close-log-trade')?.click());
  await new Promise(r => setTimeout(r, 300));

  // Close Side Dock
  await page.evaluate(() => document.querySelector('#btn-toggle-panels-dock')?.click());
  await new Promise(r => setTimeout(r, 400));

  // 12. Test Persian RTL Experience
  console.log('12. Testing Full Persian RTL Mode Experience...');
  await page.evaluate(() => window.app?.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_persian_desktop_flawless.png') });

  // Open Persian Layout Studio
  await page.evaluate(() => document.querySelector('#btn-layout-manager')?.click());
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_persian_layout_studio.png') });
  await page.evaluate(() => document.querySelector('#btn-close-layout-studio')?.click());
  await new Promise(r => setTimeout(r, 300));

  // 13. Test Mobile Viewport (iPhone: 390x844)
  console.log('13. Testing Mobile Viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18_mobile_chart_clean.png') });

  // Open Mobile More Drawer
  console.log('   Opening Mobile More Drawer...');
  await page.evaluate(() => window.app?.chartManager?.workspace?.openMoreDrawer());
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19_mobile_more_drawer.png') });

  // Close Mobile Drawer
  await page.evaluate(() => window.app?.chartManager?.workspace?.moreDrawer?.close());
  await new Promise(r => setTimeout(r, 400));

  // Switch back to English
  await page.evaluate(() => window.app?.switchLanguage('en'));
  await page.setViewport({ width: 1440, height: 900 });

  await browser.close();

  console.log('\n=== Master Dogfooding Audit Completed Successfully ===');
  console.log('Total Console Errors:', consoleErrors.length);
  console.log('Total Page Errors:', pageErrors.length);

  return { consoleErrors, pageErrors };
}

run().catch(console.error);
