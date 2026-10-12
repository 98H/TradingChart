const { page } = ctx;
const R = {};
R.plan = await page.evaluate(() => ({ plan: window.__TRADING_APP__.auth?.plan || window.__TRADING_APP__.auth?.currentPlan?.id, n: window.__TRADING_APP__.chartManager.getIndicators().map(i => i.title || i.name || i.id) }));
await page.evaluate(() => window.__TRADING_APP__.indicatorsModal.open());
await sleep(800);
await page.evaluate(() => document.querySelector('.ind-card-row[data-id="rsi"] .add-ind-btn').click());
await sleep(1200);
R.after = await page.evaluate(() => ({
  btn: document.querySelector('.ind-card-row[data-id="rsi"] .add-ind-btn')?.innerText,
  toasts: Array.from(document.querySelectorAll('.toast, [class*=toast]')).filter(e => e.getClientRects().length).map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 200)),
  n: window.__TRADING_APP__.chartManager.getIndicators().length,
}));
await page.screenshot({ path: '/root/.hermes/cache/scratch/ind_gate.png' });
return R;
