import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const DIR = '/root/TradingChart/screenshots/mobile_features';
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

  // 1. Initial screen
  await page.screenshot({ path: path.join(DIR, '01_mobile_initial.png') });

  // 2. Click Indicators icon on mobile bar (.vela-mb-indicators or 3rd child)
  console.log('Testing mobile bottom bar buttons...');
  const mbButtons = await page.$$('.vela-mobilebar button');
  console.log('Mobilebar buttons count:', mbButtons.length);

  // Take screenshot of each button interaction on mobilebar
  // Button 0: symbol / ticker
  // Button 1: timeframe
  // Button 2: indicators
  // Button 3: drawings (pencil)
  // Button 4: more (three dots)
  // Button 5: settings (gear)

  if (mbButtons.length >= 6) {
    // Test Symbol click on mobile bar
    console.log('Clicking mobilebar button 0 (Symbol)...');
    await mbButtons[0].click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(DIR, '02_mobile_symbol_click.png') });
    // Close if open
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));

    // Test Timeframe click on mobile bar
    console.log('Clicking mobilebar button 1 (Timeframe)...');
    await mbButtons[1].click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(DIR, '03_mobile_timeframe_click.png') });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));

    // Test Indicators click on mobile bar
    console.log('Clicking mobilebar button 2 (Indicators)...');
    await mbButtons[2].click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(DIR, '04_mobile_indicators_click.png') });
    // Close indicators modal if opened
    const closeInd = await page.$('#modal-close-ind');
    if (closeInd) await closeInd.click();
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));

    // Test Drawings click on mobile bar (pencil)
    console.log('Clicking mobilebar button 3 (Drawings pencil)...');
    await mbButtons[3].click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(DIR, '05_mobile_drawings_click.png') });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));

    // Test Settings click on mobile bar (gear)
    console.log('Clicking mobilebar button 5 (Settings gear)...');
    await mbButtons[5].click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(DIR, '06_mobile_settings_click.png') });
    const closeSet = await page.$('#modal-close-settings');
    if (closeSet) await closeSet.click();
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));
  }

  // 3. Test Mobile Drawer and Panels
  console.log('Testing More drawer and panels...');
  const moreBtn = await page.$('.vela-mb-more');
  if (moreBtn) {
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(DIR, '07_mobile_more_drawer.png') });

    // Click Watchlist
    await page.evaluate(() => {
      const r = Array.from(document.querySelectorAll('.vela-md-row')).find(el => el.innerText.includes('Watchlist'));
      if (r) r.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(DIR, '08_mobile_watchlist_panel.png') });

    // Re-open More Drawer and Click Trade
    const moreBtn2 = await page.$('.vela-mb-more');
    if (moreBtn2) {
      await moreBtn2.click();
      await new Promise(r => setTimeout(r, 1000));
      await page.evaluate(() => {
        const r = Array.from(document.querySelectorAll('.vela-md-row')).find(el => el.innerText.includes('Trade') && !el.innerText.includes('Journal'));
        if (r) r.click();
      });
      await new Promise(r => setTimeout(r, 1200));
      await page.screenshot({ path: path.join(DIR, '09_mobile_trade_panel.png') });
    }

    // Re-open More Drawer and Click Alerts
    const moreBtn3 = await page.$('.vela-mb-more');
    if (moreBtn3) {
      await moreBtn3.click();
      await new Promise(r => setTimeout(r, 1000));
      await page.evaluate(() => {
        const r = Array.from(document.querySelectorAll('.vela-md-row')).find(el => el.innerText.includes('Alerts'));
        if (r) r.click();
      });
      await new Promise(r => setTimeout(r, 1200));
      await page.screenshot({ path: path.join(DIR, '10_mobile_alerts_panel.png') });
    }
  }

  await browser.close();
  console.log('Mobile audit complete.');
})();
