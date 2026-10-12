const { page } = ctx;
const R = {};
const ev = (f, ...a) => page.evaluate(f, ...a);
const app = () => window.__TRADING_APP__;
await page.evaluate(() => window.__TRADING_APP__.chartManager.setSymbol('BTCUSDT'));
// 1. Symbol switch
R.sym0 = await ev(() => window.__TRADING_APP__.chartManager.currentSymbol || window.__TRADING_APP__.chartManager.symbol);
await ev(() => window.__TRADING_APP__.chartManager.setSymbol('ETHUSDT'));
await sleep(3500);
R.sym1 = await ev(() => ({ s: window.__TRADING_APP__.chartManager.currentSymbol || window.__TRADING_APP__.chartManager.symbol, legend: document.querySelector('.vela-sl-row')?.innerText.replace(/\s+/g, ' ').slice(0, 60), title: document.title }));
// 2. Timeframe switch
await ev(() => window.__TRADING_APP__.chartManager.setTimeframe('15m'));
await sleep(3000);
R.tf = await ev(() => ({ legend: document.querySelector('.vela-sl-row')?.innerText.replace(/\s+/g, ' ').slice(0, 60), tfBtn: document.querySelector('.vela-topbar-tf')?.innerText.trim() }));
await ev(() => window.__TRADING_APP__.chartManager.setSymbol('BTCUSDT')); await sleep(3000);
// 3. Alert creation: above & below current
R.alert = await ev(() => {
  const am = window.__TRADING_APP__.alertsManager;
  am.alerts = []; am.saveAlerts(); am.render();
  const p = Number(am.currentPrice);
  const before = am.alerts.length;
  const idA = am.addAlert(p * 1.01); const idB = am.addAlert(p * 0.99);
  const a = am.alerts.find(x => x.id === idA), b = am.alerts.find(x => x.id === idB);
  return { p, before, after: am.alerts.length, a: a && [a.symbol, a.direction, a.conditionFa], b: b && [b.symbol, b.direction, b.conditionFa], idA, idB };
});
await sleep(1500);
R.alertVis = await ev(() => Array.from(document.querySelectorAll('.canvas-alert-line, .canvas-alert-badge, .canvas-alert-pinned')).filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [e.className.split(' ')[0], Math.round(r.top), Math.round(r.left), Math.round(r.right), e.innerText.replace(/\s+/g, ' ').trim()]; }));
// verify line y matches engine price->y
R.alertY = await ev(() => {
  const ov = window.__TRADING_APP__.chartAlertsOverlay; return ov && ov._lastProj ? ov._lastProj : null;
});
// 4. Delete alerts via UI button
R.del = await ev(async () => {
  const am = window.__TRADING_APP__.alertsManager; const n0 = am.alerts.length;
  const btn = document.querySelector('.canvas-alert-badge .btn-delete-alert-pill, .canvas-alert-pinned .btn-delete-alert-pill');
  if (!btn) return { n0, note: 'no-btn' };
  btn.click(); await new Promise(r => setTimeout(r, 600));
  return { n0, n1: am.alerts.length, confirmOpen: !!document.querySelector('.tc-confirm, [role=alertdialog]') };
});
// 5. Paper trading market buy
R.paper = await ev(async () => {
  const pt = window.__TRADING_APP__.paperTrading; if (!pt) return 'no pt';
  const b0 = pt.balance, n0 = (pt.positions || []).length;
  pt.executeOrder('buy', 'market', null, 0.1);
  await new Promise(r => setTimeout(r, 800));
  const pos = (pt.positions || [])[0];
  return { b0, b1: pt.balance, n0, n1: (pt.positions || []).length, pos: pos && { side: pos.side, qty: pos.qty, entry: pos.entryPrice ?? pos.entry, sym: pos.symbol } , eq: pt.calculateEquity?.() };
});
// close it
R.paperClose = await ev(async () => {
  const pt = window.__TRADING_APP__.paperTrading; const pos = (pt.positions || [])[0]; if (!pos) return 'none';
  pt.closePosition(pos.id); await new Promise(r => setTimeout(r, 800));
  return { n: (pt.positions || []).length, bal: pt.balance, hist: (pt.history || pt.closedTrades || []).length };
});
// 6. Indicator add via modal
R.ind = await ev(async () => {
  const m = window.__TRADING_APP__.indicatorsModal; const ch = window.__TRADING_APP__.chartManager;
  const cnt = () => ch.getIndicators().length;
  const c0 = cnt();
  m.open?.(); await new Promise(r => setTimeout(r, 800));
  const item = document.querySelector('.ind-card-row[data-id="rsi"]') || document.querySelector('.ind-card-row');
  const label = item?.innerText.replace(/\s+/g, ' ').slice(0, 60);
  item?.click(); await new Promise(r => setTimeout(r, 2500));
  document.querySelector('.indicators-modal-close, .modal-close, [aria-label="Close"], [aria-label="بستن"]')?.click();
  await new Promise(r => setTimeout(r, 500));
  return { c0, c1: cnt(), label, rows: Array.from(document.querySelectorAll('.vela-sl-row')).map(r => r.innerText.replace(/\s+/g, ' ').slice(0, 50)) };
});
R.errs = ctx.logs.filter(l => /error|exception|uncaught/i.test(l)).slice(0, 10);
return R;
