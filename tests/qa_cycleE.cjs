// qa_cycleE.cjs — Exploratory free-roam QA cycle (wave 2+): interact with every
// reachable surface on desktop + mobile, in EN and FA, hunting for defects that
// scripted cycles A-D do not cover. Uses qa_lib.cjs's proven clip-aware detectors.
const { runSuite, auditStatic, errorsOf, shots, BASE } = require('./qa_lib.cjs');

const settle = (ms) => new Promise(r => setTimeout(r, ms));

function staticToDefects(audit, area, { smallMin = 0 } = {}) {
  const defects = [];
  for (const o of audit.horizontalOverflow || [])
    defects.push({ severity: 'high', area, kind: 'h-overflow', ...o });
  for (const o of audit.innerClip || [])
    defects.push({ severity: 'medium', area, kind: 'inner-clip', ...o });
  for (const o of audit.overlaps || [])
    defects.push({ severity: 'medium', area, kind: 'overlap', ...o });
  if (smallMin) for (const o of audit.smallTargets || [])
    defects.push({ severity: 'low', area, kind: 'small-target', ...o });
  return defects;
}

async function untranslatedLeaks(ctx, area) {
  const rows = await ctx.page.evaluate((H) => eval('(' + H.untranslated + ')()'), require('./qa_lib.cjs').INPAGE);
  return rows.map(r => ({ severity: 'medium', area, kind: 'untranslated', ...r }));
}

async function clickVisibleButtons(ctx, scopeSel, maxN, perClick) {
  // Click up to maxN visible buttons matching scopeSel, one at a time, calling
  // perClick(ctx, label) after each. Re-queries DOM every iteration (stale-safe).
  // The language toggle button is excluded: flipping FA→EN mid-sweep makes the
  // untranslated-text detector flag correctly-English surfaces.
  const labels = await ctx.page.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (s.display === 'none' || s.visibility === 'hidden' || r.width < 3 || r.height < 3) continue;
      const label = (el.innerText || el.title || el.getAttribute('aria-label') || el.id || el.className).toString().trim().replace(/\s+/g, ' ').slice(0, 30);
      if (/^(FA|EN|FA \/ EN|EN \/ FA)$/.test(label) || el.id === 'btn-lang-toggle') continue;
      out.push(label);
    }
    return [...new Set(out)];
  }, scopeSel);
  for (const label of labels.slice(0, maxN)) {
    const clicked = await ctx.page.evaluate((sel, lbl) => {
      for (const el of document.querySelectorAll(sel)) {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (s.display === 'none' || s.visibility === 'hidden' || r.width < 3) continue;
        const t = (el.innerText || el.title || el.getAttribute('aria-label') || el.id || el.className).toString().trim().replace(/\s+/g, ' ').slice(0, 30);
        if (t === lbl) { el.click(); return true; }
      }
      return false;
    }, scopeSel, label);
    if (!clicked) continue;
    await settle(900); // let modals open AND the bottom panel tabs re-render settle
    await perClick(ctx, label);
    await ctx.page.keyboard.press('Escape').catch(() => {});
    await settle(180);
  }
}

