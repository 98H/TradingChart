// tests/capture-header-verified.js
import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088');
  await new Promise(r => setTimeout(r, 2500));

  await page.screenshot({ path: '/root/TradingChart/screenshots/deep_audit/header_flawless.png' });
  await browser.close();
})();
