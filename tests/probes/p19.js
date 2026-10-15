const { page } = ctx;
await sleep(2500);
await page.evaluate(() => window.__TRADING_APP__.chartManager.togglePanel('strategy', true));
await sleep(1500);
await page.evaluate(() => window.__TRADING_APP__.strategyTesterSide.runSimulation('//@version=5\nstrategy("t", overlay=true)\nb = ta.sma(close, 20)\nd = 2.0 * ta.stdev(close, 20)\nif (close < b - d)\n    strategy.entry("L", strategy.long)\nif (close > b + d)\n    strategy.close("L")\n', window.__TRADING_APP__.activeBars));
await sleep(3500);
return await page.evaluate(() => {
  const c = window.__TRADING_APP__.strategyTesterSide.container;
  const chain = []; let e = c;
  while (e && e !== document.body) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); chain.push([e.id || e.className.toString().slice(0, 40), Math.round(r.top), Math.round(r.bottom), e.scrollHeight, e.clientHeight, cs.overflowY]); e = e.parentElement; }
  const last = c.querySelector('table') || c.lastElementChild;
  // try to scroll the scrollable ancestor to bottom then check last row visible
  const sc = chain.map((x, i) => i).find(i => /auto|scroll/.test(chain[i][5]) && chain[i][3] > chain[i][4] + 1);
  let el = c; for (let i = 0; i < (sc ?? -1); i++) el = el.parentElement;
  if (sc != null) el.scrollTop = el.scrollHeight;
  const kids=[...c.children]; const inner = c.firstElementChild; const ir = inner.getBoundingClientRect(); const ics = getComputedStyle(inner); const tw = c.querySelector('table').parentElement; const twr = tw.getBoundingClientRect(); const twcs = getComputedStyle(tw); const twinfo=[Math.round(twr.top),Math.round(twr.bottom),tw.scrollHeight,tw.clientHeight,twcs.overflowY,twcs.maxHeight,tw.parentElement.getBoundingClientRect().bottom|0, getComputedStyle(tw.parentElement).overflow]; const deep = [...c.querySelectorAll('*')].filter(x=>x.getBoundingClientRect().bottom > innerHeight).slice(0,3).map(x=>[x.tagName,x.className.toString().slice(0,30),Math.round(x.getBoundingClientRect().bottom)]); const btn = Array.from(c.querySelectorAll('button')).pop();
  const br = btn?.getBoundingClientRect();
  return { twinfo, inner:[Math.round(ir.top),Math.round(ir.bottom),inner.scrollHeight,inner.clientHeight,ics.overflowY,ics.height], deep, chain, scrollerIdx: sc, lastBtn: btn && [btn.innerText.slice(0, 30), Math.round(br.top), Math.round(br.bottom)], vh: innerHeight };
});
