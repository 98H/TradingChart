// tests/qa_crusade_wave3.cjs
// Wave 3 Ultimate Zero-Defect Stress & Edge Case Gauntlet
// User Profile & Plans, Replay Controller, Compare Series, Shortcuts,
// Rapid Mobile Drawer Toggling, and 320px RTL Small-Screen Stress.
const { launch, closeAll, boot, errorsOf, INPAGE, runSuite, shots } = require('./qa_lib.cjs');
const assert = require('assert');

const wave3Desktop = {
  async D_W3_01_user_profile_and_plans(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Open User Profile Modal
    await page.evaluate(() => {
      window.__TRADING_APP__?.userProfileModal?.open?.();
    });
    await new Promise(r => setTimeout(r, 600));

    const profileState = await page.evaluate(() => {
      const modal = document.querySelector('.user-profile-box, #modal-user-profile');
      if (!modal) return { open: false };
      const text = modal.innerText || '';
      return {
        open: true,
        hasTier: text.includes('Plan') || text.includes('Pro') || text.includes('Institutional') || text.includes('Free'),
        hasTabs: modal.querySelectorAll('.profile-tab, [data-tab]').length > 0
      };
    });

    if (!profileState.open) {
      defects.push({ kind: 'modal', feature: 'user-profile', text: 'User profile modal did not open' });
    }

    // Close profile modal
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    return { defects };
  },

  async D_W3_02_bar_replay_engine_lifecycle(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Enter replay mode
    await page.evaluate(() => {
      document.querySelector('#btn-topbar-replay, [title*="Replay"]')?.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const replayBar = await page.evaluate(() => {
      const bar = document.querySelector('#replay-control-bar, .replay-toolbar, [class*="replay"]');
      return {
        visible: bar ? getComputedStyle(bar).display !== 'none' : false,
        hasPlay: !!bar?.querySelector('#btn-replay-play, [data-action="play"], button')
      };
    });

    // Exit replay mode
    await page.evaluate(() => {
      const exitBtn = document.querySelector('#btn-replay-exit, [data-action="exit-replay"], .replay-close-btn');
      if (exitBtn) exitBtn.click();
      else document.querySelector('#btn-topbar-replay')?.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const errs = errorsOf(ctx);
    if (errs.length > 0) {
      defects.push({ kind: 'console', feature: 'replay-engine', text: errs.map(e => e.text).join('; ') });
    }
    return { defects };
  },

  async D_W3_03_compare_symbol_lifecycle(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Open Compare modal
    await page.evaluate(() => window.__TRADING_APP__?.compareModal?.open?.());
    await new Promise(r => setTimeout(r, 500));

    // Input comparison symbol
    await page.evaluate(() => {
      const input = document.querySelector('#compare-search-input, #modal-compare input');
      if (input) {
        input.value = 'ETHUSDT';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Close Compare modal
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    const errs = errorsOf(ctx);
    if (errs.length > 0) {
      defects.push({ kind: 'console', feature: 'compare-modal', text: errs.map(e => e.text).join('; ') });
    }
    return { defects };
  },

  async D_W3_04_command_palette_and_keyboard(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Open command palette via Ctrl+K
    await page.keyboard.down('Control');
    await page.keyboard.press('k');
    await page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 500));

    const paletteOpen = await page.evaluate(() => {
      const cp = document.querySelector('#command-palette, .command-palette');
      return cp && (cp.classList.contains('open') || getComputedStyle(cp).display !== 'none');
    });

    if (paletteOpen) {
      // Type search filter
      await page.keyboard.type('Chart');
      await new Promise(r => setTimeout(r, 300));
      // Dismiss
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    // Open Shortcuts help modal via '?'
    await page.keyboard.press('?');
    await new Promise(r => setTimeout(r, 500));

    const shortcutsOpen = await page.evaluate(() => {
      const sm = document.querySelector('#modal-shortcuts');
      return sm && (sm.classList.contains('open') || getComputedStyle(sm).display !== 'none');
    });

    if (shortcutsOpen) {
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
    }

    return { defects };
  }
};

const wave3Mobile = {
  async M_W3_01_rapid_drawer_stress(ctx) {
    const { page } = ctx;
    await boot(ctx, { lang: 'en' });
    const defects = [];

    // Rapid toggle 4x
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const toggle = document.querySelector('#btn-toggle-panels-dock, #btn-mobile-menu, #btn-mobile-drawer');
        toggle?.click();
      });
      await new Promise(r => setTimeout(r, 150));
    }

    // Ensure settled state
    await new Promise(r => setTimeout(r, 400));
    // If open, close cleanly
    await page.evaluate(() => {
      const backdrop = document.querySelector('.mobile-drawer-backdrop, .drawer-close-btn');
      backdrop?.click();
    });
    await new Promise(r => setTimeout(r, 300));

    const lingeringBackdrops = await page.evaluate(() => {
      const drops = Array.from(document.querySelectorAll('.mobile-drawer-backdrop, .modal-backdrop'));
      return drops.filter(d => getComputedStyle(d).display !== 'none' && parseFloat(getComputedStyle(d).opacity) > 0.1).length;
    });

    if (lingeringBackdrops > 0) {
      defects.push({ kind: 'mobile-drawer', feature: 'lingering-backdrop', text: `Found ${lingeringBackdrops} lingering backdrop overlays after toggling` });
    }

    return { defects };
  },

  async M_W3_02_tiny_screen_persian_rtl_stress_320px(ctx) {
    const { page } = ctx;
    await page.setViewport({ width: 320, height: 844, isMobile: true, hasTouch: true });
    await boot(ctx, { lang: 'fa' });
    const defects = [];

    // Check no horizontal scroll in RTL 320px
    const hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (hasScroll) {
      defects.push({ kind: 'mobile-rtl-320', feature: 'h-scroll', text: 'Horizontal page scroll on 320px screen in Persian RTL mode' });
    }

    // Check header elements collision
    const overlaps = await page.evaluate(new Function(`return (${INPAGE.overlaps})();`));
    if (overlaps && overlaps.length > 0) {
      defects.push({ kind: 'mobile-rtl-320', feature: 'header-collision', text: `Collision on 320px RTL: ${overlaps[0].a} and ${overlaps[0].b}` });
    }

    return { defects };
  }
};

(async () => {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('⚡ RUNNING WAVE 3 ULTIMATE ZERO-DEFECT GAUNTLET');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('--- Phase 1: Wave 3 Desktop Gauntlet (1440x900) ---');
  await runSuite('qa_crusade_wave3_desktop', { desktop: wave3Desktop });

  console.log('\n--- Phase 2: Wave 3 Mobile Gauntlet (390x844 & 320x844 RTL) ---');
  await runSuite('qa_crusade_wave3_mobile', { mobile: wave3Mobile });
})();
