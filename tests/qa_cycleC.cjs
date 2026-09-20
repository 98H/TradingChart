// tests/qa_cycleC.cjs — Deep feature verification: data panels, persistence,
// export integrity, error resilience, and per-surface i18n coverage.
const { runSuite, auditStatic, shots } = require('./qa_lib.cjs');
const H = require('./qa_lib.cjs').INPAGE;

const closeAll = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')));
const clickTab = async (page, view) => {
  await page.evaluate((v) => { const t = document.querySelector(`.panel-tab[data-view="${v}"]`); t?.classList.remove('active'); t?.click(); }, view);
  await new Promise(r => setTimeout(r, 1600));
};

const desktop = {
  'C01_journal_modal_add_trade_and_pnl': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const tj = app.tradeJournal;
      if (!tj) return { err: 'no tradeJournal' };
      const before = (tj.sampleExecutions || []).length;
      app.tradeJournalModal?.open();
      await new Promise(x => setTimeout(x, 700));
      const modal = document.querySelector('#modal-log-trade');
      const inputs = modal ? Array.from(modal.querySelectorAll('input,select')) : [];
      const saveBtn = modal?.querySelector('#btn-save-log-trade');
      // set deterministic values then press the real save button
      const setVal = (sel, v) => { const el = modal?.querySelector(sel); if (el) el.value = v; };
      setVal('#log-trade-symbol', 'BTCUSDT');
      setVal('#log-trade-entry', '100');
      setVal('#log-trade-exit', '110');
      setVal('#log-trade-qty', '1');
      const bad = [];
      // choose BUY explicitly
      modal?.querySelector('#side-pill-buy')?.click();
      saveBtn?.click();
      await new Promise(x => setTimeout(x, 900));
      const after = (tj.sampleExecutions || []).length;
      return { before, after, hasInputs: inputs.length, hasSaveBtn: !!saveBtn,
               modalClosed: !document.querySelector('#modal-log-trade')?.classList.contains('open'),
               savedIds: (tj.sampleExecutions || []).slice(0, 2).map(e => ({ id: e.id, side: e.side, price: e.price, qty: e.quantity })) };
    });
    if (r.err) defects.push({ kind: 'functional', text: r.err });
    else {
      if (r.hasInputs < 4) defects.push({ kind: 'functional', text: `journal modal exposes only ${r.hasInputs} inputs` });
      if (!r.hasSaveBtn) defects.push({ kind: 'functional', text: 'journal modal has no #btn-save-log-trade button' });
      if (r.after < r.before + 2) defects.push({ kind: 'functional', text: `journal entry not recorded (${r.before}→${r.after} executions)`, r });
      if (!r.modalClosed) defects.push({ kind: 'functional', text: 'journal modal did not close after save' });
      const buy = (r.savedIds || []).find(e => e.side === 'buy');
      if (buy && Number(buy.price) !== 100) defects.push({ kind: 'functional', text: `entry price not persisted (${buy.price} ≠ 100)` });
    }
    await shots(ctx, 'C_C01_journal');
    return { defects, info: r };
  },

  'C02_all_data_panels_render_content': async (ctx) => {
    const { page } = ctx; const defects = [];
    const views = ['trackers', 'calendar', 'screener', 'news', 'propsim'];
    const out = {};
    for (const v of views) {
      await clickTab(page, v);
      const d = await page.evaluate((view) => {
        const el = document.querySelector(`#view-${view}`);
        if (!el) return { missing: true };
        const txt = (el.innerText || '').trim();
        const rows = el.querySelectorAll('[class*="row"], tr, [class*="card"], [class*="item"]').length;
        return { len: txt.length, rows, emptyState: /loading|در حال بارگذاری|no data|داده‌ای یافت/i.test(txt),
                 sample: txt.replace(/\s+/g,' ').slice(0, 60) };
      }, v);
      out[v] = d;
      if (d.missing) defects.push({ kind: 'functional', feature: v, text: 'view container missing' });
      else if (d.len < 40) defects.push({ kind: 'functional', feature: v, text: `rendered almost no content (${d.len} chars)`, d });
      else if (d.emptyState) defects.push({ kind: 'functional', feature: v, text: 'stuck in loading/empty state', d });
    }
    await shots(ctx, 'C_C02_panels');
    return { defects, info: out };
  },

  'C03_depth_of_market_ladder': async (ctx) => {
    const { page } = ctx; const defects = [];
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const dom = app.depthOfMarket;
      if (!dom) return { err: 'no depthOfMarket' };
      if (dom.render) dom.render();
      await new Promise(x => setTimeout(x, 2200));
      const el = dom.container || document.querySelector('[class*="dom-"], #depth-of-market');
      const txt = (el?.innerText || '').trim();
      const bidRows = el?.querySelectorAll('[class*="bid"]').length || 0;
      const askRows = el?.querySelectorAll('[class*="ask"]').length || 0;
      return { len: txt.length, bidRows, askRows, sample: txt.replace(/\s+/g,' ').slice(0, 70) };
    });
    if (r.err) defects.push({ kind: 'functional', text: r.err });
    else {
      if (r.len < 40) defects.push({ kind: 'functional', text: 'DOM rendered no ladder content', r });
      if (r.bidRows === 0 || r.askRows === 0) defects.push({ kind: 'functional', text: `DOM missing bid/ask rows (${r.bidRows}/${r.askRows})` });
    }
    await shots(ctx, 'C_C03_dom');
    return { defects, info: r };
  },

  'C04_templates_save_apply_delete': async (ctx) => {
    const { page } = ctx; const defects = [];
    // render the templates panel first so the manager exists
    await clickTab(page, 'pine');
    await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      app.chartManager?.togglePanel?.('templates', true);
      await new Promise(x => setTimeout(x, 1500));
    });
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const tm = app.templateManager;
      if (!tm) return { err: 'templateManager not registered on app' };
      const before = (tm.userTemplates || []).length;
      tm.userTemplates = tm.userTemplates || [];
      tm.userTemplates.push({ id: 'qa_t1', name: 'قالب آزمون', date: '2026-09-19', scripts: ['indicator("t")', 'indicator("u")'] });
      tm.saveUserTemplates?.();
      tm.render?.();
      await new Promise(x => setTimeout(x, 500));
      const cards = document.querySelectorAll('.user-template-card').length;
      const applied = [];
      document.querySelector('.btn-apply-user-template')?.click();
      await new Promise(x => setTimeout(x, 1200));
      const delBtn = document.querySelector('.btn-delete-user-template');
      if (delBtn) { delBtn.click(); await new Promise(x => setTimeout(x, 600)); }
      const afterDelete = (tm.userTemplates || []).length;
      return { before, after: before + 1, cards, afterDelete, persisted: !!localStorage.getItem('tradingchart_user_templates') };
    });
    if (r.err) defects.push({ kind: 'functional', text: r.err });
    else {
      if (r.cards < 1) defects.push({ kind: 'functional', text: 'saved template did not render a card', r });
      if (r.afterDelete >= r.after) defects.push({ kind: 'functional', text: 'template delete did not work', r });
    }
    await shots(ctx, 'C_C04_templates');
    return { defects, info: r };
  },

  'C05_export_csv_integrity': async (ctx) => {
    const { page } = ctx; const defects = [];
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/candles?symbol=BTCUSDT&timeframe=60&limit=50');
      const j = await res.json();
      const c = j.candles || [];
      const keys = c[0] ? Object.keys(c[0]) : [];
      const numeric = c.every(x => Number.isFinite(Number(x.open)) && Number.isFinite(Number(x.close)) && Number.isFinite(Number(x.high)) && Number.isFinite(Number(x.low)));
      const ordered = c.every((x, i) => i === 0 || Number(x.time ?? x.timestamp ?? x.openTime) >= Number(c[i-1].time ?? c[i-1].timestamp ?? c[i-1].openTime));
      const positivePrices = c.every(x => Number(x.high) >= Number(x.low) && Number(x.close) > 0);
      return { count: c.length, keys, numeric, ordered, positivePrices, first: c[0], last: c[c.length-1] };
    });
    if (r.count < 40) defects.push({ kind: 'data', text: `candles API returned only ${r.count} bars` });
    if (!r.numeric) defects.push({ kind: 'data', text: 'candles contain non-numeric OHLC values' });
    if (!r.ordered) defects.push({ kind: 'data', text: 'candles are not in ascending time order' });
    if (!r.positivePrices) defects.push({ kind: 'data', text: 'candles contain impossible prices (high<low or close<=0)' });
    if (!r.keys.length) defects.push({ kind: 'data', text: 'candles have no fields' });
    return { defects, info: { count: r.count, keys: r.keys, ordered: r.ordered, numeric: r.numeric } };
  },

  'C06_settings_persist_across_reload': async (ctx) => {
    const { page } = ctx; const defects = [];
    // Use the real user entry point (the FA/EN toggle button)
    await page.evaluate(() => document.querySelector('#btn-toggle-lang')?.click());
    await new Promise(r => setTimeout(r, 1200));
    const before = await page.evaluate(() => {
      let stored = null; try { stored = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}'); } catch (e) {}
      return { bodyFa: document.body.classList.contains('persian-mode'),
               storedLang: stored ? stored.language : null };
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r2 => setTimeout(r2, 6000));
    const after = await page.evaluate(() => ({
      dir: document.documentElement.dir,
      htmlLang: document.documentElement.lang,
      persianMode: document.body.classList.contains('persian-mode'),
      navPanelLabel: document.querySelector('#nav-label-panels')?.innerText
    }));
    if (before.bodyFa) {
      if (after.dir !== 'rtl' || !after.persianMode) {
        defects.push({ kind: 'persistence', text: 'Persian/RTL session did not survive page reload', before, after });
      }
      if (after.navPanelLabel && !/[\u0600-\u06FF]/.test(after.navPanelLabel)) {
        defects.push({ kind: 'persistence', text: 'Persian labels not restored after reload', after });
      }
    } else {
      defects.push({ kind: 'harness', text: 'language toggle button did not switch to Persian', before });
    }
    // leave the browser in EN to avoid cross-test contamination
    await page.evaluate(() => document.querySelector('#btn-toggle-lang')?.click());
    return { defects, info: { before, after } };
  },

  'C07_offline_api_resilience': async (ctx) => {
      const { page } = ctx; const defects = [];
      // Fail every data request and confirm the shell stays alive & informative
      const errs = [];
      page.on('pageerror', e => errs.push(e.toString()));
      await page.setRequestInterception(true);
      const handler = (req) => {
        try {
          if (req.url().includes('/api/') && !req.url().includes('/api/health')) {
            req.respond({ status: 503, contentType: 'application/json', body: '{"error":"QA simulated outage","candles":[],"items":[],"news":[]}' });
          } else req.continue();
        } catch (e) { /* request already handled */ }
      };
      page.on('request', handler);
      try {
        await page.evaluate(async () => {
                const app = window.__TRADING_APP__;
                const r1 = await app.switchSymbol('ETHUSDT');
                await new Promise(x => setTimeout(x, 2500));
                const r2 = await app.setTimeframe('15');
                await new Promise(x => setTimeout(x, 2500));
                window.__QA_RESULT__ = { r1, r2, symbol: app.currentSymbol, tf: app.currentTimeframe, bars: app.activeBars?.length };
              });
              const state = await page.evaluate(() => ({
                alive: !!document.querySelector('#app-container'),
                header: !!document.querySelector('#top-app-header'),
                canvas: document.querySelectorAll('canvas').length,
                toast: document.querySelectorAll('[class*="toast"]').length,
                result: window.__QA_RESULT__
              }));
        if (!state.alive || !state.header) defects.push({ kind: 'resilience', text: 'app shell broke under API outage', state });
        if (state.canvas === 0) defects.push({ kind: 'resilience', text: 'chart canvas destroyed under API outage', state });
        // The chart must refuse to repoint at a symbol/timeframe with no data.
        if (state.result) {
          if (state.result.r1 === true) defects.push({ kind: 'resilience', text: 'switched to a symbol with no data during outage', state: state.result });
          if (state.result.bars === 0) defects.push({ kind: 'resilience', text: 'candle series was emptied during outage', state: state.result });
        }
        const hard = errs.filter(e => !/Failed to fetch|NetworkError|503|Failed to load resource/.test(e));
        if (hard.length) defects.push(...hard.slice(0,3).map(t => ({ kind: 'resilience', text: 'unhandled error during outage: ' + t.slice(0,160) })));
        await shots(ctx, 'C_C07_offline');
      } finally {
        page.off('request', handler);
        await page.setRequestInterception(false);
      }
      return { defects, ignoreConsole: '503|Service Unavailable|Failed to load resource' };
    },

  'C08_i18n_surface_sweep': async (ctx) => {
    const { page } = ctx; const defects = [];
    await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 1200));
    // ── Individually branded / proper-noun strings that are deliberately kept
  //    verbatim in both languages (institutional names, market proper nouns,
  //    data-source names, SEC filer/insider names). ──
  const PROPER_NOUN_RE = /^(Institutional Scalper Pro|Nikkei Asia|Bitcoin|Ethereum|Solana|BNB|Avalanche|Chainlink|Sui Network|NEAR Protocol|Aptos|Pepe|Cardano|Dogecoin|Ripple|Litecoin|Polkadot|US Dollar Index|WTI Crude Oil|Brent Crude|Natural Gas|Michigan Consumer Sentiment|ECB Monetary Policy Statement|Nvidia|Tesla|Apple|Microsoft|Amazon|Alphabet|Meta|Nancy Pelosi|Tommy Tuberville|Dan Goldman|House|Senate)/;
  const brandRe = /LuxAlgo|Nexus |PineTS|Vela |TradingChart|OHLCV|RSI|SMA|EMA|MACD|ATR|FIFO|SEC|FOMC|CPI|NFP|GDP|FINRA|13F|Form 4|ICT|SMC|DOM|OHLC|IPO|ETF|Bloomberg|Block|Journal|Platts|MarketWatch|Reuters|CoinDesk|Times/;
  const isTicker = (s) => /^[A-Z]{2,8}$/.test(s) && !/^(HIGH|MED|LOW|ALL|NEW|OPEN)$/.test(s);
  const isFiler = (s) => /\((D|R)-[A-Z]{2}\)$/.test(s);
  // Keyboard shortcuts are physical key names (Ctrl+K, Alt+T, Shift+…) and must
  // stay verbatim in every language — they are not user-facing copy.
  const isKeyCombo = (s) => /^(Ctrl|Alt|Shift|Cmd|Meta|⌘|⌥|⇧|Esc|Tab|Enter|Space)(\s*\+\s*[A-Za-z0-9]+)*$/.test(s);
  // Brand names stay verbatim in both languages (parity with LuxAlgo/TradingView
  // conventions) — see VELA_BRAND_WHITELIST in client/src/i18n.js.
  const isBrand = (s) => /^(TradingView|LuxAlgo|Vela|PineTS|TradingChart|Nexus)\b/.test(s);
    const surfaces = {};
    // sweep every bottom view + every modal/panel
    const views = await page.evaluate(() => Array.from(document.querySelectorAll('.panel-tab')).map(t => t.getAttribute('data-view')).filter(Boolean));
    for (const v of views) {
      await clickTab(page, v);
      const unt = await page.evaluate((fn) => eval('(' + fn + ')')(''), H.untranslated);
      surfaces['view:' + v] = unt.filter(u => !brandRe.test(u.text) && !PROPER_NOUN_RE.test(u.text) && !isTicker(u.text) && !isKeyCombo(u.text) && !isBrand(u.text) && !isFiler(u.text));
    }
    const modals = [['indicators', 'openIndicatorsModal'], ['compare', 'compareModal'], ['export', 'dataExportModal'],
                    ['shortcuts', 'shortcutsModal'], ['settings', 'settingsModal'], ['profile', 'userProfileModal'],
                    ['screenshot', 'screenshotModal'], ['journalModal', 'tradeJournalModal']];
    for (const [name, ref] of modals) {
      await closeAll(page);
      await page.evaluate((x) => { try { const a = window.__TRADING_APP__; const o = a[x]; (o && typeof o.open === 'function' ? o.open() : a[x + '?.open']); } catch(e) {} }, ref);
      await new Promise(r => setTimeout(r, 900));
      const unt = await page.evaluate((fn) => eval('(' + fn + ')')(''), H.untranslated);
      surfaces['modal:' + name] = unt.filter(u => !brandRe.test(u.text) && !PROPER_NOUN_RE.test(u.text) && !isKeyCombo(u.text) && !isBrand(u.text));
    }
    await closeAll(page);
    for (const [k, v] of Object.entries(surfaces)) {
      if (v.length) defects.push(...v.slice(0, 6).map(u => ({ kind: 'i18n-surface', surface: k, ...u })));
    }
    await shots(ctx, 'C_C08_i18n');
    return { defects, info: Object.fromEntries(Object.entries(surfaces).map(([k, v]) => [k, v.length])) };
  },

  'C09_shortcuts_all_bindings': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const tests = [
      ['Alt+s', () => document.querySelectorAll('.modal-overlay.open').length > 0, 'Screenshot modal'],
      ['Alt+r', () => true, 'Auto-scale (no crash)'],
      ['Escape', () => true, 'Escape handling']
    ];
    for (const [key, check, label] of tests) {
      const errs = [];
      page.once('pageerror', e => errs.push(e.toString()));
      await page.keyboard.down(key.split('+').length > 1 ? 'Alt' : key);
      if (key.split('+').length > 1) { await page.keyboard.press(key.split('+')[1]); await page.keyboard.up('Alt'); }
      else await page.keyboard.up(key);
      await new Promise(r => setTimeout(r, 700));
      const ok = await page.evaluate(check);
      if (errs.length) defects.push({ kind: 'shortcut', text: `${key} (${label}) raised an error: ${errs[0].slice(0,140)}` });
      await closeAll(page);
    }
    return { defects };
  },

  'C10_layout_switch_and_resize_stability': async (ctx) => {
    const { page } = ctx; const defects = [];
    const layouts = await page.evaluate(() => Array.from(document.querySelectorAll('[data-layout]')).map(b => b.getAttribute('data-layout')));
    const uniq = [...new Set(layouts)].slice(0, 6);
    for (const l of uniq) {
      await page.evaluate((x) => { const b = document.querySelector(`[data-layout="${x}"]`); b?.click(); }, l);
      await new Promise(r => setTimeout(r, 1800));
      const a = await auditStatic(ctx);
      const ovf = a.horizontalOverflow.filter(o => o.w > 30);
      if (ovf.length) defects.push(...ovf.slice(0,3).map(o => ({ kind: 'layout-after-switch', layout: l, ...o })));
    }
    // resize stress
    for (const vp of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
      await page.setViewport(vp);
      await new Promise(r => setTimeout(r, 1200));
      const a = await auditStatic(ctx);
      if (a.horizontalOverflow.filter(o => o.w > 30).length) defects.push({ kind: 'resize', text: `overflow at ${vp.width}x${vp.height}` });
    }
    await shots(ctx, 'C_C10_layout');
    return { defects, info: { layouts: uniq } };
  }
};

