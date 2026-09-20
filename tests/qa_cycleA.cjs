// tests/qa_cycleA.cjs — Exhaustive feature dogfooding (desktop + mobile)
const { runSuite, auditStatic, shots } = require('./qa_lib.cjs');

const H = require('./qa_lib.cjs').INPAGE;

// helper: modal fits inside viewport?
function fitCheck(name, box, vp) {
  const d = [];
  if (!box) { d.push({ kind: 'functional', feature: name, text: 'element not found' }); return d; }
  if (box.left < -1) d.push({ kind: 'layout', feature: name, text: `overflows left by ${Math.round(-box.left)}px`, box });
  if (box.right > vp.width + 1) d.push({ kind: 'layout', feature: name, text: `overflows right by ${Math.round(box.right - vp.width)}px`, box });
  if (box.top < -1) d.push({ kind: 'layout', feature: name, text: `overflows top by ${Math.round(-box.top)}px`, box });
  if (box.bottom > vp.height + 1) d.push({ kind: 'layout', feature: name, text: `overflows bottom by ${Math.round(box.bottom - vp.height)}px`, box });
  return d;
}

async function openModal(page, selector) {
  await page.evaluate((s) => { const m = document.querySelector(s); if (m) m.classList.add('open'); }, selector);
  await new Promise(r => setTimeout(r, 450));
}
async function closeAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, [id^="modal-"]').forEach(m => m.classList.remove('open'));
  });
  await new Promise(r => setTimeout(r, 250));
}
async function box(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height,
             visible: getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' };
  }, sel);
}

