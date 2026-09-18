// tests/qa_capture.cjs
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist'
    ]
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('Browser error:', msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  // --- 1. Mobile Portrait (390x844) ---
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 4500));

  await page.screenshot({ path: '/root/qa_mobile_luxalgo_main_v3.png' });
  console.log('Mobile main screenshot taken: /root/qa_mobile_luxalgo_main_v3.png');

  // --- 2. Test clicking MoreDrawer on mobile ---
  const moreBtn = await page.$('.vela-mb-more');
  if (moreBtn) {
    console.log('Clicking More button...');
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: '/root/qa_mobile_luxalgo_drawer_v3.png' });
    console.log('Mobile drawer screenshot taken: /root/qa_mobile_luxalgo_drawer_v3.png');

    // Close drawer by clicking on backdrop
    await page.mouse.click(100, 100);
    await new Promise(r => setTimeout(r, 800));
  }

  // --- 3. Test Full-Page Trade Journal Workspace on mobile ---
  console.log('Clicking Journal tab...');
  await page.click('#nav-btn-journal');
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: '/root/qa_mobile_journal_v3.png' });
  console.log('Journal view screenshot taken: /root/qa_mobile_journal_v3.png');

  // Switch back to Quant
  await page.click('#nav-btn-quant');
  await new Promise(r => setTimeout(r, 1000));

  // --- 4. Desktop View (1440x900) ---
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 1440, height: 900 });
  await desktopPage.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 4500));
  await desktopPage.screenshot({ path: '/root/qa_desktop_luxalgo_v3.png' });
  console.log('Desktop screenshot taken: /root/qa_desktop_luxalgo_v3.png');

  console.log('Errors logged:', errors);
  await browser.close();
})();
