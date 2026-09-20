// qa_probe_e04_e05.cjs — targeted probes for the remaining cycleE2 findings
const { launch, boot } = require('./qa_lib.cjs');
const settle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await launch('desktop');
  await boot(ctx);

  // E04: how are timeframes really represented in the DOM?
  const tfs = await ctx.page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button,[data-tf],[data-timeframe],.tf-btn,.vela-tf,[class*="timeframe"]')) {
      const t = (el.innerText || '').trim();
      if (!t || t.length > 8) continue;
      if (/^(1m|3m|5m|15m|30m|45m|1h|2h|4h|1D|1W|1M|D|W|M)$/i.test(t)) {
        out.push({ t, tag: el.tagName, cls: (el.className||'').toString().slice(0,30), dt: el.dataset.tf || el.dataset.timeframe || null, visible: el.offsetParent !== null });
      }
    }
    return out;
  });
  console.log('TF buttons:', JSON.stringify(tfs.slice(0, 25)));

  // E05: try the symbol switch for real and watch currentSymbol
  await ctx.page.evaluate(() => window.__TRADING_APP__?.openSymbolSearch?.());
  await settle(600);
  const modalOpen = await ctx.page.evaluate(() => document.querySelector('#modal-symbol-search')?.classList.contains('open') || false);
  const inp = await ctx.page.evaluate(() => {
    const i = document.querySelector('#symbol-search-input');
    if (i) { i.focus(); return true; } return false;
  });
  console.log('modalOpen:', modalOpen, 'inputFocused:', inp);
  if (inp) {
    await ctx.page.keyboard.type('ETHUSDT', { delay: 30 });
    await settle(1000);
    const results = await ctx.page.evaluate(() => {
      const rows = [...document.querySelectorAll('#modal-symbol-search [data-symbol], #modal-symbol-search .sym-row, #modal-symbol-search li, #modal-symbol-search button')].slice(0, 8);
      return rows.map(r => (r.innerText || r.dataset.symbol || '').replace(/\s+/g, ' ').slice(0, 40));
    });
    console.log('search results:', JSON.stringify(results));
    await ctx.page.keyboard.press('Enter');
    await settle(2500);
    const after = await ctx.page.evaluate(() => ({ sym: window.__TRADING_APP__?.currentSymbol, title: document.title.slice(0, 50) }));
    console.log('after Enter:', JSON.stringify(after));
  }

  // E12-320: real 320px header state on a FRESH page
  await ctx.page.setViewport({ width: 320, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded' });
  await ctx.page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
  await settle(2500);
  const w320 = await ctx.page.evaluate(() => {
    const hdr = document.querySelector('#top-app-header');
    const nl = document.querySelector('.top-nav-left');
    const r = el => el ? { scrollW: el.scrollWidth, clientW: el.clientWidth, rectW: Math.round(el.getBoundingClientRect().width) } : null;
    return { header: r(hdr), navLeft: r(nl), vw: innerWidth,
      children: nl ? [...nl.children].map(c => ({ cls: (c.className||'').toString().slice(0,30), w: Math.round(c.getBoundingClientRect().width), disp: getComputedStyle(c).display })) : [] };
  });
  console.log('w320:', JSON.stringify(w320, null, 1));
  await ctx.browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
