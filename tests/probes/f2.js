const { page } = ctx;
await page.evaluate(() => window.__TRADING_APP__.chartManager.setTimeframe('15m'));
await sleep(3000);
return await page.evaluate(() => {
  const row = document.querySelector('.vela-sl-row');
  const out = [];
  const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) out.push([n.textContent, n.parentElement.getAttribute('velaI18n') ?? n.parentElement.getAttribute('velai18n')]);
  return { out, cm: { tf: window.__TRADING_APP__.chartManager.currentTimeframe || window.__TRADING_APP__.chartManager.timeframe } };
});
