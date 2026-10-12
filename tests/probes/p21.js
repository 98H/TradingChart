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
await page.evaluate(() => { const a = window.__TRADING_APP__; if (innerWidth < 769) { document.querySelector('#nav-btn-panels')?.click(); document.querySelector('.panel-menu-item[data-panel="strategy"]')?.click(); } else { a.toggleBottomPanel?.(false); a.switchBottomView?.('strategy'); } });
await page.evaluate((src) => window.__TRADING_APP__.strategyTester.runSimulation(src, window.__TRADING_APP__.activeBars), SRC);
await sleep(1500);
await page.evaluate(() => { const a = window.__TRADING_APP__; if (innerWidth < 769 && a.strategyTesterSide) { a.strategyTesterSide.results = a.strategyTester.results; a.strategyTesterSide.renderReport(); } });
await sleep(2000);
return await page.evaluate(() => {
  const a = window.__TRADING_APP__;
  const c = (innerWidth < 769 && a.strategyTesterSide) ? a.strategyTesterSide.container : a.strategyTester.container;
  const svg = c.querySelector('svg[preserveAspectRatio]').parentElement;
  const sr = svg.getBoundingClientRect();
  const texts = Array.from(svg.querySelectorAll('.eq-lbl')).map(t => { const r = t.getBoundingClientRect(); return { t: t.textContent, l: Math.round(r.left), r: Math.round(r.right), top: Math.round(r.top), b: Math.round(r.bottom) }; });
  const overlaps = [];
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const A = texts[i], B = texts[j];
    if (A.l < B.r && B.l < A.r && A.top < B.b && B.top < A.b) overlaps.push([A.t, B.t]);
  }
  const outside = texts.filter(t => t.l < sr.left - 1 || t.r > sr.right + 1 || t.top < sr.top - 1 || t.b > sr.bottom + 1).map(t => t.t);
  const cr = c.getBoundingClientRect();
  const inner = c.firstElementChild;
  return { svg: [Math.round(sr.left), Math.round(sr.right), Math.round(sr.top), Math.round(sr.bottom)], texts, overlaps, outside,
    container: { top: Math.round(cr.top), bottom: Math.round(cr.bottom), scrollH: c.scrollHeight, clientH: c.clientHeight, overflowY: getComputedStyle(c).overflowY,
      innerScrollH: inner?.scrollHeight, innerClientH: inner?.clientHeight, innerOverflow: inner && getComputedStyle(inner).overflowY },
    vh: innerHeight };
});
