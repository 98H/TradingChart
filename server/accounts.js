// server/accounts.js
// TradingChart Account System — TradingView-parity accounts, plan tiers, cloud sync.
// Zero external dependencies: node:crypto scrypt + atomic JSON stores.

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data', 'accounts');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const OUTBOX_FILE = path.join(DATA_DIR, 'outbox.json');
const STATE_DIR = path.join(DATA_DIR, 'states');

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days
const STATE_MAX_BYTES = 2 * 1024 * 1024;      // 2MB cloud state budget
const SESSION_COOKIE = 'tc_session';

// ── Plan tiers (TradingView-parity entitlement matrix) ────────────────────
export const PLAN_ORDER = ['basic', 'essential', 'plus', 'premium', 'ultimate'];
export const PLANS = {
  basic: {
    id: 'basic', priceUSD: 0,
    chartsPerTab: 1, savedLayouts: 1, indicatorsPerChart: 2, indicatorsOnIndicator: 1,
    savedTemplates: 1, watchlists: 1, watchlistSymbols: 30, flagColors: 1,
    priceAlerts: 3, technicalAlerts: 0, watchlistAlerts: 0, alertDays: 30,
    webhookAlerts: false, multiCondAlerts: false,
    paperAccounts: 1, holdingsPerAccount: 20,
    histBars: 10000, secondIntervals: false, tickIntervals: false, customIntervals: false,
    synthChartTypes: false, dataExport: false, multiTfAnalysis: false,
    barReplayMinuteDays: 180, barReplaySecond: false,
    deepBacktest: false, advancedReport: false, csvTradesExport: false, xlsxReport: false,
    screenerAutoRefreshSec: 60, aiScreenerReq: 100, pineTimeLimitSec: 20,
    marketSubscriptions: 2
  },
  essential: {
    id: 'essential', priceUSD: 12.95,
    chartsPerTab: 2, savedLayouts: 5, indicatorsPerChart: 5, indicatorsOnIndicator: 1,
    savedTemplates: 5, watchlists: 5, watchlistSymbols: 1000, flagColors: 7,
    priceAlerts: 20, technicalAlerts: 20, watchlistAlerts: 0, alertDays: 60,
    webhookAlerts: false, multiCondAlerts: false,
    paperAccounts: 3, holdingsPerAccount: 50,
    histBars: 10000, secondIntervals: true, tickIntervals: false, customIntervals: true,
    synthChartTypes: false, dataExport: true, multiTfAnalysis: true,
    barReplayMinuteDays: 365, barReplaySecond: false,
    deepBacktest: false, advancedReport: false, csvTradesExport: false, xlsxReport: false,
    screenerAutoRefreshSec: 60, aiScreenerReq: 150, pineTimeLimitSec: 40,
    marketSubscriptions: 4
  },
  plus: {
    id: 'plus', priceUSD: 29.95,
    chartsPerTab: 4, savedLayouts: 10, indicatorsPerChart: 10, indicatorsOnIndicator: 9,
    savedTemplates: 10, watchlists: 10, watchlistSymbols: 1000, flagColors: 7,
    priceAlerts: 100, technicalAlerts: 100, watchlistAlerts: 2, alertDays: 60,
    webhookAlerts: true, multiCondAlerts: true,
    paperAccounts: 4, holdingsPerAccount: 75,
    histBars: 10000, secondIntervals: true, tickIntervals: false, customIntervals: true,
    synthChartTypes: true, dataExport: true, multiTfAnalysis: true,
    barReplayMinuteDays: -1, barReplaySecond: true,
    deepBacktest: false, advancedReport: true, csvTradesExport: true, xlsxReport: false,
    screenerAutoRefreshSec: 10, aiScreenerReq: 250, pineTimeLimitSec: 40,
    marketSubscriptions: 6
  },
  premium: {
    id: 'premium', priceUSD: 59.95,
    chartsPerTab: 8, savedLayouts: -1, indicatorsPerChart: 25, indicatorsOnIndicator: 24,
    savedTemplates: 20, watchlists: 20, watchlistSymbols: 1000, flagColors: 7,
    priceAlerts: 400, technicalAlerts: 400, watchlistAlerts: 2, alertDays: -1,
    webhookAlerts: true, multiCondAlerts: true,
    paperAccounts: 5, holdingsPerAccount: 100,
    histBars: 20000, secondIntervals: true, tickIntervals: true, customIntervals: true,
    synthChartTypes: true, dataExport: true, multiTfAnalysis: true,
    barReplayMinuteDays: -1, barReplaySecond: true,
    deepBacktest: true, advancedReport: true, csvTradesExport: true, xlsxReport: true,
    screenerAutoRefreshSec: 10, aiScreenerReq: 500, pineTimeLimitSec: 40,
    marketSubscriptions: 6
  },
  ultimate: {
    id: 'ultimate', priceUSD: 199.95,
    chartsPerTab: 16, savedLayouts: -1, indicatorsPerChart: 50, indicatorsOnIndicator: 49,
    savedTemplates: 30, watchlists: 30, watchlistSymbols: 1000, flagColors: 7,
    priceAlerts: 1000, technicalAlerts: 1000, watchlistAlerts: 15, alertDays: -1,
    webhookAlerts: true, multiCondAlerts: true,
    paperAccounts: 7, holdingsPerAccount: 150,
    histBars: 40000, secondIntervals: true, tickIntervals: true, customIntervals: true,
    synthChartTypes: true, dataExport: true, multiTfAnalysis: true,
    barReplayMinuteDays: -1, barReplaySecond: true,
    deepBacktest: true, advancedReport: true, csvTradesExport: true, xlsxReport: true,
    screenerAutoRefreshSec: 10, aiScreenerReq: 1000, pineTimeLimitSec: 100,
    marketSubscriptions: 200
  }
};
export const UNLIMITED = -1;

