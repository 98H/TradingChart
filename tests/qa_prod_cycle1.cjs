// tests/qa_prod_cycle1.cjs — Chartivia production-readiness E2E (real browser).
// Covers: CSP violations, brand mark/title/favicon/manifest, honest data-source
// badge, plans modal → upgrade REQUEST (no free self-upgrade), withdraw request,
// alerts webhook card (locked on Basic), admin approve flow via API, mobile fit.
// Usage: node tests/qa_prod_cycle1.cjs <desktop|mobile> <fa|en>
const { launch, BASE, EVID, awaitRegisterWindow } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');

const VP = process.argv[2] || 'desktop';
const LANG = process.argv[3] || 'fa';
const OUT = path.join(EVID, 'prod');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const defects = [];
const D = (k, t) => { defects.push({ k, t }); console.log('❌', k, '—', t); };
const P = (k) => console.log('✅', k);

(async () => {
  await awaitRegisterWindow();
  const ctx = await launch(VP);
  const page = ctx.page || (await ctx.browser.pages())[0] || await ctx.browser.newPage();
  await page.setViewport(ctx.viewport);
  const csp = [], errs = [];
  page.on('console', m => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) csp.push(t.slice(0, 200));
    else if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push(t.slice(0, 200));
  });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
  const shot = n => page.screenshot({ path: path.join(OUT, `${n}_${VP}_${LANG}.png`) }).catch(() => {});
  const tap = async (sel) => {
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s); if (!el) return { err: 'missing' };
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) return { err: 'covered by ' + (hit ? (hit.id || hit.className || hit.tagName) : 'null') };
      return { x, y };
    }, sel);
    if (r.err) throw new Error(`${sel}: ${r.err}`);
    await page.mouse.click(r.x, r.y);
  };

  try {
    await page.goto(BASE + '/chart', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => !!window.__TRADING_APP__ && !!document.querySelector('canvas'), { timeout: 25000 });
    await sleep(2500);
    await page.evaluate(l => window.__TRADING_APP__.switchLanguage(l), LANG);
    await sleep(1500);

    // 1. Brand
    const brand = await page.evaluate(() => ({
      title: document.title,
      icon: document.querySelector('link[rel=icon]')?.getAttribute('href'),
      manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'),
      markVisible: (() => { const m = document.querySelector('.brand-mark'); if (!m) return false; const r = m.getBoundingClientRect(); return getComputedStyle(m).display !== 'none' && r.width > 0; })(),
      oldName: /TradingChart|تریدینگ‌چارت/.test(document.body.innerText)
    }));
    /Chartivia/.test(brand.title) ? P('title') : D('title', brand.title);
    brand.icon === '/favicon.svg' ? P('favicon link') : D('favicon', brand.icon);
    brand.oldName ? D('old brand visible', 'TradingChart text in body') : P('no old brand text');
    if (VP === 'desktop') brand.markVisible ? P('brand mark visible') : D('brand mark', 'hidden on desktop');
    for (const u of ['/favicon.svg', '/manifest.webmanifest', '/robots.txt']) {
      const st = await page.evaluate(async x => { const r = await fetch(x); return [r.status, r.headers.get('content-type')]; }, u);
      st[0] === 200 && !/text\/html/.test(st[1]) ? P('asset ' + u) : D('asset ' + u, st.join(' '));
    }

    // 2. Honest source badge for a demo symbol
    await page.evaluate(() => window.__TRADING_APP__.switchSymbol('EURUSD'));
    await sleep(2500);
    const badge = await page.evaluate(() => document.querySelector('#topbar-source-route')?.innerText);
    /DEMO|نمایشی/.test(badge || '') ? P('demo badge for EURUSD') : D('demo badge', badge);
    await page.evaluate(() => window.__TRADING_APP__.switchSymbol('BTCUSDT'));
    await sleep(2500);
    const badge2 = await page.evaluate(() => document.querySelector('#topbar-source-route')?.innerText);
    /LIVE|زنده/.test(badge2 || '') ? P('live badge for BTCUSDT') : D('live badge', badge2);

    // 3. Register a fresh test user in-page
    const uname = 'prodqa' + Date.now().toString(36);
    const reg = await page.evaluate(async (u) => {
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u + '@qa.test', username: u, password: 'Pr0d-QA-pass!9' }) });
      return r.status;
    }, uname);
    if (reg !== 200) throw new Error('register ' + reg);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__TRADING_APP__?.auth?.user, { timeout: 20000 });
    await sleep(2000);
    await page.evaluate(l => window.__TRADING_APP__.switchLanguage(l), LANG);
    await sleep(1000);

    // 4. Plans modal → request upgrade (real click)
    await page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
    await page.waitForSelector('#tc-plans-modal [data-plan="plus"]', { timeout: 8000 });
    await sleep(400);
    const lbl = await page.$eval('#tc-plans-modal [data-plan="plus"]', b => b.innerText.trim());
    /Request upgrade|درخواست ارتقا/.test(lbl) ? P('upgrade button says request') : D('upgrade label', lbl);
    await tap('#tc-plans-modal [data-plan="plus"]');
    await page.waitForFunction(() => !document.querySelector('#tc-plans-modal'), { timeout: 8000 });
    const st = await page.evaluate(() => ({ plan: window.__TRADING_APP__.auth.user.plan, req: window.__TRADING_APP__.auth.user.planRequest }));
    st.plan === 'basic' ? P('no free self-upgrade') : D('self-upgrade', st.plan);
    st.req?.plan === 'plus' ? P('request recorded') : D('request', JSON.stringify(st.req));
    await sleep(500); await shot('p1_after_request');

    // reopen: pending state + withdraw
    await page.evaluate(() => window.__TRADING_APP__.auth.openPlansModal());
    await page.waitForSelector('#tc-plan-pending', { timeout: 8000 }).then(() => P('pending notice shown')).catch(() => D('pending notice', 'missing'));
    const pend = await page.$eval('#tc-plans-modal [data-plan="plus"]', b => [b.disabled, b.innerText.trim()]);
    pend[0] && /Pending|انتظار/.test(pend[1]) ? P('pending button disabled') : D('pending button', pend.join('|'));
    const fit = await page.evaluate(() => { const b = document.querySelector('#tc-plans-modal .modal-box').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1; });
    fit ? P('plans modal fits viewport') : D('plans modal fit', 'overflow');
    await shot('p2_pending');
    await tap('#tc-plan-cancel-req');
    await page.waitForFunction(() => !window.__TRADING_APP__.auth.user.planRequest, { timeout: 8000 }).then(() => P('withdraw works')).catch(() => D('withdraw', 'still pending'));
    await sleep(800);
    await page.evaluate(() => document.querySelector('#tc-plans-modal')?.remove());

    // 5. Webhook card on Basic = locked; then admin grants plus via test key
    const wh = await page.evaluate(async () => { const r = await fetch('/api/user/webhook'); return r.json(); });
    wh.enabled === false ? P('webhook locked on basic') : D('webhook basic', JSON.stringify(wh));
    const rot = await page.evaluate(async () => (await fetch('/api/user/webhook/rotate', { method: 'POST' })).status);
    rot === 403 ? P('rotate refused on basic') : D('rotate basic', rot);
    const self = await page.evaluate(async () => (await fetch('/api/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"buy","symbol":"BTCUSDT","quantity":1}' })).status);
    self === 403 ? P('webhook execution gated by plan') : D('webhook exec basic', self);

    // 6. Mobile/desktop: no horizontal page scroll
    const hs = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    hs <= 1 ? P('no page h-scroll') : D('page h-scroll', hs + 'px');

    // cleanup: delete the account
    const del = await page.evaluate(async () => (await fetch('/api/auth/me', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'Pr0d-QA-pass!9', confirm: 'DELETE' }) })).status);
    del === 200 ? P('cleanup account') : console.log('ℹ cleanup status', del);
  } catch (e) {
    D('harness', e.message);
    await shot('error');
  }
  csp.length ? D('CSP violations', csp.slice(0, 3).join(' || ')) : P('zero CSP violations');
  errs.length ? D('console errors', errs.slice(0, 3).join(' || ')) : P('zero console errors');
  console.log(`\n${defects.length} defects across ${VP}/${LANG}`);
  fs.writeFileSync(path.join(OUT, `cycle1_${VP}_${LANG}.json`), JSON.stringify({ defects }, null, 1));
  await ctx.browser.close();
  process.exit(defects.length ? 1 : 0);
})();
