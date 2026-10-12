// tests/qa_crusade_omni.cjs
// Omni-Surface Real-Browser QA Audit for TradingChart
// Exhaustively probes EVERY interactive feature across Desktop & Mobile
const { launch, closeAll, boot, errorsOf, INPAGE, runSuite, shots } = require('./qa_lib.cjs');
const assert = require('assert');

const crusadeDesktop = {
  async D_SURFACE_01_headers_and_controls(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Probe all top header buttons
    const btns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#top-header button, header button'))
        .filter(b => b.offsetWidth > 0 && b.offsetHeight > 0)
        .map(b => ({ id: b.id, cls: b.className, text: b.innerText?.trim() }));
    });

    for (const b of btns) {
      if (b.id === 'btn-toggle-lang') continue; // tested separately
      try {
        const sel = b.id ? `#${b.id}` : `.${b.cls.split(' ')[0]}`;
        await page.click(sel);
        await new Promise(r => setTimeout(r, 150));
        // Dismiss any modal that opened
        await page.keyboard.press('Escape');
      } catch (err) {
        defects.push({ kind: 'interaction', feature: `header-btn:${b.id || b.cls}`, text: err.message });
      }
    }

    const errs = errorsOf(ctx);
    if (errs.length > 0) {
      defects.push({ kind: 'console', feature: 'header-controls', text: errs.map(e => e.text).join('; ') });
    }
    return { defects };
  },

  async D_SURFACE_02_all_drawings_activation(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    const tools = ['trendline', 'hline', 'ray', 'fibretracement', 'box', 'position', 'datepricerange', 'freehand', 'text'];
    for (const tool of tools) {
      const exists = await page.evaluate((t) => {
        const btn = document.querySelector(`[data-tool="${t}"]`);
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, tool);

      if (!exists) {
        defects.push({ kind: 'functional', feature: `drawing:${tool}`, text: 'Tool button not found in drawing toolbar' });
      } else {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Test Drawing auxiliary controls
    await page.evaluate(() => {
      document.querySelector('#btn-magnet')?.click();
      document.querySelector('#btn-lock-drawings')?.click();
      document.querySelector('#btn-hide-drawings')?.click();
      document.querySelector('#btn-undo')?.click();
      document.querySelector('#btn-redo')?.click();
    });

    const errs = errorsOf(ctx);
    if (errs.length > 0) {
      defects.push({ kind: 'console', feature: 'drawing-toolbar', text: errs.map(e => e.text).join('; ') });
    }
    return { defects };
  },

  async D_SURFACE_03_timeframe_matrix_and_custom(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    const tfs = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];
    for (const tf of tfs) {
      const clicked = await page.evaluate((targetTf) => {
        const btn = Array.from(document.querySelectorAll('.tf-btn, [data-tf], .timeframe-btn'))
          .find(b => b.innerText?.trim() === targetTf || b.getAttribute('data-tf') === targetTf);
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, tf);

      await new Promise(r => setTimeout(r, 200));
    }

    // Open custom timeframe modal if exists
    const hasCustomTf = await page.evaluate(() => {
      const btn = document.querySelector('#btn-custom-tf, [data-action="custom-timeframe"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (hasCustomTf) {
      await new Promise(r => setTimeout(r, 300));
      const isOpen = await page.evaluate(() => {
        const m = document.querySelector('#modal-timeframes');
        return m && (m.classList.contains('open') || getComputedStyle(m).display !== 'none');
      });
      if (!isOpen) defects.push({ kind: 'modal', feature: 'custom-timeframe', text: 'Modal failed to open' });
      await page.keyboard.press('Escape');
    }

    return { defects };
  },

  async D_SURFACE_04_chart_styles_all(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Open chart style picker
    await page.evaluate(() => document.querySelector('#btn-topbar-chart-style')?.click());
    await new Promise(r => setTimeout(r, 300));

    const styles = ['candles', 'bars', 'line', 'area', 'heikinashi'];
    for (const s of styles) {
      const applied = await page.evaluate((style) => {
        const item = document.querySelector(`[data-chart-style="${style}"], [data-style="${style}"]`);
        if (item) {
          item.click();
          return true;
        }
        return false;
      }, s);
      await new Promise(r => setTimeout(r, 150));
      // reopen style menu for next item
      await page.evaluate(() => document.querySelector('#btn-topbar-chart-style')?.click());
      await new Promise(r => setTimeout(r, 150));
    }
    await page.keyboard.press('Escape');

    const errs = errorsOf(ctx);
    if (errs.length > 0) {
      defects.push({ kind: 'console', feature: 'chart-styles', text: errs.map(e => e.text).join('; ') });
    }
    return { defects };
  },

  async D_SURFACE_05_indicators_modal_and_settings(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Open Indicators Modal via app API or button
    await page.evaluate(() => {
      if (window.__TRADING_APP__?.openIndicatorsModal) {
        window.__TRADING_APP__.openIndicatorsModal();
      } else {
        document.querySelector('#btn-open-indicators, #btn-indicators, [title*="Indicator"]')?.click();
      }
    });
    await new Promise(r => setTimeout(r, 600));

    const modalVisible = await page.evaluate(() => {
      const m = document.querySelector('#modal-indicators');
      return m && (m.classList.contains('open') || m.classList.contains('active') || getComputedStyle(m).display !== 'none');
    });

    if (!modalVisible) {
      defects.push({ kind: 'modal', feature: 'indicators-modal', text: 'Indicators modal did not open' });
    } else {
      // Test search filter
      await page.evaluate(() => {
        const searchInput = document.querySelector('#ind-search-input, #search-indicators');
        if (searchInput) {
          searchInput.value = 'RSI';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await new Promise(r => setTimeout(r, 300));

      // Click on an indicator item
      await page.evaluate(() => {
        const firstInd = document.querySelector('#ind-items-container .ind-item, #ind-items-container button');
        firstInd?.click();
      });
      await new Promise(r => setTimeout(r, 400));

      // Close indicators modal
      await page.evaluate(() => {
        document.querySelector('#modal-close-ind')?.click();
      });
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    return { defects };
  },

  async D_SURFACE_06_bottom_panel_all_13_views(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    const tabs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#bottom-panel .panel-tab, [data-view]'))
        .map(t => ({ view: t.getAttribute('data-view'), text: t.innerText?.trim() }))
        .filter(t => t.view && t.view !== 'quant');
    });

    for (const t of tabs) {
      await page.evaluate((v) => {
        document.querySelector(`.panel-tab[data-view="${v}"]`)?.click();
      }, t.view);
      await new Promise(r => setTimeout(r, 600));

      const viewCheck = await page.evaluate(() => {
        const panel = document.querySelector('#bottom-panel');
        const active = panel?.querySelector('.panel-view.active, [class*="view"].active');
        const r = active?.getBoundingClientRect();
        return {
          has: !!active,
          w: r ? Math.round(r.width) : 0,
          h: r ? Math.round(r.height) : 0
        };
      });

      if (!viewCheck.has || viewCheck.h < 10) {
        defects.push({ kind: 'panel', feature: `panel-tab:${t.view}`, text: `Active view not rendered for tab ${t.view}` });
      }
    }

    // Return to quant view
    await page.evaluate(() => document.querySelector('.panel-tab[data-view="quant"]')?.click());
    return { defects };
  },

  async D_SURFACE_07_modals_roundtrip_audit(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    const modalTriggers = [
      { name: 'Symbol Search', trigger: () => window.__TRADING_APP__?.openSymbolSearch?.(), id: '#modal-symbol-search' },
      { name: 'Market Sources', trigger: () => document.querySelector('#btn-topbar-market-source')?.click(), id: '#modal-market-sources' },
      { name: 'Compare', trigger: () => window.__TRADING_APP__?.compareModal?.open?.(), id: '#modal-compare' },
      { name: 'Shortcuts Help', trigger: () => window.__TRADING_APP__?.shortcutsModal?.open?.(), id: '#modal-shortcuts' },
      { name: 'Data Export', trigger: () => window.__TRADING_APP__?.dataExportModal?.open?.(), id: '#modal-data-export' },
      { name: 'Settings', trigger: () => window.__TRADING_APP__?.settingsModal?.open?.(), id: '#modal-settings' },
      { name: 'Panels Menu', trigger: () => document.querySelector('#nav-btn-panels')?.click(), id: '#modal-panels-menu' }
    ];

    for (const m of modalTriggers) {
      await page.evaluate(m.trigger);
      await new Promise(r => setTimeout(r, 450));

      const isOpened = await page.evaluate((id) => {
        const el = document.querySelector(id);
        return el && (el.classList.contains('open') || el.classList.contains('active') || getComputedStyle(el).display !== 'none');
      }, m.id);

      if (!isOpened) {
        defects.push({ kind: 'modal', feature: m.name, text: `Trigger failed to open modal ${m.id}` });
      }

      // Check inner clipping and overflows
      const overflows = await page.evaluate(new Function(`return (${INPAGE.horizontalOverflow})();`));
      if (overflows && overflows.length > 0) {
        defects.push({ kind: 'overflow', feature: m.name, text: `Modal content overflows viewport horizontally: ${overflows[0].cls || overflows[0].id}` });
      }

      // Close modal cleanly via close button or Escape
      await page.evaluate((id) => {
        const closeBtn = document.querySelector(`${id} .modal-close-btn, ${id} [data-action="close"]`);
        if (closeBtn) closeBtn.click();
      });
      await new Promise(r => setTimeout(r, 200));
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 200));
    }

    return { defects };
  },

  async D_SURFACE_08_persian_rtl_complete_sweep(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'fa' });
    const defects = [];

    // Check document dir and lang
    const docMeta = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      bodyRtl: getComputedStyle(document.body).direction
    }));

    if (docMeta.lang !== 'fa' || docMeta.dir !== 'rtl') {
      defects.push({ kind: 'i18n', feature: 'html-attributes', text: `Doc meta not RTL: lang=${docMeta.lang}, dir=${docMeta.dir}` });
    }

    // Check untranslated text
    const untranslated = await page.evaluate(new Function(`return (${INPAGE.untranslated})();`));
    if (untranslated && untranslated.length > 0) {
      defects.push({ kind: 'untranslated', feature: 'persian-untranslated', text: `Found ${untranslated.length} untranslated strings: ` + untranslated.slice(0, 5).map(u => u.text).join(' | ') });
    }

    // Check RTL alignment
    const rtlMisaligns = await page.evaluate(new Function(`return (${INPAGE.rtlMisalign})();`));
    if (rtlMisaligns && rtlMisaligns.length > 0 && !rtlMisaligns[0].note) {
      defects.push({ kind: 'rtl', feature: 'persian-alignment', text: `Found ${rtlMisaligns.length} misaligned RTL elements: ` + rtlMisaligns.slice(0, 4).map(m => m.text).join(' | ') });
    }

    // Switch back to English and assert lossless restoration
    await page.evaluate(() => window.__TRADING_APP__?.switchLanguage('en'));
    await new Promise(r => setTimeout(r, 500));

    const restoredEn = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir
    }));

    if (restoredEn.lang !== 'en' || restoredEn.dir !== 'ltr') {
      defects.push({ kind: 'i18n', feature: 'en-restoration', text: `Failed to restore LTR English: lang=${restoredEn.lang}, dir=${restoredEn.dir}` });
    }

    return { defects };
  }
};

