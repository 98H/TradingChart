// tests/test-set-bar-series.js
import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:8088');
  await new Promise(r => setTimeout(r, 2500));

  const res = await page.evaluate(() => {
    const chart = window.app.chartManager.workspace?.active?.chart;
    const orch = chart?.orchestrator;
    const fnStr = orch?.setBarSeries?.toString();
    const applyBarStr = orch?.applyBar?.toString();
    return {
      setBarSeries: fnStr ? fnStr.slice(0, 300) : null,
      applyBar: applyBarStr ? applyBarStr.slice(0, 300) : null
    };
  });

  console.log('Orch methods code:', JSON.stringify(res, null, 2));
  await browser.close();
})();
