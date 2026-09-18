// tests/diagnose.js
import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://127.0.0.1:8088');
  await new Promise(r => setTimeout(r, 2000));

  console.log('--- 1. Testing Symbol Switch to ETHUSDT ---');
  await page.evaluate(() => window.app.switchSymbol('ETHUSDT'));
  await new Promise(r => setTimeout(r, 1500));

  console.log('--- 2. Testing Timeframe Switch to 15m ---');
  await page.evaluate(() => {
    window.app.currentTimeframe = '15';
    window.app.chartManager.setTimeframe('15');
    window.app.loadActiveCandles();
  });
  await new Promise(r => setTimeout(r, 1500));

  console.log('--- 3. Testing Layout Switch to 2h ---');
  await page.evaluate(() => window.app.chartManager.setLayout('2h'));
  await new Promise(r => setTimeout(r, 1500));

  console.log('--- 4. Testing Adding Pine Indicator ---');
  const pineRes = await page.evaluate(() => {
    const code = `//@version=5\nindicator("Test SMA", overlay=true)\nplot(ta.sma(close, 20), color=color.yellow, linewidth=2)\n`;
    return window.app.chartManager.addPineIndicator(code);
  });
  console.log('Add Pine Indicator Result:', pineRes);

  console.log('--- 5. Inspecting Vela Chart State ---');
  const chartDetails = await page.evaluate(() => {
    const ws = window.app.chartManager.workspace;
    const activeCell = ws?.active;
    const chart = activeCell?.chart;
    return {
      hasWorkspace: !!ws,
      activeId: ws?.activeId,
      cellsCount: ws?.cells()?.length,
      symbol: activeCell?.symbol,
      timeframe: activeCell?.timeframe,
      hasChart: !!chart,
      indicators: chart?.indicators ? Object.keys(chart.indicators) : null,
      drawingsCount: chart?.drawings ? chart.drawings.all()?.length : null
    };
  });
  console.log('Chart Details:', JSON.stringify(chartDetails, null, 2));

  await browser.close();
})();
