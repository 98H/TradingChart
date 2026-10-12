const { page } = ctx;
await sleep(1500);
const R = {};
await page.evaluate(() => document.querySelector('#qt-collapsed-trigger')?.click()); await sleep(800);
R.qt = await page.evaluate(() => {
  const q = document.querySelector('#chart-quick-trade'); if (!q) return null;
  const r = q.getBoundingClientRect();
  return { box: [r.left, r.right, r.width, q.scrollWidth], style: q.getAttribute('style')?.slice(0, 300), kids: Array.from(q.children).map(c => { const b = c.getBoundingClientRect(); return [c.id || c.className, Math.round(b.width), getComputedStyle(c).flex]; }), disp: getComputedStyle(q).display, pos: getComputedStyle(q).position };
});
await page.evaluate(() => document.querySelector('.vela-mb-drawings')?.click());
await sleep(1000);
R.small = await page.evaluate(() => Array.from(document.querySelectorAll('button,[role="button"],a,input,select')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 300 && r.height < 30 && r.height > 2; }).map(e => ({ tag: e.tagName, cls: e.className.toString().slice(0, 60), html: e.outerHTML.slice(0, 200), parent: e.parentElement.className.toString().slice(0, 60) })));
return R;
