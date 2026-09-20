// tests/qa_cycleD.cjs — Cycle D: remaining surfaces, accessibility, stress,
// tablet breakpoint, and adversarial input.
const { runSuite, auditStatic, shots, INPAGE } = require('./qa_lib.cjs');

const closeAll = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')));
const clickTab = async (page, view) => {
  await page.evaluate((v) => document.querySelector(`.panel-tab[data-view="${v}"]`)?.click(), view);
  await new Promise(r => setTimeout(r, 900));
};

const T = {
  // ─ Alerts manager lifecycle ──────────────────────────────────────────────
  'D01_alerts_create_and_remove': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const am = app.alertsManager;
      const before = am?.alerts?.length ?? -1;
      // addAlert(targetPrice, condition) — the real signature the UI uses
      const id = am?.addAlert?.(999999);
      await new Promise(x => setTimeout(x, 800));
      const after = am?.alerts?.length ?? -1;
      const added = (am?.alerts || []).some(a => a.id === id);
      // remove through the REAL delete button the user clicks
      const btn = document.querySelector(`.delete-alert-btn[data-id="${id}"]`);
      if (btn) btn.click();
      await new Promise(x => setTimeout(x, 600));
      const final = am?.alerts?.length ?? -1;
      return { before, after, final, added, id, hadApi: !!am?.addAlert, hadBtn: !!btn };
    });
    if (!r.hadApi) defects.push({ kind: 'functional', text: 'alertsManager exposes no create API', r });
    else if (r.after !== r.before + 1 || !r.added) defects.push({ kind: 'functional', text: 'alert was not added', r });
    else if (!r.hadBtn) defects.push({ kind: 'functional', text: 'no delete button rendered for the new alert', r });
    else if (r.final !== r.before) defects.push({ kind: 'functional', text: 'alert was not removed via its Delete button', r });
    return { defects };
  },

  // ─ Drawing toolbar: every drawing tool must activate cleanly ─────────────
  'D02_drawing_tools_all_activate': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    // The floating drawing toolbar is created lazily on first use
    await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      try { app.floatingDrawingToolbar?.show?.() || app.floatingDrawingToolbar?.mount?.(); } catch (e) { /* noop */ }
      app.floatingDrawingToolbar?.el?.style && (app.floatingDrawingToolbar.el.style.display = 'flex');
    });
    await new Promise(r => setTimeout(r, 900));
    const r = await page.evaluate(async () => {
      const out = [];
      const btns = Array.from(document.querySelectorAll('.fav-tool-btn[data-tool], #floating-drawing-toolbar [data-tool]'));
      for (const b of btns) {
        const name = b.getAttribute('data-tool');
        try {
          b.click();
          await new Promise(x => setTimeout(x, 140));
          out.push({ name, active: b.classList.contains('active'), ok: true });
        } catch (e) { out.push({ name, ok: false, err: String(e).slice(0, 80) }); }
      }
      return out;
    });
    if (r.length === 0) defects.push({ kind: 'functional', text: 'no drawing tool buttons found in DOM' });
    const failed = r.filter(x => !x.ok);
    const notActive = r.filter(x => x.ok && !x.active);
    if (failed.length) defects.push(...failed.map(f => ({ kind: 'functional', text: 'drawing tool threw: ' + f.name + ' :: ' + f.err })));
    if (notActive.length) defects.push({ kind: 'functional', text: `${notActive.length} drawing tool(s) did not become active`, names: notActive.map(n => n.name) });
    return { defects };
  },

  // ── Compare overlay: add + remove a symbol ───────────────────────────────
  'D03_compare_add_remove': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const cm = app.compareModal;
      if (!cm) return { noApi: true };
      const open = typeof cm.open === 'function';
      try { cm.open?.(); } catch (e) { return { err: String(e).slice(0, 120) }; }
      await new Promise(x => setTimeout(x, 900));
      const visible = !!document.querySelector('#modal-compare')?.classList.contains('open') || !!document.querySelector('[id*="compare"].open');
      cm.close?.();
      return { open, visible };
    });
    if (r.noApi) defects.push({ kind: 'functional', text: 'compareModal not instantiated' });
    else if (r.err) defects.push({ kind: 'functional', text: 'compareModal.open threw: ' + r.err });
    else if (!r.visible) defects.push({ kind: 'functional', text: 'compareModal did not become visible' });
    return { defects };
  },

  // ── Watchlist: add + remove a symbol, and it must render ────────────────
  'D04_watchlist_add_remove': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const wl = app.watchlist;
      if (!wl) return { noApi: true };
      const before = (wl.customSymbols || []).length;
      const target = 'XRPUSDT';
      wl.addSymbol(target);
      await new Promise(x => setTimeout(x, 900));
      const mid = (wl.customSymbols || []).length;
      const has = (wl.customSymbols || []).includes('XRPUSDT');
      wl.removeSymbol(target);
      await new Promise(x => setTimeout(x, 900));
      const after = (wl.customSymbols || []).length;
      const rows = document.querySelectorAll('#watchlist-body tr, .watchlist-row, .wl-row').length;
      return { before, mid, after, has, rows, api: { add: !!wl.addSymbol, rm: !!wl.removeSymbol } };
    });
    if (r.noApi) defects.push({ kind: 'functional', text: 'watchlist not instantiated' });
    else {
      if (!r.api.add || !r.api.rm) defects.push({ kind: 'functional', text: 'watchlist missing add/remove API', r });
      else if (r.mid !== r.before + 1) defects.push({ kind: 'functional', text: 'watchlist add did not register', r });
      else if (!r.has) defects.push({ kind: 'functional', text: 'added symbol not present in list', r });
      else if (r.after !== r.before) defects.push({ kind: 'functional', text: 'watchlist remove did not register', r });
    }
    return { defects };
  },

  // ── Screenshot + export modals must open without error ──────────────────
  'D05_utility_modals_open': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const out = {};
      for (const [name, ref] of [['screenshot', 'screenshotModal'], ['export', 'dataExportModal'],
                                 ['shortcuts', 'shortcutsModal'], ['timeframe', 'timeframeManager'],
                                 ['indicatorSettings', 'indicatorSettingsModal'], ['layout', 'layoutManager']]) {
        const m = app[ref];
        try {
          if (!m) { out[name] = 'missing'; continue; }
          (m.open || m.show)?.call(m);
          await new Promise(x => setTimeout(x, 350));
          out[name] = 'ok';
          (m.close || m.hide)?.call(m);
          await new Promise(x => setTimeout(x, 250));
        } catch (e) { out[name] = 'threw: ' + String(e).slice(0, 80); }
      }
      return out;
    });
    for (const [k, v] of Object.entries(r)) {
      if (v !== 'ok') defects.push({ kind: 'functional', text: `modal "${k}" → ${v}` });
    }
    return { defects };
  },

  // ── Accessibility: interactive elements must be labelled ────────────────
  'D06_accessibility_labels': async (ctx) => {
    const { page } = ctx; const defects = [];
    const r = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('button, [role="button"], a[href]').forEach(el => {
        if (!el.offsetParent && el.offsetWidth === 0) return;   // hidden
        const txt = (el.textContent || '').trim();
        const hasLabel = txt || el.getAttribute('aria-label') || el.getAttribute('title') ||
                         el.querySelector('img[alt]:not([alt=""])') || el.querySelector('svg title');
        if (!hasLabel) bad.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), id: el.id });
      });
      const imgsNoAlt = Array.from(document.querySelectorAll('img')).filter(i => !i.hasAttribute('alt')).length;
      const htmlLang = document.documentElement.lang;
      return { bad: bad.slice(0, 12), count: bad.length, imgsNoAlt, htmlLang };
    });
    if (r.count) defects.push(...r.bad.map(b => ({ kind: 'a11y', text: `unlabelled control <${b.tag}> #${b.id} .${b.cls}` })));
    if (r.imgsNoAlt) defects.push({ kind: 'a11y', text: `${r.imgsNoAlt} <img> element(s) without alt attribute` });
    if (!r.htmlLang) defects.push({ kind: 'a11y', text: 'document has no lang attribute' });
    return { defects };
  },

  // ─ Adversarial input: nonsense symbol must not corrupt the chart ───────
  'D07_invalid_symbol_input': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const before = app.currentSymbol;
      const barsBefore = app.activeBars?.length || 0;
      // nonsense + injection-flavoured inputs
      for (const bad of ['ZZZZNOPE', '<script>alert(1)</script>', "' OR 1=1--", '        ']) {
        await app.switchSymbol(bad);
        await new Promise(x => setTimeout(x, 900));
      }
      return { before, after: app.currentSymbol, barsBefore, barsAfter: app.activeBars?.length || 0,
               alive: !!document.querySelector('#app-container'), canvas: document.querySelectorAll('canvas').length };
    });
    if (!r.alive || r.canvas === 0) defects.push({ kind: 'robustness', text: 'chart broke after invalid symbol input', r });
    if (r.barsAfter === 0) defects.push({ kind: 'robustness', text: 'candle series emptied by invalid symbol input', r });
    if (r.after !== r.before) defects.push({ kind: 'robustness', text: `invalid symbol was accepted (${r.before} → ${r.after})`, r });
    // This test deliberately requests unknown markets, so the server's 404 is the
    // DESIRED response — it must not be reported as a console defect.
    return { defects, ignoreConsole: '404|Failed to load resource' };
  },

  // ─ Rapid interaction stress: no console errors, UI stays consistent ────
  'D08_rapid_interaction_stress': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      for (let i = 0; i < 14; i++) {
        document.querySelectorAll('.panel-tab')[i % document.querySelectorAll('.panel-tab').length]?.click();
        (app.indicatorsModal?.open || app.indicatorsModal?.show)?.call(app.indicatorsModal);
        document.querySelector('#modal-indicators .modal-close, #modal-indicators [data-close]')?.click();
        await new Promise(x => setTimeout(x, 90));
      }
      // hammer the language toggle too
      for (let i = 0; i < 6; i++) { await window.__TRADING_APP__.switchLanguage(i % 2 ? 'fa' : 'en'); await new Promise(x => setTimeout(x, 120)); }
      await window.__TRADING_APP__.switchLanguage('en');
      return { alive: !!document.querySelector('#app-container'), canvases: document.querySelectorAll('canvas').length,
               openModals: document.querySelectorAll('.modal-overlay.open').length };
    });
    if (!r.alive || r.canvases === 0) defects.push({ kind: 'stress', text: 'app broke under rapid interaction', r });
    return { defects };
  },

  // ─ Tablet breakpoint (768x1024) must not overflow or clip ─────────────
  'D09_tablet_breakpoint_fit': async (ctx) => {
    const { page, browser } = ctx; const defects = [];
    await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 2500));
    const ov = await page.evaluate((fn) => eval('(' + fn + ')')(''), INPAGE.horizontalOverflow);
    if (ov.length) defects.push(...ov.slice(0, 6).map(o => ({ kind: 'overflow-tablet', ...o })));
    const geo = await page.evaluate(() => ({
      header: !!document.querySelector('#top-app-header'),
      chart: document.querySelectorAll('canvas').length,
      scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }));
    if (!geo.header || geo.chart === 0) defects.push({ kind: 'layout-tablet', text: 'header or chart missing at 768px', geo });
    if (geo.scrollX) defects.push({ kind: 'layout-tablet', text: 'page scrolls horizontally at 768px', geo });
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 1500));
    return { defects };
  },

  // ── Long-text resilience in watchlist / news (no clipping) ─────────────
  'D10_long_text_no_clip': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const r = await page.evaluate(async () => {
      // Inject an absurdly long label into a live list item and confirm layout survives
      const host = document.querySelector('#watchlist-body') || document.querySelector('.vela-panel-watchlist .vela-panel-body');
      if (!host) return { noHost: true };
      const probe = document.createElement('div');
      probe.id = 'qa-long-text-probe';
      probe.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;';
      const span = document.createElement('span');
      span.textContent = 'SUPERCALIFRAGILISTICEXPIALIDOCIOUS_EXTREMELY_LONG_INSTRUMENT_NAME_'.repeat(3);
      probe.appendChild(span);
      host.prepend(probe);
      await new Promise(x => setTimeout(x, 400));
      const rect = span.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      probe.remove();
      return { spanW: Math.round(rect.width), hostW: Math.round(hostRect.width), docOverflow };
    });
    if (r.noHost) defects.push({ kind: 'harness', text: 'watchlist host not found for long-text probe' });
    else if (r.docOverflow) defects.push({ kind: 'overflow', text: 'very long text causes page-level horizontal scroll', r });
    else if (r.spanW > r.hostW + 4) defects.push({ kind: 'overflow', text: 'long text overflows its host without clipping', r });
    return { defects };
  }
};

(async () => {
  console.log('\n════════ CYCLE D — DESKTOP (1440x900) ════════');
  await runSuite('cycleD_desktop', { desktop: T });
  console.log('\n════════ CYCLE D — MOBILE (390x844) ════════');
  await runSuite('cycleD_mobile', { mobile: T });
  process.exit(0);
})();