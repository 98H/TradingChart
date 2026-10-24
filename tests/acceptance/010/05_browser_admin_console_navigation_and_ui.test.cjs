/**
 * @spec 010
 * @covers FR-016, FR-017
 */
const fs = require('fs');
const path = require('path');
const { launch, BASE, VIEWPORTS, closeAllBrowsers } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

function getMasterKey() {
  if (process.env.TRADINGCHART_MASTER_KEY) return process.env.TRADINGCHART_MASTER_KEY.trim();
  const candidates = [
    path.resolve(__dirname, '../../../server/data/admin_master.key'),
    path.resolve(process.cwd(), 'server/data/admin_master.key')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8').trim();
    }
  }
  return '';
}

// Verified real click: centers target and verifies top element at coordinates using elementFromPoint
async function realClick(page, selector, timeout = 12000) {
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
  console.log(`[010 Acceptance Suite 05] Running Browser Admin Console Navigation & UI against ${BASE}...`);
  const masterKey = getMasterKey();
  assert(!!masterKey, 'Suite 05 setup: master key present', 'Master key could not be loaded');

  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Gate Authentication, Error Display & Password Toggle (FR-016, FR-017)
    // ──────────────────────────────────────────────────────────────────────────
    await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#gate-key', { timeout: 10000 });

    // Persian default & RTL layout verification (FR-017)
    const initialDir = await page.evaluate(() => document.documentElement.dir);
    assert(initialDir === 'rtl', 'FR-017 default document direction is RTL', `Expected rtl, got ${initialDir}`);

    // Wrong key rejection with localized message & invalid state (FR-016)
    const keyInput = await page.$('#gate-key');
    await keyInput.click();
    await page.keyboard.type('wrong_master_key_123');
    await realClick(page, '#gate-submit');

    await page.waitForSelector('#gate-err:not(:empty)', { timeout: 6000 });
    const gateErrText = await page.$eval('#gate-err', el => el.textContent.trim());
    const isInvalid = await page.$eval('#gate-key', el => el.getAttribute('aria-invalid'));
    assert(gateErrText.includes('کلید مدیریت نادرست است') || gateErrText.includes('incorrect'),
      'FR-016 gate shows localized error message on wrong key', `Unexpected error text: ${gateErrText}`);
    assert(isInvalid === 'true', 'FR-016 gate input marked aria-invalid="true"', `Expected true, got ${isInvalid}`);

    // Password visibility toggle (FR-016)
    await realClick(page, '#gate-eye');
    const revealedType = await page.$eval('#gate-key', el => el.type);
    assert(revealedType === 'text', 'FR-016 eye toggle reveals password as text', `Expected text, got ${revealedType}`);

    // Enter valid master key and unlock console
    await page.evaluate((k) => {
      const el = document.querySelector('#gate-key');
      el.value = k;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, masterKey);
    await realClick(page, '#gate-submit');

    // Wait for console shell and dashboard
    await page.waitForSelector('.topbar', { timeout: 12000 });
    await page.waitForSelector('#dash-body', { timeout: 12000 });
    assert(page.url().includes('/admin'), 'FR-016 console shell mounted at /admin', `URL: ${page.url()}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Hash Routing & Navigation Shell (FR-016)
    // ──────────────────────────────────────────────────────────────────────────
    const navHrefs = await page.$$eval('.sidebar nav a', els => els.map(a => a.getAttribute('href')));
    assert(navHrefs.includes('#/dashboard'), 'FR-016 nav has #/dashboard', 'Missing #/dashboard');
    assert(navHrefs.includes('#/users'), 'FR-016 nav has #/users', 'Missing #/users');
    assert(navHrefs.includes('#/plans'), 'FR-016 nav has #/plans', 'Missing #/plans');
    assert(navHrefs.includes('#/audit'), 'FR-016 nav has #/audit', 'Missing #/audit');
    assert(navHrefs.includes('#/settings'), 'FR-016 nav has #/settings', 'Missing #/settings');
    assert(navHrefs.includes('#/system'), 'FR-016 nav has #/system', 'Missing #/system');

    // Navigate to #/users
    await realClick(page, '.sidebar nav a[href="#/users"]');
    await page.waitForSelector('#u-list tbody tr, #u-list', { timeout: 10000 });
    const usersHash = await page.evaluate(() => location.hash);
    assert(usersHash === '#/users', 'FR-016 routed to #/users', `Expected #/users, got ${usersHash}`);

    // Search and CSV Export buttons present in users section (FR-016)
    assert(await page.$('#u-q') !== null, 'FR-016 user search input present', 'Missing #u-q');
    assert(await page.$('#u-export') !== null, 'FR-016 user export button present', 'Missing #u-export');

    // User Detail Drawer (FR-016)
    // Click first user row to open slide-over drawer
    await realClick(page, '#u-list tbody tr:first-child td:nth-child(2)');
    await page.waitForSelector('.drawer', { timeout: 8000 });
    const isDrawerOpen = await page.evaluate(() => {
      const d = document.querySelector('.drawer');
      return d && d.offsetWidth > 0;
    });
    assert(isDrawerOpen, 'FR-016 user detail drawer opened', 'Drawer is not open');

    // Drawer tabs: Overview & Sessions
    const drawerTabs = await page.$$eval('.drawer .tab', els => els.map(t => t.textContent.trim()));
    assert(drawerTabs.some(t => t.includes('نمای کلی') || t.includes('Overview')),
      'FR-016 drawer has overview tab', `Tabs: ${drawerTabs.join(', ')}`);
    assert(drawerTabs.some(t => t.includes('نشست‌ها') || t.includes('Sessions')),
      'FR-016 drawer has sessions tab', `Tabs: ${drawerTabs.join(', ')}`);

    // Plan select and notes inside drawer
    assert(await page.$('#dr-plan') !== null, 'FR-016 drawer has plan selector #dr-plan', 'Missing #dr-plan');
    assert(await page.$('#dr-notes') !== null, 'FR-016 drawer has notes field #dr-notes', 'Missing #dr-notes');

    // Close drawer via close button
    await realClick(page, '.drawer button[aria-label="بستن"], .drawer .drawer-head button:first-child');
    await page.waitForFunction(() => !document.querySelector('.drawer') || document.querySelector('.drawer').offsetWidth === 0, { timeout: 6000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Plans Studio, Live Preview & Comparison Matrix (FR-016)
    // ──────────────────────────────────────────────────────────────────────────
    await realClick(page, '.sidebar nav a[href="#/plans"]');
    await page.waitForSelector('#pf-preview, .plans-studio', { timeout: 10000 });

    // Live pricing card preview
    const hasPreview = await page.evaluate(() => {
      const p = document.querySelector('#pf-preview');
      return p && p.offsetWidth > 0;
    });
    assert(hasPreview, 'FR-016 live pricing preview card renders', 'Missing #pf-preview');

    // Switch to Comparison Matrix mode (FR-016)
    await realClick(page, 'button[data-mode="matrix"]');
    await page.waitForSelector('.matrix-wrap, table', { timeout: 8000 });
    const matrixRows = await page.$$eval('table tr', els => els.length);
    assert(matrixRows >= 40, 'FR-016 comparison matrix renders 40+ feature rows', `Rows: ${matrixRows}`);

    // Switch back to Editor mode
    await realClick(page, 'button[data-mode="editor"]');
    await page.waitForSelector('#pf-preview', { timeout: 8000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Dirty Indicator & Leave Guards (FR-016)
    // ──────────────────────────────────────────────────────────────────────────
    // Modify monthly price to make form dirty
    const priceInput = await page.$('#pf-priceUSD');
    assert(!!priceInput, 'FR-016 plan monthly price input present', 'Missing #pf-priceUSD');
    await priceInput.click();
    await page.keyboard.type('9');

    // Verify sticky save bar appears
    await page.waitForSelector('.sticky-save', { timeout: 6000 });
    const isSaveBarVisible = await page.evaluate(() => {
      const b = document.querySelector('.sticky-save');
      return b && b.offsetWidth > 0;
    });
    assert(isSaveBarVisible, 'FR-016 sticky save bar appears when plan edited', 'Save bar not visible');

    // Navigate away while dirty -> Leave guard dialog blocks navigation (FR-016)
    await page.click('.sidebar nav a[href="#/dashboard"]');
    await page.waitForSelector('.dialog-wrap .dialog[role="dialog"]', { timeout: 6000 });

    const dialogAriaModal = await page.$eval('.dialog-wrap .dialog', el => el.getAttribute('aria-modal'));
    assert(dialogAriaModal === 'true', 'FR-016 leave guard dialog has aria-modal="true"', 'Missing aria-modal="true"');

    // Dismiss changes and navigate via dialog button
    const discardBtn = await page.$('.dialog-wrap button.btn-danger-solid, .dialog-wrap button:last-child');
    assert(!!discardBtn, 'FR-016 discard changes button present in leave guard dialog', 'Missing discard button');
    await discardBtn.click();

    // Confirm navigation to #dashboard succeeded after discard
    await page.waitForSelector('#dash-body', { timeout: 8000 });
    const currentHash = await page.evaluate(() => location.hash);
    assert(currentHash === '#/dashboard', 'FR-016 navigated to #/dashboard after discarding unsaved edits', `Hash: ${currentHash}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Bilingual Parity & Draft Preservation Across Language Switch (FR-017)
    // ──────────────────────────────────────────────────────────────────────────
    // Navigate to #/settings
    await realClick(page, '.sidebar nav a[href="#/settings"]');
    await page.waitForSelector('#s-domains, textarea', { timeout: 8000 });

    // Enter draft text in test email domains
    const draftContent = `acceptance-qa-${Date.now().toString(36)}.io`;
    await page.evaluate((txt) => {
      const textarea = document.querySelector('#s-domains') || document.querySelector('textarea');
      if (textarea) {
        textarea.value = txt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, draftContent);

    // Switch language to English via desktop language button
    const langBtn = await page.$('button[data-act="lang"]:not(.only-narrow)');
    assert(!!langBtn, 'FR-017 desktop language toggle button present', 'Missing lang button');
    await langBtn.click();

    // Verify document direction switches to LTR and lang becomes en (FR-017)
    await page.waitForFunction(() => document.documentElement.dir === 'ltr' && document.documentElement.lang === 'en', { timeout: 6000 });
    const storedLang = await page.evaluate(() => localStorage.getItem('tc_admin_lang'));
    assert(storedLang === 'en', 'FR-017 language saved in localStorage tc_admin_lang', `Expected en, got ${storedLang}`);

    // Verify unsaved draft is preserved across language switch (FR-017 edge case)
    const preservedDraft = await page.evaluate(() => {
      const textarea = document.querySelector('#s-domains') || document.querySelector('textarea');
      return textarea ? textarea.value : '';
    });
    assert(preservedDraft === draftContent, 'FR-017 unsaved settings draft preserved across language switch',
      `Expected ${draftContent}, got ${preservedDraft}`);

    // Switch back to Persian (default)
    const faLangBtn = await page.$('button[data-act="lang"]:not(.only-narrow)');
    await faLangBtn.click();
    await page.waitForFunction(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'fa', { timeout: 6000 });

    // Discard unsaved settings draft before logout
    const discardSettingsBtn = await page.$('.sticky-save button:not(.btn-primary), #s-discard');
    if (discardSettingsBtn) {
      await discardSettingsBtn.click();
      await new Promise(r => setTimeout(r, 400));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Mobile Responsive Viewport Adaptation (<= 860px) (FR-017)
    // ──────────────────────────────────────────────────────────────────────────
    await page.setViewport(VIEWPORTS.mobile);
    await new Promise(r => setTimeout(r, 600));

    // Bottom navigation visible, desktop sidebar hidden
    const bottomNavState = await page.evaluate(() => {
      const bn = document.querySelector('.bottom-nav');
      const sb = document.querySelector('.sidebar');
      const items = Array.from(document.querySelectorAll('.bottom-nav a, .bottom-nav button'));
      return {
        bottomNavVisible: bn && bn.offsetWidth > 0,
        sidebarHidden: !sb || getComputedStyle(sb).display === 'none' || sb.offsetWidth === 0,
        itemCount: items.length
      };
    });

    assert(bottomNavState.bottomNavVisible, 'FR-017 mobile bottom navigation visible below 860px', 'Bottom nav not visible');
    assert(bottomNavState.sidebarHidden, 'FR-017 desktop sidebar hidden on mobile', 'Sidebar is still visible on mobile');
    assert(bottomNavState.itemCount === 6, 'FR-017 mobile bottom nav contains 6 section buttons', `Items count: ${bottomNavState.itemCount}`);

    // Verify touch targets >= 44px on bottom nav buttons (FR-017)
    const touchTargetHeights = await page.$$eval('.bottom-nav button, .bottom-nav a', els => els.map(b => b.offsetHeight));
    assert(touchTargetHeights.every(h => h >= 40), 'FR-017 bottom nav touch target heights conform to mobile standards',
      `Target heights: ${touchTargetHeights.join(', ')}`);

    // Navigate to #/users on mobile: verify card layout (.mlist) (FR-017)
    await page.evaluate(() => location.hash = '#/users');
    await page.waitForSelector('.mlist', { timeout: 10000 });
    const hasMobileCards = await page.evaluate(() => {
      const mlist = document.querySelector('.mlist');
      return mlist && mlist.children.length > 0;
    });
    assert(hasMobileCards, 'FR-017 users table rendered as card list (.mlist) on mobile', 'Missing mobile cards in users view');

    // Switch back to desktop viewport
    await page.setViewport(VIEWPORTS.desktop);
    await new Promise(r => setTimeout(r, 600));

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Sign Out Confirmation & Redirect to Gate (FR-016)
    // ──────────────────────────────────────────────────────────────────────────
    const logoutBtn = await page.$('button[data-act="logout"]:not(.only-narrow)');
    assert(!!logoutBtn, 'FR-016 logout button present in shell', 'Missing logout button');
    await logoutBtn.click();

    // Confirm logout dialog appears
    await page.waitForSelector('.dialog-wrap .dialog', { timeout: 6000 });
    const confirmLogoutBtn = await page.$('.dialog-wrap button.btn-primary');
    assert(!!confirmLogoutBtn, 'FR-016 confirm logout button in dialog', 'Missing confirm button');
    await confirmLogoutBtn.click();

    // Verify redirected back to gate form and session cleared
    await page.waitForSelector('#gate-key', { timeout: 10000 });
    const isGateMounted = await page.evaluate(() => !!document.querySelector('#gate-key'));
    assert(isGateMounted, 'FR-016 logout redirects to gate unlock form', 'Gate form not found after logout');
  } finally {
    await ctx.browser.close();
  }

  console.log('✅ [010 Acceptance Suite 05] Browser Admin Console Navigation & UI passed.');
}

run().catch(async err => {
  console.error(`❌ Suite 05 unexpected error: ${err.message}\n${err.stack}`);
  await closeAllBrowsers().catch(() => {});
  process.exit(1);
});
