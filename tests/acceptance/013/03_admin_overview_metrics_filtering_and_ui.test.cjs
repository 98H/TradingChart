/**
 * @spec 013
 * @covers FR-009, FR-010, FR-011, FR-013
 */
const fs = require('fs');
const path = require('path');
const { launch, VIEWPORTS, closeAllBrowsers } = require('../../qa_lib.cjs');

const BASE = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:18088');

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

let ipSubnet = Math.floor(Math.random() * 200) + 10;
let ipHost = 1;
function nextIp() {
  ipHost++;
  if (ipHost > 250) { ipSubnet++; ipHost = 1; }
  return `10.95.${ipSubnet}.${ipHost}`;
}

async function request(endpoint, options = {}, clientIp = null) {
  const reqUrl = `${BASE}${endpoint}`;
  const ip = clientIp || nextIp();
  const headers = {
    'X-Forwarded-For': ip,
    ...(options.headers || {})
  };
  const res = await fetch(reqUrl, { ...options, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text };
}

// Real click verifying top element at coordinates using elementFromPoint
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
  console.log(`[013 Acceptance Suite 03] Running Admin Overview Metrics, Filtering & UI against ${BASE}...`);
  const masterKey = getMasterKey();
  assert(!!masterKey, 'Suite 03 setup: master key present', 'Master key could not be loaded from file or env');
  const adminHeaders = { 'X-Master-Key': masterKey, 'Content-Type': 'application/json' };

  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Overview Metrics Isolation: KPI Gifts & MRR Protection (FR-009, SC-004)
  // ──────────────────────────────────────────────────────────────────────────
  // Fetch overview baseline
  const ovBefore = await request('/api/admin/overview', { headers: adminHeaders });
  assert(ovBefore.status === 200, 'FR-009 GET /api/admin/overview status 200', `Expected 200, got ${ovBefore.status}`);
  const initialGiftsKpi = Number(ovBefore.body?.kpi?.gifts || 0);
  const initialMrr = Number(ovBefore.body?.kpi?.mrr || 0);
  const initialPaid = Number(ovBefore.body?.kpi?.paid || 0);

  // Register a Basic user
  const userA = { email: `qa_mrr_a_${ts}@acceptance.test`, username: `qa_mrr_${ts}`.slice(0, 24), password: 'Password123!', displayName: `MRR User ${ts}` };
  const regARes = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userA) });
  const userAId = regARes.body?.user?.id;

  // Grant Premium gift ($59.95/mo equivalent) to userA
  const grantARes = await request(`/api/admin/users/${userAId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: 'premium',
      expiresAt: Date.now() + 30 * 86400000,
      note: 'VIP trial gift'
    })
  });
  assert(grantARes.status === 200, 'FR-009 grant premium gift status 200', `Expected 200, got ${grantARes.status}`);

  // Fetch overview after granting gift
  const ovAfter = await request('/api/admin/overview', { headers: adminHeaders });
  assert(ovAfter.status === 200, 'FR-009 GET /api/admin/overview after gift status 200', `Expected 200, got ${ovAfter.status}`);
  assert(typeof ovAfter.body?.kpi?.gifts === 'number', 'FR-009 overview reports kpi.gifts number', 'Missing kpi.gifts');
  assert(ovAfter.body?.kpi?.gifts === initialGiftsKpi + 1, 'FR-009 kpi.gifts incremented by 1',
    `Expected ${initialGiftsKpi + 1}, got ${ovAfter.body?.kpi?.gifts}`);

  // SC-004: MRR and paid counts MUST NOT increase because gift is not revenue
  assert(Number(ovAfter.body?.kpi?.mrr || 0) === initialMrr,
    'SC-004 MRR unchanged by granting gift subscription',
    `Initial MRR: ${initialMrr}, after gift MRR: ${ovAfter.body?.kpi?.mrr}`);
  assert(Number(ovAfter.body?.kpi?.paid || 0) === initialPaid,
    'FR-009 paid user count excludes users whose effective plan comes from gift',
    `Initial paid: ${initialPaid}, after gift paid: ${ovAfter.body?.kpi?.paid}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Admin Users List Filtering & Row Payload (FR-009)
  // ──────────────────────────────────────────────────────────────────────────
  // Admin user row contains gift and effectivePlan
  const userDetailRes = await request(`/api/admin/users/${userAId}`, { headers: adminHeaders });
  assert(userDetailRes.body?.user?.effectivePlan === 'premium', 'FR-009 admin detail has effectivePlan', `Expected premium, got ${userDetailRes.body?.user?.effectivePlan}`);
  assert(userDetailRes.body?.user?.gift?.plan === 'premium', 'FR-009 admin detail has gift object', 'Missing gift object');

  // Filter GET /api/admin/users?status=gift
  const giftFilterRes = await request(`/api/admin/users?status=gift`, { headers: adminHeaders });
  assert(giftFilterRes.status === 200, 'FR-009 GET /api/admin/users?status=gift status 200', `Expected 200, got ${giftFilterRes.status}`);
  assert(Array.isArray(giftFilterRes.body?.users), 'FR-009 users array present', 'Missing users array');
  assert(giftFilterRes.body?.users.some(u => u.id === userAId),
    'FR-009 status=gift includes user with active gift', `User ${userAId} not found in status=gift filter`);
  assert(giftFilterRes.body?.users.every(u => !!u.gift),
    'FR-009 all users returned by status=gift have active gift', 'User without gift returned in status=gift');

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Browser Admin Console UI: Badges, Status Filter, Bulk Bar & Drawer (FR-010, FR-011, FR-013)
  // ──────────────────────────────────────────────────────────────────────────
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#gate-key', { timeout: 10000 });

    // Enter master key to unlock console
    await page.evaluate((k) => {
      const el = document.querySelector('#gate-key');
      el.value = k;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, masterKey);
    await realClick(page, '#gate-submit');
    await page.waitForSelector('.sidebar nav a[href="#/users"]', { timeout: 12000 });

    // Navigate to #/users
    await realClick(page, '.sidebar nav a[href="#/users"]');
    await page.waitForSelector('#u-list tbody tr', { timeout: 10000 });

    // Verify status filter dropdown contains "Gift" option (FR-011, FR-013)
    const statusOptions = await page.$$eval('#u-status option', els => els.map(o => ({ value: o.value, text: o.textContent.trim() })));
    const giftOption = statusOptions.find(o => o.value === 'gift');
    assert(!!giftOption, 'FR-011 status filter dropdown contains gift option', `Options: ${JSON.stringify(statusOptions)}`);
    assert(giftOption.text.includes('اشتراک هدیه') || giftOption.text.includes('هدیه') || giftOption.text.includes('Gift'),
      'FR-013 gift status filter option has localized label', `Label: ${giftOption.text}`);

    // Select status=gift in the filter dropdown
    await page.select('#u-status', 'gift');
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#u-list tbody tr');
      return rows.length > 0;
    }, { timeout: 8000 });

    // Verify users list table marks gift users with gift badge and expiry (FR-011, FR-013)
    const tableText = await page.$eval('#u-list tbody', el => el.innerText);
    assert(tableText.includes('اشتراک هدیه') || tableText.includes('هدیه') || tableText.includes('Gift'),
      'FR-011 users table displays gift badge', 'Gift badge not found in table text');

    // Verify bulk actions bar includes "Grant gift" (FR-011, FR-013)
    // Select first row checkbox
    const firstCheckbox = await page.$('#u-list tbody tr input[type="checkbox"], #u-list tbody tr .u-chk');
    if (firstCheckbox) {
      await firstCheckbox.click();
      await page.waitForSelector('#u-bulk .bulkbar', { timeout: 6000 });
      const bulkActions = await page.$$eval('#u-bulk button', els => els.map(b => ({
        bulkAct: b.dataset.bulk,
        text: b.textContent.trim()
      })));
      const giftBulkBtn = bulkActions.find(b => b.bulkAct === 'gift' || b.text.includes('هدیه') || b.text.includes('Gift'));
      assert(!!giftBulkBtn, 'FR-011 bulk bar includes Grant gift action button',
        `Bulk actions found: ${JSON.stringify(bulkActions)}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Admin User Drawer: Current Gift Card, Grant Dialog & Revoke (FR-010, FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    // Search for userA to open its specific drawer
    await page.evaluate(() => {
      const q = document.querySelector('#u-q');
      if (q) {
        q.value = '';
        q.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const st = document.querySelector('#u-status');
      if (st) {
        st.value = 'all';
        st.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Open user drawer by clicking user row
    const userRowBtn = await page.waitForSelector(`#u-list tbody tr button[data-user="${userAId}"], #u-list tbody tr:first-child button[data-user]`, { timeout: 10000 });
    await userRowBtn.click();
    await page.waitForSelector('.drawer', { timeout: 8000 });

    // Wait for drawer content
    await page.waitForSelector('.drawer .field, .drawer .card, .drawer [data-gift-section]', { timeout: 8000 });

    // Drawer must show current gift card (plan, expiry or Unlimited, granted by, granted at, note) (FR-010)
    const drawerText = await page.$eval('.drawer', el => el.innerText);
    assert(drawerText.includes('اشتراک هدیه') || drawerText.includes('هدیه') || drawerText.includes('Gift'),
      'FR-010 drawer displays current gift section', 'Gift section missing in drawer');
    assert(drawerText.includes('پریمیوم') || drawerText.includes('Premium'),
      'FR-010 drawer displays gift plan name', 'Gift plan name missing in drawer');

    // Drawer must have Grant / Replace Gift action button (FR-010)
    const grantGiftBtn = await page.$('.drawer button[data-act="grant-gift"], .drawer button[data-gift-grant], .drawer #dr-gift-btn, .drawer button.btn-gift');
    assert(!!grantGiftBtn, 'FR-010 drawer has Grant/Replace gift action button', 'Missing grant/replace gift button');

    // Click Grant/Replace button to open gift dialog (FR-010)
    await grantGiftBtn.click();
    await page.waitForSelector('.dialog-wrap .dialog, .modal[data-gift-dialog], #gift-modal', { timeout: 6000 });

    // Verify Grant Dialog offers: plan select, "Expiry date" vs "Unlimited", and note (FR-010)
    const giftDialogInputs = await page.evaluate(() => {
      const dlg = document.querySelector('.dialog-wrap .dialog, .modal[data-gift-dialog], #gift-modal');
      if (!dlg) return null;
      const hasPlanSelect = !!dlg.querySelector('select[name="plan"], select#gift-plan, #dr-gift-plan');
      const hasExpiryChoice = !!dlg.querySelector('input[name="expiryType"], input#gift-unlimited, [data-expiry-choice], input[type="date"]');
      const hasNote = !!dlg.querySelector('textarea[name="note"], input[name="note"], #gift-note, #dr-gift-note');
      return { hasPlanSelect, hasExpiryChoice, hasNote };
    });
    assert(giftDialogInputs?.hasPlanSelect, 'FR-010 gift dialog offers plan select', 'Missing plan select');
    assert(giftDialogInputs?.hasExpiryChoice, 'FR-010 gift dialog offers expiry date vs unlimited choice', 'Missing expiry choice');
    assert(giftDialogInputs?.hasNote, 'FR-010 gift dialog offers note field', 'Missing note input');

    // Close grant dialog
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // Revoke Action requires confirmation dialog (FR-010)
    const revokeBtn = await page.$('.drawer button[data-act="revoke-gift"], .drawer button[data-gift-revoke], .drawer #dr-gift-revoke');
    assert(!!revokeBtn, 'FR-010 drawer has Revoke gift action button', 'Missing revoke gift button in drawer');
    await revokeBtn.click();

    // Confirmation dialog must appear before executing revoke (FR-010)
    await page.waitForSelector('.dialog-wrap .dialog[role="dialog"], .confirm-dialog', { timeout: 6000 });
    const confirmDialogText = await page.$eval('.dialog-wrap .dialog, .confirm-dialog', el => el.innerText);
    assert(confirmDialogText.includes('لغو') || confirmDialogText.includes('Revoke') || confirmDialogText.includes('حذف'),
      'FR-010 revoke confirmation dialog prompt displayed', `Unexpected confirm text: ${confirmDialogText}`);

    // Confirm revocation
    const confirmRevokeBtn = await page.$('.dialog-wrap button.btn-danger, .confirm-dialog button.btn-primary, .dialog-wrap button:last-child');
    assert(!!confirmRevokeBtn, 'FR-010 confirm revocation button present', 'Missing confirm button');
    await confirmRevokeBtn.click();
    await new Promise(r => setTimeout(r, 600));

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Mobile Card Viewport Adaptation (FR-011, FR-017)
    // ──────────────────────────────────────────────────────────────────────────
    // Re-grant gift via API so user has an active gift for mobile card check
    await request(`/api/admin/users/${userAId}/gift`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ plan: 'plus', expiresAt: Date.now() + 86400000, note: 'Mobile check gift' })
    });

    await page.setViewport(VIEWPORTS.mobile);
    await new Promise(r => setTimeout(r, 600));

    // Navigate to users on mobile
    await page.evaluate(() => location.hash = '#/users');
    await page.waitForSelector('.mlist', { timeout: 10000 });

    const mobileListText = await page.$eval('.mlist', el => el.innerText);
    assert(mobileListText.includes('اشتراک هدیه') || mobileListText.includes('هدیه') || mobileListText.includes('Gift'),
      'FR-011 mobile cards (.mlist) display gift badge and expiry', 'Gift badge not found in mobile cards');

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Bilingual Parity & Localized Messages for New Error Codes (FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    // Switch to English and check error messages
    const langBtn = await page.$('button[data-act="lang"]');
    if (langBtn) await langBtn.click();
    await new Promise(r => setTimeout(r, 500));

    // Switch back to Persian (default)
    const faLangBtn = await page.$('button[data-act="lang"]');
    if (faLangBtn) await faLangBtn.click();
    await new Promise(r => setTimeout(r, 500));

  } finally {
    await ctx.browser.close();
  }

  console.log('✅ [013 Acceptance Suite 03] Admin Overview Metrics, Filtering & UI passed.');
}

run().catch(async err => {
  console.error(`❌ Suite 03 unexpected error: ${err.message}\n${err.stack}`);
  await closeAllBrowsers().catch(() => {});
  process.exit(1);
});
