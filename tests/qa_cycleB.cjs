// tests/qa_cycleB.cjs — Deep interaction & edge-case dogfooding (real clicks, forms, stress)
const { runSuite, auditStatic, shots } = require('./qa_lib.cjs');
const H = require('./qa_lib.cjs').INPAGE;

async function box(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
  }, sel);
}
function fit(name, b, vp) {
  const d = [];
  if (!b) { d.push({ kind: 'functional', feature: name, text: 'not found' }); return d; }
  if (b.left < -1) d.push({ kind: 'layout', feature: name, text: `overflows left ${Math.round(-b.left)}px` });
  if (b.right > vp.width + 1) d.push({ kind: 'layout', feature: name, text: `overflows right ${Math.round(b.right - vp.width)}px` });
  if (b.bottom > vp.height + 1) d.push({ kind: 'layout', feature: name, text: `overflows bottom ${Math.round(b.bottom - vp.height)}px` });
  if (b.top < -1) d.push({ kind: 'layout', feature: name, text: `overflows top ${Math.round(-b.top)}px` });
  return d;
}
const closeAll = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')));

const desktop = {
  'B01_paper_trading_order_flow': async (ctx) => {
    const { page } = ctx; const defects = [];
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const pt = app.paperTrading;
      if (!pt) return { err: 'no paperTrading' };
      const before = pt.positions?.length ?? 0;
      const eq0 = pt.calculateEquity();
      pt.setMarket('BTCUSDT', pt.currentPrice || 80000);
      pt.executeOrder({ symbol: 'BTCUSDT', side: 'buy', type: 'market', qty: 0.1 });
      await new Promise(x => setTimeout(x, 600));
      const after = pt.positions?.length ?? 0;
      const eq1 = pt.calculateEquity();
      return { before, after, eq0, eq1, capital: pt.capital, pos: pt.positions?.slice(0,1) };
    });
    if (r.err) defects.push({ kind: 'functional', text: r.err });
    if (r.after <= r.before) defects.push({ kind: 'functional', text: `order did not create a position (${r.before}→${r.after})`, r });
    if (r.eq1 === undefined || Number.isNaN(r.eq1)) defects.push({ kind: 'functional', text: 'equity not calculable', r });
    await shots(ctx, 'B_B01_paper');
    return { defects, info: r };
  },

  'B02_alerts_create': async (ctx) => {
    const { page } = ctx; const defects = [];
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const am = app.alertsManager;
      if (!am) return { err: 'no alertsManager' };
      const before = (am.alerts || []).length;
      am.alerts = am.alerts || [];
      am.alerts.push({ id: 'qa1', symbol: app.currentSymbol, condition: 'crosses_above', price: 1, active: true });
      am.render();
      await new Promise(x => setTimeout(x, 500));
      const after = am.alerts.length;
      return { before, after, rows: document.querySelectorAll('.alerts-list [class*="row"], #alerts-panel-body [class*="row"]').length };
    });
    if (r.err) defects.push({ kind: 'functional', text: r.err });
    else if (r.after <= r.before) defects.push({ kind: 'functional', text: 'alert was not added' });
    await shots(ctx, 'B_B02_alerts');
    return { defects, info: r };
  },

  'B03_indicator_settings_persistence': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    await page.evaluate(() => window.__TRADING_APP__.openIndicatorsModal());
    await new Promise(r => setTimeout(r, 800));
    // click first indicator's add button
    const add = await page.evaluate(() => {
      const b = document.querySelector('#modal-indicators .add-ind-btn');
      if (b) { b.click(); return { clicked: true, id: b.getAttribute('data-id') }; }
      return { clicked: false };
    });
    await new Promise(r => setTimeout(r, 2500));
    const active = await page.evaluate(() => {
      const c = window.__TRADING_APP__.chartManager;
      return { activeAlt: c?.workspace?.model?.()?.meta?.(), legend: document.querySelectorAll('[class*="vela-sl"]').length };
    });
    if (!add.clicked) defects.push({ kind: 'functional', text: 'no Add button in indicators modal' });
    await shots(ctx, 'B_B03_indicator_add');
    return { defects, info: { add, active } };
  },

  'B04_chart_style_all_types': async (ctx) => {
    const { page } = ctx; const defects = [];
    for (const style of ['candles', 'bars', 'line', 'area', 'baseline', 'heikinashi']) {
      await closeAll(page);
      const r = await page.evaluate(async (s) => {
        const cs = window.__TRADING_APP__.chartStylePicker;
        if (!cs) return { err: 'no picker' };
        await cs.applyStyle?.(s) ?? cs.select?.(s);
        await new Promise(x => setTimeout(x, 900));
        return { style: s, ok: true };
      }, style);
      if (r.err) { defects.push({ kind: 'functional', text: 'chartStylePicker missing applyStyle/select' }); break; }
    }
    await shots(ctx, 'B_B04_styles');
    return { defects };
  },

  'B05_timeframe_matrix': async (ctx) => {
    const { page } = ctx; const defects = [];
    const tfs = ['1', '5', '15', '60', '240', 'D', 'W'];
    const out = [];
    for (const tf of tfs) {
      const r = await page.evaluate(async (x) => {
        const app = window.__TRADING_APP__;
        app.setTimeframe(x);
        await new Promise(z => setTimeout(z, 1800));
        return { tf: x, bars: app.activeBars?.length, cur: app.currentTimeframe };
      }, tf);
      out.push(r);
      if (!r.bars || r.bars < 50) defects.push({ kind: 'functional', feature: 'tf:' + tf, text: `only ${r.bars} bars loaded` });
    }
    return { defects, info: out };
  },

  'B06_header_shortcuts_and_keyboard': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    // '/' opens indicators
    await page.keyboard.press('Slash');
    await new Promise(r => setTimeout(r, 900));
    const indOpen = await page.evaluate(() => document.querySelector('#modal-indicators')?.classList.contains('open'));
    if (!indOpen) defects.push({ kind: 'functional', text: "'/' shortcut did not open indicators modal" });
    await closeAll(page);
    // Escape closes
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));
    return { defects, info: { indOpen } };
  },

  'B07_drawings_and_context_menu_actions': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    const r = await page.evaluate(async () => {
      const c = document.querySelector('canvas');
      const rect = c.getBoundingClientRect();
      c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 }));
      await new Promise(x => setTimeout(x, 700));
      const menu = document.querySelector('#canvas-context-menu, .canvas-context-menu');
      const items = Array.from(menu?.querySelectorAll('button,li,[class*="item"]') || []);
      const labels = items.map(i => (i.innerText||'').trim()).filter(Boolean);
      return { count: items.length, labels };
    });
    if (r.count < 4) defects.push({ kind: 'functional', text: `context menu has only ${r.count} items`, r });
    await shots(ctx, 'B_B07_ctxmenu');
    await page.keyboard.press('Escape');
    return { defects, info: r };
  },

  'B08_layout_manager_studio': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    await page.evaluate(() => window.__TRADING_APP__.layoutManager?.openLayoutStudio?.());
    await new Promise(r => setTimeout(r, 1200));
    const r = await page.evaluate(() => {
      const m = document.querySelector('#modal-layout-studio, .layout-studio-modal')?.closest('.modal-overlay') || document.querySelector('.modal-overlay.open');
      const grid = document.querySelectorAll('.layout-grid-btn, [data-layout]').length;
      const b = document.querySelector('.layout-studio-modal')?.getBoundingClientRect();
      return { open: !!m, layouts: grid, box: b ? { l: b.left, r: b.right, w: b.width, h: b.height, t: b.top, bot: b.bottom } : null };
    });
    defects.push(...fit('layout-studio', r.box, ctx.viewport));
    if (!r.open) defects.push({ kind: 'functional', text: 'layout studio did not open' });
    await shots(ctx, 'B_B08_layout');
    await closeAll(page);
    return { defects, info: r };
  },

  'B09_screenshot_modal': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    await page.evaluate(() => window.__TRADING_APP__.screenshotModal?.open?.());
    await new Promise(r => setTimeout(r, 1600));
    const r = await page.evaluate(() => {
      const m = document.querySelector('#modal-screenshot') || document.querySelector('.modal-overlay.open');
      const imgs = m?.querySelectorAll('canvas, img').length || 0;
      return { found: !!m, imgs, id: m?.id };
    });
    if (!r.found) defects.push({ kind: 'functional', text: 'screenshot modal did not open' });
    else if (r.imgs === 0) defects.push({ kind: 'functional', text: 'screenshot modal has no preview canvas' });
    await shots(ctx, 'B_B09_screenshot');
    await closeAll(page);
    return { defects, info: r };
  },

  'B10_watchlist_symbol_switch': async (ctx) => {
    const { page } = ctx; const defects = [];
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const before = app.currentSymbol;
      await app.switchSymbol('SOLUSDT');
      await new Promise(x => setTimeout(x, 2500));
      return { before, after: app.currentSymbol, bars: app.activeBars?.length };
    });
    if (r.after !== 'SOLUSDT') defects.push({ kind: 'functional', text: `symbol switch failed (${r.after})` });
    if (!r.bars || r.bars < 50) defects.push({ kind: 'functional', text: `no candles after symbol switch (${r.bars})` });
    return { defects, info: r };
  },

  'B11_bottom_panel_stress_all_tabs_twice': async (ctx) => {
    const { page } = ctx; const defects = [];
    const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.panel-tab')).map(t => t.getAttribute('data-view')).filter(Boolean));
    for (let pass = 0; pass < 2; pass++) {
      for (const v of tabs) {
        await page.evaluate((x) => document.querySelector(`.panel-tab[data-view="${x}"]`)?.click(), v);
        await new Promise(r => setTimeout(r, 700));
      }
    }
    const a = await auditStatic(ctx);
    if (a.overlaps.length) defects.push(...a.overlaps.map(o => ({ kind: 'overlap-after-stress', ...o })));
    if (a.horizontalOverflow.length) defects.push(...a.horizontalOverflow.map(o => ({ kind: 'overflow-after-stress', ...o })));
    return { defects };
  },

  'B12_rapid_language_toggle_lossless': async (ctx) => {
    const { page } = ctx; const defects = [];
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const snap = () => {
        const t = document.body.innerText;
        return { len: t.length, persian: (t.match(/[\u0600-\u06FF]/g) || []).length };
      };
      app.switchLanguage('en'); await new Promise(x => setTimeout(x, 700));
      const en1 = snap();
      app.switchLanguage('fa'); await new Promise(x => setTimeout(x, 900));
      const fa1 = snap();
      app.switchLanguage('en'); await new Promise(x => setTimeout(x, 700));
      const en2 = snap();
      app.switchLanguage('fa'); await new Promise(x => setTimeout(x, 900));
      const fa2 = snap();
      return { en1, fa1, en2, fa2 };
    });
    // English must contain (almost) no Persian after switching back
    if (r.en2.persian > 3) defects.push({ kind: 'i18n-lossy', text: `EN still has ${r.en2.persian} Persian chars after toggle back`, r });
    if (r.fa2.persian < 50) defects.push({ kind: 'i18n', text: `FA has too little Persian: ${r.fa2.persian}` });
    return { defects, info: r };
  }
};

