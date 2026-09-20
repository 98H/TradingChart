// tests/qa_diag4.cjs — find the landscape-overflowing SVG
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('mobile');
  const { page } = ctx;
  await boot(ctx);
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 2000));
  const o = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    document.querySelectorAll('svg, path, g, rect, line, polyline, polygon, circle, text').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 2) return;
      if (r.right > vw + 1.5 || r.left < -1.5) {
        // climb to the SVG root for context
        const svg = el.closest('svg');
        const host = svg?.parentElement;
        out.push({ tag: el.tagName, w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right),
          svgParent: host ? (host.className||'').toString().slice(0,60) + '#' + host.id : null,
          svgVB: svg?.getAttribute('viewBox'), svgW: svg?.getAttribute('width'), svgStyle: svg ? getComputedStyle(svg).cssText.slice(0,0) : null,
          svgOverflow: svg ? getComputedStyle(svg).overflow : null,
          svgRect: svg ? { w: Math.round(svg.getBoundingClientRect().width), right: Math.round(svg.getBoundingClientRect().right) } : null });
      }
    });
    return out.slice(0, 20);
  });
  console.log(JSON.stringify(o, null, 1));
  await ctx.browser.close();
})();