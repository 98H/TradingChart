// qa_probe_compare_overlap2.cjs — identify exactly which elements overlap at y≈872
const { launch, boot } = require('./qa_lib.cjs');
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);
  await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage('fa'));
  await settle(1500);
  await ctx.page.evaluate(() => {
    for (const el of document.querySelectorAll('header button, [class*="toolbar"] > button, [class*="rail"] button, .panel-tab')) {
      const t = (el.innerText || el.title || '').toString().trim();
      if (t === 'مقایسه') { el.click(); return; }
    }
  });
  await settle(1200);
  const st = await ctx.page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, .panel-tab')) {
      const r = el.getBoundingClientRect();
      if (r.top > 860 && r.top < 905 && r.height > 10) {
        let p = el, chain = [];
        while (p && chain.length < 5) { chain.push(p.tagName + '.' + (p.className || '').toString().slice(0, 35)); p = p.parentElement; }
        out.push({ sel: chain.join(' < '), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 30), visible: el.offsetParent !== null, disp: getComputedStyle(el).display });
      }
    }
    return out;
  });
  console.log(JSON.stringify(st, null, 1));
  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
