/**
 * @spec 002
 * @covers FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, FR-022
 */
const { launch, boot } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
  console.log(`  ✓ ${scenario}`);
}

async function realClick(page, selector, timeout = 6000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  await page.evaluate(el => el.scrollIntoView({ block: 'nearest' }), handle);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Bounding box for ${selector} not available`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const match = await page.evaluate(({ cx, cy, selector }) => {
    const top = document.elementFromPoint(cx, cy);
    const target = document.querySelector(selector);
    if (!top || !target) return false;
    return top === target || target.contains(top) || (top.closest && top.closest(selector) === target);
  }, { cx, cy, selector });
  if (!match) {
    const debug = await page.evaluate(({ cx, cy }) => {
      const top = document.elementFromPoint(cx, cy);
      return { topTag: top?.tagName, topId: top?.id, topClass: top?.className };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(debug)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log('Testing Spec 002: Named Layouts CRUD & Cell Strip (FR-014..022)...');

  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // Provide entitled plan so multi-cell features and multiple saved layouts are accessible
    await page.evaluate(() => {
      const auth = window.__TRADING_APP__.auth;
      auth.user = { plan: 'ultimate' };
      auth.entitlements = auth.plansMeta?.ultimate || { savedLayouts: 30, chartsPerTab: 16 };
      window.__TRADING_APP__.layoutManager.openLayoutStudio();
    });
    await page.waitForFunction(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));

    // ── FR-019: Starter Layouts Exclusion & Quota Count ─────────────────────
    {
      const quotaInfo = await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        return {
          userSavedCount: lm.getUserSavedLayoutsCount(),
          totalSavedCount: lm.savedLayouts.length,
          starterIds: lm.savedLayouts.map(l => l.id)
        };
      });

      assert(quotaInfo.totalSavedCount >= 2, 'FR-019 two starter layouts seeded by default', `Found ${quotaInfo.totalSavedCount} layouts`);
      assert(quotaInfo.starterIds.includes('usr_default') && quotaInfo.starterIds.includes('usr_macro'),
        'FR-019 institutional starter templates present', 'Missing usr_default or usr_macro');
      assert(quotaInfo.userSavedCount === 0, 'FR-019 starter templates excluded from user quota count',
        `Expected 0 user layouts, got ${quotaInfo.userSavedCount}`);
    }

    // ── FR-014: Save Current Workspace as New Named Layout ──────────────────
    let createdLayoutId = null;
    {
      await page.evaluate(() => {
        const input = document.querySelector('#new-layout-name-input');
        if (input) input.value = 'Alpha Swing Surveillance';
      });
      await realClick(page, '#btn-save-as-new-layout');
      await page.waitForFunction(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        return lm.savedLayouts[0]?.name === 'Alpha Swing Surveillance';
      });

      const saveRes = await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        const first = lm.savedLayouts[0];
        const isCurrentActive = lm.activeSavedLayoutId === first.id;
        return {
          id: first.id,
          name: first.name,
          badge: first.badge,
          date: first.date,
          isCurrentActive,
          userCount: lm.getUserSavedLayoutsCount()
        };
      });

      createdLayoutId = saveRes.id;
      assert(saveRes.name === 'Alpha Swing Surveillance', 'FR-014 save current layout name matches', `Expected "Alpha Swing Surveillance", got ${saveRes.name}`);
      assert(saveRes.isCurrentActive, 'FR-014 newly saved layout marked ACTIVE', 'Active saved layout id mismatch');
      assert(saveRes.userCount === 1, 'FR-014 user saved layouts count increments by 1', `Expected 1, got ${saveRes.userCount}`);
      assert(saveRes.badge && saveRes.date, 'FR-014 saved layout has chart-count badge and date', 'Missing badge or date');
    }

    // ── FR-014: In-place Search and Sort (Name & Date) ───────────────────────
    {
      // In-place text filter: input does not lose focus
      await page.focus('#layout-search-input');
      await page.type('#layout-search-input', 'Alpha', { delay: 20 });
      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('.saved-layout-card, #saved-layouts-list > div');
        return rows.length === 1;
      });

      const isInputFocused = await page.evaluate(() => document.activeElement === document.querySelector('#layout-search-input'));
      assert(isInputFocused, 'FR-014 search input keeps focus while filtering', 'Search input lost focus');

      const filteredCount = await page.evaluate(() => document.querySelectorAll('.saved-layout-card, #saved-layouts-list > div').length);
      assert(filteredCount === 1, 'FR-014 search filters list in place', `Expected 1 match, got ${filteredCount}`);

      // Clear search input
      await page.evaluate(() => {
        const inp = document.querySelector('#layout-search-input');
        if (inp) {
          inp.value = '';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.waitForFunction(() => document.querySelectorAll('.saved-layout-card, #saved-layouts-list > div').length >= 3);

      // Sort by Name
      await realClick(page, '#btn-sort-name');
      await page.waitForFunction(() => window.__TRADING_APP__.layoutManager.sortBy === 'name');
      assert(await page.evaluate(() => window.__TRADING_APP__.layoutManager.sortBy === 'name'),
        'FR-014 sort by name active', 'Expected sortBy to be "name"');

      // Sort by Date
      await realClick(page, '#btn-sort-date');
      await page.waitForFunction(() => window.__TRADING_APP__.layoutManager.sortBy === 'date');
      assert(await page.evaluate(() => window.__TRADING_APP__.layoutManager.sortBy === 'date'),
        'FR-014 sort by date active', 'Expected sortBy to be "date"');
    }

    // ── FR-014 & FR-017: In-app Rename Dialog (Zero window.prompt) ──────────
    {
      const renameBtnSelector = `.btn-rename-layout[data-id="${createdLayoutId}"]`;
      await realClick(page, renameBtnSelector);
      await page.waitForSelector('#custom-ui-dialog-overlay', { visible: true, timeout: 5000 });

      const dialogVisible = await page.evaluate(() => {
        const overlay = document.querySelector('#custom-ui-dialog-overlay');
        const input = document.querySelector('#dialog-prompt-input');
        return !!overlay && !!input;
      });
      assert(dialogVisible, 'FR-017 in-app prompt dialog for rename', 'Expected #custom-ui-dialog-overlay');

      // Submit new name
      await page.evaluate(() => {
        const inp = document.querySelector('#dialog-prompt-input');
        if (inp) inp.value = 'Alpha Surveillance Matrix';
      });
      await realClick(page, '#btn-dialog-confirm');
      await page.waitForFunction(() => !document.querySelector('#custom-ui-dialog-overlay'));

      const renamedName = await page.evaluate((id) => {
        const lm = window.__TRADING_APP__.layoutManager;
        return lm.savedLayouts.find(l => l.id === id)?.name;
      }, createdLayoutId);
      assert(renamedName === 'Alpha Surveillance Matrix', 'FR-014 layout renamed via in-app dialog', `Expected "Alpha Surveillance Matrix", got ${renamedName}`);
    }

    // ── FR-014: Duplicate Layout ─────────────────────────────────────────────
    let duplicatedLayoutId = null;
    {
      const dupBtnSelector = `.btn-dup-layout[data-id="${createdLayoutId}"]`;
      await realClick(page, dupBtnSelector);
      await page.waitForFunction(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        return lm.savedLayouts.some(l => l.name.includes('(Copy)') || l.name.includes('(کپی)'));
      });

      const dupInfo = await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        const copy = lm.savedLayouts.find(l => l.name.includes('(Copy)') || l.name.includes('(کپی)'));
        return { id: copy?.id, name: copy?.name, userCount: lm.getUserSavedLayoutsCount() };
      });

      duplicatedLayoutId = dupInfo.id;
      assert(dupInfo.name.includes('Copy') || dupInfo.name.includes('کپی'), 'FR-014 duplicate creates copy', `Expected copy name, got ${dupInfo.name}`);
      assert(dupInfo.userCount === 2, 'FR-014 user count after duplicate is 2', `Expected 2, got ${dupInfo.userCount}`);
    }

    // ── FR-018: Export & Import JSON Validation ─────────────────────────────
    {
      const exportedJson = await page.evaluate((id) => window.__TRADING_APP__.layoutManager.exportLayout(id), createdLayoutId);
      assert(typeof exportedJson === 'string' && exportedJson.includes('__tradingchart_layout'),
        'FR-018 export contains layout marker', 'Missing __tradingchart_layout marker in export');

      // Reject invalid file (missing marker or missing layoutId)
      const invalidImport = await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        const bad1 = lm.importLayout('{"invalid": true}');
        const bad2 = lm.importLayout('{"__tradingchart_layout": true}'); // missing layoutId
        return { bad1, bad2 };
      });
      assert(invalidImport.bad1 == null && invalidImport.bad2 == null, 'FR-018 import rejects invalid files', 'Invalid files accepted');

      // Valid import round-trip
      const importedLayout = await page.evaluate((json) => {
        return window.__TRADING_APP__.layoutManager.importLayout(json, { enforcePlan: false });
      }, exportedJson);
      assert(importedLayout && importedLayout.id && importedLayout.id !== createdLayoutId,
        'FR-018 import assigns fresh unique ID', `Import ID should differ: ${importedLayout?.id}`);

      // Clean up imported layout
      if (importedLayout?.id) {
        await page.evaluate((id) => {
          const lm = window.__TRADING_APP__.layoutManager;
          lm.savedLayouts = lm.savedLayouts.filter(l => l.id !== id);
          lm.saveSavedLayouts();
        }, importedLayout.id);
      }
    }

    // ── FR-015: Loading Named Layout Restores Its Saved Sync Settings ────────
    {
      // Modify current sync settings
      await page.evaluate(() => {
        const lm = window.__TRADING_APP__.layoutManager;
        lm.toggleSync('symbol', true);
        lm.toggleSync('timeframe', true);
      });

      // Load starter layout usr_default (which has symbol: false, timeframe: false)
      const loadBtnSelector = `.btn-load-layout[data-id="usr_default"]`;
      await realClick(page, loadBtnSelector);
      await page.waitForFunction(() => window.__TRADING_APP__.layoutManager.activeSavedLayoutId === 'usr_default');
      // Wait for layout to finish restoring asynchronously
      await page.waitForFunction(() => (window.__TRADING_APP__.chartManager?.workspace?.cellsById?.size || 0) >= 4);
      await new Promise(r => setTimeout(r, 600));

      const restoredSync = await page.evaluate(() => window.__TRADING_APP__.layoutManager.syncOpts);
      assert(restoredSync.symbol === false && restoredSync.timeframe === false,
        'FR-015 loading named layout restores its saved sync options', `Expected symbol/tf false, got ${JSON.stringify(restoredSync)}`);
    }

    // ── FR-016: Active Named Layout Auto-Updates on Changes ──────────────────
    {
      await page.evaluate((id) => {
        const lm = window.__TRADING_APP__.layoutManager;
        const target = lm.savedLayouts.find(l => l.id === id);
        if (target) {
          lm.activeLayoutId = target.layoutId;
          lm.activeLayoutName = target.name;
          lm.activeSavedLayoutId = target.id;
        }
        window.__TRADING_APP__.chartManager.setSymbol('XAUUSD');
        lm.persistCurrentLayout();
      }, createdLayoutId);
      await page.waitForFunction((id) => {
        const lm = window.__TRADING_APP__.layoutManager;
        const entry = lm.savedLayouts.find(l => l.id === id);
        return entry?.state?.cells?.[0]?.symbol?.includes('XAUUSD');
      }, { timeout: 10000 }, createdLayoutId);

      const updatedSavedEntry = await page.evaluate((id) => {
        const lm = window.__TRADING_APP__.layoutManager;
        return lm.savedLayouts.find(l => l.id === id);
      }, createdLayoutId);

      assert(updatedSavedEntry && updatedSavedEntry.state?.cells?.[0]?.symbol?.includes('XAUUSD'),
        'FR-016 active named layout updated on workspace persist', 'Saved entry state symbol was not updated');
    }

    // ── FR-014 & FR-017: In-app Destructive Delete Dialog & Active Detach ────
    {
      await page.evaluate((id) => {
        const lm = window.__TRADING_APP__.layoutManager;
        const target = lm.savedLayouts.find(l => l.id === id);
        if (target) {
          lm.activeLayoutId = target.layoutId;
          lm.activeLayoutName = target.name;
          lm.activeSavedLayoutId = target.id;
        }
        lm.openLayoutStudio();
      }, createdLayoutId);
      await page.waitForFunction(() => document.querySelector('#modal-layout-studio')?.classList.contains('open'));

      const delBtnSelector = `.btn-del-layout[data-id="${createdLayoutId}"]`;
      await realClick(page, delBtnSelector);
      await page.waitForSelector('#custom-ui-dialog-overlay', { visible: true, timeout: 5000 });

      const isDangerConfirm = await page.evaluate(() => {
        const overlay = document.querySelector('#custom-ui-dialog-overlay');
        const confirmBtn = document.querySelector('#btn-dialog-confirm');
        const isRed = confirmBtn && (confirmBtn.classList.contains('btn-danger') || getComputedStyle(confirmBtn).backgroundColor.includes('239') || getComputedStyle(confirmBtn).color.includes('239'));
        return !!overlay && isRed;
      });
      assert(isDangerConfirm, 'FR-017 delete dialog presented as destructive', 'Destructive styling missing on confirm button');

      // Confirm deletion
      await realClick(page, '#btn-dialog-confirm');
      await page.waitForFunction(() => !document.querySelector('#custom-ui-dialog-overlay'));

      const postDel = await page.evaluate((id) => {
        const lm = window.__TRADING_APP__.layoutManager;
        const exists = lm.savedLayouts.some(l => l.id === id);
        const detached = lm.activeSavedLayoutId === null;
        return { exists, detached };
      }, createdLayoutId);

      assert(!postDel.exists, 'FR-014 layout deleted from list', 'Deleted layout still exists');
      assert(postDel.detached, 'Edge Case deleting active layout detaches it', 'activeSavedLayoutId should be null');

      // Clean up duplicated layout
      if (duplicatedLayoutId) {
        await page.evaluate((id) => {
          const lm = window.__TRADING_APP__.layoutManager;
          lm.savedLayouts = lm.savedLayouts.filter(l => l.id !== id);
          lm.saveSavedLayouts();
        }, duplicatedLayoutId);
      }
    }

    // ── FR-020: Floating Cell Strip in Multi-Chart vs Hidden in 1x1 ─────────
    {
      // In 1x1 mode, strip must be hidden
      await page.evaluate(() => {
        document.querySelector('#modal-layout-studio')?.classList.remove('open');
        window.__TRADING_APP__.layoutManager.setLayout('1', '1x1');
      });
      await page.waitForFunction(() => (window.__TRADING_APP__.chartManager?.workspace?.cellsById?.size || 0) <= 1);

      const isHiddenIn1x1 = await page.evaluate(() => {
        const strip = document.querySelector('#multi-chart-cell-strip');
        return !strip || getComputedStyle(strip).display === 'none';
      });
      assert(isHiddenIn1x1, 'FR-020 cell strip hidden in 1x1 mode', 'Cell strip visible in 1x1');

      // Apply 2x2 grid: strip must become visible with All Grid, 4 pills, and Maximize
      await page.evaluate(() => window.__TRADING_APP__.layoutManager.setLayout('4', 'Quad'));
      await page.waitForFunction(() => (window.__TRADING_APP__.chartManager?.workspace?.cellsById?.size || 0) >= 4);
      await page.waitForSelector('#multi-chart-cell-strip', { visible: true, timeout: 5000 });

      const stripControls = await page.evaluate(() => {
        const strip = document.querySelector('#multi-chart-cell-strip');
        const hasOverview = !!document.querySelector('#btn-strip-overview');
        const pills = document.querySelectorAll('.cell-strip-pill[data-cell-id]');
        const hasToggleMax = !!document.querySelector('#btn-strip-toggle-max');
        return { isVisible: strip && getComputedStyle(strip).display !== 'none', hasOverview, pillCount: pills.length, hasToggleMax };
      });

      assert(stripControls.isVisible, 'FR-020 cell strip visible in 2x2 grid', 'Cell strip not visible');
      assert(stripControls.hasOverview, 'FR-020 cell strip has All Grid overview button', 'Missing #btn-strip-overview');
      assert(stripControls.pillCount >= 4, 'FR-020 cell strip has 4 cell pills', `Expected >= 4 pills, got ${stripControls.pillCount}`);
      assert(stripControls.hasToggleMax, 'FR-020 cell strip has toggle maximize button', 'Missing #btn-strip-toggle-max');
    }

    // ── FR-021: Maximize and Restore Active Cell (Strip & Escape) ────────────
    {
      // 1. Maximize via strip button
      await realClick(page, '#btn-strip-toggle-max');
      await page.waitForFunction(() => !!window.__TRADING_APP__.chartManager.workspace.maximizedId);

      const maxState = await page.evaluate(() => {
        const ws = window.__TRADING_APP__.chartManager.workspace;
        const btnText = document.querySelector('#btn-strip-toggle-max')?.innerText || '';
        return { isMax: !!ws.maximizedId, btnText };
      });
      assert(maxState.isMax, 'FR-021 active cell maximized via strip button', 'maximizedId is null');
      assert(maxState.btnText.includes('Restore') || maxState.btnText.includes('خروج'),
        'FR-021 maximize button flips to Restore', `Button text was: ${maxState.btnText}`);

      // 2. Restore via Escape key
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__TRADING_APP__.chartManager.workspace.maximizedId == null);
      const isRestoredViaEsc = await page.evaluate(() => window.__TRADING_APP__.chartManager.workspace.maximizedId == null);
      assert(isRestoredViaEsc, 'FR-021 grid restored via Escape key', 'Grid not restored after Escape');

      // 3. Maximize via Alt+Enter, restore via Alt+Enter
      await page.keyboard.down('Alt');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Alt');
      await page.waitForFunction(() => !!window.__TRADING_APP__.chartManager.workspace.maximizedId);
      assert(await page.evaluate(() => !!window.__TRADING_APP__.chartManager.workspace.maximizedId),
        'FR-021 maximize via Alt+Enter', 'Alt+Enter did not maximize cell');

      await page.keyboard.down('Alt');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Alt');
      await page.waitForFunction(() => window.__TRADING_APP__.chartManager.workspace.maximizedId == null);
      assert(await page.evaluate(() => window.__TRADING_APP__.chartManager.workspace.maximizedId == null),
        'FR-021 restore via Alt+Enter again', 'Alt+Enter did not restore grid');
    }

    // ── FR-022: Mobile Viewport (<= 768px) Tap-to-Maximize ──────────────────
    {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.waitForSelector('.cell-strip-pill[data-cell-id]', { visible: true, timeout: 5000 });

      // Tap cell pill on mobile width: activates AND maximizes cell
      await page.evaluate(() => {
        const pill = document.querySelector('.cell-strip-pill[data-cell-id]');
        pill?.click();
      });
      await page.waitForFunction(() => !!window.__TRADING_APP__.chartManager.workspace.maximizedId);

      const mobileMaximized = await page.evaluate(() => ({
        maximizedId: window.__TRADING_APP__.chartManager.workspace.maximizedId,
        innerW: window.innerWidth
      }));

      assert(mobileMaximized.innerW <= 768, 'FR-022 mobile width check', `Width was ${mobileMaximized.innerW}`);
      assert(!!mobileMaximized.maximizedId, 'FR-022 mobile cell tap activates and maximizes', 'Cell did not maximize on mobile tap');

      // Cleanup: restore grid and return to 1x1
      await page.evaluate(() => {
        window.__TRADING_APP__.chartManager.workspace.clearMaximized();
        window.__TRADING_APP__.layoutManager.setLayout('1', '1x1');
      });
    }

    console.log('✔ Spec 002 Named Layouts CRUD & Cell Strip Acceptance Tests Passed.');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error('❌ Named Layouts CRUD & Cell Strip fatal error:', err.message);
  process.exit(1);
});
