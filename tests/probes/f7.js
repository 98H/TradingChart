// Persistence round-trip: symbol + timeframe + indicator + drawing + settings survive a reload.
const { page } = ctx;
await sleep(2500);
const R = {};
R.before = await page.evaluate(async () => {
  const a = window.__TRADING_APP__;
  await a.switchSymbol('ETHUSDT');
  await new Promise(r => setTimeout(r, 2500));
  await a.setTimeframe('240');
  await new Promise(r => setTimeout(r, 2500));
  const ch = a.chartManager.workspace.active.chart;
  // add a horizontal line drawing via public API if available
  let drew = null;
  try { drew = ch.drawings?.add?.({ type: 'horizontal_line', points: [{ time: a.activeBars.at(-5).time, price: a.activeBars.at(-1).close }] }) ?? null; } catch (e) { drew = 'ERR ' + e.message; }
  a.layoutManager.persistCurrentLayout?.();
  return { sym: a.currentSymbol, tf: a.currentTimeframe, bars: a.activeBars.length, last: a.activeBars.at(-1)?.close, drew: typeof drew === 'object' ? !!drew : drew,
    drawApi: Object.keys(ch.drawings || {}).slice(0, 20).join(','), chartKeys: Object.keys(ch).slice(0, 40).join(','), legend: document.querySelector('.vela-statusline, .vela-legend')?.innerText.slice(0, 60) };
});
await sleep(1500);
await page.reload({ waitUntil: 'domcontentloaded' });
await sleep(6000);
R.after = await page.evaluate(() => {
  const a = window.__TRADING_APP__;
  return { sym: a.currentSymbol, tf: a.currentTimeframe, bars: a.activeBars.length, last: a.activeBars.at(-1)?.close, lang: document.documentElement.lang, legend: document.querySelector('.vela-statusline, .vela-legend')?.innerText.slice(0, 60), ws: a.chartManager.workspace?.active?.symbol || null };
});
// sanity: ETH price range
return R;
