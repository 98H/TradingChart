/**
 * @spec 010
 * @covers FR-005, FR-011, FR-012
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
  const rawBuffer = Buffer.from(await res.arrayBuffer());
  const text = rawBuffer.toString('utf8');
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text, rawBuffer };
}

async function run() {
  console.log(`[010 Acceptance Suite 03] Running Plans Catalog & Hot-Reload against ${BASE_URL}...`);
  const masterKey = getMasterKey();
  assert(!!masterKey, 'Suite 03 setup: master key present', 'Master key could not be loaded');

  const adminHeaders = { 'X-Master-Key': masterKey };
  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Dashboard Overview KPIs & Scope Filtering (FR-005)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Overview with default / all scope
    const ovAllRes = await request('/api/admin/overview?type=all', { headers: adminHeaders });
    assert(ovAllRes.status === 200, 'FR-005 GET /api/admin/overview?type=all status 200', `Expected 200, got ${ovAllRes.status}`);
    assert(ovAllRes.body?.ok === true, 'FR-005 overview ok: true', 'Expected ok: true');
    assert(ovAllRes.body?.type === 'all', 'FR-005 type is "all"', `Expected all, got ${ovAllRes.body?.type}`);

    const kpi = ovAllRes.body?.kpi;
    assert(typeof kpi?.users === 'number', 'FR-005 kpi.users number', 'Missing kpi.users');
    assert(typeof kpi?.new24 === 'number', 'FR-005 kpi.new24 number', 'Missing kpi.new24');
    assert(typeof kpi?.new7 === 'number', 'FR-005 kpi.new7 number', 'Missing kpi.new7');
    assert(typeof kpi?.new30 === 'number', 'FR-005 kpi.new30 number', 'Missing kpi.new30');
    assert(typeof kpi?.active24 === 'number', 'FR-005 kpi.active24 number', 'Missing kpi.active24');
    assert(typeof kpi?.active7 === 'number', 'FR-005 kpi.active7 number', 'Missing kpi.active7');
    assert(typeof kpi?.activeSessions === 'number', 'FR-005 kpi.activeSessions number', 'Missing kpi.activeSessions');
    assert(typeof kpi?.adminSessions === 'number', 'FR-005 kpi.adminSessions number', 'Missing kpi.adminSessions');
    assert(typeof kpi?.verified === 'number', 'FR-005 kpi.verified number', 'Missing kpi.verified');
    assert(typeof kpi?.twofa === 'number', 'FR-005 kpi.twofa number', 'Missing kpi.twofa');
    assert(typeof kpi?.suspended === 'number', 'FR-005 kpi.suspended number', 'Missing kpi.suspended');
    assert(typeof kpi?.admins === 'number', 'FR-005 kpi.admins number', 'Missing kpi.admins');
    assert(typeof kpi?.paid === 'number', 'FR-005 kpi.paid number', 'Missing kpi.paid');
    assert(typeof kpi?.planRequests === 'number', 'FR-005 kpi.planRequests number', 'Missing kpi.planRequests');
    assert(typeof kpi?.mrr === 'number', 'FR-005 kpi.mrr number', 'Missing kpi.mrr');
    assert(typeof kpi?.plans === 'number', 'FR-005 kpi.plans number', 'Missing kpi.plans');

    assert(Array.isArray(ovAllRes.body?.planDist), 'FR-005 planDist array present', 'Missing planDist array');
    assert(Array.isArray(ovAllRes.body?.signups), 'FR-005 signups array present', 'Missing signups array');
    assert(Array.isArray(ovAllRes.body?.recentUsers), 'FR-005 recentUsers array present', 'Missing recentUsers array');
    assert(Array.isArray(ovAllRes.body?.recentEvents), 'FR-005 recentEvents array present', 'Missing recentEvents array');

    // Overview with real scope
    const ovRealRes = await request('/api/admin/overview?type=real', { headers: adminHeaders });
    assert(ovRealRes.status === 200, 'FR-005 overview type=real status 200', `Expected 200, got ${ovRealRes.status}`);
    assert(ovRealRes.body?.type === 'real', 'FR-005 type is "real"', `Expected real, got ${ovRealRes.body?.type}`);

    // Overview with test scope
    const ovTestRes = await request('/api/admin/overview?type=test', { headers: adminHeaders });
    assert(ovTestRes.status === 200, 'FR-005 overview type=test status 200', `Expected 200, got ${ovTestRes.status}`);
    assert(ovTestRes.body?.type === 'test', 'FR-005 type is "test"', `Expected test, got ${ovTestRes.body?.type}`);
    assert(ovTestRes.body?.kpi?.users === ovTestRes.body?.testCount,
      'FR-005 test scope users matches testCount', `Mismatch: users=${ovTestRes.body?.kpi?.users}, testCount=${ovTestRes.body?.testCount}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Plans Catalog CRUD, Validation & Constraints (FR-011)
  // ──────────────────────────────────────────────────────────────────────────
  const customPlanId = `qa_tier_${ts}`.slice(0, 20);
  const clonePlanId = `qa_clone_${ts}`.slice(0, 20);

  // List plans
  const listPlansRes = await request('/api/admin/plans', { headers: adminHeaders });
  assert(listPlansRes.status === 200, 'FR-011 GET /api/admin/plans status 200', `Expected 200, got ${listPlansRes.status}`);
  assert(listPlansRes.body?.ok === true, 'FR-011 plans list ok: true', 'Expected ok: true');
  assert(typeof listPlansRes.body?.plans === 'object', 'FR-011 plans dictionary present', 'Missing plans dict');
  assert(Array.isArray(listPlansRes.body?.planOrder), 'FR-011 planOrder array present', 'Missing planOrder');
  assert(Array.isArray(listPlansRes.body?.catalog) && listPlansRes.body.catalog.length >= 40,
    'FR-011 catalog has feature definitions', `Catalog length: ${listPlansRes.body?.catalog?.length}`);
  assert(Array.isArray(listPlansRes.body?.categories), 'FR-011 categories array present', 'Missing categories');
  assert(Array.isArray(listPlansRes.body?.builtin), 'FR-011 builtin array present', 'Missing builtin');
  assert(typeof listPlansRes.body?.userCounts === 'object', 'FR-011 userCounts present', 'Missing userCounts');

  // Input validation on creation
  // Invalid plan ID (special characters / spaces)
  const badIdRes = await request('/api/admin/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders },
    body: JSON.stringify({
      id: 'bad id with spaces!',
      nameEn: 'Bad Tier',
      nameFa: 'پلن نامعتبر',
      priceUSD: 10
    })
  });
  assert(badIdRes.status === 400, 'FR-011 invalid plan ID syntax status 400', `Expected 400, got ${badIdRes.status}`);
  assert(badIdRes.body?.error === 'invalid_plan_id', 'FR-011 invalid_plan_id error code', `Expected invalid_plan_id, got ${badIdRes.body?.error}`);

  // Duplicate plan ID
  const dupIdRes = await request('/api/admin/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders },
    body: JSON.stringify({
      id: 'basic',
      nameEn: 'Duplicate Basic',
      nameFa: 'پایه تکراری',
      priceUSD: 0
    })
  });
  assert(dupIdRes.status === 400, 'FR-011 duplicate plan ID status 400', `Expected 400, got ${dupIdRes.status}`);
  assert(dupIdRes.body?.error === 'plan_exists', 'FR-011 plan_exists error code', `Expected plan_exists, got ${dupIdRes.body?.error}`);

  // Validation failure (missing nameEn)
  const missingNameRes = await request('/api/admin/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders },
    body: JSON.stringify({
      id: customPlanId,
      nameEn: '',
      nameFa: 'بدون نام انگلیسی',
      priceUSD: 20
    })
  });
  assert(missingNameRes.status === 400, 'FR-011 missing nameEn status 400', `Expected 400, got ${missingNameRes.status}`);
  assert(missingNameRes.body?.error === 'validation_failed', 'FR-011 validation_failed error code', `Expected validation_failed, got ${missingNameRes.body?.error}`);

  // Create valid custom plan
  const createPlanRes = await request('/api/admin/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders },
    body: JSON.stringify({
      id: customPlanId,
      nameEn: `Custom Tier ${ts}`,
      nameFa: `پلن سفارشی ${ts}`,
      priceUSD: 39.99,
      priceYearlyUSD: 399.00,
      color: '#f59e0b',
      isActive: true,
      isDefault: false,
      features: {
        maxChartsPerLayout: 6,
        savedLayouts: 18
      }
    })
  });
  assert(createPlanRes.status === 200, 'FR-011 POST /api/admin/plans status 200', `Expected 200, got ${createPlanRes.status}`);
  assert(createPlanRes.body?.ok === true, 'FR-011 create plan ok: true', 'Expected ok: true');
  assert(createPlanRes.body?.plan?.id === customPlanId, 'FR-011 created plan id matches', `Expected ${customPlanId}, got ${createPlanRes.body?.plan?.id}`);
  assert(createPlanRes.body?.planOrder?.includes(customPlanId), 'FR-011 created plan added to planOrder', 'Plan missing in planOrder');

  try {
    // Update plan attributes and feature quotas (PUT /api/admin/plans/:id)
    const updatePlanRes = await request(`/api/admin/plans/${customPlanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({
        nameFa: `پلن ویرایش شده ${ts}`,
        priceUSD: 49.99,
        features: {
          savedLayouts: 22
        }
      })
    });
    assert(updatePlanRes.status === 200, 'FR-011 PUT /api/admin/plans/:id status 200', `Expected 200, got ${updatePlanRes.status}`);
    assert(updatePlanRes.body?.plan?.priceUSD === 49.99, 'FR-011 priceUSD updated', 'Price mismatch');
    assert(updatePlanRes.body?.plan?.features?.savedLayouts === 22, 'FR-011 savedLayouts quota updated to 22', 'Quota mismatch');

    // Default plan constraints
    // Cannot unset default plan directly
    const unsetDefRes = await request('/api/admin/plans/basic', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ isDefault: false })
    });
    assert(unsetDefRes.status === 400, 'FR-011 cannot unset default status 400', `Expected 400, got ${unsetDefRes.status}`);
    assert(unsetDefRes.body?.error === 'cannot_unset_default', 'FR-011 cannot_unset_default error code', `Expected cannot_unset_default, got ${unsetDefRes.body?.error}`);

    // Default plan must remain active
    const deactDefRes = await request('/api/admin/plans/basic', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ isActive: false })
    });
    assert(deactDefRes.status === 400, 'FR-011 default must be active status 400', `Expected 400, got ${deactDefRes.status}`);
    assert(deactDefRes.body?.error === 'default_must_be_active', 'FR-011 default_must_be_active error code', `Expected default_must_be_active, got ${deactDefRes.body?.error}`);

    // Clone plan (POST /api/admin/plans/clone)
    // Clone with nonexistent source
    const badCloneSource = await request('/api/admin/plans/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ sourceId: 'nonexistent_source_xyz', newId: clonePlanId, nameEn: 'Clone', nameFa: 'تکثیر' })
    });
    assert(badCloneSource.status === 404, 'FR-011 clone nonexistent source status 404', `Expected 404, got ${badCloneSource.status}`);
    assert(badCloneSource.body?.error === 'source_plan_not_found', 'FR-011 source_plan_not_found error code', `Expected source_plan_not_found, got ${badCloneSource.body?.error}`);

    // Valid clone
    const validCloneRes = await request('/api/admin/plans/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({
        sourceId: customPlanId,
        newId: clonePlanId,
        nameEn: `Cloned Tier ${ts}`,
        nameFa: `پلن تکثیر ${ts}`
      })
    });
    assert(validCloneRes.status === 200, 'FR-011 clone plan status 200', `Expected 200, got ${validCloneRes.status}`);
    assert(validCloneRes.body?.plan?.id === clonePlanId, 'FR-011 cloned plan id matches', `Expected ${clonePlanId}, got ${validCloneRes.body?.plan?.id}`);
    assert(validCloneRes.body?.planOrder?.includes(clonePlanId), 'FR-011 cloned plan added to planOrder', 'Missing in planOrder');

    // Reorder plans (POST /api/admin/plans/reorder)
    const currentOrder = validCloneRes.body.planOrder;
    const reversedOrder = [...currentOrder].reverse();

    // Invalid order (empty or not an array)
    const badOrderRes = await request('/api/admin/plans/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ order: [] })
    });
    assert(badOrderRes.status === 400, 'FR-011 invalid plan order status 400', `Expected 400, got ${badOrderRes.status}`);
    assert(badOrderRes.body?.error === 'invalid_order', 'FR-011 invalid_order error code', `Expected invalid_order, got ${badOrderRes.body?.error}`);

    // Valid reorder
    const validReorderRes = await request('/api/admin/plans/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ order: reversedOrder })
    });
    assert(validReorderRes.status === 200, 'FR-011 reorder plans status 200', `Expected 200, got ${validReorderRes.status}`);
    assert(JSON.stringify(validReorderRes.body?.planOrder) === JSON.stringify(reversedOrder),
      'FR-011 plan order updated', 'Reordered array mismatch');

    // Restore original order
    await request('/api/admin/plans/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ order: currentOrder })
    });

    // Delete constraints
    // Cannot delete built-in plan
    const delBuiltinRes = await request('/api/admin/plans/premium', {
      method: 'DELETE',
      headers: adminHeaders
    });
    assert(delBuiltinRes.status === 400, 'FR-011 cannot delete builtin plan status 400', `Expected 400, got ${delBuiltinRes.status}`);
    assert(delBuiltinRes.body?.error === 'cannot_delete_builtin_plan',
      'FR-011 cannot_delete_builtin_plan error code', `Expected cannot_delete_builtin_plan, got ${delBuiltinRes.body?.error}`);

    // Cannot delete default plan
    const delDefaultRes = await request('/api/admin/plans/basic', {
      method: 'DELETE',
      headers: adminHeaders
    });
    assert(delDefaultRes.status === 400, 'FR-011 cannot delete default plan status 400', `Expected 400, got ${delDefaultRes.status}`);
    assert(delDefaultRes.body?.error === 'cannot_delete_default_plan',
      'FR-011 cannot_delete_default_plan error code', `Expected cannot_delete_default_plan, got ${delDefaultRes.body?.error}`);

    // Delete custom plan with user migration
    // Register test user assigned to custom plan
    const customUser = {
      email: `custom_plan_usr_${ts}@acceptance.test`,
      username: `cpu_${ts}`.slice(0, 24),
      password: 'CustomPlanPassword123!',
      displayName: `Custom Plan User ${ts}`
    };
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customUser)
    });
    const customUserId = regRes.body?.user?.id;

    // Assign user to custom plan
    await request(`/api/admin/users/${customUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ plan: customPlanId })
    });

    // Delete custom plan
    const delCustomRes = await request(`/api/admin/plans/${customPlanId}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    assert(delCustomRes.status === 200, 'FR-011 delete custom plan status 200', `Expected 200, got ${delCustomRes.status}`);
    assert(delCustomRes.body?.ok === true, 'FR-011 delete plan ok: true', 'Expected ok: true');
    assert(delCustomRes.body?.fallbackPlan === 'basic', 'FR-011 fallback plan is basic', `Expected basic, got ${delCustomRes.body?.fallbackPlan}`);
    assert(delCustomRes.body?.migratedUsers >= 1, 'FR-011 migratedUsers count >= 1', `Expected >= 1, got ${delCustomRes.body?.migratedUsers}`);

    // Verify user migrated to fallback plan basic
    const migratedUserRes = await request(`/api/admin/users/${customUserId}`, { headers: adminHeaders });
    assert(migratedUserRes.body?.user?.plan === 'basic', 'FR-011 migrated user has basic plan', `Expected basic, got ${migratedUserRes.body?.user?.plan}`);

    // Clean up migrated user
    await request(`/api/admin/users/${customUserId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ confirm: customUser.username })
    });

    // Clean up cloned plan
    await request(`/api/admin/plans/${clonePlanId}`, { method: 'DELETE', headers: adminHeaders });
  } finally {
    // Ensure test plans are cleaned up
    await request(`/api/admin/plans/${customPlanId}`, { method: 'DELETE', headers: adminHeaders }).catch(() => {});
    await request(`/api/admin/plans/${clonePlanId}`, { method: 'DELETE', headers: adminHeaders }).catch(() => {});
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Runtime Hot-Reload of Entitlements Without Restart (FR-012)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Query platform public plans before update
    const publicPlansBefore = await request('/api/plans');
    assert(publicPlansBefore.status === 200, 'FR-012 GET /api/plans status 200', `Expected 200, got ${publicPlansBefore.status}`);
    const originalSavedLayouts = publicPlansBefore.body?.plans?.basic?.features?.savedLayouts;
    assert(typeof originalSavedLayouts === 'number', 'FR-012 original savedLayouts number', 'Missing savedLayouts');

    // Update basic tier quota
    const targetQuota = originalSavedLayouts === 1 ? 7 : 1;
    const putRes = await request('/api/admin/plans/basic', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ features: { savedLayouts: targetQuota } })
    });
    assert(putRes.status === 200, 'FR-012 update basic savedLayouts status 200', `Expected 200, got ${putRes.status}`);

    // Immediately query public plans without restart
    const publicPlansAfter = await request('/api/plans');
    assert(publicPlansAfter.body?.plans?.basic?.features?.savedLayouts === targetQuota,
      'FR-012 updated quota immediately reflected in public plans without restart',
      `Expected ${targetQuota}, got ${publicPlansAfter.body?.plans?.basic?.features?.savedLayouts}`);

    // Restore original quota
    const restoreRes = await request('/api/admin/plans/basic', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ features: { savedLayouts: originalSavedLayouts } })
    });
    assert(restoreRes.status === 200, 'FR-012 restore basic savedLayouts status 200', `Expected 200, got ${restoreRes.status}`);

    const publicPlansRestored = await request('/api/plans');
    assert(publicPlansRestored.body?.plans?.basic?.features?.savedLayouts === originalSavedLayouts,
      'FR-012 original quota restored in public plans',
      `Expected ${originalSavedLayouts}, got ${publicPlansRestored.body?.plans?.basic?.features?.savedLayouts}`);
  }

  console.log('✅ [010 Acceptance Suite 03] Plans Catalog & Hot-Reload passed.');
}

run().catch(err => {
  console.error(`❌ Suite 03 unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
