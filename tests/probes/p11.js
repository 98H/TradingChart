const { page } = ctx;
await sleep(4000);
return await page.evaluate(() => {
  const b = document.querySelector('#latency-val').parentElement; const s = getComputedStyle(b);
  const alerts = Array.from(document.querySelectorAll('.canvas-alert-badge, [class*=alert-badge]')).filter(e=>e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [e.className.slice(0,40), Math.round(r.left), Math.round(r.right), Math.round(r.top), e.innerText.trim()]; });
  const ax = document.querySelector('.vela-cell canvas')?.getBoundingClientRect();
  const qt = document.querySelector('#chart-quick-trade')?.getBoundingClientRect();
  return { cls: b.className, border: s.borderColor, bg: s.backgroundColor, color: s.color, txt: b.innerText, alerts, cellRight: ax && Math.round(ax.right), qt: qt && [qt.left, qt.right, qt.top, qt.bottom].map(Math.round), legend: document.querySelector('.vela-sl-row')?.innerText.slice(0,80) };
});
