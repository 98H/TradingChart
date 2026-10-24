/**
 * @spec 009
 * @covers FR-002, FR-007, FR-009, FR-010, FR-011, FR-017
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:8088');
const OUTBOX_PATH = path.resolve(__dirname, '../../../server/data/accounts/outbox.json');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

let ipSubnet = Math.floor(Math.random() * 200) + 10;
let ipHost = 1;
function nextIp() {
  ipHost++;
  if (ipHost > 250) { ipSubnet++; ipHost = 1; }
  return `10.98.${ipSubnet}.${ipHost}`;
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

// RFC 6238 TOTP code generator for test assertions
function generateTotp(secret) {
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, val = 0; const bytes = [];
  for (const ch of secret.toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', Buffer.from(bytes)).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[off] & 0x7f) << 24 | hmac[off + 1] << 16 | hmac[off + 2] << 8 | hmac[off + 3]) % 1000000;
  return String(code).padStart(6, '0');
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
  console.log(`[009 Acceptance Suite 02] Running TOTP, Profile, Sessions & Export against ${BASE_URL}...`);

  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const testUser = {
    email: `qa_totp_${ts}@acceptance.test`,
    username: `qa_totp_${ts}`.slice(0, 24),
    password: 'StrongTotpPassword123!',
    displayName: `Acceptance TOTP ${ts}`
  };

  // Register fresh user
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  assert(regRes.status === 200, 'Suite 02 setup: user registration', `Expected 200, got ${regRes.status}`);
  let sessionCookie = regRes.headers.get('set-cookie');
  const userId = regRes.body?.user?.id;
  assert(regRes.body?.user?.totpEnabled === false, 'FR-007 initial totpEnabled is false', 'Expected false');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. TOTP 2FA Setup, Enable & Login Challenge (FR-002, FR-007)
  // ──────────────────────────────────────────────────────────────────────────
  let totpSecret = '';
  {
    // POST /api/auth/2fa/setup -> secret and otpauthUrl
    const setupRes = await request('/api/auth/2fa/setup', {
      method: 'POST',
      headers: { Cookie: sessionCookie }
    });
    assert(setupRes.status === 200, 'FR-007 2FA setup status', `Expected 200, got ${setupRes.status}`);
    assert(setupRes.body?.ok === true, 'FR-007 2FA setup ok', 'Expected ok: true');
    totpSecret = setupRes.body?.secret;
    assert(typeof totpSecret === 'string' && /^[A-Z2-7]{16,64}$/.test(totpSecret),
      'FR-007 valid base32 TOTP secret', `Invalid secret: ${totpSecret}`);
    assert(typeof setupRes.body?.otpauthUrl === 'string' && setupRes.body.otpauthUrl.startsWith('otpauth://totp/'),
      'FR-007 otpauth URL format', `Invalid otpauthUrl: ${setupRes.body?.otpauthUrl}`);

    // Enable with invalid code -> 400 invalid_code
    const badCodeRes = await request('/api/auth/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ code: '000000' })
    });
    assert(badCodeRes.status === 400, 'FR-007 invalid code enable status', `Expected 400, got ${badCodeRes.status}`);
    assert(badCodeRes.body?.error === 'invalid_code', 'FR-007 invalid_code error', `Expected invalid_code, got ${badCodeRes.body?.error}`);

    // Enable with valid live TOTP code
    const validTotpCode = generateTotp(totpSecret);
    const enableRes = await request('/api/auth/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ code: validTotpCode })
    });
    assert(enableRes.status === 200, 'FR-007 enable 2FA status', `Expected 200, got ${enableRes.status}`);
    assert(enableRes.body?.ok === true && enableRes.body?.totpEnabled === true,
      'FR-007 enable 2FA body ok', 'Expected totpEnabled: true');

    // Calling setup again when already enabled -> 409 already_enabled
    const reSetupRes = await request('/api/auth/2fa/setup', {
      method: 'POST',
      headers: { Cookie: sessionCookie }
    });
    assert(reSetupRes.status === 409, 'FR-007 setup when already enabled status', `Expected 409, got ${reSetupRes.status}`);
    assert(reSetupRes.body?.error === 'already_enabled', 'FR-007 already_enabled error', `Expected already_enabled, got ${reSetupRes.body?.error}`);

    // GET /api/auth/me confirms totpEnabled: true
    const meRes = await request('/api/auth/me', { headers: { Cookie: sessionCookie } });
    assert(meRes.body?.user?.totpEnabled === true, 'FR-007 /api/auth/me reports totpEnabled: true', 'Expected true');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Login Flow with 2FA Enabled (FR-002, FR-007)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Login without code -> 200 totpRequired: true (no cookie)
    const noCodeLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.username, password: testUser.password })
    });
    assert(noCodeLogin.status === 200, 'FR-002 2FA login without code status', `Expected 200, got ${noCodeLogin.status}`);
    assert(noCodeLogin.body?.totpRequired === true, 'FR-002 totpRequired is true', 'Expected totpRequired: true');
    const noCookie = noCodeLogin.headers.get('set-cookie');
    assert(!noCookie || !noCookie.includes('tc_session='), 'FR-002 no session cookie set on step 1', 'Unexpected session cookie');

    // Login with invalid TOTP code -> 401 invalid_totp
    const badTotpLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.username, password: testUser.password, totpCode: '111222' })
    });
    assert(badTotpLogin.status === 401, 'FR-002 wrong totp code status', `Expected 401, got ${badTotpLogin.status}`);
    assert(badTotpLogin.body?.error === 'invalid_totp' && badTotpLogin.body?.totpRequired === true,
      'FR-002 invalid_totp error body', `Unexpected: ${JSON.stringify(badTotpLogin.body)}`);

    // Login with valid live TOTP code -> 200 success with session cookie
    const liveCode = generateTotp(totpSecret);
    const goodTotpLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.username, password: testUser.password, totpCode: liveCode })
    });
    assert(goodTotpLogin.status === 200, 'FR-002 valid totp login status', `Expected 200, got ${goodTotpLogin.status}`);
    assert(goodTotpLogin.body?.ok === true && goodTotpLogin.body?.user?.id === userId,
      'FR-002 valid totp login user match', 'User ID mismatch on 2FA login');
    sessionCookie = goodTotpLogin.headers.get('set-cookie') || sessionCookie;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Disable 2FA & 2FA Rate Limits (FR-007, FR-017)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Rate limit on 2FA endpoints: 6/min per IP
    const twoFaIp = `10.87.${Math.floor(Math.random() * 200) + 10}.1`;
    let twoFaHit429 = false;
    for (let i = 0; i < 8; i++) {
      const res = await request('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ password: 'wrong', code: '000000' })
      }, twoFaIp);
      if (res.status === 429) {
        twoFaHit429 = true;
        assert(res.body?.error === 'rate_limited', 'FR-017 2FA rate_limited error', `Expected rate_limited, got ${res.body?.error}`);
        break;
      }
    }
    assert(twoFaHit429, 'FR-017 2FA endpoint rate limit 6/min enforced', '2FA disable did not trigger 429 within 8 requests');

    // Disable with wrong password -> 400 invalid_credentials
    const badPwDisable = await request('/api/auth/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ password: 'WrongPassword!', code: generateTotp(totpSecret) })
    });
    assert(badPwDisable.status === 400, 'FR-007 disable wrong password status', `Expected 400, got ${badPwDisable.status}`);
    assert(badPwDisable.body?.error === 'invalid_credentials', 'FR-007 invalid_credentials error', `Expected invalid_credentials, got ${badPwDisable.body?.error}`);

    // Disable with wrong TOTP code -> 400 invalid_code
    const badCodeDisable = await request('/api/auth/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ password: testUser.password, code: '000000' })
    });
    assert(badCodeDisable.status === 400, 'FR-007 disable wrong code status', `Expected 400, got ${badCodeDisable.status}`);
    assert(badCodeDisable.body?.error === 'invalid_code', 'FR-007 invalid_code error', `Expected invalid_code, got ${badCodeDisable.body?.error}`);

    // Disable with valid password + valid code -> 200 ok
    const goodDisable = await request('/api/auth/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ password: testUser.password, code: generateTotp(totpSecret) })
    });
    assert(goodDisable.status === 200, 'FR-007 disable 2FA status', `Expected 200, got ${goodDisable.status}`);
    assert(goodDisable.body?.totpEnabled === false, 'FR-007 totpEnabled is now false', 'Expected false');

    // Disable when already disabled -> 400 not_enabled
    const redundantDisable = await request('/api/auth/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ password: testUser.password, code: '123456' })
    });
    assert(redundantDisable.status === 400, 'FR-007 disable when not enabled status', `Expected 400, got ${redundantDisable.status}`);
    assert(redundantDisable.body?.error === 'not_enabled', 'FR-007 not_enabled error', `Expected not_enabled, got ${redundantDisable.body?.error}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Profile Updates & Social Links Plan Gating (FR-009)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Basic profile field updates
    const patchRes = await request('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({
        displayName: 'Pro Algo Trader',
        bio: 'Quantitative trading and macro analytics',
        location: 'London, UK',
        signature: 'Stay systematic.',
        avatarPreset: 'cyber',
        timezone: 'Europe/London',
        currency: 'GBP'
      })
    });
    assert(patchRes.status === 200, 'FR-009 patch profile status', `Expected 200, got ${patchRes.status}`);
    const updated = patchRes.body?.user;
    assert(updated?.displayName === 'Pro Algo Trader', 'FR-009 displayName updated', `Mismatch: ${updated?.displayName}`);
    assert(updated?.bio === 'Quantitative trading and macro analytics', 'FR-009 bio updated', `Mismatch: ${updated?.bio}`);
    assert(updated?.location === 'London, UK', 'FR-009 location updated', `Mismatch: ${updated?.location}`);
    assert(updated?.signature === 'Stay systematic.', 'FR-009 signature updated', `Mismatch: ${updated?.signature}`);
    assert(updated?.avatarPreset === 'cyber', 'FR-009 avatarPreset updated', `Mismatch: ${updated?.avatarPreset}`);
    assert(updated?.timezone === 'Europe/London', 'FR-009 timezone updated', `Mismatch: ${updated?.timezone}`);
    assert(updated?.currency === 'GBP', 'FR-009 currency updated', `Mismatch: ${updated?.currency}`);

    // Social links allowed on basic plan: X and YouTube
    const allowedSocialRes = await request('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({
        socialLinks: {
          x: 'trader_x_handle',
          youtube: 'https://youtube.com/@algo_trader'
        }
      })
    });
    assert(allowedSocialRes.status === 200, 'FR-009 basic plan allowed social links status', `Expected 200, got ${allowedSocialRes.status}`);
    assert(allowedSocialRes.body?.user?.socialLinks?.x === 'trader_x_handle',
      'FR-009 x link saved', 'Social link X not preserved');

    // Social link NOT allowed on basic plan (e.g. website, facebook, instagram) -> 403 plan_required
    const lockedSocialRes = await request('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({
        socialLinks: {
          website: 'https://institutionaltrader.com'
        }
      })
    });
    assert(lockedSocialRes.status === 403, 'FR-009 website link blocked on basic plan status', `Expected 403, got ${lockedSocialRes.status}`);
    const socialErr = lockedSocialRes.body?.errors?.find(e => e.field === 'socialLinks.website');
    assert(socialErr && socialErr.code === 'plan_required',
      'FR-009 website link plan_required error', `Expected plan_required, got ${JSON.stringify(lockedSocialRes.body)}`);

    // Lifetime username change limit (max 2 changes)
    assert(updated?.usernameChangesLeft === 2, 'FR-009 initial usernameChangesLeft === 2', `Got: ${updated?.usernameChangesLeft}`);

    // First username change
    const change1Res = await request('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ username: `qa_totp_c1_${ts}`.slice(0, 24) })
    });
    assert(change1Res.status === 200, 'FR-009 first username change status', `Expected 200, got ${change1Res.status}`);
    assert(change1Res.body?.user?.usernameChangesLeft === 1, 'FR-009 usernameChangesLeft === 1 after first change', `Got ${change1Res.body?.user?.usernameChangesLeft}`);

    // Second username change
    const change2Res = await request('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ username: `qa_totp_c2_${ts}`.slice(0, 24) })
    });
    assert(change2Res.status === 200, 'FR-009 second username change status', `Expected 200, got ${change2Res.status}`);
    assert(change2Res.body?.user?.usernameChangesLeft === 0, 'FR-009 usernameChangesLeft === 0 after second change', `Got ${change2Res.body?.user?.usernameChangesLeft}`);

    // Third username change attempt -> 403 username_limit
    const change3Res = await request('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ username: `qa_totp_c3_${ts}`.slice(0, 24) })
    });
    assert(change3Res.status === 403, 'FR-009 third username change rejected status', `Expected 403, got ${change3Res.status}`);
    const limitErr = change3Res.body?.errors?.find(e => e.field === 'username');
    assert(limitErr && limitErr.code === 'username_limit', 'FR-009 username_limit error code', `Expected username_limit, got ${JSON.stringify(change3Res.body)}`);

    // Updating email marks emailVerified: false and dispatches new verify code
    const newEmail = `qa_newemail_${ts}@acceptance.test`;
    const emailPatchRes = await request('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ email: newEmail })
    });
    assert(emailPatchRes.status === 200, 'FR-009 email patch status', `Expected 200, got ${emailPatchRes.status}`);
    assert(emailPatchRes.body?.user?.emailVerified === false, 'FR-009 email update requires re-verification', 'emailVerified is not false');
    assert(emailPatchRes.body?.user?.email === newEmail.toLowerCase(), 'FR-009 email updated in user object', 'Email mismatch');

    const newVCode = getOutboxCode(newEmail, 'verify');
    assert(typeof newVCode === 'string' && /^\d{6}$/.test(newVCode),
      'FR-009 new email verification code in outbox', `Expected code, got ${newVCode}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Sessions Listing & Revocation (FR-010)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Create a second active session
    const curUsername = (await request('/api/auth/me', { headers: { Cookie: sessionCookie } })).body?.user?.username;
    const s2Res = await request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      },
      body: JSON.stringify({ identity: curUsername, password: testUser.password })
    });
    assert(s2Res.status === 200, 'FR-010 create secondary session', `Expected 200, got ${s2Res.status}`);
    const s2Cookie = s2Res.headers.get('set-cookie');

    // Get s2 sessionId
    const s2Me = await request('/api/auth/me', { headers: { Cookie: s2Cookie } });
    const s2SessionId = s2Me.body?.sessionId;
    assert(typeof s2SessionId === 'string', 'FR-010 s2 sessionId retrieved', 'Missing s2 sessionId');

    // GET /api/user/sessions
    const sessListRes = await request('/api/user/sessions', { headers: { Cookie: sessionCookie } });
    assert(sessListRes.status === 200, 'FR-010 list sessions status', `Expected 200, got ${sessListRes.status}`);
    const sessions = sessListRes.body?.sessions;
    assert(Array.isArray(sessions) && sessions.length >= 2, 'FR-010 sessions array length >= 2', `Length: ${sessions?.length}`);

    // Verify session schema
    const curSess = sessions.find(s => s.current === true);
    assert(curSess && typeof curSess.id === 'string', 'FR-010 current session identified', 'Missing current session');
    assert(typeof curSess.device === 'string', 'FR-010 session device string', 'Missing device');
    assert(typeof curSess.ip === 'string', 'FR-010 session ip string', 'Missing ip');
    assert(typeof curSess.createdAt === 'number', 'FR-010 session createdAt number', 'Missing createdAt');
    assert(typeof curSess.lastSeen === 'number', 'FR-010 session lastSeen number', 'Missing lastSeen');

    // Revoke the secondary session by its exact ID
    const revokeRes = await request(`/api/user/sessions/${s2SessionId}`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie }
    });
    assert(revokeRes.status === 200, 'FR-010 revoke session status', `Expected 200, got ${revokeRes.status}`);
    assert(revokeRes.body?.ok === true, 'FR-010 revoke session ok', 'Expected ok: true');

    // The secondary session is now dead
    const deadCheck = await request('/api/auth/me', { headers: { Cookie: s2Cookie } });
    assert(deadCheck.body?.user === null, 'FR-010 revoked session is unauthenticated', 'Revoked session is still authenticated');

    // Revoking an already deleted or non-existent session returns 404
    const notFoundRevoke = await request('/api/user/sessions/non_existent_sid', {
      method: 'DELETE',
      headers: { Cookie: sessionCookie }
    });
    assert(notFoundRevoke.status === 404, 'FR-010 revoke non-existent session status 404', `Expected 404, got ${notFoundRevoke.status}`);
    assert(notFoundRevoke.body?.error === 'not_found', 'FR-010 not_found error code', `Expected not_found, got ${notFoundRevoke.body?.error}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. User Data Export (FR-011)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const exportRes = await request('/api/user/export', { headers: { Cookie: sessionCookie } });
    assert(exportRes.status === 200, 'FR-011 user data export status', `Expected 200, got ${exportRes.status}`);
    const exp = exportRes.body;
    assert(exp && exp.ok === true, 'FR-011 export ok flag', 'Expected ok: true');
    assert(typeof exp.exportedAt === 'string', 'FR-011 export exportedAt timestamp', 'Missing exportedAt');
    assert(exp.user && exp.user.id === userId, 'FR-011 export user matches userId', 'User id mismatch');
    assert(exp.state && typeof exp.state === 'object', 'FR-011 export state dictionary object', 'Missing state');
    assert(Array.isArray(exp.sessions), 'FR-011 export sessions array', 'Missing sessions');

    // Security check: ensure no passwords, salt, hashes, or TOTP secrets leak
    const rawExport = JSON.stringify(exp);
    assert(!rawExport.includes('scrypt'), 'FR-011 no scrypt in export', 'Found scrypt in export payload');
    assert(!rawExport.includes(testUser.password), 'FR-011 no password in export', 'Found plain password in export payload');
    assert(!exp.user.hash && !exp.user.salt, 'FR-011 no hash or salt on exported user', 'User object leaked hash/salt');
    assert(!exp.user.totpSecret && !exp.user.pendingTotpSecret, 'FR-011 no totp secrets in export', 'User object leaked totp secrets');
    assert(!exp.user.verifyCode && !exp.user.resetCode, 'FR-011 no verify/reset codes in export', 'User object leaked codes');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Account Deletion & Rate Limit (FR-011, FR-017)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Wrong password -> 401 invalid_credentials
    const badPwDel = await request('/api/auth/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ password: 'WrongPasswordForDeletion!' })
    });
    assert(badPwDel.status === 401, 'FR-011 account deletion wrong password status', `Expected 401, got ${badPwDel.status}`);
    const delPwErr = badPwDel.body?.errors?.find(e => e.field === 'password') || badPwDel.body;
    assert(delPwErr.code === 'invalid_credentials' || delPwErr.error === 'invalid_credentials',
      'FR-011 invalid_credentials on bad password deletion', `Unexpected: ${JSON.stringify(badPwDel.body)}`);

    // Deletion rate limit: 3/min per IP
    const delIp = `10.87.${Math.floor(Math.random() * 200) + 10}.2`;
    let delHit429 = false;
    for (let i = 0; i < 5; i++) {
      const res = await request('/api/auth/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ password: 'WrongPassword!' })
      }, delIp);
      if (res.status === 429) {
        delHit429 = true;
        assert(res.body?.error === 'rate_limited', 'FR-017 account deletion rate_limited error', `Expected rate_limited, got ${res.body?.error}`);
        break;
      }
    }
    assert(delHit429, 'FR-017 account deletion rate limit 3/min enforced', 'Account deletion did not trigger 429 within 5 requests');

    // Valid account deletion with correct password
    const goodDel = await request('/api/auth/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ password: testUser.password })
    });
    assert(goodDel.status === 200, 'FR-011 valid account deletion status', `Expected 200, got ${goodDel.status}`);
    assert(goodDel.body?.ok === true && goodDel.body?.deleted === true,
      'FR-011 deletion response ok', 'Expected ok: true, deleted: true');

    // Cookie is cleared
    const delCookie = goodDel.headers.get('set-cookie');
    assert(delCookie && (delCookie.includes('Max-Age=0') || delCookie.includes('expires=')),
      'FR-011 deletion clears tc_session cookie', 'Missing cookie clearing header');

    // Subsequent GET /api/auth/me with that cookie returns user: null
    const afterDelMe = await request('/api/auth/me', { headers: { Cookie: sessionCookie } });
    assert(afterDelMe.body?.user === null, 'FR-011 user is unauthenticated after deletion', 'User is still authenticated');

    // Attempting to login as deleted user returns 401 invalid_credentials
    const curUsername = (await request('/api/auth/me')).body?.user?.username;
    const delLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: testUser.email, password: testUser.password })
    });
    assert(delLogin.status === 401, 'FR-011 deleted user cannot log in', `Expected 401, got ${delLogin.status}`);
    assert(delLogin.body?.error === 'invalid_credentials', 'FR-011 deleted user invalid_credentials', `Expected invalid_credentials, got ${delLogin.body?.error}`);
  }

  console.log('✅ [009 Acceptance Suite 02] All TOTP, Profile, Sessions & Export scenarios passed.');
}

run().catch(err => {
  console.error('❌ unhandled error in 02_totp_profile_sessions_and_data_export suite:', err);
  process.exit(1);
});
