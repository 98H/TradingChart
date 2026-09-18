import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const moreBtn = await page.$('.vela-mb-more');
  await moreBtn.click();
  await new Promise(r => setTimeout(r, 1000));

  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.vela-md-row')).map(r => ({
      label: r.querySelector('.vela-md-row-label')?.innerText,
      className: r.className
    }));
  });
  console.log('Rows:', rows);

  // Click the row with Watchlist
  await page.evaluate(() => {
    const r = Array.from(document.querySelectorAll('.vela-md-row')).find(el => el.innerText.includes('Watchlist'));
    if (r) r.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  const check = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('.vela-panel')).map(p => ({
      class: p.className,
      hidden: p.hidden,
      display: window.getComputedStyle(p).display,
      width: window.getComputedStyle(p).width,
      rect: p.getBoundingClientRect()
    }));
    return panels.filter(p => !p.hidden);
  });
  console.log('Visible Panels after click:', check);
  await browser.close();
})();
