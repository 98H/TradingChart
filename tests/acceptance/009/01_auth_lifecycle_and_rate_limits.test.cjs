/**
 * @spec 009
 * @covers FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-008, FR-017
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:8088');
const OUTBOX_PATH = path.resolve(__dirname, '../../../server/data/accounts/outbox.json');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

// Generate distinct IPs so test operations don't collide with rate limits
let ipSubnet = Math.floor(Math.random() * 200) + 10;
let ipHost = 1;
function nextIp() {
  ipHost++;
  if (ipHost > 250) { ipSubnet++; ipHost = 1; }
  return `10.99.${ipSubnet}.${ipHost}`;
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

function getOutboxCode(email, kind) {
  try {
    if (!fs.existsSync(OUTBOX_PATH)) return null;
    const box = JSON.parse(fs.readFileSync(OUTBOX_PATH, 'utf8'));
    const msgs = box.messages || [];
    const found = msgs.find(m => (m.email || '').toLowerCase() === email.toLowerCase() && (!kind || m.kind === kind));
    return found?.code || null;
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log(`[009 Acceptance Suite 01] Running Auth Lifecycle & Rate Limits against ${BASE_URL}...`);

  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const testUser = {
    email: `qa_auth_${ts}@acceptance.test`,
    username: `qa_auth_${ts}`.slice(0, 24),
    password: 'StrongAuthPassword123!',
    displayName: `Acceptance Trader ${ts}`
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Registration Field Validation (FR-001)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Invalid email syntax
    const badEmailRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', username: `u_${ts}`, password: 'ValidPassword123!' })
    });
    assert(badEmailRes.status === 400, 'FR-001 invalid email status', `Expected 400, got ${badEmailRes.status}`);
    const emailErr = badEmailRes.body?.errors?.find(e => e.field === 'email');
    assert(emailErr && emailErr.code === 'invalid_email', 'FR-001 invalid email error code', `Expected invalid_email, got ${JSON.stringify(badEmailRes.body)}`);

    // Invalid username syntax (too short or special characters)
    const badUserRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `valid_${ts}@acceptance.test`, username: 'a', password: 'ValidPassword123!' })
    });
    assert(badUserRes.status === 400, 'FR-001 invalid username status', `Expected 400, got ${badUserRes.status}`);
    const userErr = badUserRes.body?.errors?.find(e => e.field === 'username');
    assert(userErr && userErr.code === 'invalid_username', 'FR-001 invalid username error code', `Expected invalid_username, got ${JSON.stringify(badUserRes.body)}`);

    // Blocklisted username
    const blockUserRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `valid2_${ts}@acceptance.test`, username: 'admin', password: 'ValidPassword123!' })
    });
    assert(blockUserRes.status === 400, 'FR-001 blocklisted username status', `Expected 400, got ${blockUserRes.status}`);
    const blockErr = blockUserRes.body?.errors?.find(e => e.field === 'username');
    assert(blockErr && blockErr.code === 'username_blocked', 'FR-001 username_blocked error code', `Expected username_blocked, got ${JSON.stringify(blockUserRes.body)}`);

    // Weak password (< 8 chars)
    const weakPassRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `valid3_${ts}@acceptance.test`, username: `u3_${ts}`, password: '123' })
    });
    assert(weakPassRes.status === 400, 'FR-001 weak password status', `Expected 400, got ${weakPassRes.status}`);
    const passErr = weakPassRes.body?.errors?.find(e => e.field === 'password');
    assert(passErr && (passErr.code === 'password_weak' || passErr.code === 'password_length'),
      'FR-001 password_weak error code', `Expected password_weak, got ${JSON.stringify(weakPassRes.body)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Successful Registration & Session Cookie Verification (FR-001, FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  let sessionCookie = '';
  let registeredUserId = '';
  {
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    assert(regRes.status === 200, 'FR-001 successful registration status', `Expected 200, got ${regRes.status}`);
    assert(regRes.body?.ok === true, 'FR-001 registration body ok', 'Expected ok: true');
    assert(regRes.body?.needsVerification === true, 'FR-001 registration needsVerification', 'Expected needsVerification: true');

    const u = regRes.body?.user;
    assert(u && typeof u.id === 'string' && u.id.startsWith('u_'), 'FR-001 registered user id format', `Invalid user id: ${u?.id}`);
    assert(u.email === testUser.email.toLowerCase(), 'FR-001 user email', `Email mismatch: ${u?.email}`);
    assert(u.username === testUser.username, 'FR-001 user username', `Username mismatch: ${u?.username}`);
    assert(u.plan === 'basic', 'FR-001 initial plan', `Expected basic, got ${u?.plan}`);
    assert(u.role === 'user', 'FR-001 initial role', `Expected user, got ${u?.role}`);
    assert(u.emailVerified === false, 'FR-001 initial emailVerified', 'Expected false');
    registeredUserId = u.id;

    // Verify session cookie
    const setCookie = regRes.headers.get('set-cookie');
    assert(setCookie && setCookie.includes('tc_session='), 'FR-003 Set-Cookie tc_session present', 'Missing tc_session cookie in response');
    assert(setCookie.includes('HttpOnly'), 'FR-003 Set-Cookie HttpOnly attribute', 'Missing HttpOnly flag');
    assert(setCookie.includes('SameSite=Lax'), 'FR-003 Set-Cookie SameSite=Lax attribute', 'Missing SameSite=Lax flag');
    sessionCookie = setCookie;

    // Duplicate email conflict (409)
    const dupEmailRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, username: `other_${ts}`, password: 'Password123!' })
    });
    assert(dupEmailRes.status === 409, 'FR-001 duplicate email status 409', `Expected 409, got ${dupEmailRes.status}`);
    const dupEmailErr = dupEmailRes.body?.errors?.find(e => e.field === 'email');
    assert(dupEmailErr && dupEmailErr.code === 'email_taken', 'FR-001 email_taken code', `Expected email_taken, got ${JSON.stringify(dupEmailRes.body)}`);

    // Duplicate username conflict (409)
    const dupUserRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `other_${ts}@acceptance.test`, username: testUser.username, password: 'Password123!' })
    });
    assert(dupUserRes.status === 409, 'FR-001 duplicate username status 409', `Expected 409, got ${dupUserRes.status}`);
    const dupUserErr = dupUserRes.body?.errors?.find(e => e.field === 'username');
    assert(dupUserErr && dupUserErr.code === 'username_taken', 'FR-001 username_taken code', `Expected username_taken, got ${JSON.stringify(dupUserRes.body)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. User Authentication / Login (FR-002, FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Wrong password -> 401 invalid_credentials
    const badPassRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.username, password: 'WrongPassword999!' })
    });
    assert(badPassRes.status === 401, 'FR-002 wrong password status', `Expected 401, got ${badPassRes.status}`);
    assert(badPassRes.body?.error === 'invalid_credentials', 'FR-002 invalid_credentials error', `Expected invalid_credentials, got ${badPassRes.body?.error}`);

    // Unknown user -> 401 invalid_credentials
    const unknownRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: `nonexistent_${ts}`, password: 'SomePassword123!' })
    });
    assert(unknownRes.status === 401, 'FR-002 unknown user status', `Expected 401, got ${unknownRes.status}`);
    assert(unknownRes.body?.error === 'invalid_credentials', 'FR-002 unknown user invalid_credentials', `Expected invalid_credentials, got ${unknownRes.body?.error}`);

    // Sign in with email
    const loginEmailRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.email, password: testUser.password })
    });
    assert(loginEmailRes.status === 200, 'FR-002 login with email status', `Expected 200, got ${loginEmailRes.status}`);
    assert(loginEmailRes.body?.ok === true && loginEmailRes.body?.user?.id === registeredUserId,
      'FR-002 login with email user match', 'User ID mismatch on email login');

    // Sign in with username
    const loginUserRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.username, password: testUser.password })
    });
    assert(loginUserRes.status === 200, 'FR-002 login with username status', `Expected 200, got ${loginUserRes.status}`);
    assert(loginUserRes.body?.ok === true && loginUserRes.body?.user?.username === testUser.username,
      'FR-002 login with username match', 'Username mismatch on username login');
    sessionCookie = loginUserRes.headers.get('set-cookie') || sessionCookie;

    // GET /api/auth/me with session
    const meAuthRes = await request('/api/auth/me', {
      headers: { Cookie: sessionCookie }
    });
    assert(meAuthRes.status === 200, 'FR-003 GET /api/auth/me authenticated status', `Expected 200, got ${meAuthRes.status}`);
    assert(meAuthRes.body?.ok === true && meAuthRes.body?.user?.id === registeredUserId,
      'FR-003 GET /api/auth/me user match', 'Authenticated user ID mismatch');
    assert(typeof meAuthRes.body?.sessionId === 'string', 'FR-003 GET /api/auth/me sessionId present', 'Missing sessionId in /api/auth/me');

    // GET /api/auth/me as guest (no cookie)
    const meGuestRes = await request('/api/auth/me');
    assert(meGuestRes.status === 200, 'FR-003 GET /api/auth/me guest status', `Expected 200, got ${meGuestRes.status}`);
    assert(meGuestRes.body?.ok === true && meGuestRes.body?.user === null,
      'FR-003 GET /api/auth/me guest returns user null', `Expected null, got ${JSON.stringify(meGuestRes.body)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Platform Status & Email Verification Flow (FR-004, FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Check GET /api/platform reports emailDelivery
    const platformRes = await request('/api/platform');
    assert(platformRes.status === 200, 'FR-006 GET /api/platform status', `Expected 200, got ${platformRes.status}`);
    assert(typeof platformRes.body?.emailDelivery === 'boolean', 'FR-006 platform emailDelivery boolean', 'Missing emailDelivery flag');

    // Retrieve initial verification code from outbox
    const vCode = getOutboxCode(testUser.email, 'verify');
    assert(typeof vCode === 'string' && /^\d{6}$/.test(vCode),
      'FR-006 verification code delivered to outbox', `Invalid or missing verify code: ${vCode}`);

    // Request-verify endpoint (generates a fresh code)
    const reqVerifyRes = await request('/api/auth/request-verify', {
      method: 'POST',
      headers: { Cookie: sessionCookie }
    });
    assert(reqVerifyRes.status === 200, 'FR-004 request-verify status', `Expected 200, got ${reqVerifyRes.status}`);

    const freshVCode = getOutboxCode(testUser.email, 'verify');
    assert(typeof freshVCode === 'string' && /^\d{6}$/.test(freshVCode),
      'FR-004 fresh verification code in outbox', `Expected fresh 6-digit code, got ${freshVCode}`);

    // Verify with invalid code -> 400 invalid_code
    const badVerifyRes = await request('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ code: '000000' })
    });
    assert(badVerifyRes.status === 400, 'FR-004 invalid verify code status', `Expected 400, got ${badVerifyRes.status}`);
    assert(badVerifyRes.body?.error === 'invalid_code', 'FR-004 invalid_code error', `Expected invalid_code, got ${badVerifyRes.body?.error}`);

    // Verify with correct code -> 200 emailVerified: true
    const goodVerifyRes = await request('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ code: freshVCode })
    });
    assert(goodVerifyRes.status === 200, 'FR-004 successful verification status', `Expected 200, got ${goodVerifyRes.status}`);
    assert(goodVerifyRes.body?.user?.emailVerified === true, 'FR-004 user emailVerified flag is true', 'Expected emailVerified: true');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Password Reset Flow (FR-005, FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Request reset for non-existent email -> 200 ok (no enumeration)
    const nonExistentRes = await request('/api/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nobody_${ts}@acceptance.test` })
    });
    assert(nonExistentRes.status === 200, 'FR-005 non-existent email reset status', `Expected 200, got ${nonExistentRes.status}`);
    assert(nonExistentRes.body?.ok === true, 'FR-005 non-existent email reset ok', 'Expected ok: true');

    // Request reset for registered email
    const reqResetRes = await request('/api/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email })
    });
    assert(reqResetRes.status === 200, 'FR-005 request reset status', `Expected 200, got ${reqResetRes.status}`);

    const resetCode = getOutboxCode(testUser.email, 'reset');
    assert(typeof resetCode === 'string' && /^\d{6}$/.test(resetCode),
      'FR-005 reset code delivered to outbox', `Expected 6-digit reset code, got ${resetCode}`);

    // Reset with invalid code -> 400 invalid_code
    const badCodeResetRes = await request('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.email, code: '000000', password: 'NewStrongPassword123!' })
    });
    assert(badCodeResetRes.status === 400, 'FR-005 invalid reset code status', `Expected 400, got ${badCodeResetRes.status}`);
    assert(badCodeResetRes.body?.error === 'invalid_code', 'FR-005 invalid_code error', `Expected invalid_code, got ${badCodeResetRes.body?.error}`);

    // Reset with weak password -> 400 password_weak
    const weakPassResetRes = await request('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.email, code: resetCode, password: '123' })
    });
    assert(weakPassResetRes.status === 400, 'FR-005 weak password reset status', `Expected 400, got ${weakPassResetRes.status}`);
    assert(weakPassResetRes.body?.error === 'password_weak', 'FR-005 password_weak error', `Expected password_weak, got ${weakPassResetRes.body?.error}`);

    // Reset with valid code & strong password -> 200 ok
    const newPassword = 'BrandNewPassword456!';
    const goodResetRes = await request('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.email, code: resetCode, password: newPassword })
    });
    assert(goodResetRes.status === 200, 'FR-005 successful reset status', `Expected 200, got ${goodResetRes.status}`);
    assert(goodResetRes.body?.ok === true, 'FR-005 successful reset body ok', 'Expected ok: true');

    // Old password now fails
    const oldLoginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.email, password: testUser.password })
    });
    assert(oldLoginRes.status === 401, 'FR-005 old password fails login', `Expected 401, got ${oldLoginRes.status}`);

    // New password succeeds
    const newLoginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.email, password: newPassword })
    });
    assert(newLoginRes.status === 200, 'FR-005 new password succeeds login', `Expected 200, got ${newLoginRes.status}`);
    sessionCookie = newLoginRes.headers.get('set-cookie');
    testUser.password = newPassword;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Change Password & Invalidate Other Sessions (FR-008, FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Create a secondary session
    const secLoginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.username, password: testUser.password })
    });
    assert(secLoginRes.status === 200, 'FR-008 create secondary session', `Expected 200, got ${secLoginRes.status}`);
    const secondaryCookie = secLoginRes.headers.get('set-cookie');

    // Change password with wrong current -> 400 invalid_current
    const badCurRes = await request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ current: 'WrongCurrentPassword!', next: 'AnotherNewPass789!' })
    });
    assert(badCurRes.status === 400, 'FR-008 wrong current password status', `Expected 400, got ${badCurRes.status}`);
    assert(badCurRes.body?.error === 'invalid_current', 'FR-008 invalid_current error', `Expected invalid_current, got ${badCurRes.body?.error}`);

    // Change password with weak next -> 400 password_weak
    const weakNextRes = await request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ current: testUser.password, next: 'short' })
    });
    assert(weakNextRes.status === 400, 'FR-008 weak next password status', `Expected 400, got ${weakNextRes.status}`);
    assert(weakNextRes.body?.error === 'password_weak', 'FR-008 password_weak error', `Expected password_weak, got ${weakNextRes.body?.error}`);

    // Valid change password
    const nextPassword = 'UltraSecurePassword999!';
    const changeRes = await request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ current: testUser.password, next: nextPassword })
    });
    assert(changeRes.status === 200, 'FR-008 valid change password status', `Expected 200, got ${changeRes.status}`);
    testUser.password = nextPassword;

    // Current session remains alive
    const curMeRes = await request('/api/auth/me', { headers: { Cookie: sessionCookie } });
    assert(curMeRes.status === 200 && curMeRes.body?.user?.id === registeredUserId,
      'FR-008 current session stays valid', 'Current session was unexpectedly revoked');

    // Secondary session was invalidated
    const secMeRes = await request('/api/auth/me', { headers: { Cookie: secondaryCookie } });
    assert(secMeRes.status === 200 && secMeRes.body?.user === null,
      'FR-008 other session revoked on password change', `Secondary session was not revoked: ${JSON.stringify(secMeRes.body)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Logout & Logout-All (FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Create 2 fresh sessions
    const s1Res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.username, password: testUser.password })
    });
    const s2Res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.username, password: testUser.password })
    });
    const c1 = s1Res.headers.get('set-cookie');
    const c2 = s2Res.headers.get('set-cookie');

    // Single logout on c1
    const logoutRes = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: c1 }
    });
    assert(logoutRes.status === 200, 'FR-003 logout status', `Expected 200, got ${logoutRes.status}`);
    const logoutCookie = logoutRes.headers.get('set-cookie');
    assert(logoutCookie && (logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires=')),
      'FR-003 logout clears session cookie', 'Logout did not clear cookie');

    // c1 is now unauthenticated
    const checkC1 = await request('/api/auth/me', { headers: { Cookie: c1 } });
    assert(checkC1.body?.user === null, 'FR-003 logged out cookie is unauthenticated', 'c1 is still authenticated');

    // c2 remains valid
    const checkC2 = await request('/api/auth/me', { headers: { Cookie: c2 } });
    assert(checkC2.body?.user?.id === registeredUserId, 'FR-003 c2 remains authenticated', 'c2 was unexpectedly revoked');

    // Logout-all from c2
    const logoutAllRes = await request('/api/auth/logout-all', {
      method: 'POST',
      headers: { Cookie: c2 }
    });
    assert(logoutAllRes.status === 200, 'FR-003 logout-all status', `Expected 200, got ${logoutAllRes.status}`);

    // c2 is now also unauthenticated
    const checkC2After = await request('/api/auth/me', { headers: { Cookie: c2 } });
    assert(checkC2After.body?.user === null, 'FR-003 logout-all revoked c2', 'c2 is still authenticated after logout-all');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Authentication Rate Limits (FR-017)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Register rate limit: 5/min per IP
    const regIp = `10.88.${Math.floor(Math.random() * 200) + 10}.1`;
    let regHit429 = false;
    for (let i = 0; i < 7; i++) {
      const res = await request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `rate_reg_${ts}_${i}@acceptance.test`, username: `rreg_${ts}_${i}`, password: 'Password123!' })
      }, regIp);
      if (res.status === 429) {
        regHit429 = true;
        assert(res.body?.error === 'rate_limited', 'FR-017 register rate_limited error', `Expected rate_limited, got ${res.body?.error}`);
        break;
      }
    }
    assert(regHit429, 'FR-017 register endpoint rate limit 5/min enforced', 'Register did not trigger 429 within 7 requests');

    // Login rate limit: 10/min per IP
    const loginIp = `10.88.${Math.floor(Math.random() * 200) + 10}.2`;
    let loginHit429 = false;
    for (let i = 0; i < 13; i++) {
      const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: 'nobody', password: 'wrong' })
      }, loginIp);
      if (res.status === 429) {
        loginHit429 = true;
        assert(res.body?.error === 'rate_limited', 'FR-017 login rate_limited error', `Expected rate_limited, got ${res.body?.error}`);
        break;
      }
    }
    assert(loginHit429, 'FR-017 login endpoint rate limit 10/min enforced', 'Login did not trigger 429 within 13 requests');

    // Request-reset rate limit: 5/min per IP
    const resetIp = `10.88.${Math.floor(Math.random() * 200) + 10}.3`;
    let resetHit429 = false;
    for (let i = 0; i < 7; i++) {
      const res = await request('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `reset_${ts}@acceptance.test` })
      }, resetIp);
      if (res.status === 429) {
        resetHit429 = true;
        assert(res.body?.error === 'rate_limited', 'FR-017 request-reset rate_limited error', `Expected rate_limited, got ${res.body?.error}`);
        break;
      }
    }
    assert(resetHit429, 'FR-017 request-reset rate limit 5/min enforced', 'Request-reset did not trigger 429 within 7 requests');

    // Request-verify rate limit: 3/min per IP
    // Log in with clean IP to obtain fresh cookie
    const cleanLoginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.username, password: testUser.password })
    });
    const verifyUserCookie = cleanLoginRes.headers.get('set-cookie');
    const verifyIp = `10.88.${Math.floor(Math.random() * 200) + 10}.4`;
    let verifyHit429 = false;
    for (let i = 0; i < 5; i++) {
      const res = await request('/api/auth/request-verify', {
        method: 'POST',
        headers: { Cookie: verifyUserCookie }
      }, verifyIp);
      if (res.status === 429) {
        verifyHit429 = true;
        assert(res.body?.error === 'rate_limited', 'FR-017 request-verify rate_limited error', `Expected rate_limited, got ${res.body?.error}`);
        break;
      }
    }
    assert(verifyHit429, 'FR-017 request-verify rate limit 3/min enforced', 'Request-verify did not trigger 429 within 5 requests');
  }

  console.log('✅ [009 Acceptance Suite 01] All Auth Lifecycle & Rate Limits scenarios passed.');
}

run().catch(err => {
  console.error('❌ unhandled error in 01_auth_lifecycle_and_rate_limits suite:', err);
  process.exit(1);
});
