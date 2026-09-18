// tests/test-legend.js
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

  // Click Add to Chart
  await page.click('#btn-pine-compile');
  await new Promise(r => setTimeout(r, 2000));

  const legendDetails = await page.evaluate(() => {
    const legendNodes = Array.from(document.querySelectorAll('*')).filter(el => {
      const c = (el.className && typeof el.className === 'string') ? el.className : '';
      return c.includes('legend') || c.includes('statusline') || c.includes('track');
    });
    return legendNodes.map(el => ({
      tag: el.tagName,
      className: el.className,
      text: el.innerText,
      innerHTML: el.innerHTML.slice(0, 200)
    }));
  });

  console.log('Legend Elements:', JSON.stringify(legendDetails, null, 2));
  await browser.close();
})();
