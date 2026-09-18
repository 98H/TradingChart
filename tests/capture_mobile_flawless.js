import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const DIR = '/root/TradingChart/screenshots/mobile_flawless';
fs.mkdirSync(DIR, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // 1. Mobile Initial Screen (Clean top header, no overflow)
  await page.screenshot({ path: path.join(DIR, '01_mobile_initial_clean.png') });

  // 2. Open Timeframe drawer on mobile
  const mbButtons = await page.$$('.vela-mobilebar button');
  if (mbButtons.length >= 2) {
    await mbButtons[1].click(); // Timeframe
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(DIR, '02_mobile_timeframe_drawer.png') });

    // Close timeframe drawer by tapping backdrop or selecting 15m
    const tf15 = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.vela-drawer button, .vela-drawer div'));
      const found = btns.find(b => b.innerText.trim() === '15m');
      if (found) { found.click(); return true; }
      return false;
    });
    console.log('Selected 15m in timeframe drawer:', tf15);
    await new Promise(r => setTimeout(r, 1200));
  }

  // 3. Open More Drawer
  const moreBtn = await page.$('.vela-mb-more');
  if (moreBtn) {
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(DIR, '03_mobile_more_drawer_elevated.png') });

    // Open Watchlist
    await page.evaluate(() => {
      const r = Array.from(document.querySelectorAll('.vela-md-row')).find(el => el.innerText.includes('Watchlist'));
      if (r) r.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(DIR, '04_mobile_watchlist_panel.png') });

    // Close Watchlist panel
    const closeBtn = await page.$('.vela-panel-watchlist .vela-panel-close');
    if (closeBtn) {
      await closeBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }
  }

  // 4. Open Trade Panel with Level 2 DOM on Mobile
  const moreBtn2 = await page.$('.vela-mb-more');
  if (moreBtn2) {
    await moreBtn2.click();
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const r = Array.from(document.querySelectorAll('.vela-md-row')).find(el => el.innerText.includes('Trade') && !el.innerText.includes('Journal'));
      if (r) r.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Switch to DOM view inside Paper Trading
    const btnDom = await page.$('#btn-subtab-dom');
    if (btnDom) {
      await btnDom.click();
      await new Promise(r => setTimeout(r, 600));
    }
    await page.screenshot({ path: path.join(DIR, '05_mobile_trade_dom_panel.png') });

    // Close Trade panel
    const closeBtn2 = await page.$('.vela-panel-paper .vela-panel-close');
    if (closeBtn2) {
      await closeBtn2.click();
      await new Promise(r => setTimeout(r, 800));
    }
  }

  // 5. Test Persian Mode on Mobile
  await page.click('#btn-toggle-lang');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(DIR, '06_mobile_persian_mode.png') });

  await browser.close();
  console.log('Mobile flawless capture finished.');
})();
