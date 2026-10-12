const { page } = ctx;
const R = {};
await sleep(1500);
// clean state
await page.evaluate(() => { const pt = window.__TRADING_APP__.paperTrading; pt.positions = []; pt.orders = []; pt.balance = 100000; pt.updatePositionsView(); window.__TRADING_APP__.alertsManager.alerts = []; window.__TRADING_APP__.alertsManager.saveAlerts(); });
// 1. Right-click on chart at a known y → menu price must equal engine yToPrice
const box = await page.evaluate(() => { const r = window.__TRADING_APP__.chartManager.workspace.active.host.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.3 }; });
await page.mouse.click(box.x, box.y, { button: 'right' });
await sleep(700);
R.ctx = await page.evaluate((y) => {
  const cm = window.__TRADING_APP__.canvasContextMenu || null;
  const items = Array.from(document.querySelectorAll('.ctx-item')).filter(e => e.getClientRects().length).map(e => e.innerText.replace(/\s+/g, ' ').trim());
  return { items: items.slice(0, 6), mkt: window.__TRADING_APP__.paperTrading.currentPrice };
}, box.y);
// click Buy item (above 30% height → above market → should be STOP; place pending)
await page.evaluate(() => document.querySelector('#ctx-buy-limit')?.click());
await sleep(600);
R.afterBuy = await page.evaluate(() => { const pt = window.__TRADING_APP__.paperTrading; return { orders: pt.orders.map(o => [o.side, o.type, o.price]), pos: pt.positions.length, toast: document.querySelector('#tradingchart-toast')?.textContent }; });
// 2. Alert via context menu
await page.mouse.click(box.x, box.y + 200, { button: 'right' });
await sleep(600);
await page.evaluate(() => document.querySelector('#ctx-add-alert')?.click());
await sleep(800);
R.alert = await page.evaluate(() => ({ alerts: window.__TRADING_APP__.alertsManager.alerts.map(a => [a.direction, a.targetPrice]), toast: document.querySelector('#tradingchart-toast')?.textContent, lines: document.querySelectorAll('.canvas-alert-line').length }));
// 3. Limit order fill simulation: place buy limit slightly above → marketable → fill now
R.marketable = await page.evaluate(() => { const pt = window.__TRADING_APP__.paperTrading; const r = pt.placeOrder({ side: 'long', type: 'limit', price: pt.currentPrice * 1.01, qty: 0.01 }); return { r, pos: pt.positions.map(p => [p.side, +p.entryPrice.toFixed(2)]), mkt: pt.currentPrice }; });
// 4. Resting order trigger via setMarket
R.trigger = await page.evaluate(() => {
  const pt = window.__TRADING_APP__.paperTrading; const px = pt.currentPrice;
  pt.orders = []; const id = pt.placeOrder({ side: 'long', type: 'limit', price: px * 0.999, qty: 0.01 });
  const n0 = pt.orders.length, p0 = pt.positions.length;
  pt.setMarket(pt.currentSymbol, px * 0.998);
  return { id: !!id, n0, n1: pt.orders.length, p0, p1: pt.positions.length, entry: pt.positions.at(-1)?.entryPrice, lim: +(px * 0.999).toFixed(2) };
});
// 5. Invalid qty
R.badQty = await page.evaluate(() => window.__TRADING_APP__.paperTrading.placeOrder({ side: 'long', qty: 0 }));
// 6. Paper panel UI renders pending orders list
await page.evaluate(() => document.querySelector('.rail-btn[data-panel="paper"]')?.click());
await sleep(1000);
R.panel = await page.evaluate(() => ({ pend: document.querySelector('#orders-table-wrap')?.innerText.replace(/\s+/g, ' ').slice(0, 150), cnt: document.querySelector('#pos-count-badge')?.innerText, priceWrap: getComputedStyle(document.querySelector('#order-price-wrap') || document.body).display }));
await page.evaluate(() => { const s = document.querySelector('#order-type-sel'); s.value = 'limit'; s.dispatchEvent(new Event('change')); });
await sleep(300);
R.limitUI = await page.evaluate(() => ({ disp: getComputedStyle(document.querySelector('#order-price-wrap')).display, val: document.querySelector('#order-price-input').value }));
await page.screenshot({ path: '/root/.hermes/cache/scratch/paper_panel.png' });
R.errs = ctx.logs.filter(l => /error|uncaught/i.test(JSON.stringify(l))).slice(0, 5);
return R;
