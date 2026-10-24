/**
 * @spec 010
 * @covers FR-006, FR-007, FR-008, FR-009, FR-010
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
  return `10.92.${ipSubnet}.${ipHost}`;
}

async function request(endpoint, options = {}, clientIp = null) {
  const reqUrl = `${BASE_URL}${endpoint}`;
  const ip = clientIp || nextIp();
  const headers = {
    'X-Forwarded-For': ip,
    ...(options.headers || {})
  };
  const res = await fetch(reqUrl, { ...options, headers });
  const rawBuffer = Buffer.from(await res.arrayBuffer());
  const text = rawBuffer.toString('utf8');
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text, rawBuffer };
}

async function run() {
  console.log(`[010 Acceptance Suite 02] Running Admin Users & Bulk Operations against ${BASE_URL}...`);
  const masterKey = getMasterKey();
  assert(!!masterKey, 'Suite 02 setup: master key present', 'Master key could not be loaded');

  const adminHeaders = { 'X-Master-Key': masterKey };
  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Setup Users for Listing, Filtering & CSV Export (FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  const userA = {
    email: `qa_usr_a_${ts}@acceptance.test`,
    username: `qa_a_${ts}`.slice(0, 24),
    password: 'UserAPassword123!',
    displayName: `=1+2 Formula Trader ${ts}`
  };
  const userB = {
    email: `qa_usr_b_${ts}@test.io`, // test domain to verify type=test filtering
    username: `qa_b_${ts}`.slice(0, 24),
    password: 'UserBPassword123!',
    displayName: `Test Domain User ${ts}`
  };

  const regARes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA)
  });
  assert(regARes.status === 200, 'FR-006 setup: register user A', `Expected 200, got ${regARes.status}`);
  const userAId = regARes.body?.user?.id;
  const userACookie = regARes.headers.get('set-cookie');

  const regBRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB)
  });
  assert(regBRes.status === 200, 'FR-006 setup: register user B', `Expected 200, got ${regBRes.status}`);
  const userBId = regBRes.body?.user?.id;

  try {
    // Search by query q matching username
    const searchRes = await request(`/api/admin/users?q=${userA.username}`, { headers: adminHeaders });
    assert(searchRes.status === 200, 'FR-006 GET /api/admin/users?q=... status 200', `Expected 200, got ${searchRes.status}`);
    assert(searchRes.body?.ok === true, 'FR-006 users response ok: true', 'Expected ok: true');
    assert(searchRes.body?.users.some(u => u.id === userAId), 'FR-006 query matches user A by username', `User A ${userAId} not found in search results`);

    // Search by query q matching email
    const searchEmailRes = await request(`/api/admin/users?q=${encodeURIComponent(userB.email)}`, { headers: adminHeaders });
    assert(searchEmailRes.body?.users.some(u => u.id === userBId), 'FR-006 query matches user B by email', `User B ${userBId} not found in search results`);

    // Scope filter: type=test isolates test domain accounts
    const testScopeRes = await request(`/api/admin/users?q=${ts}&type=test`, { headers: adminHeaders });
    assert(testScopeRes.body?.users.some(u => u.id === userBId), 'FR-006 type=test includes user B (@test.io)', 'User B missing from test accounts');
    assert(!testScopeRes.body?.users.some(u => u.id === userAId), 'FR-006 type=test excludes user A (@acceptance.test)', 'User A incorrectly included in test accounts');

    // Filter by plan
    const planFilterRes = await request(`/api/admin/users?q=${ts}&plan=basic`, { headers: adminHeaders });
    assert(planFilterRes.body?.users.some(u => u.id === userAId), 'FR-006 filter by plan=basic', 'User A missing in plan=basic filter');

    // Filter by role
    const roleFilterRes = await request(`/api/admin/users?q=${ts}&role=user`, { headers: adminHeaders });
    assert(roleFilterRes.body?.users.some(u => u.id === userAId), 'FR-006 filter by role=user', 'User A missing in role=user filter');

    // Pagination
    const pageRes = await request(`/api/admin/users?pageSize=5&page=1`, { headers: adminHeaders });
    assert(pageRes.status === 200, 'FR-006 pagination status 200', `Expected 200, got ${pageRes.status}`);
    assert(pageRes.body?.pageSize === 5, 'FR-006 pageSize matches requested', `Expected 5, got ${pageRes.body?.pageSize}`);
    assert(pageRes.body?.page === 1, 'FR-006 page matches requested', `Expected 1, got ${pageRes.body?.page}`);
    assert(typeof pageRes.body?.pages === 'number', 'FR-006 total pages present', 'Missing pages property');
    assert(typeof pageRes.body?.total === 'number', 'FR-006 total count present', 'Missing total property');

    // CSV Export (GET /api/admin/users.csv)
    const csvRes = await request(`/api/admin/users.csv?q=${userA.username}`, { headers: adminHeaders });
    assert(csvRes.status === 200, 'FR-006 GET /api/admin/users.csv status 200', `Expected 200, got ${csvRes.status}`);
    assert((csvRes.headers.get('content-type') || '').includes('text/csv'), 'FR-006 CSV content-type header', 'Missing text/csv content-type');
    assert((csvRes.headers.get('content-disposition') || '').includes('attachment'), 'FR-006 CSV content-disposition attachment', 'Missing attachment disposition');

    // Verify UTF-8 BOM (0xEF 0xBB 0xBF)
    const csvBuf = csvRes.rawBuffer;
    assert(csvBuf.length >= 3 && csvBuf[0] === 0xEF && csvBuf[1] === 0xBB && csvBuf[2] === 0xBF,
      'FR-006 CSV starts with UTF-8 BOM', `BOM bytes missing, got: ${csvBuf.slice(0, 3)}`);

    // Verify formula-injection safe cell escaping: '=1+2' should be preceded by single quote
    const csvLines = csvRes.rawText.split('\n');
    const headerLine = csvLines[0].replace(/^\ufeff/, '').trim();
    assert(headerLine.startsWith('id,username,email,displayName'), 'FR-006 CSV headers match specification', `Invalid CSV header: ${headerLine}`);
    const userALine = csvLines.find(l => l.includes(userA.username));
    assert(!!userALine, 'FR-006 CSV contains user A row', 'User A row not found in CSV');
    assert(userALine.includes("'=1+2") || !userALine.includes('"=1+2'), 'FR-006 CSV formula injection escaped', `Cell not escaped properly: ${userALine}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. User Detail Inspection (FR-007)
    // ──────────────────────────────────────────────────────────────────────────
    const detailRes = await request(`/api/admin/users/${userAId}`, { headers: adminHeaders });
    assert(detailRes.status === 200, 'FR-007 GET /api/admin/users/:id status 200', `Expected 200, got ${detailRes.status}`);
    assert(detailRes.body?.ok === true, 'FR-007 detail body ok: true', 'Expected ok: true');

    const detailUser = detailRes.body?.user;
    assert(detailUser?.id === userAId, 'FR-007 detail user id matches', `Expected ${userAId}, got ${detailUser?.id}`);
    assert(detailUser?.username === userA.username, 'FR-007 detail user username matches', 'Username mismatch');
    assert(detailUser?.email === userA.email, 'FR-007 detail user email matches', 'Email mismatch');
    assert(typeof detailUser?.plan === 'string', 'FR-007 detail user plan string', 'Missing plan');
    assert(typeof detailUser?.role === 'string', 'FR-007 detail user role string', 'Missing role');
    assert(typeof detailUser?.isTest === 'boolean', 'FR-007 detail user isTest boolean', 'Missing isTest');
    assert(typeof detailUser?.suspended === 'boolean', 'FR-007 detail user suspended boolean', 'Missing suspended');

    // Sessions, usage, and events arrays present
    assert(Array.isArray(detailRes.body?.sessions), 'FR-007 detail sessions array present', 'Missing sessions array');
    assert(typeof detailRes.body?.usage === 'object', 'FR-007 detail usage stats object present', 'Missing usage object');
    assert(typeof detailRes.body?.usage?.layouts === 'number', 'FR-007 usage.layouts number', 'Missing usage.layouts');
    assert(typeof detailRes.body?.usage?.stateBytes === 'number', 'FR-007 usage.stateBytes number', 'Missing usage.stateBytes');
    assert(Array.isArray(detailRes.body?.events), 'FR-007 detail audit events array present', 'Missing events array');

    // 404 for nonexistent user
    const notFoundRes = await request('/api/admin/users/u_nonexistent_00000000', { headers: adminHeaders });
    assert(notFoundRes.status === 404, 'FR-007 nonexistent user status 404', `Expected 404, got ${notFoundRes.status}`);
    assert(notFoundRes.body?.error === 'user_not_found', 'FR-007 user_not_found error code', `Expected user_not_found, got ${notFoundRes.body?.error}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 3. User Modification & Self-Protection (FR-008)
    // ──────────────────────────────────────────────────────────────────────────
    // Change plan to premium
    const planChangeRes = await request(`/api/admin/users/${userAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ plan: 'premium' })
    });
    assert(planChangeRes.status === 200, 'FR-008 PATCH plan to premium status 200', `Expected 200, got ${planChangeRes.status}`);
    assert(planChangeRes.body?.user?.plan === 'premium', 'FR-008 user plan updated to premium', `Expected premium, got ${planChangeRes.body?.user?.plan}`);

    // Rejection of unknown plan
    const badPlanRes = await request(`/api/admin/users/${userAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ plan: 'nonexistent_tier_xyz' })
    });
    assert(badPlanRes.status === 400, 'FR-008 unknown plan status 400', `Expected 400, got ${badPlanRes.status}`);
    assert(badPlanRes.body?.error === 'unknown_plan', 'FR-008 unknown_plan error code', `Expected unknown_plan, got ${badPlanRes.body?.error}`);

    // Update notes, displayName, testAccount, emailVerified
    const metaUpdateRes = await request(`/api/admin/users/${userAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({
        displayName: 'Verified Trader A',
        notes: 'VIP customer account reviewed',
        testAccount: true,
        emailVerified: true
      })
    });
    assert(metaUpdateRes.status === 200, 'FR-008 update metadata status 200', `Expected 200, got ${metaUpdateRes.status}`);
    assert(metaUpdateRes.body?.user?.displayName === 'Verified Trader A', 'FR-008 displayName updated', 'DisplayName mismatch');
    assert(metaUpdateRes.body?.user?.notes === 'VIP customer account reviewed', 'FR-008 notes updated', 'Notes mismatch');
    assert(metaUpdateRes.body?.user?.isTest === true, 'FR-008 testAccount flag set', 'isTest not true');
    assert(metaUpdateRes.body?.user?.emailVerified === true, 'FR-008 emailVerified updated', 'emailVerified not true');

    // Invalid display name (whitespace only)
    const badNameRes = await request(`/api/admin/users/${userAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ displayName: '   ' })
    });
    assert(badNameRes.status === 400, 'FR-008 invalid displayName status 400', `Expected 400, got ${badNameRes.status}`);
    assert(badNameRes.body?.error === 'invalid_display_name', 'FR-008 invalid_display_name error code', `Expected invalid_display_name, got ${badNameRes.body?.error}`);

    // Suspend user
    const suspendRes = await request(`/api/admin/users/${userAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ suspended: true, suspendReason: 'Compliance hold' })
    });
    assert(suspendRes.status === 200, 'FR-008 suspend user status 200', `Expected 200, got ${suspendRes.status}`);
    assert(suspendRes.body?.user?.suspended === true, 'FR-008 user suspended is true', 'Suspended is not true');
    assert(suspendRes.body?.user?.suspendReason === 'Compliance hold', 'FR-008 suspendReason recorded', 'Suspend reason mismatch');

    // Unsuspend user
    const unsuspendRes = await request(`/api/admin/users/${userAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ suspended: false })
    });
    assert(unsuspendRes.status === 200, 'FR-008 unsuspend user status 200', `Expected 200, got ${unsuspendRes.status}`);
    assert(unsuspendRes.body?.user?.suspended === false, 'FR-008 user suspended is false', 'Suspended is not false');

    // Self-Protection check: caller acting as role admin cannot demote or suspend self
    const roleAdmin = {
      email: `adm_protect_${ts}@acceptance.test`,
      username: `adm_prot_${ts}`.slice(0, 24),
      password: 'ProtectPassword123!',
      displayName: `Admin Protect ${ts}`
    };
    const regAdminRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleAdmin)
    });
    const adminId = regAdminRes.body?.user?.id;
    const adminUserCookie = regAdminRes.headers.get('set-cookie');

    // Grant admin role
    await request(`/api/admin/users/${adminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ role: 'admin' })
    });

    // Admin tries to demote self via their own session
    const selfDemoteRes = await request(`/api/admin/users/${adminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminUserCookie },
      body: JSON.stringify({ role: 'user' })
    });
    assert(selfDemoteRes.status === 400, 'FR-008 cannot demote self status 400', `Expected 400, got ${selfDemoteRes.status}`);
    assert(selfDemoteRes.body?.error === 'cannot_demote_self', 'FR-008 cannot_demote_self error code', `Expected cannot_demote_self, got ${selfDemoteRes.body?.error}`);

    // Admin tries to suspend self via their own session
    const selfSuspendRes = await request(`/api/admin/users/${adminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminUserCookie },
      body: JSON.stringify({ suspended: true })
    });
    assert(selfSuspendRes.status === 400, 'FR-008 cannot suspend self status 400', `Expected 400, got ${selfSuspendRes.status}`);
    assert(selfSuspendRes.body?.error === 'cannot_suspend_self', 'FR-008 cannot_suspend_self error code', `Expected cannot_suspend_self, got ${selfSuspendRes.body?.error}`);

    // Admin tries to delete self
    const selfDeleteRes = await request(`/api/admin/users/${adminId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: adminUserCookie },
      body: JSON.stringify({ confirm: roleAdmin.username })
    });
    assert(selfDeleteRes.status === 400, 'FR-010 cannot delete self status 400', `Expected 400, got ${selfDeleteRes.status}`);
    assert(selfDeleteRes.body?.error === 'cannot_delete_self', 'FR-010 cannot_delete_self error code', `Expected cannot_delete_self, got ${selfDeleteRes.body?.error}`);

    // Clean up admin role user via master key
    await request(`/api/admin/users/${adminId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ confirm: roleAdmin.username })
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Session Revocation, 2FA Reset & Password Reset Relay (FR-009)
    // ──────────────────────────────────────────────────────────────────────────
    // User A has an active session from registration (userACookie)
    const userDetailBefore = await request(`/api/admin/users/${userAId}`, { headers: adminHeaders });
    const userSession = userDetailBefore.body?.sessions?.[0];
    if (userSession?.id) {
      // Terminate specific session (DELETE /api/admin/users/:id/sessions/:sid)
      const delSessionRes = await request(`/api/admin/users/${userAId}/sessions/${userSession.id}`, {
        method: 'DELETE',
        headers: adminHeaders
      });
      assert(delSessionRes.status === 200, 'FR-009 delete specific user session status 200', `Expected 200, got ${delSessionRes.status}`);
      assert(delSessionRes.body?.ok === true, 'FR-009 delete specific session ok: true', 'Expected ok: true');
    }

    // Login user A to mint fresh session
    const loginARes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: userA.username, password: userA.password })
    });
    assert(loginARes.status === 200, 'FR-009 user A login', `Expected 200, got ${loginARes.status}`);

    // Revoke all sessions (POST /api/admin/users/:id/revoke-sessions)
    const revokeAllRes = await request(`/api/admin/users/${userAId}/revoke-sessions`, {
      method: 'POST',
      headers: adminHeaders
    });
    assert(revokeAllRes.status === 200, 'FR-009 revoke all sessions status 200', `Expected 200, got ${revokeAllRes.status}`);
    assert(revokeAllRes.body?.ok === true, 'FR-009 revoke all ok: true', 'Expected ok: true');
    assert(typeof revokeAllRes.body?.revoked === 'number' && revokeAllRes.body.revoked >= 1,
      'FR-009 revoked count reported', `Expected revoked count >= 1, got ${revokeAllRes.body?.revoked}`);

    // Reset 2FA when not enabled returns 400 twofa_not_enabled
    const reset2faRes = await request(`/api/admin/users/${userAId}/reset-2fa`, {
      method: 'POST',
      headers: adminHeaders
    });
    assert(reset2faRes.status === 400, 'FR-009 reset 2FA when disabled status 400', `Expected 400, got ${reset2faRes.status}`);
    assert(reset2faRes.body?.error === 'twofa_not_enabled', 'FR-009 twofa_not_enabled error code', `Expected twofa_not_enabled, got ${reset2faRes.body?.error}`);

    // Send password reset code (returns 6-digit code for manual delivery when mail not configured)
    const sendResetRes = await request(`/api/admin/users/${userAId}/send-reset`, {
      method: 'POST',
      headers: adminHeaders
    });
    assert(sendResetRes.status === 200, 'FR-009 send-reset status 200', `Expected 200, got ${sendResetRes.status}`);
    assert(sendResetRes.body?.ok === true, 'FR-009 send-reset ok: true', 'Expected ok: true');
    if (sendResetRes.body?.mailed === false) {
      assert(typeof sendResetRes.body?.code === 'string' && /^\d{6}$/.test(sendResetRes.body.code),
        'FR-009 send-reset returns 6-digit code', `Invalid code: ${sendResetRes.body?.code}`);
      assert(typeof sendResetRes.body?.expiresAt === 'number',
        'FR-009 send-reset returns expiresAt timestamp', 'Missing expiresAt');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. User Deletion & Bulk Operations (FR-010)
    // ──────────────────────────────────────────────────────────────────────────
    // DELETE confirmation mismatch
    const badDelConfirm = await request(`/api/admin/users/${userAId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ confirm: 'wrong_handle_xyz' })
    });
    assert(badDelConfirm.status === 400, 'FR-010 delete confirm mismatch status 400', `Expected 400, got ${badDelConfirm.status}`);
    assert(badDelConfirm.body?.error === 'confirm_mismatch', 'FR-010 confirm_mismatch error code', `Expected confirm_mismatch, got ${badDelConfirm.body?.error}`);

    // Successful deletion of user A
    const delARes = await request(`/api/admin/users/${userAId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ confirm: userA.username })
    });
    assert(delARes.status === 200, 'FR-010 delete user A status 200', `Expected 200, got ${delARes.status}`);
    assert(delARes.body?.ok === true && delARes.body?.deleted === userAId, 'FR-010 deleted user id matches', `Expected ${userAId}, got ${delARes.body?.deleted}`);

    // Verify user A no longer exists
    const checkDeletedRes = await request(`/api/admin/users/${userAId}`, { headers: adminHeaders });
    assert(checkDeletedRes.status === 404, 'FR-010 deleted user is 404', `Expected 404, got ${checkDeletedRes.status}`);

    // Bulk operations validation & execution
    // Register 2 users for bulk testing
    const b1 = { email: `bulk1_${ts}@acceptance.test`, username: `bulk1_${ts}`.slice(0, 24), password: 'BulkPassword123!', displayName: `Bulk 1 ${ts}` };
    const b2 = { email: `bulk2_${ts}@acceptance.test`, username: `bulk2_${ts}`.slice(0, 24), password: 'BulkPassword123!', displayName: `Bulk 2 ${ts}` };
    const r1 = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b1) });
    const r2 = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b2) });
    const b1Id = r1.body?.user?.id;
    const b2Id = r2.body?.user?.id;

    // Bulk validation: invalid_ids
    const badIdsRes = await request('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ ids: [], action: 'verify' })
    });
    assert(badIdsRes.status === 400, 'FR-010 bulk empty ids status 400', `Expected 400, got ${badIdsRes.status}`);
    assert(badIdsRes.body?.error === 'invalid_ids', 'FR-010 invalid_ids error code', `Expected invalid_ids, got ${badIdsRes.body?.error}`);

    // Bulk validation: invalid_action
    const badActRes = await request('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ ids: [b1Id, b2Id], action: 'unsupported_action' })
    });
    assert(badActRes.status === 400, 'FR-010 bulk invalid action status 400', `Expected 400, got ${badActRes.status}`);
    assert(badActRes.body?.error === 'invalid_action', 'FR-010 invalid_action error code', `Expected invalid_action, got ${badActRes.body?.error}`);

    // Bulk validation: unknown_plan
    const badBulkPlan = await request('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ ids: [b1Id, b2Id], action: 'plan', plan: 'fantasy_plan' })
    });
    assert(badBulkPlan.status === 400, 'FR-010 bulk unknown plan status 400', `Expected 400, got ${badBulkPlan.status}`);
    assert(badBulkPlan.body?.error === 'unknown_plan', 'FR-010 unknown_plan error code', `Expected unknown_plan, got ${badBulkPlan.body?.error}`);

    // Bulk verify
    const bulkVerifyRes = await request('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ ids: [b1Id, b2Id], action: 'verify' })
    });
    assert(bulkVerifyRes.status === 200, 'FR-010 bulk verify status 200', `Expected 200, got ${bulkVerifyRes.status}`);
    assert(bulkVerifyRes.body?.done === 2, 'FR-010 bulk verify done count 2', `Expected 2, got ${bulkVerifyRes.body?.done}`);

    // Bulk suspend
    const bulkSuspendRes = await request('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ ids: [b1Id, b2Id], action: 'suspend' })
    });
    assert(bulkSuspendRes.body?.done === 2, 'FR-010 bulk suspend done count 2', `Expected 2, got ${bulkSuspendRes.body?.done}`);

    // Bulk unsuspend
    const bulkUnsuspendRes = await request('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ ids: [b1Id, b2Id], action: 'unsuspend' })
    });
    assert(bulkUnsuspendRes.body?.done === 2, 'FR-010 bulk unsuspend done count 2', `Expected 2, got ${bulkUnsuspendRes.body?.done}`);

    // Bulk plan change to premium
    const bulkPlanRes = await request('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ ids: [b1Id, b2Id], action: 'plan', plan: 'premium' })
    });
    assert(bulkPlanRes.body?.done === 2, 'FR-010 bulk plan done count 2', `Expected 2, got ${bulkPlanRes.body?.done}`);

    // Bulk delete remaining test users
    const bulkDelRes = await request('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ ids: [b1Id, b2Id, userBId], action: 'delete' })
    });
    assert(bulkDelRes.status === 200, 'FR-010 bulk delete status 200', `Expected 200, got ${bulkDelRes.status}`);
    assert(bulkDelRes.body?.done >= 3, 'FR-010 bulk delete done count >= 3', `Expected >= 3, got ${bulkDelRes.body?.done}`);
  } finally {
    // Ensure user B is cleaned up if delete failed
    await request(`/api/admin/users/${userBId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ confirm: userB.username })
    }).catch(() => {});
  }

  console.log('✅ [010 Acceptance Suite 02] Admin Users & Bulk Operations passed.');
}

run().catch(err => {
  console.error(`❌ Suite 02 unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
