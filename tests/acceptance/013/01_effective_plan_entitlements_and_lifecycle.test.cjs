/**
 * @spec 013
 * @covers FR-001, FR-002, FR-006, FR-008
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:18088');

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
  return `10.93.${ipSubnet}.${ipHost}`;
}

async function request(endpoint, options = {}, clientIp = null) {
  const reqUrl = `${BASE_URL}${endpoint}`;
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

async function run() {
  console.log(`[013 Acceptance Suite 01] Running Effective Plan, Entitlements & Gift Lifecycle against ${BASE_URL}...`);
  const masterKey = getMasterKey();
  assert(!!masterKey, 'Suite 01 setup: master key present', 'Master key could not be loaded from file or env');
  const adminHeaders = { 'X-Master-Key': masterKey, 'Content-Type': 'application/json' };

  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Setup Base User & Verify Initial State (FR-001, FR-008)
  // ──────────────────────────────────────────────────────────────────────────
  const testUser = {
    email: `gift_user_${ts}@acceptance.test`,
    username: `guser_${ts}`.slice(0, 24),
    password: 'GiftUserPass123!',
    displayName: `Gift Trader ${ts}`
  };

  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  assert(regRes.status === 200, 'FR-008 setup: register test user', `Expected 200, got ${regRes.status}`);
  const userId = regRes.body?.user?.id;
  const userCookie = regRes.headers.get('set-cookie');
  assert(!!userId && !!userCookie, 'FR-008 setup: user credentials minted', 'Missing user ID or session cookie');

  // Verify initial user object has effectivePlan and gift: null (FR-008)
  const meInitial = await request('/api/auth/me', { headers: { Cookie: userCookie } });
  assert(meInitial.status === 200, 'FR-008 initial GET /api/auth/me status 200', `Expected 200, got ${meInitial.status}`);
  assert(meInitial.body?.user?.plan === 'basic', 'FR-008 initial base plan is basic', `Expected basic, got ${meInitial.body?.user?.plan}`);
  assert(meInitial.body?.user?.effectivePlan === 'basic', 'FR-008 initial effectivePlan is basic', `Expected basic, got ${meInitial.body?.user?.effectivePlan}`);
  assert(meInitial.body?.user?.gift === null, 'FR-008 initial gift is null', `Expected null, got ${JSON.stringify(meInitial.body?.user?.gift)}`);

  // Verify initial plans current is basic (FR-002, FR-008)
  const plansInitial = await request('/api/plans', { headers: { Cookie: userCookie } });
  assert(plansInitial.body?.current === 'basic', 'FR-002 initial /api/plans current is basic', `Expected basic, got ${plansInitial.body?.current}`);

  // Verify initial user state plan is basic (FR-002)
  const stateInitial = await request('/api/user/state', { headers: { Cookie: userCookie } });
  assert(stateInitial.body?.plan === 'basic', 'FR-002 initial /api/user/state plan is basic', `Expected basic, got ${stateInitial.body?.plan}`);

  // Verify initial candles limit reflects basic histBars (10000) (FR-002)
  const candlesInitial = await request('/api/candles?symbol=BTCUSDT&timeframe=60&limit=50000', { headers: { Cookie: userCookie } });
  assert(candlesInitial.headers.get('x-history-limit') === '10000', 'FR-002 initial candles limit header is 10000',
    `Expected 10000, got ${candlesInitial.headers.get('x-history-limit')}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Admin Grants Dated Gift (Premium) & Entitlement Upgrade (FR-001, FR-002, FR-008, SC-001)
  // ──────────────────────────────────────────────────────────────────────────
  const sevenDaysMs = Date.now() + 7 * 86400000;
  const grantRes = await request(`/api/admin/users/${userId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: 'premium',
      expiresAt: sevenDaysMs,
      note: '7-day premium gift for promotion'
    })
  });
  assert(grantRes.status === 200, 'FR-003 admin grant gift status 200', `Expected 200, got ${grantRes.status}`);
  assert(grantRes.body?.ok === true, 'FR-003 admin grant response ok: true', 'Expected ok: true');
  assert(grantRes.body?.user?.gift?.plan === 'premium', 'FR-001 admin row gift plan is premium', `Expected premium, got ${grantRes.body?.user?.gift?.plan}`);
  assert(grantRes.body?.user?.gift?.expiresAt === sevenDaysMs, 'FR-001 admin row gift expiresAt matches', `Mismatch in expiresAt`);
  assert(grantRes.body?.user?.gift?.note === '7-day premium gift for promotion', 'FR-001 admin row gift note matches', 'Mismatch in note');
  assert(typeof grantRes.body?.user?.gift?.grantedAt === 'number', 'FR-001 admin row gift grantedAt is timestamp', 'Missing grantedAt');
  assert(!!grantRes.body?.user?.gift?.grantedBy, 'FR-001 admin row gift grantedBy records actor', 'Missing grantedBy');

  // Verify public user object separates base plan and effectivePlan (FR-001, FR-002, FR-008, SC-001)
  const meAfterGrant = await request('/api/auth/me', { headers: { Cookie: userCookie } });
  assert(meAfterGrant.status === 200, 'FR-008 GET /api/auth/me after grant status 200', `Expected 200, got ${meAfterGrant.status}`);
  assert(meAfterGrant.body?.user?.plan === 'basic', 'FR-001 base plan stays basic', `Expected basic, got ${meAfterGrant.body?.user?.plan}`);
  assert(meAfterGrant.body?.user?.effectivePlan === 'premium', 'FR-002 effectivePlan is premium', `Expected premium, got ${meAfterGrant.body?.user?.effectivePlan}`);
  assert(meAfterGrant.body?.user?.gift?.plan === 'premium', 'FR-008 public user gift plan is premium', `Expected premium, got ${meAfterGrant.body?.user?.gift?.plan}`);
  assert(meAfterGrant.body?.user?.gift?.expiresAt === sevenDaysMs, 'FR-008 public user gift expiresAt matches', 'Mismatch in public user gift expiresAt');

  // Verify fresh login returns effectivePlan and gift (FR-008)
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: testUser.username, password: testUser.password })
  });
  assert(loginRes.status === 200, 'FR-008 login after grant status 200', `Expected 200, got ${loginRes.status}`);
  assert(loginRes.body?.user?.plan === 'basic', 'FR-008 login base plan is basic', `Expected basic, got ${loginRes.body?.user?.plan}`);
  assert(loginRes.body?.user?.effectivePlan === 'premium', 'FR-008 login effectivePlan is premium', `Expected premium, got ${loginRes.body?.user?.effectivePlan}`);
  assert(loginRes.body?.user?.gift?.plan === 'premium', 'FR-008 login gift plan is premium', `Expected premium, got ${loginRes.body?.user?.gift?.plan}`);

  // Verify entitlement decision: /api/plans reports effective plan (FR-002)
  const plansAfterGrant = await request('/api/plans', { headers: { Cookie: userCookie } });
  assert(plansAfterGrant.body?.current === 'premium', 'FR-002 /api/plans current is premium', `Expected premium, got ${plansAfterGrant.body?.current}`);

  // Verify entitlement decision: /api/user/state reports effective plan (FR-002)
  const stateAfterGrant = await request('/api/user/state', { headers: { Cookie: userCookie } });
  assert(stateAfterGrant.body?.plan === 'premium', 'FR-002 /api/user/state plan is premium', `Expected premium, got ${stateAfterGrant.body?.plan}`);

  // Verify entitlement decision: /api/candles depth limit reflects premium histBars (20000) (FR-002, SC-001)
  const candlesAfterGrant = await request('/api/candles?symbol=BTCUSDT&timeframe=60&limit=50000', { headers: { Cookie: userCookie } });
  assert(candlesAfterGrant.headers.get('x-history-limit') === '20000', 'FR-002 candles limit header is 20000 for premium gift',
    `Expected 20000, got ${candlesAfterGrant.headers.get('x-history-limit')}`);

  // Verify entitlement decision: Webhook alerts feature access (FR-002)
  const alertsRes = await request('/api/trade-relay/alerts', { headers: { Cookie: userCookie } });
  assert(alertsRes.status !== 403 || alertsRes.body?.error !== 'plan_feature_locked',
    'FR-002 webhookAlerts unlocked by premium gift', `Expected feature unlocked, got 403 plan_feature_locked`);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Unlimited Gift Grant & Immediate Replacement (FR-001, FR-002, FR-008)
  // ──────────────────────────────────────────────────────────────────────────
  const unlimGrantRes = await request(`/api/admin/users/${userId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: 'plus',
      expiresAt: null,
      note: 'Unlimited plus access'
    })
  });
  assert(unlimGrantRes.status === 200, 'FR-001 grant unlimited gift status 200', `Expected 200, got ${unlimGrantRes.status}`);
  assert(unlimGrantRes.body?.user?.gift?.plan === 'plus', 'FR-001 unlimited gift plan is plus', `Expected plus, got ${unlimGrantRes.body?.user?.gift?.plan}`);
  assert(unlimGrantRes.body?.user?.gift?.expiresAt === null, 'FR-001 unlimited gift expiresAt is null', `Expected null, got ${unlimGrantRes.body?.user?.gift?.expiresAt}`);

  const meUnlim = await request('/api/auth/me', { headers: { Cookie: userCookie } });
  assert(meUnlim.body?.user?.effectivePlan === 'plus', 'FR-002 effectivePlan updated to plus', `Expected plus, got ${meUnlim.body?.user?.effectivePlan}`);
  assert(meUnlim.body?.user?.gift?.expiresAt === null, 'FR-008 public user gift expiresAt is null for unlimited', `Expected null, got ${meUnlim.body?.user?.gift?.expiresAt}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Instantaneous Expiry Cutoff & Entitlement Fallback (FR-002, SC-002)
  // ──────────────────────────────────────────────────────────────────────────
  // Grant a gift that expires in 2 seconds
  const shortExpiry = Date.now() + 2000;
  const shortGrantRes = await request(`/api/admin/users/${userId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: 'premium',
      expiresAt: shortExpiry,
      note: 'Short lived gift'
    })
  });
  assert(shortGrantRes.status === 200, 'FR-002 grant short-lived gift status 200', `Expected 200, got ${shortGrantRes.status}`);

  // Right before expiry, effectivePlan is premium
  const meBeforeExp = await request('/api/auth/me', { headers: { Cookie: userCookie } });
  assert(meBeforeExp.body?.user?.effectivePlan === 'premium', 'FR-002 effectivePlan is premium before expiry', `Expected premium, got ${meBeforeExp.body?.user?.effectivePlan}`);

  // Wait 2500 ms to guarantee timestamp expiry has passed
  await new Promise(r => setTimeout(r, 2500));

  // Verify instantaneous fallback on next user request WITHOUT waiting for background job (FR-002, SC-002)
  const meAfterExp = await request('/api/auth/me', { headers: { Cookie: userCookie } });
  assert(meAfterExp.body?.user?.effectivePlan === 'basic',
    'FR-002 instantaneous fallback: effectivePlan is basic immediately after expiry passes',
    `Expected basic, got ${meAfterExp.body?.user?.effectivePlan}`);

  const plansAfterExp = await request('/api/plans', { headers: { Cookie: userCookie } });
  assert(plansAfterExp.body?.current === 'basic',
    'FR-002 instantaneous fallback: /api/plans current is basic immediately after expiry',
    `Expected basic, got ${plansAfterExp.body?.current}`);

  const candlesAfterExp = await request('/api/candles?symbol=BTCUSDT&timeframe=60&limit=50000', { headers: { Cookie: userCookie } });
  assert(candlesAfterExp.headers.get('x-history-limit') === '10000',
    'FR-002 instantaneous fallback: candles limit is 10000 immediately after expiry',
    `Expected 10000, got ${candlesAfterExp.headers.get('x-history-limit')}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Synced Cloud State Quota & Downgrade Rule on Expiry (FR-002, US2 Scenario 4)
  // ──────────────────────────────────────────────────────────────────────────
  // Grant plus plan gift (allows up to 10 savedLayouts, whereas basic allows 1)
  await request(`/api/admin/users/${userId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ plan: 'plus', expiresAt: Date.now() + 2000, note: 'State test gift' })
  });

  // Save state with 3 layouts (exceeds basic limit of 1, fits plus limit of 10)
  const multiLayoutState = {
    layouts: [
      { id: 'lay_1', name: 'Layout 1', symbol: 'BTCUSDT' },
      { id: 'lay_2', name: 'Layout 2', symbol: 'ETHUSDT' },
      { id: 'lay_3', name: 'Layout 3', symbol: 'SOLUSDT' }
    ]
  };
  const putStateRes = await request('/api/user/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({ state: multiLayoutState, baseUpdatedAt: 0 })
  });
  assert(putStateRes.status === 200, 'US2-S4 state with 3 layouts saved under gift plan', `Expected 200, got ${putStateRes.status}`);

  // Wait for gift to expire
  await new Promise(r => setTimeout(r, 2500));

  // Read state: existing 3 layouts are kept intact (not pruned or lost) (US2 Scenario 4)
  const getStateAfterExp = await request('/api/user/state', { headers: { Cookie: userCookie } });
  assert(getStateAfterExp.status === 200, 'US2-S4 existing state readable after expiry', `Expected 200, got ${getStateAfterExp.status}`);
  assert(Array.isArray(getStateAfterExp.body?.state?.layouts) && getStateAfterExp.body.state.layouts.length === 3,
    'US2-S4 existing 3 layouts retained after expiry', `Expected 3 layouts, got ${getStateAfterExp.body?.state?.layouts?.length}`);

  // Pushing a new update that still exceeds basic limit of 1 layout MUST be refused with 403 limit_exceeded (US2 Scenario 4)
  const putStateExceeding = await request('/api/user/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      state: {
        layouts: [
          { id: 'lay_1', name: 'Layout 1 modified', symbol: 'BTCUSDT' },
          { id: 'lay_2', name: 'Layout 2', symbol: 'ETHUSDT' }
        ]
      },
      baseUpdatedAt: getStateAfterExp.body?.updatedAt
    })
  });
  assert(putStateExceeding.status === 403, 'US2-S4 state push exceeding basic limit refused with 403', `Expected 403, got ${putStateExceeding.status}`);
  assert(putStateExceeding.body?.error === 'limit_exceeded', 'US2-S4 error code is limit_exceeded', `Expected limit_exceeded, got ${putStateExceeding.body?.error}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Background Expiry Job & Single Audit Event Verification (FR-006, SC-002, SC-003)
  // ──────────────────────────────────────────────────────────────────────────
  // Poll audit log for up to 65 seconds until the <= 60s background job executes
  let jobAudited = false;
  let jobEvents = [];
  const startWait = Date.now();
  console.log('[013 Suite 01] Waiting for periodic gift-expiry background job (max 65s)...');
  while (Date.now() - startWait < 65000) {
    const auditRes = await request(`/api/admin/audit?action=user.gift_expired`, { headers: adminHeaders });
    if (auditRes.status === 200 && Array.isArray(auditRes.body?.events)) {
      jobEvents = auditRes.body.events.filter(e => e.target === userId);
      if (jobEvents.length >= 1) {
        jobAudited = true;
        break;
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  assert(jobAudited, 'FR-006 periodic job removes expired gift and audits user.gift_expired', 'user.gift_expired audit event not found within 65s');
  assert(jobEvents.length === 1, 'SC-003 exactly one user.gift_expired event per expired gift', `Expected 1 event, got ${jobEvents.length}`);
  assert(jobEvents[0].actor === 'system', 'FR-006 expired gift audit actor is system', `Expected system, got ${jobEvents[0].actor}`);

  // Verify admin row gift property is cleared after job runs
  const adminUserFinal = await request(`/api/admin/users/${userId}`, { headers: adminHeaders });
  assert(adminUserFinal.body?.user?.gift === null, 'FR-006 admin row gift cleared after periodic job', `Expected null, got ${JSON.stringify(adminUserFinal.body?.user?.gift)}`);

  console.log('✅ [013 Acceptance Suite 01] Effective Plan, Entitlements & Gift Lifecycle passed.');
}

run().catch(err => {
  console.error(`❌ Suite 01 unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
