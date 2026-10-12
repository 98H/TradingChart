const { page } = ctx;
await page.evaluate(() => document.querySelector('.rail-btn[data-panel="screener"]').click());
await sleep(2500);
return await page.evaluate(() => {
  const out = {};
  const tb = document.querySelector('.screener-tbody')?.closest('table');
  if (tb) {
    let p = tb.parentElement; const chain = [];
    for (let i = 0; i < 6 && p; i++, p = p.parentElement) { const s = getComputedStyle(p); chain.push({ cls: (p.className || p.id).toString().slice(0, 40), ox: s.overflowX, w: p.clientWidth, sw: p.scrollWidth }); }
    out.chain = chain;
  }
  // monospace fonts on Persian text
  const mono = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const el = n.parentElement; if (!el || !el.getClientRects().length) continue;
    if (!/[\u0600-\u06FF]{2,}/.test(n.textContent)) continue;
    const ff = getComputedStyle(el).fontFamily;
    if (/mono|courier|consol|menlo|SF Mono|JetBrains/i.test(ff.split(',')[0])) mono.push({ cls: (el.className || el.tagName).toString().slice(0, 40), ff: ff.slice(0, 50), t: n.textContent.trim().slice(0, 25) });
  }
  out.monoFa = mono.slice(0, 40);
  out.monoCount = mono.length;
  // quick trade vs statusline
  const qt = document.querySelector('#chart-quick-trade')?.getBoundingClientRect();
  const rows = Array.from(document.querySelectorAll('.vela-sl-row')).map(r => r.getBoundingClientRect());
  out.qt = qt && [qt.left, qt.right, qt.top, qt.bottom].map(Math.round);
  out.slRows = rows.map(r => [r.left, r.right, r.top, r.bottom].map(Math.round));
  return out;
});
