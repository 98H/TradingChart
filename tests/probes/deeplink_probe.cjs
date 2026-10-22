// tests/probes/deeplink_probe.cjs — trace why ?interval is (not) applied
const { launch, BASE } = require('../qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop'); const page = ctx.page;
  page.on('console', m => { const t = m.text(); if (/deep|Chartivia|timeframe/i.test(t)) console.log('console:', t.slice(0, 200)); });
  // 1st visit seeds an autosaved layout (BTCUSDT/60), exactly like a returning user
  await page.goto(`${BASE}/chart`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 7000));
  await page.evaluate(() => window.__TRADING_APP__?.layoutManager?.persistCurrentLayout?.());
  console.log('seeded layout:', await page.evaluate(() => (localStorage.getItem('tradingchart_current_layout') || '').slice(0, 160)));
  await page.goto(`${BASE}/chart?symbol=BINANCE:ETHUSDT&interval=240`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const s = await page.evaluate(() => { const a = window.__TRADING_APP__; const c = a?.chartManager?.workspace?.active; return { sym: a?.currentSymbol, tf: a?.currentTimeframe, dl: a?.deepLink, applied: a?._deepLinkApplied, cellSym: c?.symbol, cellTf: c?.timeframe, hasLayout: !!localStorage.getItem('tradingchart_current_layout') }; });
    console.log(i, JSON.stringify(s));
  }
  await ctx.browser.close(); process.exit(0);
})();
