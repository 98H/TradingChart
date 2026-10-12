const { page } = ctx;
await page.evaluate(() => document.querySelector('.rail-btn[data-panel="screener"]').click());
await sleep(2500);
return await page.evaluate(() => {
  const c = document.querySelector('.screener-table-container');
  const ths = Array.from(document.querySelectorAll('.screener-table-container thead th')).map(th => { const r = th.getBoundingClientRect(); return [th.innerText.trim().slice(0,12), Math.round(r.left), Math.round(r.right)]; });
  const tds = Array.from(document.querySelectorAll('#screener-tbody tr:first-child td')).map(td => { const r = td.getBoundingClientRect(); return [td.innerText.trim().replace(/\s+/g,' ').slice(0,12), Math.round(r.left), Math.round(r.right)]; });
  const cr = c.getBoundingClientRect();
  return { container: [Math.round(cr.left), Math.round(cr.right), c.clientWidth, c.scrollWidth, getComputedStyle(c).overflowX, c.scrollLeft], ths, tds, dir: getComputedStyle(c).direction };
});
