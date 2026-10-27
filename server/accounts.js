// server/accounts.js
// TradingChart Account System — TradingView-parity accounts, plan tiers, cloud sync.
// Zero external dependencies: node:crypto scrypt + atomic JSON stores.

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { FEATURES_CATALOG, CATEGORIES } from './featuresCatalog.js';
import { isReqAdmin, audit } from './adminAuth.js';
import { mountAdminApi } from './adminApi.js';
import { mountTradeRelay } from './tradeRelayApi.js';
import { initMailer, mailEnabled, sendCode } from './mailer.js';
import { getPlatformSettings, publicPlatformInfo } from './platformSettings.js';
export { isReqAdmin };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data', 'accounts');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const OUTBOX_FILE = path.join(DATA_DIR, 'outbox.json');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');
const STATE_DIR = path.join(DATA_DIR, 'states');

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days
const STATE_MAX_BYTES = 2 * 1024 * 1024;      // 2MB cloud state budget
const SESSION_COOKIE = 'tc_session';

// ── Plan tiers (TradingView-parity entitlement matrix) ────────────────────
export const PLAN_ORDER = ['basic', 'essential', 'plus', 'premium', 'ultimate'];
export const PLANS = {};
export const UNLIMITED = -1;

const SEED_PLANS = {
  basic: {
    id: 'basic', priceUSD: 0, priceYearlyUSD: 0, billingCycle: 'monthly',
    nameEn: 'Basic', nameFa: 'پایه',
    descriptionEn: 'Essential market charting for beginners and exploratory traders',
    descriptionFa: 'چارت و تحلیل پایه بازار برای معامله‌گران مبتدی و کاوشگران',
    badge: 'FREE', badgeFa: 'رایگان', color: '#8b93a7', order: 0, isDefault: true, isActive: true,
    features: {
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
      marketSubscriptions: 2,
      compareSymbol: true, volumeProfile: false, drawingTools: true,
      marketTrackers: true, economicCalendar: true, marketNews: true,
      propFirmSim: true, depthOfMarket: true, tradeJournal: true, technicalRating: true,
      pineStudio: true, strategyTester: true, socialLinks: true, screenshotShare: true
    }
  },
  essential: {
    id: 'essential', priceUSD: 12.95, priceYearlyUSD: 129.50, billingCycle: 'monthly',
    nameEn: 'Essential', nameFa: 'اسنشیال',
    descriptionEn: 'Unleash multi-timeframe analytics, custom intervals, and enhanced indicators',
    descriptionFa: 'تحلیل چندتایم‌فریمی، بازه‌های زمانی سفارشی و سقف بالاتر اندیکاتورها',
    badge: 'POPULAR', badgeFa: 'محبوب', color: '#3b82f6', order: 1, isDefault: false, isActive: true,
    features: {
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
      marketSubscriptions: 4,
      compareSymbol: true, volumeProfile: false, drawingTools: true,
      marketTrackers: true, economicCalendar: true, marketNews: true,
      propFirmSim: true, depthOfMarket: true, tradeJournal: true, technicalRating: true,
      pineStudio: true, strategyTester: true, socialLinks: true, screenshotShare: true
    }
  },
  plus: {
    id: 'plus', priceUSD: 29.95, priceYearlyUSD: 299.50, billingCycle: 'monthly',
    nameEn: 'Plus', nameFa: 'پلاس',
    descriptionEn: 'Intraday mastery with webhook alerts, synthetic charts, and 4-chart grids',
    descriptionFa: 'معاملات روزانه حرفه‌ای با هشدارهای وب‌هوک، چارت‌های رنکو و کاگی و چیدمان ۴ چارتی',
    badge: 'RECOMMENDED', badgeFa: 'پیشنهادی', color: '#00F2B0', order: 2, isDefault: false, isActive: true,
    features: {
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
      marketSubscriptions: 6,
      compareSymbol: true, volumeProfile: true, drawingTools: true,
      marketTrackers: true, economicCalendar: true, marketNews: true,
      propFirmSim: true, depthOfMarket: true, tradeJournal: true, technicalRating: true,
      pineStudio: true, strategyTester: true, socialLinks: true, screenshotShare: true
    }
  },
  premium: {
    id: 'premium', priceUSD: 59.95, priceYearlyUSD: 599.50, billingCycle: 'monthly',
    nameEn: 'Premium', nameFa: 'پریمیوم',
    descriptionEn: 'Institutional-grade depth, 20,000 bars, 8-chart layouts, and deep backtesting',
    descriptionFa: 'عمق تحلیل در سطح نهادی، ۲۰ هزار کندل، چیدمان ۸ چارتی و بک‌تست عمیق نامحدود',
    badge: 'PRO', badgeFa: 'حرفه‌ای', color: '#a855f7', order: 3, isDefault: false, isActive: true,
    features: {
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
      marketSubscriptions: 6,
      compareSymbol: true, volumeProfile: true, drawingTools: true,
      marketTrackers: true, economicCalendar: true, marketNews: true,
      propFirmSim: true, depthOfMarket: true, tradeJournal: true, technicalRating: true,
      pineStudio: true, strategyTester: true, socialLinks: true, screenshotShare: true
    }
  },
  ultimate: {
    id: 'ultimate', priceUSD: 199.95, priceYearlyUSD: 1999.50, billingCycle: 'monthly',
    nameEn: 'Ultimate', nameFa: 'آلتیمیت',
    descriptionEn: 'Limitless power with 16-chart grids, 40,000 bars, 1000 alerts, and priority compute',
    descriptionFa: 'حداکثر توان با ۱۶ چارت هم‌زمان، ۴۰ هزار کندل، ۱۰۰۰ هشدار و اولویت پردازش',
    badge: 'VIP', badgeFa: 'ویژه', color: '#f59e0b', order: 4, isDefault: false, isActive: true,
    features: {
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
      marketSubscriptions: 200,
      compareSymbol: true, volumeProfile: true, drawingTools: true,
      marketTrackers: true, economicCalendar: true, marketNews: true,
      propFirmSim: true, depthOfMarket: true, tradeJournal: true, technicalRating: true,
      pineStudio: true, strategyTester: true, socialLinks: true, screenshotShare: true
    }
  }
};

