// tests/qa_diag13.cjs — why aren't screener instrument names localized?
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  // open the screener view
  await page.evaluate(() => document.querySelector('.panel-tab[data-view="screener"]')?.click());
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 3000));
  const out = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#screener-tbody tr'));
    const probe = [];
    for (const tr of rows.slice(0, 4)) {
      const divs = Array.from(tr.querySelectorAll('div, span'));
      for (const d of divs) {
        const t = (d.textContent || '').trim();
        if (/^(Shiba Inu|Bittensor|Render|Bitcoin|Ethereum)$/.test(t)) {
          probe.push({
            text: t,
            tag: d.tagName, cls: d.className,
            ownTextNodes: Array.from(d.childNodes).filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()),
            hasChildEls: d.children.length,
            parentCls: d.parentElement?.className,
            ancestorCls: (() => { const c = []; let p = d.parentElement; while (p && c.length < 5) { c.push(p.tagName + '.' + p.className); p = p.parentElement; } return c; })()
          });
        }
      }
    }
    return { rows: rows.length, probe, localizedSpans: document.querySelectorAll('span.vela-localized').length };
  });
  console.log(JSON.stringify(out, null, 2).slice(0, 3000));
  await ctx.browser.close();
})();