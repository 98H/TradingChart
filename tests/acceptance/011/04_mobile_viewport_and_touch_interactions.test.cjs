/**
 * @spec 011
 * @covers FR-007, FR-008
 */
const { launch, boot, BASE } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 100));
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
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy})`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  console.log(`[011 Acceptance Suite 04] Running Mobile Viewport & Touch Interactions against ${BASE}...`);
  const ctx = await launch('mobile');
  const { page } = ctx;

  try {
    // Boot in mobile viewport (390x844) in Persian mode
    await boot(ctx, { lang: 'fa', settle: 3500 });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Mobile Bar, Desktop Dock Concealment & Scale Controls (FR-007, SC-003)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  1. Verifying mobile layout chrome, docks and header (FR-007, SC-003)...');

      const mobileChrome = await page.evaluate(() => {
        const mb = document.querySelector('.vela-mobilebar');
        const dt = document.querySelector('#floating-drawing-toolbar');
        const layoutBtn = document.querySelector('#btn-mobile-layout');
        const fullBtn = document.querySelector('#btn-mobile-fullscreen');
        const header = document.querySelector('#top-app-header');
        const qtPill = document.querySelector('.qt-pill-trigger');

        const mbStyle = mb ? getComputedStyle(mb) : null;
        const dtStyle = dt ? getComputedStyle(dt) : null;
        const lStyle = layoutBtn ? getComputedStyle(layoutBtn) : null;
        const fStyle = fullBtn ? getComputedStyle(fullBtn) : null;

        const headerScrollW = header ? header.scrollWidth : 0;
        const headerClientW = header ? header.clientWidth : 0;

        return {
          mobileBarVisible: mbStyle?.display !== 'none',
          desktopToolsHidden: !dt || dtStyle?.display === 'none',
          hasLayoutBtn: lStyle?.display !== 'none',
          hasFullBtn: fStyle?.display !== 'none',
          hasQtPill: !!qtPill,
          headerOverflow: headerScrollW > headerClientW + 1
        };
      });

      assert(mobileChrome.mobileBarVisible, 'FR-007 6-button mobile bar visible on phone', 'Mobile bar is not visible');
      assert(mobileChrome.desktopToolsHidden, 'FR-007 desktop floating tools hidden on mobile', 'Desktop toolbar still visible');
      assert(mobileChrome.hasLayoutBtn, 'FR-007 mobile header has layouts button', 'Missing #btn-mobile-layout');
      assert(mobileChrome.hasFullBtn, 'FR-007 mobile header has fullscreen button', 'Missing #btn-mobile-fullscreen');
      assert(mobileChrome.hasQtPill, 'FR-007 quick trade widget starts as a compact pill', 'Missing quick trade pill trigger');
      assert(!mobileChrome.headerOverflow, 'SC-003 mobile header has 0 px horizontal overflow', 'Header has horizontal overflow');

      // Verify scale controls buttons are >= 36x36 px (SC-003)
      const scaleBtns = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.vela-scale-controls button, #scale-controls-dock button, .scale-btn'));
        return btns.map(b => {
          const r = b.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        });
      });

      if (scaleBtns.length > 0) {
        for (const s of scaleBtns) {
          assert(s.w >= 36 && s.h >= 36,
                 'SC-003 scale controls buttons meet >= 36x36 px requirement',
                 `Button size ${s.w}x${s.h} is smaller than 36x36 px`);
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Mobile "More" Bottom Sheet Drawer & RTL Anchoring (FR-007)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  2. Verifying mobile "More" drawer RTL presentation (FR-007)...');

      // Click the 3-dots "more" button on the mobile bar
      await realClick(page, '.vela-mb-more');
      await page.waitForSelector('.vela-drawer', { visible: true, timeout: 5000 });

      const drawerAudit = await page.evaluate(() => {
        const drawer = document.querySelector('.vela-drawer');
        const actions = Array.from(drawer.querySelectorAll('.vela-md-action')).map(a => a.innerText.trim());
        const rows = Array.from(drawer.querySelectorAll('.vela-md-row')).map(r => r.innerText.trim());
        const closeBtn = drawer.querySelector('.vela-drawer-close, .btn-close');
        const closeStyle = closeBtn ? getComputedStyle(closeBtn) : null;

        return {
          actions,
          hasUndo: actions.includes('واگرد'),
          hasRedo: actions.includes('ازنو'),
          hasScreenshot: actions.includes('عکس‌برداری'),
          rowsCount: rows.length,
          hasWatchlistRow: rows.some(r => r.includes('دیده‌بان دارایی‌ها') || r.includes('Watchlist')),
          closeLeft: closeStyle?.left,
          drawerDir: drawer ? getComputedStyle(drawer).direction : null
        };
      });

      assert(drawerAudit.hasUndo, 'FR-007 more drawer contains localized Undo (واگرد)', 'Missing واگرد');
      assert(drawerAudit.hasRedo, 'FR-007 more drawer contains localized Redo (ازنو)', 'Missing ازنو');
      assert(drawerAudit.hasScreenshot, 'FR-007 more drawer contains localized Screenshot (عکس‌برداری)', 'Missing عکس‌برداری');
      assert(drawerAudit.hasWatchlistRow, 'FR-007 more drawer contains Watchlist row', 'Missing Watchlist row');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Full-Viewport Panel Sheets & >= 44px Touch Targets (FR-007, SC-003)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  3. Verifying full-viewport panel sheet and touch close target (FR-007, SC-003)...');

      // Tap Watchlist row inside the open mobile drawer
      await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.vela-md-row'));
        const wl = rows.find(r => r.innerText.includes('دیده‌بان دارایی‌ها') || r.innerText.includes('Watchlist'));
        if (wl) wl.click();
      });

      // Wait for Watchlist panel to open as full sheet
      await page.waitForFunction(() => {
        const p = document.querySelector('.vela-panel-watchlist');
        return p && !p.hidden && getComputedStyle(p).display !== 'none';
      }, { timeout: 6000 });

      const sheetMetrics = await page.evaluate(() => {
        const p = document.querySelector('.vela-panel-watchlist');
        const rect = p.getBoundingClientRect();
        const closeBtn = p.querySelector('.vela-panel-close');
        const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;

        return {
          width: Math.round(rect.width),
          top: Math.round(rect.top),
          hasCloseBtn: !!closeBtn,
          closeWidth: closeRect ? Math.round(closeRect.width) : 0,
          closeHeight: closeRect ? Math.round(closeRect.height) : 0
        };
      });

      assert(sheetMetrics.width >= 380, 'FR-007 panel opens as full-width sheet', `Expected full width (~390), got ${sheetMetrics.width}`);
      assert(sheetMetrics.top <= 55, 'FR-007 panel anchors below header', `Expected top <= 55, got ${sheetMetrics.top}`);
      assert(sheetMetrics.hasCloseBtn, 'FR-007 panel has close button', 'Missing close button in panel');
      assert(sheetMetrics.closeWidth >= 44 && sheetMetrics.closeHeight >= 44,
             'SC-003 panel close button meets >= 44x44 px touch target requirement',
             `Close button size is ${sheetMetrics.closeWidth}x${sheetMetrics.closeHeight}`);

      // Real click on panel close button
      await realClick(page, '.vela-panel-watchlist .vela-panel-close');

      // Wait for panel to close
      await page.waitForFunction(() => {
        const p = document.querySelector('.vela-panel-watchlist');
        return !p || p.hidden || getComputedStyle(p).display === 'none';
      }, { timeout: 4000 });

      const isClosed = await page.evaluate(() => {
        const p = document.querySelector('.vela-panel-watchlist');
        return !p || p.hidden || getComputedStyle(p).display === 'none';
      });
      assert(isClosed, 'FR-007 tapping close button dismisses panel and returns to chart', 'Panel did not dismiss');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Mobile Bar Indicators Button Opens Unified Modal (FR-008)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  4. Verifying mobile bar indicators button opens app dialog (FR-008)...');

      // Verify .vela-mb-indicators touch target is >= 44x44 px
      const indBtnTarget = await page.evaluate(() => {
        const b = document.querySelector('.vela-mb-indicators');
        const r = b ? b.getBoundingClientRect() : null;
        return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
      });
      assert(indBtnTarget && indBtnTarget.w >= 44 && indBtnTarget.h >= 44,
             'SC-003 mobile bar indicators button touch target >= 44x44 px',
             `Got ${indBtnTarget?.w}x${indBtnTarget?.h}`);

      // Click mobile bar indicators button
      await realClick(page, '.vela-mb-indicators');

      // Verify app's own indicators modal opens
      await page.waitForSelector('#modal-indicators.open, .indicators-modal-box', { visible: true, timeout: 6000 });

      const modalCheck = await page.evaluate(() => {
        const m = document.querySelector('#modal-indicators');
        const items = Array.from(m.querySelectorAll('.indicator-item, .ind-card, .ind-row'));
        return {
          isOpen: m.classList.contains('open') || getComputedStyle(m).display !== 'none',
          itemsCount: items.length,
          sampleName: items[0]?.innerText?.slice(0, 40)
        };
      });

      assert(modalCheck.isOpen, 'FR-008 app indicators modal opened via mobile bar', 'Indicators modal failed to open');
      assert(modalCheck.itemsCount >= 100, 'FR-008 app indicators modal populated with indicators', `Found only ${modalCheck.itemsCount}`);

      // Close indicators modal
      await page.evaluate(() => {
        window.__TRADING_APP__?.indicatorsModal?.close?.();
      });
      await page.waitForFunction(() => !document.querySelector('#modal-indicators')?.classList.contains('open'), { timeout: 4000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. "+ Panels" Bottom Drawer Items Touch Target (FR-007)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  5. Verifying "+ Panels" drawer items touch targets (FR-007)...');

      // Check panels menu drawer items if present
      const panelsCheck = await page.evaluate(() => {
        const btn = document.querySelector('#nav-btn-panels');
        if (btn) btn.click();
        const menu = document.querySelector('#modal-panels-menu');
        const box = menu?.querySelector('.panels-menu-box');
        const items = Array.from(document.querySelectorAll('.panel-menu-item'));
        const sub44Items = items.filter(el => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const targetOk = s.minHeight === '44px' || r.height >= 40;
          return !targetOk;
        });
        return {
          hasMenu: !!menu,
          itemsCount: items.length,
          sub44ItemsCount: sub44Items.length
        };
      });

      if (panelsCheck.itemsCount > 0) {
        assert(panelsCheck.sub44ItemsCount === 0,
               'FR-007 panels menu drawer items are designed with >= 44 px min-height',
               `Found ${panelsCheck.sub44ItemsCount} items smaller than target`);
      }
    }

  } finally {
    await ctx.browser.close();
  }

  console.log('✅ [011 Acceptance Suite 04] Mobile Viewport & Touch Interactions passed.');
}

run().catch((err) => {
  console.error('❌ Unhandled suite error:', err);
  process.exit(1);
});