// ── Atomic JSON store ─────────────────────────────────────────────────────
function ensureDirs() {
  for (const d of [DATA_DIR, STATE_DIR]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
ensureDirs();

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`[accounts] corrupt store ${path.basename(file)}: ${e.message}`);
    return fallback;
  }
}

let _users = null, _sessions = null, _flushTimer = null;
function users() {
  if (_users === null) _users = readJson(USERS_FILE, { users: [] });
  return _users;
}
function sessions() {
  if (_sessions === null) _sessions = readJson(SESSIONS_FILE, { sessions: [] });
  return _sessions;
}
function atomicWrite(file, obj) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1));
  fs.renameSync(tmp, file);
}
function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => { _flushTimer = null; flushNow(); }, 150);
  if (_flushTimer.unref) _flushTimer.unref();
}
function flushNow() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  try {
    atomicWrite(USERS_FILE, users());
    atomicWrite(SESSIONS_FILE, sessions());
  } catch (e) { console.error('[accounts] flush failed:', e.message); }
}

// ── Password hashing (scrypt) ─────────────────────────────────────────────
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  try {
    const candidate = crypto.scryptSync(String(password), salt, 64);
    const stored = Buffer.from(hash, 'hex');
    return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
  } catch (e) { return false; }
}
const sixDigitCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// ── Validation ────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

function normalizeEmail(v) { return String(v || '').trim().toLowerCase(); }
function passwordOk(pw) {
  pw = String(pw || '');
  if (pw.length < 8 || pw.length > 128) return false;
  return /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}
function validateRegistration({ email, username, password }) {
  const errors = [];
  if (!EMAIL_RE.test(email || '')) errors.push({ field: 'email', code: 'invalid_email' });
  if (!USERNAME_RE.test(username || '')) errors.push({ field: 'username', code: 'invalid_username' });
  if (!passwordOk(password)) errors.push({ field: 'password', code: password.length > 128 ? 'password_length' : 'password_weak' });
  return errors;
}

