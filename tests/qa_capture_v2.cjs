// tests/qa_capture_v2.cjs
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/root/TradingChart/screenshots/qa_v2';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function runQACapture() {
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

  // 1. Desktop Initial View (1440x900)
  console.log('1. Desktop initial load...');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT_DIR, '01_desktop_flawless.png') });

  // 2. Test Quick Trade 1-click execution
  console.log('2. Quick Trade test...');
  await page.click('#quick-trade-buy-btn');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '02_quick_trade_executed.png') });

  // 3. Test Symbol Search with keyboard navigation
  console.log('3. Symbol Search with keyboard nav...');
  await page.evaluate(() => window.app.openSymbolSearch());
  await new Promise(r => setTimeout(r, 600));
  await page.keyboard.press('ArrowDown');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('ArrowDown');
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(OUT_DIR, '03_symbol_search_keyboard.png') });
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));

  // 4. Test Bottom Panel toggle
  console.log('4. Bottom Panel toggle...');
  await page.click('.panel-tab[data-view="pine"]');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '04_bottom_panel_expanded.png') });

  // 5. Test Persian Mode Desktop
  console.log('5. Persian Mode Desktop...');
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT_DIR, '05_persian_mode_desktop.png') });
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 500));

  // 6. Mobile Portrait View (390x844)
  console.log('6. Mobile Initial View (390x844)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(OUT_DIR, '06_mobile_chart_with_xaxis.png') });

  // 7. Mobile MoreDrawer
  console.log('7. Mobile MoreDrawer...');
  const moreBtn = await page.$('.vela-mb-more');
  if (moreBtn) {
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUT_DIR, '07_mobile_moredrawer.png') });
  }

  // 8. Open Alerts in Mobile Sheet
  console.log('8. Mobile Alerts Sheet...');
  await page.evaluate(() => {
    window.app.chartManager.togglePanel('alerts', true);
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, '08_mobile_alerts_sheet.png') });

  // 9. Open Paper Trading in Mobile Sheet
  console.log('9. Mobile Paper Trading Sheet...');
  await page.evaluate(() => {
    window.app.chartManager.togglePanel('paper', true);
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, '09_mobile_paper_trading_sheet.png') });

  // 10. Mobile Persian Mode
  console.log('10. Mobile Persian Mode...');
  await page.evaluate(() => {
    window.app.chartManager.togglePanel('paper', false);
    window.app.switchLanguage('fa');
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, '10_mobile_persian_flawless.png') });

  await browser.close();
  console.log('ALL QA CAPTURES COMPLETED SUCCESSFULLY!');
}

runQACapture().catch(err => {
  console.error('QA Capture failed:', err);
  process.exit(1);
});
