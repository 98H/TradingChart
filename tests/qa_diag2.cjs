// tests/qa_diag2.cjs
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  for (const vp of ['mobile', 'desktop']) {
    const ctx = await launch(vp);
    const { page } = ctx;
    await boot(ctx);
    await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
    await new Promise(r => setTimeout(r, 800));
    const o = await page.evaluate(() => {
      const box = document.querySelector('#modal-panels-menu');
      const inner = box?.querySelector('.panels-menu-box') || box?.firstElementChild;
      const grid = box?.querySelector('.panels-grid-menu');
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); const s = getComputedStyle(el);
        return { left: +b.left.toFixed(1), right: +b.right.toFixed(1), w: +b.width.toFixed(1), cls: el.className,
                 width: s.width, maxWidth: s.maxWidth, pad: s.padding, cols: s.gridTemplateColumns, dir: s.direction, ta: s.textAlign, pos: s.position, inset: s.inset, overflow: s.overflowX }; };
      return { vp: document.documentElement.clientWidth, overlay: r(box), box: r(inner), grid: r(grid),
               item0: r(grid?.querySelector('.panel-menu-item')) };
    });
    console.log(vp, JSON.stringify(o, null, 1));
    await ctx.browser.close();
  }
})();