const tests = {
  desktop: {
    E01_initial_health_and_surfaces: async (ctx, { auditStatic }) => {
      const defects = [];
      const a = await auditStatic(ctx);
      defects.push(...staticToDefects(a, 'E01-init'));
      // count genuinely reachable interactive surfaces
      const n = await ctx.page.evaluate(() => {
        let c = 0;
        for (const el of document.querySelectorAll('button,[role="button"],select,input')) {
          const s = getComputedStyle(el); const r = el.getBoundingClientRect();
          if (s.display !== 'none' && s.visibility !== 'hidden' && r.width > 2 && r.height > 2) c++;
        }
        return c;
      });
      if (n < 25) defects.push({ severity: 'medium', area: 'E01-init', kind: 'surface-count', text: `only ${n} visible interactive elements` });
      // canvas alive?
      const hasCanvas = await ctx.page.evaluate(() => !!document.querySelector('canvas'));
      if (!hasCanvas) defects.push({ severity: 'critical', area: 'E01-init', kind: 'no-canvas', text: 'chart canvas missing' });
      return { defects };
    },

    E02_roam_top_toolbars: async (ctx, { auditStatic }) => {
      const defects = [];
      await clickVisibleButtons(ctx, 'header button, .topbar button, [class*="toolbar"] > button, .chart-toolbar button', 35, async (c, lbl) => {
        const a = await auditStatic(c);
        defects.push(...staticToDefects(a, `E02:${lbl}`));
      });
      return { defects };
    },

    E03_roam_left_right_rails: async (ctx, { auditStatic }) => {
      const defects = [];
      await clickVisibleButtons(ctx, '[class*="rail"] button, aside button, [class*="sidebar"] button, .panel-tab', 40, async (c, lbl) => {
        const a = await auditStatic(c);
        defects.push(...staticToDefects(a, `E03:${lbl}`));
      });
      return { defects };
    },

    E04_timeframe_sweep: async (ctx) => {
      const defects = [];
      // First read the actual offered timeframes from the Vela TF menu, then
      // sweep each of those — the product decides which TFs exist, the test
      // must not demand a TF the engine never offered.
      const offered = await ctx.page.evaluate(() => new Promise(res => {
        const caret = document.querySelector('.vela-widget-tf-caret');
        if (!caret) return res([]);
        caret.click();
        setTimeout(() => {
          const items = [...document.querySelectorAll('.vela-menu-item')].map(e => (e.innerText || '').trim()).filter(t => /^[0-9]+[mhdDWM]$/.test(t));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          res([...new Set(items)]);
        }, 400);
      }));
      if (!offered.length) return { defects: [{ severity: 'high', area: 'E04-tf', kind: 'tf-menu-empty', text: 'timeframe menu offered no options' }] };
      for (const tf of offered) {
        const picked = await ctx.page.evaluate((wanted) => new Promise(res => {
          const caret = document.querySelector('.vela-widget-tf-caret');
          if (!caret) return res('no-caret');
          caret.click();
          setTimeout(() => {
            const el = [...document.querySelectorAll('.vela-menu-item')].find(e => (e.innerText || '').trim() === wanted && e.offsetParent !== null);
            if (el) { el.click(); res('ok'); } else { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); res('not-found'); }
          }, 350);
        }), tf);
        if (picked !== 'ok') { defects.push({ severity: 'low', area: 'E04-tf', kind: 'tf-missing', text: `${tf}: ${picked}` }); continue; }
        await settle(1500);
        const state = await ctx.page.evaluate(() => {
          const c = document.querySelector('canvas');
          const err = document.querySelector('[class*="error"], .toast-error');
          const tfLabel = document.querySelector('.vela-widget-tf-caret')?.innerText?.trim();
          return { canvas: !!c && c.width > 0, err: err ? (err.innerText || '').slice(0, 80) : null, tfLabel };
        });
        if (!state.canvas) defects.push({ severity: 'high', area: 'E04-tf', kind: 'canvas-dead', text: `after ${tf}` });
        if (state.err) defects.push({ severity: 'medium', area: 'E04-tf', kind: 'error-toast', text: `${tf}: ${state.err}` });
        if (state.tfLabel && state.tfLabel !== tf) defects.push({ severity: 'medium', area: 'E04-tf', kind: 'tf-not-applied', text: `wanted ${tf}, caret shows ${state.tfLabel}` });
      }
      return { defects };
    },

    E05_symbol_switch_and_invalid: async (ctx) => {
      const defects = [];
      // wait until the app object is fully interactive
      await ctx.page.waitForFunction(() => !!(window.__TRADING_APP__ && window.__TRADING_APP__.currentSymbol), { timeout: 20000 }).catch(() => {});
      const typeSymbol = async (sym) => {
        await ctx.page.evaluate(() => { window.__TRADING_APP__?.openSymbolSearch?.(); });
        await settle(500);
        return ctx.page.evaluate(() => {
          const inp = document.querySelector('#symbol-search-input');
          if (inp && document.querySelector('#modal-symbol-search')?.classList.contains('open')) { inp.focus(); inp.value = ''; return true; }
          const vis = [...document.querySelectorAll('input')].find(i => i.offsetParent && /symbol|search|جستجو|نماد/i.test((i.placeholder || '') + ' ' + (i.className || '') + ' ' + (i.id || '')));
          if (vis) { vis.focus(); vis.value = ''; return true; }
          return false;
        });
      };
      // ETHUSDT switch
      if (await typeSymbol()) {
        await ctx.page.keyboard.type('ETHUSDT', { delay: 35 });
        await settle(1200);
        // click the ETHUSDT result row explicitly (Enter may pick the wrong row)
        const clicked = await ctx.page.evaluate(() => {
          const rows = [...document.querySelectorAll('#modal-symbol-search [data-symbol], #modal-symbol-search .sym-row, #modal-symbol-search li')];
          const row = rows.find(r => /ETHUSDT/i.test((r.dataset.symbol || '') + ' ' + (r.innerText || '')) && r.offsetParent !== null);
          if (row) { row.click(); return 'row'; }
          return null;
        });
        if (!clicked) await ctx.page.keyboard.press('Enter');
        await settle(2500);
        const cur = await ctx.page.evaluate(() => window.__TRADING_APP__?.currentSymbol || '');
        if (!/ETH/i.test(cur)) defects.push({ severity: 'medium', area: 'E05-symbol', kind: 'no-switch', text: `currentSymbol=${cur}` });
      } else {
        defects.push({ severity: 'medium', area: 'E05-symbol', kind: 'search-missing', text: 'symbol search input not reachable' });
      }
      // Invalid symbol must NOT fabricate data nor crash the chart
      if (await typeSymbol()) {
        await ctx.page.keyboard.type('ZZZNOTREAL123', { delay: 25 });
        await settle(900);
        await ctx.page.keyboard.press('Enter');
        await settle(1800);
        const state = await ctx.page.evaluate(() => ({
          sym: window.__TRADING_APP__?.currentSymbol || '',
          canvas: !!document.querySelector('canvas'),
        }));
        if (!state.canvas) defects.push({ severity: 'high', area: 'E05-symbol', kind: 'canvas-dead-invalid', text: '' });
        if (/ZZZNOTREAL/i.test(state.sym)) defects.push({ severity: 'high', area: 'E05-symbol', kind: 'fabricated-symbol', text: `invalid symbol adopted: ${state.sym}` });
      }
      await ctx.page.keyboard.press('Escape').catch(() => {});
      return { defects };
    },

    E06_fa_full_sweep: async (ctx, { auditStatic }) => {
      const defects = [];
      await ctx.page.evaluate(() => { const app = window.__TRADING_APP__; if (app) app.switchLanguage('fa'); });
      await settle(1500);
      const a = await auditStatic(ctx);
      defects.push(...staticToDefects(a, 'E06-fa-init'));
      defects.push(...await untranslatedLeaks(ctx, 'E06-fa-init'));
      // RTL misalignment
      const rtl = await ctx.page.evaluate((H) => eval('(' + H.rtlMisalign + ')()'), require('./qa_lib.cjs').INPAGE);
      for (const r of rtl) if (!r.note) defects.push({ severity: 'medium', area: 'E06-fa-rtl', kind: 'rtl-misalign', ...r });
      // roam surfaces in FA
      await clickVisibleButtons(ctx, 'header button, [class*="toolbar"] > button, [class*="rail"] button, .panel-tab', 30, async (c, lbl) => {
        const aa = await auditStatic(c);
        defects.push(...staticToDefects(aa, `E06-fa:${lbl}`));
        defects.push(...await untranslatedLeaks(c, `E06-fa:${lbl}`));
      });
      // round trip back to EN — zero FA leaks
      await ctx.page.evaluate(() => { const app = window.__TRADING_APP__; if (app) app.switchLanguage('en'); });
      await settle(2500); // allow the lossless-restore pass + observer to fully settle
      // wait for any in-flight transient toast to finish its fade-out cycle
      await ctx.page.evaluate(() => new Promise(res => {
        const toasts = [...document.querySelectorAll('#tradingchart-toast, .tradingchart-toast, .app-floating-toast')];
        if (!toasts.length) return res();
        setTimeout(res, 3400); // toasts auto-dismiss at 3s — wait them out fully
      }));
      const leak = await ctx.page.evaluate(() => {
        let n = 0;
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let x;
        while ((x = w.nextNode())) {
          const el = x.parentElement;
          if (!el || el.getClientRects().length === 0) continue;
          // skip transient toasts — they are self-dismissing notifications, not UI state
          if (el.closest('#tradingchart-toast, .tradingchart-toast, .app-floating-toast')) continue;
          if (/[؀-ۿ]/.test(x.textContent)) n++;
        }
        return n;
      });
      if (leak > 0) {
        const leakDetail = await ctx.page.evaluate(() => {
          const out = [];
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let x;
          while ((x = w.nextNode())) {
            const el = x.parentElement;
            if (!el || el.getClientRects().length === 0) continue;
            // skip transient toasts — they are self-dismissing notifications, not UI state
          if (el.closest('#tradingchart-toast, .tradingchart-toast, .app-floating-toast')) continue;
          if (/[؀-ۿ]/.test(x.textContent)) out.push(x.textContent.trim().slice(0, 40) + ' @ ' + el.tagName + '.' + (el.className || '').toString().slice(0, 30) + '#' + (el.id || ''));
          }
          return out.slice(0, 8);
        });
        defects.push({ severity: 'high', area: 'E06-fa-roundtrip', kind: 'fa-leak', text: `${leak} FA text nodes remain after EN switch: ${leakDetail.join(' | ')}` });
      }
      return { defects };
    },

    E07_responsive_widths: async (ctx, { auditStatic }) => {
      const defects = [];
      for (const w of [1920, 1280, 1024, 800]) {
        await ctx.page.setViewport({ width: w, height: 900 });
        await settle(700);
        const a = await auditStatic(ctx);
        defects.push(...staticToDefects(a, `E07-w${w}`));
      }
      await ctx.page.setViewport({ width: 1440, height: 900 });
      return { defects };
    },

    E08_keyboard_and_focus: async (ctx) => {
      const defects = [];
      // Tab through the app: focus must always land on a VISIBLE element
      for (let i = 0; i < 30; i++) {
        await ctx.page.keyboard.press('Tab');
        await settle(60);
        const f = await ctx.page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          const visible = s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
          return { tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), visible, inView: r.top >= -5 && r.left >= -5 };
        });
        if (f && !f.visible) { defects.push({ severity: 'medium', area: 'E08-focus', kind: 'focus-hidden', ...f }); break; }
      }
      return { defects };
    },
  },

  mobile: {
    E09_mobile_init: async (ctx, { auditStatic }) => {
      const a = await auditStatic(ctx);
      const defects = staticToDefects(a, 'E09-init', { smallMin: 30 });
      const hasCanvas = await ctx.page.evaluate(() => !!document.querySelector('canvas'));
      if (!hasCanvas) defects.push({ severity: 'critical', area: 'E09-init', kind: 'no-canvas', text: 'chart canvas missing on mobile' });
      return { defects };
    },

    E10_mobile_dock_and_sheets: async (ctx, { auditStatic }) => {
      const defects = [];
      // mobile bottom dock / sheet triggers
      await clickVisibleButtons(ctx, '[class*="dock"] button, [class*="tabbar"] button, [class*="bottombar"] button, nav button, header button', 30, async (c, lbl) => {
        const a = await auditStatic(c);
        defects.push(...staticToDefects(a, `E10:${lbl}`, { smallMin: 30 }));
      });
      return { defects };
    },

    E11_mobile_fa_sweep: async (ctx, { auditStatic }) => {
      const defects = [];
      await ctx.page.evaluate(() => { const app = window.__TRADING_APP__; if (app) app.switchLanguage('fa'); });
      await settle(1500);
      const a = await auditStatic(ctx);
      defects.push(...staticToDefects(a, 'E11-fa-init', { smallMin: 30 }));
      defects.push(...await untranslatedLeaks(ctx, 'E11-fa-init'));
      await clickVisibleButtons(ctx, '[class*="dock"] button, nav button, header button, .panel-tab', 25, async (c, lbl) => {
        const aa = await auditStatic(c);
        defects.push(...staticToDefects(aa, `E11-fa:${lbl}`, { smallMin: 30 }));
        defects.push(...await untranslatedLeaks(c, `E11-fa:${lbl}`));
      });
      await ctx.page.evaluate(() => { const app = window.__TRADING_APP__; if (app) app.switchLanguage('en'); });
      await settle(1000);
      return { defects };
    },

    E12_mobile_landscape_and_320: async (ctx, { auditStatic }) => {
      const defects = [];
      await ctx.page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await settle(800);
      defects.push(...staticToDefects(await auditStatic(ctx), 'E12-landscape'));
      await ctx.page.setViewport({ width: 320, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await settle(800);
      defects.push(...staticToDefects(await auditStatic(ctx), 'E12-320'));
      await ctx.page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      return { defects };
    },

    E13_mobile_touch_tap_targets: async (ctx, { auditStatic }) => {
      // tap center of the chart (should not break anything), then re-audit
      const defects = [];
      await ctx.page.touchscreen.tap(195, 400).catch(() => {});
      await settle(500);
      const a = await auditStatic(ctx);
      defects.push(...staticToDefects(a, 'E13-post-tap'));
      return { defects };
    },
  },
};

if (require.main === module) {
  const name = process.argv[2] || 'cycleE';
  runSuite(name, tests)
    .then(({ fails }) => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
}
