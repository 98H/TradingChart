// client/src/authManager.js
// TradingChart Account System — client side. Session bootstrap, login/signup/verify/reset
// modal, account dropdown menu, plan-gating engine, and cloud state sync.
// TradingView parity: guest mode stays fully usable; auth is progressive, not blocking.

import { getLanguage, t, toPersianDigits } from './i18n.js';

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
  theme: 'theme'
};
const LS_PREFIX = 'tradingchart_';
const LOCAL_MIRROR = 'tradingchart_auth_mirror'; // guest→user handoff buffer

export class AuthManager {
  constructor(app) {
    this.app = app;
    this.user = null;          // publicUser or null (guest)
    this.entitlements = PLANS.basic;
    this.usage = null;
    this.plansMeta = PLANS;
    this.syncEnabled = true;
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
    this.entitlements = PLANS[this.user?.plan || 'basic'] || PLANS.basic;
    await this.refreshPlans();
    // 3. Sync direction: cloud → local on boot (logged-in), local → cloud after
    if (this.user) await this.pullCloudState();
    this.renderAccountBadge();
    this.bindAvatar();
    this.startAutoSync();
    this.observeStorage();
  }

  // ── Entitlement helpers ────────────────────────────────────────────────
  plan() { return this.user?.plan || 'basic'; }
  ent(key) { return this.entitlements?.[key]; }
  isUnlimited(v) { return v === UNLIMITED; }

  /** Check a numeric entitlement. Returns {allowed, limit, plan, needUpgrade}. */
  check(key, currentCount = 0) {
    const limit = this.ent(key);
    const plan = this.plan();
    if (limit === undefined) return { allowed: true, plan };
    if (this.isUnlimited(limit)) return { allowed: true, limit: UNLIMITED, plan };
    if (currentCount < limit) return { allowed: true, limit, plan };
    return { allowed: false, limit, plan, needUpgrade: this.nextPlanWith(key, limit) };
  }

  /** Boolean feature gate (secondIntervals, synthChartTypes, deepBacktest…). */
  feature(key) { return !!this.ent(key); }

  nextPlanWith(key, currentLimit) {
    const idx = PLAN_ORDER.indexOf(this.plan());
    for (let i = idx + 1; i < PLAN_ORDER.length; i++) {
      const p = PLANS[PLAN_ORDER[i]];
      if (p[key] !== undefined && (p[key] === UNLIMITED || p[key] > currentLimit)) return p.id;
    }
    return 'ultimate';
  }

  planRank(id) { return PLAN_ORDER.indexOf(id); }

  /** Enforce a limit; shows the TradingView-style upgrade toast and returns false when blocked. */
  enforce(key, currentCount, featureLabelEn, featureLabelFa) {
    const chk = this.check(key, currentCount);
    if (chk.allowed) return true;
    const isFa = getLanguage() === 'fa';
    const label = isFa ? (featureLabelFa || featureLabelEn) : featureLabelEn;
    const limStr = this.isUnlimited(chk.limit) ? '∞' : toPersianDigits(String(chk.limit));
    const next = chk.needUpgrade ? PLANS[chk.needUpgrade] : PLANS.ultimate;
    const nextName = isFa ? ({ basic: 'پایه', essential: 'اسنشیال', plus: 'پلاس', premium: 'پریمیوم', ultimate: 'آلتیمیت' }[next.id]) : next.id.charAt(0).toUpperCase() + next.id.slice(1);
    if (this.app?.showToast) {
      this.app.showToast(
        isFa
          ? `سقف پلن ${limStr === '∞' ? 'نامحدود' : limStr} برای ${label} در پلن شما پر شده است — ارتقا به ${nextName} (${next.priceUSD === 0 ? 'رایگان' : '$' + next.priceUSD + ' در ماه'})`
          : `You've reached your plan's ${label} limit (${chk.limit}) — upgrade to ${nextName} ($${next.priceUSD}/mo)`,
        'warning'
      );
    }
    return false;
  }

