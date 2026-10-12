const { page } = ctx;
await sleep(2500);
const R = {};
R.empty = await page.evaluate(() => { const st = window.__TRADING_APP__.strategyTester; return { results: !!st.results, txt: st.container?.innerText.slice(0, 80) }; });
const SRC = `//@version=5
strategy("BB Test", overlay=true, initial_capital=100000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)
basis = ta.sma(close, 20)
dev = 2.0 * ta.stdev(close, 20)
if (close < basis - dev)
    strategy.entry("L", strategy.long)
if (close > basis + dev)
    strategy.close("L")
`;
await page.evaluate((src) => window.__TRADING_APP__.strategyTester.runSimulation(src, window.__TRADING_APP__.activeBars), SRC);
await sleep(3000);
R.run = await page.evaluate(() => { const r = window.__TRADING_APP__.strategyTester.results; return r && { n: r.totalTrades, net: +r.netProfit.toFixed(2), pf: r.profitFactor, sharpe: r.sharpeRatio, cap: r.initialCapital, bars: r.barsTested, first: r.trades[0] }; });
// different parameters must give different results (proves code is used)
await page.evaluate((src) => window.__TRADING_APP__.strategyTester.runSimulation(src.replace(/2\.0 \*/, '1.0 *'), window.__TRADING_APP__.activeBars), SRC);
await sleep(3000);
R.run2 = await page.evaluate(() => { const r = window.__TRADING_APP__.strategyTester.results; return r && { n: r.totalTrades, net: +r.netProfit.toFixed(2) }; });
// indicator → refused
await sleep(500);
await page.evaluate(() => { window.__TRADING_APP__.toggleBottomPanel?.(false); window.__TRADING_APP__.switchBottomView?.('strategy'); }); await sleep(800); await page.screenshot({ path: '/root/.hermes/cache/scratch/strat.png' });
  await page.evaluate((src) => window.__TRADING_APP__.strategyTester.runSimulation('//@version=5\nindicator("x")\nplot(close)', window.__TRADING_APP__.activeBars));
R.ind = await page.evaluate(() => window.__TRADING_APP__.strategyTester.container.innerText.slice(0, 90));
// syntax error
await page.evaluate(() => window.__TRADING_APP__.strategyTester.runSimulation('//@version=5\nstrategy("x")\nif (close >\n', window.__TRADING_APP__.activeBars));
await sleep(1500);
R.err = await page.evaluate(() => window.__TRADING_APP__.strategyTester.container.innerText.slice(0, 160));
R.logs = ctx.logs.slice(0, 5);
return R;
