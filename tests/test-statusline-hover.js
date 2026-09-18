// tests/test-statusline-hover.js
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

  await page.click('#btn-pine-compile');
  await new Promise(r => setTimeout(r, 2000));

  const hovered = await page.evaluate(async () => {
    const el = Array.from(document.querySelectorAll('span, div')).find(e => e.innerText === 'Nexus SMC Pro');
    if (!el) return { found: false };
    const rect = el.getBoundingClientRect();
    const parentHTML = el.parentElement?.outerHTML;
    return { found: true, rect, parentHTML };
  });

  console.log('Hovered parent:', hovered);
  await browser.close();
})();
