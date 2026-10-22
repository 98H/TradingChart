// server/adminAuth.js
// Back-office authentication + audit trail for the TradingChart admin console.
//
// Security model
//  • The master key is NEVER shipped to the browser. It comes from the
//    TRADINGCHART_MASTER_KEY env var or, if unset, from a random secret
//    generated on first boot at server/data/admin_master.key (mode 600).
//  • Unlocking with the key mints a short-lived admin session (HttpOnly
//    `tc_admin` cookie). The raw key is never stored client-side.
//  • Accounts with role=admin (and not suspended) are admins on their session.
//  • `X-Master-Key` header remains for server-to-server / automation use.
//    Query-string keys are refused (they leak into logs and history).
//  • Every privileged action is appended to an audit log (JSONL, rotated).

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const ACC_DIR = path.join(DATA_DIR, 'accounts');
const KEY_FILE = path.join(DATA_DIR, 'admin_master.key');
const ADMIN_SESSIONS_FILE = path.join(ACC_DIR, 'admin_sessions.json');
export const AUDIT_FILE = path.join(ACC_DIR, 'audit.jsonl');

export const ADMIN_COOKIE = 'tc_admin';
export const ADMIN_SESSION_TTL_MS = 12 * 3600 * 1000; // 12h
const AUDIT_MAX_BYTES = 2 * 1024 * 1024;

for (const d of [DATA_DIR, ACC_DIR]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

function loadMasterKey() {
  const env = String(process.env.TRADINGCHART_MASTER_KEY || '').trim();
  if (env) return env;
  try {
    const k = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (k.length >= 16) return k;
  } catch (e) { /* first boot */ }
  const k = crypto.randomBytes(24).toString('base64url');
  fs.writeFileSync(KEY_FILE, k + '\n', { mode: 0o600 });
  console.log(`[admin] generated new master key → ${KEY_FILE}`);
  return k;
}
export const MASTER_KEY = loadMasterKey();

export function keyMatches(candidate) {
  if (!candidate) return false;
  const a = crypto.createHash('sha256').update(String(candidate).trim()).digest();
  const b = crypto.createHash('sha256').update(MASTER_KEY).digest();
  return crypto.timingSafeEqual(a, b);
}

// ── Admin sessions (token → row) ───────────────────────────────────────────
let _adminSessions = null;
function adminSessions() {
  if (_adminSessions) return _adminSessions;
  try { _adminSessions = JSON.parse(fs.readFileSync(ADMIN_SESSIONS_FILE, 'utf8')); } catch (e) { _adminSessions = { sessions: [] }; }
  if (!Array.isArray(_adminSessions.sessions)) _adminSessions.sessions = [];
  return _adminSessions;
}
function saveAdminSessions() {
  const now = Date.now();
  const s = adminSessions();
  s.sessions = s.sessions.filter(r => r.expiresAt > now);
  const tmp = ADMIN_SESSIONS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(s), { mode: 0o600 });
  fs.renameSync(tmp, ADMIN_SESSIONS_FILE);
}
const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

export function createAdminSession(req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const row = {
    id: 'as_' + crypto.randomBytes(6).toString('hex'),
    tokenHash: hashToken(token),
    ip: req.ip || '', ua: String(req.headers['user-agent'] || '').slice(0, 160),
    userId: req.user?.id || null,
    createdAt: Date.now(), expiresAt: Date.now() + ADMIN_SESSION_TTL_MS
  };
  adminSessions().sessions.push(row);
  saveAdminSessions();
  return { token, row };
}
export function findAdminSession(token) {
  if (!token) return null;
  const h = hashToken(token);
  const row = adminSessions().sessions.find(r => r.tokenHash === h);
  if (!row) return null;
  if (Date.now() > row.expiresAt) return null;
  return row;
}
export function revokeAdminSession(token) {
  const h = hashToken(token);
  const s = adminSessions();
  const n = s.sessions.length;
  s.sessions = s.sessions.filter(r => r.tokenHash !== h);
  if (s.sessions.length !== n) saveAdminSessions();
}
export function listAdminSessions() {
  const now = Date.now();
  return adminSessions().sessions.filter(r => r.expiresAt > now)
    .map(({ id, ip, ua, userId, createdAt, expiresAt }) => ({ id, ip, ua, userId, createdAt, expiresAt }))
    .sort((x, y) => y.createdAt - x.createdAt);
}
export function revokeAdminSessionById(id) {
  const s = adminSessions();
  const n = s.sessions.length;
  s.sessions = s.sessions.filter(r => r.id !== id);
  if (s.sessions.length === n) return false;
  saveAdminSessions();
  return true;
}
export function setAdminCookie(res, token) {
  appendSetCookie(res, `${ADMIN_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}${res.req && res.req.secure ? '; Secure' : ''}`);
}
export function clearAdminCookie(res) {
  appendSetCookie(res, `${ADMIN_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${res.req && res.req.secure ? '; Secure' : ''}`);
}
function appendSetCookie(res, v) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', v);
  else res.setHeader('Set-Cookie', Array.isArray(prev) ? [...prev, v] : [prev, v]);
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return part.slice(i + 1).trim(); }
    }
  }
  return null;
}

