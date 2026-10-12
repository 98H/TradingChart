const { page } = ctx;
await sleep(2500);
const R = {};
R.pre = await page.evaluate(() => { const a = window.__TRADING_APP__; const pt = a.paperTrading; pt.positions = []; pt.orders = []; pt.updatePositionsView?.(); const live = a.activeBars.at(-1).close;
  pt.placeOrder({ side: 'long', type: 'limit', price: live * 0.97, qty: 0.01 }); // resting order 3% below live
  return { live, n: a.activeBars.length, orders: pt.orders.length }; });
await page.evaluate(() => window.__TRADING_APP__.toggleReplay());
await sleep(800);
R.start = await page.evaluate(() => { const a = window.__TRADING_APP__; const b = a.barReplay; const ch = a.chartManager.workspace.active.chart;
  return { idx: b.currentIndex, total: b.totalBars, rp: b.currentPrice, ptPrice: a.paperTrading.currentPrice, ptOrders: a.paperTrading.orders.length, ptPos: a.paperTrading.positions.length,
    bar: document.querySelector('#replay-bar')?.innerText.replace(/\s+/g, ' ').slice(0, 200), qtSell: document.querySelector('#quick-sell-price')?.innerText }; });
// wait for live polling ticks
await sleep(9000);
R.afterWait = await page.evaluate(() => { const a = window.__TRADING_APP__; const b = a.barReplay; const ch = a.chartManager.workspace.active.chart; const bs = ch.orchestrator?.bars || ch.orchestrator?.getBars?.() || ch.orchestrator?.series || null; return { chartLen: Array.isArray(bs) ? bs.length : (bs && bs.length), chartLast: Array.isArray(bs) ? bs.at(-1)?.close : null, orchKeys: Object.keys(ch.orchestrator||{}).slice(0,40).join(','), idx: b.currentIndex, rp: b.currentPrice, ptPrice: a.paperTrading.currentPrice, qtSell: document.querySelector('#quick-sell-price')?.innerText, alertsPx: a.alertsManager.currentPrice }; });
// trade in replay then step
await page.evaluate(() => document.querySelector('#btn-replay-buy').click());
for (let i = 0; i < 5; i++) await page.evaluate(() => document.querySelector('#btn-replay-step').click());
R.trade = await page.evaluate(() => ({ pos: window.__TRADING_APP__.barReplay.replayPosition, wrap: document.querySelector('#replay-pos-wrap')?.innerText }));
await page.screenshot({ path: '/root/.hermes/cache/scratch/replay.png' });
await page.evaluate(() => document.querySelector('#btn-replay-exit').click());
await sleep(800);
R.exit = await page.evaluate(() => { const a = window.__TRADING_APP__; return { ptPrice: a.paperTrading.currentPrice, live: a.activeBars.at(-1).close, ptPos: a.paperTrading.positions.length, journal: (a.tradeJournal?.store?.executions || []).filter(e => e.source === 'replay').slice(0, 2).map(e => [e.side, e.price, e.executedAt]), toast: document.querySelector('#tradingchart-toast')?.textContent }; });
return R;
