/**
 * @spec 010
 * @covers FR-013, FR-014
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
  const rawBuffer = Buffer.from(await res.arrayBuffer());
  const text = rawBuffer.toString('utf8');
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text, rawBuffer };
}

async function run() {
  console.log(`[010 Acceptance Suite 04] Running Platform Settings & Audit Trail against ${BASE_URL}...`);
  const masterKey = getMasterKey();
  assert(!!masterKey, 'Suite 04 setup: master key present', 'Master key could not be loaded');

  const adminHeaders = { 'X-Master-Key': masterKey };
  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Preserve original platform settings to restore on suite exit
  const origSettingsRes = await request('/api/admin/settings', { headers: adminHeaders });
  assert(origSettingsRes.status === 200, 'FR-013 GET /api/admin/settings status 200', `Expected 200, got ${origSettingsRes.status}`);
  assert(origSettingsRes.body?.ok === true, 'FR-013 settings ok: true', 'Expected ok: true');
  const originalSettings = origSettingsRes.body?.settings;
  assert(typeof originalSettings === 'object', 'FR-013 settings object present', 'Missing settings');

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Platform Settings Retrieval & Field Validations (FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    assert(typeof originalSettings.registrationOpen === 'boolean', 'FR-013 settings.registrationOpen boolean', 'Missing registrationOpen');
    assert(typeof originalSettings.maintenanceMode === 'boolean', 'FR-013 settings.maintenanceMode boolean', 'Missing maintenanceMode');
    assert(typeof originalSettings.announcementEnabled === 'boolean', 'FR-013 settings.announcementEnabled boolean', 'Missing announcementEnabled');
    assert(['info', 'warning', 'success'].includes(originalSettings.announcementLevel), 'FR-013 settings.announcementLevel valid', `Invalid level: ${originalSettings.announcementLevel}`);
    assert(typeof originalSettings.announcementFa === 'string', 'FR-013 settings.announcementFa string', 'Missing announcementFa');
    assert(typeof originalSettings.announcementEn === 'string', 'FR-013 settings.announcementEn string', 'Missing announcementEn');
    assert(Array.isArray(originalSettings.testDomains), 'FR-013 settings.testDomains array', 'Missing testDomains');
    assert(typeof originalSettings.updatedAt === 'number', 'FR-013 settings.updatedAt timestamp', 'Missing updatedAt');

    // Validation: Invalid email test domain
    const badDomainRes = await request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ testDomains: ['not_a_valid_domain_syntax!'] })
    });
    assert(badDomainRes.status === 400, 'FR-013 invalid domain status 400', `Expected 400, got ${badDomainRes.status}`);
    assert(badDomainRes.body?.error === 'validation_failed', 'FR-013 validation_failed error code', `Expected validation_failed, got ${badDomainRes.body?.error}`);
    const domainErr = badDomainRes.body?.errors?.find(e => e.field === 'testDomains');
    assert(domainErr?.code === 'invalid_domain', 'FR-013 invalid_domain error code', `Expected invalid_domain, got ${JSON.stringify(badDomainRes.body)}`);

    // Validation: Announcement enabled without message
    const emptyAnnRes = await request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ announcementEnabled: true, announcementFa: '', announcementEn: '' })
    });
    assert(emptyAnnRes.status === 400, 'FR-013 announcement_empty status 400', `Expected 400, got ${emptyAnnRes.status}`);
    const annErr = emptyAnnRes.body?.errors?.find(e => e.field === 'announcement');
    assert(annErr?.code === 'announcement_empty', 'FR-013 announcement_empty error code', `Expected announcement_empty, got ${JSON.stringify(emptyAnnRes.body)}`);

    // Validation: Invalid announcement level
    const badLevelRes = await request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ announcementLevel: 'critical_emergency' })
    });
    assert(badLevelRes.status === 400, 'FR-013 invalid announcementLevel status 400', `Expected 400, got ${badLevelRes.status}`);
    const levelErr = badLevelRes.body?.errors?.find(e => e.field === 'announcementLevel');
    assert(levelErr?.code === 'invalid', 'FR-013 announcementLevel invalid error code', `Expected invalid, got ${JSON.stringify(badLevelRes.body)}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Platform Enforcement of Settings (FR-013)
    // ──────────────────────────────────────────────────────────────────────────
    // Effect A: Registration lock
    // Close registration
    const closeRegRes = await request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ registrationOpen: false })
    });
    assert(closeRegRes.status === 200, 'FR-013 close registration status 200', `Expected 200, got ${closeRegRes.status}`);

    // Verify public platform endpoint reports registrationOpen = false
    const pubPlatClosed = await request('/api/platform');
    assert(pubPlatClosed.body?.registrationOpen === false, 'FR-013 platform reports registrationOpen false', 'Expected registrationOpen: false');

    // Attempt registration while closed -> 403 registration_closed
    const regAttemptRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `reg_closed_${ts}@acceptance.test`,
        username: `reg_cl_${ts}`.slice(0, 24),
        password: 'ClosedPassword123!',
        displayName: `Closed User ${ts}`
      })
    });
    assert(regAttemptRes.status === 403, 'FR-013 registration closed status 403', `Expected 403, got ${regAttemptRes.status}`);
    assert(regAttemptRes.body?.error === 'registration_closed', 'FR-013 registration_closed error code', `Expected registration_closed, got ${regAttemptRes.body?.error}`);

    // Reopen registration
    await request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ registrationOpen: true })
    });

    // Effect B: Maintenance mode
    // Register user while open
    const maintUser = {
      email: `maint_usr_${ts}@acceptance.test`,
      username: `mu_${ts}`.slice(0, 24),
      password: 'MaintPassword123!',
      displayName: `Maint Trader ${ts}`
    };
    const regMaintRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maintUser)
    });
    assert(regMaintRes.status === 200, 'FR-013 setup: maint user registration', `Expected 200, got ${regMaintRes.status}`);
    const maintUserId = regMaintRes.body?.user?.id;

    // Enable maintenance mode
    const enableMaintRes = await request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ maintenanceMode: true })
    });
    assert(enableMaintRes.status === 200, 'FR-013 enable maintenance mode status 200', `Expected 200, got ${enableMaintRes.status}`);

    // Attempt login during maintenance mode -> 503 maintenance
    const loginMaintRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: maintUser.username, password: maintUser.password })
    });
    assert(loginMaintRes.status === 503, 'FR-013 login during maintenance status 503', `Expected 503, got ${loginMaintRes.status}`);
    assert(loginMaintRes.body?.error === 'maintenance', 'FR-013 maintenance error code', `Expected maintenance, got ${loginMaintRes.body?.error}`);

    // Admin access remains active during maintenance mode
    const adminDuringMaint = await request('/api/admin/session', { headers: adminHeaders });
    assert(adminDuringMaint.body?.isAdmin === true, 'FR-013 admin accessible during maintenance mode', 'Admin was locked out during maintenance');

    // Disable maintenance mode
    await request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ maintenanceMode: false })
    });

    // Clean up maint user
    await request(`/api/admin/users/${maintUserId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ confirm: maintUser.username })
    });

    // Effect C: Global announcement banner
    const testFa = `هشدار آزمایشی نگهداری ${ts}`;
    const testEn = `Acceptance Test Notice ${ts}`;
    const setAnnRes = await request('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({
        announcementEnabled: true,
        announcementLevel: 'warning',
        announcementFa: testFa,
        announcementEn: testEn
      })
    });
    assert(setAnnRes.status === 200, 'FR-013 set announcement status 200', `Expected 200, got ${setAnnRes.status}`);

    // Verify public platform endpoint returns announcement
    const pubAnnRes = await request('/api/platform');
    assert(pubAnnRes.status === 200, 'FR-013 GET /api/platform status 200', `Expected 200, got ${pubAnnRes.status}`);
    const pubAnn = pubAnnRes.body?.announcement;
    assert(pubAnn?.level === 'warning', 'FR-013 announcement level warning', `Expected warning, got ${pubAnn?.level}`);
    assert(pubAnn?.fa === testFa, 'FR-013 announcementFa matches', `Expected ${testFa}, got ${pubAnn?.fa}`);
    assert(pubAnn?.en === testEn, 'FR-013 announcementEn matches', `Expected ${testEn}, got ${pubAnn?.en}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Audit Trail Inspection, Filtering & Privileged Action Logging (FR-014)
    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/admin/audit
    const auditRes = await request('/api/admin/audit?pageSize=10&page=1', { headers: adminHeaders });
    assert(auditRes.status === 200, 'FR-014 GET /api/admin/audit status 200', `Expected 200, got ${auditRes.status}`);
    assert(auditRes.body?.ok === true, 'FR-014 audit response ok: true', 'Expected ok: true');
    assert(typeof auditRes.body?.total === 'number' && auditRes.body.total >= 1, 'FR-014 total audit events >= 1', 'Total events is 0');
    assert(Array.isArray(auditRes.body?.actions), 'FR-014 actions array present', 'Missing actions');
    assert(Array.isArray(auditRes.body?.events) && auditRes.body.events.length >= 1, 'FR-014 events array present', 'Missing events');

    // Verify latest event structure
    const latestEvent = auditRes.body.events[0];
    assert(typeof latestEvent.id === 'string' && latestEvent.id.startsWith('ev_'),
      'FR-014 event id format ev_...', `Invalid event id: ${latestEvent.id}`);
    assert(typeof latestEvent.at === 'number', 'FR-014 event timestamp number', 'Missing at');
    assert(typeof latestEvent.action === 'string', 'FR-014 event action string', 'Missing action');
    assert(typeof latestEvent.ok === 'boolean', 'FR-014 event ok boolean', 'Missing ok');
    assert(typeof latestEvent.actor === 'string', 'FR-014 event actor string', 'Missing actor');
    assert(['token', 'key', 'role', null].includes(latestEvent.actorVia),
      'FR-014 event actorVia valid', `Invalid actorVia: ${latestEvent.actorVia}`);

    // Filter by action: settings.update
    const filterActionRes = await request('/api/admin/audit?action=settings.update', { headers: adminHeaders });
    assert(filterActionRes.status === 200, 'FR-014 filter audit by action status 200', `Expected 200, got ${filterActionRes.status}`);
    assert(filterActionRes.body?.events.every(e => e.action === 'settings.update'),
      'FR-014 all filtered events match settings.update', 'Non-matching event found');

    // Filter by status: ok
    const filterStatusRes = await request('/api/admin/audit?status=ok', { headers: adminHeaders });
    assert(filterStatusRes.status === 200, 'FR-014 filter audit by status status 200', `Expected 200, got ${filterStatusRes.status}`);
    assert(filterStatusRes.body?.events.every(e => e.ok === true),
      'FR-014 all filtered events ok: true', 'Failed event found in status=ok filter');

    // Search query q
    const searchAuditRes = await request('/api/admin/audit?q=settings', { headers: adminHeaders });
    assert(searchAuditRes.status === 200, 'FR-014 search audit q=settings status 200', `Expected 200, got ${searchAuditRes.status}`);

    // Verify audit log storage file & rotation constraints (FR-014 edge case)
    const auditFile = path.resolve(__dirname, '../../../server/data/accounts/audit.jsonl');
    if (fs.existsSync(auditFile)) {
      const stat = fs.statSync(auditFile);
      // Hard cap is 2MB (2,097,152 bytes)
      assert(stat.size <= 2097152 + 1024, 'FR-014 audit log within 2MB rotation ceiling', `Audit log exceeds 2MB: ${stat.size} bytes`);
    }
  } finally {
    // Restore original settings
    if (originalSettings) {
      await request('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({
          registrationOpen: originalSettings.registrationOpen,
          maintenanceMode: originalSettings.maintenanceMode,
          announcementEnabled: originalSettings.announcementEnabled,
          announcementLevel: originalSettings.announcementLevel,
          announcementFa: originalSettings.announcementFa,
          announcementEn: originalSettings.announcementEn,
          testDomains: originalSettings.testDomains
        })
      }).catch(() => {});
    }
  }

  console.log('✅ [010 Acceptance Suite 04] Platform Settings & Audit Trail passed.');
}

run().catch(err => {
  console.error(`❌ Suite 04 unexpected error: ${err.message}\n${err.stack}`);
  process.exit(1);
});
