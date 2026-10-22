// tests/qa_landing.cjs — Chartivia landing page E2E (real browser, real clicks).
// Usage: node tests/qa_landing.cjs <desktop|mobile> <fa|en>
const { launch, BASE, EVID } = require('./qa_lib.cjs');
const fs = require('fs'); const path = require('path');
const VP = process.argv[2] || 'desktop'; const LANG = process.argv[3] || 'fa';
const OUT = path.join(EVID, 'landing'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const defects = []; const D = (k, t) => { defects.push({ k, t }); console.log('❌', k, '—', t); }; const P = k => console.log('✅', k);

(async () => {
  const ctx = await launch(VP);
  const page = ctx.page;
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 200)));
  const shot = n => page.screenshot({ path: path.join(OUT, `${n}_${VP}_${LANG}.png`), fullPage: n.endsWith('full') }).catch(() => {});
  const tap = async (sel) => {
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s); if (!el) return { err: 'missing' };
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) return { err: 'covered by ' + (hit ? (hit.className || hit.tagName) : 'null') };
      return { x, y };
    }, sel);
    if (r.err) throw new Error(`${sel}: ${r.err}`);
    await sleep(250); await page.mouse.click(r.x, r.y);
  };
  try {
    await page.goto(`${BASE}/${LANG === 'en' ? '?lang=en' : ''}`, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll('#plans .plan').length > 0, { timeout: 15000 }).then(() => P('pricing loaded from API')).catch(() => D('pricing', 'no plans rendered'));
    const st = await page.evaluate(() => {
      const r = {};
      r.lang = document.documentElement.lang; r.dir = document.documentElement.dir;
      r.hscroll = document.documentElement.scrollWidth - innerWidth;
      r.plans = document.querySelectorAll('#plans .plan').length;
      r.h1 = document.querySelector('h1').textContent.trim();
      r.fa = /[\u0600-\u06FF]/.test(document.querySelector('h1').textContent);
      // text escaping its box
      r.clipped = [...document.querySelectorAll('h1,h2,h3,p,a.btn,.price,li,summary')].filter(e => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').map(e => e.textContent.trim().slice(0, 40)).slice(0, 5);
      r.offscreen = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1) && !e.closest('svg'); }).map(e => (e.className || e.tagName).toString().slice(0, 30)).slice(0, 5);
      r.small = innerWidth < 500 ? [...document.querySelectorAll('a,button,summary')].filter(e => { const b = e.getBoundingClientRect(); return e.getClientRects().length && b.width > 0 && (b.height < 40 || b.width < 40) && !e.classList.contains('skip') && !e.closest('.copy'); }).map(e => `${(e.textContent || '').trim().slice(0, 20)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`).slice(0, 6) : [];
      r.badText = /\bundefined\b|\bNaN\b|\[object|\bnull\b/.test(document.body.innerText);
      r.prices = [...document.querySelectorAll('#plans .price')].map(e => e.textContent.trim());
      return r;
    });
    st.lang === LANG ? P('lang ' + LANG) : D('lang', st.lang);
    st.dir === (LANG === 'fa' ? 'rtl' : 'ltr') ? P('dir') : D('dir', st.dir);
    (LANG === 'fa') === st.fa ? P('hero localized') : D('hero lang', st.h1);
    st.hscroll <= 1 ? P('no h-scroll') : D('h-scroll', st.hscroll);
    st.clipped.length ? D('clipped text', st.clipped.join(' | ')) : P('no clipped text');
    st.offscreen.length ? D('offscreen', st.offscreen.join(' | ')) : P('nothing offscreen');
    st.small.length ? D('small targets', st.small.join(' | ')) : P('touch targets ok');
    st.badText ? D('bad text', 'undefined/NaN') : P('no bad text');
    console.log('ℹ prices', st.prices.join(' · '));
    await shot('l1_top'); await shot('l2_full');

    // yearly toggle changes prices
    await tap('.cyc[data-cycle="y"]'); await sleep(300);
    const yp = await page.$$eval('#plans .price', els => els.map(e => e.textContent.trim()));
    yp.join() !== st.prices.join() ? P('yearly toggle updates prices') : D('yearly toggle', 'unchanged');

    // FAQ opens
    await tap('#faq details summary'); await sleep(200);
    (await page.$eval('#faq details', d => d.open)) ? P('faq expands') : D('faq', 'did not open');

    // language toggle round trip
    await tap('#lang-toggle'); await sleep(400);
    const l2 = await page.evaluate(() => [document.documentElement.lang, document.querySelector('h1').textContent.trim()]);
    l2[0] !== LANG ? P('lang toggle switches') : D('lang toggle', l2.join(' '));
    await tap('#lang-toggle'); await sleep(400);
    const l3 = await page.evaluate(() => [document.documentElement.lang, document.querySelector('h1').textContent.trim()]);
    l3[0] === LANG && l3[1] === st.h1 ? P('lang round trip lossless') : D('lang round trip', l3.join(' '));

    // nav anchor (desktop)
    if (VP === 'desktop') {
      await page.evaluate(() => scrollTo(0, 0)); await sleep(300);
      await tap('.links a[href="#pricing"]'); await sleep(900);
      const top = await page.$eval('#pricing', e => Math.round(e.getBoundingClientRect().top));
      top < 140 ? P('nav anchor scrolls') : D('nav anchor', top);
    }

    // CTA → /chart opens the app, in the same language
    await page.evaluate(() => scrollTo(0, 0)); await sleep(300);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }), tap('.hero-actions .btn-primary')]);
    new URL(page.url()).pathname === '/chart' ? P('CTA → /chart') : D('CTA', page.url());
    await page.waitForFunction(() => !!window.__TRADING_APP__ && !!document.querySelector('canvas'), { timeout: 30000 }).then(() => P('chart app boots')).catch(() => D('chart', 'did not boot'));
    await sleep(2500);
    const cl = await page.evaluate(() => document.documentElement.lang);
    cl === LANG ? P('language carried into app') : D('language carry', cl);
    // brand mark goes home
    const href = await page.evaluate(() => document.querySelector('.brand-mark')?.getAttribute('href'));
    href === '/' ? P('brand mark links home') : D('brand mark href', href);
    // deep link
    await page.goto(`${BASE}/chart?symbol=BINANCE:ETHUSDT&interval=240`, { waitUntil: 'domcontentloaded' });
    // Assert on what the user SEES: the active chart cell, not app bookkeeping.
    await page.waitForFunction(() => /ETHUSDT$/.test(window.__TRADING_APP__?.chartManager?.workspace?.active?.symbol || ''), { timeout: 20000 }).then(() => P('deep link symbol on chart')).catch(async () => D('deep link', await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.symbol)));
    const tf = await page.evaluate(() => window.__TRADING_APP__?.chartManager?.workspace?.active?.timeframe);
    String(tf) === '240' ? P('deep link interval on chart') : D('deep link interval', tf);
    await sleep(2500); await shot('l3_deeplink');
  } catch (e) { D('harness', e.message); await shot('error'); }
  const real = errs.filter(e => !/Failed to load resource/.test(e));
  real.length ? D('console errors', real.slice(0, 3).join(' || ')) : P('zero console errors');
  console.log(`\n${defects.length} defects across ${VP}/${LANG}`);
  await ctx.browser.close(); process.exit(defects.length ? 1 : 0);
})();
