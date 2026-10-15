// Strategy report: equity-curve labels + panel bottom clipping, measured.
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
const MOBILE = (await page.evaluate(() => innerWidth)) < 768;
if (!MOBILE) await page.evaluate(() => { window.__TRADING_APP__.toggleBottomPanel?.(false); window.__TRADING_APP__.switchBottomView?.('strategy'); });
else { await page.evaluate(() => window.__TRADING_APP__.chartManager.togglePanel('strategy', true)); await sleep(1500); }
await page.evaluate((src) => (window.innerWidth < 768 ? window.__TRADING_APP__.strategyTesterSide : window.__TRADING_APP__.strategyTester).runSimulation(src, window.__TRADING_APP__.activeBars), SRC);
await sleep(3500);
await page.screenshot({ path: '/root/.hermes/cache/scratch/eq_' + (MOBILE ? 'm' : 'd') + '.png' });
return await page.evaluate(() => {
  const c = (window.innerWidth < 768 ? window.__TRADING_APP__.strategyTesterSide : window.__TRADING_APP__.strategyTester).container;
  const svg = c.querySelector('svg');
  if (!svg) return { svg: false };
  const sr = svg.parentElement.getBoundingClientRect();
  const texts = Array.from(svg.parentElement.querySelectorAll('.eq-lbl')).map(t => { const r = t.getBoundingClientRect(); return { s: t.textContent, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }; });
  const overlaps = [];
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlaps.push([a.s, b.s]);
  }
  const outside = texts.filter(t => t.l < sr.left - 1 || t.r > sr.right + 1 || t.t < sr.top - 1 || t.b > sr.bottom + 1).map(t => t.s);
  // panel bottom: is any direct content clipped without scroll?
  const cr = c.getBoundingClientRect();
  const kids = Array.from(c.querySelectorAll('*')).filter(e => e.offsetParent && e.getBoundingClientRect().height > 0);
  const maxBottom = Math.max(...kids.map(e => e.getBoundingClientRect().bottom));
  const scroller = [c, c.firstElementChild].find(e => e && e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY));
  return { svg: [Math.round(sr.left), Math.round(sr.right), Math.round(sr.top), Math.round(sr.bottom)], texts, overlaps, outside,
    panelBottom: Math.round(cr.bottom), contentBottom: Math.round(maxBottom), scrollable: !!scroller, vh: innerHeight };
});