/** Resolve how (if at all) this request is privileged. */
// Header-key brute-force guard: /api/admin/auth is rate-limited, but the
// automation header is accepted on EVERY admin endpoint — without this an
// attacker could guess keys there unthrottled. >10 bad keys/min per IP locks
// header auth (even a correct key) for that IP until the window rolls over.
const KEY_FAIL_MAX = 10, KEY_FAIL_WINDOW_MS = 60000;
const keyFails = new Map(); // ip -> [timestamps]
function keyLocked(ip) {
  const now = Date.now();
  const arr = (keyFails.get(ip) || []).filter(t => now - t < KEY_FAIL_WINDOW_MS);
  if (arr.length) keyFails.set(ip, arr); else keyFails.delete(ip);
  return arr.length >= KEY_FAIL_MAX;
}
function noteKeyFail(ip) {
  const arr = keyFails.get(ip) || [];
  arr.push(Date.now());
  keyFails.set(ip, arr.slice(-KEY_FAIL_MAX));
}
const keyFailGc = setInterval(() => { for (const ip of [...keyFails.keys()]) keyLocked(ip); }, 5 * 60000);
if (keyFailGc.unref) keyFailGc.unref();

export function adminVia(req) {
  if (req.user && !req.user.suspended && (req.user.role === 'admin' || req.user.isAdmin === true)) return 'role';
  // A session minted during THIS request (successful unlock) counts as token auth.
  if (req.adminSession && req.adminSession.expiresAt > Date.now()) return 'token';
  const row = findAdminSession(readCookie(req, ADMIN_COOKIE));
  if (row) { req.adminSession = row; return 'token'; }
  // Automation: header only (never body/query — bodies get logged and replayed).
  const hdr = req.headers['x-master-key'];
  if (hdr) {
    const ip = req.ip || 'unknown';
    if (keyLocked(ip)) return null;
    if (keyMatches(hdr)) return 'key';
    noteKeyFail(ip);
  }
  return null;
}
export function isReqAdmin(req) { return adminVia(req) !== null; }
export function adminTokenFrom(req) { return readCookie(req, ADMIN_COOKIE); }

export function actorOf(req) {
  const via = adminVia(req);
  if (via === 'role') return { via, id: req.user.id, label: req.user.username };
  if (via === 'token') return { via, id: req.adminSession.id, label: req.user ? `${req.user.username} (key)` : `admin-session ${req.adminSession.id.slice(3, 9)}` };
  if (via === 'key') return { via, id: 'master-key', label: 'master-key' };
  return { via: null, id: null, label: req.user?.username || 'guest' };
}

// ── Audit trail ───────────────────────────────────────────────────────────
export function audit(req, action, target = null, meta = null, ok = true) {
  try {
    const a = actorOf(req);
    const rec = {
      id: 'ev_' + crypto.randomBytes(6).toString('hex'),
      at: Date.now(), action, ok,
      actor: a.label, actorVia: a.via, ip: req.ip || '',
      target: target || null, meta: meta || null
    };
    try {
      const st = fs.statSync(AUDIT_FILE);
      if (st.size > AUDIT_MAX_BYTES) {
        // keep the newest half when rotating
        const lines = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n');
        fs.writeFileSync(AUDIT_FILE, lines.slice(Math.floor(lines.length / 2)).join('\n') + '\n', { mode: 0o600 });
      }
    } catch (e) { /* no file yet */ }
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(rec) + '\n', { mode: 0o600 });
    return rec;
  } catch (e) {
    console.error('[admin] audit write failed:', e.message);
    return null;
  }
}
export function readAudit() {
  try {
    return fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch (e) { return null; } })
      .filter(Boolean).reverse();
  } catch (e) { return []; }
}