  async refreshPlans() {
    try {
      const res = await fetch('/api/plans', { credentials: 'same-origin' });
      const data = await res.json();
      if (data.ok) {
        this.plansMeta = data.plans;
        if (data.current) { this.entitlements = data.plans[data.current] || this.entitlements; }
        this.usage = data.usage || null;
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
      if (hasCloudData) {
        // Merge: cloud wins for keys it has; local-only keys upload on next push.
        this.applyCloudState(cloud);
        this.app?.onCloudStateApplied?.(cloud);
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
        // Conflict: server is newer. Server wins (TradingView semantics) + notify.
        const conflict = await res.json();
        this.cloudUpdatedAt = conflict.serverUpdatedAt;
        this.applyCloudState(conflict.serverState);
        this.app?.onCloudStateApplied?.(conflict.serverState);
        this.lastSyncError = 'conflict';
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

  async register({ email, username, password, displayName }) {
    const r = await this.api('register', { body: { email, username, password, displayName } });
    if (r.ok) {
      this.user = r.data.user;
      this.entitlements = PLANS[this.user.plan] || PLANS.basic;
      this.stashGuestMirror();
      await this.pullCloudState();
      this.renderAccountBadge();
      this.startAutoSync();
    }
    return r;
  }

  async login({ identity, password }) {
    const r = await this.api('login', { body: { identity, password } });
    if (r.ok) {
      this.user = r.data.user;
      this.entitlements = PLANS[this.user.plan] || PLANS.basic;
      this.stashGuestMirror();
      await this.pullCloudState();
      this.renderAccountBadge();
      this.startAutoSync();
    }
    return r;
  }

  async logout() {
    if (this.user) this.stashGuestMirror();
    const r = await this.api('logout');
    this.user = null;
    this.entitlements = PLANS.basic;
    this.cloudUpdatedAt = 0;
    this.renderAccountBadge();
    this.app?.onAuthChanged?.('logout');
    return r;
  }

  async updateProfile(patch) {
    const r = await this.api('me', { method: 'PATCH', body: patch });
    if (r.ok) { this.user = r.data.user; this.renderAccountBadge(); }
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
    if (res.ok && data.ok) {
      this.user = data.user;
      this.entitlements = PLANS[planId] || PLANS.basic;
      this.renderAccountBadge();
      this.app?.onPlanChanged?.(planId);
    }
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
      const initials = this.user.displayName
        ? this.user.displayName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
        : this.user.username.slice(0, 2).toUpperCase();
      if (circle) circle.textContent = initials || 'TC';
      badge.title = `${this.user.displayName || this.user.username} · ${this.planLabel()} · ${this.user.email}`;
      badge.dataset.auth = 'in';
      badge.dataset.plan = this.plan();
    } else {
      if (circle) {
        circle.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      }
      badge.title = isFa ? 'ورود / ثبت‌نام' : 'Sign in / Sign up';
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
      if (this.menuOpen) this.closeAccountMenu();
      else this.openAccountMenu();
    });
    document.addEventListener('click', (e) => {
      if (this.menuOpen && !e.target.closest('#tc-account-menu') && !e.target.closest('.user-avatar-badge')) {
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
    return `
      <div style="padding: 12px 14px; border-bottom: 1px solid var(--border-subtle); display:flex; flex-direction:column; gap:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <strong style="font-size:13px;">${escapeHtml(u.displayName || u.username)}</strong>
          ${planBadge}
        </div>
        <div style="color: var(--text-dim, #8b93a7); direction:ltr; text-align:${isFa ? 'right' : 'left'}; font-size:11px;">${escapeHtml(u.email)} · ${verified}</div>
      </div>
      <div style="padding: 6px;">
        ${this.menuItem('profile', isFa ? 'پروفایل و تنظیمات' : 'Profile & Settings', '👤')}
        ${this.menuItem('account', isFa ? 'حساب و صورت‌حساب' : 'Account & Billing', '🧾')}
        ${this.menuItem('plans', isFa ? 'پلن‌ها و ارتقا' : 'Plans & Upgrade', '⭐')}
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
        ${this.menuItem('login', isFa ? 'ورود' : 'Sign In', '→')}
        ${this.menuItem('signup', isFa ? 'ایجاد حساب رایگان' : 'Create Free Account', '✦')}
        ${this.menuItem('plans', isFa ? 'مقایسه پلن‌ها' : 'Compare Plans', '⭐')}
      </div>`;
  }

  menuItem(act, label, icon) {
    return `<div data-act="${act}" role="menuitem" tabindex="0" style="padding: 9px 14px; cursor: pointer; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='var(--bg-card-hover,#1b243b)'" onmouseout="this.style.background='transparent'"><span style="width:18px; text-align:center;">${icon}</span><span>${label}</span></div>`;
  }

  closeAccountMenu() {
    document.querySelector('#tc-account-menu')?.remove();
    this.menuOpen = false;
  }

  handleMenuAction(act) {
    switch (act) {
      case 'profile': this.app?.userProfileModal?.open?.(); break;
      case 'account': this.openAccountSettingsModal(); break;
      case 'plans': this.openPlansModal(); break;
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
          <button data-close style="background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); color:var(--text-dim,#8b93a7); cursor:pointer; width:26px; height:26px; border-radius:6px;">✕</button>
        </div>
        ${tabs}
        <div id="tc-auth-body" style="padding:16px 18px 18px;">${body}</div>
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
        invalid_username: isFa ? 'نام کاربری باید ۳ تا ۲۴ کاراکتر انگلیسی، رقم یا زیرخط باشد.' : 'Username must be 3–24 letters, digits or underscores.',
        username_taken: isFa ? 'این نام کاربری قبلاً گرفته شده است.' : 'This username is taken.',
        password_weak: isFa ? 'گذرواژه باید حداقل ۸ کاراکتر و شامل حرف و رقم باشد.' : 'Password needs 8+ chars incl. letters & digits.',
        password_length: isFa ? 'گذرواژه باید حداقل ۸ کاراکتر باشد.' : 'Password must be at least 8 characters.',
        invalid_credentials: isFa ? 'ایمیل/نام کاربری یا گذرواژه نادرست است.' : 'Incorrect email/username or password.',
        rate_limited: isFa ? 'تلاش‌های بیش از حد؛ کمی بعد دوباره امتحان کنید.' : 'Too many attempts — try again shortly.',
        network: isFa ? 'خطای شبکه — اتصال خود را بررسی کنید.' : 'Network error — check your connection.'
      };
      if (Array.isArray(errors)) return errors.map(e => map[e.code] || e.code).join(' ');
      return map[errors] || (isFa ? 'خطای نامشخص رخ داد.' : 'An unexpected error occurred.');
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
          <div style="font-size:11px; color:var(--text-dim); line-height:1.6;">${isFa ? 'ایمیل حساب خود را وارد کنید. کد ۶ رقمی بازیابی برایتان ارسال می‌شود.' : 'Enter your account email. A 6-digit reset code will be sent to you.'}</div>
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
        err.textContent = isFa ? 'اگر حساب موجود باشد، کد ارسال شده است.' : 'If the account exists, the code has been sent.';
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
          <div style="font-size:11px; color:var(--text-dim); line-height:1.6;">${isFa ? `کد ۶ رقمی ارسال‌شده به <span dir="ltr">${escapeHtml(this.user.email)}</span> را وارد کنید.` : `Enter the 6-digit code sent to <span dir="ltr">${escapeHtml(this.user.email)}</span>.`}</div>
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

  async renderAccountTab(overlay, tab, isFa) {
    const body = overlay.querySelector('#tc-acc-body');
    if (!body) return;
    const u = this.user;
    const sec = (title) => `<div style="font-size:11px; font-weight:800; color:var(--text-dim,#8b93a7); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">${title}</div>`;
    const row = (k, v) => `<div style="display:flex; justify-content:space-between; gap:10px; font-size:12px; padding:5px 0; border-bottom:1px dashed var(--border-subtle);"><span style="color:var(--text-dim,#8b93a7);">${k}</span><span style="font-weight:600;">${v}</span></div>`;

    if (tab === 'account') {
      // Render the static identity + plan cards immediately, then fill usage
      // rows when the fetch resolves — the modal is never left empty.
      const verified = u.emailVerified
        ? `<span style="color: var(--accent-cyan,#00F2B0); font-size:11px;">✓ ${isFa ? 'ایمیل تأیید شده' : 'Email verified'}</span>`
        : `<button id="acc-verify-btn" style="background:rgba(0,242,176,0.12); color:var(--accent-cyan,#00F2B0); border:none; border-radius:6px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer;">${isFa ? 'تأیید ایمیل' : 'Verify email'}</button>`;
      const since = u.planSince ? new Date(u.planSince).toLocaleDateString(isFa ? 'fa-IR' : 'en-US') : '—';
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
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:13px; font-weight:800;">${this.planLabel()}</div>
            <button id="acc-compare-btn" style="background:rgba(0,242,176,0.12); color:var(--accent-cyan,#00F2B0); border:none; border-radius:6px; padding:6px 12px; font-size:11px; font-weight:700; cursor:pointer;">${isFa ? 'مقایسه و تغییر پلن' : 'Compare & change plan'}</button>
          </div>
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
      body.innerHTML = `
        ${sec(isFa ? 'تغییر گذرواژه' : 'Change password')}
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${this.fieldHtml('acc-current', isFa ? 'گذرواژه فعلی' : 'Current password', 'password', '', '••••••••')}
          ${this.fieldHtml('acc-next', isFa ? 'گذرواژه جدید' : 'New password', 'password', '', isFa ? 'حداقل ۸ کاراکتر شامل حرف و رقم' : 'min 8 chars, letters + digits')}
          ${this.fieldHtml('acc-confirm', isFa ? 'تکرار گذرواژه جدید' : 'Repeat new password', 'password', '', '••••••••')}
          <div id="acc-sec-msg" style="display:none; font-size:11px; line-height:1.5;"></div>
          <button id="acc-pass-save" class="btn-primary" style="padding:9px; font-size:12px; font-weight:800; border-radius:8px; cursor:pointer;">${isFa ? 'به‌روزرسانی گذرواژه' : 'Update password'}</button>
          <div style="font-size:10px; color:var(--text-dim,#8b93a7); line-height:1.6;">${isFa ? 'با تغییر گذرواژه، نشست‌های سایر دستگاه‌ها خاتمه می‌یابد و دستگاه فعلی باقی می‌ماند.' : 'Changing your password signs out all other devices; this device stays signed in.'}</div>
        </div>`;
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
    const planNames = { basic: isFa ? 'پایه' : 'Basic', essential: isFa ? 'اسنشیال' : 'Essential', plus: isFa ? 'پلاس' : 'Plus', premium: isFa ? 'پریمیوم' : 'Premium', ultimate: isFa ? 'آلتیمیت' : 'Ultimate' };
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
      ['webhookAlerts', isFa ? 'هشدار وب‌هوک' : 'Webhook alerts']
    ];
    const fmt = (v) => v === UNLIMITED ? '∞' : (typeof v === 'boolean' ? (v ? '✓' : '—') : toPersianDigits(String(v)));
    const plans = PLAN_ORDER.map(id => this.plansMeta[id] || PLANS[id]);
    const current = this.plan();
    const grid = plans.map(p => {
      const isCurrent = p.id === current;
      return `
        <div style="border:1px solid ${isCurrent ? 'var(--accent-cyan,#00F2B0)' : 'var(--border-subtle)'}; border-radius:10px; padding:12px; background:${isCurrent ? 'rgba(0,242,176,0.05)' : 'var(--bg-surface,#0c1017)'}; display:flex; flex-direction:column; gap:8px; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <strong style="font-size:13px;">${planNames[p.id]}</strong>
            ${isCurrent ? `<span style="font-size:9px; background:var(--accent-cyan,#00F2B0); color:#04121e; padding:2px 7px; border-radius:12px; font-weight:800;">${isFa ? 'پلن فعلی' : 'CURRENT'}</span>` : ''}
          </div>
          <div style="font-size:16px; font-weight:800; color:var(--accent-cyan,#00F2B0);">${p.priceUSD === 0 ? (isFa ? 'رایگان' : 'Free') : '$' + p.priceUSD}<span style="font-size:10px; color:var(--text-dim); font-weight:400;">${p.priceUSD ? (isFa ? '/ماه' : '/mo') : ''}</span></div>
          <button data-plan="${p.id}" ${isCurrent ? 'disabled' : ''} class="tc-plan-btn" style="padding:7px; border-radius:7px; font-size:11px; font-weight:800; cursor:${isCurrent ? 'default' : 'pointer'}; border:1px solid var(--accent-cyan,#00F2B0); background:${isCurrent ? 'transparent' : 'var(--accent-cyan,#00F2B0)'}; color:${isCurrent ? 'var(--accent-cyan,#00F2B0)' : '#04121e'}; opacity:${isCurrent ? '0.5' : '1'};">
            ${isCurrent ? (isFa ? 'فعال' : 'Active') : (this.planRank(p.id) < this.planRank(current) ? (isFa ? 'سوئیچ' : 'Switch') : (isFa ? 'ارتقا' : 'Upgrade'))}
          </button>
        </div>`;
    }).join('');

    const table = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; min-width:560px;">
          <thead><tr>
            <th style="text-align:${isFa ? 'right' : 'left'}; padding:8px; color:var(--text-dim); font-weight:600;">${isFa ? 'ویژگی' : 'Feature'}</th>
            ${plans.map(p => `<th style="padding:8px; color:#fff; font-weight:700;">${planNames[p.id]}</th>`).join('')}
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
          <span style="font-weight:800; font-size:14px; color:#fff;">${isFa ? 'پلن‌های تریدینگ‌چارت' : 'TradingChart Plans'}</span>
          <button data-close style="background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); color:var(--text-dim); cursor:pointer; width:26px; height:26px; border-radius:6px;">✕</button>
        </div>
        <div style="padding:16px 18px; display:flex; flex-direction:column; gap:14px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">${grid}</div>
          ${this.usage ? `<div style="font-size:11px; color:var(--text-dim);">${isFa ? `مصرف فعلی: ${toPersianDigits(String(this.usage.layouts))} چیدمان · ${toPersianDigits(String(this.usage.watchlists))} واچ‌لیست · ${toPersianDigits(String(Math.round(this.usage.stateBytes / 1024)))} کیلوبایت فضای ابری` : `Current usage: ${this.usage.layouts} layouts · ${this.usage.watchlists} watchlists · ${Math.round(this.usage.stateBytes / 1024)} KB cloud`}</div>` : ''}
          ${table}
          <div style="font-size:10px; color:var(--text-dim); line-height:1.6;">${isFa ? 'صورت‌حساب‌دهی در این نسخه شبیه‌سازی‌شده است و با کلیک بلافاصله اعمال می‌شود. سقف هر پلن هم در سرور و هم در رابط کاربری اعمال می‌شود.' : 'Billing is simulated in this build and applies instantly on click. Each plan’s limits are enforced both server-side and in the UI.'}</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) { overlay.remove(); return; }
      const btn = e.target.closest('[data-plan]');
      if (btn && !btn.disabled) {
        const planId = btn.dataset.plan;
        const r = await this.switchPlanWithStateGuard(planId);
        const isFa2 = getLanguage() === 'fa';
        if (r.ok) {
          overlay.remove();
          this.app?.showToast?.(isFa2 ? `پلن شما به «${planNames[planId]}» تغییر کرد.` : `Plan switched to ${planNames[planId]}.`, 'success');
        } else {
          this.app?.showToast?.(isFa2 ? 'تغییر پلن ناموفق بود.' : 'Plan switch failed.', 'error');
        }
      }
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
