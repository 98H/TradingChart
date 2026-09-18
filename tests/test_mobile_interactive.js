import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const DIR = '/root/TradingChart/screenshots/mobile_interactive';
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

  // 1. Initial mobile screen
  await page.screenshot({ path: path.join(DIR, '01_mobile_initial.png') });

  // 2. Open More Drawer
  const moreBtn = await page.$('.vela-mb-more');
  if (moreBtn) {
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(DIR, '02_drawer_opened.png') });

    // Click on Watchlist inside the drawer
    const clicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.vela-drawer-body button, .vela-drawer-body [role="button"], .vela-drawer-body div'));
      const wl = items.find(el => el.innerText.includes('Watchlist'));
      if (wl) {
        wl.click();
        return true;
      }
      return false;
    });
    console.log('Clicked Watchlist inside drawer:', clicked);
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(DIR, '03_watchlist_panel_mobile.png') });

    // Check if Watchlist panel is visible and what it looks like
    const panelState = await page.evaluate(() => {
      const p = document.querySelector('.vela-panel-watchlist');
      if (!p) return 'not-found';
      const rect = p.getBoundingClientRect();
      return {
        open: !p.hidden && p.offsetParent !== null,
        rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
        hasCloseBtn: !!p.querySelector('.vela-panel-close')
      };
    });
    console.log('Watchlist panel state:', panelState);

    // If close button exists, click it to return to chart
    const closeBtn = await page.$('.vela-panel-watchlist .vela-panel-close');
    if (closeBtn) {
      console.log('Clicking close button on Watchlist panel...');
      await closeBtn.click();
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(DIR, '04_after_closing_panel.png') });
    }
  }

  await browser.close();
  console.log('Test finished.');
})();
