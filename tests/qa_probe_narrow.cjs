// qa_probe_narrow.cjs — evidence: what exactly overflows at 800px / 320px
const { launch, boot } = require('./qa_lib.cjs');

(async () => {
  for (const [name, vp] of [['w800', { width: 800, height: 900 }], ['w320', { width: 320, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const ctx = await launch('desktop');
    await ctx.page.setViewport(vp);
    await boot(ctx, { settle: 3000 });
    const res = await ctx.page.evaluate(() => {
      const out = [];
      const vw = document.documentElement.clientWidth;
      const hdr = document.querySelector('#top-app-header');
      if (hdr) {
        const r = hdr.getBoundingClientRect();
        out.push({ el: '#top-app-header', scrollW: hdr.scrollWidth, clientW: hdr.clientWidth, rectW: Math.round(r.width), vw });
        for (const child of hdr.querySelectorAll('*')) {
          const cr = child.getBoundingClientRect();
          const cs = getComputedStyle(child);
          if (cs.display === 'none') continue;
          if (cr.right > vw + 2) out.push({ el: child.tagName + '.' + (child.className || '').toString().slice(0, 40) + '#' + (child.id || ''), right: Math.round(cr.right), w: Math.round(cr.width), txt: (child.innerText || '').slice(0, 25) });
        }
      }
      const ac = document.querySelector('#app-container');
      if (ac) out.push({ el: '#app-container', scrollW: ac.scrollWidth, clientW: ac.clientWidth });
      return out.slice(0, 30);
    });
    console.log(`=== ${name} (${vp.width}px) ===`);
    console.log(JSON.stringify(res, null, 1));
    await ctx.browser.close();
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
