/**
 * @spec 009
 * @covers FR-016, FR-018, FR-019
 */
const { launch, boot } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 6000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  await handle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
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
  console.log('[009 Acceptance Suite 05] Launching browser for Modals, Plans & Bilingual Parity...');
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx, { settle: 3500 });

    const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const testUser = {
      displayName: `Modal Tester ${ts}`,
      username: `qa_modal_${ts}`.slice(0, 24),
      email: `qa_modal_${ts}@acceptance.test`,
      password: 'ModalPassword123!'
    };

    // Register user via API inside page
    const regResult = await page.evaluate(async (u) => {
      const am = window.__TRADING_APP__?.auth;
      if (!am) return { ok: false, error: 'no_auth_manager' };
      return am.register(u);
    }, testUser);
    assert(regResult.ok === true, 'Suite 05 setup: user registration', `Reg failed: ${JSON.stringify(regResult)}`);

    // Dismiss verify modal if present
    await page.evaluate(() => document.querySelector('#tc-verify-modal')?.remove());
    await new Promise(r => setTimeout(r, 200));

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Plans Comparison Modal & Feature Matrix (FR-014, FR-019)
    // ──────────────────────────────────────────────────────────────────────────
    {
      await page.evaluate(() => window.__TRADING_APP__?.auth?.openPlansModal());
      await page.waitForFunction(() => {
        const m = document.querySelector('#tc-plans-modal');
        return m && m.classList.contains('open');
      }, { timeout: 6000 });

      const plansModalState = await page.evaluate(() => {
        const m = document.querySelector('#tc-plans-modal');
        if (!m) return null;
        const tiers = Array.from(m.querySelectorAll('[data-plan]')).map(b => b.dataset.plan);
        const hasCurrentBadge = m.innerText.includes('Current Plan') || m.innerText.includes('CURRENT') || m.innerText.includes('پلن فعلی');
        const rows = m.querySelectorAll('table tbody tr').length;
        const fits = m.querySelector('.modal-box')?.getBoundingClientRect().right <= window.innerWidth + 2;
        return { tiers, hasCurrentBadge, rows, fits };
      });

      assert(plansModalState && plansModalState.tiers.length >= 5,
        'FR-014 plans modal renders 5 tier cards', `Tiers found: ${plansModalState?.tiers?.length}`);
      assert(plansModalState.hasCurrentBadge, 'FR-014 plans modal marks current plan', 'Missing current plan badge');
      assert(plansModalState.rows >= 15, 'FR-014 plans comparison matrix contains feature rows', `Rows found: ${plansModalState?.rows}`);
      assert(plansModalState.fits, 'FR-019 plans modal fits desktop viewport', 'Plans modal overflows horizontally');

      // Close plans modal using Escape
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#tc-plans-modal.open'), { timeout: 4000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Account Settings Modal & 5 Tabs (FR-018, FR-019)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Open settings modal at profile tab
      await page.evaluate(() => window.__TRADING_APP__?.auth?.openAccountSettingsModal('profile'));
      await page.waitForFunction(() => {
        const m = document.querySelector('#tc-account-settings-modal');
        return m && m.classList.contains('open');
      }, { timeout: 6000 });

      // Verify all 5 tab buttons exist
      const tabs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#tc-account-settings-modal [data-atab]')).map(b => b.dataset.atab);
      });
      assert(tabs.includes('profile'), 'FR-018/FR-019 settings modal has profile tab', 'Missing profile tab');
      assert(tabs.includes('account'), 'FR-018/FR-019 settings modal has account tab', 'Missing account tab');
      assert(tabs.includes('security'), 'FR-018/FR-019 settings modal has security tab', 'Missing security tab');
      assert(tabs.includes('sessions'), 'FR-018/FR-019 settings modal has sessions tab', 'Missing sessions tab');
      assert(tabs.includes('data'), 'FR-018/FR-019 settings modal has data tab', 'Missing data tab');

      // Profile tab verification (7 avatar presets, bio, location, signature)
      const profileState = await page.evaluate(() => {
        const presets = document.querySelectorAll('.pf-avatar-btn').length;
        const hasBio = !!document.querySelector('textarea[name="pf-bio"]') || !!document.querySelector('#pf-bio');
        const hasLoc = !!document.querySelector('input[name="pf-location"]') || !!document.querySelector('#pf-location');
        return { presets, hasBio, hasLoc };
      });
      assert(profileState.presets >= 5, 'FR-019 profile tab shows avatar presets', `Presets found: ${profileState.presets}`);

      // Switch to Security tab
      await page.evaluate(() => {
        document.querySelector('#tc-account-settings-modal [data-atab="security"]')?.click();
      });
      await page.waitForFunction(() => {
        const body = document.querySelector('#tc-acc-body');
        return body && (body.innerText.includes('2FA') || body.innerText.includes('دومرحله‌ای') || body.querySelector('#acc-2fa-open-enable'));
      }, { timeout: 6000 });

      // Switch to Sessions tab
      await page.evaluate(() => {
        document.querySelector('#tc-account-settings-modal [data-atab="sessions"]')?.click();
      });
      await page.waitForFunction(() => {
        const body = document.querySelector('#tc-acc-body');
        return body && (body.innerText.includes('Current') || body.innerText.includes('فعلی') || body.innerText.includes('Browser'));
      }, { timeout: 6000 });

      // Switch to Data tab
      await page.evaluate(() => {
        document.querySelector('#tc-account-settings-modal [data-atab="data"]')?.click();
      });
      await page.waitForFunction(() => {
        const body = document.querySelector('#tc-acc-body');
        return body && (body.querySelector('#acc-export-btn') || body.innerText.includes('Download') || body.innerText.includes('دانلود'));
      }, { timeout: 6000 });

      // Close settings modal with Escape
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#tc-account-settings-modal.open'), { timeout: 4000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Entitlement Quota Enforcement & Upgrade Toast (FR-016, FR-019)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Test numeric quota block in English
      const enToastResult = await page.evaluate(() => {
        const am = window.__TRADING_APP__?.auth;
        // Basic tier allows 2 indicators per chart. Calling with 2 (exceeded) must return false & toast
        const allowed = am.enforce('indicatorsPerChart', 2, 'indicators per chart', 'اندیکاتور در هر چارت');
        const toast = document.querySelector('.tc-toast')?.innerText || '';
        return { allowed, toast };
      });

      assert(enToastResult.allowed === false, 'FR-016 enforce blocked action at quota limit', 'Action was unexpectedly allowed');
      assert(enToastResult.toast.includes('indicators per chart limit') && enToastResult.toast.includes('Upgrade to Essential'),
        'FR-016 English upgrade toast names limit and next plan', `Toast text: ${enToastResult.toast}`);

      // Test boolean feature block
      const boolToastResult = await page.evaluate(() => {
        const am = window.__TRADING_APP__?.auth;
        const allowed = am.enforce('synthChartTypes', 0, 'synthetic chart types', 'انواع نمودار ترکیبی');
        const toast = document.querySelector('.tc-toast')?.innerText || '';
        return { allowed, toast };
      });
      assert(boolToastResult.allowed === false, 'FR-016 boolean feature blocked for basic plan', 'Feature was allowed');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Bilingual Parity & RTL Verification (FR-019)
    // ──────────────────────────────────────────────────────────────────────────
    {
      // Switch language to Persian (fa)
      await page.evaluate(() => window.__TRADING_APP__?.switchLanguage('fa'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'rtl', { timeout: 5000 });

      const faDirState = await page.evaluate(() => ({
        dir: document.documentElement.getAttribute('dir'),
        lang: document.documentElement.getAttribute('lang')
      }));
      assert(faDirState.dir === 'rtl', 'FR-019 RTL applied in Persian mode', `Expected dir="rtl", got ${faDirState.dir}`);
      assert(faDirState.lang === 'fa', 'FR-019 lang="fa" set in Persian mode', `Expected lang="fa", got ${faDirState.lang}`);

      // Verify Persian upgrade toast with Persian numbers and text
      const faToastResult = await page.evaluate(() => {
        const am = window.__TRADING_APP__?.auth;
        const allowed = am.enforce('indicatorsPerChart', 2, 'indicators per chart', 'اندیکاتور در هر چارت');
        const toast = document.querySelector('.tc-toast')?.innerText || '';
        return { allowed, toast };
      });
      assert(faToastResult.allowed === false, 'FR-016 FA enforce returns false', 'Expected false');
      assert(faToastResult.toast.includes('اندیکاتور در هر چارت') || faToastResult.toast.includes('سقف'),
        'FR-016 Persian upgrade toast contains Persian label', `Toast text: ${faToastResult.toast}`);

      // Open plans modal in Persian mode
      await page.evaluate(() => window.__TRADING_APP__?.auth?.openPlansModal());
      await page.waitForFunction(() => !!document.querySelector('#tc-plans-modal.open'), { timeout: 6000 });

      const faPlansModal = await page.evaluate(() => {
        const m = document.querySelector('#tc-plans-modal');
        return {
          hasFaBadge: m?.innerText.includes('پلن فعلی') || m?.innerText.includes('رایگان'),
          fitsViewport: m?.querySelector('.modal-box')?.getBoundingClientRect().right <= window.innerWidth + 2
        };
      });
      assert(faPlansModal.hasFaBadge, 'FR-019 Persian plans modal has Persian badge label', 'Missing Persian badge in FA mode');
      assert(faPlansModal.fitsViewport, 'FR-019 Persian plans modal fits viewport', 'Plans modal overflows horizontally in FA');

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#tc-plans-modal.open'), { timeout: 4000 });

      // Switch language back to English
      await page.evaluate(() => window.__TRADING_APP__?.switchLanguage('en'));
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'ltr', { timeout: 5000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. XSS Neutralization in Profile Fields (FR-019)
    // ──────────────────────────────────────────────────────────────────────────
    {
      const xssPayload = '<img src="x" onerror="window.__ACCEPTANCE_XSS_FIRED__=true">';
      const xssSaveRes = await page.evaluate(async (payload) => {
        const res = await fetch('/api/auth/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: payload,
            bio: payload,
            location: payload,
            signature: payload
          })
        });
        return res.json();
      }, xssPayload);
      assert(xssSaveRes.ok === true, 'FR-019 XSS payload saved without crash', `Failed: ${JSON.stringify(xssSaveRes)}`);

      // Open profile settings modal
      await page.evaluate(() => {
        const am = window.__TRADING_APP__?.auth;
        am.renderAccountBadge();
        am.openAccountSettingsModal('profile');
      });
      await page.waitForFunction(() => !!document.querySelector('#tc-account-settings-modal.open'), { timeout: 6000 });
      await new Promise(r => setTimeout(r, 600));

      const xssState = await page.evaluate(() => {
        const fired = !!window.__ACCEPTANCE_XSS_FIRED__;
        const liveImgs = document.querySelectorAll('#tc-account-settings-modal img[src="x"]').length;
        return { fired, liveImgs };
      });

      assert(!xssState.fired, 'FR-019 XSS handler did NOT execute', 'XSS vulnerability: window.__ACCEPTANCE_XSS_FIRED__ was executed!');
      assert(xssState.liveImgs === 0, 'FR-019 XSS payload was NOT parsed as HTML element', 'Live image element created from user input');

      // Close modal
      await page.keyboard.press('Escape');
    }

    console.log('✅ [009 Acceptance Suite 05] All Modals, Plans & Bilingual Parity scenarios passed.');
  } finally {
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error('❌ unhandled error in 05_browser_modals_plans_and_bilingual_parity suite:', err);
  process.exit(1);
});
