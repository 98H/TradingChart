/**
 * @spec 013
 * @covers FR-003, FR-004, FR-005, FR-007
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
  return `10.94.${ipSubnet}.${ipHost}`;
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
  console.log(`[013 Acceptance Suite 02] Running Admin Gift API, Validation & Bulk against ${BASE_URL}...`);
  const masterKey = getMasterKey();
  assert(!!masterKey, 'Suite 02 setup: master key present', 'Master key could not be loaded from file or env');
  const adminHeaders = { 'X-Master-Key': masterKey, 'Content-Type': 'application/json' };

  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Setup test user
  const targetUser = {
    email: `api_gift_${ts}@acceptance.test`,
    username: `agift_${ts}`.slice(0, 24),
    password: 'TargetPassword123!',
    displayName: `Target User ${ts}`
  };
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(targetUser)
  });
  assert(regRes.status === 200, 'Suite 02 setup: user registered', `Expected 200, got ${regRes.status}`);
  const targetId = regRes.body?.user?.id;
  const userCookie = regRes.headers.get('set-cookie');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Admin Authentication & Role Enforcement (FR-003, FR-004)
  // ──────────────────────────────────────────────────────────────────────────
  // Unauthenticated calls must return 403 forbidden_admin_only
  const unauthPost = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'premium', expiresAt: Date.now() + 86400000 })
  });
  assert(unauthPost.status === 403, 'FR-003 unauthenticated POST /gift status 403', `Expected 403, got ${unauthPost.status}`);
  assert(unauthPost.body?.error === 'forbidden_admin_only', 'FR-003 unauthenticated POST error code', `Expected forbidden_admin_only, got ${unauthPost.body?.error}`);

  const unauthDel = await request(`/api/admin/users/${targetId}/gift`, { method: 'DELETE' });
  assert(unauthDel.status === 403, 'FR-004 unauthenticated DELETE /gift status 403', `Expected 403, got ${unauthDel.status}`);
  assert(unauthDel.body?.error === 'forbidden_admin_only', 'FR-004 unauthenticated DELETE error code', `Expected forbidden_admin_only, got ${unauthDel.body?.error}`);

  // Regular authenticated user must also be rejected with 403 forbidden_admin_only
  const regUserPost = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({ plan: 'premium', expiresAt: Date.now() + 86400000 })
  });
  assert(regUserPost.status === 403, 'FR-003 regular user POST /gift status 403', `Expected 403, got ${regUserPost.status}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Validation Constraints on POST /api/admin/users/:id/gift (FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  // 404 on nonexistent user
  const notFoundRes = await request('/api/admin/users/u_nonexistent_00000000/gift', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ plan: 'premium', expiresAt: Date.now() + 86400000 })
  });
  assert(notFoundRes.status === 404, 'FR-003 nonexistent user status 404', `Expected 404, got ${notFoundRes.status}`);
  assert(notFoundRes.body?.error === 'user_not_found', 'FR-003 nonexistent user error code', `Expected user_not_found, got ${notFoundRes.body?.error}`);

  // 400 unknown_plan
  const unknownPlanRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ plan: 'nonexistent_tier_xyz', expiresAt: Date.now() + 86400000 })
  });
  assert(unknownPlanRes.status === 400, 'FR-003 unknown plan status 400', `Expected 400, got ${unknownPlanRes.status}`);
  assert(unknownPlanRes.body?.error === 'unknown_plan', 'FR-003 unknown plan error code', `Expected unknown_plan, got ${unknownPlanRes.body?.error}`);

  // 400 plan_inactive: create an inactive plan to verify rejection
  const inactivePlanId = `inact_${ts}`.slice(0, 18);
  await request('/api/admin/plans', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: inactivePlanId,
      nameEn: 'Inactive Plan',
      nameFa: 'پلن غیرفعال',
      priceUSD: 10,
      isActive: false
    })
  });
  const inactRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ plan: inactivePlanId, expiresAt: Date.now() + 86400000 })
  });
  assert(inactRes.status === 400, 'FR-003 inactive plan status 400', `Expected 400, got ${inactRes.status}`);
  assert(inactRes.body?.error === 'plan_inactive', 'FR-003 inactive plan error code', `Expected plan_inactive, got ${inactRes.body?.error}`);

  // 400 invalid_expiry: past timestamp
  const pastExpiryRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ plan: 'premium', expiresAt: Date.now() - 60000 })
  });
  assert(pastExpiryRes.status === 400, 'FR-003 past expiry status 400', `Expected 400, got ${pastExpiryRes.status}`);
  assert(pastExpiryRes.body?.error === 'invalid_expiry', 'FR-003 past expiry error code', `Expected invalid_expiry, got ${pastExpiryRes.body?.error}`);

  // 400 invalid_expiry: non-numeric string
  const strExpiryRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ plan: 'premium', expiresAt: '2030-01-01' })
  });
  assert(strExpiryRes.status === 400, 'FR-003 string expiry status 400', `Expected 400, got ${strExpiryRes.status}`);
  assert(strExpiryRes.body?.error === 'invalid_expiry', 'FR-003 string expiry error code', `Expected invalid_expiry, got ${strExpiryRes.body?.error}`);

  // 400 invalid_expiry: negative number
  const negExpiryRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ plan: 'premium', expiresAt: -1000 })
  });
  assert(negExpiryRes.status === 400, 'FR-003 negative expiry status 400', `Expected 400, got ${negExpiryRes.status}`);
  assert(negExpiryRes.body?.error === 'invalid_expiry', 'FR-003 negative expiry error code', `Expected invalid_expiry, got ${negExpiryRes.body?.error}`);

  // 400 invalid_note: note > 200 chars
  const longNoteRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: 'premium',
      expiresAt: Date.now() + 86400000,
      note: 'A'.repeat(201)
    })
  });
  assert(longNoteRes.status === 400, 'FR-003 note > 200 chars status 400', `Expected 400, got ${longNoteRes.status}`);
  assert(longNoteRes.body?.error === 'invalid_note', 'FR-003 note > 200 chars error code', `Expected invalid_note, got ${longNoteRes.body?.error}`);

  // Note with exactly 200 chars must be accepted
  const validNoteRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: 'premium',
      expiresAt: Date.now() + 86400000,
      note: 'B'.repeat(200)
    })
  });
  assert(validNoteRes.status === 200, 'FR-003 note == 200 chars accepted with 200', `Expected 200, got ${validNoteRes.status}`);
  assert(validNoteRes.body?.user?.gift?.note === 'B'.repeat(200), 'FR-003 note == 200 chars saved', 'Note mismatch');

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Gift Replacement & Audit Events (FR-003, SC-003)
  // ──────────────────────────────────────────────────────────────────────────
  const firstExpiry = Date.now() + 10 * 86400000;
  const firstGrantRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: 'plus',
      expiresAt: firstExpiry,
      note: 'Initial 10-day plus gift'
    })
  });
  assert(firstGrantRes.status === 200, 'FR-003 initial grant status 200', `Expected 200, got ${firstGrantRes.status}`);

  // Replace existing gift with an Unlimited premium gift (FR-003, US1 Scenario 4)
  const replaceRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: 'premium',
      expiresAt: null,
      note: 'Replaced with unlimited premium'
    })
  });
  assert(replaceRes.status === 200, 'FR-003 replace gift status 200', `Expected 200, got ${replaceRes.status}`);
  assert(replaceRes.body?.user?.gift?.plan === 'premium', 'FR-003 replaced gift plan is premium', `Expected premium, got ${replaceRes.body?.user?.gift?.plan}`);
  assert(replaceRes.body?.user?.gift?.expiresAt === null, 'FR-003 replaced gift is unlimited', 'Expected null expiresAt');

  // Verify audit event user.gift_grant recorded the replaced gift (FR-003, SC-003)
  const auditRes = await request('/api/admin/audit?action=user.gift_grant', { headers: adminHeaders });
  assert(auditRes.status === 200, 'FR-003 GET /api/admin/audit?action=user.gift_grant status 200', `Expected 200, got ${auditRes.status}`);
  const replaceEvent = auditRes.body?.events?.find(e => e.target === targetId && e.meta?.plan === 'premium');
  assert(!!replaceEvent, 'FR-003 user.gift_grant audit event found for replaced gift', 'Missing audit event');
  assert(replaceEvent.meta?.replaced?.plan === 'plus', 'FR-003 audit event records replaced gift plan',
    `Expected plus, got ${replaceEvent.meta?.replaced?.plan}`);
  assert(replaceEvent.meta?.replaced?.expiresAt === firstExpiry, 'FR-003 audit event records replaced gift expiresAt',
    `Expected ${firstExpiry}, got ${replaceEvent.meta?.replaced?.expiresAt}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Revoke Gift DELETE /api/admin/users/:id/gift & Audit (FR-004, SC-003)
  // ──────────────────────────────────────────────────────────────────────────
  const revokeRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  assert(revokeRes.status === 200, 'FR-004 DELETE /gift status 200', `Expected 200, got ${revokeRes.status}`);
  assert(revokeRes.body?.ok === true, 'FR-004 revoke response ok: true', 'Expected ok: true');
  assert(revokeRes.body?.user?.gift === null, 'FR-004 user gift cleared in admin row', `Expected null, got ${JSON.stringify(revokeRes.body?.user?.gift)}`);

  // Verify audit event user.gift_revoke with reason: admin (FR-004, SC-003)
  const revokeAudit = await request('/api/admin/audit?action=user.gift_revoke', { headers: adminHeaders });
  assert(revokeAudit.status === 200, 'FR-004 GET audit for gift_revoke status 200', `Expected 200, got ${revokeAudit.status}`);
  const revokeEvent = revokeAudit.body?.events?.find(e => e.target === targetId && e.meta?.reason === 'admin');
  assert(!!revokeEvent, 'FR-004 user.gift_revoke event found in audit trail', 'Missing revoke audit event');
  assert(revokeEvent.meta?.plan === 'premium', 'FR-004 revoke audit event records revoked plan', `Expected premium, got ${revokeEvent.meta?.plan}`);

  // Re-invoking DELETE when user has no gift returns 400 no_gift (FR-004)
  const noGiftRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  assert(noGiftRes.status === 400, 'FR-004 DELETE without active gift status 400', `Expected 400, got ${noGiftRes.status}`);
  assert(noGiftRes.body?.error === 'no_gift', 'FR-004 error code is no_gift', `Expected no_gift, got ${noGiftRes.body?.error}`);

  // DELETE on nonexistent user returns 404 user_not_found
  const delNotFound = await request('/api/admin/users/u_nonexistent_00000000/gift', {
    method: 'DELETE',
    headers: adminHeaders
  });
  assert(delNotFound.status === 404, 'FR-004 DELETE nonexistent user status 404', `Expected 404, got ${delNotFound.status}`);
  assert(delNotFound.body?.error === 'user_not_found', 'FR-004 error code is user_not_found', `Expected user_not_found, got ${delNotFound.body?.error}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Bulk Gift Grant POST /api/admin/users/bulk (FR-005)
  // ──────────────────────────────────────────────────────────────────────────
  // Register 3 users for bulk gift operation
  const u1 = { email: `bg1_${ts}@acceptance.test`, username: `bg1_${ts}`.slice(0, 24), password: 'BulkPassword123!', displayName: `Bulk 1 ${ts}` };
  const u2 = { email: `bg2_${ts}@acceptance.test`, username: `bg2_${ts}`.slice(0, 24), password: 'BulkPassword123!', displayName: `Bulk 2 ${ts}` };
  const u3 = { email: `bg3_${ts}@acceptance.test`, username: `bg3_${ts}`.slice(0, 24), password: 'BulkPassword123!', displayName: `Bulk 3 ${ts}` };
  const r1 = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u1) });
  const r2 = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u2) });
  const r3 = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u3) });
  const ids = [r1.body?.user?.id, r2.body?.user?.id, r3.body?.user?.id];

  // Bulk validation: applied once before granting (FR-005)
  const bulkBadPlan = await request('/api/admin/users/bulk', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids, action: 'gift', plan: 'nonexistent_tier_xyz' })
  });
  assert(bulkBadPlan.status === 400, 'FR-005 bulk invalid plan status 400', `Expected 400, got ${bulkBadPlan.status}`);
  assert(bulkBadPlan.body?.error === 'unknown_plan', 'FR-005 bulk error unknown_plan', `Expected unknown_plan, got ${bulkBadPlan.body?.error}`);

  const bulkBadExp = await request('/api/admin/users/bulk', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids, action: 'gift', plan: 'plus', expiresAt: Date.now() - 5000 })
  });
  assert(bulkBadExp.status === 400, 'FR-005 bulk invalid expiry status 400', `Expected 400, got ${bulkBadExp.status}`);
  assert(bulkBadExp.body?.error === 'invalid_expiry', 'FR-005 bulk error invalid_expiry', `Expected invalid_expiry, got ${bulkBadExp.body?.error}`);

  // Bulk grant execution
  const bulkExpiry = Date.now() + 14 * 86400000;
  const bulkGrantRes = await request('/api/admin/users/bulk', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      ids,
      action: 'gift',
      plan: 'plus',
      expiresAt: bulkExpiry,
      note: 'Cohort welcome gift'
    })
  });
  assert(bulkGrantRes.status === 200, 'FR-005 bulk grant status 200', `Expected 200, got ${bulkGrantRes.status}`);
  assert(bulkGrantRes.body?.ok === true, 'FR-005 bulk grant ok: true', 'Expected ok: true');
  assert(bulkGrantRes.body?.done === 3, 'FR-005 bulk grant done count is 3', `Expected 3, got ${bulkGrantRes.body?.done}`);
  assert(bulkGrantRes.body?.skipped === 0, 'FR-005 bulk grant skipped count is 0', `Expected 0, got ${bulkGrantRes.body?.skipped}`);

  // Verify each target user received the gift
  for (const id of ids) {
    const uDetail = await request(`/api/admin/users/${id}`, { headers: adminHeaders });
    assert(uDetail.body?.user?.gift?.plan === 'plus', `FR-005 user ${id} received plus gift`, `Expected plus, got ${uDetail.body?.user?.gift?.plan}`);
    assert(uDetail.body?.user?.gift?.expiresAt === bulkExpiry, `FR-005 user ${id} gift expiry matches`, 'Expiry mismatch');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Plan Deletion Gift Cleanup & Reason Audit (FR-007, Edge Case)
  // ──────────────────────────────────────────────────────────────────────────
  const tempPlanId = `del_tier_${ts}`.slice(0, 18);
  // Create temporary plan
  const createPlanRes = await request('/api/admin/plans', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: tempPlanId,
      nameEn: 'Temp Plan for Deletion',
      nameFa: 'پلن موقت برای حذف',
      priceUSD: 19.99,
      isActive: true
    })
  });
  assert(createPlanRes.status === 200, 'FR-007 setup: create temp plan', `Expected 200, got ${createPlanRes.status}`);

  // Grant gift on this temporary plan to targetId
  const tempGrantRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: tempPlanId,
      expiresAt: Date.now() + 86400000,
      note: 'Gift to test plan deletion'
    })
  });
  assert(tempGrantRes.status === 200, 'FR-007 grant gift on temp plan', `Expected 200, got ${tempGrantRes.status}`);

  // Delete the plan
  const delPlanRes = await request(`/api/admin/plans/${tempPlanId}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  assert(delPlanRes.status === 200, 'FR-007 DELETE plan status 200', `Expected 200, got ${delPlanRes.status}`);

  // Verify the gift on that deleted plan is removed from target user (FR-007)
  const checkUserAfterPlanDel = await request(`/api/admin/users/${targetId}`, { headers: adminHeaders });
  assert(checkUserAfterPlanDel.body?.user?.gift === null,
    'FR-007 gift removed after plan deletion',
    `Expected null, got ${JSON.stringify(checkUserAfterPlanDel.body?.user?.gift)}`);

  // Verify audit event user.gift_revoke with reason: plan_deleted (FR-007)
  const delPlanAudit = await request('/api/admin/audit?action=user.gift_revoke', { headers: adminHeaders });
  const delPlanRevokeEvent = delPlanAudit.body?.events?.find(e => e.target === targetId && e.meta?.reason === 'plan_deleted');
  assert(!!delPlanRevokeEvent, 'FR-007 user.gift_revoke audit event with reason: plan_deleted found', 'Missing plan_deleted audit event');
  assert(delPlanRevokeEvent.meta?.plan === tempPlanId, 'FR-007 audit event records deleted plan id', `Expected ${tempPlanId}, got ${delPlanRevokeEvent.meta?.plan}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Edge Cases: Gift Same as Base, Suspended User, Pending Upgrade
  // ──────────────────────────────────────────────────────────────────────────
  // Edge Case 1: Gift plan equal to base plan is allowed but labelled as gift
  const samePlanRes = await request(`/api/admin/users/${targetId}/gift`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      plan: 'basic',
      expiresAt: Date.now() + 86400000,
      note: 'Freezing basic plan'
    })
  });
  assert(samePlanRes.status === 200, 'Edge case: gift plan equal to base plan allowed', `Expected 200, got ${samePlanRes.status}`);
  assert(samePlanRes.body?.user?.gift?.plan === 'basic', 'Gift plan is basic', 'Plan mismatch');

  // Edge Case 2: Suspended user keeps gift but cannot use service
  await request(`/api/admin/users/${targetId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ suspended: true, suspendReason: 'Investigation' })
  });
  const suspendedUserRes = await request(`/api/admin/users/${targetId}`, { headers: adminHeaders });
  assert(suspendedUserRes.body?.user?.gift?.plan === 'basic', 'Gift retained on suspended user', 'Gift was lost');
  // Verify suspended user is blocked from making authenticated requests
  const blockedReq = await request('/api/auth/me', { headers: { Cookie: userCookie } });
  // Architect amendment (phase-1 review): the spec only requires that suspension blocks access. The product
  // revokes all sessions on suspend, so the old session no longer identifies the user (/me answers as guest,
  // user: null) and any authenticated route refuses it.
  assert(blockedReq.body?.user == null, 'Suspended user blocked despite having gift', `Expected no user for the old session, got ${blockedReq.body?.user?.id}`);
  const blockedState = await request('/api/user/state', { headers: { Cookie: userCookie } });
  assert(blockedState.status === 401 || blockedState.status === 403, 'Suspended user cannot read synced state', `Expected 401/403, got ${blockedState.status}`);

  console.log('✅ [013 Acceptance Suite 02] Admin Gift API, Validation & Bulk passed.');
}

run().catch(err => {
  console.error(`❌ Suite 02 unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
