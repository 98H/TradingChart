const { page } = ctx;
await sleep(2500);
const out = {};
for (const id of ['strategy', 'watchlist', 'alerts', 'paper', 'screener']) {
  await page.evaluate((id) => window.__TRADING_APP__.chartManager.togglePanel(id, true), id);
  await sleep(1200);
  out[id] = await page.evaluate((id) => {
    const p = document.querySelector('.vela-panel-' + id) || document.querySelector('.vela-panel');
    const b = p?.querySelector('.vela-panel-body');
    const mb = document.querySelector('.vela-mobilebar');
    const pr = p?.getBoundingClientRect(), br = b?.getBoundingClientRect(), mr = mb?.getBoundingClientRect();
    if (b) b.scrollTop = b.scrollHeight;
    const vis = [...(b?.querySelectorAll('*') || [])].filter(x => x.children.length === 0 && x.getBoundingClientRect().height > 0);
    const lastLeaf = vis.sort((a, c) => c.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    const top = mr ? document.elementFromPoint(mr.left + 30, mr.top + 5) : null;
    return { panel: pr && [Math.round(pr.top), Math.round(pr.bottom)], body: br && [Math.round(br.bottom)], mobilebar: mr && [Math.round(mr.top), Math.round(mr.bottom)], lastLeafBottom: lastLeaf && Math.round(lastLeaf.getBoundingClientRect().bottom), topAtBar: top ? (top.className.toString().slice(0, 40)) : null, panelZ: p && getComputedStyle(p).zIndex };
  }, id);
  await page.evaluate((id) => window.__TRADING_APP__.chartManager.togglePanel(id, false), id);
  await sleep(500);
}
return out;