// ── Rate limiting (sliding window, per IP+action) ─────────────────────────
const rateBuckets = new Map();
function isRateLimited(ip, action, max, windowMs) {
  const key = `${ip}:${action}`;
  const now = Date.now();
  const arr = (rateBuckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { rateBuckets.set(key, arr); return true; }
  arr.push(now);
  rateBuckets.set(key, arr);
  if (rateBuckets.size > 5000) rateBuckets.clear();
  return false;
}
function rateGate(req, res, action, max, windowMs) {
  if (isRateLimited(req.ip || 'unknown', action, max, windowMs)) {
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return true;
  }
  return false;
}

// ── Outbox (self-hosted delivery of verification/reset codes) ─────────────
function outboxPush(kind, email, code) {
  try {
    const box = readJson(OUTBOX_FILE, { messages: [] });
    box.messages.unshift({ id: crypto.randomUUID(), kind, email, code, at: new Date().toISOString() });
    if (box.messages.length > 200) box.messages.length = 200;
    fs.writeFileSync(OUTBOX_FILE, JSON.stringify(box, null, 1));
  } catch (e) { console.error('[accounts] outbox write failed:', e.message); }
}
export function outboxRead(email, kind) {
  const box = readJson(OUTBOX_FILE, { messages: [] });
  return box.messages.find(m => m.email === email && (!kind || m.kind === kind)) || null;
}

// ── User cloud-state store ────────────────────────────────────────────────
const stateCache = new Map(); // userId -> {state, updatedAt}
function statePath(userId) { return path.join(STATE_DIR, `state_${userId}.json`); }
function readState(userId) {
  if (stateCache.has(userId)) return stateCache.get(userId);
  const raw = readJson(statePath(userId), null);
  const rec = raw || { state: {}, updatedAt: 0 };
  stateCache.set(userId, rec);
  return rec;
}
function writeState(userId, state, updatedAt) {
  const rec = { state, updatedAt };
  stateCache.set(userId, rec);
  atomicWrite(statePath(userId), rec);
}

// Per-plan server-side enforcement of cloud-state array limits.
const STATE_LIMITS = {
  layouts: 'savedLayouts', templates: 'savedTemplates', userWatchlists: 'watchlists',
  alerts: 'priceAlerts', paperAccounts: 'paperAccounts'
};
function countOf(v) {
  if (v === null || v === undefined) return 0;
  // Cloud-state values arrive as raw localStorage strings — parse before counting.
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (e) { return 0; }
  }
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') {
    if (Array.isArray(v.items)) return v.items.length;
    if (Array.isArray(v.lists)) return v.lists.length; // multi-watchlist envelope
    return Object.keys(v).length;
  }
  return 0;
}
function validateStateAgainstPlan(state, planId) {
  const plan = PLANS[planId] || PLANS.basic;
  const violations = [];
  for (const [key, entKey] of Object.entries(STATE_LIMITS)) {
    const max = plan[entKey];
    if (max === UNLIMITED || !state) continue;
    const n = countOf(state[key]);
    if (n > max) violations.push({ key, limit: max, current: n });
  }
  return violations;
}

// ── Cookie helpers ────────────────────────────────────────────────────────
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setSessionCookie(res, token, maxAgeMs) {
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

// ── Sessions table ops ────────────────────────────────────────────────────
function createSessionRow(user, req) {
  const ua = String(req.headers['user-agent'] || '').slice(0, 180);
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const device = isMobile ? 'Mobile Browser' : 'Desktop Browser';
  return {
    id: 's_' + crypto.randomUUID(),
    token: crypto.randomBytes(32).toString('base64url'),
    userId: user.id,
    device, ua, ip: req.ip || '',
    createdAt: Date.now(), lastSeen: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };
}
function findSessionByToken(token) {
  return sessions().sessions.find(s => s.token === token) || null;
}
function addSessionRow(row) { sessions().sessions.push(row); }
function removeSessionByToken(token) {
  const arr = sessions().sessions;
  const i = arr.findIndex(s => s.token === token);
  if (i >= 0) arr.splice(i, 1);
}
function sessionsForUser(userId) { return sessions().sessions.filter(s => s.userId === userId); }
function revokeAllForUser(userId) {
  const arr = sessions().sessions;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].userId === userId) arr.splice(i, 1);
}

// ── Public shapes ─────────────────────────────────────────────────────────
function publicUser(u) {
  return {
    id: u.id, email: u.email, username: u.username, displayName: u.displayName,
    bio: u.bio || '', avatarPreset: u.avatarPreset || 'mecha',
    plan: u.plan || 'basic', planSince: u.planSince || null,
    emailVerified: !!u.emailVerified, createdAt: u.createdAt,
    timezone: u.timezone || 'UTC', currency: u.currency || 'USD'
  };
}
function computeUsage(u) {
  const rec = readState(u.id);
  const st = rec.state || {};
  return {
    layouts: countOf(st.layouts), templates: countOf(st.templates),
    watchlists: countOf(st.userWatchlists), alerts: countOf(st.alerts),
    paperAccounts: countOf(st.paperAccounts),
    stateBytes: Buffer.byteLength(JSON.stringify(st)),
    stateUpdatedAt: rec.updatedAt || 0
  };
}

