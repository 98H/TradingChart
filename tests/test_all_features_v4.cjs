// tests/test_all_features_v4.cjs
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/root/TradingChart/screenshots/qa_v4';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function runAllFeaturesTest() {
  console.log('=== Starting Exhaustive Button & Layout Manager Test Suite v4 ===');

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

  // 1. Initial Desktop View (1440x900)
  console.log('\n1. Navigating to http://127.0.0.1:8088...');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, '01_desktop_with_layout_suite.png') });

  // 2. Test Layout Manager Button & Studio Modal
  console.log('\n2. Testing Layout Manager Button & Studio Modal...');
  await page.click('#btn-layout-manager');
  await new Promise(r => setTimeout(r, 500));
  const isLayoutModalOpen = await page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));
  console.log('Layout Studio Modal opened:', isLayoutModalOpen);
  await page.screenshot({ path: path.join(OUT_DIR, '02_layout_studio_modal.png') });

  // 3. Test Selecting 2x2 Quad Grid Layout
  console.log('\n3. Testing Selecting 2x2 Quad Grid Layout in Layout Studio...');
  await page.evaluate(() => {
    const quadBtn = document.querySelector('.layout-preset-card[data-layout="4"]');
    if (quadBtn) quadBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  const activeLayoutAfter = await page.evaluate(() => window.app?.layoutManager?.activeLayoutId);
  const layoutLabelAfter = await page.$eval('#active-layout-name', el => el.innerText.trim());
  console.log('Active Layout ID after selection:', activeLayoutAfter);
  console.log('Active Layout Label in Topbar:', layoutLabelAfter);
  await page.screenshot({ path: path.join(OUT_DIR, '03_chart_quad_grid_active.png') });

  // 4. Test Quick Save Layout Button
  console.log('\n4. Testing Quick Save Layout Button...');
  await page.click('#btn-layout-save');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, '04_layout_saved_toast.png') });

  // 5. Test Bar Replay Engine Toggle
  console.log('\n5. Testing Bar Replay Engine Toggle from Topbar...');
  await page.click('#btn-topbar-replay');
  await new Promise(r => setTimeout(r, 600));
  const isReplayBarVisible = await page.evaluate(() => document.querySelector('#replay-bar')?.classList.contains('visible'));
  console.log('Replay Bar Visible:', isReplayBarVisible);
  await page.screenshot({ path: path.join(OUT_DIR, '05_replay_bar_active.png') });

  // Step replay
  await page.click('#btn-replay-step');
  await new Promise(r => setTimeout(r, 300));
  await page.click('#btn-replay-exit');
  await new Promise(r => setTimeout(r, 400));

  // 6. Test User Profile Avatar Click
  console.log('\n6. Testing User Profile Avatar Modal...');
  await page.click('.user-avatar-badge');
  await new Promise(r => setTimeout(r, 500));
  const isProfileModalOpen = await page.evaluate(() => document.querySelector('#modal-user-profile')?.classList.contains('open'));
  console.log('User Profile Modal opened:', isProfileModalOpen);
  await page.screenshot({ path: path.join(OUT_DIR, '06_user_profile_modal.png') });
  await page.click('#btn-close-user-profile');
  await new Promise(r => setTimeout(r, 400));

  // 7. Test Screenshot Modal
  console.log('\n7. Testing Screenshot Camera Click & Modal...');
  await page.evaluate(() => {
    document.querySelector('.vela-widget-screenshot, [aria-label*="screenshot"], [aria-label*="Screenshot"]')?.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const isScreenshotModalOpen = await page.evaluate(() => document.querySelector('#modal-screenshot-preview')?.classList.contains('open'));
  console.log('Screenshot Modal opened:', isScreenshotModalOpen);
  await page.screenshot({ path: path.join(OUT_DIR, '07_screenshot_modal_open.png') });
  await page.click('#btn-close-screenshot');
  await new Promise(r => setTimeout(r, 400));

  // 8. Test Trade Journal "+ Log Trade" Modal
  console.log('\n8. Testing Trade Journal "+ Log Trade" Modal...');
  await page.evaluate(() => window.app.switchWorkspace('journal'));
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    document.querySelector('#btn-journal-add')?.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const isLogTradeModalOpen = await page.evaluate(() => document.querySelector('#modal-log-trade')?.classList.contains('open'));
  console.log('Log Trade Modal opened:', isLogTradeModalOpen);
  await page.screenshot({ path: path.join(OUT_DIR, '08_log_trade_modal.png') });

  // Save new trade
  await page.click('#btn-save-log-trade');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, '09_trade_logged_calendar_updated.png') });

  // Switch back to Quant
  await page.evaluate(() => window.app.switchWorkspace('quant'));
  await new Promise(r => setTimeout(r, 600));

  // 9. Restore to Single Chart
  console.log('\n9. Restoring to Single Chart Layout...');
  await page.evaluate(() => window.app.layoutManager.setLayout('1', '1x1 Single Chart'));
  await new Promise(r => setTimeout(r, 800));

  // 10. Test Persian Mode Full Desktop Experience
  console.log('\n10. Testing Persian Mode Full Desktop Experience...');
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '10_persian_desktop_flawless.png') });

  // Open Layout Studio in Persian mode
  await page.click('#btn-layout-manager');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, '11_persian_layout_studio.png') });
  await page.click('#btn-close-layout-studio');
  await new Promise(r => setTimeout(r, 400));

  // Open User Profile in Persian mode
  await page.click('.user-avatar-badge');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, '12_persian_user_profile.png') });
  await page.click('#btn-close-user-profile');
  await new Promise(r => setTimeout(r, 400));

  // 11. Mobile Viewport (390x844) Audit
  console.log('\n11. Testing Mobile Viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, '13_mobile_initial.png') });

  // Test Mobile More Drawer
  await page.evaluate(() => document.querySelector('.vela-mb-more')?.click());
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '14_mobile_more_drawer.png') });

  await page.evaluate(() => window.app.chartManager.workspace.moreDrawer?.close());
  await new Promise(r => setTimeout(r, 400));

  // Test Mobile Persian More Drawer
  await page.evaluate(() => window.app.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => document.querySelector('.vela-mb-more')?.click());
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '15_mobile_persian_more_drawer_flawless.png') });

  await browser.close();

  console.log('\n=== Exhaustive Button & Layout Manager Test Suite v4 Completed ===');
  console.log(`Console Errors: ${consoleErrors.length}`);
  console.log(`Page Errors: ${pageErrors.length}`);
}

runAllFeaturesTest().catch(err => {
  console.error('Test Suite v4 Error:', err);
  process.exit(1);
});