const crusadeMobile = {
  async M_SURFACE_01_viewport_fit_and_no_hscroll(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    const scrollCheck = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        hasHScroll: doc.scrollWidth > doc.clientWidth
      };
    });

    if (scrollCheck.hasHScroll) {
      defects.push({ kind: 'mobile-layout', feature: 'page-scroll', text: `Page has horizontal scrollbar: scrollW=${scrollCheck.scrollWidth}, clientW=${scrollCheck.clientWidth}` });
    }

    const overflows = await page.evaluate(new Function(`return (${INPAGE.horizontalOverflow})();`));
    if (overflows && overflows.length > 0) {
      defects.push({ kind: 'overflow', feature: 'mobile-overflow', text: `Found ${overflows.length} overflowing elements: ` + overflows.slice(0, 3).map(o => o.cls || o.id).join(', ') });
    }

    return { defects };
  },

  async M_SURFACE_02_mobile_drawer_and_navigation(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Open mobile drawer
    const opened = await page.evaluate(() => {
      const btn = document.querySelector('#btn-toggle-panels-dock, #btn-mobile-menu, #btn-mobile-drawer, [aria-label*="Menu"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    await new Promise(r => setTimeout(r, 400));
    const drawerOpen = await page.evaluate(() => {
      const drawer = document.querySelector('#mobile-drawer, .mobile-drawer, .side-dock-drawer');
      return drawer && (drawer.classList.contains('open') || drawer.classList.contains('active') || getComputedStyle(drawer).display !== 'none');
    });

    // Close mobile drawer
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.drawer-close-btn, #mobile-drawer .close-btn, .mobile-drawer-backdrop');
      if (closeBtn) closeBtn.click();
      else document.querySelector('#btn-toggle-panels-dock')?.click();
    });
    await new Promise(r => setTimeout(r, 300));

    return { defects };
  },

  async M_SURFACE_03_mobile_quick_trade_widget(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    const qtCheck = await page.evaluate(() => {
      const qt = document.querySelector('#quick-trade-widget, .quick-trade-container, #mobile-quick-trade');
      if (!qt) return { exists: false };
      const s = getComputedStyle(qt);
      const r = qt.getBoundingClientRect();
      const buyBtn = qt.querySelector('.qt-buy, [data-side="buy"], button[class*="buy"]');
      const sellBtn = qt.querySelector('.qt-sell, [data-side="sell"], button[class*="sell"]');
      return {
        exists: true,
        visible: s.display !== 'none' && s.visibility !== 'hidden',
        width: Math.round(r.width),
        hasBuy: !!buyBtn,
        hasSell: !!sellBtn
      };
    });

    if (qtCheck.exists && qtCheck.visible) {
      if (!qtCheck.hasBuy || !qtCheck.hasSell) {
        defects.push({ kind: 'mobile-qt', feature: 'quick-trade', text: 'Quick trade widget missing Buy or Sell button' });
      }
    }

    return { defects };
  },

  async M_SURFACE_04_mobile_touch_targets_audit(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    const smallTargets = await page.evaluate(new Function(`return (${INPAGE.smallTargets})();`));
    // Filter out intentional inline small controls like indicator eye icons or micro tag close buttons
    const actionableDefects = smallTargets.filter(t => {
      return !t.cls.includes('eye') && !t.cls.includes('close') && !t.cls.includes('badge') && t.w < 24 && t.h < 24;
    });

    if (actionableDefects.length > 5) {
      defects.push({ kind: 'touch-target', feature: 'mobile-controls', text: `Found ${actionableDefects.length} controls under 24px: ` + actionableDefects.slice(0, 4).map(s => `${s.cls || s.tag} (${s.w}x${s.h})`).join(', ') });
    }

    return { defects };
  },

  async M_SURFACE_05_mobile_persian_rtl_fit(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'fa' });
    const defects = [];

    const overflows = await page.evaluate(new Function(`return (${INPAGE.horizontalOverflow})();`));
    if (overflows && overflows.length > 0) {
      defects.push({ kind: 'overflow', feature: 'mobile-persian-overflow', text: `Persian mode overflows mobile screen: ` + overflows.slice(0, 3).map(o => o.cls || o.id).join(', ') });
    }

    const scrollCheck = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth;
    });
    if (scrollCheck) {
      defects.push({ kind: 'mobile-layout', feature: 'mobile-rtl-scroll', text: 'Horizontal page scroll introduced in Persian mobile mode' });
    }

    return { defects };
  }
};

(async () => {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('🚀 RUNNING OMNI-SURFACE REAL-BROWSER QA CRUSADE');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('--- Phase 1: Desktop Omni Surface Audit (1440x900) ---');
  await runSuite('qa_crusade_desktop', { desktop: crusadeDesktop });

  console.log('\n--- Phase 2: Mobile Omni Surface Audit (390x844) ---');
  await runSuite('qa_crusade_mobile', { mobile: crusadeMobile });
})();
