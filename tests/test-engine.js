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
  await new Promise(r => setTimeout(r, 2500));

  const res = await page.evaluate(async () => {
    const chart = window.app.chartManager.workspace.active.chart;
    console.log('Active chart:', chart);
    console.log('Engines in orchestrator:', Array.from(chart.orchestrator.engines.keys()));

    const code = `//@version=5\nindicator("Test SMA", overlay=true)\nplot(ta.sma(close, 20), color=color.yellow, linewidth=2)\n`;
    try {
      const handle = chart.addIndicator(code, { language: 'pine' });
      console.log('Handle returned:', handle);
      return { success: true, handleId: handle?.id };
    } catch (e) {
      console.error('addIndicator error:', e);
      return { success: false, error: e.message };
    }
  });

  console.log('Result:', res);
  await new Promise(r => setTimeout(r, 2000));

  const afterAdd = await page.evaluate(() => {
    const chart = window.app.chartManager.workspace.active.chart;
    return {
      handles: Array.from(chart.orchestrator.handles.keys()),
      indicators: chart.indicators
    };
  });
  console.log('After Add:', afterAdd);

  await browser.close();
})();
