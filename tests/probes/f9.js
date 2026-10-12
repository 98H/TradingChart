// Edge: draw on BTC → switch to ETH → reload (layout restores ETH) → back to BTC must still have BTC drawings.
const { page } = ctx;
await sleep(3000);
const R = {};
R.a = await page.evaluate(async () => {
  const a = window.__TRADING_APP__;
  if (a.currentSymbol !== 'BTCUSDT') { await a.switchSymbol('BTCUSDT'); await new Promise(r => setTimeout(r, 3000)); }
  const d = a.chartManager.workspace.active.chart.drawings;
  d.removeMany(d.all().map(x => x.id));
  const b = a.activeBars;
  d.add('hline', { anchors: [{ time: b.at(-20).time, price: b.at(-1).close }] });
  await new Promise(r => setTimeout(r, 300));
  await a.switchSymbol('ETHUSDT');
  await new Promise(r => setTimeout(r, 3000));
  const d2 = a.chartManager.workspace.active.chart.drawings;
  const b2 = a.activeBars;
  d2.add('hline', { anchors: [{ time: b2.at(-20).time, price: b2.at(-1).close }] });
  d2.add('hline', { anchors: [{ time: b2.at(-20).time, price: b2.at(-1).close * 1.02 }] });
  await new Promise(r => setTimeout(r, 1500));
  return { eth: d2.all().length };
});
await sleep(2000);
await page.reload({ waitUntil: 'domcontentloaded' });
await sleep(7000);
R.b = await page.evaluate(async () => {
  const a = window.__TRADING_APP__;
  const onEth = a.chartManager.workspace.active.chart.drawings.all().length;
  const symAfter = a.currentSymbol;
  await a.switchSymbol('BTCUSDT');
  await new Promise(r => setTimeout(r, 3000));
  const onBtc = a.chartManager.workspace.active.chart.drawings.all().map(x => Math.round(x.anchors[0].price));
  await a.switchSymbol('ETHUSDT');
  await new Promise(r => setTimeout(r, 3000));
  const ethBack = a.chartManager.workspace.active.chart.drawings.all().length;
  // cleanup
  const d = a.chartManager.workspace.active.chart.drawings; d.removeMany(d.all().map(x => x.id));
  await a.switchSymbol('BTCUSDT'); await new Promise(r => setTimeout(r, 2500));
  const d3 = a.chartManager.workspace.active.chart.drawings; d3.removeMany(d3.all().map(x => x.id));
  return { symAfter, onEth, onBtc, ethBack };
});
return R;
