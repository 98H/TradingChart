// tests/test-statusline-dom.js
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

  const items = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('.vela-cell *'));
    return all.map(el => ({
      tag: el.tagName,
      className: el.className,
      text: el.innerText
    })).filter(x => x.text && x.text.includes('Nexus SMC Pro'));
  });

  console.log('Statusline nodes with Nexus SMC Pro:', JSON.stringify(items, null, 2));
  await browser.close();
})();