const desktopTests = {
  'D01_static_layout': async (ctx) => {
    const a = await auditStatic(ctx);
    const defects = [];
    if (a.horizontalOverflow.length) defects.push(...a.horizontalOverflow.map(o => ({ kind: 'overflow', ...o })));
    if (a.overlaps.length) defects.push(...a.overlaps.map(o => ({ kind: 'overlap', ...o })));
    await shots(ctx, 'A_D01_layout');
    return { defects, info: { overflow: a.horizontalOverflow.length, overlaps: a.overlaps.length, innerClip: a.innerClip.length } };
  },

  'D02_console_and_errors': async (ctx) => {
    const { page } = ctx;
    await page.evaluate(() => window.__TRADING_APP__?.switchSymbol?.('ETHUSDT'));
    await new Promise(r => setTimeout(r, 2500));
    await page.evaluate(() => window.__TRADING_APP__?.setTimeframe?.('15'));
    await new Promise(r => setTimeout(r, 2500));
    return { defects: [] };
  },

  'D03_lang_toggle_persian_rtl': async (ctx) => {
    const { page } = ctx;
    await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 1500));
    const defects = [];
    const unt = await page.evaluate((fn) => eval('(' + fn + ')')(''), H.untranslated);
    // Exclude individually-branded engine strings (kept in English by design)
    const brandRe = /LuxAlgo|Nexus |PineTS|Vela |TradingChart/;
    const realUnt = unt.filter(u => !brandRe.test(u.text));
    if (realUnt.length) defects.push(...realUnt.map(u => ({ kind: 'i18n', ...u })));
    const mis = await page.evaluate((fn) => eval('(' + fn + ')()'), H.rtlMisalign);
    if (mis.length) defects.push(...mis.map(m => ({ kind: 'rtl', ...m })));
    const dir = await page.evaluate(() => getComputedStyle(document.body).direction);
    if (dir !== 'rtl') defects.push({ kind: 'rtl', text: 'body direction not rtl in fa: ' + dir });
    await shots(ctx, 'A_D03_fa_desktop');
    return { defects, info: { untranslated: realUnt.length, brandKept: unt.length - realUnt.length, rtlMisalign: mis.length } };
  },

  'D04_panels_menu_all_items': async (ctx) => {
    const { page } = ctx; const defects = [];
    await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
    await new Promise(r => setTimeout(r, 600));
    const items = await page.evaluate(() => Array.from(document.querySelectorAll('#modal-panels-menu .panel-menu-item')).map(el => {
      const r = el.getBoundingClientRect();
      return { panel: el.getAttribute('data-panel'), label: (el.innerText||'').trim().replace(/\s+/g,' ').slice(0,45), w: Math.round(r.width), h: Math.round(r.height) };
    }));
    const menuBox = await box(page, '#modal-panels-menu');
    defects.push(...fitCheck('panels-menu', menuBox, ctx.viewport));
    if (items.length < 8) defects.push({ kind: 'functional', text: 'panels menu has only ' + items.length + ' items' });
    const zero = items.filter(i => i.w < 40 || i.h < 20);
    if (zero.length) defects.push(...zero.map(z => ({ kind: 'layout', feature: 'panel-menu-item', text: `too small ${z.w}x${z.h} (${z.panel})` })));
    await shots(ctx, 'A_D04_panels_menu');
    await page.evaluate(() => document.querySelector('#modal-close-panels-menu')?.click());
    return { defects, info: { items: items.length, panels: items.map(i => i.panel) } };
  },

  'D05_watchlist': async (ctx) => {
    const { page } = ctx; const defects = [];
    await page.evaluate(() => window.__TRADING_APP__.chartManager?.togglePanel('watchlist', true));
    await new Promise(r => setTimeout(r, 1500));
    const d = await page.evaluate(() => {
      const rows = document.querySelectorAll('[class*="wl"], [class*="watchlist"] [class*="row"], .symbol-row');
      return { count: rows.length, sample: Array.from(rows).slice(0,5).map(r=>(r.innerText||'').trim().replace(/\s+/g,' ').slice(0,40)) };
    });
    if (d.count === 0) defects.push({ kind: 'functional', text: 'watchlist rendered zero rows' });
    await shots(ctx, 'A_D05_watchlist');
    return { defects, info: d };
  },

  'D06_indicators_modal': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    await page.evaluate(() => window.__TRADING_APP__.openIndicatorsModal?.());
    await new Promise(r => setTimeout(r, 900));
    const mBox = await box(page, '#modal-indicators .modal-box');
    defects.push(...fitCheck('indicators-modal', mBox, ctx.viewport));
    const d = await page.evaluate(() => {
      const box = document.querySelector('#modal-indicators');
      const cats = box?.querySelectorAll('[class*="cat"], .ind-category, .tab')?.length || 0;
      const items = box?.querySelectorAll('[class*="ind-item"], .indicator-item, [data-indicator]')?.length || 0;
      const vis = box ? getComputedStyle(box).display : 'none';
      return { display: vis, cats, items, text: (box?.innerText||'').slice(0,120) };
    });
    if (d.display === 'none') defects.push({ kind: 'functional', text: 'indicators modal did not open' });
    if (d.items === 0 && d.cats === 0) defects.push({ kind: 'functional', text: 'indicators modal has no items', text2: d.text });
    await shots(ctx, 'A_D06_indicators');
    return { defects, info: d };
  },

  'D07_symbol_search': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    await page.evaluate(() => window.__TRADING_APP__.openSymbolSearch?.());
    await new Promise(r => setTimeout(r, 900));
    const inp = await page.$('#symbol-search-input');
    if (!inp) defects.push({ kind: 'functional', text: 'symbol search has no input' });
    else {
      await inp.click();
      await inp.type('SOL', { delay: 40 });
      await page.evaluate(() => document.querySelector('#symbol-search-input')?.dispatchEvent(new Event('input', { bubbles: true })));
      await new Promise(r => setTimeout(r, 2000));
    }
    const d = await page.evaluate(() => {
      const res = document.querySelectorAll('#modal-symbol-search .sym-search-row');
      return { results: res.length, sample: Array.from(res).slice(0,4).map(r=>(r.getAttribute('data-symbol'))),
               badge: document.querySelector('#sym-count-badge')?.innerText };
    });
    if (d.results === 0) defects.push({ kind: 'functional', text: 'symbol search returned no results for SOL' });
    const b = await box(page, '#modal-symbol-search .modal-box');
    defects.push(...fitCheck('symbol-search', b, ctx.viewport));
    await shots(ctx, 'A_D07_symbol_search');
    return { defects, info: d };
  },

  'D08_chart_style_picker': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    await page.evaluate(() => window.__TRADING_APP__.chartStylePicker?.toggle());
    await new Promise(r => setTimeout(r, 600));
    const d = await page.evaluate(() => {
      const pop = document.querySelector('#popover-chart-style');
      const opts = pop?.querySelectorAll('button,[class*="opt"]')?.length || 0;
      const vis = pop ? getComputedStyle(pop).display : 'none';
      const txt = pop ? (pop.innerText||'').trim().replace(/\s+/g,' ').slice(0,80) : '';
      return { vis, opts, txt };
    });
    if (d.vis === 'none') defects.push({ kind: 'functional', text: 'chart style picker did not open' });
    if (d.opts < 4) defects.push({ kind: 'functional', text: 'chart style picker has <4 options: ' + d.opts });
    await shots(ctx, 'A_D08_chartstyle');
    await page.evaluate(() => window.__TRADING_APP__.chartStylePicker?.toggle());
    return { defects, info: d };
  },

  'D09_compare_export_shortcuts_settings_profile': async (ctx) => {
    const { page } = ctx; const defects = [];
    const feats = [
      ['compare', 'window.__TRADING_APP__.compareModal', '#modal-compare'],
      ['export', 'window.__TRADING_APP__.dataExportModal', '#modal-data-export'],
      ['shortcuts', 'window.__TRADING_APP__.shortcutsModal', '#modal-shortcuts'],
      ['settings', 'window.__TRADING_APP__.settingsModal', '#modal-settings'],
      ['profile', 'window.__TRADING_APP__.userProfileModal', null]
    ];
    for (const [name, expr, sel] of feats) {
      await closeAll(page);
      await page.evaluate((e) => { try { eval(e).open(); } catch (err) {} }, expr);
      await new Promise(r => setTimeout(r, 700));
      const d = await page.evaluate((e) => {
        try { const m = eval(e); return { open: !!m, cls: document.querySelectorAll('.modal-overlay.open').length }; } catch (err) { return { err: err.message }; }
      }, expr);
      if (sel) {
        const b = await box(page, sel + ' .modal-box');
        const fd = fitCheck(name, b, ctx.viewport);
        defects.push(...fd);
        if (!b) defects.push({ kind: 'functional', text: name + ' modal not found in DOM' });
      }
      await shots(ctx, 'A_D09_' + name);
    }
    await closeAll(page);
    return { defects };
  },

  'D10_bottom_panel_tabs': async (ctx) => {
    const { page } = ctx; const defects = [];
    const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.panel-tab')).map(t => t.getAttribute('data-view')));
    for (const view of tabs) {
      if (!view) continue;
      await page.evaluate((v) => {
        const t = document.querySelector(`.panel-tab[data-view="${v}"]`);
        if (t) t.click();
      }, view);
      await new Promise(r => setTimeout(r, 1600));
      const d = await page.evaluate(() => {
        const panel = document.querySelector('#bottom-panel');
        const active = panel?.querySelector('.panel-view.active, [class*="view"].active');
        const r = active?.getBoundingClientRect();
        return { activeId: active?.id || active?.className, has: !!active,
                 w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0,
                 text: (active?.innerText||'').trim().replace(/\s+/g,' ').slice(0,70) };
      });
      if (!d.has || d.h < 10) defects.push({ kind: 'functional', feature: 'bottom-tab:' + view, text: 'no active view rendered', d });
      await shots(ctx, 'A_D10_tab_' + view);
    }
    return { defects };
  },

  'D11_replay_contextmenu': async (ctx) => {
    const { page } = ctx; const defects = [];
    // context menu
    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (c) { const r = c.getBoundingClientRect();
        c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width*0.5, clientY: r.top + r.height*0.5 })); }
    });
    await new Promise(r => setTimeout(r, 600));
    const cm = await page.evaluate(() => {
      const c = document.querySelector('#canvas-context-menu, .canvas-context-menu');
      const items = c?.querySelectorAll('button,li,[class*="item"]')?.length || 0;
      return { exists: !!c, vis: c ? getComputedStyle(c).display : 'none', items, txt: (c?.innerText||'').replace(/\s+/g,' ').slice(0,80) };
    });
    if (!cm.exists) defects.push({ kind: 'functional', text: 'canvas context menu not found' });
    else if (cm.vis === 'none') defects.push({ kind: 'functional', text: 'canvas context menu did not open on right-click' });
    await shots(ctx, 'A_D11_contextmenu');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    // replay
    await page.evaluate(() => document.querySelector('#btn-topbar-replay')?.click());
    await new Promise(r => setTimeout(r, 1500));
    const rp = await page.evaluate(() => {
      const bar = document.querySelector('#replay-bar');
      return { exists: !!bar, vis: bar ? getComputedStyle(bar).display : 'none', cls: bar?.className,
               innerClip: bar ? bar.scrollWidth > bar.clientWidth + 8 : false, w: bar ? Math.round(bar.getBoundingClientRect().width) : 0 };
    });
    if (!rp.exists) defects.push({ kind: 'functional', text: 'replay bar not found' });
    else if (rp.vis === 'none') defects.push({ kind: 'functional', text: 'replay bar did not appear on toggle' });
    if (rp.innerClip) defects.push({ kind: 'layout', text: 'replay bar content clipped' });
    await shots(ctx, 'A_D11_replay');
    await page.evaluate(() => document.querySelector('#btn-topbar-replay')?.click());
    return { defects, info: { contextmenu: cm, replay: rp } };
  },

  'D12_timeframes_and_quicktrade': async (ctx) => {
    const { page } = ctx; const defects = [];
    await closeAll(page);
    await page.evaluate(() => { const b = document.querySelector('#btn-open-timeframes, [id*="timeframe"]'); window.__TRADING_APP__.timeframeManager?.open?.(); });
    await new Promise(r => setTimeout(r, 700));
    const tf = await page.evaluate(() => {
      const m = document.querySelector('#modal-timeframes');
      const btns = m?.querySelectorAll('button')?.length || 0;
      return { exists: !!m, vis: m ? getComputedStyle(m).display : 'none', btns,
               box: m?.querySelector('.modal-box')?.getBoundingClientRect() };
    });
    if (tf.exists && tf.vis !== 'none' && tf.btns < 5) defects.push({ kind: 'functional', text: 'timeframe modal has few buttons: ' + tf.btns });
    // quick trade interactions
    await closeAll(page);
    const q = await page.evaluate(() => {
      const qt = document.querySelector('#chart-quick-trade');
      const buy = document.querySelector('#quick-trade-buy-btn') || document.querySelector('#qt-buy-btn') || document.querySelector('[id*="buy"]');
      const sell = document.querySelector('#quick-trade-sell-btn') || document.querySelector('[id*="sell"]');
      return { qtExists: !!qt, buy: !!buy, sell: !!sell, qtVis: qt ? getComputedStyle(qt).display : 'none' };
    });
    if (!q.qtExists) defects.push({ kind: 'functional', text: 'quick trade widget not found' });
    await shots(ctx, 'A_D12_quicktrade');
    return { defects, info: { tf: { exists: tf.exists, btns: tf.btns }, quick: q } };
  }
};

