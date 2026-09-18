// tests/test-add-pine.js
import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  await page.goto('http://127.0.0.1:8088');
  await new Promise(r => setTimeout(r, 2000));

  // Click Add to Chart
  await page.click('#btn-pine-compile');
  await new Promise(r => setTimeout(r, 2500));

  const diagText = await page.$eval('#pine-diag-content', el => el.innerText);
  console.log('Diag Text:\n', diagText);

  const activeIndicators = await page.evaluate(() => {
    const chart = window.app.chartManager.workspace.active.chart;
    return {
      handles: Array.from(chart.orchestrator.handles.keys()),
      indicators: Object.keys(chart.indicators || {})
    };
  });
  console.log('Active Indicators in Vela:', activeIndicators);

  await page.screenshot({ path: '/root/TradingChart/screenshots/pine_added_check.png' });
  await browser.close();
})();
