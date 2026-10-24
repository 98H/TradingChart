/**
 * @spec 010
 * @covers FR-001, FR-002, FR-003, FR-004, FR-015
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:8088');

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
  return `10.91.${ipSubnet}.${ipHost}`;
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
  console.log(`[010 Acceptance Suite 01] Running Admin Auth & Session Lifecycle against ${BASE_URL}...`);
  const masterKey = getMasterKey();
  assert(!!masterKey, 'Suite 01 setup: master key present', 'Master key could not be loaded from file or env');

  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Unauthenticated and Non-Admin Caller Rejection (FR-001)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const protectedRoutes = [
      '/api/admin/overview',
      '/api/admin/users',
      '/api/admin/plans',
      '/api/admin/settings',
      '/api/admin/system',
      '/api/admin/audit',
      '/api/admin/sessions'
    ];

    for (const route of protectedRoutes) {
      const res = await request(route);
      assert(res.status === 403, `FR-001 unauthenticated ${route} status 403`, `Expected 403, got ${res.status}`);
      assert(res.body?.error === 'forbidden_admin_only', `FR-001 unauthenticated ${route} error code`, `Expected forbidden_admin_only, got ${res.body?.error}`);
    }

    // Register a standard (non-admin) user and verify 403 on admin routes
    const regularUser = {
      email: `regular_${ts}@acceptance.test`,
      username: `reg_${ts}`.slice(0, 24),
      password: 'RegularPassword123!',
      displayName: `Regular Trader ${ts}`
    };
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regularUser)
    });
    assert(regRes.status === 200, 'FR-001 setup: regular user registration', `Expected 200, got ${regRes.status}`);
    const userCookie = regRes.headers.get('set-cookie');
    assert(!!userCookie, 'FR-001 setup: user session cookie', 'Missing regular user session cookie');

    const regularAdminRes = await request('/api/admin/users', { headers: { Cookie: userCookie } });
    assert(regularAdminRes.status === 403, 'FR-001 regular user on admin route status 403', `Expected 403, got ${regularAdminRes.status}`);
    assert(regularAdminRes.body?.error === 'forbidden_admin_only', 'FR-001 regular user error code', `Expected forbidden_admin_only, got ${regularAdminRes.body?.error}`);

    const regularSessionRes = await request('/api/admin/session', { headers: { Cookie: userCookie } });
    assert(regularSessionRes.status === 200, 'FR-001 regular user GET /api/admin/session status 200', `Expected 200, got ${regularSessionRes.status}`);
    assert(regularSessionRes.body?.isAdmin === false, 'FR-001 regular user isAdmin is false', `Expected isAdmin: false, got ${regularSessionRes.body?.isAdmin}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Master Key Verification, Rate Limiting & Session Minting (FR-002)
  // ──────────────────────────────────────────────────────────────────────────
  let adminCookie = '';
  {
    const authRateIp = nextIp();

    // Invalid master key returns 401 invalid_master_key
    const badAuthRes = await request('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterKey: 'invalid_key_attempt' })
    }, authRateIp);
    assert(badAuthRes.status === 401, 'FR-002 invalid master key status 401', `Expected 401, got ${badAuthRes.status}`);
    assert(badAuthRes.body?.error === 'invalid_master_key', 'FR-002 invalid master key error code', `Expected invalid_master_key, got ${badAuthRes.body?.error}`);

    // Verify rate limit (5 attempts per minute per IP -> 6th returns 429 rate_limited)
    for (let i = 2; i <= 5; i++) {
      const r = await request('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: `wrong_attempt_${i}` })
      }, authRateIp);
      assert(r.status === 401, `FR-002 rate limit attempt ${i} status 401`, `Expected 401, got ${r.status}`);
    }

    const rateLimitedRes = await request('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterKey: 'wrong_attempt_6' })
    }, authRateIp);
    assert(rateLimitedRes.status === 429, 'FR-002 6th attempt rate-limited status 429', `Expected 429, got ${rateLimitedRes.status}`);
    assert(rateLimitedRes.body?.error === 'rate_limited', 'FR-002 rate_limited error code', `Expected rate_limited, got ${rateLimitedRes.body?.error}`);

    // Successful unlock with correct master key on fresh IP
    const validAuthRes = await request('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterKey })
    });
    assert(validAuthRes.status === 200, 'FR-002 valid master key status 200', `Expected 200, got ${validAuthRes.status}`);
    assert(validAuthRes.body?.ok === true, 'FR-002 valid master key ok: true', 'Expected ok: true');
    assert(validAuthRes.body?.isAdmin === true, 'FR-002 valid master key isAdmin: true', 'Expected isAdmin: true');
    assert(typeof validAuthRes.body?.expiresAt === 'number', 'FR-002 valid master key expiresAt timestamp', 'Missing expiresAt');

    const setCookie = validAuthRes.headers.get('set-cookie') || '';
    assert(setCookie.includes('tc_admin='), 'FR-002 tc_admin cookie present', `Set-Cookie header missing tc_admin: ${setCookie}`);
    assert(/HttpOnly/i.test(setCookie), 'FR-002 tc_admin cookie HttpOnly', 'Cookie missing HttpOnly attribute');
    assert(/SameSite=Strict/i.test(setCookie), 'FR-002 tc_admin cookie SameSite=Strict', 'Cookie missing SameSite=Strict attribute');
    assert(/Max-Age=43200/i.test(setCookie), 'FR-002 tc_admin cookie 12h Max-Age', 'Cookie Max-Age is not 43200 seconds');

    adminCookie = setCookie.split(';')[0];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. X-Master-Key Header, Lockout & Query String Rejection (FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Valid X-Master-Key header grants access
    const headerRes = await request('/api/admin/session', {
      headers: { 'X-Master-Key': masterKey }
    });
    assert(headerRes.status === 200, 'FR-003 valid X-Master-Key status 200', `Expected 200, got ${headerRes.status}`);
    assert(headerRes.body?.ok === true && headerRes.body?.isAdmin === true, 'FR-003 valid X-Master-Key isAdmin', 'Expected isAdmin: true');
    assert(headerRes.body?.via === 'key', 'FR-003 via is "key"', `Expected via: 'key', got ${headerRes.body?.via}`);
    assert(headerRes.body?.actor === 'master-key', 'FR-003 actor is "master-key"', `Expected actor: 'master-key', got ${headerRes.body?.actor}`);

    // Keys in query strings MUST be refused (FR-003 edge case)
    const querySessionRes = await request(`/api/admin/session?masterKey=${encodeURIComponent(masterKey)}`);
    assert(querySessionRes.body?.isAdmin === false, 'FR-003 masterKey in query string refused on session', 'Expected isAdmin: false');

    const queryProtectedRes = await request(`/api/admin/users?masterKey=${encodeURIComponent(masterKey)}`);
    assert(queryProtectedRes.status === 403, 'FR-003 masterKey in query string refused on protected route', `Expected 403, got ${queryProtectedRes.status}`);

    const queryKeyRes = await request(`/api/admin/users?key=${encodeURIComponent(masterKey)}`);
    assert(queryKeyRes.status === 403, 'FR-003 key in query string refused on protected route', `Expected 403, got ${queryKeyRes.status}`);

    // Failed X-Master-Key attempts rate limiting: 10 failed attempts locks out IP (FR-003 edge case)
    const headerLockIp = nextIp();
    for (let i = 0; i < 10; i++) {
      await request('/api/admin/session', {
        headers: { 'X-Master-Key': `wrong_header_key_${i}` }
      }, headerLockIp);
    }
    // Attempt with valid key from the locked-out IP is refused
    const lockedRes = await request('/api/admin/session', {
      headers: { 'X-Master-Key': masterKey }
    }, headerLockIp);
    assert(lockedRes.body?.isAdmin === false, 'FR-003 10 failed X-Master-Key attempts locks out IP', `Expected isAdmin: false, got ${lockedRes.body?.isAdmin}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Session Inspection, Role-Based Access & Logout (FR-004)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Inspect token-based admin session
    const sessionRes = await request('/api/admin/session', {
      headers: { Cookie: adminCookie }
    });
    assert(sessionRes.status === 200, 'FR-004 GET /api/admin/session status 200', `Expected 200, got ${sessionRes.status}`);
    assert(sessionRes.body?.ok === true, 'FR-004 session ok: true', 'Expected ok: true');
    assert(sessionRes.body?.isAdmin === true, 'FR-004 session isAdmin: true', 'Expected isAdmin: true');
    assert(sessionRes.body?.via === 'token', 'FR-004 session via: token', `Expected via: 'token', got ${sessionRes.body?.via}`);
    assert(typeof sessionRes.body?.actor === 'string' && sessionRes.body.actor.startsWith('admin-session'),
      'FR-004 session actor formatted', `Expected admin-session ..., got ${sessionRes.body?.actor}`);
    assert(typeof sessionRes.body?.expiresAt === 'number', 'FR-004 session expiresAt timestamp', 'Missing expiresAt');

    // Role-based admin access verification (FR-001, FR-004)
    // Create a user and elevate to admin role using X-Master-Key
    const roleUser = {
      email: `admin_role_${ts}@acceptance.test`,
      username: `adm_${ts}`.slice(0, 24),
      password: 'AdminRolePassword123!',
      displayName: `Admin Role User ${ts}`
    };
    const regRoleRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleUser)
    });
    assert(regRoleRes.status === 200, 'FR-004 setup: admin role user registration', `Expected 200, got ${regRoleRes.status}`);
    const roleUserId = regRoleRes.body?.user?.id;
    const roleUserCookie = regRoleRes.headers.get('set-cookie');

    // Promote to admin role via admin API
    const promoteRes = await request(`/api/admin/users/${roleUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': masterKey },
      body: JSON.stringify({ role: 'admin' })
    });
    assert(promoteRes.status === 200, 'FR-004 promote user to admin role', `Expected 200, got ${promoteRes.status}`);

    // Call /api/admin/session with promoted user's session cookie
    const roleSessionRes = await request('/api/admin/session', {
      headers: { Cookie: roleUserCookie }
    });
    assert(roleSessionRes.body?.isAdmin === true, 'FR-004 role user isAdmin: true', `Expected isAdmin: true, got ${roleSessionRes.body?.isAdmin}`);
    assert(roleSessionRes.body?.via === 'role', 'FR-004 role user via: "role"', `Expected via: 'role', got ${roleSessionRes.body?.via}`);
    assert(roleSessionRes.body?.userId === roleUserId, 'FR-004 role user userId matches', `Expected ${roleUserId}, got ${roleSessionRes.body?.userId}`);
    assert(roleSessionRes.body?.username === roleUser.username, 'FR-004 role user username matches', `Expected ${roleUser.username}, got ${roleSessionRes.body?.username}`);

    // Role user accesses protected route without master key
    const roleAccessRes = await request('/api/admin/users', {
      headers: { Cookie: roleUserCookie }
    });
    assert(roleAccessRes.status === 200, 'FR-001/FR-004 role user accesses /api/admin/users without key', `Expected 200, got ${roleAccessRes.status}`);

    // Clean up role user
    await request(`/api/admin/users/${roleUserId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': masterKey },
      body: JSON.stringify({ confirm: roleUser.username })
    });

    // Test POST /api/admin/logout revoking token session
    const logoutRes = await request('/api/admin/logout', {
      method: 'POST',
      headers: { Cookie: adminCookie }
    });
    assert(logoutRes.status === 200, 'FR-004 POST /api/admin/logout status 200', `Expected 200, got ${logoutRes.status}`);
    assert(logoutRes.body?.ok === true, 'FR-004 logout ok: true', 'Expected ok: true');

    const logoutSetCookie = logoutRes.headers.get('set-cookie') || '';
    assert(logoutSetCookie.includes('Max-Age=0') || logoutSetCookie.includes('tc_admin=;'),
      'FR-004 logout clears tc_admin cookie', `Set-Cookie header does not clear cookie: ${logoutSetCookie}`);

    // Subsequent session call with old cookie returns non-admin
    const postLogoutSession = await request('/api/admin/session', {
      headers: { Cookie: adminCookie }
    });
    assert(postLogoutSession.body?.isAdmin === false, 'FR-004 session invalid after logout', `Expected isAdmin: false, got ${postLogoutSession.body?.isAdmin}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. System Health Telemetry & Admin Sessions Management (FR-015)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // GET /api/admin/system
    const sysRes = await request('/api/admin/system', {
      headers: { 'X-Master-Key': masterKey }
    });
    assert(sysRes.status === 200, 'FR-015 GET /api/admin/system status 200', `Expected 200, got ${sysRes.status}`);
    assert(sysRes.body?.ok === true, 'FR-015 system body ok: true', 'Expected ok: true');

    const server = sysRes.body?.server;
    assert(typeof server?.uptimeSec === 'number', 'FR-015 server.uptimeSec number', 'Missing uptimeSec');
    assert(typeof server?.node === 'string' && server.node.startsWith('v'), 'FR-015 server.node version string', `Invalid node version: ${server?.node}`);
    assert(typeof server?.rssMB === 'number', 'FR-015 server.rssMB number', 'Missing rssMB');
    assert(typeof server?.heapMB === 'number', 'FR-015 server.heapMB number', 'Missing heapMB');
    assert(Array.isArray(server?.load) && server.load.length === 3, 'FR-015 server.load 3-element array', 'Missing load average array');
    assert(typeof server?.cpus === 'number', 'FR-015 server.cpus number', 'Missing cpus count');
    assert(typeof server?.memTotalMB === 'number', 'FR-015 server.memTotalMB number', 'Missing memTotalMB');
    assert(typeof server?.memFreeMB === 'number', 'FR-015 server.memFreeMB number', 'Missing memFreeMB');
    assert(['file', 'env'].includes(server?.keySource), 'FR-015 server.keySource is "file" or "env"', `Invalid keySource: ${server?.keySource}`);

    const storage = sysRes.body?.storage;
    assert(typeof storage?.users === 'number', 'FR-015 storage.users number', 'Missing storage users count');
    assert(typeof storage?.sessions === 'number', 'FR-015 storage.sessions number', 'Missing storage sessions count');
    assert(typeof storage?.stateFiles === 'number', 'FR-015 storage.stateFiles number', 'Missing storage stateFiles count');
    assert(typeof storage?.stateBytes === 'number', 'FR-015 storage.stateBytes number', 'Missing storage stateBytes');

    assert(Array.isArray(sysRes.body?.outbox), 'FR-015 outbox array present', 'Outbox is not an array');
    assert(typeof sysRes.body?.mail === 'object', 'FR-015 mail status object present', 'Missing mail status');

    // Mint a new admin session to manage via sessions API
    const authRes = await request('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterKey })
    });
    const freshCookie = (authRes.headers.get('set-cookie') || '').split(';')[0];
    assert(!!freshCookie, 'FR-015 setup: minted admin cookie', 'Failed to mint session cookie');

    // GET /api/admin/sessions
    const sessionsRes = await request('/api/admin/sessions', {
      headers: { Cookie: freshCookie }
    });
    assert(sessionsRes.status === 200, 'FR-015 GET /api/admin/sessions status 200', `Expected 200, got ${sessionsRes.status}`);
    assert(sessionsRes.body?.ok === true, 'FR-015 sessions ok: true', 'Expected ok: true');
    assert(Array.isArray(sessionsRes.body?.sessions), 'FR-015 sessions array', 'Missing sessions array');

    const currentSession = sessionsRes.body.sessions.find(s => s.current === true);
    assert(!!currentSession, 'FR-015 current session badged in list', 'Missing session with current: true');
    assert(typeof currentSession.id === 'string' && currentSession.id.startsWith('as_'),
      'FR-015 session id format as_...', `Invalid session id: ${currentSession?.id}`);
    assert(typeof currentSession.createdAt === 'number', 'FR-015 session createdAt', 'Missing createdAt');
    assert(typeof currentSession.expiresAt === 'number', 'FR-015 session expiresAt', 'Missing expiresAt');

    // DELETE /api/admin/sessions/nonexistent -> 404 session_not_found
    const badDelRes = await request('/api/admin/sessions/as_nonexistent_9999', {
      method: 'DELETE',
      headers: { Cookie: freshCookie }
    });
    assert(badDelRes.status === 404, 'FR-015 delete nonexistent session status 404', `Expected 404, got ${badDelRes.status}`);
    assert(badDelRes.body?.error === 'session_not_found', 'FR-015 session_not_found error code', `Expected session_not_found, got ${badDelRes.body?.error}`);

    // Create another session on separate IP and revoke it remotely
    const secondAuth = await request('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterKey })
    });
    const secondCookie = (secondAuth.headers.get('set-cookie') || '').split(';')[0];

    const updatedSessionsRes = await request('/api/admin/sessions', {
      headers: { Cookie: freshCookie }
    });
    const targetSession = updatedSessionsRes.body.sessions.find(s => s.current === false);
    if (targetSession) {
      const revokeRes = await request(`/api/admin/sessions/${targetSession.id}`, {
        method: 'DELETE',
        headers: { Cookie: freshCookie }
      });
      assert(revokeRes.status === 200, 'FR-015 delete remote admin session status 200', `Expected 200, got ${revokeRes.status}`);
      assert(revokeRes.body?.ok === true, 'FR-015 remote delete ok: true', 'Expected ok: true');
      assert(revokeRes.body?.self === false, 'FR-015 remote delete self: false', `Expected self: false, got ${revokeRes.body?.self}`);
    }

    // Clean up fresh session
    await request('/api/admin/logout', { method: 'POST', headers: { Cookie: freshCookie } });
    if (secondCookie) {
      await request('/api/admin/logout', { method: 'POST', headers: { Cookie: secondCookie } });
    }
  }

  console.log('✅ [010 Acceptance Suite 01] Admin Auth & Session Lifecycle passed.');
}

run().catch(err => {
  console.error(`❌ Suite 01 unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
