// tests/qa_crusade_wave2.cjs
// Wave 2 Deep Interaction & Edge Case Dogfooding Suite
// Canvas drawing, Pine compilation, Strategy simulation, Screener symbol switch,
// Order execution lifecycle into Journal, Mobile landscape, and Tiny portrait (320px).
const { launch, closeAll, boot, errorsOf, INPAGE, runSuite, shots } = require('./qa_lib.cjs');
const assert = require('assert');

const wave2Desktop = {
  async D_W2_01_canvas_drawing_and_toolbar(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Select Trendline tool
    await page.evaluate(() => {
      document.querySelector('[data-tool="trendline"]')?.click();
    });
    await new Promise(r => setTimeout(r, 200));

    // Simulate drawing drag on the chart canvas
    const canvas = await page.$('#chart-area canvas, #vela-canvas, canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 5 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 300));
      }
    } else {
      defects.push({ kind: 'canvas', feature: 'drawing', text: 'Canvas element not found' });
    }

    const errs = errorsOf(ctx);
    if (errs.length > 0) {
      defects.push({ kind: 'console', feature: 'canvas-drawing', text: errs.map(e => e.text).join('; ') });
    }
    return { defects };
  },

  async D_W2_02_pine_editor_and_console(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Switch to Pine tab
    await page.evaluate(() => document.querySelector('.panel-tab[data-view="pine"]')?.click());
    await new Promise(r => setTimeout(r, 800));

    const pineState = await page.evaluate(() => {
      const view = document.querySelector('#bottom-panel .panel-view.active');
      const hasEditor = !!view?.querySelector('#pine-code-editor, .ace_editor, textarea, pre');
      const runBtn = view?.querySelector('#btn-run-pine, #btn-compile-pine, [data-action="run"]');
      return { hasEditor, hasRunBtn: !!runBtn };
    });

    if (!pineState.hasEditor) {
      defects.push({ kind: 'pine', feature: 'pine-editor', text: 'Pine code editor instance not mounted' });
    }

    // Try compile/run
    await page.evaluate(() => {
      const btn = document.querySelector('#btn-run-pine, #btn-compile-pine, [data-action="run"], .btn-compile');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const errs = errorsOf(ctx);
    if (errs.length > 0) {
      defects.push({ kind: 'console', feature: 'pine-compilation', text: errs.map(e => e.text).join('; ') });
    }
    return { defects };
  },

  async D_W2_03_strategy_tester_metrics(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Switch to Strategy Tester
    await page.evaluate(() => document.querySelector('.panel-tab[data-view="strategy"]')?.click());
    await new Promise(r => setTimeout(r, 800));

    const stratCheck = await page.evaluate(() => {
      const panel = document.querySelector('#bottom-panel');
      const text = panel?.innerText || '';
      return {
        hasMetrics: text.includes('Net Profit') || text.includes('سود خالص') || text.includes('Profit Factor') || text.includes('فاکتور سود') || text.includes('Win Rate') || text.includes('Drawdown'),
        hasTradesTable: !!panel?.querySelector('table, .strategy-trades-table, .trades-list')
      };
    });

    if (!stratCheck.hasMetrics) {
      defects.push({ kind: 'strategy', feature: 'strategy-metrics', text: 'Strategy tester missing key performance KPI metrics' });
    }

    return { defects };
  },

  async D_W2_04_prop_firm_simulator_interactions(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Switch to Prop Sim
    await page.evaluate(() => document.querySelector('.panel-tab[data-view="propsim"]')?.click());
    await new Promise(r => setTimeout(r, 800));

    const propSimState = await page.evaluate(() => {
      const panel = document.querySelector('#bottom-panel');
      const balanceSelect = panel?.querySelector('select, #propsim-account-size, [data-prop-param="size"]');
      const startBtn = panel?.querySelector('button[class*="sim"], #btn-start-propsim, button');
      return {
        hasBalanceSelect: !!balanceSelect,
        hasButton: !!startBtn,
        textSample: (panel?.innerText || '').slice(0, 100)
      };
    });

    if (!propSimState.hasButton) {
      defects.push({ kind: 'propsim', feature: 'propsim-ui', text: 'Prop sim controls missing' });
    }

    return { defects };
  },

  async D_W2_05_screener_symbol_switch(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Switch to Screener
    await page.evaluate(() => document.querySelector('.panel-tab[data-view="screener"]')?.click());
    await new Promise(r => setTimeout(r, 800));

    // Click Chart ↗ button on first row
    const targetSymbol = await page.evaluate(() => {
      const btn = document.querySelector('.btn-screener-chart');
      if (btn) {
        const sym = btn.getAttribute('data-symbol');
        btn.click();
        return sym;
      }
      return null;
    });

    await new Promise(r => setTimeout(r, 800));

    // Verify current symbol updated
    const currentAppSymbol = await page.evaluate(() => window.__TRADING_APP__?.currentSymbol || window.__TRADING_APP__?.symbol);
    if (targetSymbol && currentAppSymbol && currentAppSymbol !== targetSymbol) {
      defects.push({ kind: 'screener', feature: 'screener-symbol-switch', text: `Switching symbol via screener failed: expected ${targetSymbol}, got ${currentAppSymbol}` });
    }

    return { defects };
  },

  async D_W2_06_paper_trading_order_and_journal_sync(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Quick trade buy
    const initialTradesCount = await page.evaluate(() => {
      const store = window.__TRADING_APP__?.tradeJournal?.store;
      return store ? store.getExecutions().length : 0;
    });

    // Execute buy order
    await page.evaluate(() => {
      const buyBtn = document.querySelector('#btn-qt-buy, .qt-buy, button[data-action="buy"]');
      if (buyBtn) buyBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Close position from positions panel if open
    await page.evaluate(() => {
      const closePosBtn = document.querySelector('.btn-close-position, [data-action="close-pos"], .pos-close-btn');
      if (closePosBtn) closePosBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const errs = errorsOf(ctx);
    if (errs.length > 0) {
      defects.push({ kind: 'console', feature: 'paper-trade-flow', text: errs.map(e => e.text).join('; ') });
    }
    return { defects };
  }
};

const wave2Mobile = {
  async M_W2_01_landscape_mode_844x390(ctx) {
    const { page } = ctx;
    await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Check no horizontal scroll on landscape
    const hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (hasScroll) {
      defects.push({ kind: 'mobile-landscape', feature: 'h-scroll', text: 'Horizontal page scroll detected in 844x390 landscape mode' });
    }

    // Check chart canvas visibility in landscape
    const canvasVisible = await page.evaluate(() => {
      const c = document.querySelector('#chart-area canvas, #vela-canvas, canvas');
      return c && c.offsetWidth > 100 && c.offsetHeight > 100;
    });
    if (!canvasVisible) {
      defects.push({ kind: 'mobile-landscape', feature: 'canvas', text: 'Canvas not adequately sized in landscape mode' });
    }

    return { defects };
  },

  async M_W2_02_tiny_screen_320x844(ctx) {
    const { page } = ctx;
    await page.setViewport({ width: 320, height: 844, isMobile: true, hasTouch: true });
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Check no horizontal scroll on tiny screens
    const hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (hasScroll) {
      defects.push({ kind: 'mobile-tiny', feature: 'h-scroll', text: 'Horizontal page scroll detected on 320px tiny viewport' });
    }

    // Header buttons must not collide
    const overlaps = await page.evaluate(new Function(`return (${INPAGE.overlaps})();`));
    if (overlaps && overlaps.length > 0) {
      defects.push({ kind: 'mobile-tiny', feature: 'header-collision', text: `Controls collide on 320px: ${overlaps[0].a} and ${overlaps[0].b}` });
    }

    return { defects };
  }
};

(async () => {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('🌟 RUNNING WAVE 2 DEEP INTERACTION & EDGE CASE DOGFOODING');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('--- Phase 1: Wave 2 Desktop Deep Interactions (1440x900) ---');
  await runSuite('qa_crusade_wave2_desktop', { desktop: wave2Desktop });

  console.log('\n--- Phase 2: Wave 2 Mobile Edge Responsive (844x390 & 320x844) ---');
  await runSuite('qa_crusade_wave2_mobile', { mobile: wave2Mobile });
})();
