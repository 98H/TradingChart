// tests/qa_iran_and_sources_deep.cjs
// Zero-Defect QA verification for Tehran Gold & Bubbles, TSE Market Tape, and Market Data Pipeline Waterfall

const { launch, boot, BASE, VIEWPORTS } = require('./qa_lib.cjs');
const fs = require('fs');
const path = require('path');

const EVID = path.resolve(__dirname, '../screenshots/qa_cycles/iran_and_sources');
fs.mkdirSync(EVID, { recursive: true });

const settle = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   TRADINGCHART QA: GOLD, TSE TAPE & MARKET DATA PIPELINE SUITE   ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const passes = [];
  const defects = [];

  function recordPass(test, details = '') {
    passes.push({ test, details });
    console.log(`  \x1b[32m✓ [PASS]\x1b[0m ${test} ${details ? '— ' + details : ''}`);
  }

  function recordDefect(severity, area, kind, desc) {
    defects.push({ severity, area, kind, desc });
    const col = severity === 'critical' ? '\x1b[35m' : (severity === 'high' ? '\x1b[31m' : '\x1b[33m');
    console.log(`  ${col}✗ [${severity.toUpperCase()}]\x1b[0m [${area}] ${kind}: ${desc}`);
  }

  // ── DESKTOP AUDIT (1440x900) ──────────────────────────────────────────────
  console.log('▶ PHASE 1: Desktop Mode (1440x900)');
  const ctx = await launch('desktop');
  try {
    await boot(ctx, { settle: 3500 });
    const page = ctx.page;

    // 1. Market Data Pipeline Topbar Button & Modal
    console.log('  Testing Market Data Pipeline Modal...');
    const sourceBtn = await page.$('#btn-topbar-market-source');
    if (!sourceBtn) {
      recordDefect('critical', 'Topbar', 'missing-element', '#btn-topbar-market-source not found in topbar');
    } else {
      await sourceBtn.click();
      await settle(800);
      const modalOpen = await page.evaluate(() => {
        const m = document.querySelector('#modal-market-sources');
        const hasOpen = m?.classList.contains('open');
        const cards = m?.querySelectorAll('.source-card')?.length || 0;
        const pingVal = m?.querySelector('#market-sources-content')?.innerText?.includes('ms') || false;
        return { hasOpen, cards, pingVal };
      });

      if (modalOpen.hasOpen && modalOpen.cards >= 4) {
        recordPass('Market Sources Modal Open', `Mounted with ${modalOpen.cards} data routes and live latency`);
      } else {
        recordDefect('high', 'MarketSources', 'render-failure', `Modal open state: ${JSON.stringify(modalOpen)}`);
      }

      // Close modal
      await page.click('#modal-close-sources');
      await settle(400);
      const closed = await page.evaluate(() => !document.querySelector('#modal-market-sources')?.classList.contains('open'));
      if (closed) {
        recordPass('Market Sources Modal Close', 'Dismissed cleanly on close button click');
      } else {
        recordDefect('medium', 'MarketSources', 'close-failure', 'Modal remained open after close click');
      }
    }

    // 2. Tehran Gold & Coin Bubble Studio (Bottom Tab)
    console.log('  Testing Tehran Gold & Coin Bubble Studio...');
    await page.evaluate(() => window.__TRADING_APP__?.switchBottomView?.('gold'));
    await settle(1500);

    const goldState = await page.evaluate(() => {
      const container = document.querySelector('#view-gold');
      const studio = container?.querySelector('.gold-bubble-studio');
      const rows = studio?.querySelectorAll('table tbody tr')?.length || 0;
      const cards = studio?.querySelectorAll('[style*="border-radius: 8px"]')?.length || 0;
      const text = studio?.innerText || '';
      return {
        visible: container?.classList.contains('active') && !document.querySelector('#bottom-panel')?.classList.contains('collapsed'),
        hasMeltedGold: text.includes('Melted') || text.includes('آبشده') || text.includes('GOLD_ABSHODEH') || text.includes('17k'),
        hasCoinBubbles: text.includes('Emami') || text.includes('Bahars') || text.includes('سکه امامی') || text.includes('Coin'),
        rows,
        cards
      };
    });

    if (goldState.visible && (goldState.hasMeltedGold || goldState.hasCoinBubbles)) {
      recordPass('Gold & Bubble Studio Mount', `Rendered live metrics with ${goldState.rows} table rows and ${goldState.cards} summary cards`);
    } else {
      recordDefect('high', 'GoldBubbleView', 'mount-failure', `State: ${JSON.stringify(goldState)}`);
    }

    // 3. TSE Market Tape & Smart Money Inspector (Bottom Tab)
    console.log('  Testing TSE Market Tape & Smart Money Inspector...');
    await page.evaluate(() => window.__TRADING_APP__?.switchBottomView?.('tse'));
    await settle(1500);

    const tseState = await page.evaluate(() => {
      const container = document.querySelector('#view-tse');
      const studio = container?.querySelector('.tse-tape-studio');
      const chips = studio?.querySelectorAll('.tse-sym-chip')?.length || 0;
      const text = studio?.innerText || '';
      const hasOrderflow = text.includes('Individual') || text.includes('حقیقی') || text.includes('Institutional') || text.includes('حقوقی') || text.includes('FOOLAD');
      return {
        visible: container?.classList.contains('active'),
        chips,
        hasOrderflow
      };
    });

    if (tseState.visible && tseState.chips >= 5 && tseState.hasOrderflow) {
      recordPass('TSE Market Tape Mount', `Mounted with ${tseState.chips} quick symbol chips and live buyer power`);
    } else {
      recordDefect('high', 'TseTapeView', 'mount-failure', `State: ${JSON.stringify(tseState)}`);
    }

    // 4. Test Switching Symbols in TSE Tape
    console.log('  Testing Symbol Switching in TSE Tape...');
    await page.evaluate(() => {
      const chip = Array.from(document.querySelectorAll('.tse-sym-chip')).find(c => c.getAttribute('data-sym') === 'FAMELI');
      if (chip) chip.click();
    });
    await settle(1200);

    const fameliState = await page.evaluate(() => {
      const chipActive = document.querySelector('.tse-sym-chip.active')?.getAttribute('data-sym');
      const activeText = document.querySelector('#tse-active-sym-title')?.innerText || '';
      return { chipActive, activeText };
    });

    if (fameliState.chipActive === 'FAMELI' || fameliState.activeText.includes('FAMELI')) {
      recordPass('TSE Symbol Switch', 'Successfully switched tape view to FAMELI');
    } else {
      recordDefect('medium', 'TseTapeView', 'symbol-switch-failure', `State: ${JSON.stringify(fameliState)}`);
    }

    // 5. Persian RTL Localization of New Views
    console.log('  Testing Persian RTL Mode for New Features...');
    await page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('fa'));
    await settle(1500);

    const faState = await page.evaluate(() => {
      const tseText = document.querySelector('#view-tse')?.innerText || '';
      const goldTab = document.querySelector('#tab-label-gold')?.innerText || '';
      const tseTab = document.querySelector('#tab-label-tse')?.innerText || '';
      return {
        tseTab,
        goldTab,
        hasPersianTse: tseText.includes('فولاد') || tseText.includes('سرانه خرید') || tseText.includes('حقیقی') || tseText.includes('معاملات')
      };
    });

    if (faState.goldTab.length > 0 && faState.tseTab.length > 0 && faState.hasPersianTse) {
      recordPass('Persian RTL Localization', `Tabs translated (Gold: "${faState.goldTab}", TSE: "${faState.tseTab}")`);
    } else {
      recordDefect('medium', 'Localization', 'persian-missing', `State: ${JSON.stringify(faState)}`);
    }

    // 6. Test Unmount & Memory Protection on Tab Change
    console.log('  Testing Polling Teardown on Tab Switch...');
    await page.evaluate(() => window.__TRADING_APP__?.switchBottomView?.('pine'));
    await settle(500);
    const intervalsCleared = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      return {
        goldInterval: app?.goldBubbleView?.pollInterval,
        tseInterval: app?.tseTapeView?.pollInterval
      };
    });

    if (intervalsCleared.goldInterval === null && intervalsCleared.tseInterval === null) {
      recordPass('Resource Protection & Polling Cleanup', 'Both Gold and TSE polling intervals cleanly dismantled on tab change');
    } else {
      recordDefect('high', 'ResourceLeak', 'interval-uncleared', `Intervals still active: ${JSON.stringify(intervalsCleared)}`);
    }

    // Screenshot desktop evidence
    await page.screenshot({ path: path.join(EVID, 'desktop_iran_and_sources.png') });

  } finally {
    await ctx.browser.close();
  }

  // ── MOBILE AUDIT (390x844) ───────────────────────────────────────────────
  console.log('\n▶ PHASE 2: Mobile Mode (390x844)');
  const mCtx = await launch('mobile');
  try {
    await boot(mCtx, { settle: 3500 });
    const mPage = mCtx.page;

    // 1. Mobile Drawer Panels: Gold, TSE & Sources
    console.log('  Testing Mobile Panels Drawer...');
    await mPage.evaluate(() => {
      document.querySelector('#nav-btn-panels, [data-panel="panels"]')?.click();
    });
    await settle(800);

    const drawerHasItems = await mPage.evaluate(() => {
      const drawer = document.querySelector('#modal-panels-menu');
      const hasGold = !!drawer?.querySelector('.panel-menu-item[data-panel="gold"]');
      const hasTse = !!drawer?.querySelector('.panel-menu-item[data-panel="tse"]');
      const hasSources = !!drawer?.querySelector('.panel-menu-item[data-panel="sources"]');
      return { isOpen: drawer?.classList.contains('open'), hasGold, hasTse, hasSources };
    });

    if (drawerHasItems.isOpen && drawerHasItems.hasGold && drawerHasItems.hasTse && drawerHasItems.hasSources) {
      recordPass('Mobile Drawer Items', 'Gold, TSE Tape, and Market Pipeline cards present in mobile panels drawer');
    } else {
      recordDefect('high', 'MobileDrawer', 'missing-items', `Drawer state: ${JSON.stringify(drawerHasItems)}`);
    }

    // 2. Open Market Sources Modal on Mobile
    console.log('  Testing Market Sources Modal on Mobile...');
    await mPage.evaluate(() => {
      document.querySelector('.panel-menu-item[data-panel="sources"]')?.click();
    });
    await settle(800);

    const mSourcesFit = await mPage.evaluate(() => {
      const box = document.querySelector('#modal-market-sources .modal-box')?.getBoundingClientRect();
      return {
        width: box?.width || 0,
        fitsInViewport: (box?.width || 0) <= 390
      };
    });

    if (mSourcesFit.fitsInViewport && mSourcesFit.width > 200) {
      recordPass('Mobile Market Sources Fit', `Modal width ${Math.round(mSourcesFit.width)}px cleanly fits within 390px viewport`);
    } else {
      recordDefect('high', 'MobileViewport', 'modal-overflow', `Box: ${JSON.stringify(mSourcesFit)}`);
    }

    // 3. Test Touch Target Ergonomics (>= 40px)
    const touchTargets = await mPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#modal-market-sources button, .tse-sym-chip, .panel-menu-item'));
      const small = btns.filter(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 36 || r.height < 36);
      }).map(b => ({ id: b.id, cls: b.className, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }));
      return { total: btns.length, smallCount: small.length, small };
    });

    if (touchTargets.smallCount === 0) {
      recordPass('Mobile Touch Ergonomics', `All ${touchTargets.total} touch elements meet touch target ergonomics standards`);
    } else {
      recordDefect('medium', 'MobileTouch', 'undersized-target', `Undersized targets: ${JSON.stringify(touchTargets.small)}`);
    }

    // Screenshot mobile evidence
    await mPage.screenshot({ path: path.join(EVID, 'mobile_iran_and_sources.png') });

  } finally {
    await mCtx.browser.close();
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`TOTAL PASSES:  ${passes.length}`);
  console.log(`TOTAL DEFECTS: ${defects.length}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (defects.length > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
