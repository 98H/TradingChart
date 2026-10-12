const { page } = ctx;
await sleep(2500);
const SRC = `//@version=5
strategy("BB Test", overlay=true, initial_capital=100000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)
basis = ta.sma(close, 20)
dev = 2.0 * ta.stdev(close, 20)
if (close < basis - dev)
    strategy.entry("L", strategy.long)
if (close > basis + dev)
    strategy.close("L")
`;
await page.evaluate(() => { window.__TRADING_APP__.toggleBottomPanel?.(false); window.__TRADING_APP__.switchBottomView?.('strategy'); });
await page.evaluate((src) => window.__TRADING_APP__.strategyTester.runSimulation(src, window.__TRADING_APP__.activeBars), SRC);
await sleep(3500);
return await page.evaluate(() => {
  const c = window.__TRADING_APP__.strategyTester.container;
  const tbl = c.querySelector('table');
  const ths = Array.from(tbl.querySelectorAll('th')).map(e => { const r = e.getBoundingClientRect(); return [e.innerText, Math.round(r.left), Math.round(r.right)]; });
  const tds = Array.from(tbl.querySelectorAll('tbody tr:first-child td')).map(e => { const r = e.getBoundingClientRect(); return [e.innerText, Math.round(r.left), Math.round(r.right), getComputedStyle(e).textAlign, getComputedStyle(e).direction]; });
  const cr = c.getBoundingClientRect();
  return { ths, tds, cont: [Math.round(cr.top), Math.round(cr.bottom), c.scrollHeight, c.clientHeight, getComputedStyle(c).overflowY], inner: [c.firstElementChild.scrollHeight, c.firstElementChild.clientHeight, getComputedStyle(c.firstElementChild).overflowY], tblDisp: getComputedStyle(tbl).display, tblW: Math.round(tbl.getBoundingClientRect().width), wrapW: Math.round(tbl.parentElement.getBoundingClientRect().width) };
});
