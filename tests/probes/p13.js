const { page } = ctx;
await sleep(3000);
return await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('[class*=canvas-alert]')).filter(e=>e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [e.className.slice(0,50), Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom), e.innerText.trim().slice(0,20)]; });
  const ov = document.querySelector('.chart-alerts-overlay, #chart-alerts-overlay');
  const lab = Array.from(document.querySelectorAll('.vela-cell *')).find(e => /^8\d{4}\.\d\d$/.test(e.textContent?.trim()||''));
  const qt = document.querySelector('#chart-quick-trade').getBoundingClientRect();
  const cell = document.querySelector('.vela-cell').getBoundingClientRect();
  return { all, ov: ov && ov.getBoundingClientRect().toJSON(), cellR: cell.right, cellT: cell.top, qt: [qt.left, qt.right, qt.top, qt.bottom] };
});
