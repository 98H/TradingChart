// tests/qa_smoke_live.cjs — final live end-to-end sanity on the deployed build
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  const en = await page.evaluate(() => ({ sym: window.__TRADING_APP__?.currentSymbol, bars: window.__TRADING_APP__?.activeBars?.length }));
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 2500));
  const fa = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    bodyFa: document.body.classList.contains('persian-mode'),
    bars: window.__TRADING_APP__?.activeBars?.length
  }));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 6000));
  const afterReload = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    bodyFa: document.body.classList.contains('persian-mode'),
    bars: window.__TRADING_APP__?.activeBars?.length,
    canvas: document.querySelectorAll('canvas').length
  }));
  const errs = ctx.logs.filter(l => ['error', 'pageerror'].includes(l.type)).map(l => String(l.text).slice(0, 120));
  console.log(JSON.stringify({ en, fa, afterReload, consoleErrors: errs }, null, 2));
  await ctx.browser.close();
})();