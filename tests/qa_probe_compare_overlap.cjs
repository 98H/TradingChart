// qa_probe_compare_overlap.cjs — reproduce E06 compare-modal overlap exactly
const { launch, boot } = require('./qa_lib.cjs');
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);
  await ctx.page.evaluate(() => window.__TRADING_APP__?.switchLanguage('fa'));
  await settle(1500);

  // mimic E06 roam: click rail buttons one by one until "مقایسه"
  const railButtons = await ctx.page.evaluate(() =>
    [...document.querySelectorAll('header button, [class*="toolbar"] > button, [class*="rail"] button, .panel-tab')]
      .filter(el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width >= 3; })
      .map(el => (el.innerText || el.title || el.getAttribute('aria-label') || el.id || el.className).toString().trim().replace(/\s+/g, ' ').slice(0, 30))
  );
  console.log('rail buttons seen:', JSON.stringify([...new Set(railButtons)].slice(0, 40)));

  // click مقایسه exactly as the roam does
  await ctx.page.evaluate(() => {
    for (const el of document.querySelectorAll('header button, [class*="toolbar"] > button, [class*="rail"] button, .panel-tab')) {
      const t = (el.innerText || el.title || el.getAttribute('aria-label') || el.id || el.className).toString().trim().replace(/\s+/g, ' ').slice(0, 30);
      if (t === 'مقایسه') { el.click(); return; }
    }
  });
  await settle(1200);
  const st = await ctx.page.evaluate(() => {
    const els = [...document.querySelectorAll('.panel-tab, .rail-btn, header button, .modal-box button')].filter(el => {
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 4 && r.height > 4;
    });
    const bad = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 6 && oy > 6 && (ox * oy) / Math.min(a.width * a.height, b.width * b.height) > 0.35) {
        bad.push({ a: (els[i].innerText || els[i].className).toString().slice(0, 30), b: (els[j].innerText || els[j].className).toString().slice(0, 30), ar: [Math.round(a.x), Math.round(a.y), Math.round(a.width), Math.round(a.height)], br: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] });
      }
    }
    // where is the مقایسه element now?
    const cmp = [...document.querySelectorAll('button')].find(e => (e.innerText||'').trim() === 'مقایسه');
    const cmpRect = cmp ? (() => { const r = cmp.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() : null;
    const cmpVisible = cmp ? cmp.offsetParent !== null : null;
    return { overlaps: bad.slice(0, 5), cmpRect, cmpVisible, modalOpen: !!document.querySelector('.modal-overlay.open, .modal-box:not([style*="display: none"])') };
  });
  console.log(JSON.stringify(st, null, 1));
  await ctx.page.screenshot({ path: 'screenshots/qa_cycles/probe_compare_exact.png' });
  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
