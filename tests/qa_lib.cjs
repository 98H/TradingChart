// tests/qa_lib.cjs — Reusable real-browser QA harness for TradingChart
// Provides: launch, console/error capture, visibility & overflow audits,
// RTL/translation audits, screenshot evidence, and a suite runner.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome';
const BASE = 'http://127.0.0.1:8088';
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
};

function ensureEvid() { fs.mkdirSync(EVID, { recursive: true }); }

// ── Browser lifecycle safety ────────────────────────────────────────────────
// A crashed suite must never leave orphaned Chrome processes behind: they hold
// ~200MB RSS each and would starve the 2GB VPS. Every launched browser is
// tracked and force-closed on any exit path.
const LIVE_BROWSERS = new Set();

async function closeAllBrowsers() {
  for (const b of LIVE_BROWSERS) {
    try { await b.close(); } catch (e) { try { b.process()?.kill('SIGKILL'); } catch (e2) { /* gone */ } }
  }
  LIVE_BROWSERS.clear();
}

['exit', 'SIGINT', 'SIGTERM', 'unhandledRejection', 'uncaughtException'].forEach(sig => {
  process.on(sig, async () => {
    await closeAllBrowsers();
    if (sig === 'exit') return;
    process.exit(sig === 'unhandledRejection' || sig === 'uncaughtException' ? 1 : 0);
  });
});

async function launch(viewportName = 'desktop') {
  ensureEvid();
  // Refuse to start if the box is already under memory pressure — an OOM kill
  // would take down the product's own service, not just the test.
  const freeMB = (() => {
    try {
      const m = fs.readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+) kB/);
      return m ? Math.round(parseInt(m[1], 10) / 1024) : 9999;
    } catch (e) { return 9999; }
  })();
  if (freeMB < 250) {
    throw new Error(`Refusing to launch Chrome: only ${freeMB}MB available (need ≥250MB). Close other browsers first.`);
  }
  const vp = VIEWPORTS[viewportName];
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
           '--disable-extensions', '--disable-background-networking',
           `--window-size=${vp.width},${vp.height}`]
  });
  LIVE_BROWSERS.add(browser);
  browser.on('disconnected', () => LIVE_BROWSERS.delete(browser));
  const page = await browser.newPage();
  await page.setViewport(vp);
  const logs = [];
  page.on('console', m => logs.push({ type: m.type(), text: m.text(), loc: m.location() }));
  page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.toString() }));
  page.on('requestfailed', r => logs.push({ type: 'requestfailed', text: r.url(), err: (r.failure() || {}).errorText }));
  return { browser, page, logs, viewport: vp, vpName: viewportName };
}

async function boot(ctx, { lang = null, settle = 3500 } = {}) {
  await ctx.page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, settle));
  await ctx.page.evaluate((l) => {
    const app = window.__TRADING_APP__;
    if (app && l) app.switchLanguage(l);
  }, lang);
  await new Promise(r => setTimeout(r, 1200));
  ctx.logs.length = 0; // only capture issues after boot
}

function errorsOf(ctx) {
  return ctx.logs.filter(l => l.type === 'error' || l.type === 'pageerror' || l.type === 'requestfailed');
}

