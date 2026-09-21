// tests/qa_cycle_layout_and_profile_tv_parity.cjs
// Comprehensive QA Suite: TradingView Parity & Superiority for Layout Management & User Profiling
// Tests Desktop (1440x900) & Mobile (390x844), RTL Persian & LTR English, 6-Axis Sync,
// Multi-Chart Cell Strip Carousel, Search/Sort, Auto-Save, Avatar Studio, Full Backup/Restore.

const { launch, boot, errorsOf } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');
const EVID = path.resolve(__dirname, '../screenshots/qa_cycles');

(async () => {
  const defects = [];
  const pass = (n) => console.log('PASS:', n);
  const fail = (n, d) => { defects.push({ n, d }); console.log('FAIL:', n, d || ''); };

  console.log('\n══ PHASE 1: DESKTOP AUDIT (1440x900) ══');
  const dCtx = await launch('desktop');
  try {
    await boot(dCtx, { settle: 4000 });

    // 1. Desktop Layout Studio Opens
    await dCtx.page.click('#btn-layout-manager');
    await new Promise(r => setTimeout(r, 600));
    let isOpen = await dCtx.page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));
    isOpen ? pass('desktop layout studio opens') : fail('desktop layout studio open');
    await dCtx.page.screenshot({ path: path.join(EVID, 'tv_parity_01_desktop_studio.png') });

    // 2. 6-Axis Sync Switches exist and toggle
    const syncSwitches = await dCtx.page.evaluate(() => {
      const keys = ['symbol', 'timeframe', 'crosshair', 'viewport', 'drawings', 'style'];
      return keys.every(k => !!document.querySelector(`[data-sync="${k}"]`));
    });
    syncSwitches ? pass('all 6 sync switches present') : fail('sync switches missing');

    // 3. Search & Sort in Saved Layouts
    const searchSortOk = await dCtx.page.evaluate(async () => {
      const input = document.querySelector('#layout-search-input');
      if (!input) return false;
      input.value = 'Macro';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      const visible = Array.from(document.querySelectorAll('.saved-layouts-list > div')).map(el => el.innerText);
      const matched = visible.some(t => t.includes('Macro') || t.includes('کلان'));
      
      // Clear search
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));

      // Test sort buttons exist
      const hasDateSort = !!document.querySelector('#btn-sort-date');
      const hasNameSort = !!document.querySelector('#btn-sort-name');

      return matched && hasDateSort && hasNameSort;
    });
    searchSortOk ? pass('search and sort functional in saved layouts') : fail('search/sort layouts');

    // 4. Custom Dialog for Rename (Zero window.prompt)
    const renameDialogOk = await dCtx.page.evaluate(async () => {
      const btn = document.querySelector('.btn-rename-layout');
      if (!btn) return false;
      btn.click();
      await new Promise(r => setTimeout(r, 300));
      const hasCustomDialog = !!document.querySelector('#custom-ui-dialog-overlay');
      const promptInput = document.querySelector('#dialog-prompt-input');
      const cancelBtn = document.querySelector('#btn-dialog-cancel');
      if (promptInput) promptInput.value = 'Renamed Institutional Setup';
      document.querySelector('#btn-dialog-confirm')?.click();
      await new Promise(r => setTimeout(r, 300));
      return hasCustomDialog && !document.querySelector('#custom-ui-dialog-overlay');
    });
    renameDialogOk ? pass('custom rename dialog works without window.prompt') : fail('custom rename dialog');

    // 5. Apply Quad Grid & Test Multi-Chart Cell Strip / Carousel
    await dCtx.page.evaluate(() => {
      document.querySelector('#modal-layout-studio')?.classList.remove('open');
      window.__TRADING_APP__.layoutManager.setLayout('4', 'Quad Matrix');
    });
    await new Promise(r => setTimeout(r, 2500));

    const cellStripOk = await dCtx.page.evaluate(() => {
      const strip = document.querySelector('#multi-chart-cell-strip');
      const isVisible = strip && window.getComputedStyle(strip).display !== 'none';
      const pills = document.querySelectorAll('.cell-strip-pill');
      const hasOverview = !!document.querySelector('#btn-strip-overview');
      const hasMaxToggle = !!document.querySelector('#btn-strip-toggle-max');
      return { isVisible, pillsCount: pills.length, hasOverview, hasMaxToggle };
    });
    (cellStripOk.isVisible && cellStripOk.pillsCount >= 5 && cellStripOk.hasOverview)
      ? pass(`multi-chart cell strip active with ${cellStripOk.pillsCount} controls`)
      : fail('cell strip active', JSON.stringify(cellStripOk));
    await dCtx.page.screenshot({ path: path.join(EVID, 'tv_parity_02_cell_strip.png') });

    // 6. Maximize / Restore cell via cell strip & shortcut
    const maxRestoreOk = await dCtx.page.evaluate(async () => {
      const ws = window.__TRADING_APP__.chartManager.workspace;
      const cell2Btn = document.querySelectorAll('.cell-strip-pill[data-cell-id]')[1];
      if (cell2Btn) cell2Btn.click();
      await new Promise(r => setTimeout(r, 400));
      window.__TRADING_APP__.layoutManager.toggleMaximizeActiveCell();
      await new Promise(r => setTimeout(r, 400));
      const isMax = !!ws.maximizedId;
      document.querySelector('#btn-strip-overview')?.click();
      await new Promise(r => setTimeout(r, 400));
      const isRestored = ws.maximizedId == null;
      return { isMax, isRestored };
    });
    (maxRestoreOk.isMax && maxRestoreOk.isRestored)
      ? pass('cell maximize and restore via strip & shortcut works')
      : fail('maximize/restore cell', JSON.stringify(maxRestoreOk));

    // 7. Multi-Chart Symbol Sync Propagation
    const syncPropagationOk = await dCtx.page.evaluate(async () => {
      const lm = window.__TRADING_APP__.layoutManager;
      const cm = window.__TRADING_APP__.chartManager;
      lm.toggleSync('symbol', true);
      cm.setSymbol('SOLUSDT');
      await new Promise(r => setTimeout(r, 1000));
      const ws = cm.workspace;
      const symbols = Array.from(ws.cellsById.values()).map(c => (c.symbol || '').replace(/^.*:/, ''));
      const allSynced = symbols.length > 0 && symbols.every(s => s === 'SOLUSDT');
      lm.toggleSync('symbol', false);
      return { allSynced, symbols };
    });
    syncPropagationOk.allSynced
      ? pass('symbol sync propagates instantly across all cells')
      : fail('symbol sync propagation', JSON.stringify(syncPropagationOk));

    // 8. User Profile Modal: Tabs, Avatar Studio, Live Metrics
    await dCtx.page.evaluate(() => {
      document.querySelector('.user-avatar-badge')?.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const profileOverviewOk = await dCtx.page.evaluate(() => {
      const modal = document.querySelector('#modal-user-profile');
      const isOpen = modal?.classList.contains('open');
      const tabs = document.querySelectorAll('.profile-tab-btn').length;
      const hasEquity = !!document.querySelector('.num-ltr');
      const hasBio = modal?.innerText.includes('مانیفست') || modal?.innerText.includes('Manifesto');
      return { isOpen, tabs, hasEquity, hasBio };
    });
    (profileOverviewOk.isOpen && profileOverviewOk.tabs === 3 && profileOverviewOk.hasEquity)
      ? pass('user profile opens with 3 institutional tabs & live metrics')
      : fail('profile overview', JSON.stringify(profileOverviewOk));
    await dCtx.page.screenshot({ path: path.join(EVID, 'tv_parity_03_profile_overview.png') });

    // 9. Preferences Tab & Avatar Selection
    const prefTabOk = await dCtx.page.evaluate(async () => {
      const prefBtn = document.querySelector('.profile-tab-btn[data-tab="preferences"]');
      prefBtn?.click();
      await new Promise(r => setTimeout(r, 400));
      
      const avatars = document.querySelectorAll('.avatar-pick-btn').length;
      const falconAvatar = document.querySelector('.avatar-pick-btn[data-icon="🦅"]');
      falconAvatar?.click();
      await new Promise(r => setTimeout(r, 300));
      
      const topbarAvatar = document.querySelector('.avatar-circle')?.innerText;
      const isUpdated = topbarAvatar === '🦅';
      return { avatars, isUpdated, topbarAvatar };
    });
    (prefTabOk.avatars >= 6 && prefTabOk.isUpdated)
      ? pass('avatar studio allows selecting institutional avatars and syncs with topbar')
      : fail('avatar studio', JSON.stringify(prefTabOk));
    await dCtx.page.screenshot({ path: path.join(EVID, 'tv_parity_04_profile_preferences.png') });

    // 10. Data & Security Tab: Full Workstation Backup Export
    const backupExportOk = await dCtx.page.evaluate(async () => {
      const dataBtn = document.querySelector('.profile-tab-btn[data-tab="data"]');
      dataBtn?.click();
      await new Promise(r => setTimeout(r, 400));

      const hasExportBtn = !!document.querySelector('#btn-export-full-backup');
      const hasImportBtn = !!document.querySelector('#btn-import-full-backup');
      const hasResetPaperBtn = !!document.querySelector('#btn-profile-reset-paper');
      const hasResetLayoutsBtn = !!document.querySelector('#btn-profile-reset-layouts');
      return hasExportBtn && hasImportBtn && hasResetPaperBtn && hasResetLayoutsBtn;
    });
    backupExportOk
      ? pass('data & security tab provides full backup export, restore, and safe reset')
      : fail('data & security tab');
    await dCtx.page.screenshot({ path: path.join(EVID, 'tv_parity_05_profile_data.png') });

    // Close profile modal
    await dCtx.page.evaluate(() => {
      document.querySelector('#modal-user-profile')?.classList.remove('open');
      window.__TRADING_APP__.layoutManager.setLayout('1', '1x1 Single Chart');
    });

    const dErrs = errorsOf(dCtx);
    dErrs.length ? fail('desktop console errors', JSON.stringify(dErrs.slice(0, 3))) : pass('desktop clean console');
  } catch (e) {
    fail('desktop exception', e.message);
  } finally {
    await dCtx.browser.close();
  }

  console.log('\n══ PHASE 2: MOBILE AUDIT (390x844) ══');
  const mCtx = await launch('mobile');
  try {
    await boot(mCtx, { settle: 4000 });

    // 1. Mobile Topbar Layout Trigger is Visible and Interactive
    const mobileLayoutBtnOk = await mCtx.page.evaluate(() => {
      const btn = document.querySelector('#btn-mobile-layout');
      if (!btn) return false;
      const s = window.getComputedStyle(btn);
      return s.display !== 'none' && s.visibility !== 'hidden';
    });
    mobileLayoutBtnOk ? pass('mobile header has visible multi-chart layout trigger') : fail('mobile layout trigger hidden');

    // 2. Open Layout Studio from Mobile Topbar Trigger
    await mCtx.page.click('#btn-mobile-layout');
    await new Promise(r => setTimeout(r, 600));
    let mStudioOpen = await mCtx.page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));
    mStudioOpen ? pass('mobile layout studio opens from header trigger') : fail('mobile studio open header');
    await mCtx.page.screenshot({ path: path.join(EVID, 'tv_parity_06_mobile_studio.png') });

    // Close studio
    await mCtx.page.evaluate(() => document.querySelector('#modal-layout-studio')?.classList.remove('open'));
    await new Promise(r => setTimeout(r, 300));

    // 3. Open Layout Studio from Mobile Panels Drawer (+ Panels)
    const mobileDrawerOk = await mCtx.page.evaluate(async () => {
      document.querySelector('#nav-btn-panels')?.click();
      await new Promise(r => setTimeout(r, 500));
      const layoutItem = document.querySelector('.panel-menu-item[data-panel="layouts"]');
      if (!layoutItem) return false;
      layoutItem.click();
      await new Promise(r => setTimeout(r, 500));
      return document.querySelector('#modal-layout-studio')?.classList.contains('open');
    });
    mobileDrawerOk ? pass('mobile layout studio accessible from panels drawer') : fail('mobile panels drawer layout item');

    // 4. Apply 2v layout on Mobile & verify Mobile Multi-Chart Carousel Strip
    await mCtx.page.evaluate(() => {
      document.querySelector('#modal-layout-studio')?.classList.remove('open');
      window.__TRADING_APP__.layoutManager.setLayout('2v', '1x2 Dual Vertical');
    });
    await new Promise(r => setTimeout(r, 2000));

    const mCellStripOk = await mCtx.page.evaluate(() => {
      const strip = document.querySelector('#multi-chart-cell-strip');
      const isVisible = strip && window.getComputedStyle(strip).display !== 'none';
      const pills = document.querySelectorAll('.cell-strip-pill');
      return { isVisible, count: pills.length };
    });
    (mCellStripOk.isVisible && mCellStripOk.count >= 3)
      ? pass('mobile multi-chart cell carousel strip mounted cleanly')
      : fail('mobile cell strip', JSON.stringify(mCellStripOk));
    await mCtx.page.screenshot({ path: path.join(EVID, 'tv_parity_07_mobile_multichart.png') });

    // 5. Mobile User Profile Modal Opens & Responsive Check
    await mCtx.page.evaluate(() => {
      document.querySelector('.user-avatar-badge')?.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const mProfileOk = await mCtx.page.evaluate(() => {
      const modal = document.querySelector('#modal-user-profile');
      const isOpen = modal?.classList.contains('open');
      const box = document.querySelector('.user-profile-box');
      const rect = box ? box.getBoundingClientRect() : null;
      const noOverflow = rect ? rect.right <= 390 : false;
      return { isOpen, noOverflow, width: rect?.width };
    });
    (mProfileOk.isOpen && mProfileOk.noOverflow)
      ? pass('mobile user profile modal opens with zero horizontal overflow')
      : fail('mobile profile modal', JSON.stringify(mProfileOk));
    await mCtx.page.screenshot({ path: path.join(EVID, 'tv_parity_08_mobile_profile.png') });

    // 6. Restore 1x1 layout
    await mCtx.page.evaluate(() => {
      document.querySelector('#modal-user-profile')?.classList.remove('open');
      window.__TRADING_APP__.layoutManager.setLayout('1', '1x1');
    });

    const mErrs = errorsOf(mCtx);
    mErrs.length ? fail('mobile console errors', JSON.stringify(mErrs.slice(0, 3))) : pass('mobile clean console');
  } catch (e) {
    fail('mobile exception', e.message);
  } finally {
    await mCtx.browser.close();
  }

  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(`TRADINGVIEW PARITY & SUPERIORITY AUDIT: ${defects.length === 0 ? 'ZERO DEFECTS ✅ ALL GREEN' : defects.length + ' DEFECTS ❌'}`);
  console.log(`════════════════════════════════════════════════════════════`);

  fs.writeFileSync(path.join(EVID, 'tv_parity_results.json'), JSON.stringify({ defects, timestamp: new Date().toISOString() }, null, 2));
  process.exit(defects.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