const mobileTests = {
  'M01_static_layout_overflow': async (ctx) => {
    const a = await auditStatic(ctx);
    const defects = [];
    if (a.horizontalOverflow.length) defects.push(...a.horizontalOverflow.map(o => ({ kind: 'overflow-mobile', ...o })));
    if (a.overlaps.length) defects.push(...a.overlaps.map(o => ({ kind: 'overlap', ...o })));
    if (a.bodyScrollW > a.clientW + 2) defects.push({ kind: 'overflow-mobile', text: `body horizontal scroll: ${a.bodyScrollW} > ${a.clientW}` });
    await shots(ctx, 'A_M01_layout');
    return { defects, info: { overflow: a.horizontalOverflow.length, overlaps: a.overlaps.length, bodyScrollW: a.bodyScrollW, clientW: a.clientW } };
  },

  'M02_touch_targets': async (ctx) => {
    const a = await auditStatic(ctx);
    const bad = a.smallTargets.filter(t => t.w > 4 && t.h > 4);
    await shots(ctx, 'A_M02_targets');
    return { defects: bad.map(b => ({ kind: 'touch-target', ...b })), info: { small: bad.length } };
  },

  'M03_mobile_drawer_panels': async (ctx) => {
    const { page } = ctx; const defects = [];
    await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
    await new Promise(r => setTimeout(r, 700));
    const d = await page.evaluate(() => {
      const m = document.querySelector('#modal-panels-menu');
      const items = m?.querySelectorAll('.panel-menu-item')?.length || 0;
      const r = m?.getBoundingClientRect();
      return { vis: m ? getComputedStyle(m).display : 'none', items, w: r?Math.round(r.width):0, h: r?Math.round(r.height):0 };
    });
    if (d.vis === 'none') defects.push({ kind: 'functional', text: 'mobile panels drawer did not open' });
    if (d.items < 8) defects.push({ kind: 'functional', text: 'mobile drawer has few items: ' + d.items });
    await shots(ctx, 'A_M03_drawer');
    return { defects, info: d };
  },

  'M04_mobile_persian_rtl': async (ctx) => {
    const { page } = ctx; const defects = [];
    await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 1500));
    const unt = await page.evaluate((fn) => eval('(' + fn + ')')(''), H.untranslated);
    const brandRe = /LuxAlgo|Nexus |PineTS|Vela |TradingChart/;
    const realUnt = unt.filter(u => !brandRe.test(u.text));
    if (realUnt.length) defects.push(...realUnt.map(u => ({ kind: 'i18n-mobile', ...u })));
    const mis = await page.evaluate((fn) => eval('(' + fn + ')()'), H.rtlMisalign);
    if (mis.length) defects.push(...mis.map(m => ({ kind: 'rtl-mobile', ...m })));
    const a = await auditStatic(ctx);
    if (a.horizontalOverflow.length) defects.push(...a.horizontalOverflow.map(o => ({ kind: 'overflow-mobile-fa', ...o })));
    await shots(ctx, 'A_M04_fa_mobile');
    return { defects, info: { untranslated: realUnt.length, overflow: a.horizontalOverflow.length, rtlMisalign: mis.length } };
  },

  'M05_mobile_modals_fit': async (ctx) => {
    const { page } = ctx; const defects = [];
    const mods = [
      ['indicators', 'window.__TRADING_APP__.openIndicatorsModal', '#modal-indicators'],
      ['compare', 'window.__TRADING_APP__.compareModal', '#modal-compare'],
      ['export', 'window.__TRADING_APP__.dataExportModal', '#modal-data-export'],
      ['shortcuts', 'window.__TRADING_APP__.shortcutsModal', '#modal-shortcuts'],
      ['settings', 'window.__TRADING_APP__.settingsModal', '#modal-settings']
    ];
    for (const [name, expr, sel] of mods) {
      await closeAll(page);
      await page.evaluate((e) => { try { eval(e).open(); } catch (err) {} }, expr);
      await new Promise(r => setTimeout(r, 700));
      const b = await box(page, sel + ' .modal-box');
      defects.push(...fitCheck(name + '-mobile', b, ctx.viewport));
      await shots(ctx, 'A_M05_' + name);
    }
    await closeAll(page);
    return { defects };
  },

  'M06_mobile_bottom_panel': async (ctx) => {
    const { page } = ctx; const defects = [];
    const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.panel-tab')).map(t => t.getAttribute('data-view')).filter(Boolean));
    for (const view of tabs.slice(0, 5)) {
      await page.evaluate((v) => document.querySelector(`.panel-tab[data-view="${v}"]`)?.click(), view);
      await new Promise(r => setTimeout(r, 1200));
      const d = await page.evaluate(() => {
        const panel = document.querySelector('#bottom-panel');
        const active = panel?.querySelector('.panel-view.active, [class*="view"].active');
        const r = active?.getBoundingClientRect();
        return { has: !!active, w: r?Math.round(r.width):0, h: r?Math.round(r.height):0,
                 overflow: active ? (active.scrollWidth > active.clientWidth + 8) : false };
      });
      if (!d.has) defects.push({ kind: 'functional', feature: 'mobile-tab:' + view, text: 'no active view' });
      if (d.overflow) defects.push({ kind: 'layout', feature: 'mobile-tab:' + view, text: 'panel content clipped horizontally' });
    }
    await shots(ctx, 'A_M06_mobile_panel');
    return { defects };
  }
};

(async () => {
  console.log('\n════════ CYCLE A — DESKTOP (1440x900) ════════');
  await runSuite('cycleA_desktop', { desktop: desktopTests });
  console.log('\n════════ CYCLE A — MOBILE (390x844) ════════');
  await runSuite('cycleA_mobile', { mobile: mobileTests });
})();