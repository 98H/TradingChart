// tests/test-pine-plot.js
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

  const info = await page.evaluate(async () => {
    const chart = window.app.chartManager.workspace.active.chart;
    const code = '//@version=5\nindicator("SMA 14", overlay=true)\nplot(ta.sma(close, 14), color=color.rgb(0, 229, 255), linewidth=3)\n';
    const handle = chart.addIndicator(code, { language: 'pine', title: 'SMA 14' });
    await new Promise(r => setTimeout(r, 1500));
    return {
      handleId: handle.id,
      title: handle.title,
      isDisposed: handle.isDisposed,
      panesCount: chart.panes?.all?.()?.length,
      legendRows: Array.from(document.querySelectorAll('*')).filter(el => (el.className && typeof el.className === 'string' && el.className.includes('legend'))).map(el => el.innerText)
    };
  });
  console.log('Indicator Info:', JSON.stringify(info, null, 2));
  await page.screenshot({ path: '/root/TradingChart/screenshots/test_indicator_plot.png' });
  await browser.close();
})();
