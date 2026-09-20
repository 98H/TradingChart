// tests/qa_diag3.cjs — diagnose mobile drawer panel rendering
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('mobile');
  const { page } = ctx;
  await boot(ctx);
  await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
  await new Promise(r => setTimeout(r, 700));
  await page.evaluate(() => document.querySelector('.panel-menu-item[data-panel="paper"]')?.click());
  await new Promise(r => setTimeout(r, 2000));
  const o = await page.evaluate(() => {
    const cands = ['.vela-drawer', '.vela-dock-panel', '[id*="paper"]', '[class*="paper"]'];
    const found = {};
    cands.forEach(c => { found[c] = Array.from(document.querySelectorAll(c)).map(e => ({ id: e.id, cls: (e.className||'').toString().slice(0,70), vis: getComputedStyle(e).display, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })); });
    const backdrop = document.querySelector('.vela-drawer-backdrop');
    return { found, bodyChildrenTop: Array.from(document.querySelector('.vela-ui-layer')?.children || []).map(e => e.className + '|' + e.id),
             openDoor: window.__TRADING_APP__.chartManager.openPanelId };
  });
  console.log(JSON.stringify(o, null, 1));
  await ctx.browser.close();
})();