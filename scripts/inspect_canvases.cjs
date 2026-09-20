// scripts/inspect_canvases.js
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8088');
  await new Promise(r => setTimeout(r, 2000));

  const canvases = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('canvas')).map(c => ({
      width: c.width,
      height: c.height,
      className: c.className,
      id: c.id,
      parent: c.parentElement?.className,
      dataUrlLength: c.toDataURL().length
    }));
  });
  console.log('Canvases:', canvases);

  // Let's check chart area element
  const chartEl = await page.$('#chart-area');
  if (chartEl) {
    const shot = await chartEl.screenshot({ encoding: 'base64' });
    console.log('Element screenshot length:', shot.length);
  }

  await page.close();
  await browser.disconnect();
})();
