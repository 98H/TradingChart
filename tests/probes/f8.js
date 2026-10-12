// Drawing persistence: add → reload → still there; switching symbol isolates; undo works.
const { page } = ctx;
await sleep(3000);
const R = {};
R.add = await page.evaluate(async () => {
  const a = window.__TRADING_APP__;
  const ch = a.chartManager.workspace.active.chart;
  const d = ch.drawings;
  d.removeMany(d.all().map(x => x.id));
  const b = a.activeBars;
  const tl = d.add('trendline', { anchors: [{ time: b.at(-60).time, price: b.at(-60).low }, { time: b.at(-10).time, price: b.at(-10).high }] });
  const hl = d.add('hline', { anchors: [{ time: b.at(-20).time, price: b.at(-1).close }] });
  await new Promise(r => setTimeout(r, 300));
  const all = d.all();
  d.undo(); const afterUndo = d.all().length; d.redo(); const afterRedo = d.all().length;
  a.layoutManager.persistCurrentLayout?.();
  return { tl: !!tl, hl: !!hl, n: all.length, types: all.map(x => x.type), afterUndo, afterRedo, sym: a.currentSymbol, canUndo: d.canUndo() };
});
await sleep(2500);
await page.reload({ waitUntil: 'domcontentloaded' });
await sleep(7000);
R.reload = await page.evaluate(() => {
  const a = window.__TRADING_APP__;
  const all = a.chartManager.workspace.active.chart.drawings.all();
  return { n: all.length, types: all.map(x => x.type), sym: a.currentSymbol };
});
R.otherSym = await page.evaluate(async () => {
  const a = window.__TRADING_APP__;
  const orig = a.currentSymbol;
  await a.switchSymbol(orig === 'ETHUSDT' ? 'BTCUSDT' : 'ETHUSDT');
  await new Promise(r => setTimeout(r, 3000));
  const n2 = a.chartManager.workspace.active.chart.drawings.all().length;
  await a.switchSymbol(orig);
  await new Promise(r => setTimeout(r, 3000));
  const back = a.chartManager.workspace.active.chart.drawings.all().length;
  return { onOther: n2, backOnOrig: back };
});
await page.screenshot({ path: '/root/.hermes/cache/scratch/draw.png' });
return R;
