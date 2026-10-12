const { page } = ctx;
await page.evaluate(() => window.__TRADING_APP__.openPanel ? window.__TRADING_APP__.openPanel('watchlist') : document.querySelector('.panel-menu-item[data-panel="watchlist"]')?.click());
await sleep(1500);
return await page.evaluate(() => {
  const el = document.querySelector('.wl-new-list-btn') || document.querySelector('#btn-reset-paper');
  if (!el) return 'none';
  const chain = []; let p = el; while (p && chain.length < 10) { chain.push((p.id ? '#' + p.id : '') + '.' + (p.className || '').toString().split(' ').join('.')); p = p.parentElement; }
  const s = getComputedStyle(el);
  return { chain, mh: s.minHeight, h: el.getBoundingClientRect().height, coarse: matchMedia('(pointer: coarse)').matches, mw: matchMedia('(max-width: 768px)').matches };
});
