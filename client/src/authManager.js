// client/src/authManager.js
// TradingChart Account System — client side. Session bootstrap, login/signup/verify/reset
// modal, account dropdown menu, plan-gating engine, and cloud state sync.
// TradingView parity: guest mode stays fully usable; auth is progressive, not blocking.

import { getLanguage, t, toPersianDigits } from './i18n.js';
import { AVATAR_PRESETS } from './userProfileModal.js';

// ── Central storage bus: every 'tradingchart_*' localStorage write dispatches
// a 'storage-write' event so the cloud sync engine can debounce-push changes.
// Installed once at module load (single source of truth for sync dirtying).
if (typeof window !== 'undefined' && !window.__TC_STORAGE_BUS__) {
  window.__TC_STORAGE_BUS__ = true;
  const _setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    _setItem.call(this, key, value);
    if (typeof key === 'string' && key.startsWith('tradingchart_')) {
      try { window.dispatchEvent(new CustomEvent('storage-write', { detail: { key } })); } catch (e) { /* SSR */ }
    }
  };
}

// ── Entitlement matrix (mirrors server/accounts.js PLANS) ────────────────
export const PLANS = {
  basic: { id: 'basic', priceUSD: 0, chartsPerTab: 1, savedLayouts: 1, indicatorsPerChart: 2, savedTemplates: 1, watchlists: 1, watchlistSymbols: 30, priceAlerts: 3, technicalAlerts: 0, paperAccounts: 1, histBars: 10000, secondIntervals: false, tickIntervals: false, customIntervals: false, synthChartTypes: false, dataExport: false, multiTfAnalysis: false, barReplayMinuteDays: 180, deepBacktest: false, csvTradesExport: false, xlsxReport: false, webhookAlerts: false },
  essential: { id: 'essential', priceUSD: 12.95, chartsPerTab: 2, savedLayouts: 5, indicatorsPerChart: 5, savedTemplates: 5, watchlists: 5, watchlistSymbols: 1000, priceAlerts: 20, technicalAlerts: 20, paperAccounts: 3, histBars: 10000, secondIntervals: true, tickIntervals: false, customIntervals: true, synthChartTypes: false, dataExport: true, multiTfAnalysis: true, barReplayMinuteDays: 365, deepBacktest: false, csvTradesExport: false, xlsxReport: false, webhookAlerts: false },
  plus: { id: 'plus', priceUSD: 29.95, chartsPerTab: 4, savedLayouts: 10, indicatorsPerChart: 10, savedTemplates: 10, watchlists: 10, watchlistSymbols: 1000, priceAlerts: 100, technicalAlerts: 100, paperAccounts: 4, histBars: 10000, secondIntervals: true, tickIntervals: false, customIntervals: true, synthChartTypes: true, dataExport: true, multiTfAnalysis: true, barReplayMinuteDays: -1, deepBacktest: false, csvTradesExport: true, xlsxReport: false, webhookAlerts: true },
  premium: { id: 'premium', priceUSD: 59.95, chartsPerTab: 8, savedLayouts: -1, indicatorsPerChart: 25, savedTemplates: 20, watchlists: 20, watchlistSymbols: 1000, priceAlerts: 400, technicalAlerts: 400, paperAccounts: 5, histBars: 20000, secondIntervals: true, tickIntervals: true, customIntervals: true, synthChartTypes: true, dataExport: true, multiTfAnalysis: true, barReplayMinuteDays: -1, deepBacktest: true, csvTradesExport: true, xlsxReport: true, webhookAlerts: true },
  ultimate: { id: 'ultimate', priceUSD: 199.95, chartsPerTab: 16, savedLayouts: -1, indicatorsPerChart: 50, savedTemplates: 30, watchlists: 30, watchlistSymbols: 1000, priceAlerts: 1000, technicalAlerts: 1000, paperAccounts: 7, histBars: 40000, secondIntervals: true, tickIntervals: true, customIntervals: true, synthChartTypes: true, dataExport: true, multiTfAnalysis: true, barReplayMinuteDays: -1, deepBacktest: true, csvTradesExport: true, xlsxReport: true, webhookAlerts: true }
};
export const PLAN_ORDER = ['basic', 'essential', 'plus', 'premium', 'ultimate'];
const UNLIMITED = -1;

// Keys of cloud-synced localStorage entries → cloud state document.
const SYNC_MAP = {
  user_profile: 'profile',
  user_settings: 'settings',
  user_layouts: 'layouts',
  current_layout: 'currentLayout',
  user_templates: 'templates',
  user_watchlists: 'userWatchlists',
  custom_watchlist: 'watchlists',
  alerts: 'alerts',
  paper_accounts: 'paperAccounts',
  paper_active: 'paperActive',
  watchlist_flags: 'watchlistFlags',
  price_style: 'priceStyle',
  drawing_favorites: 'drawingFavorites',
  pine_code: 'pineCode',
  theme: 'theme',
  trade_journal: 'tradeJournal',
  custom_timeframes: 'customTimeframes',
  layout_sync: 'layoutSync',
  sound_muted: 'soundMuted'
};
const LS_PREFIX = 'tradingchart_';
const LOCAL_MIRROR = 'tradingchart_auth_mirror'; // guest→user handoff buffer

function formatGiftExpiry(expiresAt, isFa) {
  if (expiresAt == null) {
    return isFa ? 'نامحدود' : 'Unlimited';
  }
  const d = new Date(Number(expiresAt));
  if (isFa) {
    const formatted = d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
    return `تا ${toPersianDigits(formatted)}`;
  }
  const formatted = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return `until ${formatted}`;
}

export class AuthManager {
  constructor(app) {
    this.app = app;
    this.user = null;          // publicUser or null (guest)
    this.entitlements = PLANS.basic;
    this.usage = null;
    this.plansMeta = PLANS;
    this.adminSession = false; // server-verified (role or unlocked admin cookie)
    this.syncEnabled = (() => { try { return localStorage.getItem('tradingchart_sync_enabled') !== '0'; } catch (e) { return true; } })();
    this.syncTimer = null;
    this.syncInFlight = false;
    this.lastSyncAt = 0;
    this.menuOpen = false;
  }

