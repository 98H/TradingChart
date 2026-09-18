// tests/test-update-candles.js
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

  const res = await page.evaluate(() => {
    const chart = window.app.chartManager.workspace?.active?.chart;
    const dataMethods = chart?.data ? Object.getOwnPropertyNames(Object.getPrototypeOf(chart.data)) : [];
    const orchMethods = chart?.orchestrator ? Object.getOwnPropertyNames(Object.getPrototypeOf(chart.orchestrator)) : [];
    return { dataMethods, orchMethods };
  });

  console.log('Chart Data & Orch Methods:', JSON.stringify(res, null, 2));
  await browser.close();
})();