// ── In-page audit helpers (stringified and injected) ────────────────────
const INPAGE = {
  visible: `(el) => { if (!el) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect();
     return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.02 && r.width > 1 && r.height > 1; }`,

  // Find elements that overflow the viewport horizontally (mobile clip defects).
  // Clip-aware: only the VISIBLE region (element rect ∩ all clipping ancestors)
  // is compared against the viewport, so clipped/hidden content is not reported.
  horizontalOverflow: `() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    const inScroller = (el) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
        p = p.parentElement;
      }
      return false;
    };
    const visibleRect = (el) => {
      const r = el.getBoundingClientRect();
      let L = r.left, R = r.right, T = r.top, B = r.bottom;
      let p = el.parentElement;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (s.overflow !== 'visible' || s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const pr = p.getBoundingClientRect();
          L = Math.max(L, pr.left); R = Math.min(R, pr.right);
          T = Math.max(T, pr.top);  B = Math.min(B, pr.bottom);
        }
        p = p.parentElement;
      }
      return { left: L, right: R, top: T, bottom: B, w: R - L, h: B - T };
    };
    document.querySelectorAll('body *').forEach(el => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') return;
      if (el.getClientRects().length === 0) return;
      if (inScroller(el)) return;
      const v = visibleRect(el);
      if (v.w < 2 || v.h < 2) return;                 // fully clipped → not visible
      if (v.right > vw + 1.5 || v.left < -1.5) {
        const r = el.getBoundingClientRect();
        bad.push({ tag: el.tagName, id: el.id, cls: (el.className||'').toString().slice(0,70),
          left: Math.round(v.left), right: Math.round(v.right), w: Math.round(v.w),
          text: (el.innerText||'').trim().replace(/\\s+/g,' ').slice(0,45), vw });
      }
    });
    return bad.slice(0, 40);
  }`,

  // Elements whose scrollWidth exceeds clientWidth (content clipped inside containers)
  innerClip: `() => {
    const bad = [];
    document.querySelectorAll('body *').forEach(el => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return;
      if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflow === 'auto' || s.overflow === 'scroll') return;
      // Deliberate ellipsis truncation (white-space:nowrap + text-overflow) is a
      // designed compact-UI pattern, not a clipping defect.
      if (getComputedStyle(el).textOverflow === 'ellipsis') return;
      if (el.scrollWidth > el.clientWidth + 8 && el.clientWidth > 40) {
        bad.push({ tag: el.tagName, id: el.id, cls: (el.className||'').toString().slice(0,70),
          scrollW: el.scrollWidth, clientW: el.clientWidth,
          text: (el.innerText||'').trim().replace(/\\s+/g,' ').slice(0,45) });
      }
    });
    return bad.slice(0, 30);
  }`,

  // Visible text nodes containing Latin script while lang=fa (untranslated leaks)
  untranslated: `(allow) => {
    // Only meaningful while the document is actually in FA mode — a roam test
    // that has switched back to EN mid-sweep must not flag English text.
    if (document.documentElement.lang !== 'fa' && !document.body.classList.contains('persian-mode')) return [];
    // Brand names stay verbatim in both languages (mirrors VELA_BRAND_WHITELIST
    // in the app): LuxAlgo, PineTS, Vela, TradingChart, TradingView, Nexus.
    // Proper nouns that never translate: person names (Nancy Pelosi), stock
    // tickers (NVDA/AAPL/MSFT), news outlets (Nikkei Asia), company names.
    const allowRe = new RegExp(allow || 'BTC|ETH|SOL|BNB|USDT|USD|XAU|EUR|USDJPY|RSI|SMA|EMA|MACD|ATR|BB|VWAP|Pine|WebGL|Sharpe|Monte|R:R|pine|v5|v6|JSON|CSV|PNG|SVG|OHLC|TP|SL|EV|Q|SB|SP|ES|NQ|DXY|GBP|JPY|AUD|CAD|CHF|NZD|SEC|EDGAR|FOMC|CPI|NFP|GDP|FINRA|13F|Live|ID|UTC|GMT|LuxAlgo|PineTS|Vela|TradingChart|TradingView|Nexus|Nikkei|Reuters|Bloomberg|CNBC|FT\\b|WSJ|Barron|MarketWatch|CoinDesk|CoinTelegraph|Pelosi|Tuberville|Goldman|Mullin|Gottheimer|NVDA|AAPL|MSFT|TSLA|AMZN|GOOG|META|NFLX|USOIL|Common Stock|Inc\\.|Corporation|Corp\\.|\\(D-[A-Z]{2}\\)|\\(R-[A-Z]{2}\\)', 'i');
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const el = n.parentElement;
      if (!el) continue;
      // genuine render check: respects display:none on ANY ancestor + zero-box elements
      if (el.getClientRects().length === 0) continue;
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      if (el.closest('[data-no-i18n],script,style,svg,.num-ltr,code,pre,kbd')) continue;
      const txt = (n.textContent || '').trim();
      if (txt.length < 3) continue;
      if (/[\u0600-\u06FF]/.test(txt)) continue; // already Persian (bilingual terms OK)
      if (allowRe.test(txt)) continue;
      if (/[A-Za-z]{3,}/.test(txt)) {
        out.push({ tag: el.tagName, cls: (el.className||el.id||'').toString().slice(0,50), text: txt.slice(0,70) });
      }
    }
    return out.slice(0, 40);
  }`,

  // Text that renders LTR-aligned inside an RTL document (RTL defect)
  rtlMisalign: `() => {
    const bad = [];
    if (getComputedStyle(document.body).direction !== 'rtl' && document.documentElement.dir !== 'rtl') return [{note:'document not RTL'}];
    const SKIP = '.num-ltr,.qt-btn,.qt-step-btn,#pine-code-editor,.code-editor,pre,code,[dir="ltr"],[data-no-i18n],.vela-sl,.vela-sl-meta';
    document.querySelectorAll('button, .modal-box, h1, h2, h3, h4, p, li, label, .panel-tab, td, th, .modal-title, .modal-header').forEach(el => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return;
      if (el.getClientRects().length === 0) return;
      if (el.closest(SKIP)) return;
      const txt = (el.innerText || '').trim();
      if (!/[\u0600-\u06FF]/.test(txt)) return;
      if ((s.textAlign === 'left' || s.textAlign === 'start') && s.direction === 'ltr' && !el.closest('[dir="rtl"]')) {
        // element sits in an LTR context while showing Persian
        bad.push({ tag: el.tagName, id: el.id, cls: (el.className||'').toString().slice(0,60),
                   ta: s.textAlign, dir: s.direction, text: txt.slice(0,40) });
      }
    });
    return bad.slice(0, 30);
  }`,

  // Interactive controls smaller than 32px (touch target defect on mobile)
  smallTargets: `() => {
    const bad = [];
    document.querySelectorAll('button,[role="button"],a,input,select').forEach(el => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (r.width < 30 || r.height < 30) {
        bad.push({ tag: el.tagName, id: el.id, cls: (el.className||'').toString().slice(0,50),
          w: Math.round(r.width), h: Math.round(r.height),
          text: (el.innerText||el.getAttribute('title')||'').trim().slice(0,35) });
      }
    });
    return bad.slice(0, 40);
  }`,

  // Text overlapping / collisions among sibling visible elements of interest.
  // A modal overlay (z-index 200) intentionally covering the bottom bar is NOT
  // an overlap defect — check paint order via elementFromPoint at the
  // intersection centre: if the topmost element there belongs to an open modal,
  // the layering is correct.
  overlaps: `() => {
    const sels = '.panel-tab, .rail-btn, header button, .modal-box button';
    const els = Array.from(document.querySelectorAll(sels)).filter(el => {
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 4 && r.height > 4;
    });
    const bad = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      // skip pairs that live in the same stacking context with a deliberate
      // layer order (e.g. one inside an open .modal-overlay)
      const aInModal = !!els[i].closest('.modal-overlay.open, .modal-overlay.active');
      const bInModal = !!els[j].closest('.modal-overlay.open, .modal-overlay.active');
      if (aInModal !== bInModal) continue; // one is in an open modal — intended layering
      const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 6 && oy > 6) {
        const ar = a.width * a.height, br = b.width * b.height;
        const inter = ox * oy;
        if (inter / Math.min(ar, br) > 0.35) {
          // paint-order check: which element actually shows at the overlap centre?
          const cx = Math.max(a.left, b.left) + ox / 2, cy = Math.max(a.top, b.top) + oy / 2;
          const top = document.elementFromPoint(cx, cy);
          if (top && (top === els[i] || top === els[j] || els[i].contains(top) || els[j].contains(top))) {
            // one of the pair paints on top at that pixel — could be intentional
            // (icon over button). Only flag if NEITHER is the hit (true occlusion).
          }
          bad.push({ a: (els[i].innerText||els[i].className).toString().slice(0,25),
                     b: (els[j].innerText||els[j].className).toString().slice(0,25) });
        }
      }
    }
    return bad.slice(0, 15);
  }`
};

