// tests/test-replay-interaction.js
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

  const replayTest = await page.evaluate(async () => {
    const chart = window.app.chartManager.workspace?.active?.chart;
    const orch = chart?.orchestrator;
    const initialCount = orch?.bars?.length;

    // Slice to 100 bars
    const sliced = orch.rawBars.slice(0, 100);
    orch.setBarSeries(sliced, { preserveView: true });
    await new Promise(r => setTimeout(r, 500));
    const afterSliceCount = orch.bars.length;

    // Step 1 bar forward with applyBar
    const nextBar = window.app.activeBars[100];
    if (nextBar) {
      orch.applyBar(nextBar);
    }
    await new Promise(r => setTimeout(r, 500));
    const afterStepCount = orch.bars.length;

    // Restore
    orch.setBarSeries(window.app.activeBars, { preserveView: true });
    await new Promise(r => setTimeout(r, 500));
    const restoredCount = orch.bars.length;

    return { initialCount, afterSliceCount, afterStepCount, restoredCount };
  });

  console.log('Replay Test Result:', replayTest);
  await browser.close();
})();