export function normalizePlan(raw) {
  const p = { ...raw };
  p.id = String(p.id || '').trim().toLowerCase();
  p.nameEn = String(p.nameEn || p.id).trim();
  p.nameFa = String(p.nameFa || p.nameEn).trim();
  p.descriptionEn = String(p.descriptionEn || '').trim();
  p.descriptionFa = String(p.descriptionFa ?? p.descriptionEn).trim();
  p.priceUSD = typeof p.priceUSD === 'number' ? Math.max(0, p.priceUSD) : 0;
  p.priceYearlyUSD = typeof p.priceYearlyUSD === 'number' ? Math.max(0, p.priceYearlyUSD) : Math.round(p.priceUSD * 10 * 100) / 100;
  p.billingCycle = p.billingCycle || 'monthly';
  p.badge = String(p.badge || '').trim();
  p.badgeFa = String(p.badgeFa ?? p.badge).trim();
  p.color = p.color || '#00F2B0';
  p.order = typeof p.order === 'number' ? p.order : 0;
  p.isActive = p.isActive !== false;
  p.isDefault = Boolean(p.isDefault);

  p.priceUSD = Math.round(p.priceUSD * 100) / 100;
  p.priceYearlyUSD = Math.round(p.priceYearlyUSD * 100) / 100;
  if (!/^#[0-9a-fA-F]{6}$/.test(String(p.color))) p.color = '#00F2B0';
  p.nameEn = p.nameEn.slice(0, 40); p.nameFa = p.nameFa.slice(0, 40);
  p.badge = p.badge.slice(0, 16); p.badgeFa = p.badgeFa.slice(0, 16);
  p.descriptionEn = p.descriptionEn.slice(0, 240); p.descriptionFa = p.descriptionFa.slice(0, 240);

  // Features object
  p.features = { ...(p.features || {}) };
  for (const f of FEATURES_CATALOG) {
    if (p.features[f.id] === undefined) {
      p.features[f.id] = (raw[f.id] !== undefined) ? raw[f.id] : f.default;
    }
    // Type-safe coercion: booleans stay booleans; quotas are integers ≥ 0 or -1 (unlimited)
    if (f.type === 'boolean') p.features[f.id] = p.features[f.id] === true || p.features[f.id] === 'true';
    else {
      let n = Math.round(Number(p.features[f.id]));
      if (!Number.isFinite(n)) n = f.default;
      if (n === -1 && f.allowUnlimited === false) n = f.max;
      if (n !== -1) n = Math.min(f.max ?? n, Math.max(f.min ?? 0, n));
      p.features[f.id] = n;
    }
    // Also flatten onto top level for backward compatibility
    p[f.id] = p.features[f.id];
  }
  return p;
}

/**
 * Strict validation for admin plan writes (create/update). normalizePlan()
 * still clamps defensively, but invalid admin input is reported instead of
 * being silently rewritten. Returns [] when valid.
 */
const PLAN_MAX_PRICE = 100000;
const PLAN_TEXT_LIMITS = { nameEn: 40, nameFa: 40, badge: 16, badgeFa: 16, descriptionEn: 240, descriptionFa: 240 };
export function validatePlanInput(raw, { partial = false } = {}) {
  const errors = [];
  const has = k => raw[k] !== undefined;
  for (const k of ['nameFa', 'nameEn']) {
    if (!partial || has(k)) {
      if (!String(raw[k] ?? '').trim()) errors.push({ field: k, code: 'required' });
    }
  }
  for (const [k, max] of Object.entries(PLAN_TEXT_LIMITS)) {
    if (has(k) && String(raw[k]).trim().length > max) errors.push({ field: k, code: 'too_long', max });
  }
  for (const k of ['priceUSD', 'priceYearlyUSD']) {
    if (!has(k)) continue;
    const v = raw[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > PLAN_MAX_PRICE) {
      errors.push({ field: k, code: 'out_of_range', min: 0, max: PLAN_MAX_PRICE });
    }
  }
  if (has('color') && !/^#[0-9a-fA-F]{6}$/.test(String(raw.color))) errors.push({ field: 'color', code: 'invalid' });
  for (const k of ['isActive', 'isDefault']) {
    if (has(k) && typeof raw[k] !== 'boolean') errors.push({ field: k, code: 'invalid' });
  }
  if (raw.features !== undefined) {
    if (!raw.features || typeof raw.features !== 'object' || Array.isArray(raw.features)) {
      errors.push({ field: 'features', code: 'invalid' });
    } else {
      for (const f of FEATURES_CATALOG) {
        if (!(f.id in raw.features)) continue;
        const v = raw.features[f.id];
        if (f.type === 'boolean') {
          if (typeof v !== 'boolean') errors.push({ field: `features.${f.id}`, code: 'invalid' });
        } else if (!(v === -1 && f.allowUnlimited !== false) && !(Number.isInteger(v) && v >= (f.min ?? 0) && v <= (f.max ?? Infinity))) {
          errors.push({ field: `features.${f.id}`, code: 'out_of_range', min: f.min ?? 0, max: f.max ?? null });
        }
      }
    }
  }
  return errors;
}
const SEED_PLAN_IDS = () => Object.keys(SEED_PLANS);

export function loadPlans() {
  const store = readJson(PLANS_FILE, null);
  Object.keys(PLANS).forEach(k => delete PLANS[k]);
  PLAN_ORDER.length = 0;

  if (store && store.plans && typeof store.plans === 'object') {
    for (const [id, raw] of Object.entries(store.plans)) {
      PLANS[id] = normalizePlan({ ...raw, id });
    }
    if (Array.isArray(store.planOrder)) {
      PLAN_ORDER.push(...store.planOrder.filter(id => !!PLANS[id]));
    }
  }

  // Ensure canonical seed plans exist
  for (const [id, raw] of Object.entries(SEED_PLANS)) {
    if (!PLANS[id]) {
      PLANS[id] = normalizePlan(raw);
    }
    if (!PLAN_ORDER.includes(id)) {
      PLAN_ORDER.push(id);
    }
  }

  // Ensure at least one default plan exists
  if (!Object.values(PLANS).some(p => p.isDefault)) {
    if (PLANS.basic) PLANS.basic.isDefault = true;
  }
}

export function savePlansStore() {
  atomicWrite(PLANS_FILE, {
    plans: PLANS,
    planOrder: PLAN_ORDER,
    updatedAt: Date.now()
  });
}

// ── Atomic JSON store ─────────────────────────────────────────────────────
function ensureDirs() {
  for (const d of [DATA_DIR, STATE_DIR]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
}
ensureDirs();
// Harden pre-existing stores: password hashes, TOTP secrets, session digests
// and audit trails are owner-only (writeFileSync's `mode` applies only on
// create, so files from older builds stay 0644 without this pass).
(function hardenDataPerms() {
  try {
    for (const d of [path.dirname(DATA_DIR), DATA_DIR, STATE_DIR]) { try { fs.chmodSync(d, 0o700); } catch (e) { /* not ours */ } }
    for (const f of fs.readdirSync(DATA_DIR)) {
      const p = path.join(DATA_DIR, f);
      try { if (fs.statSync(p).isFile()) fs.chmodSync(p, 0o600); } catch (e) { /* raced */ }
    }
    for (const f of fs.readdirSync(STATE_DIR)) { try { fs.chmodSync(path.join(STATE_DIR, f), 0o600); } catch (e) { /* raced */ } }
  } catch (e) { console.error('[accounts] permission hardening skipped:', e.message); }
})();

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
  if (_sessions === null) {
    _sessions = readJson(SESSIONS_FILE, { sessions: [] });
    if (!Array.isArray(_sessions.sessions)) _sessions.sessions = [];
    // One-time security migration: rows written before tokens were hashed at
    // rest still carry a raw `token`. Those raw tokens may also survive in
    // backups / local git history, so they are REVOKED (forced re-login), not
    // re-hashed — re-hashing would keep every leaked copy replayable.
    const before = _sessions.sessions.length;
    _sessions.sessions = _sessions.sessions.filter(s => s && typeof s.tokenHash === 'string' && !('token' in s));
    const dropped = before - _sessions.sessions.length;
    if (dropped) {
      try { atomicWrite(SESSIONS_FILE, _sessions); } catch (e) { /* retried on next flush */ }
      console.log(`[accounts] security: revoked ${dropped} legacy plaintext-token sessions`);
    }
  }
  return _sessions;
}
/** Session tokens are stored only as sha256 digests (hashed at rest). */
function hashSessionToken(t) { return crypto.createHash('sha256').update(String(t)).digest('hex'); }
function atomicWrite(file, obj) {
  // Stores hold password hashes, TOTP secrets and session digests: owner-only.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

// Bootstrap plans on boot
loadPlans();
if (!fs.existsSync(PLANS_FILE)) savePlansStore();
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
// TradingView parity: letters, digits, underscore and hyphen; 3–24 chars.
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,24}$/;
// Reserved/impersonation blocklist (TradingView House Rules parity).
const USERNAME_BLOCK_RE = /(admin|moderator|tradingview|vela|nexus|support|official)/i;
const USERNAME_CHANGE_LIMIT = 2; // TradingView: every user may change username twice

// Social-link network allowlist per plan tier (TradingView parity):
// basic → X, YouTube · essential/plus → + Facebook, Instagram · premium/ultimate → + Website
const SOCIAL_NETWORKS_BY_PLAN = {
  basic: ['x', 'youtube'],
  essential: ['x', 'youtube', 'facebook', 'instagram'],
  plus: ['x', 'youtube', 'facebook', 'instagram'],
  premium: ['x', 'youtube', 'facebook', 'instagram', 'website'],
  ultimate: ['x', 'youtube', 'facebook', 'instagram', 'website']
};
const SOCIAL_NETWORKS_ALL = ['x', 'youtube', 'facebook', 'instagram', 'website'];
const URL_RE = /^https?:\/\/[^\s]{3,200}$/i;
const X_HANDLE_RE = /^@?[A-Za-z0-9_]{1,15}$/;

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
  else if (USERNAME_BLOCK_RE.test(username)) errors.push({ field: 'username', code: 'username_blocked' });
  if (!passwordOk(password)) errors.push({ field: 'password', code: password.length > 128 ? 'password_length' : 'password_weak' });
  return errors;
}

// ── RFC 6238 TOTP (zero-dependency, authenticator-app parity) ─────────────
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  let bits = 0, value = 0; const out = [];
  for (const ch of String(str).replace(/=+$/, '').toUpperCase()) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function totpCode(secret, timeStep = 30, offsetSteps = 0) {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep) + offsetSteps;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const code = ((h[off] & 0x7f) << 24 | h[off + 1] << 16 | h[off + 2] << 8 | h[off + 3]) % 1000000;
  return String(code).padStart(6, '0');
}
function totpVerify(secret, code) {
  const c = String(code || '').trim();
  if (!/^\d{6}$/.test(c)) return false;
  // ±1 step tolerance (30s clock drift either way)
  for (const off of [-1, 0, 1]) if (totpCode(secret, 30, off) === c) return true;
  return false;
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
    fs.writeFileSync(OUTBOX_FILE, JSON.stringify(box, null, 1), { mode: 0o600 });
  } catch (e) { console.error('[accounts] outbox write failed:', e.message); }
  // Deliver by e-mail when SMTP is configured (fire-and-forget; the outbox
  // copy stays so an administrator can still help if delivery fails).
  if (mailEnabled()) sendCode(kind, email, code).catch(() => {});
}
function outboxAll() {
  return readJson(OUTBOX_FILE, { messages: [] }).messages.map(({ id, kind, email, at }) => ({ id, kind, email, at }));
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
// `Secure` is added whenever the request arrived over HTTPS (directly or via
// the loopback reverse proxy / tunnel, see app.set('trust proxy')).
const secureFlag = res => (res.req && res.req.secure ? '; Secure' : '');
function setSessionCookie(res, token, maxAgeMs) {
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secureFlag(res)}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag(res)}`);
}

// ── Sessions table ops ────────────────────────────────────────────────────
// Tokens are stored HASHED at rest (sha256): a leaked sessions.json (backup,
// git history, disk image) cannot be replayed as a cookie. The raw token lives
// only in the user's HttpOnly cookie and, transiently, as a NON-enumerable
// `token` property on a freshly created row (so JSON persistence drops it).
// (session-token hashing lives next to the session store — see hashSessionToken)
function createSessionRow(user, req) {
  const ua = String(req.headers['user-agent'] || '').slice(0, 180);
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const device = isMobile ? 'Mobile Browser' : 'Desktop Browser';
  const token = crypto.randomBytes(32).toString('base64url');
  const row = {
    id: 's_' + crypto.randomUUID(),
    tokenHash: hashSessionToken(token),
    userId: user.id,
    device, ua, ip: req.ip || '',
    createdAt: Date.now(), lastSeen: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  Object.defineProperty(row, 'token', { value: token, enumerable: false });
  return row;
}
function findSessionByToken(token) {
  if (!token) return null;
  const h = hashSessionToken(token);
  return sessions().sessions.find(s => s.tokenHash === h) || null;
}
function addSessionRow(row) { sessions().sessions.push(row); }
function removeSessionById(id) {
  const arr = sessions().sessions;
  const i = arr.findIndex(s => s.id === id);
  if (i >= 0) arr.splice(i, 1);
}
function sessionsForUser(userId) { return sessions().sessions.filter(s => s.userId === userId); }
function revokeAllForUser(userId, exceptId = null) {
  const arr = sessions().sessions;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].userId === userId && arr[i].id !== exceptId) arr.splice(i, 1);
}

export function defaultPlanId() {
  const p = Object.values(PLANS).find(x => x && x.isDefault) || PLANS.basic || PLANS[PLAN_ORDER[0]];
  return p ? p.id : 'basic';
}

export function effectivePlanId(u, now = Date.now()) {
  if (!u) return defaultPlanId();
  const n = (now instanceof Date) ? now.getTime() : (typeof now === 'number' ? now : Date.now());
  if (u.gift && u.gift.plan && PLANS[u.gift.plan]) {
    if (u.gift.expiresAt == null || Number(u.gift.expiresAt) > n) {
      return u.gift.plan;
    }
  }
  return (u.plan && PLANS[u.plan]) ? u.plan : defaultPlanId();
}

export function clearExpiredGifts(now = Date.now()) {
  try {
    const uStore = users();
    let changed = false;
    const sysReq = { headers: {}, ip: '127.0.0.1', user: { id: 'system', username: 'system' } };
    const n = (now instanceof Date) ? now.getTime() : (typeof now === 'number' ? now : Date.now());
    for (const u of uStore.users) {
      if (u.gift && u.gift.expiresAt != null && !isNaN(Number(u.gift.expiresAt)) && Number(u.gift.expiresAt) <= n) {
        const oldGift = u.gift;
        u.gift = null;
        changed = true;
        audit(sysReq, 'user.gift_expired', u.id, {
          plan: oldGift.plan,
          expiresAt: (oldGift.expiresAt !== undefined && oldGift.expiresAt !== null) ? Number(oldGift.expiresAt) : null
        });
      }
    }
    if (changed) {
      flushNow();
    }
  } catch (e) {
    console.error('[accounts] clearExpiredGifts failed:', e.message);
  }
}

// ── Public shapes ─────────────────────────────────────────────────────────
export function publicUser(u) {
  if (!u) return null;
  const effPlan = effectivePlanId(u);
  const gift = (u.gift && u.gift.plan && PLANS[u.gift.plan] && (u.gift.expiresAt == null || Number(u.gift.expiresAt) > Date.now()))
    ? { plan: u.gift.plan, expiresAt: (u.gift.expiresAt !== undefined && u.gift.expiresAt !== null) ? Number(u.gift.expiresAt) : null }
    : null;
  return {
    id: u.id, email: u.email, username: u.username, displayName: u.displayName,
    bio: u.bio || '', avatarPreset: u.avatarPreset || 'mecha',
    location: u.location || '', signature: u.signature || '',
    socialLinks: u.socialLinks || {},
    plan: u.plan || 'basic', planSince: u.planSince || null,
    effectivePlan: effPlan,
    gift,
    role: u.role || 'user',
    isAdmin: Boolean(u.role === 'admin' || u.isAdmin === true),
    emailVerified: !!u.emailVerified, createdAt: u.createdAt,
    usernameChangesLeft: Math.max(0, USERNAME_CHANGE_LIMIT - (u.usernameChanges || 0)),
    totpEnabled: !!u.totpSecret,
    timezone: u.timezone || 'UTC', currency: u.currency || 'USD',
    planRequest: u.planRequest && PLANS[u.planRequest.plan] ? { plan: u.planRequest.plan, at: u.planRequest.at } : null
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
  initMailer().then(ok => console.log(`[mailer] ${ok ? 'SMTP delivery enabled' : 'SMTP not configured — codes are delivered by administrators'}`));
  const router = express.Router();

  // Attach user + session row to req from the session cookie (null if guest).
  app.use((req, res, next) => {
    req.user = null; req.sessionRow = null;
    const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
    if (token) {
      const row = findSessionByToken(token);
      if (row) {
        if (Date.now() > row.expiresAt) {
          removeSessionById(row.id); scheduleFlush();
        } else {
          const u = users().users.find(x => x.id === row.userId);
          if (u && !u.suspended) {
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
    const ps = getPlatformSettings();
    if (ps.maintenanceMode) return res.status(503).json({ ok: false, error: 'maintenance' });
    if (!ps.registrationOpen) return res.status(403).json({ ok: false, error: 'registration_closed' });
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
    if (u.suspended) {
      return res.status(403).json({ ok: false, error: 'account_suspended' });
    }
    if (getPlatformSettings().maintenanceMode && !(u.role === 'admin' || u.isAdmin === true)) {
      return res.status(503).json({ ok: false, error: 'maintenance' });
    }
    // 2FA second step: account has TOTP enabled → require a live code.
    // No code yet → tell the client to prompt (do NOT create a session).
    if (u.totpSecret) {
      if (body.totpCode === undefined) {
        return res.status(200).json({ ok: true, totpRequired: true });
      }
      if (!totpVerify(u.totpSecret, body.totpCode)) {
        return res.status(401).json({ ok: false, error: 'invalid_totp', totpRequired: true });
      }
    }
    const row = createSessionRow(u, req);
    addSessionRow(row); flushNow();
    setSessionCookie(res, row.token, SESSION_TTL_MS);
    res.json({ ok: true, user: publicUser(u) });
  });

  // ── Logout / logout-everywhere ──────────────────────────────────────────
  router.post('/logout', (req, res) => {
    if (req.sessionRow) { removeSessionById(req.sessionRow.id); flushNow(); }
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
      if (USERNAME_BLOCK_RE.test(uname))
        return res.status(400).json({ ok: false, errors: [{ field: 'username', code: 'username_blocked' }] });
      if (uname.toLowerCase() !== u.usernameLower) {
        // TradingView parity: each user may change their username at most twice.
        if ((u.usernameChanges || 0) >= USERNAME_CHANGE_LIMIT)
          return res.status(403).json({ ok: false, errors: [{ field: 'username', code: 'username_limit' }] });
        if (users().users.some(x => x.id !== u.id && x.usernameLower === uname.toLowerCase()))
          return res.status(409).json({ ok: false, errors: [{ field: 'username', code: 'username_taken' }] });
        u.username = uname; u.usernameLower = uname.toLowerCase();
        u.usernameChanges = (u.usernameChanges || 0) + 1;
      }
    }
    if (b.displayName !== undefined) u.displayName = String(b.displayName).slice(0, 64);
    if (b.bio !== undefined) u.bio = String(b.bio).slice(0, 280);
    if (b.location !== undefined) u.location = String(b.location).slice(0, 80);
    if (b.signature !== undefined) u.signature = String(b.signature).slice(0, 140);
    if (b.avatarPreset !== undefined) u.avatarPreset = String(b.avatarPreset).slice(0, 24);
    if (b.timezone !== undefined) u.timezone = String(b.timezone).slice(0, 48);
    if (b.currency !== undefined) u.currency = String(b.currency).slice(0, 8);
    if (b.socialLinks !== undefined) {
      // Plan-gated social networks (TradingView parity). Unknown networks and
      // networks above the user's tier are rejected; malformed values dropped.
      const allowed = SOCIAL_NETWORKS_BY_PLAN[effectivePlanId(u)] || SOCIAL_NETWORKS_BY_PLAN.basic;
      const incoming = typeof b.socialLinks === 'object' && b.socialLinks ? b.socialLinks : {};
      const next = { ...(u.socialLinks || {}) };
      for (const net of SOCIAL_NETWORKS_ALL) {
        if (!(net in incoming)) continue;
        const raw = String(incoming[net] || '').trim();
        if (!raw) { delete next[net]; continue; } // empty string clears the link
        if (!allowed.includes(net))
          return res.status(403).json({ ok: false, errors: [{ field: `socialLinks.${net}`, code: 'plan_required' }] });
        const valid = net === 'x' ? X_HANDLE_RE.test(raw) : URL_RE.test(raw);
        if (!valid)
          return res.status(400).json({ ok: false, errors: [{ field: `socialLinks.${net}`, code: 'invalid_link' }] });
        next[net] = net === 'x' ? raw.replace(/^@/, '') : raw;
      }
      u.socialLinks = next;
    }
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
    // Security parity: invalidate every other device session; the current
    // device stays signed in (its row — and cookie — are kept as-is).
    const keepId = req.sessionRow ? req.sessionRow.id : null;
    revokeAllForUser(req.user.id, keepId);
    flushNow();
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

      // ── Two-factor authentication (TOTP authenticator app — TradingView parity) ──
  // Step 1: request a secret + otpauth URI (does NOT enable yet).
  // Repeating setup replaces the pending secret and is NOT rate-limited — the
  // caller is already authenticated and the pending value is harmless until a
  // valid code confirms it. Rate gates stay on enable/disable/login instead.
  router.post('/2fa/setup', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    if (req.user.totpSecret) return res.status(409).json({ ok: false, error: 'already_enabled' });
    const secret = base32Encode(crypto.randomBytes(20));
    req.user.pendingTotpSecret = secret;
    flushNow();
    const issuer = 'Chartivia';
    const label = encodeURIComponent(`${issuer}:${req.user.username}`);
    res.json({
      ok: true, secret,
      otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`
    });
  });

  // Step 2: confirm with a live code from the authenticator app
  router.post('/2fa/enable', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    if (rateGate(req, res, 'twofa', 6, 60000)) return;
    const pending = req.user.pendingTotpSecret;
    if (!pending) return res.status(400).json({ ok: false, error: 'no_pending_setup' });
    if (!totpVerify(pending, req.body?.code))
      return res.status(400).json({ ok: false, error: 'invalid_code' });
    req.user.totpSecret = pending;
    req.user.pendingTotpSecret = null;
    flushNow();
    res.json({ ok: true, totpEnabled: true });
  });

  // Disable requires password + live code (protects against session hijack)
  router.post('/2fa/disable', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    if (rateGate(req, res, 'twofa', 6, 60000)) return;
    if (!req.user.totpSecret) return res.status(400).json({ ok: false, error: 'not_enabled' });
    if (!verifyPassword(String(req.body?.password || ''), req.user.salt, req.user.hash))
      return res.status(400).json({ ok: false, error: 'invalid_credentials' });
    if (!totpVerify(req.user.totpSecret, req.body?.code))
      return res.status(400).json({ ok: false, error: 'invalid_code' });
    req.user.totpSecret = null;
    flushNow();
    res.json({ ok: true, totpEnabled: false });
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

  // ── Gift expiry periodic job (FR-006, SC-002, SC-003) ───────────────────
  clearExpiredGifts();
  const giftExpiryTimer = setInterval(clearExpiredGifts, 60_000);
  if (giftExpiryTimer.unref) giftExpiryTimer.unref();

  // ── Cloud state sync (per-user workspace blob) ──────────────────────────
  app.get('/api/user/state', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const rec = readState(req.user.id);
    res.json({ ok: true, state: rec.state || {}, updatedAt: rec.updatedAt || 0, plan: effectivePlanId(req.user) });
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
    const violations = validateStateAgainstPlan(state, effectivePlanId(req.user));
    if (violations.length) {
      return res.status(403).json({ ok: false, error: 'limit_exceeded', violations });
    }
    const current = readState(req.user.id);
    // Optimistic concurrency: stale base → 409 with the server copy for merge
    // review. A client claiming base 0 ("I know nothing") is only honest when
    // the server truly has no state yet — otherwise it IS a stale writer.
    if (current.updatedAt > 0 && Number(baseUpdatedAt || 0) < current.updatedAt) {
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
        current: s.id === req.sessionRow?.id
      }));
    res.json({ ok: true, sessions: list });
  });

  app.delete('/api/user/sessions/:sid', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const row = sessions().sessions.find(s => s.id === req.params.sid && s.userId === req.user.id);
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    removeSessionById(row.id);
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
    const { salt, hash, totpSecret, pendingTotpSecret, verifyCode, resetCode, ...safeUser } = u;
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
    clearSessionCookie(res);
    res.json({ ok: true, deleted: true });
  });

  // ── Public platform info (announcement banner, registration state) ──────
  app.get('/api/platform', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, ...publicPlatformInfo(), emailDelivery: mailEnabled() });
  });

  // ── Plans (entitlement matrix + usage) ──────────────────────────────────
  app.get('/api/plans', (req, res) => {
    const admin = isReqAdmin(req);
    const effPlan = req.user ? effectivePlanId(req.user) : null;
    const basePlan = req.user ? (req.user.plan || 'basic') : null;
    const visible = PLAN_ORDER.filter(id => admin || PLANS[id]?.isActive !== false || id === effPlan || id === basePlan);
    res.json({
      ok: true,
      plans: Object.fromEntries(visible.map(id => [id, { ...PLANS[id] }])),
      planOrder: visible,
      current: effPlan,
      usage: req.user ? computeUsage(req.user) : null,
      isAdmin: isReqAdmin(req)
    });
  });

  // ── Back-office API (auth/session, dashboard, users, audit, system) ────
  mountAdminApi(app, {
    users, sessions, flushNow, publicUser, PLANS, PLAN_ORDER, readState, statePath, stateCache,
    revokeAllForUser, outboxPush, outboxAll, sixDigitCode, rateGate, STATE_DIR,
    effectivePlanId,
    defaultPlanId
  });

  mountTradeRelay(app, { users, flushNow, PLANS, rateGate, effectivePlanId });

  // ── Admin: Full Plans Catalog & Management ───────────────────────────────
  app.get('/api/admin/plans', (req, res) => {
    if (!isReqAdmin(req)) {
      return res.status(403).json({ ok: false, error: 'forbidden_admin_only' });
    }
    const userCounts = Object.fromEntries(PLAN_ORDER.map(id => [id, 0]));
    for (const u of users().users) {
      const pid = PLANS[u.plan] ? u.plan : null;
      if (pid) userCounts[pid] = (userCounts[pid] || 0) + 1;
    }
    res.json({
      ok: true,
      plans: PLANS,
      planOrder: PLAN_ORDER,
      catalog: FEATURES_CATALOG,
      categories: CATEGORIES,
      builtin: SEED_PLAN_IDS(),
      userCounts
    });
  });

  // Create new custom plan
  app.post('/api/admin/plans', (req, res) => {
    if (!isReqAdmin(req)) {
      return res.status(403).json({ ok: false, error: 'forbidden_admin_only' });
    }
    const raw = req.body || {};
    const id = String(raw.id || '').trim().toLowerCase();
    if (!id || !/^[a-z0-9_-]{2,32}$/.test(id)) {
      return res.status(400).json({ ok: false, error: 'invalid_plan_id', message: 'Plan ID must be 2–32 alphanumeric chars or hyphens/underscores' });
    }
    if (PLANS[id]) {
      return res.status(400).json({ ok: false, error: 'plan_exists', message: 'A plan with this ID already exists' });
    }
    const vErr = validatePlanInput(raw);
    if (vErr.length) return res.status(400).json({ ok: false, error: 'validation_failed', errors: vErr });
    const plan = normalizePlan({ ...raw, id });
    if (plan.isDefault) {
      Object.values(PLANS).forEach(p => { p.isDefault = false; });
    }
    plan.order = PLAN_ORDER.length;
    PLANS[id] = plan;
    if (!PLAN_ORDER.includes(id)) {
      PLAN_ORDER.push(id);
    }
    savePlansStore();
    audit(req, 'plan.create', id, { nameEn: plan.nameEn });
    res.json({ ok: true, plan, planOrder: PLAN_ORDER });
  });

  // Update existing plan
  app.put('/api/admin/plans/:id', (req, res) => {
    if (!isReqAdmin(req)) {
      return res.status(403).json({ ok: false, error: 'forbidden_admin_only' });
    }
    const id = String(req.params.id || '').trim().toLowerCase();
    if (!PLANS[id]) {
      return res.status(404).json({ ok: false, error: 'plan_not_found' });
    }
    const existing = PLANS[id];
    const raw = req.body || {};
    const vErr = validatePlanInput(raw, { partial: true });
    if (vErr.length) return res.status(400).json({ ok: false, error: 'validation_failed', errors: vErr });
    if (existing.isDefault && raw.isDefault === false) {
      return res.status(400).json({ ok: false, error: 'cannot_unset_default', message: 'Mark another plan as default instead' });
    }
    if ((existing.isDefault || raw.isDefault === true) && raw.isActive === false) {
      return res.status(400).json({ ok: false, error: 'default_must_be_active', message: 'The default plan must stay active' });
    }
    const updated = normalizePlan({
      ...existing,
      ...raw,
      id, // keep immutable ID
      features: { ...existing.features, ...(raw.features || {}) }
    });

    if (updated.isDefault) {
      Object.values(PLANS).forEach(p => { p.isDefault = (p.id === id); });
    }
    const changed = [];
    for (const k of ['nameEn', 'nameFa', 'priceUSD', 'priceYearlyUSD', 'badge', 'badgeFa', 'color', 'isActive', 'isDefault', 'descriptionEn', 'descriptionFa']) {
      if (JSON.stringify(existing[k]) !== JSON.stringify(updated[k])) changed.push(k);
    }
    for (const f of FEATURES_CATALOG) {
      if (existing.features?.[f.id] !== updated.features[f.id]) changed.push(f.id);
    }
    PLANS[id] = updated;
    savePlansStore();
    if (changed.length) audit(req, 'plan.update', id, { fields: changed.slice(0, 40) });
    res.json({ ok: true, plan: updated, planOrder: PLAN_ORDER });
  });

  // Delete plan
  app.delete('/api/admin/plans/:id', (req, res) => {
    if (!isReqAdmin(req)) {
      return res.status(403).json({ ok: false, error: 'forbidden_admin_only' });
    }
    const id = String(req.params.id || '').trim().toLowerCase();
    if (!PLANS[id]) {
      return res.status(404).json({ ok: false, error: 'plan_not_found' });
    }
    if (PLAN_ORDER.length <= 1) {
      return res.status(400).json({ ok: false, error: 'cannot_delete_last_plan' });
    }
    if (PLANS[id].isDefault) {
      return res.status(400).json({ ok: false, error: 'cannot_delete_default_plan', message: 'Set another plan as default before deleting this one' });
    }
    // Built-in tiers are re-seeded by loadPlans() on every boot, so deleting one
    // would silently come back after a restart. Deactivate them instead.
    if (SEED_PLAN_IDS().includes(id)) {
      return res.status(400).json({ ok: false, error: 'cannot_delete_builtin_plan', message: 'Built-in plans cannot be deleted; deactivate it instead' });
    }

    // Find fallback default plan
    const defaultPlan = Object.values(PLANS).find(p => p.isDefault && p.id !== id) || PLANS.basic || Object.values(PLANS).find(p => p.id !== id);
    const fallbackId = defaultPlan.id;

    // Migrate any users on this plan to fallback plan, and remove gifts on this plan (FR-007)
    const uStore = users();
    let migratedCount = 0;
    let giftsRevokedCount = 0;
    uStore.users.forEach(u => {
      if (u.plan === id) {
        u.plan = fallbackId;
        u.planSince = Date.now();
        migratedCount++;
      }
      if (u.gift && u.gift.plan === id) {
        const oldGift = u.gift;
        u.gift = null;
        giftsRevokedCount++;
        audit(req, 'user.gift_revoke', u.id, {
          plan: oldGift.plan,
          expiresAt: (oldGift.expiresAt !== undefined && oldGift.expiresAt !== null) ? Number(oldGift.expiresAt) : null,
          reason: 'plan_deleted'
        });
      }
    });
    if (migratedCount > 0 || giftsRevokedCount > 0) {
      flushNow();
    }

    delete PLANS[id];
    const orderIdx = PLAN_ORDER.indexOf(id);
    if (orderIdx >= 0) PLAN_ORDER.splice(orderIdx, 1);
    PLAN_ORDER.forEach((pid, i) => { if (PLANS[pid]) PLANS[pid].order = i; });
    savePlansStore();
    audit(req, 'plan.delete', id, { fallbackPlan: fallbackId, migratedUsers: migratedCount });

    res.json({ ok: true, deleted: id, fallbackPlan: fallbackId, migratedUsers: migratedCount, planOrder: PLAN_ORDER });
  });

  // Reorder plans
  app.post('/api/admin/plans/reorder', (req, res) => {
    if (!isReqAdmin(req)) {
      return res.status(403).json({ ok: false, error: 'forbidden_admin_only' });
    }
    const { order } = req.body || {};
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid_order' });
    }
    const valid = order.filter(id => !!PLANS[id]);
    Object.keys(PLANS).forEach(id => {
      if (!valid.includes(id)) valid.push(id);
    });
    PLAN_ORDER.length = 0;
    PLAN_ORDER.push(...valid);
    PLAN_ORDER.forEach((id, idx) => {
      if (PLANS[id]) PLANS[id].order = idx;
    });
    savePlansStore();
    audit(req, 'plan.reorder', null, { order: [...PLAN_ORDER] });
    res.json({ ok: true, planOrder: PLAN_ORDER });
  });

  // Clone plan
  app.post('/api/admin/plans/clone', (req, res) => {
    if (!isReqAdmin(req)) {
      return res.status(403).json({ ok: false, error: 'forbidden_admin_only' });
    }
    const { sourceId, newId, nameEn, nameFa } = req.body || {};
    const src = PLANS[sourceId];
    if (!src) return res.status(404).json({ ok: false, error: 'source_plan_not_found' });
    const targetId = String(newId || '').trim().toLowerCase();
    if (!targetId || !/^[a-z0-9_-]{2,32}$/.test(targetId)) {
      return res.status(400).json({ ok: false, error: 'invalid_new_id' });
    }
    if (PLANS[targetId]) {
      return res.status(400).json({ ok: false, error: 'plan_exists' });
    }
    const cErr = validatePlanInput({ ...(nameEn !== undefined ? { nameEn } : {}), ...(nameFa !== undefined ? { nameFa } : {}) }, { partial: true });
    if (cErr.length) return res.status(400).json({ ok: false, error: 'validation_failed', errors: cErr });
    const cloned = normalizePlan({
      ...src,
      id: targetId,
      nameEn: nameEn || `${src.nameEn} (Copy)`,
      nameFa: nameFa || `${src.nameFa} (کپی)`,
      isDefault: false,
      isActive: false,
      order: PLAN_ORDER.length,
      features: { ...src.features }
    });
    PLANS[targetId] = cloned;
    PLAN_ORDER.push(targetId);
    savePlansStore();
    audit(req, 'plan.clone', targetId, { source: sourceId });
    res.json({ ok: true, plan: cloned, planOrder: PLAN_ORDER });
  });

  // Reset to default seed plans
  app.post('/api/admin/plans/reset', (req, res) => {
    if (!isReqAdmin(req)) {
      return res.status(403).json({ ok: false, error: 'forbidden_admin_only' });
    }
    Object.keys(PLANS).forEach(k => delete PLANS[k]);
    PLAN_ORDER.length = 0;
    for (const [id, raw] of Object.entries(SEED_PLANS)) {
      PLANS[id] = normalizePlan(raw);
      PLAN_ORDER.push(id);
    }
    // Users on removed custom tiers would otherwise point at a plan that no longer exists.
    const fallback = (Object.values(PLANS).find(p => p.isDefault) || PLANS.basic).id;
    let migrated = 0;
    for (const u of users().users) {
      if (!PLANS[u.plan || 'basic']) { u.plan = fallback; u.planSince = Date.now(); migrated++; }
      if (u.gift && !PLANS[u.gift.plan]) {
        const oldGift = u.gift;
        u.gift = null;
        migrated++;
        audit(req, 'user.gift_revoke', u.id, {
          plan: oldGift.plan,
          expiresAt: (oldGift.expiresAt !== undefined && oldGift.expiresAt !== null) ? Number(oldGift.expiresAt) : null,
          reason: 'plan_deleted'
        });
      }
    }
    if (migrated) flushNow();
    savePlansStore();
    audit(req, 'plan.reset', null, { migratedUsers: migrated });
    res.json({ ok: true, plans: PLANS, planOrder: PLAN_ORDER });
  });

  // Simulated billing (self-hosted product): switch plan instantly.
  // Self-service plan changes. Until a payment gateway is connected, moving to
  // a PAID plan is a request that an administrator approves in the console
  // (no free self-upgrade); switching to a free plan applies at once.
  app.post('/api/user/plan', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const planId = String(req.body?.plan || '');
    if (!PLANS[planId]) return res.status(400).json({ ok: false, error: 'unknown_plan' });
    const admin = isReqAdmin(req);
    if (PLANS[planId].isActive === false && !admin) {
      return res.status(400).json({ ok: false, error: 'plan_inactive', message: 'This plan is currently inactive.' });
    }
    const paid = Number(PLANS[planId].priceUSD || 0) > 0;
    if (paid && !admin && process.env.TC_BILLING_MODE !== 'simulated') {
      if (planId === req.user.plan) return res.json({ ok: true, user: publicUser(req.user), entitlements: PLANS[planId] });
      if (rateGate(req, res, 'plan_request', 10, 60000)) return;
      req.user.planRequest = { plan: planId, at: Date.now() };
      flushNow();
      audit(req, 'user.plan_request', req.user.id, { username: req.user.username, plan: planId });
      return res.status(202).json({ ok: true, pending: true, user: publicUser(req.user) });
    }
    req.user.plan = planId;
    req.user.planSince = Date.now();
    req.user.planRequest = null;
    flushNow();
    res.json({ ok: true, user: publicUser(req.user), entitlements: PLANS[planId] });
  });

  // Withdraw a pending upgrade request.
  app.delete('/api/user/plan-request', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    req.user.planRequest = null;
    flushNow();
    res.json({ ok: true, user: publicUser(req.user) });
  });

  return { flushNow };
}