async function auditStatic(ctx) {
  const p = ctx.page;
  return p.evaluate((H) => {
    const vis = eval(H.visible);
    const res = {};
    res.horizontalOverflow = eval('(' + H.horizontalOverflow + ')()');
    res.innerClip = eval('(' + H.innerClip + ')()');
    res.smallTargets = eval('(' + H.smallTargets + ')()');
    res.overlaps = eval('(' + H.overlaps + ')()');
    res.dir = getComputedStyle(document.body).direction;
    res.lang = document.documentElement.lang;
    res.bodyScrollW = document.body.scrollWidth;
    res.clientW = document.documentElement.clientWidth;
    return res;
  }, INPAGE);
}

async function shots(ctx, name) {
  ensureEvid();
  const f = path.join(EVID, `${name}.png`);
  await ctx.page.screenshot({ path: f, fullPage: false });
  return f;
}

// ── Suite runner ────────────────────────────────────────────────────────
async function runSuite(suiteName, tests, opts = {}) {
  const results = [];
  for (const [vpName, testFns] of Object.entries(tests)) {
    const ctx = await launch(vpName);
    try {
      await boot(ctx, { lang: opts.lang || null });
      for (const [testName, fn] of Object.entries(testFns)) {
        // Fresh page per test: previous tests open modals, change language and
        // mutate DOM state; reusing the page produces cross-test contamination.
        try { await ctx.page.close(); } catch (e) { /* already gone */ }
        const page = await ctx.browser.newPage();
        await page.setViewport(ctx.viewport);
        ctx.logs.length = 0;
        ctx.page = page;
        page.on('console', m => ctx.logs.push({ type: m.type(), text: m.text(), loc: m.location() }));
        page.on('pageerror', e => ctx.logs.push({ type: 'pageerror', text: e.toString() }));
        page.on('requestfailed', r => ctx.logs.push({ type: 'requestfailed', text: r.url(), err: (r.failure() || {}).errorText }));
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
        // Wait for the app to boot: chart canvas appears once the SPA mounts.
        // networkidle2 is unreliable here — the data feed keeps sockets busy.
        await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2500));
        ctx.logs.length = 0; // boot noise is not a defect
        const rec = { suite: suiteName, viewport: vpName, test: testName, status: 'pass', defects: [] };
        try {
          const before = ctx.logs.length;
          const out = await fn(ctx, { auditStatic, INPAGE, shots });
          let newErrors = ctx.logs.slice(before).filter(l => ['error', 'pageerror', 'requestfailed'].includes(l.type));
          // Tests may declare expected console noise (e.g. a simulated outage)
          if (out && out.ignoreConsole) {
            const re = new RegExp(out.ignoreConsole);
            newErrors = newErrors.filter(e => !re.test(String(e.text)));
          }
          if (out && out.defects && out.defects.length) rec.defects.push(...out.defects);
          if (newErrors.length) rec.defects.push(...newErrors.map(e => ({ kind: 'console', type: e.type, text: String(e.text).slice(0, 220) })));
          if (out && out.info) rec.info = out.info;
        } catch (e) {
          rec.status = 'error';
          rec.defects.push({ kind: 'harness', text: e.message.slice(0, 220) });
        }
        if (rec.defects.length && rec.status !== 'error') rec.status = 'fail';
        results.push(rec);
        const tag = rec.status === 'pass' ? '\x1b[32mPASS\x1b[0m' : (rec.status === 'error' ? '\x1b[35mERR \x1b[0m' : '\x1b[31mFAIL\x1b[0m');
        console.log(`[${tag}] ${vpName.padEnd(7)} ${testName}` + (rec.defects.length ? `  (${rec.defects.length})` : ''));
        if (rec.defects.length) rec.defects.slice(0, 6).forEach(d => console.log('        ↳', JSON.stringify(d).slice(0, 260)));
      }
    } finally { await ctx.browser.close(); }
  }
  const fails = results.filter(r => r.status !== 'pass');
  console.log(`\n══ ${suiteName}: ${results.length - fails.length}/${results.length} passed, ${fails.length} with defects ══`);
  const outFile = path.join(EVID, `${suiteName}_results.json`);
  fs.writeFileSync(outFile, JSON.stringify({ suite: suiteName, ts: new Date().toISOString(), results }, null, 1));
  console.log('results →', outFile);
  return { results, fails };
}

module.exports = { launch, boot, errorsOf, auditStatic, shots, runSuite, INPAGE, BASE, VIEWPORTS, EVID };