// ── Router mount ──────────────────────────────────────────────────────────
export function mountAccountSystem(app) {
  const router = express.Router();

  // Attach user + session row to req from the session cookie (null if guest).
  app.use((req, res, next) => {
    req.user = null; req.sessionRow = null;
    const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
    if (token) {
      const row = findSessionByToken(token);
      if (row) {
        if (Date.now() > row.expiresAt) {
          removeSessionByToken(row.token); scheduleFlush();
        } else {
          const u = users().users.find(x => x.id === row.userId);
          if (u) {
            req.user = u; req.sessionRow = row;
            row.lastSeen = Date.now();
          }
        }
      }
    }
    next();
  });

  // ── Register ────────────────────────────────────────────────────────────
  router.post('/register', (req, res) => {
    if (rateGate(req, res, 'register', 5, 60000)) return;
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const username = String(body.username || '').trim();
    const errors = validateRegistration({ email, username, password: body.password });
    if (errors.length) return res.status(400).json({ ok: false, errors });
    if (users().users.some(u => u.email === email))
      return res.status(409).json({ ok: false, errors: [{ field: 'email', code: 'email_taken' }] });
    if (users().users.some(u => u.usernameLower === username.toLowerCase()))
      return res.status(409).json({ ok: false, errors: [{ field: 'username', code: 'username_taken' }] });

    const { salt, hash } = hashPassword(body.password);
    const u = {
      id: 'u_' + crypto.randomUUID(),
      email, username, usernameLower: username.toLowerCase(),
      displayName: String(body.displayName || username).slice(0, 64),
      salt, hash,
      plan: 'basic', planSince: Date.now(),
      emailVerified: false,
      verifyCode: sixDigitCode(), verifySentAt: Date.now(),
      avatarPreset: 'mecha', bio: '',
      createdAt: Date.now()
    };
    users().users.push(u);
    outboxPush('verify', email, u.verifyCode);
    flushNow();
    const row = createSessionRow(u, req);
    addSessionRow(row); flushNow();
    setSessionCookie(res, row.token, SESSION_TTL_MS);
    res.json({ ok: true, user: publicUser(u), needsVerification: true });
  });

  // ── Login ───────────────────────────────────────────────────────────────
  router.post('/login', (req, res) => {
    if (rateGate(req, res, 'login', 10, 60000)) return;
    const body = req.body || {};
    const identity = String(body.identity || '').trim().toLowerCase();
    const u = users().users.find(x => x.email === identity || x.usernameLower === identity);
    if (!u || !verifyPassword(String(body.password || ''), u.salt, u.hash)) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    }
    const row = createSessionRow(u, req);
    addSessionRow(row); flushNow();
    setSessionCookie(res, row.token, SESSION_TTL_MS);
    res.json({ ok: true, user: publicUser(u) });
  });

  // ── Logout / logout-everywhere ──────────────────────────────────────────
  router.post('/logout', (req, res) => {
    if (req.sessionRow) { removeSessionByToken(req.sessionRow.token); flushNow(); }
    clearSessionCookie(res);
    res.json({ ok: true });
  });
  router.post('/logout-all', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    revokeAllForUser(req.user.id);
    flushNow();
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // ── Me / profile update ─────────────────────────────────────────────────
  router.get('/me', (req, res) => {
    if (!req.user) return res.json({ ok: true, user: null });
    res.json({ ok: true, user: publicUser(req.user), sessionId: req.sessionRow?.id });
  });

  router.patch('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const b = req.body || {};
    const u = req.user;
    if (b.username !== undefined) {
      const uname = String(b.username).trim();
      if (!USERNAME_RE.test(uname))
        return res.status(400).json({ ok: false, errors: [{ field: 'username', code: 'invalid_username' }] });
      if (users().users.some(x => x.id !== u.id && x.usernameLower === uname.toLowerCase()))
        return res.status(409).json({ ok: false, errors: [{ field: 'username', code: 'username_taken' }] });
      u.username = uname; u.usernameLower = uname.toLowerCase();
    }
    if (b.displayName !== undefined) u.displayName = String(b.displayName).slice(0, 64);
    if (b.bio !== undefined) u.bio = String(b.bio).slice(0, 280);
    if (b.avatarPreset !== undefined) u.avatarPreset = String(b.avatarPreset).slice(0, 24);
    if (b.timezone !== undefined) u.timezone = String(b.timezone).slice(0, 48);
    if (b.currency !== undefined) u.currency = String(b.currency).slice(0, 8);
    if (b.email !== undefined) {
      const email = normalizeEmail(b.email);
      if (!EMAIL_RE.test(email))
        return res.status(400).json({ ok: false, errors: [{ field: 'email', code: 'invalid_email' }] });
      if (users().users.some(x => x.id !== u.id && x.email === email))
        return res.status(409).json({ ok: false, errors: [{ field: 'email', code: 'email_taken' }] });
      if (email !== u.email) {
        u.email = email; u.emailVerified = false;
        u.verifyCode = sixDigitCode(); u.verifySentAt = Date.now();
        outboxPush('verify', email, u.verifyCode);
      }
    }
    flushNow();
    res.json({ ok: true, user: publicUser(u) });
  });

  // ── Password management ─────────────────────────────────────────────────
  router.post('/change-password', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { current, next } = req.body || {};
    if (!verifyPassword(String(current || ''), req.user.salt, req.user.hash))
      return res.status(400).json({ ok: false, error: 'invalid_current' });
    if (!passwordOk(next)) return res.status(400).json({ ok: false, error: 'password_weak' });
    const { salt, hash } = hashPassword(next);
    req.user.salt = salt; req.user.hash = hash;
    // Security parity: invalidate every other device session.
    const keep = req.sessionRow ? req.sessionRow.token : null;
    revokeAllForUser(req.user.id);
    const row = createSessionRow(req.user, req);
    if (keep) row.token = keep; // keep the current device signed in
    addSessionRow(row);
    flushNow();
    setSessionCookie(res, row.token, SESSION_TTL_MS);
    res.json({ ok: true });
  });

  router.post('/request-reset', (req, res) => {
    if (rateGate(req, res, 'reset', 5, 60000)) return;
    const email = normalizeEmail(req.body?.email);
    const u = users().users.find(x => x.email === email);
    if (u) {
      u.resetCode = sixDigitCode();
      u.resetExpiresAt = Date.now() + 15 * 60000;
      outboxPush('reset', email, u.resetCode);
      flushNow();
    }
    res.json({ ok: true }); // never reveal account existence
  });

  router.post('/reset', (req, res) => {
    if (rateGate(req, res, 'reset', 10, 60000)) return;
    const { identity, code, password } = req.body || {};
    const id = normalizeEmail(identity);
    const u = users().users.find(x => x.email === id || x.usernameLower === id);
    if (!u || !u.resetCode || String(u.resetCode) !== String(code || '') || Date.now() > (u.resetExpiresAt || 0)) {
      return res.status(400).json({ ok: false, error: 'invalid_code' });
    }
    if (!passwordOk(password)) return res.status(400).json({ ok: false, error: 'password_weak' });
    const { salt, hash } = hashPassword(password);
    u.salt = salt; u.hash = hash; u.resetCode = null;
    revokeAllForUser(u.id); // reset forces re-login everywhere
    flushNow();
    res.json({ ok: true });
  });

  // ── Email verification ──────────────────────────────────────────────────
  router.post('/request-verify', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    if (rateGate(req, res, 'verify', 3, 60000)) return;
    req.user.verifyCode = sixDigitCode();
    req.user.verifySentAt = Date.now();
    outboxPush('verify', req.user.email, req.user.verifyCode);
    flushNow();
    res.json({ ok: true });
  });

  router.post('/verify', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const code = String(req.body?.code || '').trim();
    if (!req.user.verifyCode || code !== req.user.verifyCode || Date.now() - req.user.verifySentAt > 15 * 60000) {
      return res.status(400).json({ ok: false, error: 'invalid_code' });
    }
    req.user.emailVerified = true;
    req.user.verifyCode = null;
    flushNow();
    res.json({ ok: true, user: publicUser(req.user) });
  });

  app.use('/api/auth', router);

  // ── Housekeeping: drop expired sessions hourly so the store stays small ──
  const gcExpiredSessions = () => {
    try {
      const now = Date.now();
      const ss = sessions();
      const keep = ss.sessions.filter(s => s.expiresAt > now);
      if (keep.length !== ss.sessions.length) {
        const dropped = ss.sessions.length - keep.length;
        ss.sessions = keep;
        atomicWrite(SESSIONS_FILE, ss);
        console.log(`[accounts] GC: dropped ${dropped} expired sessions`);
      }
    } catch (e) { /* non-fatal */ }
  };
  gcExpiredSessions();
  const gcTimer = setInterval(gcExpiredSessions, 3600 * 1000);
  if (gcTimer.unref) gcTimer.unref();

  // ── Cloud state sync (per-user workspace blob) ──────────────────────────
  app.get('/api/user/state', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const rec = readState(req.user.id);
    res.json({ ok: true, state: rec.state || {}, updatedAt: rec.updatedAt || 0, plan: req.user.plan });
  });

  app.put('/api/user/state', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { state, baseUpdatedAt } = req.body || {};
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ ok: false, error: 'invalid_state' });
    }
    try {
      if (Buffer.byteLength(JSON.stringify(state)) > STATE_MAX_BYTES) {
        return res.status(413).json({ ok: false, error: 'state_too_large' });
      }
    } catch (e) { return res.status(400).json({ ok: false, error: 'invalid_state' }); }
    const violations = validateStateAgainstPlan(state, req.user.plan);
    if (violations.length) {
      return res.status(403).json({ ok: false, error: 'limit_exceeded', violations });
    }
    const current = readState(req.user.id);
    // Optimistic concurrency: stale base → 409 with the server copy for merge review.
    if (baseUpdatedAt && current.updatedAt > baseUpdatedAt) {
      return res.status(409).json({
        ok: false, error: 'conflict',
        serverUpdatedAt: current.updatedAt, serverState: current.state
      });
    }
    const updatedAt = Date.now();
    writeState(req.user.id, state, updatedAt);
    res.json({ ok: true, updatedAt });
  });

  // ── Device/session management ───────────────────────────────────────────
  app.get('/api/user/sessions', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const now = Date.now();
    const list = sessions().sessions
      .filter(s => s.userId === req.user.id && s.expiresAt > now)
      .map(s => ({
        id: s.id, device: s.device, ua: s.ua, ip: s.ip,
        createdAt: s.createdAt, lastSeen: s.lastSeen,
        current: s.token === req.sessionRow?.token
      }));
    res.json({ ok: true, sessions: list });
  });

  app.delete('/api/user/sessions/:sid', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const row = sessions().sessions.find(s => s.id === req.params.sid && s.userId === req.user.id);
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    removeSessionByToken(row.token);
    flushNow();
    res.json({ ok: true });
  });

  // ── Privacy: full data export (TradingView "Download your data" parity) ──
  app.get('/api/user/export', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const u = req.user;
    const rec = readState(u.id);
    const allSessions = sessions().sessions
      .filter(s => s.userId === u.id)
      .map(({ id, device, ua, ip, createdAt, lastSeen }) => ({ id, device, ua, ip, createdAt, lastSeen }));
    const { salt, hash, ...safeUser } = u;
    res.json({ ok: true, exportedAt: new Date().toISOString(), user: safeUser, state: rec.state || {}, sessions: allSessions });
  });

  // ── Danger zone: permanent account deletion (requires current password) ──
  app.delete('/api/auth/me', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    if (rateGate(req, res, 'delete_account', 3, 60000)) return;
    if (!verifyPassword(String(req.body?.password || ''), req.user.salt, req.user.hash)) {
      return res.status(401).json({ ok: false, errors: [{ field: 'password', code: 'invalid_credentials' }] });
    }
    const uid = req.user.id;
    const store = users();
    const idx = store.users.findIndex(u => u.id === uid);
    if (idx >= 0) { store.users.splice(idx, 1); atomicWrite(USERS_FILE, store); }
    // drop all sessions belonging to the account
    const ss = sessions();
    ss.sessions = ss.sessions.filter(s => s.userId !== uid);
    atomicWrite(SESSIONS_FILE, ss);
    // drop cloud state
    try { fs.unlinkSync(statePath(uid)); } catch (e) { /* already gone */ }
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true, deleted: true });
  });

  // ── Plans (entitlement matrix + usage) ──────────────────────────────────
  app.get('/api/plans', (req, res) => {
    res.json({
      ok: true,
      plans: Object.fromEntries(Object.entries(PLANS).map(([id, p]) => [id, { ...p }])),
      current: req.user ? (req.user.plan || 'basic') : null,
      usage: req.user ? computeUsage(req.user) : null
    });
  });

  // Simulated billing (self-hosted product): switch plan instantly.
  app.post('/api/user/plan', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const planId = String(req.body?.plan || '');
    if (!PLANS[planId]) return res.status(400).json({ ok: false, error: 'unknown_plan' });
    req.user.plan = planId;
    req.user.planSince = Date.now();
    flushNow();
    res.json({ ok: true, user: publicUser(req.user), entitlements: PLANS[planId] });
  });

  return { flushNow };
}