const mobile = {
  'Bm01_paper_trade_mobile_flow': async (ctx) => {
    const { page } = ctx; const defects = [];
    // open trade panel through the mobile drawer
    await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
    await new Promise(r => setTimeout(r, 700));
    await page.evaluate(() => document.querySelector('.panel-menu-item[data-panel="paper"]')?.click());
    await new Promise(r => setTimeout(r, 2200));
    const r = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      const openId = app.chartManager?.openPanelId;
      // the trade panel can live in a dock panel or a slide-in drawer
      const panel = document.querySelector('.vela-panel-paper') || document.querySelector('.vela-dock-panel') ||
                    document.querySelector('.vela-drawer[data-state="open"]') || document.querySelector('#paper-ticket-view')?.closest('.vela-panel');
      const b = panel?.getBoundingClientRect();
      const vis = panel ? getComputedStyle(panel).display : 'none';
      const ticket = document.querySelector('#paper-ticket-view');
      const tb = ticket?.getBoundingClientRect();
      const overflow = b ? (panel.scrollWidth > panel.clientWidth + 8) : false;
      return { openId, found: !!panel && vis !== 'none', cls: panel?.className?.toString().slice(0,60),
               w: b?Math.round(b.width):0, h: b?Math.round(b.height):0, overflow,
               ticketVisible: !!ticket && getComputedStyle(ticket).display !== 'none',
               ticketW: tb?Math.round(tb.width):0,
               ticketOverflow: (b && tb) ? (tb.right > b.right + 2 || tb.left < b.left - 2) : false };
    });
    if (!r.found) defects.push({ kind: 'functional', text: 'trade panel not rendered on mobile', r });
    if (!r.ticketVisible) defects.push({ kind: 'functional', text: 'trade ticket view not visible on mobile', r });
    if (r.ticketOverflow) defects.push({ kind: 'layout', text: 'trade ticket overflows its panel on mobile', r });
    if (r.overflow) defects.push({ kind: 'layout', text: 'trade panel content clipped on mobile' });
    await shots(ctx, 'Bm01_trade');
    return { defects, info: r };
  },

  'Bm02_all_panel_items_open_cleanly': async (ctx) => {
    const { page } = ctx; const defects = [];
    const panels = await page.evaluate(() => Array.from(document.querySelectorAll('#modal-panels-menu .panel-menu-item')).map(i => i.getAttribute('data-panel')));
    for (const p of panels) {
      if (['compare', 'dataExport', 'chartStyle', 'barReplay', 'journal', 'workspaces'].includes(p)) continue;
      await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')));
      await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
      await new Promise(r => setTimeout(r, 500));
      await page.evaluate((x) => document.querySelector(`.panel-menu-item[data-panel="${x}"]`)?.click(), p);
      await new Promise(r => setTimeout(r, 1800));
      const a = await auditStatic(ctx);
      const ovf = a.horizontalOverflow.filter(o => !o.cls.includes('panel-menu'));
      if (ovf.length) defects.push(...ovf.map(o => ({ kind: 'overflow-mobile', feature: 'panel:' + p, ...o })));
      await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')));
      await page.evaluate(() => { const d = document.querySelector('.vela-drawer-backdrop'); if (d) d.click(); });
      await new Promise(r => setTimeout(r, 500));
    }
    return { defects };
  },

  'Bm03_mobile_quick_trade_execution': async (ctx) => {
    const { page } = ctx; const defects = [];
    const r = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const qt = document.querySelector('#chart-quick-trade');
      const trigger = document.querySelector('#qt-collapsed-trigger');
      trigger?.click();
      await new Promise(x => setTimeout(x, 500));
      const open = qt ? !qt.classList.contains('minimized') : false;
      const buy = document.querySelector('#quick-trade-buy-btn');
      const before = app.paperTrading?.positions?.length ?? 0;
      buy?.click();
      await new Promise(x => setTimeout(x, 900));
      const after = app.paperTrading?.positions?.length ?? 0;
      const bw = qt?.getBoundingClientRect();
      return { open, before, after, w: bw?Math.round(bw.width):0, left: bw?Math.round(bw.left):0, right: bw?Math.round(bw.right):0 };
    });
    if (!r.open) defects.push({ kind: 'functional', text: 'quick trade did not restore on mobile' });
    if (r.after <= r.before) defects.push({ kind: 'functional', text: 'mobile quick-trade BUY did not execute', r });
    if (r.left < -1 || r.right > 391) defects.push({ kind: 'layout', text: `quick trade misplaced on mobile (${r.left}..${r.right})` });
    await shots(ctx, 'Bm03_quicktrade');
    return { defects, info: r };
  },

  'Bm04_mobile_landscape_844x390': async (ctx) => {
    const { page } = ctx; const defects = [];
    await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 1500));
    const a = await auditStatic(ctx);
    const vp = { width: 844, height: 390 };
    if (a.horizontalOverflow.length) defects.push(...a.horizontalOverflow.map(o => ({ kind: 'overflow-landscape', ...o })));
    const hdr = await box(page, '#top-app-header');
    defects.push(...fit('header-landscape', hdr, vp));
    await shots(ctx, 'Bm04_landscape');
    return { defects };
  }
};

(async () => {
  console.log('\n════════ CYCLE B — DESKTOP DEEP ════════');
  await runSuite('cycleB_desktop', { desktop });
  console.log('\n════════ CYCLE B — MOBILE DEEP ════════');
  await runSuite('cycleB_mobile', { mobile });
})();