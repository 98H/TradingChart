// tests/deep_qa_crusade.cjs
// Deep QA Crusade: Comprehensive automated interaction testing of EVERY single feature in TradingChart
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CRUSADE_DIR = path.resolve(__dirname, '../dogfood_crusade');
if (!fs.existsSync(CRUSADE_DIR)) fs.mkdirSync(CRUSADE_DIR, { recursive: true });

async function runCrusade() {
  console.log('================================================================');
  console.log('🏹 STARTING DEEP QA CRUSADE - ALL SURFACES & INTERACTIONS');
  console.log('================================================================\n');

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const issues = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
      console.log('  [Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.log('  [Page Error]', err.message);
  });

  async function snap(name) {
    const p = path.join(CRUSADE_DIR, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`  📸 Saved: ${name}.png`);
    return p;
  }

  try {
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3500));
    await snap('01_crusade_init');

    // ── SURFACE 1: Symbol Search & Navigator ─────────────────────────
    console.log('\n--- Surface 1: Symbol Search & Navigator ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.openSymbolSearch();
    });
    await new Promise(r => setTimeout(r, 600));
    await snap('02_symbol_search_open');

    // Test category filtering inside symbol search
    const symCategories = ['crypto', 'metals', 'forex', 'stocks'];
    for (const cat of symCategories) {
      await page.evaluate((c) => {
        document.querySelector(`.sym-cat-btn[data-cat="${c}"]`)?.click();
      }, cat);
      await new Promise(r => setTimeout(r, 400));
      const count = await page.evaluate(() => document.querySelectorAll('#symbol-results-list .sym-search-row').length);
      console.log(`Symbol search [${cat}] row count:`, count);
      if (count === 0) issues.push(`Symbol search category ${cat} has 0 results`);
    }

    // Type query: "SOL"
    const searchInp = await page.$('#symbol-search-input');
    if (searchInp) {
      await searchInp.click({ clickCount: 3 });
      await searchInp.type('SOL', { delay: 40 });
      await new Promise(r => setTimeout(r, 500));
      await snap('03_symbol_search_sol');

      // Click first result (SOLUSDT)
      const firstRow = await page.$('#symbol-results-list .sym-search-row');
      if (firstRow) {
        await firstRow.click();
        await new Promise(r => setTimeout(r, 1200));
        const currentSym = await page.evaluate(() => window.__TRADING_APP__?.currentSymbol);
        console.log('Current symbol after selection:', currentSym);
        if (currentSym !== 'SOLUSDT') issues.push(`Failed to switch symbol to SOLUSDT, current: ${currentSym}`);
      }
    }
    await snap('04_chart_after_sol_switch');

    // Switch back to BTCUSDT
    await page.evaluate(() => window.__TRADING_APP__?.chartManager?.setSymbol('BTCUSDT'));
    await new Promise(r => setTimeout(r, 1000));

    // ── SURFACE 2: Indicators Modal (84+ Library) ────────────────────
    console.log('\n--- Surface 2: Indicators Library Modal ---');
    await page.evaluate(() => window.__TRADING_APP__?.indicatorsModal?.open());
    await new Promise(r => setTimeout(r, 600));
    await snap('05_indicators_modal');

    // Filter by categories in Indicators Modal using select
    const indCats = ['smc', 'oscillators', 'volatility', 'volume'];
    for (const c of indCats) {
      await page.evaluate((cat) => {
        const sel = document.querySelector('#ind-cat-select');
        if (sel) {
          sel.value = cat;
          sel.dispatchEvent(new Event('change'));
        }
      }, c);
      await new Promise(r => setTimeout(r, 300));
      const indRows = await page.evaluate(() => document.querySelectorAll('#ind-items-container .ind-card-row').length);
      console.log(`Indicator modal [${c}] count:`, indRows);
      if (indRows === 0) issues.push(`Indicator category ${c} returned 0 items`);
    }

    // Search for "RSI"
    const indSearch = await page.$('#indicator-search-input, .ind-search-input');
    if (indSearch) {
      await indSearch.click({ clickCount: 3 });
      await indSearch.type('RSI', { delay: 40 });
      await new Promise(r => setTimeout(r, 400));
      await snap('06_indicators_search_rsi');
    }
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ── SURFACE 3: Compare Symbol Modal ──────────────────────────────
    console.log('\n--- Surface 3: Compare Symbol Modal ---');
    await page.click('#btn-topbar-compare');
    await new Promise(r => setTimeout(r, 600));
    await snap('07_compare_modal_open');

    // Type ETHUSDT into compare
    const compInp = await page.$('#compare-search-input, .compare-modal input');
    if (compInp) {
      await compInp.type('ETH', { delay: 40 });
      await new Promise(r => setTimeout(r, 400));
    }
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ── SURFACE 4: Multi-Chart Layout Studio ─────────────────────────
    console.log('\n--- Surface 4: Multi-Chart Layout Studio ---');
    await page.click('#btn-layout-manager');
    await new Promise(r => setTimeout(r, 600));
    await snap('08_layout_studio_modal');

    const layoutCards = await page.evaluate(() => {
      const cards = document.querySelectorAll('.layout-preset-card');
      return Array.from(cards).map(c => c.innerText.trim().replace(/\n+/g, ' '));
    });
    console.log('Layout presets found:', layoutCards.length, layoutCards);
    if (layoutCards.length < 4) issues.push('Layout presets count is less than 4');

    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ── SURFACE 5: Full-Page Trade Journal View ───────────────────────
    console.log('\n--- Surface 5: Full-Page Trade Journal View ---');
    await page.click('#nav-btn-journal');
    await new Promise(r => setTimeout(r, 800));
    await snap('09_full_page_journal');

    const journalVisible = await page.evaluate(() => {
      const jv = document.querySelector('#journal-workspace-view');
      return jv && jv.style.display !== 'none';
    });
    console.log('Full-Page Journal visible:', journalVisible);
    if (!journalVisible) issues.push('Full-page journal failed to display on nav-btn-journal click');

    // Switch back to Quant chart view
    await page.click('#nav-btn-quant');
    await new Promise(r => setTimeout(r, 800));

    // ── SURFACE 6: + Panels Quick Picker Drawer ──────────────────────
    console.log('\n--- Surface 6: Panels Quick Picker Menu ---');
    await page.click('#nav-btn-panels');
    await new Promise(r => setTimeout(r, 600));
    await snap('10_panels_menu_modal');

    const menuItems = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.panel-menu-item')).map(m => m.querySelector('.panel-item-title')?.innerText.trim());
    });
    console.log('Panel menu tools available:', menuItems);
    if (menuItems.length < 10) issues.push('Panels menu has fewer than 10 tools');

    await page.click('#modal-close-panels-menu');
    await new Promise(r => setTimeout(r, 400));

    // ── SURFACE 7: Bar Replay Engine Interaction ─────────────────────
    console.log('\n--- Surface 7: Bar Replay Engine ---');
    await page.click('#btn-topbar-replay');
    await new Promise(r => setTimeout(r, 700));
    await snap('11_bar_replay_controls');

    // Execute simulated Buy
    await page.click('#btn-replay-buy');
    await new Promise(r => setTimeout(r, 400));
    // Step 2 bars
    await page.click('#btn-replay-step');
    await new Promise(r => setTimeout(r, 500));
    await page.click('#btn-replay-step');
    await new Promise(r => setTimeout(r, 500));
    await snap('12_bar_replay_stepped');

    // Exit Replay
    await page.click('#btn-replay-exit');
    await new Promise(r => setTimeout(r, 500));

    // ── SURFACE 8: All Bottom Suite Tabs (Deep Component Check) ──────
    console.log('\n--- Surface 8: All Bottom Suite Tabs Deep Verification ---');
    await page.evaluate(() => {
      const b = document.querySelector('#bottom-panel');
      if (b && b.classList.contains('collapsed')) {
        document.querySelector('#btn-toggle-bottom-panel')?.click();
      }
    });
    await new Promise(r => setTimeout(r, 600));

    const tabs = ['pine', 'strategy', 'propsim', 'journal', 'trackers', 'calendar', 'screener', 'news'];
    for (const t of tabs) {
      await page.evaluate((view) => {
        document.querySelector(`.panel-tab[data-view="${view}"]`)?.click();
      }, t);
      await new Promise(r => setTimeout(r, 700));
      await snap(`13_tab_${t}_verified`);

      // Deep inspection per tab
      const status = await page.evaluate((view) => {
        const el = document.querySelector(`#view-${view}`);
        if (!el) return { present: false };
        const buttons = el.querySelectorAll('button').length;
        const textLen = el.innerText.trim().length;
        const hasCanvasOrTable = el.querySelectorAll('canvas, table, .screener-table, .trackers-table, .journal-grid').length > 0;
        return { present: true, buttons, textLen, hasCanvasOrTable };
      }, t);
      console.log(`Tab [${t}] internal status:`, status);
      if (!status.present || status.textLen < 20) {
        issues.push(`Tab ${t} appears empty or unmounted`);
      }
    }

    // ── SURFACE 9: Paper Trading Order Execution ─────────────────────
    console.log('\n--- Surface 9: Paper Trading Execution ---');
    await page.click('#desktop-side-rail .rail-btn[data-panel="paper"]');
    await new Promise(r => setTimeout(r, 800));
    await snap('14_paper_trading_panel');

    // Place a paper trade limit order
    const paperInfo = await page.evaluate(() => {
      const p = window.__TRADING_APP__?.paperTrading;
      if (!p) return null;
      return {
        balance: p.balance,
        equity: p.equity,
        positionsCount: Object.keys(p.positions || {}).length,
        ordersCount: (p.orders || []).length
      };
    });
    console.log('Paper Trading status:', paperInfo);

    // ── SURFACE 10: Watchlist 5-Color Flags & Sorting ────────────────
    console.log('\n--- Surface 10: Watchlist 5-Color Flags & Sorting ---');
    await page.click('#desktop-side-rail .rail-btn[data-panel="watchlist"]');
    await new Promise(r => setTimeout(r, 800));
    await snap('15_watchlist_panel');

    // Cycle flag
    await page.evaluate(() => {
      const firstFlag = document.querySelector('.btn-toggle-flag');
      if (firstFlag) firstFlag.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Sort by Change %
    await page.evaluate(() => {
      document.querySelector('.wl-sort-head[data-field="change"]')?.click();
    });
    await new Promise(r => setTimeout(r, 400));
    await snap('16_watchlist_sorted_change');

    // ── SURFACE 11: Canvas Context Menu (Right Click) ─────────────────
    console.log('\n--- Surface 11: Canvas Context Menu ---');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true,
          clientX: r.left + r.width * 0.4,
          clientY: r.top + r.height * 0.4
        }));
      }
    });
    await new Promise(r => setTimeout(r, 500));
    await snap('17_context_menu_open');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    // ── SURFACE 12: Chart Settings Appearance & Watermark ────────────
    console.log('\n--- Surface 12: Chart Settings Modal ---');
    await page.evaluate(() => window.__TRADING_APP__?.settingsModal?.open());
    await new Promise(r => setTimeout(r, 600));
    await snap('18_settings_modal_open');

    // Click each settings tab: Appearance, Scales & Grid, Trading & Sound, System & Language
    const settingTabs = await page.evaluate(() => {
      const tabs = document.querySelectorAll('.settings-tab-btn');
      return Array.from(tabs).map(t => t.innerText.trim().replace(/\n+/g, ' '));
    });
    console.log('Settings tabs found:', settingTabs);

    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ── SURFACE 13: Screenshot Studio Modal ──────────────────────────
    console.log('\n--- Surface 13: Screenshot Studio Modal ---');
    await page.evaluate(() => window.__TRADING_APP__?.screenshotModal?.open());
    await new Promise(r => setTimeout(r, 600));
    await snap('19_screenshot_modal_open');

    const screenshotPreview = await page.evaluate(() => {
      const img = document.querySelector('#screenshot-canvas-preview');
      return img ? { srcLength: img.src?.length || 0 } : null;
    });
    console.log('Screenshot preview image:', screenshotPreview);

    await page.click('#btn-close-screenshot');
    await new Promise(r => setTimeout(r, 400));

    // ── SURFACE 14: Bilingual Persian RTL Mode Thoroughness ──────────
    console.log('\n--- Surface 14: Bilingual Persian RTL Mode Deep Verification ---');
    await page.click('#btn-toggle-lang');
    await new Promise(r => setTimeout(r, 1200));
    await snap('20_persian_deep_view');

    const faChecks = await page.evaluate(() => {
      const htmlDir = document.documentElement.getAttribute('dir');
      const bodyFa = document.body.classList.contains('persian-mode');
      const untranslatedTexts = [];
      
      // Check topbar texts
      document.querySelectorAll('#top-app-header button span').forEach(s => {
        const txt = s.innerText.trim();
        if (txt && /^[A-Z][a-z]+$/.test(txt) && !['BTC', 'ETH', 'SOL', 'USDT', 'USD'].includes(txt)) {
          untranslatedTexts.push(txt);
        }
      });

      return { htmlDir, bodyFa, untranslatedTexts };
    });
    console.log('Persian RTL Deep Check:', faChecks);

    // Switch back to English
    await page.click('#btn-toggle-lang');
    await new Promise(r => setTimeout(r, 800));

    // ── SURFACE 15: Mobile Viewport Touch Ergonomics ─────────────────
    console.log('\n--- Surface 15: Mobile Viewport Touch Ergonomics ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 1000));
    await snap('21_mobile_deep_audit');

    // Test mobile Panels menu
    await page.click('#nav-btn-panels');
    await new Promise(r => setTimeout(r, 600));
    await snap('22_mobile_panels_menu');
    await page.click('#modal-close-panels-menu');
    await new Promise(r => setTimeout(r, 400));

  } catch (err) {
    console.error('Crusade encounter fatal error:', err);
    issues.push(`Fatal: ${err.message}`);
  } finally {
    console.log('\n========================================');
    console.log('CRUSADE AUDIT SUMMARY');
    console.log('Total issues detected:', issues.length);
    console.log('Console errors:', consoleErrors.length);
    console.log('Page errors:', pageErrors.length);
    console.log('========================================');

    fs.writeFileSync(
      path.join(CRUSADE_DIR, 'crusade_results.json'),
      JSON.stringify({ issues, consoleErrors, pageErrors, timestamp: new Date().toISOString() }, null, 2)
    );

    await page.close();
    await browser.disconnect();
  }
}

runCrusade().catch(e => {
  console.error('Crusade failed:', e);
  process.exit(1);
});
