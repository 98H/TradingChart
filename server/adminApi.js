// server/adminApi.js
// Back-office REST API: dashboard metrics, user management, audit trail,
// system health and admin-session management. Mounted from accounts.js with
// access to the account store internals (no duplicate persistence layer).

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  isReqAdmin, adminVia, actorOf, audit, readAudit, keyMatches,
  createAdminSession, setAdminCookie, clearAdminCookie, revokeAdminSession, adminTokenFrom,
  listAdminSessions, revokeAdminSessionById
} from './adminAuth.js';
import { getPlatformSettings, updatePlatformSettings, isTestEmail } from './platformSettings.js';

const DAY = 86400000;
const BOOT_AT = Date.now();

export function mountAdminApi(app, d) {
  // d = { users, sessions, flushNow, publicUser, PLANS, PLAN_ORDER, readState, statePath,
  //       stateCache, revokeAllForUser, outboxPush, outboxAll, sixDigitCode, rateGate, defaultPlanId, STATE_DIR }

  const guard = (req, res) => {
    if (isReqAdmin(req)) return false;
    res.status(403).json({ ok: false, error: 'forbidden_admin_only' });
    return true;
  };
  const findUser = id => d.users().users.find(u => u.id === id) || null;
  const isSelf = (req, u) => !!(req.user && u && req.user.id === u.id);
  const adminCount = () => d.users().users.filter(u => !u.suspended && (u.role === 'admin' || u.isAdmin === true)).length;

  function stateBytes(uid) {
    try { return fs.statSync(d.statePath(uid)).size; } catch (e) { return 0; }
  }
  function lastSeenMap() {
    const m = new Map(); const cnt = new Map(); const now = Date.now();
    for (const s of d.sessions().sessions) {
      if (s.expiresAt <= now) continue;
      cnt.set(s.userId, (cnt.get(s.userId) || 0) + 1);
      if ((m.get(s.userId) || 0) < (s.lastSeen || 0)) m.set(s.userId, s.lastSeen || 0);
    }
    return { last: m, count: cnt };
  }
  const isTestUser = u => (typeof u.testAccount === 'boolean' ? u.testAccount : isTestEmail(u.email));
  const typeOk = (u, type) => !type || type === 'all' || (type === 'test' ? isTestUser(u) : !isTestUser(u));
  function adminRow(u, ls) {
    const pu = d.publicUser(u);
    return {
      ...pu,
      isTest: isTestUser(u), testOverride: typeof u.testAccount === 'boolean',
      suspended: !!u.suspended, suspendedAt: u.suspendedAt || null, suspendReason: u.suspendReason || '',
      notes: u.notes || '',
      lastSeen: ls ? (ls.last.get(u.id) || null) : null,
      sessions: ls ? (ls.count.get(u.id) || 0) : 0,
      planName: (d.PLANS[pu.plan] || {}).nameEn || pu.plan,
      planKnown: !!d.PLANS[pu.plan]
    };
  }

  // ── Session: unlock / status / lock ─────────────────────────────────────
  app.post('/api/admin/auth', (req, res) => {
    if (d.rateGate(req, res, 'admin_auth', 5, 60000)) { audit(req, 'admin.unlock', null, { reason: 'rate_limited' }, false); return; }
    const key = req.body?.masterKey;
    if (!keyMatches(key)) {
      audit(req, 'admin.unlock', null, { reason: 'invalid_key' }, false);
      return res.status(401).json({ ok: false, error: 'invalid_master_key' });
    }
    const { token, row } = createAdminSession(req);
    setAdminCookie(res, token);
    req.adminSession = row;
    audit(req, 'admin.unlock', null, { session: row.id });
    res.json({ ok: true, isAdmin: true, expiresAt: row.expiresAt });
  });

  app.get('/api/admin/session', (req, res) => {
    const via = adminVia(req);
    if (!via) return res.json({ ok: true, isAdmin: false });
    const a = actorOf(req);
    res.json({
      ok: true, isAdmin: true, via, actor: a.label,
      userId: req.user?.id || null, username: req.user?.username || null,
      expiresAt: req.adminSession?.expiresAt || null
    });
  });

  app.post('/api/admin/logout', (req, res) => {
    const t = adminTokenFrom(req);
    if (t) { audit(req, 'admin.lock'); revokeAdminSession(t); }
    clearAdminCookie(res);
    res.json({ ok: true });
  });

  // ── Dashboard overview ─────────────────────────────────────────────────
  app.get('/api/admin/overview', (req, res) => {
    if (guard(req, res)) return;
    const now = Date.now();
    const type = ['all', 'real', 'test'].includes(req.query.type) ? req.query.type : 'all';
    const everyone = d.users().users;
    const all = everyone.filter(u => typeOk(u, type));
    const testCount = everyone.filter(isTestUser).length;
    const ls = lastSeenMap();
    const planDist = {};
    for (const id of d.PLAN_ORDER) planDist[id] = 0;
    let mrr = 0, verified = 0, twofa = 0, suspended = 0, admins = 0, paid = 0;
    let new24 = 0, new7 = 0, new30 = 0, prev30 = 0, active24 = 0, active7 = 0;
    const days = 30;
    const signups = Array.from({ length: days }, (_, i) => {
      const start = new Date(now - (days - 1 - i) * DAY); start.setUTCHours(0, 0, 0, 0);
      return { day: start.toISOString().slice(0, 10), count: 0 };
    });
    const dayIdx = new Map(signups.map((s, i) => [s.day, i]));
    for (const u of all) {
      const pid = d.PLANS[u.plan] ? u.plan : d.defaultPlanId();
      planDist[pid] = (planDist[pid] || 0) + 1;
      const price = Number(d.PLANS[pid]?.priceUSD || 0);
      if (price > 0 && !u.suspended) { mrr += price; paid++; }
      if (u.emailVerified) verified++;
      if (u.totpSecret) twofa++;
      if (u.suspended) suspended++;
      if (u.role === 'admin' || u.isAdmin === true) admins++;
      const age = now - (u.createdAt || 0);
      if (age < DAY) new24++;
      if (age < 7 * DAY) new7++;
      if (age < 30 * DAY) new30++; else if (age < 60 * DAY) prev30++;
      const di = dayIdx.get(new Date(u.createdAt || 0).toISOString().slice(0, 10));
      if (di !== undefined) signups[di].count++;
      const seen = ls.last.get(u.id) || 0;
      if (now - seen < DAY) active24++;
      if (now - seen < 7 * DAY) active7++;
    }
    let activeSessions = 0;
    for (const u of all) activeSessions += ls.count.get(u.id) || 0;
    const recentUsers = [...all].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6).map(u => adminRow(u, ls));
    const recentEvents = readAudit().slice(0, 8);
    res.json({
      ok: true, generatedAt: now, type, testCount, totalAll: everyone.length,
      kpi: {
        users: all.length, new24, new7, new30, prev30, active24, active7, activeSessions, adminSessions: listAdminSessions().length,
        verified, twofa, suspended, admins, paid, mrr: Math.round(mrr * 100) / 100,
        plans: d.PLAN_ORDER.length
      },
      planDist: d.PLAN_ORDER.map(id => ({ id, nameEn: d.PLANS[id]?.nameEn || id, nameFa: d.PLANS[id]?.nameFa || id, color: d.PLANS[id]?.color || '#00F2B0', count: planDist[id] || 0, priceUSD: d.PLANS[id]?.priceUSD || 0 })),
      signups, recentUsers, recentEvents
    });
  });

  // ── Users: list ────────────────────────────────────────────────────────
  function filteredUsers(q) {
    const ls = lastSeenMap();
    const term = String(q.q || '').trim().toLowerCase();
    let rows = d.users().users.filter(u => {
      if (term && !(u.email.includes(term) || u.usernameLower.includes(term) || String(u.displayName || '').toLowerCase().includes(term) || u.id.toLowerCase() === term)) return false;
      if (q.plan && q.plan !== 'all' && (u.plan || 'basic') !== q.plan) return false;
      if (!typeOk(u, q.type)) return false;
      if (q.role && q.role !== 'all' && ((u.role === 'admin' || u.isAdmin === true) ? 'admin' : 'user') !== q.role) return false;
      if (q.status === 'active' && u.suspended) return false;
      if (q.status === 'suspended' && !u.suspended) return false;
      if (q.status === 'unverified' && u.emailVerified) return false;
      if (q.status === 'verified' && !u.emailVerified) return false;
      if (q.status === 'twofa' && !u.totpSecret) return false;
      return true;
    }).map(u => adminRow(u, ls));
    const sort = ['createdAt', 'lastSeen', 'username', 'email', 'plan', 'sessions'].includes(q.sort) ? q.sort : 'createdAt';
    const dir = q.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const va = a[sort] ?? '', vb = b[sort] ?? '';
      if (typeof va === 'number' || typeof vb === 'number') return ((Number(va) || 0) - (Number(vb) || 0)) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return rows;
  }

  app.get('/api/admin/users', (req, res) => {
    if (guard(req, res)) return;
    const rows = filteredUsers(req.query);
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize, 10) || 20));
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
    // testCount: lets the console explain an empty "real users" view instead of looking broken
    const testCount = req.query.type === 'real' ? d.users().users.filter(isTestUser).length : 0;
    res.json({ ok: true, total: rows.length, testCount, page, pages, pageSize, users: rows.slice((page - 1) * pageSize, page * pageSize) });
  });

  app.get('/api/admin/users.csv', (req, res) => {
    if (guard(req, res)) return;
    const rows = filteredUsers(req.query);
    const cols = ['id', 'username', 'email', 'displayName', 'plan', 'role', 'emailVerified', 'totpEnabled', 'suspended', 'isTest', 'createdAt', 'lastSeen', 'sessions'];
    const esc = v => {
      let s = v === null || v === undefined ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV formula-injection guard
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const iso = t => (t ? new Date(t).toISOString() : '');
    const body = [cols.join(',')].concat(rows.map(r => cols.map(c => esc(c === 'createdAt' || c === 'lastSeen' ? iso(r[c]) : r[c])).join(','))).join('\n');
    audit(req, 'users.export', null, { count: rows.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tradingchart-users-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\ufeff' + body);
  });

  // ── Users: detail ──────────────────────────────────────────────────────
  app.get('/api/admin/users/:id', (req, res) => {
    if (guard(req, res)) return;
    const u = findUser(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'user_not_found' });
    const ls = lastSeenMap();
    const now = Date.now();
    const sess = d.sessions().sessions.filter(s => s.userId === u.id && s.expiresAt > now)
      .map(({ id, device, ua, ip, createdAt, lastSeen }) => ({ id, device, ua, ip, createdAt, lastSeen }))
      .sort((a, b) => b.lastSeen - a.lastSeen);
    const rec = d.readState(u.id);
    const st = rec.state || {};
    const count = v => { try { const x = typeof v === 'string' ? JSON.parse(v) : v; if (Array.isArray(x)) return x.length; if (x && Array.isArray(x.lists)) return x.lists.length; if (x && typeof x === 'object') return Object.keys(x).length; } catch (e) { /* raw */ } return 0; };
    const usage = {
      layouts: count(st.layouts), templates: count(st.templates), watchlists: count(st.userWatchlists),
      alerts: count(st.alerts), paperAccounts: count(st.paperAccounts),
      stateBytes: stateBytes(u.id), stateUpdatedAt: rec.updatedAt || 0
    };
    const events = readAudit().filter(e => e.target === u.id).slice(0, 25);
    res.json({ ok: true, user: adminRow(u, ls), sessions: sess, usage, events });
  });

  // ── Users: update (plan / role / status / verification / notes) ────────
  app.patch('/api/admin/users/:id', (req, res) => {
    if (guard(req, res)) return;
    const u = findUser(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'user_not_found' });
    const b = req.body || {};
    const changes = {};
    if (b.plan !== undefined) {
      const pid = String(b.plan);
      if (!d.PLANS[pid]) return res.status(400).json({ ok: false, error: 'unknown_plan' });
      if (pid !== u.plan) { changes.plan = [u.plan, pid]; u.plan = pid; u.planSince = Date.now(); }
    }
    if (b.role !== undefined) {
      const role = b.role === 'admin' ? 'admin' : 'user';
      const cur = (u.role === 'admin' || u.isAdmin === true) ? 'admin' : 'user';
      if (role !== cur) {
        if (role === 'user' && isSelf(req, u)) return res.status(400).json({ ok: false, error: 'cannot_demote_self' });
        changes.role = [cur, role];
        u.role = role; u.isAdmin = role === 'admin';
      }
    }
    if (b.suspended !== undefined) {
      const s = !!b.suspended;
      if (s !== !!u.suspended) {
        if (s && isSelf(req, u)) return res.status(400).json({ ok: false, error: 'cannot_suspend_self' });
        changes.suspended = [!!u.suspended, s];
        u.suspended = s;
        if (s) {
          u.suspendedAt = Date.now();
          u.suspendReason = String(b.suspendReason || '').slice(0, 200);
          d.revokeAllForUser(u.id);
        } else { u.suspendedAt = null; u.suspendReason = ''; }
      }
    }
    if (b.emailVerified !== undefined) {
      const v = !!b.emailVerified;
      if (v !== !!u.emailVerified) { changes.emailVerified = [!!u.emailVerified, v]; u.emailVerified = v; if (v) u.verifyCode = null; }
    }
    if (b.displayName !== undefined) {
      const n = String(b.displayName).trim().slice(0, 64);
      if (!n) return res.status(400).json({ ok: false, error: 'invalid_display_name' });
      if (n !== u.displayName) { changes.displayName = [u.displayName, n]; u.displayName = n; }
    }
    if (b.testAccount !== undefined) {
      // true/false = manual override; null = follow the test-domain rule again
      const v = b.testAccount === null ? undefined : !!b.testAccount;
      if (v !== u.testAccount) { changes.testAccount = [u.testAccount ?? null, v ?? null]; if (v === undefined) delete u.testAccount; else u.testAccount = v; }
    }
    if (b.notes !== undefined) {
      const n = String(b.notes).slice(0, 1000);
      if (n !== (u.notes || '')) { changes.notes = true; u.notes = n; }
    }
    if (!Object.keys(changes).length) return res.json({ ok: true, user: adminRow(u, lastSeenMap()), changed: false });
    d.flushNow();
    audit(req, 'user.update', u.id, { username: u.username, changes });
    res.json({ ok: true, user: adminRow(u, lastSeenMap()), changed: true });
  });

  app.post('/api/admin/users/:id/revoke-sessions', (req, res) => {
    if (guard(req, res)) return;
    const u = findUser(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'user_not_found' });
    const n = d.sessions().sessions.filter(s => s.userId === u.id).length;
    d.revokeAllForUser(u.id); d.flushNow();
    audit(req, 'user.revoke_sessions', u.id, { username: u.username, count: n });
    res.json({ ok: true, revoked: n });
  });

  app.delete('/api/admin/users/:id/sessions/:sid', (req, res) => {
    if (guard(req, res)) return;
    const u = findUser(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'user_not_found' });
    const arr = d.sessions().sessions;
    const i = arr.findIndex(s => s.id === req.params.sid && s.userId === u.id);
    if (i < 0) return res.status(404).json({ ok: false, error: 'session_not_found' });
    arr.splice(i, 1); d.flushNow();
    audit(req, 'user.revoke_session', u.id, { username: u.username, session: req.params.sid });
    res.json({ ok: true });
  });

  app.post('/api/admin/users/:id/reset-2fa', (req, res) => {
    if (guard(req, res)) return;
    const u = findUser(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'user_not_found' });
    if (!u.totpSecret) return res.status(400).json({ ok: false, error: 'twofa_not_enabled' });
    u.totpSecret = null; u.pendingTotpSecret = null; d.flushNow();
    audit(req, 'user.reset_2fa', u.id, { username: u.username });
    res.json({ ok: true });
  });

  app.post('/api/admin/users/:id/send-reset', (req, res) => {
    if (guard(req, res)) return;
    const u = findUser(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'user_not_found' });
    u.resetCode = d.sixDigitCode(); u.resetExpiresAt = Date.now() + 15 * 60000;
    d.outboxPush('reset', u.email, u.resetCode); d.flushNow();
    audit(req, 'user.send_reset', u.id, { username: u.username });
    res.json({ ok: true });
  });

  function deleteUser(u) {
    const store = d.users();
    const idx = store.users.findIndex(x => x.id === u.id);
    if (idx >= 0) store.users.splice(idx, 1);
    d.revokeAllForUser(u.id);
    d.stateCache.delete(u.id);
    try { fs.unlinkSync(d.statePath(u.id)); } catch (e) { /* none */ }
  }

  app.delete('/api/admin/users/:id', (req, res) => {
    if (guard(req, res)) return;
    const u = findUser(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'user_not_found' });
    if (isSelf(req, u)) return res.status(400).json({ ok: false, error: 'cannot_delete_self' });
    if (String(req.body?.confirm || '') !== u.username) return res.status(400).json({ ok: false, error: 'confirm_mismatch' });
    deleteUser(u); d.flushNow();
    audit(req, 'user.delete', u.id, { username: u.username, email: u.email });
    res.json({ ok: true, deleted: u.id });
  });

  // ── Users: bulk actions ────────────────────────────────────────────────
  app.post('/api/admin/users/bulk', (req, res) => {
    if (guard(req, res)) return;
    const { ids, action, plan } = req.body || {};
    if (!Array.isArray(ids) || !ids.length || ids.length > 1000) return res.status(400).json({ ok: false, error: 'invalid_ids' });
    if (!['suspend', 'unsuspend', 'plan', 'delete', 'verify'].includes(action)) return res.status(400).json({ ok: false, error: 'invalid_action' });
    if (action === 'plan' && !d.PLANS[plan]) return res.status(400).json({ ok: false, error: 'unknown_plan' });
    let done = 0, skipped = 0;
    for (const id of ids) {
      const u = findUser(String(id));
      if (!u) { skipped++; continue; }
      if (isSelf(req, u) && (action === 'suspend' || action === 'delete')) { skipped++; continue; }
      if (action === 'suspend') { if (u.suspended) { skipped++; continue; } u.suspended = true; u.suspendedAt = Date.now(); d.revokeAllForUser(u.id); }
      else if (action === 'unsuspend') { if (!u.suspended) { skipped++; continue; } u.suspended = false; u.suspendedAt = null; u.suspendReason = ''; }
      else if (action === 'plan') { if (u.plan === plan) { skipped++; continue; } u.plan = plan; u.planSince = Date.now(); }
      else if (action === 'verify') { if (u.emailVerified) { skipped++; continue; } u.emailVerified = true; u.verifyCode = null; }
      else if (action === 'delete') deleteUser(u);
      done++;
    }
    d.flushNow();
    audit(req, 'users.bulk', null, { action, plan: action === 'plan' ? plan : undefined, done, skipped });
    res.json({ ok: true, done, skipped });
  });

  // ── Audit log ──────────────────────────────────────────────────────────
  app.get('/api/admin/audit', (req, res) => {
    if (guard(req, res)) return;
    const term = String(req.query.q || '').trim().toLowerCase();
    const action = String(req.query.action || '');
    const status = String(req.query.status || '');
    let rows = readAudit();
    const actions = [...new Set(rows.map(r => r.action))].sort();
    rows = rows.filter(r => {
      if (action && action !== 'all' && r.action !== action) return false;
      if (status === 'ok' && !r.ok) return false;
      if (status === 'failed' && r.ok) return false;
      if (term && !JSON.stringify(r).toLowerCase().includes(term)) return false;
      return true;
    });
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize, 10) || 25));
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
    res.json({ ok: true, total: rows.length, page, pages, pageSize, actions, events: rows.slice((page - 1) * pageSize, page * pageSize) });
  });

  // ── Admin sessions (master-key unlocks) ────────────────────────────────
  app.get('/api/admin/sessions', (req, res) => {
    if (guard(req, res)) return;
    const cur = req.adminSession?.id || null;
    res.json({ ok: true, sessions: listAdminSessions().map(r => ({ ...r, current: r.id === cur })) });
  });
  app.delete('/api/admin/sessions/:id', (req, res) => {
    if (guard(req, res)) return;
    const ok = revokeAdminSessionById(String(req.params.id));
    if (!ok) return res.status(404).json({ ok: false, error: 'session_not_found' });
    audit(req, 'admin.revoke_session', null, { session: req.params.id });
    if (req.adminSession?.id === req.params.id) clearAdminCookie(res);
    res.json({ ok: true, self: req.adminSession?.id === req.params.id });
  });

  // ── Platform settings (registration, announcement, test domains) ──────
  app.get('/api/admin/settings', (req, res) => {
    if (guard(req, res)) return;
    res.json({ ok: true, settings: getPlatformSettings() });
  });
  app.put('/api/admin/settings', (req, res) => {
    if (guard(req, res)) return;
    const r = updatePlatformSettings(req.body || {});
    if (!r.ok) return res.status(400).json(r);
    if (r.changed.length) audit(req, 'settings.update', null, { fields: r.changed });
    res.json({ ok: true, settings: r.settings, changed: r.changed });
  });

  // ── System: health, outbox ─────────────────────────────────────────────
  app.get('/api/admin/system', (req, res) => {
    if (guard(req, res)) return;
    let stateBytesTotal = 0, stateFiles = 0;
    try {
      for (const f of fs.readdirSync(d.STATE_DIR)) {
        try { stateBytesTotal += fs.statSync(path.join(d.STATE_DIR, f)).size; stateFiles++; } catch (e) { /* race */ }
      }
    } catch (e) { /* none */ }
    const mem = process.memoryUsage();
    const now = Date.now();
    res.json({
      ok: true,
      server: {
        uptimeSec: Math.round(process.uptime()), bootAt: BOOT_AT, node: process.version,
        rssMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576),
        load: os.loadavg().map(x => Math.round(x * 100) / 100), cpus: os.cpus().length,
        memTotalMB: Math.round(os.totalmem() / 1048576), memFreeMB: Math.round(os.freemem() / 1048576),
        keySource: process.env.TRADINGCHART_MASTER_KEY ? 'env' : 'file'
      },
      storage: {
        users: d.users().users.length,
        sessions: d.sessions().sessions.filter(s => s.expiresAt > now).length,
        stateFiles, stateBytes: stateBytesTotal
      },
      outbox: d.outboxAll().slice(0, 30)
    });
  });
}
