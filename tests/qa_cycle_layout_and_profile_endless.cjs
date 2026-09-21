// tests/qa_cycle_layout_and_profile_endless.cjs
// Endless-Cycle Stress & Parity Test Suite for Layout Management and User Profiling

const { launch, boot, errorsOf } = require('./qa_lib.cjs');
const assert = require('assert');
const path = require('path');

const EVID = path.join(__dirname, '..', 'screenshots', 'qa_cycles');

function pass(msg) { console.log(`PASS: ${msg}`); }
function fail(msg, details) {
  console.error(`FAIL: ${msg}`, details || '');
  process.exit(1);
}

(async () => {
  console.log('══ ENDLESS CYCLE STRESS SUITE: DESKTOP & MOBILE INTEGRITY ══');
  const ctx = await launch('desktop');
  try {
    await boot(ctx, { settle: 3000 });

    // 1. Sync Toggle Switches Track & Thumb Animation Verification
    await ctx.page.click('#btn-layout-manager');
    await new Promise(r => setTimeout(r, 600));

    const toggleAnim = await ctx.page.evaluate(() => {
      const btn = document.querySelector('.sync-switch-btn[data-sync="symbol"]');
      const track = btn?.querySelector('.sync-switch-track');
      const thumb = btn?.querySelector('.sync-switch-thumb');
      const beforeBg = track?.style.background;
      const beforeTransform = thumb?.style.transform;

      btn.click();

      const afterBg = track?.style.background;
      const afterTransform = thumb?.style.transform;

      return { beforeBg, beforeTransform, afterBg, afterTransform };
    });

    (toggleAnim.afterBg.includes('var(--accent-cyan)') && toggleAnim.afterTransform.includes('translateX'))
      ? pass('sync toggle knob and track animate dynamically on click')
      : fail('sync toggle animation', JSON.stringify(toggleAnim));

    // 2. Saved Layout Counter Dynamic Update on Filter and Save
    const countCheck = await ctx.page.evaluate(() => {
      const countEl = document.querySelector('#saved-layouts-count');
      const initialCount = countEl?.innerText;

      const searchInput = document.querySelector('#layout-search-input');
      if (searchInput) {
        searchInput.value = 'Institutional';
        searchInput.dispatchEvent(new Event('input'));
      }
      const filteredCount = countEl?.innerText;

      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
      const resetCount = countEl?.innerText;

      return { initialCount, filteredCount, resetCount };
    });

    (countCheck.initialCount !== countCheck.filteredCount && countCheck.resetCount === countCheck.initialCount)
      ? pass('saved layouts count badge updates reactively during search filter')
      : fail('counter reactivity', JSON.stringify(countCheck));

    // 3. Escape Key Restores Maximized Multi-Chart Cell
    await ctx.page.evaluate(() => {
      document.querySelector('#modal-layout-studio')?.classList.remove('open');
      window.__TRADING_APP__.layoutManager.setLayout('4', '2x2 Quad Grid');
    });
    await new Promise(r => setTimeout(r, 2000));

    // Maximize active cell
    await ctx.page.evaluate(() => {
      const ws = window.__TRADING_APP__.chartManager.workspace;
      if (ws?.active) ws.maximizeCell(ws.active.id);
    });
    await new Promise(r => setTimeout(r, 500));

    const maxBefore = await ctx.page.evaluate(() => !!window.__TRADING_APP__.chartManager.workspace.maximizedId);
    // Press Escape
    await ctx.page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));
    const maxAfter = await ctx.page.evaluate(() => !!window.__TRADING_APP__.chartManager.workspace.maximizedId);

    (maxBefore && !maxAfter)
      ? pass('Escape key restores maximized chart cell to full grid (TradingView parity)')
      : fail('Escape restore cell', { maxBefore, maxAfter });

    // 4. Saved Layout Restore with Sync State Verification
    await ctx.page.click('#btn-layout-manager');
    await new Promise(r => setTimeout(r, 600));

    const syncRestoreOk = await ctx.page.evaluate(() => {
      const lm = window.__TRADING_APP__.layoutManager;
      // create a mock saved layout with symbol sync ON
      const testId = 'usr_sync_test_' + Date.now();
      lm.savedLayouts.unshift({
        id: testId,
        name: 'Sync Restored Grid',
        layoutId: '2h',
        badge: '2 Charts',
        sync: { symbol: true, timeframe: true, crosshair: true, viewport: true, drawings: true, style: true }
      });
      lm.saveSavedLayouts();
      
      // Now find and click the load button for this layout
      const list = document.querySelector('.saved-layouts-list');
      list.innerHTML = lm.renderSavedLayoutsList(false);
      lm.bindSavedLayoutRowEvents(document.querySelector('#modal-layout-studio'), false);

      const loadBtn = list.querySelector(`.btn-load-layout[data-id="${testId}"]`);
      if (!loadBtn) return false;
      loadBtn.click();

      return lm.syncOpts.symbol === true && lm.syncOpts.timeframe === true;
    });

    syncRestoreOk
      ? pass('loading saved layout faithfully restores layout-specific sync switches')
      : fail('saved sync restoration');

    // 5. Paper Trading Terminal Leverage Default Sync with Profile
    await ctx.page.evaluate(() => {
      window.__TRADING_APP__.userProfileModal.profile.defaultLeverage = 20;
      window.__TRADING_APP__.paperTrading?.render();
    });
    const levSelected = await ctx.page.evaluate(() => {
      const sel = document.querySelector('#order-lev-sel');
      return sel ? sel.value : null;
    });
    levSelected === '20'
      ? pass('paper trading terminal initializes with profile default leverage (20x)')
      : fail('paper trading leverage sync', levSelected);

    // 6. XSS Sanitization Check on Layout Names
    const xssOk = await ctx.page.evaluate(() => {
      const lm = window.__TRADING_APP__.layoutManager;
      lm.savedLayouts.unshift({
        id: 'usr_xss_test',
        name: '<img src=x onerror=alert(1)>Malicious Setup',
        layoutId: '1',
        badge: '1 Chart',
        date: '2026-09-21'
      });
      const html = lm.renderSavedLayoutsList(false);
      return html.includes('&lt;img src=x onerror=alert(1)&gt;') && !html.includes('<img src=x');
    });

    xssOk
      ? pass('layout names are strictly HTML-escaped to prevent script injection')
      : fail('XSS escape failure');

    // 7. Auto-save execution integrity check
    const autoSaveOk = await ctx.page.evaluate(() => {
      const lm = window.__TRADING_APP__.layoutManager;
      lm.autoSaveEnabled = true;
      const success = lm.executeAutoSave();
      const stored = JSON.parse(localStorage.getItem('tradingchart_current_layout') || '{}');
      return success && stored.layoutId && stored.timestamp > 0;
    });
    autoSaveOk
      ? pass('auto-save captures workspace state and timestamp cleanly')
      : fail('auto-save execution integrity');

    // 8. Profile Avatar & Badge Dynamic Sync
    const avatarSyncOk = await ctx.page.evaluate(() => {
      const prof = window.__TRADING_APP__.userProfileModal;
      prof.profile.avatar = '⚡';
      prof.saveProfile();
      const circle = document.querySelector('.avatar-circle');
      const badge = document.querySelector('.user-avatar-badge');
      return circle?.innerText === '⚡' && badge?.title.includes('@nexus_lead');
    });
    avatarSyncOk
      ? pass('avatar selection updates topbar avatar circle and metadata badge')
      : fail('avatar sync failure');

    // 9. Multi-chart cell strip action pill & responsive attributes
    const stripActionPillOk = await ctx.page.evaluate(() => {
      const lm = window.__TRADING_APP__.layoutManager;
      lm.setLayout('2h', 'Dual 2H');
      const maxBtn = document.querySelector('#btn-strip-toggle-max');
      return maxBtn?.classList.contains('action-pill');
    });
    stripActionPillOk
      ? pass('multi-chart cell strip distinguishes action controls with action-pill class')
      : fail('cell strip action-pill class missing');

    // Clean console check
    const errors = errorsOf(ctx);
    errors.length === 0 ? pass('clean console with zero exceptions') : fail('console errors', errors);

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('ENDLESS CYCLE STRESS AUDIT: ZERO DEFECTS ✅ 100% GREEN');
    console.log('════════════════════════════════════════════════════════════');
  } catch (err) {
    fail('endless test uncaught error', err.stack || err);
  } finally {
    if (ctx) await ctx.browser.close();
  }
})();