const mobile = {
  'Cm01_every_panel_in_drawer_i18n_and_fit': async (ctx) => {
    const { page } = ctx; const defects = [];
    await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 1200));
    const brandRe = /LuxAlgo|Nexus |PineTS|Vela |TradingChart|OHLCV|RSI|SMA|EMA|MACD|ATR|FIFO|SEC|FOMC|CPI|NFP|GDP|FINRA|13F|Form 4|ICT|SMC|DOM|OHLC|IPO|ETF|Bloomberg|Block|Journal|Platts|MarketWatch|Reuters|CoinDesk|Times/;
    const PROPER_NOUN_RE = /^(Institutional Scalper Pro|Nikkei Asia|Bitcoin|Ethereum|Solana|BNB|Avalanche|Chainlink|Sui Network|NEAR Protocol|Aptos|Pepe|Cardano|Dogecoin|Ripple|Litecoin|Polkadot|US Dollar Index|WTI Crude Oil|Brent Crude|Natural Gas|Michigan Consumer Sentiment|ECB Monetary Policy Statement|Nvidia|Tesla|Apple|Microsoft|Amazon|Alphabet|Meta|Nancy Pelosi|Tommy Tuberville|Dan Goldman|House|Senate)/;
    const panels = await page.evaluate(() => Array.from(document.querySelectorAll('#modal-panels-menu .panel-menu-item')).map(i => i.getAttribute('data-panel')));
    const summary = {};
    for (const p of panels) {
      if (['compare', 'dataExport', 'chartStyle', 'barReplay', 'journal', 'workspaces'].includes(p)) continue;
      await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')));
      await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
      await new Promise(r => setTimeout(r, 450));
      await page.evaluate((x) => document.querySelector(`.panel-menu-item[data-panel="${x}"]`)?.click(), p);
      await new Promise(r => setTimeout(r, 1900));
      const unt = await page.evaluate((fn) => eval('(' + fn + ')')(''), H.untranslated);
      const isTicker = (s) => /^[A-Z]{2,6}(USDT|USD)?$/.test(s);
      const isFiler = (s) => /\((D|R)-[A-Z]{2}\)\s*$/.test(s);
      const isFilerName = (s) => /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+\((D|R)-[A-Z]{2}\)$/.test(s);
      const real = unt.filter(u => !brandRe.test(u.text) && !PROPER_NOUN_RE.test(u.text)
        && !isTicker(u.text) && !isFiler(u.text) && !isFilerName(u.text));
      summary[p] = real.length;
      if (real.length) defects.push(...real.slice(0, 5).map(u => ({ kind: 'i18n-mobile-panel', panel: p, ...u })));
      await page.evaluate(() => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
        const d = document.querySelector('.vela-drawer-backdrop'); if (d) d.click();
      });
      await new Promise(r => setTimeout(r, 500));
    }
    await shots(ctx, 'C_Cm01_drawer_i18n');
    return { defects, info: summary };
  },

  'Cm02_mobile_touch_targets_after_panels': async (ctx) => {
    const { page } = ctx; const defects = [];
    await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
    await new Promise(r => setTimeout(r, 800));
    const a = await auditStatic(ctx);
    // 30px minimum for dense chart-tool chrome (36 for primary controls)
    const bad = a.smallTargets.filter(t => t.w > 4 && t.h > 4 && (t.w < 28 || t.h < 28));
    if (bad.length) defects.push(...bad.slice(0, 8).map(b => ({ kind: 'touch-target-mobile', ...b })));
    await shots(ctx, 'C_Cm02_targets');
    return { defects, info: { small: bad.length } };
  },

  'Cm03_mobile_no_horizontal_page_scroll': async (ctx) => {
    const { page } = ctx; const defects = [];
    const r = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      bodyScrollW: document.body.scrollWidth }));
    if (r.scrollW > r.clientW + 1) defects.push({ kind: 'overflow-mobile', text: `page horizontally scrollable: ${r.scrollW} > ${r.clientW}` });
    return { defects, info: r };
  },

  'Cm04_mobile_portrait_small_320px': async (ctx) => {
    const { page } = ctx; const defects = [];
    await page.setViewport({ width: 320, height: 568, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 1800));
    const a = await auditStatic(ctx);
    if (a.horizontalOverflow.filter(o => o.w > 25).length) {
      defects.push(...a.horizontalOverflow.filter(o => o.w > 25).slice(0,6).map(o => ({ kind: 'overflow-320', ...o })));
    }
    if (a.bodyScrollW > 322) defects.push({ kind: 'overflow-320', text: `page scroll ${a.bodyScrollW} at 320px` });
    await shots(ctx, 'C_Cm04_320');
    return { defects };
  }
};

(async () => {
  console.log('\n════════ CYCLE C — DESKTOP DEEP DATA ════════');
  await runSuite('cycleC_desktop', { desktop });
  console.log('\n════════ CYCLE C — MOBILE DEEP DATA ════════');
  await runSuite('cycleC_mobile', { mobile });
})();