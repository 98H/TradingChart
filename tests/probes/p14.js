const { page } = ctx;
await sleep(1500);
return await page.evaluate(() => {
  const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)]; };
  return { vh: innerHeight, bb: q('.vela-widget-bottombar'), bottomPanel: q('#bottom-panel'), tabs: q('.bottom-tabs, #bottom-panel-tabs, .bottom-panel-tabs'), mb: q('.vela-mobilebar') };
});
