// tests/test-header-rects.js
import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:8088');
  await new Promise(r => setTimeout(r, 2000));

  const rects = await page.evaluate(() => {
    const getR = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
    };

    return {
      windowWidth: window.innerWidth,
      header: getR('#top-header'),
      left: getR('.header-left'),
      center: getR('.header-center'),
      right: getR('.header-right'),
      langBtn: getR('#btn-toggle-lang'),
      settingsBtn: getR('#btn-open-settings'),
      sidebarBtn: getR('#btn-toggle-sidebar')
    };
  });

  console.log('Header rects:', JSON.stringify(rects, null, 2));
  await browser.close();
})();