  async init() {
    // 1. Bootstrap session from cookie
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const data = await res.json();
      this.user = data.user || null;
    } catch (e) {
      this.user = null;
    }
    // 2. Guest handoff: a previous signup/login stored a local mirror
    this.restoreGuestMirror();
    this.entitlements = PLANS[this.plan()] || PLANS.basic;
    await this.refreshPlans();
    // 3. Sync direction: cloud → local on boot (logged-in), local → cloud after
    if (this.user) {
      try {
        const saved = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
        if (!saved.language && getLanguage() !== 'fa') {
          this.app?.switchLanguage?.('fa');
        }
      } catch (e) {}
      await this.pullCloudState();
      this.syncAuthUserToProfile();
    }
    this.renderAccountBadge();
    this.bindAvatar();
    this.startAutoSync();
    this.observeStorage();
  }

  async load() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const data = await res.json();
      this.user = data.user || null;
    } catch (e) {
      this.user = null;
    }
    this.entitlements = PLANS[this.plan()] || PLANS.basic;
    await this.refreshPlans();
    this.renderAccountBadge();
    return this.user;
  }

  // ── Entitlement helpers ────────────────────────────────────────────────
  plan() {
    if (this.user?.gift) {
      if (this.user.gift.expiresAt != null && Number(this.user.gift.expiresAt) <= Date.now()) {
        return this.user.plan || 'basic';
      }
    }
    return this.user?.effectivePlan || this.user?.plan || 'basic';
  }

  hasActiveGift() {
    if (!this.user?.gift) return false;
    if (this.user.gift.expiresAt != null && Number(this.user.gift.expiresAt) <= Date.now()) return false;
    return true;
  }

  giftInfo() {
    return this.hasActiveGift() ? this.user.gift : null;
  }
  ent(key) {
    if (!this.entitlements) return undefined;
    if (this.entitlements.features && this.entitlements.features[key] !== undefined) {
      return this.entitlements.features[key];
    }
    return this.entitlements[key];
  }
  isUnlimited(v) { return v === UNLIMITED; }

  /** Check a numeric or boolean entitlement. Returns {allowed, limit, plan, needUpgrade, isBoolean}. */
  check(key, currentCount = 0) {
    const val = this.ent(key);
    const plan = this.plan();
    if (val === undefined) return { allowed: true, plan };
    // Boolean toggle
    if (typeof val === 'boolean') {
      if (val === true) return { allowed: true, plan, isBoolean: true };
      return { allowed: false, limit: 0, plan, isBoolean: true, needUpgrade: this.nextPlanWith(key, 0) };
    }
    // Numeric quota
    if (this.isUnlimited(val)) return { allowed: true, limit: UNLIMITED, plan };
    if (currentCount < val) return { allowed: true, limit: val, plan };
    return { allowed: false, limit: val, plan, needUpgrade: this.nextPlanWith(key, val) };
  }

  /** Boolean feature gate (secondIntervals, synthChartTypes, deepBacktest…). */
  feature(key) { return Boolean(this.ent(key)); }

  nextPlanWith(key, currentLimit) {
    const curPlan = this.plan();
    const idx = PLAN_ORDER.indexOf(curPlan);
    const start = idx >= 0 ? idx + 1 : 0;
    // Search higher tiers first
    for (let i = start; i < PLAN_ORDER.length; i++) {
      const p = this.plansMeta[PLAN_ORDER[i]] || PLANS[PLAN_ORDER[i]];
      if (!p) continue;
      const v = (p.features && p.features[key] !== undefined) ? p.features[key] : p[key];
      if (typeof v === 'boolean' && v === true) return p.id;
      if (typeof v === 'number' && (v === UNLIMITED || v > currentLimit)) return p.id;
    }
    // Search any other plan
    for (let i = 0; i < PLAN_ORDER.length; i++) {
      const p = this.plansMeta[PLAN_ORDER[i]] || PLANS[PLAN_ORDER[i]];
      if (!p || p.id === curPlan) continue;
      const v = (p.features && p.features[key] !== undefined) ? p.features[key] : p[key];
      if (typeof v === 'boolean' && v === true) return p.id;
      if (typeof v === 'number' && (v === UNLIMITED || v > currentLimit)) return p.id;
    }
    return PLAN_ORDER[PLAN_ORDER.length - 1] || 'ultimate';
  }

  planRank(id) { return PLAN_ORDER.indexOf(id); }

  /** Admin status is decided by the server only (role or unlocked admin session cookie). */
  isAdmin() {
    return Boolean(this.user?.isAdmin === true || this.user?.role === 'admin' || this.adminSession);
  }

  /** Opens the back-office console (separate page; it handles its own unlock gate). */
  openPlanAdminStudio(section = 'plans') {
    this.closeAccountMenu();
    const target = `/admin#/${section}`;
    try { window.open(target, '_blank', 'noopener'); } catch (e) { window.location.href = target; }
  }

  /** Enforce a limit; shows the TradingView-style upgrade toast and returns false when blocked. */
  enforce(key, currentCount, featureLabelEn, featureLabelFa) {
    const chk = this.check(key, currentCount);
    if (chk.allowed) return true;
    const isFa = getLanguage() === 'fa';
    const label = isFa ? (featureLabelFa || featureLabelEn) : featureLabelEn;
    const next = chk.needUpgrade
      ? (this.plansMeta[chk.needUpgrade] || PLANS[chk.needUpgrade] || { id: chk.needUpgrade, priceUSD: 0 })
      : (this.plansMeta.ultimate || PLANS.ultimate || { id: 'ultimate', priceUSD: 199.95 });
    const planNameMap = { basic: 'پایه', essential: 'اسنشیال', plus: 'پلاس', premium: 'پریمیوم', ultimate: 'آلتیمیت' };
    const nextName = isFa
      ? (next?.nameFa || planNameMap[next?.id] || next?.id || 'پلن بالاتر')
      : (next?.nameEn || (next?.id ? next.id.charAt(0).toUpperCase() + next.id.slice(1) : 'Higher Tier'));
    const priceText = next?.priceUSD === 0 ? (isFa ? 'رایگان' : 'Free') : `$${next?.priceUSD ?? 0}${isFa ? ' در ماه' : '/mo'}`;

    if (this.app?.showToast) {
      if (chk.isBoolean) {
        this.app.showToast(
          isFa
            ? `قابلیت «${label}» در پلن فعلی شما غیرفعال است — ارتقا به ${nextName} (${priceText})`
            : `The "${label}" feature is disabled in your current plan — upgrade to ${nextName} (${priceText})`,
          'warning'
        );
      } else {
        const limStr = this.isUnlimited(chk.limit) ? '∞' : toPersianDigits(String(chk.limit));
        this.app.showToast(
          isFa
            ? `به سقف ${limStr} ${label} در پلن فعلی خود رسیده‌اید. برای افزایش این سقف، پلن خود را به ${nextName} (${priceText}) ارتقا دهید.`
            : `You've reached your plan's ${label} limit (${chk.limit}). Upgrade to ${nextName} (${priceText}) to raise it.`,
          'warning'
        );
      }
    }
    return false;
  }

  async refreshPlans() {
    try {
      const res = await fetch('/api/plans', { credentials: 'same-origin' });
      const data = await res.json();
      if (data.ok && data.plans) {
        this.plansMeta = data.plans;
        if (Array.isArray(data.planOrder)) {
          PLAN_ORDER.length = 0;
          PLAN_ORDER.push(...data.planOrder);
        }
        Object.keys(PLANS).forEach(k => delete PLANS[k]);
        Object.assign(PLANS, data.plans);
        const curPlan = this.plan() || data.current || 'basic';
        this.entitlements = data.plans[curPlan] || data.plans.basic || this.entitlements;
        this.usage = data.usage || null;
        this.adminSession = data.isAdmin === true;
      }
    } catch (e) { /* keep local mirror */ }
  }

  // ── Guest → user handoff (mirror current localStorage into cloud on login) ──
  stashGuestMirror() {
    try {
      const mirror = {};
      for (const [lsKey, cloudKey] of Object.entries(SYNC_MAP)) {
        const v = localStorage.getItem(LS_PREFIX + lsKey);
        if (v !== null) mirror[cloudKey] = v;
      }
      if (Object.keys(mirror).length) localStorage.setItem(LOCAL_MIRROR, JSON.stringify({ at: Date.now(), mirror }));
    } catch (e) { /* ignore */ }
  }
  restoreGuestMirror() {
    // Only used when the user has no cloud state yet (first login after guest work).
    // Handled in pullCloudState's merge logic; kept here for lifecycle clarity.
  }
  clearGuestMirror() { try { localStorage.removeItem(LOCAL_MIRROR); } catch (e) {} }

  // ── Cloud state sync ────────────────────────────────────────────────────
  collectLocalState() {
    const state = {};
    for (const [lsKey, cloudKey] of Object.entries(SYNC_MAP)) {
      const v = localStorage.getItem(LS_PREFIX + lsKey);
      if (v !== null) state[cloudKey] = v;
    }
    return state;
  }

  applyCloudState(state) {
    if (!state || typeof state !== 'object') return;
    for (const [lsKey, cloudKey] of Object.entries(SYNC_MAP)) {
      const v = state[cloudKey];
      if (v === undefined || v === null) continue;
      try { localStorage.setItem(LS_PREFIX + lsKey, String(v)); } catch (e) { /* quota */ }
    }
  }

  async pullCloudState() {
    if (!this.user) return;
    try {
      const res = await fetch('/api/user/state', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      this.cloudUpdatedAt = data.updatedAt || 0;
      const cloud = data.state || {};
      const local = this.collectLocalState();
      const hasCloudData = Object.keys(cloud).length > 0;
      const hasLocalData = Object.keys(local).length > 0;
      // Managers that keep an in-memory mirror must absorb cloud state NOW
      // (at login), not lazily on the next conflict — otherwise a user edit
      // right after login would save the stale in-memory copy over the cloud.
      this.app?.paperTrading?.reloadFromStorage?.();
      this.app?.watchlist?.reloadFromStorage?.();
      this.app?.alertsManager?.reloadFromStorage?.();
      this.app?.tradeJournal?.reloadFromStorage?.();
      this.app?.fullPageJournal?.reloadFromStorage?.();
      this.app?.timeframeManager?.reloadFromStorage?.();
      if (hasCloudData) {
        // Merge: cloud wins for keys it has; local-only keys upload on next push.
        this.applyCloudState(cloud);
        this.app?.onCloudStateApplied?.(cloud);
        // ...and after the apply, managers reload once more so in-memory
        // mirrors equal what storage now holds.
        this.app?.paperTrading?.reloadFromStorage?.();
        this.app?.watchlist?.reloadFromStorage?.();
        this.app?.alertsManager?.reloadFromStorage?.();
        this.app?.tradeJournal?.reloadFromStorage?.();
        this.app?.fullPageJournal?.reloadFromStorage?.();
        this.app?.timeframeManager?.reloadFromStorage?.();
        if (this.app?.userProfileModal) {
          this.app.userProfileModal.profile = this.app.userProfileModal.loadProfile();
          this.app.userProfileModal.syncTopbarAvatar?.();
        }
      } else if (hasLocalData) {
        // First login of a guest with local work: mirror it up (TradingView does the same
        // — a fresh account inherits the browser's current workspace).
        const mirrorRaw = localStorage.getItem(LOCAL_MIRROR);
        if (mirrorRaw) this.clearGuestMirror();
        await this.pushCloudState({ force: true });
      }
     } catch (e) { /* offline: stay local */ }
  }

  async pushCloudState({ force = false } = {}) {
    if (!this.user || !this.syncEnabled || this.syncInFlight) return;
    this.syncInFlight = true;
    try {
      const state = this.collectLocalState();
      const res = await fetch('/api/user/state', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, baseUpdatedAt: force ? 0 : this.cloudUpdatedAt || 0 })
      });
    if (res.status === 409) {
        // Conflict: server is newer. Server wins for keys IT holds, but local
        // keys the server has never seen (added offline / in a second tab) are
        // merged in and re-pushed. CRITICAL: localState is collected INSIDE
        // the merge callback — applyCloudState() would overwrite the very
        // localStorage keys we are merging from if collected earlier.
        const conflict = await res.json();
        this.cloudUpdatedAt = conflict.serverUpdatedAt;
        const serverState = conflict.serverState || {};
        let localState;
        const merged = { ...serverState };
        const mergeLocal = () => {
          if (!localState) localState = this.collectLocalState();
          for (const [k, v] of Object.entries(localState)) {
            if (serverState[k] === undefined) merged[k] = v; // local-only key survives
          }
        };
        mergeLocal();
        // In-memory manager state is authoritative for keys this tab touched
        // since the last pull — but only for keys whose localStorage value
        // the manager actually MIRRORS (watchlistManager tracks customSymbols
        // in memory while user_watchlists lives only in storage, so memory
        // must not resurrect a storage key the cloud just refreshed).
        const memState = this.collectLocalState();
        const memAuthoritative = { paperAccounts: true, watchlists: true, alerts: true, userWatchlists: false, profile: true, tradeJournal: true };
        for (const [k, v] of Object.entries(memState)) {
          if (merged[k] === undefined && memAuthoritative[k] !== false) merged[k] = v;
        }
        // Union list-valued keys that managers cache in memory — computed
        // BEFORE apply (apply makes in-memory == merged, losing additions).
        try {
          const tj = this.app?.tradeJournal;
          if (tj?.sampleExecutions?.length) {
            const cloud = JSON.parse(merged.tradeJournal || '[]');
            const byId = new Map(cloud.map(a => [a.id, a]));
            for (const loc of tj.sampleExecutions) if (loc?.id && !byId.has(loc.id)) byId.set(loc.id, loc);
            merged.tradeJournal = JSON.stringify([...byId.values()]);
          }
          const wl = this.app?.watchlist;
          if (wl?.customSymbols?.length) {
            const cloud = JSON.parse(merged.watchlists || '[]');
            const union = new Set([...cloud, ...wl.customSymbols]);
            merged.watchlists = JSON.stringify([...union]);
          }
          const al = this.app?.alertsManager;
          if (al?.alerts?.length) {
            const cloud = JSON.parse(merged.alerts || '[]');
            const byId = new Map(cloud.map(a => [a.id, a]));
            for (const loc of al.alerts) if (loc?.id && !byId.has(loc.id)) byId.set(loc.id, loc);
            merged.alerts = JSON.stringify([...byId.values()]);
          }
          const pt = this.app?.paperTrading;
          if (pt?.accounts?.length) {
            const inCloud = new Map(JSON.parse(merged.paperAccounts || '[]').map(a => [a.id, a]));
            for (const loc of pt.accounts) if (loc?.id && !inCloud.has(loc.id)) inCloud.set(loc.id, loc);
            merged.paperAccounts = JSON.stringify([...inCloud.values()]);
          }
        } catch (e) { /* non-fatal */ }
        this.applyCloudState(merged);
        this.app?.onCloudStateApplied?.(merged);
        // Re-collect AFTER reload for memory-mirrored keys only.
        const afterState = this.collectLocalState();
        for (const [k, v] of Object.entries(afterState)) {
          if (merged[k] === undefined && memAuthoritative[k] !== false) merged[k] = v;
        }
        this.lastSyncError = 'conflict';
        // Rebase resolved → push the merged view once with the fresh base.
        // Direct fetch (not recursion) so syncInFlight never wedges.
        try {
          const retry = await fetch('/api/user/state', {
            method: 'PUT', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: merged, baseUpdatedAt: this.cloudUpdatedAt })
          });
          if (retry.ok) {
            const d2 = await retry.json();
            this.cloudUpdatedAt = d2.updatedAt;
            this.lastSyncError = null;
            this.lastSyncAt = Date.now();
          }
        } catch (e) { /* next auto-sync tick retries */ }
      } else if (res.ok) {
        const data = await res.json();
        this.cloudUpdatedAt = data.updatedAt;
        this.lastSyncError = null;
        this.lastSyncAt = Date.now();
      } else {
        const data = await res.json().catch(() => ({}));
        this.lastSyncError = data.error || 'sync_failed';
      }
    } catch (e) {
      this.lastSyncError = 'network';
    } finally {
      this.syncInFlight = false;
    }
  }

  startAutoSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    // Debounced periodic push; storage mutations also trigger via observeStorage.
    this.syncTimer = setInterval(() => {
      if (this.user && this.syncEnabled && this._dirty) {
        this._dirty = false;
        this.pushCloudState();
      }
    }, 8000);
    if (this.syncTimer.unref) this.syncTimer.unref();
  }

  observeStorage() {
    window.addEventListener('storage-write', (e) => { this._dirty = true; });
  }

  // ── API helpers ─────────────────────────────────────────────────────────
  async api(path, { method = 'POST', body } = {}) {
    const res = await fetch(`/api/auth/${path}`, {
      method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok && data.ok !== false, data };
  }

  syncAuthUserToProfile() {
    if (!this.user || !this.app?.userProfileModal) return;
    const up = this.app.userProfileModal;
    if (this.user.displayName) up.profile.name = this.user.displayName;
    if (this.user.username) up.profile.handle = this.user.username;
    if (this.user.bio) up.profile.bio = this.user.bio;
    if (this.user.avatarPreset) {
      const icon = (AVATAR_PRESETS.find(a => a.id === this.user.avatarPreset) || {}).icon;
      if (icon) up.profile.avatar = icon;
    }
    if (this.user.timezone) up.profile.timezone = this.user.timezone;
    if (this.user.currency) up.profile.currency = this.user.currency;
    up.saveProfile(false);
    up.syncTopbarAvatar?.();
  }

  async register({ email, username, password, displayName }) {
    const r = await this.api('register', { body: { email, username, password, displayName } });
    if (r.ok) {
      this.user = r.data.user;
      this.entitlements = PLANS[this.plan()] || PLANS.basic;
      this.stashGuestMirror();
      await this.pullCloudState();
      this.syncAuthUserToProfile();
      this.renderAccountBadge();
      this.startAutoSync();
    }
    return r;
  }

  async login({ identity, password, totpCode }) {
    const body = { identity, password };
    if (totpCode !== undefined) body.totpCode = totpCode;
    const r = await this.api('login', { body });
    if (r.ok && r.data.totpRequired) {
      // 2FA second step pending — caller must collect the code and retry.
      return r;
    }
    if (r.ok) {
      this.user = r.data.user;
      this.entitlements = PLANS[this.plan()] || PLANS.basic;
      this.stashGuestMirror();
      // Snapshot the pre-pull UI language: the cloud pull may carry an older
      // stored preference that would silently flip the user's current choice.
      const prePullLang = getLanguage();
      await this.pullCloudState();
      if (getLanguage() !== prePullLang) {
        // Prefer the live UI language the user was just interacting with.
        this.app?.switchLanguage?.(prePullLang);
      }
      this.syncAuthUserToProfile();
      this.renderAccountBadge();
      this.startAutoSync();
    }
    return r;
  }

  // ── 2FA (TOTP) helpers ──────────────────────────────────────────────────
  async twofaSetup() { return this.api('2fa/setup'); }
  async twofaEnable(code) {
    const r = await this.api('2fa/enable', { body: { code } });
    if (r.ok && this.user) this.user.totpEnabled = true;
    return r;
  }
  async twofaDisable(password, code) {
    const r = await this.api('2fa/disable', { body: { password, code } });
    if (r.ok && this.user) this.user.totpEnabled = false;
    return r;
  }

  async logout() {
    if (this.user) this.stashGuestMirror();
    const r = await this.api('logout');
    this.user = null;
    this.entitlements = PLANS.basic;
    this.cloudUpdatedAt = 0;
    if (this.app?.userProfileModal) {
      this.app.userProfileModal.profile = this.app.userProfileModal.loadProfile();
      this.app.userProfileModal.syncTopbarAvatar?.();
    }
    this.renderAccountBadge();
    this.app?.onAuthChanged?.('logout');
    return r;
  }

  async updateProfile(patch) {
    const r = await this.api('me', { method: 'PATCH', body: patch });
    if (r.ok) {
      this.user = r.data.user;
      if (this.app?.userProfileModal) {
        const up = this.app.userProfileModal;
        if (patch.displayName) up.profile.name = patch.displayName;
        if (patch.username) up.profile.handle = patch.username;
        if (patch.bio !== undefined) up.profile.bio = patch.bio;
        if (patch.timezone) up.profile.timezone = patch.timezone;
        if (patch.currency) up.profile.currency = patch.currency;
        if (patch.avatarPreset) {
          const icon = (AVATAR_PRESETS.find(a => a.id === patch.avatarPreset) || {}).icon;
          if (icon) up.profile.avatar = icon;
        }
        up.saveProfile(false);
        up.syncTopbarAvatar?.();
      }
      this.renderAccountBadge();
    }
    return r;
  }

  async changePassword(current, next) {
    return this.api('change-password', { body: { current, next } });
  }

  async requestReset(email) { return this.api('request-reset', { body: { email } }); }

  async resetPassword({ identity, code, password }) { return this.api('reset', { body: { identity, code, password } }); }

  async verifyEmail(code) {
    const r = await this.api('verify', { body: { code } });
    if (r.ok) { this.user = r.data.user; this.renderAccountBadge(); }
    return r;
  }

  async requestVerifyCode() { return this.api('request-verify'); }

  async setPlan(planId) {
    const res = await fetch('/api/user/plan', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planId })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok && data.pending) {
      this.user = data.user;
      return { ok: true, data };
    }
    if (res.ok && data.ok) {
      this.user = data.user;
      this.entitlements = PLANS[this.plan()] || PLANS.basic;
      this.renderAccountBadge();
      this.app?.onPlanChanged?.(this.plan());
    }
    return { ok: res.ok && data.ok, data };
  }

  async cancelPlanRequest() {
    const res = await fetch('/api/user/plan-request', { method: 'DELETE', credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) this.user = data.user;
    return { ok: res.ok && data.ok, data };
  }

  async switchPlanWithStateGuard(planId) {
    // Downgrade or switch: the server enforces array limits on next sync.
    return this.setPlan(planId);
  }

  // ── UI: header badge + account menu ─────────────────────────────────────
  renderAccountBadge() {
    const badge = document.querySelector('.user-avatar-badge');
    if (!badge) return;
    const circle = badge.querySelector('.avatar-circle');
    const isFa = getLanguage() === 'fa';
    if (this.user) {
      // Account avatar preset wins over initials (TradingView avatar parity).
      const preset = AVATAR_PRESETS.find(a => a.id === this.user.avatarPreset);
      if (preset && preset.id !== 'initials') {
        if (circle) circle.textContent = preset.icon;
      } else {
        const initials = this.user.displayName
          ? this.user.displayName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
          : this.user.username.slice(0, 2).toUpperCase();
        if (circle) circle.textContent = initials || 'TC';
        }
        const giftHint = this.hasActiveGift() ? (isFa ? ' (اشتراک هدیه)' : ' (Gift subscription)') : '';
        badge.title = `${this.user.displayName || this.user.username} · ${this.planLabel()}${giftHint} · ${this.user.email}`;
        badge.dataset.auth = 'in';
        badge.dataset.plan = this.plan();
    } else {
      const up = this.app?.userProfileModal?.profile || (() => {
        try {
          const raw = localStorage.getItem('tradingchart_user_profile');
          return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
      })();
      if (circle) {
        if (up?.avatar) circle.textContent = up.avatar;
        else circle.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      }
      badge.title = `${up?.name || 'Trader'} (@${up?.handle || 'guest'}) — ${isFa ? 'میز دمو' : 'Demo Desk'}`;
      badge.dataset.auth = 'out';
      badge.dataset.plan = 'basic';
    }
  }

  planLabel() {
    const isFa = getLanguage() === 'fa';
    const names = { basic: isFa ? 'پایه' : 'Basic', essential: isFa ? 'اسنشیال' : 'Essential', plus: isFa ? 'پلاس' : 'Plus', premium: isFa ? 'پریمیوم' : 'Premium', ultimate: isFa ? 'آلتیمیت' : 'Ultimate' };
    return names[this.plan()] || this.plan();
  }

  bindAvatar() {
    const badge = document.querySelector('.user-avatar-badge');
    if (!badge) return;
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      // Sync the flag with the DOM: an externally-removed menu (suite cleanup,
      // overlay click, Escape elsewhere) must not leave us thinking it's open.
      if (!document.querySelector('#tc-account-menu')) this.menuOpen = false;
      if (this.menuOpen) {
        this.closeAccountMenu();
      } else {
        this.openAccountMenu();
        this.app?.userProfileModal?.open?.();
      }
    });
    document.addEventListener('click', (e) => {
      if (this.menuOpen && !e.target.closest('#tc-account-menu') && !e.target.closest('.user-avatar-badge')) {
        this.closeAccountMenu();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.menuOpen) {
        this.closeAccountMenu();
      }
    });
  }

  openAccountMenu() {
    if (document.querySelector('#tc-account-menu')) { this.closeAccountMenu(); return; }
    const isFa = getLanguage() === 'fa';
    const badge = document.querySelector('.user-avatar-badge');
    const rect = badge.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'tc-account-menu';
    menu.dir = isFa ? 'rtl' : 'ltr';
    const body = this.user ? this.menuBodySignedIn(isFa) : this.menuBodyGuest(isFa);
    menu.innerHTML = body;
    // Anchor the menu to whichever viewport side the avatar sits on, then
    // clamp inside the viewport — correct for RTL (avatar left) and LTR
    // (avatar right) layouts, and for narrow mobile widths.
    const vw = window.innerWidth;
    const centerX = rect.left + rect.width / 2;
    const menuW = 264;
    let left = centerX < vw / 2 ? rect.left : rect.right - menuW;
    left = Math.max(8, Math.min(left, vw - menuW - 8));
    menu.style.cssText = `position: fixed; top: ${Math.min(rect.bottom + 6, window.innerHeight - 60)}px; left: ${left}px; z-index: 99998; min-width: 250px; max-width: ${vw - 16}px; background: var(--bg-card, #151c2d); border: 1px solid var(--border-subtle); border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); overflow: hidden; font-size: 12px; color: var(--text-main, #e6e9f0);`;
    document.body.appendChild(menu);
    this.menuOpen = true;
    menu.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      this.closeAccountMenu();
      this.handleMenuAction(act);
    });
    setTimeout(() => menu.classList.add('open'), 10);
  }

  menuBodySignedIn(isFa) {
    const u = this.user;
    const verified = u.emailVerified
      ? `<span style="color: var(--accent-cyan, #00F2B0);">✓ ${isFa ? 'تأییدشده' : 'Verified'}</span>`
      : `<span style="color: #f59e0b; cursor: pointer;" data-act="verify">${isFa ? 'تأیید ایمیل' : 'Verify email'}</span>`;
    const planBadge = `<span style="background: rgba(0,242,176,0.12); color: var(--accent-cyan, #00F2B0); padding: 2px 8px; border-radius: 20px; font-weight: 700; font-size: 10px;">${this.planLabel()}</span>`;
    const gift = this.giftInfo();
    let giftBadgeHtml = '';
    let giftRowHtml = '';
    if (gift) {
      const expiryText = formatGiftExpiry(gift.expiresAt, isFa);
      giftBadgeHtml = `<span class="badge-gift" style="background: rgba(59,130,246,0.18); color: #60a5fa; border: 1px solid rgba(59,130,246,0.35); padding: 2px 8px; border-radius: 20px; font-weight: 700; font-size: 10px; display:inline-flex; align-items:center; gap:3px;">🎁 ${isFa ? 'اشتراک هدیه' : 'Gift subscription'}</span>`;
      giftRowHtml = `<div class="tc-gift-expiry-row" style="font-size: 11px; color: #93c5fd; display:flex; align-items:center; gap:5px; margin-top:2px;">
        <span style="opacity:0.85;">${isFa ? 'اعتبار هدیه:' : 'Gift expiry:'}</span>
        <strong style="font-weight:700;">${expiryText}</strong>
      </div>`;
    }
    return `
      <div style="padding: 12px 14px; border-bottom: 1px solid var(--border-subtle); display:flex; flex-direction:column; gap:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <strong style="font-size:13px;">${escapeHtml(u.displayName || u.username)}</strong>
          <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
            ${planBadge}
            ${giftBadgeHtml}
          </div>
        </div>
        <div style="color: var(--text-dim, #8b93a7); direction:ltr; text-align:${isFa ? 'right' : 'left'}; font-size:11px;">${escapeHtml(u.email)} · ${verified}</div>
        ${giftRowHtml}
      </div>
      <div style="padding: 6px;">
        ${this.menuItem('profile', isFa ? 'پروفایل و تنظیمات' : 'Profile & Settings', '👤')}
        ${this.menuItem('account', isFa ? 'حساب و صورت‌حساب' : 'Account & Billing', '🧾')}
        ${this.menuItem('plans', isFa ? 'پلن‌ها و ارتقا' : 'Plans & Upgrade', '⭐')}
        ${this.isAdmin() ? this.menuItem('plan-admin', isFa ? 'پنل مدیریت پلتفرم' : 'Admin Console', '🛡️') : ''}
        ${this.menuItem('devices', isFa ? 'دستگاه‌های فعال' : 'Active Devices', '📱')}
        ${this.menuItem('sync', this.syncEnabled ? (isFa ? 'همگام‌سازی: روشن' : 'Sync: On') : (isFa ? 'همگام‌سازی: خاموش' : 'Sync: Off'), '☁️')}
        <div style="border-top: 1px solid var(--border-subtle); margin: 6px 0;"></div>
        ${this.menuItem('logout', isFa ? 'خروج از حساب' : 'Sign Out', '🚪')}
      </div>`;
  }

  menuBodyGuest(isFa) {
    return `
      <div style="padding: 14px; border-bottom: 1px solid var(--border-subtle);">
        <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${isFa ? 'حساب کاربری ندارید' : 'No account yet'}</div>
        <div style="color: var(--text-dim, #8b93a7); font-size: 11px; line-height: 1.5;">${isFa ? 'برای ذخیره ابری تنظیمات، واچ‌لیست‌ها و چیدمان‌ها وارد شوید.' : 'Sign in to sync your settings, watchlists and layouts to the cloud.'}</div>
      </div>
      <div style="padding: 6px;">
        ${this.menuItem('profile', isFa ? 'پروفایل و کارنامه معامله‌گر' : 'Trader Profile & Stats', '👤')}
        ${this.menuItem('login', isFa ? 'ورود به حساب' : 'Sign In', '→')}
        ${this.menuItem('signup', isFa ? 'ایجاد حساب رایگان' : 'Create Free Account', '✦')}
        ${this.menuItem('plans', isFa ? 'مقایسه پلن‌ها' : 'Compare Plans', '⭐')}
        ${this.menuItem('data', isFa ? 'پشتیبان‌گیری جامع و بازیابی' : 'Full Backup & Restore', '🛡️')}
      </div>`;
  }

  menuItem(act, label, icon) {
    return `<div data-act="${act}" role="menuitem" tabindex="0" style="padding: 9px 14px; cursor: pointer; display:flex; align-items:center; gap:8px;" class="tc-menu-item"><span style="width:18px; text-align:center;">${icon}</span><span>${label}</span></div>`;
  }

  closeAccountMenu() {
    document.querySelector('#tc-account-menu')?.remove();
    this.menuOpen = false;
  }

  handleMenuAction(act) {
    if (act !== 'profile' && act !== 'data') {
      document.querySelector('#modal-user-profile')?.classList.remove('open');
    }
    switch (act) {
      case 'profile': this.app?.userProfileModal?.open?.(); break;
      case 'data': this.app?.userProfileModal?.open?.('data'); break;
      case 'account': this.openAccountSettingsModal(); break;
      case 'plans': this.openPlansModal(); break;
      case 'plan-admin': this.openPlanAdminStudio('dashboard'); break;
      case 'devices': this.openDevicesModal(); break;
      case 'sync': this.toggleSync(); break;
      case 'logout': this.logout(); break;
      case 'login': this.openAuthModal('login'); break;
      case 'signup': this.openAuthModal('signup'); break;
      case 'verify': this.openVerifyFlow(); break;
    }
  }

  toggleSync() {
    this.syncEnabled = !this.syncEnabled;
    try { localStorage.setItem('tradingchart_sync_enabled', this.syncEnabled ? '1' : '0'); } catch (e) {}
    const isFa = getLanguage() === 'fa';
    this.app?.showToast?.(
      this.syncEnabled ? (isFa ? 'همگام‌سازی ابری فعال شد' : 'Cloud sync enabled') : (isFa ? 'همگام‌سازی ابری خاموش شد' : 'Cloud sync disabled'),
      this.syncEnabled ? 'success' : 'info'
    );
  }

  // ── Auth modal (login / signup / reset / verify) ────────────────────────
  openAuthModal(mode = 'login', { prefill = {} } = {}) {
    document.querySelector('#tc-auth-modal')?.remove();
    const isFa = getLanguage() === 'fa';
    const overlay = document.createElement('div');
    overlay.id = 'tc-auth-modal';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(6px); z-index:99999; display:flex; align-items:center; justify-content:center;';
    overlay.innerHTML = this.authModalHtml(mode, isFa, prefill);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-close]')?.addEventListener('click', close);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    this.bindAuthModal(overlay, mode, isFa);
    setTimeout(() => overlay.querySelector('input:not([type=hidden])')?.focus(), 60);
  }

  authModalHtml(mode, isFa, prefill) {
    const title = mode === 'signup'
      ? (isFa ? 'ایجاد حساب کاربری' : 'Create your account')
      : (isFa ? 'ورود به حساب' : 'Sign in');
    const tabs = `
      <div style="display:flex; gap:4px; padding: 0 18px; margin-top: 10px;">
        <button data-tab="login" class="tc-auth-tab ${mode === 'login' ? 'active' : ''}" style="flex:1; padding:8px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; border:1px solid ${mode === 'login' ? 'var(--accent-cyan,#00F2B0)' : 'var(--border-subtle)'}; background:${mode === 'login' ? 'rgba(0,242,176,0.08)' : 'transparent'}; color:${mode === 'login' ? 'var(--accent-cyan,#00F2B0)' : 'var(--text-dim,#8b93a7)'};">${isFa ? 'ورود' : 'Sign In'}</button>
        <button data-tab="signup" class="tc-auth-tab ${mode === 'signup' ? 'active' : ''}" style="flex:1; padding:8px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; border:1px solid ${mode === 'signup' ? 'var(--accent-cyan,#00F2B0)' : 'var(--border-subtle)'}; background:${mode === 'signup' ? 'rgba(0,242,176,0.08)' : 'transparent'}; color:${mode === 'signup' ? 'var(--accent-cyan,#00F2B0)' : 'var(--text-dim,#8b93a7)'};">${isFa ? 'ثبت‌نام' : 'Sign Up'}</button>
      </div>`;
    const body = mode === 'signup' ? `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${this.fieldHtml('displayName', isFa ? 'نام نمایشی' : 'Display name', 'text', prefill.displayName || '', isFa ? 'مثال: حسین محمدی' : 'e.g. John Trader')}
        ${this.fieldHtml('email', isFa ? 'ایمیل' : 'Email', 'email', prefill.email || '', isFa ? 'you@example.com' : 'you@example.com')}
        ${this.fieldHtml('username', isFa ? 'نام کاربری' : 'Username', 'text', prefill.username || '', isFa ? 'حروف انگلیسی، رقم و زیرخط (۳ تا ۲۴)' : 'letters, digits, underscore (3–24)')}
        ${this.fieldHtml('password', isFa ? 'گذرواژه' : 'Password', 'password', '', isFa ? 'حداقل ۸ کاراکتر شامل حرف و رقم' : 'min 8 chars, letters + digits')}
        <div id="tc-auth-error" style="display:none; color:#f87171; font-size:11px; line-height:1.5;"></div>
        <button id="tc-auth-submit" class="btn-primary" style="padding:11px; font-size:13px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'ایجاد حساب' : 'Create Account'}</button>
        <div style="font-size:10px; color:var(--text-dim,#8b93a7); text-align:center; line-height:1.6;">${isFa ? 'با ایجاد حساب، شرایط استفاده از سرویس را می‌پذیرید. پلن پایه رایگان است و کارت بانکی لازم ندارد.' : 'By creating an account you agree to the Terms of Service. The Basic plan is free — no credit card needed.'}</div>
      </div>` : `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${this.fieldHtml('identity', isFa ? 'ایمیل یا نام کاربری' : 'Email or username', 'text', prefill.identity || '', isFa ? 'you@example.com' : 'you@example.com')}
        ${this.fieldHtml('password', isFa ? 'گذرواژه' : 'Password', 'password', '', '••••••••')}
        <div id="tc-auth-error" style="display:none; color:#f87171; font-size:11px;"></div>
        <button id="tc-auth-submit" class="btn-primary" style="padding:11px; font-size:13px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'ورود' : 'Sign In'}</button>
        <button id="tc-auth-forgot" style="background:none; border:none; color:var(--text-dim,#8b93a7); font-size:11px; cursor:pointer; text-decoration:underline;">${isFa ? 'گذرواژه را فراموش کرده‌اید؟' : 'Forgot your password?'}</button>
      </div>`;
    return `
      <div class="modal-box" style="max-width:400px; width:92vw; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.85); overflow:hidden; ${isFa ? 'direction:rtl; font-family:var(--font-vazirmatn),sans-serif;' : ''}">
        <div style="padding:14px 18px; background:var(--bg-surface,#0c1017); border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:800; font-size:14px; color:#fff;">${title}</span>
          <button data-close style="background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); color:var(--text-dim,#8b93a7); cursor:pointer; width:32px; height:32px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-size:14px;">✕</button>
        </div>
        ${tabs}
        <div id="tc-auth-body" style="padding:16px 18px 18px;"><div id="tc-auth-fields">${body}</div></div>
      </div>`;
  }

  fieldHtml(name, label, type, value, placeholder) {
    const ltr = type === 'email' || type === 'password' || name === 'username' || name === 'identity';
    const style = 'padding:9px 11px; font-size:13px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; width:100%; box-sizing:border-box;' + (ltr ? ' direction:ltr; text-align:left;' : '');
    return `<label style="display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--text-dim,#8b93a7); font-weight:600;">
      <span>${label}</span>
      <input name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="${type === 'password' ? 'current-password' : 'on'}" ${ltr ? 'dir="ltr"' : ''} style="${style}" />
    </label>`;
  }

  bindAuthModal(overlay, mode, isFa) {
    const switchTab = (m) => this.openAuthModal(m);
    overlay.querySelectorAll('.tc-auth-tab').forEach(b =>
      b.addEventListener('click', () => switchTab(b.dataset.tab)));

    const errBox = overlay.querySelector('#tc-auth-error');
    const showErr = (msg) => { if (errBox) { errBox.textContent = msg; errBox.style.display = 'block'; } };
    const errText = (errors) => {
      const map = {
        invalid_email: isFa ? 'ایمیل معتبر نیست.' : 'Invalid email address.',
        email_taken: isFa ? 'این ایمیل قبلاً ثبت شده است.' : 'This email is already registered.',
        invalid_username: isFa ? 'نام کاربری باید ۳ تا ۲۴ کاراکتر انگلیسی، رقم، زیرخط یا خط تیره باشد.' : 'Username must be 3–24 letters, digits, underscores or hyphens.',
        username_taken: isFa ? 'این نام کاربری قبلاً گرفته شده است.' : 'This username is taken.',
        username_blocked: isFa ? 'این نام کاربری مجاز نیست (واژه محفوظ).' : 'This username is not allowed (reserved word).',
        invalid_totp: isFa ? 'کد تأیید دو مرحله‌ای معتبر نیست.' : 'Invalid two-factor code.',
        password_weak: isFa ? 'گذرواژه باید حداقل ۸ کاراکتر و شامل حرف و رقم باشد.' : 'Password needs 8+ chars incl. letters & digits.',
        password_length: isFa ? 'گذرواژه باید حداقل ۸ کاراکتر باشد.' : 'Password must be at least 8 characters.',
        invalid_credentials: isFa ? 'ایمیل/نام کاربری یا گذرواژه نادرست است.' : 'Incorrect email/username or password.',
        account_suspended: isFa ? 'این حساب کاربری توسط مدیریت تعلیق شده است. برای پیگیری با پشتیبانی تماس بگیرید.' : 'This account has been suspended by an administrator. Please contact support.',
        registration_closed: isFa ? 'ثبت‌نام کاربر جدید در حال حاضر غیرفعال است.' : 'New registrations are currently closed.',
        maintenance: isFa ? 'سامانه در حال به‌روزرسانی و نگهداری است؛ لطفاً کمی بعد دوباره تلاش کنید.' : 'The platform is under maintenance — please try again shortly.',
        rate_limited: isFa ? 'تلاش‌های بیش از حد؛ کمی بعد دوباره امتحان کنید.' : 'Too many attempts — try again shortly.',
        network: isFa ? 'خطای شبکه — اتصال خود را بررسی کنید.' : 'Network error — check your connection.'
      };
      if (Array.isArray(errors)) return errors.map(e => map[e.code] || e.code).join(' ');
      return map[errors] || (isFa ? 'خطای نامشخص رخ داد.' : 'An unexpected error occurred.');
    };

    // 2FA second-step UI: swap the login form for a TOTP code prompt, keeping
    // the identity/password the user already typed so retry needs only the code.
    const showTotpStep = (vals) => {
      if (errBox) errBox.style.display = 'none';
      const fieldsWrap = overlay.querySelector('#tc-auth-fields');
      if (!fieldsWrap) return;
      const prevHtml = fieldsWrap.innerHTML;
      fieldsWrap.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="font-size:12px; color:var(--text-dim,#8b93a7); line-height:1.7;">
            ${isFa ? 'این حساب با احراز هویت دو مرحله‌ای محافظت می‌شود. کد ۶ رقمی برنامه Authenticator خود را وارد کنید.' : 'This account is protected with two-factor authentication. Enter the 6-digit code from your authenticator app.'}
          </div>
          <input id="tc-totp-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="${isFa ? 'کد ۶ رقمی' : '6-digit code'}"
            style="padding:11px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; direction:ltr; text-align:center; letter-spacing:6px; font-size:18px; outline:none;" />
          <div id="tc-auth-error" style="display:none; color:#f87171; font-size:11px;"></div>
          <button id="tc-totp-submit" class="btn-primary" style="padding:10px; font-size:13px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'تأیید و ورود' : 'Verify & sign in'}</button>
          <button id="tc-totp-back" style="background:none; border:none; color:var(--text-dim,#8b93a7); font-size:11px; cursor:pointer;">${isFa ? '← بازگشت' : '← Back'}</button>
        </div>`;
      const codeInput = fieldsWrap.querySelector('#tc-totp-code');
      setTimeout(() => codeInput?.focus(), 50);
      const submitTotp = async () => {
        const btn = fieldsWrap.querySelector('#tc-totp-submit');
        btn.disabled = true;
        const r = await this.login({ identity: vals.identity, password: vals.password, totpCode: codeInput.value.trim() });
        btn.disabled = false;
        if (r.ok && !r.data.totpRequired) {
          overlay.remove();
          this.app?.showToast?.(isFa ? 'خوش آمدید!' : 'Welcome back!', 'success');
          this.app?.onAuthChanged?.('login');
        } else {
          codeInput.style.borderColor = '#f87171';
          showErr(isFa ? 'کد واردشده معتبر نیست؛ دوباره تلاش کنید.' : 'Invalid code — try again.');
        }
      };
      fieldsWrap.querySelector('#tc-totp-submit')?.addEventListener('click', submitTotp);
      codeInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitTotp(); } });
      fieldsWrap.querySelector('#tc-totp-back')?.addEventListener('click', () => { fieldsWrap.innerHTML = prevHtml; this.bindAuthModal(overlay, mode, isFa); });
    };

    overlay.querySelector('#tc-auth-forgot')?.addEventListener('click', () => {
      this.openResetModal();
    });

    const submit = async () => {
      const inputs = overlay.querySelectorAll('input');
      const vals = {};
      inputs.forEach(i => { vals[i.name] = i.value.trim(); });
      const btn = overlay.querySelector('#tc-auth-submit');
      btn.disabled = true;
      btn.style.opacity = '0.6';
      overlay.querySelectorAll('.tc-field-err').forEach(n => n.remove());
      overlay.querySelectorAll('input').forEach(i => { i.style.borderColor = ''; });
      const busyLabel = isFa ? 'در حال پردازش…' : 'Processing…';
      const origLabel = btn.textContent;
      btn.textContent = busyLabel;
      try {
        let r;
        if (mode === 'signup') {
          r = await this.register(vals);
        } else {
          r = await this.login(vals);
        }
        // 2FA second step: server validated the password and now wants a TOTP code.
        if (mode === 'login' && r.ok && r.data.totpRequired) {
          btn.disabled = false; btn.style.opacity = '1'; btn.textContent = origLabel;
          showTotpStep(vals);
          return;
        }
        if (r.ok) {
          overlay.remove();
          const isFa2 = getLanguage() === 'fa';
          this.app?.showToast?.(
            mode === 'signup'
              ? (isFa2 ? `خوش آمدید، ${this.user.displayName}! حساب شما ساخته شد.` : `Welcome, ${this.user.displayName}! Your account is ready.`)
              : (isFa2 ? 'خوش آمدید!' : 'Welcome back!'),
            'success'
          );
          if (mode === 'signup') this.openVerifyFlow();
          this.app?.onAuthChanged?.(mode);
        } else {
          const errs = Array.isArray(r.data.errors) ? r.data.errors : null;
          if (errs) {
            // Field-level hints, TradingView style: red border + message under
            // each offending input, plus the joined summary line.
            for (const e of errs) {
              const input = overlay.querySelector(`input[name="${e.field}"]`);
              if (input) {
                input.style.borderColor = '#f87171';
                const hint = document.createElement('div');
                hint.className = 'tc-field-err';
                hint.style.cssText = 'color:#f87171; font-size:10.5px; line-height:1.5;';
                hint.textContent = errText(e.code);
                input.parentElement.appendChild(hint);
              }
            }
          }
          showErr(errText(errs || r.data.error || 'network'));
        }
      } catch (e) {
        showErr(errText('network'));
      } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = origLabel;
      }
    };
    overlay.querySelector('#tc-auth-submit')?.addEventListener('click', submit);
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); }
    });
  }

  openResetModal() {
    document.querySelector('#tc-reset-modal')?.remove();
    const isFa = getLanguage() === 'fa';
    const overlay = document.createElement('div');
    overlay.id = 'tc-reset-modal';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(6px); z-index:100000; display:flex; align-items:center; justify-content:center;';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:380px; width:92vw; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:14px; overflow:hidden; ${isFa ? 'direction:rtl;' : ''}">
        <div style="padding:14px 18px; background:var(--bg-surface,#0c1017); border-bottom:1px solid var(--border-subtle); font-weight:800; font-size:14px; color:#fff; display:flex; justify-content:space-between;">
          <span>${isFa ? 'بازیابی گذرواژه' : 'Reset password'}</span>
          <button data-close style="background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:14px;">✕</button>
        </div>
        <div style="padding:18px; display:flex; flex-direction:column; gap:10px;">
          <div style="font-size:11px; color:var(--text-dim); line-height:1.6;">${window.__TC_EMAIL_DELIVERY__ ? (isFa ? 'ایمیل حساب خود را وارد کنید. کد ۶ رقمی بازیابی برایتان ارسال می‌شود.' : 'Enter your account email. A 6-digit reset code will be sent to you.') : (isFa ? 'ایمیل حساب خود را وارد کنید و سپس برای دریافت کد ۶ رقمی بازیابی با پشتیبانی چارتیویا تماس بگیرید.' : 'Enter your account email, then contact Chartivia support to receive your 6-digit reset code.')}</div>
          <input id="tc-reset-email" type="email" placeholder="${isFa ? 'you@example.com' : 'you@example.com'}" style="padding:9px 11px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; direction:ltr;" />
          <div id="tc-reset-step2" style="display:none; flex-direction:column; gap:10px;">
            <input id="tc-reset-code" type="text" inputmode="numeric" maxlength="6" placeholder="${isFa ? 'کد ۶ رقمی' : '6-digit code'}" style="padding:9px 11px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; direction:ltr; text-align:center; letter-spacing:4px; font-size:15px;" />
            <input id="tc-reset-pass" type="password" placeholder="${isFa ? 'گذرواژه جدید' : 'New password'}" style="padding:9px 11px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff;" />
          </div>
          <div id="tc-reset-error" style="display:none; color:#f87171; font-size:11px;"></div>
          <button id="tc-reset-submit" class="btn-primary" style="padding:10px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'ارسال کد' : 'Send code'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-close]').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    let step = 1;
    const err = overlay.querySelector('#tc-reset-error');
    const btn = overlay.querySelector('#tc-reset-submit');
    btn.onclick = async () => {
      const email = overlay.querySelector('#tc-reset-email').value.trim();
      if (step === 1) {
        if (!email) { err.textContent = isFa ? 'ایمیل را وارد کنید.' : 'Enter your email.'; err.style.display = 'block'; return; }
        btn.disabled = true;
        await this.requestReset(email);
        // Always proceed to step 2 regardless of account existence (no enumeration).
        step = 2;
        overlay.querySelector('#tc-reset-step2').style.display = 'flex';
        btn.textContent = isFa ? 'تغییر گذرواژه' : 'Set new password';
        btn.disabled = false;
        err.textContent = window.__TC_EMAIL_DELIVERY__ ? (isFa ? 'اگر حساب موجود باشد، کد به ایمیل آن ارسال شده است.' : 'If the account exists, the code has been sent to its email.') : (isFa ? 'درخواست ثبت شد؛ کد بازیابی را از پشتیبانی دریافت کنید.' : 'Request recorded; get your reset code from support.');
        err.style.color = '#8b93a7';
        err.style.display = 'block';
      } else {
        const code = overlay.querySelector('#tc-reset-code').value.trim();
        const pass = overlay.querySelector('#tc-reset-pass').value;
        const r = await this.resetPassword({ identity: email, code, password: pass });
        if (r.ok) {
          close();
          this.app?.showToast?.(isFa ? 'گذرواژه تغییر کرد؛ اکنون وارد شوید.' : 'Password changed; please sign in.', 'success');
        } else {
          err.style.color = '#f87171';
          err.textContent = r.data.error === 'invalid_code' ? (isFa ? 'کد نامعتبر یا منقضی است.' : 'Invalid or expired code.') : (isFa ? 'گذرواژه نامعتبر است.' : 'Invalid password.');
          err.style.display = 'block';
        }
      }
    };
  }

  openVerifyFlow() {
    if (!this.user) { this.openAuthModal('login'); return; }
    document.querySelector('#tc-verify-modal')?.remove();
    const isFa = getLanguage() === 'fa';
    const overlay = document.createElement('div');
    overlay.id = 'tc-verify-modal';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(6px); z-index:100000; display:flex; align-items:center; justify-content:center;';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:360px; width:92vw; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:14px; overflow:hidden; ${isFa ? 'direction:rtl;' : ''}">
        <div style="padding:14px 18px; background:var(--bg-surface,#0c1017); border-bottom:1px solid var(--border-subtle); font-weight:800; font-size:14px; color:#fff;">${isFa ? 'تأیید ایمیل' : 'Verify email'}</div>
        <div style="padding:18px; display:flex; flex-direction:column; gap:10px;">
          <div style="font-size:11px; color:var(--text-dim); line-height:1.6;">${window.__TC_EMAIL_DELIVERY__ ? (isFa ? `کد ۶ رقمی ارسال‌شده به <span dir="ltr">${escapeHtml(this.user.email)}</span> را وارد کنید.` : `Enter the 6-digit code sent to <span dir="ltr">${escapeHtml(this.user.email)}</span>.`) : (isFa ? `کد ۶ رقمی تأیید <span dir="ltr">${escapeHtml(this.user.email)}</span> را که از پشتیبانی دریافت کرده‌اید وارد کنید.` : `Enter the 6-digit verification code for <span dir="ltr">${escapeHtml(this.user.email)}</span> that you received from support.`)}</div>
          <input id="tc-verify-code" type="text" inputmode="numeric" maxlength="6" placeholder="••••••" style="padding:10px; text-align:center; letter-spacing:6px; font-size:16px; background:var(--bg-surface,#0c1017); border:1px solid var(--accent-cyan,#00F2B0); border-radius:7px; color:#fff; direction:ltr;" />
          <div id="tc-verify-error" style="display:none; color:#f87171; font-size:11px;"></div>
          <button id="tc-verify-submit" class="btn-primary" style="padding:10px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'تأیید' : 'Verify'}</button>
          <button id="tc-verify-resend" style="background:none; border:none; color:var(--text-dim,#8b93a7); font-size:11px; cursor:pointer; text-decoration:underline;">${isFa ? 'ارسال دوباره کد' : 'Resend code'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const err = overlay.querySelector('#tc-verify-error');
    overlay.querySelector('#tc-verify-submit').onclick = async () => {
      const r = await this.verifyEmail(overlay.querySelector('#tc-verify-code').value.trim());
      if (r.ok) {
        close();
        this.app?.showToast?.(isFa ? 'ایمیل شما تأیید شد ✓' : 'Email verified ✓', 'success');
      } else {
        err.textContent = r.data.error === 'invalid_code' ? (isFa ? 'کد نامعتبر یا منقضی است.' : 'Invalid or expired code.') : (isFa ? 'خطا رخ داد.' : 'Something went wrong.');
        err.style.display = 'block';
      }
    };
    overlay.querySelector('#tc-verify-resend').onclick = async () => {
      await this.requestVerifyCode();
      this.app?.showToast?.(isFa ? 'کد جدید ارسال شد.' : 'A new code was sent.', 'info');
    };
  }

  // ── Account & Billing modal (TradingView settings parity) ───────────────
  openAccountSettingsModal(tab = 'account') {
    if (!this.user) { this.openAuthModal('login'); return; }
    document.querySelector('#tc-account-settings-modal')?.remove();
    const isFa = getLanguage() === 'fa';
    const overlay = document.createElement('div');
    overlay.id = 'tc-account-settings-modal';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(6px); z-index:99998; display:flex; align-items:center; justify-content:center;';
    const tabs = [
      ['profile', isFa ? 'پروفایل عمومی' : 'Public profile'],
      ['account', isFa ? 'حساب' : 'Account'],
      ['security', isFa ? 'امنیت' : 'Security'],
      ['sessions', isFa ? 'دستگاه‌ها' : 'Sessions'],
      ['data', isFa ? 'داده‌ها' : 'Data']
    ];
    const tabbar = tabs.map(([id, label]) => `<button data-atab="${id}" style="padding:7px 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; border:1px solid ${tab === id ? 'var(--accent-cyan,#00F2B0)' : 'var(--border-subtle)'}; background:${tab === id ? 'rgba(0,242,176,0.08)' : 'transparent'}; color:${tab === id ? 'var(--accent-cyan,#00F2B0)' : 'var(--text-dim,#8b93a7)'};">${label}</button>`).join('');
    overlay.innerHTML = `
      <div class="modal-box" style="background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:14px; width:min(560px, calc(100vw - 24px)); max-height: min(86vh, 720px); overflow:auto; padding:18px; display:flex; flex-direction:column; gap:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:15px; font-weight:800;">${isFa ? 'حساب و صورت‌حساب' : 'Account & Billing'}</h3>
          <button data-close style="background:none; border:none; color:var(--text-dim,#8b93a7); font-size:16px; cursor:pointer;">✕</button>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">${tabbar}</div>
        <div id="tc-acc-body" style="display:flex; flex-direction:column; gap:12px;"></div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-close]')?.addEventListener('click', close);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    overlay.querySelectorAll('[data-atab]').forEach(b => b.addEventListener('click', () => this.openAccountSettingsModal(b.dataset.atab)));
    this.renderAccountTab(overlay, tab, isFa);
  }

  // ── Public profile tab (TradingView "Settings and billing → Public profile" parity) ──
  // Fields: avatar preset, display name, username (max 2 lifetime changes),
  // bio/about, location, signature, plan-gated social links, member-since date.
  renderProfileTab(body, u, isFa) {
    const sec = (title) => `<div style="font-size:11px; font-weight:800; color:var(--text-dim,#8b93a7); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">${title}</div>`;
    const plan = this.plan();
    const allowedSocial = { basic: ['x', 'youtube'], essential: ['x', 'youtube', 'facebook', 'instagram'], plus: ['x', 'youtube', 'facebook', 'instagram'], premium: ['x', 'youtube', 'facebook', 'instagram', 'website'], ultimate: ['x', 'youtube', 'facebook', 'instagram', 'website'] }[plan] || ['x', 'youtube'];
    const social = u.socialLinks || {};
    const socialMeta = [
      ['x', 'X', isFa ? 'نام کاربری X (بدون @)' : 'X handle (no @)'],
      ['youtube', 'YouTube', 'https://youtube.com/@channel'],
      ['facebook', 'Facebook', 'https://facebook.com/page'],
      ['instagram', 'Instagram', 'https://instagram.com/user'],
      ['website', isFa ? 'وب‌سایت' : 'Website', 'https://example.com']
    ];
    const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString(isFa ? 'fa-IR' : 'en-US', { year: 'numeric', month: 'long' }) : '—';
    const changesLeft = u.usernameChangesLeft ?? 2;

    const avatarGrid = AVATAR_PRESETS.map(av => {
      const sel = (u.avatarPreset || 'mecha') === av.id;
      return `<button type="button" class="pf-avatar-btn" data-avatar="${av.id}" title="${isFa ? av.nameFa : av.nameEn}"
        style="width:44px; height:44px; border-radius:10px; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center;
        background:${sel ? 'rgba(0,242,176,0.14)' : 'var(--bg-surface,#0c1017)'}; border:1px solid ${sel ? 'var(--accent-cyan,#00F2B0)' : 'var(--border-subtle)'};">${av.icon}</button>`;
    }).join('');

    const socialRows = socialMeta.map(([net, label, ph]) => {
      const locked = !allowedSocial.includes(net);
      return `
        <div style="display:flex; align-items:center; gap:8px;">
          <span data-no-i18n style="width:86px; flex-shrink:0; font-size:11px; font-weight:700; color:${locked ? 'var(--text-dim,#8b93a7)' : 'inherit'};">${label}${locked ? ' 🔒' : ''}</span>
          <input name="pf-social-${net}" value="${locked ? '' : escapeHtml(social[net] || '')}" placeholder="${locked ? (isFa ? 'نیازمند ارتقای پلن' : 'Upgrade plan') : ph}"
            ${locked ? 'disabled' : ''} dir="ltr"
            style="flex:1; min-width:0; padding:8px 10px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:${locked ? 'var(--text-dim,#8b93a7)' : '#fff'}; outline:none; box-sizing:border-box; text-align:left; opacity:${locked ? 0.55 : 1};" />
        </div>`;
    }).join('');

    body.innerHTML = `
      ${sec(isFa ? 'هویت عمومی' : 'Public identity')}
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        ${avatarGrid}
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${this.fieldHtml('pf-displayName', isFa ? 'نام نمایشی' : 'Display name', 'text', u.displayName || '', '')}
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim,#8b93a7);">${isFa ? 'نام کاربری' : 'Username'}</label>
          <input name="pf-username" dir="ltr" value="${escapeHtml(u.username)}"
            style="padding:9px 11px; font-size:13px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; width:100%; box-sizing:border-box; text-align:left;" />
          <div style="font-size:10px; color:${changesLeft > 0 ? 'var(--text-dim,#8b93a7)' : '#f59e0b'};">
            ${isFa
              ? (changesLeft > 0 ? `${toPersianDigits(String(changesLeft))} تغییر نام کاربری باقی مانده (حداکثر ۲ بار).` : 'سهمیه تغییر نام کاربری شما تمام شده است.')
              : (changesLeft > 0 ? `${changesLeft} username change${changesLeft === 1 ? '' : 's'} left (max 2).` : 'Username change limit reached.')}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim,#8b93a7);">${isFa ? 'درباره من' : 'About me'}</label>
          <textarea name="pf-bio" rows="2" maxlength="280" placeholder="${isFa ? 'حداکثر ۲۸۰ نویسه' : 'Max 280 chars'}"
            style="padding:9px 11px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; width:100%; box-sizing:border-box; resize:vertical; font-family:inherit;">${escapeHtml(u.bio || '')}</textarea>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <div style="flex:1; min-width:130px; display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim,#8b93a7);">${isFa ? 'موقعیت مکانی' : 'Location'}</label>
            <input name="pf-location" value="${escapeHtml(u.location || '')}" maxlength="80"
              style="padding:8px 10px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; box-sizing:border-box; width:100%;" />
          </div>
          <div style="flex:1; min-width:130px; display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim,#8b93a7);">${isFa ? 'امضا' : 'Signature'}</label>
            <input name="pf-signature" value="${escapeHtml(u.signature || '')}" maxlength="140"
              style="padding:8px 10px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; box-sizing:border-box; width:100%;" />
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <div style="flex:1; min-width:130px; display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim,#8b93a7);">${isFa ? 'منطقه زمانی' : 'Timezone'}</label>
            <select name="pf-timezone" style="padding:8px 10px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; box-sizing:border-box; width:100%;">
              ${[
                { id: 'Asia/Tehran', label: isFa ? 'تهران (UTC+3:30)' : 'Tehran (UTC+3:30)' },
                { id: 'Etc/UTC', label: 'UTC (UTC+0:00)' },
                { id: 'America/New_York', label: isFa ? 'نیویورک (EST)' : 'New York (EST)' },
                { id: 'Europe/London', label: isFa ? 'لندن (GMT)' : 'London (GMT)' },
                { id: 'Asia/Dubai', label: isFa ? 'دبی (UTC+4)' : 'Dubai (UTC+4)' },
                { id: 'Asia/Tokyo', label: isFa ? 'توکیو (JST)' : 'Tokyo (JST)' }
              ].map(tz => `<option value="${tz.id}" ${(u.timezone || 'Asia/Tehran') === tz.id ? 'selected' : ''}>${tz.label}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1; min-width:130px; display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim,#8b93a7);">${isFa ? 'ارز پایه' : 'Currency'}</label>
            <select name="pf-currency" style="padding:8px 10px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; box-sizing:border-box; width:100%;">
              ${['USD', 'EUR', 'GBP', 'USDT', 'BTC'].map(c => `<option value="${c}" ${(u.currency || 'USD') === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      ${sec(isFa ? 'پیوندهای شبکه‌های اجتماعی' : 'Social links')}
      <div style="display:flex; flex-direction:column; gap:6px;">${socialRows}</div>
      <div style="font-size:10px; color:var(--text-dim,#8b93a7); line-height:1.6;">
        ${isFa ? `عضویت از ${joined} · شبکه‌های دردسترس به پلن شما بستگی دارد.` : `Member since ${joined} · Available networks depend on your plan.`}
      </div>
      <div id="pf-msg" style="display:none; font-size:11px; line-height:1.5;"></div>
      <button id="pf-save" class="btn-primary" style="padding:9px; font-size:12px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'ذخیره پروفایل' : 'Save profile'}</button>`;

    let pickedAvatar = u.avatarPreset || 'mecha';
    body.querySelectorAll('.pf-avatar-btn').forEach(btn => btn.addEventListener('click', () => {
      pickedAvatar = btn.dataset.avatar;
      body.querySelectorAll('.pf-avatar-btn').forEach(b => {
        const sel = b.dataset.avatar === pickedAvatar;
        b.style.background = sel ? 'rgba(0,242,176,0.14)' : 'var(--bg-surface,#0c1017)';
        b.style.border = `1px solid ${sel ? 'var(--accent-cyan,#00F2B0)' : 'var(--border-subtle)'}`;
      });
    }));

    body.querySelector('#pf-save')?.addEventListener('click', async () => {
      const msg = body.querySelector('#pf-msg');
      msg.style.display = 'block';
      const patch = {
        displayName: body.querySelector('input[name="pf-displayName"]').value,
        username: body.querySelector('input[name="pf-username"]').value,
        bio: body.querySelector('textarea[name="pf-bio"]').value,
        location: body.querySelector('input[name="pf-location"]').value,
        signature: body.querySelector('input[name="pf-signature"]').value,
        timezone: body.querySelector('select[name="pf-timezone"]')?.value || u.timezone || 'Asia/Tehran',
        currency: body.querySelector('select[name="pf-currency"]')?.value || u.currency || 'USD',
        avatarPreset: pickedAvatar,
        socialLinks: Object.fromEntries(socialMeta
          .filter(([net]) => allowedSocial.includes(net))
          .map(([net]) => [net, body.querySelector(`input[name="pf-social-${net}"]`)?.value || '']))
      };
      const r = await this.updateProfile(patch);
      if (r.ok) {
        msg.style.color = 'var(--accent-cyan,#00F2B0)';
        msg.textContent = isFa ? 'پروفایل ذخیره شد.' : 'Profile saved.';
        this.app?.showToast?.(isFa ? 'پروفایل عمومی به‌روزرسانی شد' : 'Public profile updated', 'success');
        this.app?.userProfileModal && (this.app.userProfileModal.profile.avatar = (AVATAR_PRESETS.find(a => a.id === pickedAvatar) || {}).icon || '🦾');
        // refresh to update usernameChangesLeft hint
        const ov = body.closest('.modal-overlay');
        if (ov) this.renderProfileTab(body, this.user, isFa);
      } else {
        const code = r.data.errors?.[0]?.code || r.data.error;
        const msgs = {
          username_taken: isFa ? 'این نام کاربری قبلاً گرفته شده است.' : 'This username is taken.',
          username_blocked: isFa ? 'این نام کاربری مجاز نیست (واژه محفوظ).' : 'This username is not allowed (reserved word).',
          username_limit: isFa ? 'سهمیه تغییر نام کاربری (۲ بار) تمام شده است.' : 'Username change limit (2) reached.',
          invalid_username: isFa ? 'نام کاربری باید ۳ تا ۲۴ کاراکتر انگلیسی، رقم، زیرخط یا خط تیره باشد.' : 'Username must be 3–24 letters, digits, underscore or hyphen.',
          plan_required: isFa ? 'این شبکه اجتماعی نیازمند ارتقای پلن است.' : 'This social network requires a plan upgrade.',
          invalid_link: isFa ? 'قالب پیوند معتبر نیست.' : 'Invalid link format.'
        };
        msg.style.color = '#f87171';
        msg.textContent = msgs[code] || (isFa ? 'ذخیره ناموفق بود.' : 'Save failed.');
      }
    });
  }

  async renderAccountTab(overlay, tab, isFa) {
    const body = overlay.querySelector('#tc-acc-body');
    if (!body) return;
    const u = this.user;
    const sec = (title) => `<div style="font-size:11px; font-weight:800; color:var(--text-dim,#8b93a7); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">${title}</div>`;
    const row = (k, v) => `<div style="display:flex; justify-content:space-between; gap:10px; font-size:12px; padding:5px 0; border-bottom:1px dashed var(--border-subtle);"><span style="color:var(--text-dim,#8b93a7);">${k}</span><span style="font-weight:600;">${v}</span></div>`;

    if (tab === 'profile') {
      this.renderProfileTab(body, u, isFa);
      return;
    }

    if (tab === 'account') {
      // Render the static identity + plan cards immediately, then fill usage
      // rows when the fetch resolves — the modal is never left empty.
      const verified = u.emailVerified
        ? `<span style="color: var(--accent-cyan,#00F2B0); font-size:11px;">✓ ${isFa ? 'ایمیل تأیید شده' : 'Email verified'}</span>`
        : `<button id="acc-verify-btn" style="background:rgba(0,242,176,0.12); color:var(--accent-cyan,#00F2B0); border:none; border-radius:6px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer;">${isFa ? 'تأیید ایمیل' : 'Verify email'}</button>`;
      const since = u.planSince ? new Date(u.planSince).toLocaleDateString(isFa ? 'fa-IR' : 'en-US') : '—';
      const gift = this.giftInfo();
      const planNameMap = { basic: isFa ? 'پایه' : 'Basic', essential: isFa ? 'اسنشیال' : 'Essential', plus: isFa ? 'پلاس' : 'Plus', premium: isFa ? 'پریمیوم' : 'Premium', ultimate: isFa ? 'آلتیمیت' : 'Ultimate' };
      const basePlanName = planNameMap[u.plan] || u.plan || (isFa ? 'پایه' : 'Basic');
      let giftAccountHtml = '';
      if (gift) {
        const expiryText = formatGiftExpiry(gift.expiresAt, isFa);
        giftAccountHtml = `
          <div style="display:flex; align-items:center; gap:8px; margin-top:2px; flex-wrap:wrap;">
            <span class="badge-gift" style="background: rgba(59,130,246,0.18); color: #60a5fa; border: 1px solid rgba(59,130,246,0.35); padding: 2px 8px; border-radius: 20px; font-weight: 700; font-size: 11px;">🎁 ${isFa ? 'اشتراک هدیه' : 'Gift subscription'}</span>
            <span style="font-size:12px; color:#93c5fd; font-weight:600;">${expiryText}</span>
          </div>
          ${row(isFa ? 'پلن پایه' : 'Base plan', basePlanName)}`;
      }
      body.innerHTML = `
        ${sec(isFa ? 'مشخصات' : 'Profile')}
        <div style="display:flex; align-items:center; gap:10px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px;">
          <div style="width:38px; height:38px; border-radius:50%; background:var(--accent-cyan,#00F2B0); color:#000; display:flex; align-items:center; justify-content:center; font-weight:800;">${escapeHtml((u.displayName || u.username || '?')[0].toUpperCase())}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:700;">${escapeHtml(u.displayName || u.username)}</div>
            <div style="font-size:11px; color:var(--text-dim,#8b93a7); direction:ltr;">${escapeHtml(u.email)} · @${escapeHtml(u.username)}</div>
          </div>
          ${verified}
        </div>
        ${sec(isFa ? 'پلن و صورت‌حساب' : 'Plan & Billing')}
        <div style="background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <div style="font-size:13px; font-weight:800;">${this.planLabel()}</div>
              ${gift ? `<span style="background: rgba(59,130,246,0.18); color: #60a5fa; border: 1px solid rgba(59,130,246,0.35); padding: 1px 7px; border-radius: 12px; font-weight: 700; font-size: 10px;">${isFa ? 'اشتراک هدیه' : 'Gift subscription'}</span>` : ''}
            </div>
            <button id="acc-compare-btn" style="background:rgba(0,242,176,0.12); color:var(--accent-cyan,#00F2B0); border:none; border-radius:6px; padding:6px 12px; font-size:11px; font-weight:700; cursor:pointer;">${isFa ? 'مقایسه و تغییر پلن' : 'Compare & change plan'}</button>
          </div>
          ${giftAccountHtml}
          ${row(isFa ? 'فعال از' : 'Active since', since)}
        </div>
        ${sec(isFa ? 'مصرف نسبت به سقف پلن' : 'Usage vs plan limits')}
        <div id="acc-usage">${`<div style="color:var(--text-dim,#8b93a7); font-size:11px;">…</div>`}</div>`;
      try {
        const res = await fetch('/api/plans', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.usage) {
          const limitOf = (key) => (this.entitlements?.[key] ?? '—');
          const usageRows = [
            ['savedLayouts', isFa ? 'چیدمان‌های ذخیره‌شده' : 'Saved layouts'],
            ['savedTemplates', isFa ? 'قالب‌های ذخیره‌شده' : 'Saved templates'],
            ['watchlists', isFa ? 'واچ‌لیست‌ها' : 'Watchlists'],
            ['priceAlerts', isFa ? 'هشدار قیمت' : 'Price alerts'],
            ['paperAccounts', isFa ? 'حساب‌های کاغذی' : 'Paper accounts']
          ];
          const usageHtml = usageRows.map(([key, label]) => row(label, `${toPersianDigits(String(data.usage[key] ?? 0))} / ${limitOf(key) === -1 ? '∞' : toPersianDigits(String(limitOf(key)))}`)).join('');
          const usageBox = body.querySelector('#acc-usage');
          if (usageBox) usageBox.innerHTML = usageHtml;
        }
      } catch (e) { /* leave placeholder */ }
      body.querySelector('#acc-verify-btn')?.addEventListener('click', () => { overlay.remove(); this.openVerifyFlow(); });
      body.querySelector('#acc-compare-btn')?.addEventListener('click', () => { overlay.remove(); this.openPlansModal(); });
    }

    if (tab === 'security') {
      const twofaSection = u.totpEnabled ? `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px;">
          <div>
            <div style="font-size:12px; font-weight:700;">${isFa ? 'احراز هویت دو مرحله‌ای (برنامه Authenticator)' : 'Two-factor authentication (Authenticator app)'}</div>
            <div style="font-size:10px; color:var(--accent-cyan,#00F2B0); margin-top:2px;">${isFa ? 'فعال است — ورود نیازمند کد ۶ رقمی است.' : 'Enabled — sign-in requires a 6-digit code.'}</div>
          </div>
          <button id="acc-2fa-open-disable" style="background:rgba(248,113,113,0.12); color:#f87171; border:none; border-radius:6px; padding:6px 12px; font-size:11px; font-weight:700; cursor:pointer; flex-shrink:0;">${isFa ? 'غیرفعال‌سازی' : 'Disable'}</button>
        </div>
        <div id="acc-2fa-disable-box" style="display:none; flex-direction:column; gap:8px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px;">
          ${this.fieldHtml('acc-2fa-pass', isFa ? 'گذرواژه فعلی' : 'Current password', 'password', '', '••••••••')}
          ${this.fieldHtml('acc-2fa-code', isFa ? 'کد ۶ رقمی Authenticator' : '6-digit authenticator code', 'text', '', '123456')}
          <div id="acc-2fa-msg" style="display:none; font-size:11px;"></div>
          <button id="acc-2fa-disable-btn" style="background:rgba(248,113,113,0.15); color:#f87171; border:1px solid rgba(248,113,113,0.35); border-radius:8px; padding:9px; font-size:12px; font-weight:800; cursor:pointer;">${isFa ? 'تأیید غیرفعال‌سازی' : 'Confirm disable'}</button>
        </div>` : `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px;">
          <div>
            <div style="font-size:12px; font-weight:700;">${isFa ? 'احراز هویت دو مرحله‌ای (برنامه Authenticator)' : 'Two-factor authentication (Authenticator app)'}</div>
            <div style="font-size:10px; color:var(--text-dim,#8b93a7); margin-top:2px;">${isFa ? 'با Google Authenticator یا هر برنامه TOTP فعال می‌شود.' : 'Works with Google Authenticator or any TOTP app.'}</div>
          </div>
          <button id="acc-2fa-open-enable" style="background:rgba(0,242,176,0.12); color:var(--accent-cyan,#00F2B0); border:none; border-radius:6px; padding:6px 12px; font-size:11px; font-weight:700; cursor:pointer; flex-shrink:0;">${isFa ? 'فعال‌سازی' : 'Enable'}</button>
        </div>
        <div id="acc-2fa-setup-box" style="display:none; flex-direction:column; gap:8px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px;">
          <div style="font-size:11px; color:var(--text-dim,#8b93a7); line-height:1.6;">${isFa ? '۱. این کلید را در برنامه Authenticator وارد کنید (یا QR را در TradingView-اسکن‌گر مشابه اسکن کنید):' : '1. Add this key to your authenticator app:'}</div>
          <div id="acc-2fa-secret" dir="ltr" style="font-family:monospace; font-size:14px; letter-spacing:2px; text-align:center; background:rgba(0,0,0,0.3); border-radius:6px; padding:8px; user-select:all;">…</div>
          <div style="font-size:11px; color:var(--text-dim,#8b93a7); line-height:1.6;">${isFa ? '۲. کد ۶ رقمی نمایش‌داده‌شده را اینجا وارد کنید:' : '2. Enter the 6-digit code it shows:'}</div>
          ${this.fieldHtml('acc-2fa-code', isFa ? 'کد ۶ رقمی' : '6-digit code', 'text', '', '123456')}
          <div id="acc-2fa-msg" style="display:none; font-size:11px;"></div>
          <button id="acc-2fa-enable-btn" class="btn-primary" style="padding:9px; font-size:12px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'فعال‌سازی ۲FA' : 'Enable 2FA'}</button>
        </div>`;
      body.innerHTML = `
        ${sec(isFa ? 'احراز هویت دو مرحله‌ای' : 'Two-factor authentication')}
        ${twofaSection}
        ${sec(isFa ? 'تغییر گذرواژه' : 'Change password')}
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${this.fieldHtml('acc-current', isFa ? 'گذرواژه فعلی' : 'Current password', 'password', '', '••••••••')}
          ${this.fieldHtml('acc-next', isFa ? 'گذرواژه جدید' : 'New password', 'password', '', isFa ? 'حداقل ۸ کاراکتر شامل حرف و رقم' : 'min 8 chars, letters + digits')}
          ${this.fieldHtml('acc-confirm', isFa ? 'تکرار گذرواژه جدید' : 'Repeat new password', 'password', '', '••••••••')}
          <div id="acc-sec-msg" style="display:none; font-size:11px; line-height:1.5;"></div>
          <button id="acc-pass-save" class="btn-primary" style="padding:9px; font-size:12px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'به‌روزرسانی گذرواژه' : 'Update password'}</button>
          <div style="font-size:10px; color:var(--text-dim,#8b93a7); line-height:1.6;">${isFa ? 'با تغییر گذرواژه، نشست‌های سایر دستگاه‌ها خاتمه می‌یابد و دستگاه فعلی باقی می‌ماند.' : 'Changing your password signs out all other devices; this device stays signed in.'}</div>
        </div>`;
      // ── 2FA handlers ──────────────────────────────────────────────────
      const show2faMsg = (text, ok) => {
        const m = body.querySelector('#acc-2fa-msg');
        if (!m) return;
        m.style.display = 'block';
        m.style.color = ok ? 'var(--accent-cyan,#00F2B0)' : '#f87171';
        m.textContent = text;
      };
      body.querySelector('#acc-2fa-open-enable')?.addEventListener('click', async () => {
        const box = body.querySelector('#acc-2fa-setup-box');
        if (!box) return;
        box.style.display = 'flex';
        const r = await this.twofaSetup();
        if (r.ok) {
          body.querySelector('#acc-2fa-secret').textContent = r.data.secret;
        } else {
          show2faMsg(isFa ? 'دریافت کلید ناموفق بود؛ دوباره تلاش کنید.' : 'Failed to get a setup key — try again.', false);
        }
      });
      body.querySelector('#acc-2fa-enable-btn')?.addEventListener('click', async () => {
        const code = body.querySelector('input[name="acc-2fa-code"]').value.trim();
        const r = await this.twofaEnable(code);
        if (r.ok) {
          this.app?.showToast?.(isFa ? 'احراز دو مرحله‌ای فعال شد.' : 'Two-factor authentication enabled.', 'success');
          this.openAccountSettingsModal('security');
        } else {
          show2faMsg(
            r.data.error === 'invalid_code'
              ? (isFa ? 'کد واردشده معتبر نیست؛ دوباره تلاش کنید.' : 'Invalid code — try again.')
              : (isFa ? 'فعال‌سازی ناموفق بود.' : 'Enable failed.'),
            false);
        }
      });
      body.querySelector('#acc-2fa-open-disable')?.addEventListener('click', () => {
        const box = body.querySelector('#acc-2fa-disable-box');
        if (box) box.style.display = box.style.display === 'none' ? 'flex' : 'none';
      });
      body.querySelector('#acc-2fa-disable-btn')?.addEventListener('click', async () => {
        const pass = body.querySelector('input[name="acc-2fa-pass"]').value;
        const code = body.querySelector('input[name="acc-2fa-code"]').value.trim();
        const r = await this.twofaDisable(pass, code);
        if (r.ok) {
          this.app?.showToast?.(isFa ? 'احراز دو مرحله‌ای غیرفعال شد.' : 'Two-factor authentication disabled.', 'success');
          this.openAccountSettingsModal('security');
        } else {
          show2faMsg(
            r.data.error === 'invalid_credentials'
              ? (isFa ? 'گذرواژه نادرست است.' : 'Incorrect password.')
              : r.data.error === 'invalid_code'
                ? (isFa ? 'کد واردشده معتبر نیست.' : 'Invalid code.')
                : (isFa ? 'غیرفعال‌سازی ناموفق بود.' : 'Disable failed.'),
            false);
        }
      });

      body.querySelector('#acc-pass-save')?.addEventListener('click', async () => {
        const msg = body.querySelector('#acc-sec-msg');
        const cur = body.querySelector('input[name="acc-current"]').value;
        const next = body.querySelector('input[name="acc-next"]').value;
        const conf = body.querySelector('input[name="acc-confirm"]').value;
        msg.style.display = 'block';
        if (next !== conf) {
          msg.style.color = '#f87171';
          msg.textContent = isFa ? 'تکرار گذرواژه مطابقت ندارد.' : 'Passwords do not match.';
          return;
        }
        const r = await this.api('change-password', { body: { current: cur, next } });
        if (r.ok) {
          msg.style.color = 'var(--accent-cyan,#00F2B0)';
          msg.textContent = isFa ? 'گذرواژه به‌روزرسانی شد؛ سایر دستگاه‌ها خارج شدند.' : 'Password updated — other devices signed out.';
          this.app?.showToast?.(isFa ? 'گذرواژه تغییر کرد' : 'Password changed', 'success');
        } else {
          msg.style.color = '#f87171';
          msg.textContent = r.data.error === 'invalid_current'
            ? (isFa ? 'گذرواژه فعلی نادرست است.' : 'Current password is incorrect.')
            : (isFa ? 'گذرواژه جدید باید حداقل ۸ کاراکتر و شامل حرف و رقم باشد.' : 'New password needs 8+ chars incl. letters & digits.');
        }
      });
    }

    if (tab === 'sessions') {
      body.innerHTML = `<div style="color:var(--text-dim,#8b93a7); font-size:12px;">…</div>`;
      let sessions = [];
      try {
        const res = await fetch('/api/user/sessions', { credentials: 'same-origin' });
        const data = await res.json();
        sessions = data.sessions || [];
      } catch (e) { /* ignore */ }
      const rows = sessions.map(s => `
        <div data-sid="${s.id}" style="background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; padding:9px 12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div style="min-width:0;">
            <div style="font-size:12px; font-weight:700;">${escapeHtml(s.device || (isFa ? 'دستگاه ناشناس' : 'Unknown device'))} ${s.current ? `<span style="color:var(--accent-cyan,#00F2B0); font-size:10px;">${isFa ? '· دستگاه فعلی' : '· this device'}</span>` : ''}</div>
            <div style="font-size:10px; color:var(--text-dim,#8b93a7); direction:ltr; text-align:${isFa ? 'right' : 'left'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml((s.ua || '').slice(0, 70))}</div>
          </div>
          ${s.current ? '' : `<button class="acc-revoke" style="background:rgba(248,113,113,0.12); color:#f87171; border:none; border-radius:6px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer; flex-shrink:0;">${isFa ? 'خروج' : 'Revoke'}</button>`}
        </div>`).join('');
      body.innerHTML = `
        ${sec(isFa ? 'نشست‌های فعال' : 'Active sessions')}
        <div style="display:flex; flex-direction:column; gap:8px;">${rows || `<div style="color:var(--text-dim,#8b93a7); font-size:12px;">${isFa ? 'نشستی یافت نشد.' : 'No sessions found.'}</div>`}</div>
        <button id="acc-logout-all" style="background:rgba(248,113,113,0.12); color:#f87171; border:1px solid rgba(248,113,113,0.3); border-radius:8px; padding:9px; font-size:12px; font-weight:800; cursor:pointer;">${isFa ? 'خروج از همه دستگاه‌ها' : 'Sign out all devices'}</button>`;
      body.querySelectorAll('.acc-revoke').forEach(btn => btn.addEventListener('click', async () => {
        const sid = btn.closest('[data-sid]')?.dataset.sid;
        await fetch(`/api/user/sessions/${sid}`, { method: 'DELETE', credentials: 'same-origin' });
        this.openAccountSettingsModal('sessions');
      }));
      body.querySelector('#acc-logout-all')?.addEventListener('click', async () => {
        await this.api('logout-all');
        await this.logout();
        overlay.remove();
        this.app?.showToast?.(isFa ? 'از همه دستگاه‌ها خارج شدید.' : 'Signed out everywhere.', 'success');
      });
    }

    if (tab === 'data') {
      body.innerHTML = `
        ${sec(isFa ? 'داده‌های من' : 'My data')}
        <div style="font-size:11px; color:var(--text-dim,#8b93a7); line-height:1.7;">${isFa ? 'همه اطلاعاتی که از شما ذخیره کرده‌ایم — پروفایل، پلن، تنظیمات ابری و نشست‌ها — در یک فایل JSON قابل دانلود است.' : 'Everything we store about you — profile, plan, cloud state and sessions — as one downloadable JSON file.'}</div>
        <button id="acc-export-btn" class="btn-primary" style="padding:9px; font-size:12px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'دانلود داده‌های من' : 'Download my data'}</button>
        ${sec(isFa ? 'حذف حساب' : 'Delete account')}
        <div style="font-size:11px; color:#f87171; line-height:1.7;">${isFa ? 'حذف حساب دائمی است؛ همه داده‌های ابری و نشست‌ها فوراً پاک می‌شوند و قابل بازگشت نیست.' : 'Deletion is permanent: all cloud data and sessions are erased immediately and cannot be restored.'}</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <input id="acc-del-pass" type="password" placeholder="${isFa ? 'گذرواژه فعلی' : 'Current password'}" style="padding:9px 11px; font-size:13px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; width:100%; box-sizing:border-box; direction:ltr;" />
          <input id="acc-del-confirm" placeholder="${isFa ? 'برای تأیید عبارت DELETE را بنویسید' : 'Type DELETE to confirm'}" style="padding:9px 11px; font-size:13px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; width:100%; box-sizing:border-box; direction:ltr; text-align:left;" />
          <button id="acc-del-btn" style="background:rgba(248,113,113,0.15); color:#f87171; border:1px solid rgba(248,113,113,0.35); border-radius:8px; padding:9px; font-size:12px; font-weight:800; cursor:pointer;">${isFa ? 'حذف دائمی حساب کاربری' : 'Permanently delete my account'}</button>
          <div id="acc-del-msg" style="display:none; font-size:11px; color:#f87171;"></div>
        </div>`;
      body.querySelector('#acc-export-btn')?.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/user/export', { credentials: 'same-origin' });
          const blob = await res.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `tradingchart-account-export-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
          this.app?.showToast?.(isFa ? 'فایل داده‌ها دانلود شد.' : 'Data file downloaded.', 'success');
        } catch (e) {
          this.app?.showToast?.(isFa ? 'دانلود ناموفق بود.' : 'Download failed.', 'error');
        }
      });
      body.querySelector('#acc-del-btn')?.addEventListener('click', async () => {
        const msg = body.querySelector('#acc-del-msg');
        const pass = body.querySelector('#acc-del-pass').value;
        const confirmWord = body.querySelector('#acc-del-confirm').value.trim().toUpperCase();
        msg.style.display = 'block';
        if (confirmWord !== 'DELETE') {
          msg.textContent = isFa ? 'برای تأیید، عبارت DELETE را دقیقاً بنویسید.' : 'Type DELETE exactly to confirm.';
          return;
        }
        const res = await fetch('/api/auth/me', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pass }) });
        if (res.ok) {
          this.user = null;
          this.entitlements = PLANS.basic;
          this.cloudUpdatedAt = 0;
          this.renderAccountBadge();
          overlay.remove();
          this.app?.onAuthChanged?.('account_deleted');
          this.app?.showToast?.(isFa ? 'حساب شما برای همیشه حذف شد.' : 'Your account has been permanently deleted.', 'success');
        } else {
          const data = await res.json().catch(() => ({}));
          msg.textContent = data.errors?.some(e => e.code === 'invalid_credentials') || data.error === 'invalid_credentials'
            ? (isFa ? 'گذرواژه نادرست است.' : 'Incorrect password.')
            : (isFa ? 'حذف حساب ناموفق بود؛ دوباره تلاش کنید.' : 'Deletion failed — try again.');
        }
      });
    }
  }
  async openPlansModal() {
    await this.refreshPlans();
    document.querySelector('#tc-plans-modal')?.remove();
    const isFa = getLanguage() === 'fa';
    const planNameFallback = { basic: isFa ? 'پایه' : 'Basic', essential: isFa ? 'اسنشیال' : 'Essential', plus: isFa ? 'پلاس' : 'Plus', premium: isFa ? 'پریمیوم' : 'Premium', ultimate: isFa ? 'آلتیمیت' : 'Ultimate' };
    const getPlanName = (p) => {
      if (isFa) return p.nameFa || planNameFallback[p.id] || p.id;
      return p.nameEn || planNameFallback[p.id] || (p.id.charAt(0).toUpperCase() + p.id.slice(1));
    };
    const planNames = Object.fromEntries(PLAN_ORDER.map(id => [id, getPlanName(this.plansMeta[id] || PLANS[id] || { id })]));
    const rows = [
      ['chartsPerTab', isFa ? 'چارت در هر تب' : 'Charts per tab'],
      ['savedLayouts', isFa ? 'چیدمان‌های ذخیره‌شده' : 'Saved layouts'],
      ['indicatorsPerChart', isFa ? 'اندیکاتور در هر چارت' : 'Indicators per chart'],
      ['savedTemplates', isFa ? 'قالب‌های ذخیره‌شده' : 'Saved templates'],
      ['watchlists', isFa ? 'واچ‌لیست‌ها' : 'Watchlists'],
      ['priceAlerts', isFa ? 'هشدار قیمت' : 'Price alerts'],
      ['technicalAlerts', isFa ? 'هشدار تکنیکال' : 'Technical alerts'],
      ['paperAccounts', isFa ? 'حساب‌های معاملاتی کاغذی' : 'Paper accounts'],
      ['histBars', isFa ? 'کندل‌های تاریخی' : 'Historical bars'],
      ['barReplayMinuteDays', isFa ? 'بازپخش داده دقیقه‌ای (روز)' : 'Minute replay (days)'],
      ['synthChartTypes', isFa ? 'رنکو/کاگی/پوینت‌اند‌فیگور' : 'Renko/Kagi/P&F'],
      ['dataExport', isFa ? 'خروجی داده چارت' : 'Chart data export'],
      ['multiTfAnalysis', isFa ? 'تحلیل چند‌تایم‌فریم' : 'Multi-timeframe analysis'],
      ['deepBacktest', isFa ? 'بک‌تست عمیق' : 'Deep backtesting'],
      ['csvTradesExport', isFa ? 'خروجی CSV معاملات' : 'Trades CSV export'],
      ['xlsxReport', isFa ? 'گزارش XLSX' : 'XLSX report'],
      ['webhookAlerts', isFa ? 'هشدار وب‌هوک' : 'Webhook alerts'],
      ['propFirmSim', isFa ? 'شبیه‌ساز چالش پراپ‌فرم' : 'Prop-firm simulator'],
      ['tradeJournal', isFa ? 'ژورنال معاملاتی هوشمند' : 'Smart trade journal'],
      ['depthOfMarket', isFa ? 'عمق بازار DOM لول ۲' : 'Depth of market (DOM)'],
      ['pineStudio', isFa ? 'استودیو پاین‌اسکریپت' : 'Pine script studio'],
      ['economicCalendar', isFa ? 'تقویم اقتصادی کلان' : 'Economic calendar']
    ];
    const fmt = (v) => v === UNLIMITED ? '∞' : (typeof v === 'boolean' ? (v ? '✓' : '—') : (isFa ? toPersianDigits(String(v)) : String(v)));
    const plans = PLAN_ORDER.map(id => this.plansMeta[id] || PLANS[id]).filter(Boolean);
    const current = this.plan();
    const pendingPlan = this.user?.planRequest?.plan || null;
    const gift = this.giftInfo();
    const grid = plans.map(p => {
      const isCurrent = p.id === current;
      const isGiftPlan = Boolean(gift && gift.plan === p.id);
      const isBasePlan = Boolean(gift && p.id === (this.user?.plan || 'basic'));
      const isDatedGift = Boolean(gift && gift.expiresAt != null);
      const pColor = p.color || 'var(--accent-cyan,#00F2B0)';
      const pBadge = isFa ? (p.badgeFa || p.badge) : p.badge;

      const expiryText = isGiftPlan ? formatGiftExpiry(gift.expiresAt, isFa) : '';

      return `
        <div class="plan-card plan-card-${p.id}" style="border:1px solid ${isCurrent ? pColor : 'var(--border-subtle)'}; border-radius:10px; padding:12px; background:${isCurrent ? 'rgba(0,242,176,0.05)' : 'var(--bg-surface,#0c1017)'}; display:flex; flex-direction:column; gap:8px; width:155px; min-width:155px; flex-shrink:0; box-sizing:border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <strong style="font-size:13px; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${getPlanName(p)}</strong>
            ${isCurrent ? `<span style="font-size:9px; background:${pColor}; color:#04121e; padding:2px 7px; border-radius:12px; font-weight:800; flex-shrink:0;">${isFa ? 'پلن فعلی' : 'CURRENT'}</span>` : (pBadge ? `<span style="font-size:9px; background:${pColor}22; color:${pColor}; padding:2px 7px; border-radius:12px; font-weight:800; flex-shrink:0;">${escapeHtml(pBadge)}</span>` : '')}
          </div>
          ${isGiftPlan ? `
            <div style="display:flex; flex-direction:column; gap:3px;">
              <span class="badge-gift" style="font-size:9px; background:rgba(59,130,246,0.22); color:#93c5fd; border:1px solid rgba(59,130,246,0.4); padding:2px 7px; border-radius:12px; font-weight:800; width:fit-content;">🎁 ${isFa ? 'اشتراک هدیه' : 'Gift subscription'}</span>
              <span style="font-size:10px; color:#93c5fd; font-weight:600;">${expiryText}</span>
            </div>` : ''}
          ${isBasePlan && isDatedGift ? `
            <div style="font-size:10px; color:#f59e0b; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:6px; padding:3px 6px; text-align:center; font-weight:700;">
              ${isFa ? 'پلن پایه (پس از پایان اشتراک هدیه)' : 'Base plan (after gift ends)'}
            </div>` : ''}
          <div style="font-size:16px; font-weight:800; color:${pColor};">${p.priceUSD === 0 ? (isFa ? 'رایگان' : 'Free') : '$' + (isFa ? toPersianDigits(String(p.priceUSD)) : p.priceUSD)}<span style="font-size:10px; color:var(--text-dim); font-weight:400;">${p.priceUSD ? (isFa ? '/ماه' : '/mo') : ''}</span></div>
          ${(() => {
            const isReq = pendingPlan === p.id;
            const off = isCurrent || isReq;
            const label = isCurrent ? (isFa ? 'فعال' : 'Active')
              : isReq ? (isFa ? 'در انتظار تأیید' : 'Pending approval')
              : (this.planRank(p.id) < this.planRank(current) ? (isFa ? 'تغییر به این پلن' : 'Switch') : (p.priceUSD > 0 ? (isFa ? 'درخواست ارتقا' : 'Request upgrade') : (isFa ? 'ارتقا' : 'Upgrade')));
            return `<button data-plan="${p.id}" ${off ? 'disabled' : ''} class="tc-plan-btn" style="min-height:36px; padding:7px; border-radius:7px; font-size:11px; font-weight:800; cursor:${off ? 'default' : 'pointer'}; border:1px solid ${pColor}; background:${off ? 'transparent' : pColor}; color:${off ? pColor : '#04121e'}; opacity:${isCurrent ? '0.5' : '1'};">${label}</button>`;
          })()}
        </div>`;
    }).join('');

    let giftBanner = '';
    if (gift) {
      const expiryText = formatGiftExpiry(gift.expiresAt, isFa);
      giftBanner = `
        <div id="tc-plan-gift-banner" style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; padding:10px 14px; border:1px solid rgba(59,130,246,0.35); background:rgba(59,130,246,0.1); border-radius:10px; color:#cfe0ff; font-size:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:15px;">🎁</span>
            <strong style="color:#fff;">${isFa ? 'اشتراک هدیه فعال' : 'Active gift subscription'}:</strong>
            <span>${isFa ? `پلن «${planNames[gift.plan] || gift.plan}» (${expiryText})` : `Plan “${planNames[gift.plan] || gift.plan}” (${expiryText})`}</span>
          </div>
          <span class="badge-gift" style="background:rgba(59,130,246,0.22); color:#93c5fd; border:1px solid rgba(59,130,246,0.4); padding:2px 8px; border-radius:12px; font-weight:800; font-size:10px;">${isFa ? 'اشتراک هدیه' : 'Gift subscription'}</span>
        </div>`;
    }

    const table = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; min-width:560px;">
          <thead><tr>
            <th style="text-align:${isFa ? 'right' : 'left'}; padding:8px; color:var(--text-dim); font-weight:600;">${isFa ? 'ویژگی' : 'Feature'}</th>
            ${plans.map(p => `<th style="padding:8px; color:#fff; font-weight:700;">${getPlanName(p)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows.map(([k, label]) => `
              <tr style="border-top:1px solid var(--border-subtle);">
                <td style="padding:7px 8px; color:var(--text-dim);">${label}</td>
                ${plans.map(p => `<td style="padding:7px 8px; text-align:center; color:${(p[k] === true || (typeof p[k] === 'number' && p[k] !== 0)) ? 'var(--accent-cyan,#00F2B0)' : 'var(--text-dim)'}; font-weight:600;">${fmt(p[k])}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    const overlay = document.createElement('div');
    overlay.id = 'tc-plans-modal';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(6px); z-index:100000; display:flex; align-items:center; justify-content:center;';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:860px; width:96vw; max-height:88vh; overflow-y:auto; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:14px; ${isFa ? 'direction:rtl;' : ''}">
        <div style="padding:14px 18px; background:var(--bg-surface,#0c1017); border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:2;">
          <span style="font-weight:800; font-size:14px; color:#fff;">${isFa ? 'پلن‌های چارتیویا' : 'Chartivia Plans'}</span>
          <div style="display:flex; align-items:center; gap:8px;">
            ${this.isAdmin() ? `<button id="tc-plans-open-admin" style="background:rgba(0,242,176,0.12); color:var(--accent-cyan,#00F2B0); border:1px solid rgba(0,242,176,0.3); border-radius:6px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <span>⚙️</span><span>${isFa ? 'مدیریت پلن‌ها' : 'Manage Plans'}</span>
            </button>` : ''}
            <button data-close style="background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); color:var(--text-dim); cursor:pointer; width:32px; height:32px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-size:14px;">✕</button>
          </div>
        </div>
        <div style="padding:16px 18px; display:flex; flex-direction:column; gap:14px;">
          ${giftBanner}
          <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:8px; scrollbar-width:thin; -webkit-overflow-scrolling:touch;">${grid}</div>
          ${this.usage ? `<div style="font-size:11px; color:var(--text-dim);">${isFa ? `مصرف فعلی: ${toPersianDigits(String(this.usage.layouts))} چیدمان · ${toPersianDigits(String(this.usage.watchlists))} واچ‌لیست · ${toPersianDigits(String(Math.round(this.usage.stateBytes / 1024)))} کیلوبایت فضای ابری` : `Current usage: ${this.usage.layouts} layouts · ${this.usage.watchlists} watchlists · ${Math.round(this.usage.stateBytes / 1024)} KB cloud`}</div>` : ''}
          ${table}
          <div style="font-size:10px; color:var(--text-dim); line-height:1.6;">${pendingPlan ? `<div id="tc-plan-pending" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:9px 11px; margin-bottom:8px; border:1px solid rgba(59,130,246,0.35); background:rgba(59,130,246,0.08); border-radius:8px; color:#cfe0ff; font-size:11.5px;"><span style="flex:1; min-width:180px;">${isFa ? `درخواست ارتقای شما به پلن «${escapeHtml(planNames[pendingPlan] || pendingPlan)}» ثبت شده و پس از تأیید پرداخت توسط پشتیبانی فعال می‌شود.` : `Your upgrade request to “${escapeHtml(planNames[pendingPlan] || pendingPlan)}” is recorded and will be activated once support confirms payment.`}</span><button id="tc-plan-cancel-req" style="min-height:32px; padding:5px 12px; border-radius:7px; border:1px solid var(--border-subtle); background:transparent; color:var(--text-dim); font-size:11px; font-weight:700; cursor:pointer;">${isFa ? 'لغو درخواست' : 'Withdraw request'}</button></div>` : ''}${isFa ? 'ارتقا به پلن‌های پولی پس از ثبت درخواست و تأیید پرداخت توسط پشتیبانی فعال می‌شود؛ بازگشت به پلن رایگان بلافاصله اعمال می‌شود. سقف هر پلن هم در سرور و هم در رابط کاربری اعمال می‌شود.' : 'Paid plans are activated after you request an upgrade and support confirms payment; switching to the free plan applies instantly. Each plan’s limits are enforced both server-side and in the UI.'}</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) { close(); return; }
      if (e.target.closest('#tc-plans-open-admin')) {
        close();
        this.openPlanAdminStudio('plans');
        return;
      }
      if (e.target.closest('#tc-plan-cancel-req')) {
        const r = await this.cancelPlanRequest();
        const isFa2 = getLanguage() === 'fa';
        close();
        if (r.ok) { this.app?.showToast?.(isFa2 ? 'درخواست ارتقا لغو شد.' : 'Upgrade request withdrawn.', 'success'); this.openPlansModal(); }
        else this.app?.showToast?.(isFa2 ? 'لغو درخواست ناموفق بود.' : 'Could not withdraw the request.', 'error');
        return;
      }
      const btn = e.target.closest('button[data-plan]');
      if (btn && !btn.disabled) {
        const planId = btn.dataset.plan;
        btn.disabled = true;
        const r = await this.switchPlanWithStateGuard(planId);
        const isFa2 = getLanguage() === 'fa';
        if (r.ok && r.data?.pending) {
          close();
          this.app?.showToast?.(isFa2 ? `درخواست ارتقا به «${planNames[planId]}» ثبت شد؛ پس از تأیید پرداخت فعال می‌شود.` : `Upgrade to ${planNames[planId]} requested; it activates once payment is confirmed.`, 'success');
        } else if (r.ok) {
          close();
          this.app?.showToast?.(isFa2 ? `پلن شما به «${planNames[planId]}» تغییر کرد.` : `Plan switched to ${planNames[planId]}.`, 'success');
        } else {
          btn.disabled = false;
          this.app?.showToast?.(isFa2 ? 'تغییر پلن ناموفق بود.' : 'Plan switch failed.', 'error');
        }
      }
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  // ── Devices modal ───────────────────────────────────────────────────────
  async openDevicesModal() {
    if (!this.user) return;
    let sessions = [];
    try {
      const res = await fetch('/api/user/sessions', { credentials: 'same-origin' });
      const data = await res.json();
      sessions = data.sessions || [];
    } catch (e) { /* ignore */ }
    document.querySelector('#tc-devices-modal')?.remove();
    const isFa = getLanguage() === 'fa';
    const overlay = document.createElement('div');
    overlay.id = 'tc-devices-modal';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(6px); z-index:100000; display:flex; align-items:center; justify-content:center;';
    const rows = sessions.map(s => `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:10px 12px; border:1px solid var(--border-subtle); border-radius:9px; background:var(--bg-surface,#0c1017);">
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <strong style="font-size:12px;">${escapeHtml(s.device)} ${s.current ? `<span style="color:var(--accent-cyan,#00F2B0); font-size:10px;">(${isFa ? 'این دستگاه' : 'this device'})</span>` : ''}</strong>
          <span style="font-size:10px; color:var(--text-dim); direction:ltr;">${escapeHtml(s.ua.slice(0, 70))}</span>
          <span style="font-size:10px; color:var(--text-dim);">${isFa ? 'آخرین فعالیت:' : 'Last seen:'} ${new Date(s.lastSeen).toLocaleString(isFa ? 'fa-IR' : 'en-US')}</span>
        </div>
        ${s.current ? '' : `<button data-revoke="${s.id}" style="padding:6px 12px; border-radius:7px; border:1px solid #f87171; background:rgba(248,113,113,0.08); color:#f87171; font-size:11px; font-weight:700; cursor:pointer;">${isFa ? 'لغو' : 'Revoke'}</button>`}
      </div>`).join('');
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:460px; width:92vw; max-height:80vh; overflow-y:auto; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:14px; ${isFa ? 'direction:rtl;' : ''}">
        <div style="padding:14px 18px; background:var(--bg-surface,#0c1017); border-bottom:1px solid var(--border-subtle); font-weight:800; font-size:14px; color:#fff; display:flex; justify-content:space-between;">
          <span>${isFa ? 'دستگاه‌های فعال' : 'Active devices'}</span>
          <button data-close style="background:none; border:none; color:var(--text-dim); cursor:pointer;">✕</button>
        </div>
        <div style="padding:14px 16px; display:flex; flex-direction:column; gap:10px;">
          ${rows || `<div style="color:var(--text-dim); font-size:11px; text-align:center; padding:10px;">${isFa ? 'خطا در دریافت فهرست دستگاه‌ها.' : 'Could not load sessions.'}</div>`}
          <button id="tc-logout-all" style="padding:9px; border-radius:8px; border:1px solid #f87171; background:rgba(248,113,113,0.08); color:#f87171; font-weight:700; font-size:12px; cursor:pointer;">${isFa ? 'خروج از همه دستگاه‌ها' : 'Sign out everywhere'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) { overlay.remove(); return; }
      const rev = e.target.closest('[data-revoke]');
      if (rev) {
        await fetch(`/api/user/sessions/${rev.dataset.revoke}`, { method: 'DELETE', credentials: 'same-origin' });
        rev.closest('div[style*="justify-content"]').remove();
        this.app?.showToast?.(isFa ? 'دستگاه خارج شد.' : 'Device signed out.', 'success');
      }
      if (e.target.id === 'tc-logout-all') {
        await this.api('logout-all');
        overlay.remove();
        this.user = null;
        this.entitlements = PLANS.basic;
        this.renderAccountBadge();
        this.app?.onAuthChanged?.('logout-all');
      }
    });
  }

  // ── Feature gates called by product surfaces ────────────────────────────
  gateSecondIntervals() { return this.feature('secondIntervals'); }
  gateSynthChartTypes() { return this.feature('synthChartTypes'); }
  gateDataExport() {
    if (this.feature('dataExport')) return true;
    this.enforce('dataExport', this.feature('dataExport') ? 0 : 1, 'chart data export', 'خروجی داده چارت');
    return false;
  }
  gateDeepBacktest() { return this.feature('deepBacktest'); }

  destroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
