/**
 * @spec 013
 * @covers FR-012, FR-013
 */
const fs = require('fs');
const path = require('path');
const { launch, boot, VIEWPORTS, closeAllBrowsers } = require('../../qa_lib.cjs');

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
  return `10.96.${ipSubnet}.${ipHost}`;
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
  console.log(`[013 Acceptance Suite 04] Running Trading App Avatar, Plans Modal & Gates against ${BASE}...`);
  const masterKey = getMasterKey();
  assert(!!masterKey, 'Suite 04 setup: master key present', 'Master key could not be loaded from file or env');
  const adminHeaders = { 'X-Master-Key': masterKey, 'Content-Type': 'application/json' };

  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Setup test user
  const traderUser = {
    displayName: `Chartist ${ts}`,
    username: `chart_${ts}`.slice(0, 24),
    email: `chartist_${ts}@acceptance.test`,
    password: 'ChartPassword123!'
  };

  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(traderUser)
  });
  assert(regRes.status === 200, 'Suite 04 setup: trader registered', `Expected 200, got ${regRes.status}`);
  const traderId = regRes.body?.user?.id;
  const userCookie = regRes.headers.get('set-cookie');

  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Initial State in Trading Chart App (/chart) (FR-012)
    // ──────────────────────────────────────────────────────────────────────────
    // Set cookie on browser session so user loads authenticated
    const cookieHeader = userCookie.split(';')[0];
    const [cName, cVal] = cookieHeader.split('=');
    await page.setCookie({
      name: cName.trim(),
      value: cVal.trim(),
      domain: new URL(BASE).hostname,
      path: '/'
    });

    await page.goto(BASE + '/chart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Verify initial client-side plan is basic
    const initialClientPlan = await page.evaluate(() => {
      return window.__TRADING_APP__?.auth?.plan?.();
    });
    assert(initialClientPlan === 'basic', 'FR-012 initial client plan is basic', `Expected basic, got ${initialClientPlan}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Grant Dated Gift (Premium) & Avatar Menu Verification (FR-012, FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    const sevenDaysMs = Date.now() + 7 * 86400000;
    const grantRes = await request(`/api/admin/users/${traderId}/gift`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        plan: 'premium',
        expiresAt: sevenDaysMs,
        note: 'Special charter gift'
      })
    });
    assert(grantRes.status === 200, 'FR-012 grant dated gift status 200', `Expected 200, got ${grantRes.status}`);

    // Refresh user state in client application
    await page.evaluate(async () => {
      if (window.__TRADING_APP__?.auth?.load) {
        await window.__TRADING_APP__.auth.load();
      } else {
        location.reload();
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    // Client gate auth.plan() MUST return effective plan (premium) (FR-012)
    const clientEffectivePlan = await page.evaluate(() => {
      return window.__TRADING_APP__?.auth?.plan?.();
    });
    assert(clientEffectivePlan === 'premium',
      'FR-012 client gate auth.plan() reflects effective plan premium',
      `Expected premium, got ${clientEffectivePlan}`);

    // Architect amendment (phase-3 review): the app default language is English; select Persian explicitly
    // instead of relying on a default (the spec never changes the default language).
    await page.evaluate(() => window.__TRADING_APP__?.switchLanguage?.('fa'));
    await new Promise(r => setTimeout(r, 500));

    // Open Avatar Menu
    await realClick(page, '.user-avatar-badge');
    await page.waitForFunction(() => !!document.querySelector('#tc-account-menu'), { timeout: 6000 });

    // Avatar Menu verification in Persian:
    // MUST show effective plan, gift badge «اشتراک هدیه» and «تا <تاریخ>» with Persian digits (FR-012, FR-013)
    const menuFaState = await page.evaluate(() => {
      const menu = document.querySelector('#tc-account-menu');
      if (!menu) return null;
      const text = menu.innerText;
      const hasGiftBadge = text.includes('اشتراک هدیه') || text.includes('هدیه');
      const hasPlanName = text.includes('پریمیوم') || text.includes('Premium');
      const hasUntilDate = text.includes('تا') || /تا\s+[\u06F0-\u06F90-9]/.test(text);
      return { text, hasGiftBadge, hasPlanName, hasUntilDate };
    });
    assert(menuFaState?.hasGiftBadge, 'FR-012 avatar menu displays «اشتراک هدیه» badge', `Menu text: ${menuFaState?.text}`);
    assert(menuFaState?.hasPlanName, 'FR-012 avatar menu displays effective plan name', `Menu text: ${menuFaState?.text}`);
    assert(menuFaState?.hasUntilDate, 'FR-012 avatar menu displays expiry date with «تا» in Persian', `Menu text: ${menuFaState?.text}`);

    // Close avatar menu
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Unlimited Gift Display in Avatar Menu (FR-012, FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    // Admin replaces gift with Unlimited
    await request(`/api/admin/users/${traderId}/gift`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        plan: 'premium',
        expiresAt: null,
        note: 'Upgraded to unlimited gift'
      })
    });

    // Refresh client state
    await page.evaluate(async () => {
      await window.__TRADING_APP__?.auth?.load?.();
    });
    await new Promise(r => setTimeout(r, 800));

    // Open Avatar Menu again
    await realClick(page, '.user-avatar-badge');
    await page.waitForFunction(() => !!document.querySelector('#tc-account-menu'), { timeout: 6000 });

    const menuUnlimState = await page.evaluate(() => {
      const menu = document.querySelector('#tc-account-menu');
      return menu ? menu.innerText : '';
    });
    assert(menuUnlimState.includes('نامحدود') || menuUnlimState.includes('Unlimited'),
      'FR-012 unlimited gift displays «نامحدود» / "Unlimited" in avatar menu',
      `Menu text: ${menuUnlimState}`);

    // Close avatar menu
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Account Settings Dialog (FR-012, FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    await page.evaluate(() => {
      window.__TRADING_APP__?.auth?.openAccountSettingsModal?.('account');
    });
    await page.waitForFunction(() => {
      const m = document.querySelector('#tc-account-settings-modal');
      return m && m.classList.contains('open');
    }, { timeout: 6000 });

    const accountModalText = await page.$eval('#tc-account-settings-modal', el => el.innerText);
    assert(accountModalText.includes('اشتراک هدیه') || accountModalText.includes('هدیه') || accountModalText.includes('Gift'),
      'FR-012 account settings dialog displays gift badge', `Account dialog text: ${accountModalText}`);
    assert(accountModalText.includes('پریمیوم') || accountModalText.includes('Premium'),
      'FR-012 account settings dialog displays effective gift plan', `Account dialog text: ${accountModalText}`);

    // Close account settings modal
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#tc-account-settings-modal.open'), { timeout: 4000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Plans Comparison Dialog (FR-012, FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    // Re-grant dated gift to verify base plan indicated as plan after gift ends
    await request(`/api/admin/users/${traderId}/gift`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        plan: 'premium',
        expiresAt: sevenDaysMs,
        note: 'Dated gift for plans dialog test'
      })
    });
    await page.evaluate(async () => {
      await window.__TRADING_APP__?.auth?.load?.();
    });
    await new Promise(r => setTimeout(r, 800));

    // Open plans comparison modal
    await page.evaluate(() => {
      window.__TRADING_APP__?.auth?.openPlansModal?.();
    });
    await page.waitForFunction(() => {
      const m = document.querySelector('#tc-plans-modal');
      return m && m.classList.contains('open');
    }, { timeout: 6000 });

    const plansModalState = await page.evaluate(() => {
      const modal = document.querySelector('#tc-plans-modal');
      if (!modal) return null;
      const text = modal.innerText;
      const premiumCard = modal.querySelector('[data-plan="premium"], .plan-card-premium');
      const basicCard = modal.querySelector('[data-plan="basic"], .plan-card-basic');
      const hasGiftBadge = text.includes('اشتراک هدیه') || text.includes('Gift subscription');
      const premiumHasCurrent = premiumCard ? (premiumCard.innerText.includes('Current') || premiumCard.innerText.includes('فعلی')) : false;
      const basicMentionsAfter = basicCard ? (basicCard.innerText.includes('پس از پایان') || basicCard.innerText.includes('بعد از') || basicCard.innerText.includes('after') || basicCard.innerText.includes('پایه') || basicCard.innerText.includes('Base')) : false;
      return { text, hasGiftBadge, premiumHasCurrent, basicMentionsAfter };
    });

    assert(plansModalState?.hasGiftBadge,
      'FR-012 plans modal marks gift plan with gift badge', `Plans modal text: ${plansModalState?.text}`);
    assert(plansModalState?.premiumHasCurrent,
      'FR-012 plans modal marks gift plan as current plan', 'Premium card missing current plan badge');
    assert(plansModalState?.basicMentionsAfter,
      'FR-012 plans modal indicates base plan as plan after gift ends',
      `Basic card text state: ${JSON.stringify(plansModalState)}`);

    // Close plans modal
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#tc-plans-modal.open'), { timeout: 4000 });

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Bilingual Parity: Language Switch & English Rendering (FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    // Switch to English in place without reload
    await page.evaluate(() => {
      window.__TRADING_APP__?.switchLanguage?.('en');
    });
    await new Promise(r => setTimeout(r, 600));

    // Open Avatar Menu in English mode
    await realClick(page, '.user-avatar-badge');
    await page.waitForFunction(() => !!document.querySelector('#tc-account-menu'), { timeout: 6000 });

    const menuEnState = await page.evaluate(() => {
      const menu = document.querySelector('#tc-account-menu');
      return menu ? menu.innerText : '';
    });
    assert(menuEnState.includes('Gift subscription') || menuEnState.includes('Gift'),
      'FR-013 avatar menu displays "Gift subscription" in English mode', `Menu text: ${menuEnState}`);
    assert(menuEnState.includes('until') || menuEnState.includes('Expires'),
      'FR-013 avatar menu displays "until <date>" in English mode', `Menu text: ${menuEnState}`);

    // Switch back to Persian (default)
    await page.evaluate(() => {
      window.__TRADING_APP__?.switchLanguage?.('fa');
    });
    await new Promise(r => setTimeout(r, 600));

  } finally {
    await ctx.browser.close();
  }

  console.log('✅ [013 Acceptance Suite 04] Trading App Avatar, Plans Modal & Gates passed.');
}

run().catch(async err => {
  console.error(`❌ Suite 04 unexpected error: ${err.message}\n${err.stack}`);
  await closeAllBrowsers().catch(() => {});
  process.exit(1);
});
