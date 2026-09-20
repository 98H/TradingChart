// tests/qa_diag7.cjs — open the data window, then test auto-localization directly
const { launch, boot } = require('./qa_lib.cjs');
(async () => {
  const ctx = await launch('desktop');
  const { page } = ctx;
  await boot(ctx);
  // open data window via the desktop side rail
  await page.evaluate(() => document.querySelector('#desktop-side-rail .rail-btn[data-panel="dataWindow"]')?.click());
  await new Promise(r => setTimeout(r, 2500));
  const before = await page.evaluate(() => {
    const l = Array.from(document.querySelectorAll('.vela-dw-label')).map(e => e.textContent.trim());
    return { count: l.length, labels: l.slice(0, 12) };
  });
  console.log('before switch:', JSON.stringify(before));
  await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
  await new Promise(r => setTimeout(r, 3000));
  const after = await page.evaluate(() => ({
    labels: Array.from(document.querySelectorAll('.vela-dw-label')).map(e => e.textContent.trim()),
    groups: Array.from(document.querySelectorAll('.vela-dw-group')).map(e => e.textContent.trim()),
    localizedSpans: document.querySelectorAll('span.vela-localized').length,
    dwParentChain: (() => { const el = document.querySelector('.vela-dw-label'); if (!el) return null; const c = []; let p = el; while (p && c.length < 8) { c.push(p.tagName + '.' + (p.className || '').toString().slice(0, 30)); p = p.parentElement; } return c; })()
  }));
  console.log('after switch:', JSON.stringify(after, null, 2));
  await ctx.browser.close();
})();