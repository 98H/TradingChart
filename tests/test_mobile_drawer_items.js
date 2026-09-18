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
  if (moreBtn) {
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    const items = await page.evaluate(() => {
      const drawer = document.querySelector('.vela-drawer');
      if (!drawer) return 'no-drawer';
      const btns = Array.from(drawer.querySelectorAll('.vela-drawer-body button, .vela-drawer-body [role="button"], .vela-drawer-body > div'));
      return btns.map(b => b.innerText.replace(/\n/g, ' '));
    });
    console.log('Drawer items found:', items);
  } else {
    console.log('No .vela-mb-more found');
  }
  await browser.close();
})();
