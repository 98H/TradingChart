// client/admin/core.js — shared runtime for the back-office console:
// i18n (formal Persian + English), number/date formatting, API client,
// HTML escaping, icons, toasts and accessible dialogs.

const LANG_KEY = 'tc_admin_lang';

export const state = {
  lang: (() => {
    try {
      const v = localStorage.getItem(LANG_KEY);
      if (v === 'fa' || v === 'en') return v;
      const s = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
      if (s.language === 'en') return 'en';
    } catch (e) { /* storage unavailable */ }
    return 'fa';
  })()
};

export const isFa = () => state.lang === 'fa';

export function setLang(lang) {
  state.lang = lang === 'en' ? 'en' : 'fa';
  try { localStorage.setItem(LANG_KEY, state.lang); } catch (e) { /* session-only */ }
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'fa' ? 'rtl' : 'ltr';
  document.title = isFa() ? 'پنل مدیریت چارتیویا' : 'Chartivia Admin Console';
}

/** Pick the string for the current language: tr('فارسی', 'English') */
export const tr = (fa, en) => (isFa() ? fa : en);

// ── Formatting ─────────────────────────────────────────────────────────────
const nfCache = new Map();
function nf(opts = {}) {
  const k = state.lang + JSON.stringify(opts);
  if (!nfCache.has(k)) nfCache.set(k, new Intl.NumberFormat(isFa() ? 'fa-IR' : 'en-US', opts));
  return nfCache.get(k);
}
export const fmtNum = (n, opts) => nf(opts).format(Number(n) || 0);
/** English count noun: plural(1, 'user') → 'user', plural(2, 'user') → 'users'. */
export const plural = (n, one, many = one + 's') => (Number(n) === 1 ? one : many);
export const fmtMoney = (n) => {
  const v = Number(n) || 0;
  const s = nf({ minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v);
  return isFa() ? `${s} دلار` : `$${s}`;
};
export const fmtPct = (r) => nf({ style: 'percent', maximumFractionDigits: 1 }).format(Number(r) || 0);
export function fmtBytes(b) {
  const n = Number(b) || 0;
  if (n < 1024) return `${fmtNum(n)} ${tr('بایت', 'B')}`;
  if (n < 1048576) return `${fmtNum(Math.round(n / 102.4) / 10)} ${tr('کیلوبایت', 'KB')}`;
  return `${fmtNum(Math.round(n / 104857.6) / 10)} ${tr('مگابایت', 'MB')}`;
}
export function fmtDate(ts, withTime = true) {
  if (!ts) return '—';
  const d = new Date(ts);
  const opts = withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleString(isFa() ? 'fa-IR' : 'en-US', opts);
}
export function fmtDay(isoDay) {
  return new Date(isoDay + 'T00:00:00Z').toLocaleDateString(isFa() ? 'fa-IR' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function fmtAgo(ts) {
  if (!ts) return tr('هرگز', 'Never');
  const rtf = new Intl.RelativeTimeFormat(isFa() ? 'fa' : 'en', { numeric: 'auto' });
  const diff = (ts - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return tr('همین الان', 'just now');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const parts = [];
  // number and unit never split across lines (no lone "hours" under a narrow KPI value)
  if (d) parts.push(`${fmtNum(d)}\u00A0${tr('روز', d === 1 ? 'day' : 'days')}`);
  if (h) parts.push(`${fmtNum(h)}\u00A0${tr('ساعت', h === 1 ? 'hour' : 'hours')}`);
  if (!d && (m || !parts.length)) parts.push(`${fmtNum(m)}\u00A0${tr('دقیقه', m === 1 ? 'minute' : 'minutes')}`);
  return parts.join(tr(' و ', ', '));
}

// ── Escaping ──────────────────────────────────────────────────────────────
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(String(c)) ? c : '#00F2B0');

// ── API client ────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(status, data) { super(data?.error || `http_${status}`); this.status = status; this.data = data || {}; }
}
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function api(url, { method = 'GET', body, raw = false } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method, credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new ApiError(0, { error: 'network' });
  }
  if (raw) {
    if (!res.ok) throw new ApiError(res.status, {});
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && data.error === 'forbidden_admin_only' && onUnauthorized) onUnauthorized();
  if (!res.ok || data.ok === false) throw new ApiError(res.status, data);
  return data;
}

/** Human message for a server error code (formal Persian / English). */
export function errMsg(e) {
  const code = e?.data?.error || e?.message || 'unknown';
  const M = {
    network: ['ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.', 'Could not reach the server. Check your connection.'],
    rate_limited: ['تعداد تلاش‌ها بیش از حد مجاز است. یک دقیقه بعد دوباره تلاش کنید.', 'Too many attempts. Please wait a minute and try again.'],
    invalid_master_key: ['کلید مدیریت نادرست است.', 'The admin key is incorrect.'],
    forbidden_admin_only: ['نشست مدیریتی شما منقضی شده است. لطفاً دوباره وارد شوید.', 'Your admin session has expired. Please sign in again.'],
    user_not_found: ['این کاربر دیگر وجود ندارد.', 'This user no longer exists.'],
    unknown_plan: ['پلن انتخاب‌شده معتبر نیست.', 'The selected plan is not valid.'],
    cannot_demote_self: ['نمی‌توانید نقش مدیریتی حساب خودتان را لغو کنید.', 'You cannot remove your own admin role.'],
    cannot_suspend_self: ['نمی‌توانید حساب خودتان را تعلیق کنید.', 'You cannot suspend your own account.'],
    cannot_delete_self: ['نمی‌توانید حساب خودتان را حذف کنید.', 'You cannot delete your own account.'],
    confirm_mismatch: ['نام کاربری واردشده با نام کاربری این حساب مطابقت ندارد.', 'The username you typed does not match this account.'],
    twofa_not_enabled: ['تأیید دومرحله‌ای برای این کاربر فعال نیست.', 'Two-factor authentication is not enabled for this user.'],
    session_not_found: ['این نشست پیش‌تر پایان یافته است.', 'This session has already ended.'],
    invalid_display_name: ['نام نمایشی نمی‌تواند خالی باشد.', 'Display name cannot be empty.'],
    invalid_plan_id: ['شناسه پلن معتبر نیست؛ ۲ تا ۳۲ نویسه شامل حروف کوچک انگلیسی، رقم، خط‌تیره یا زیرخط وارد کنید.', 'Invalid plan ID: use 2–32 lowercase letters, digits, hyphens or underscores.'],
    invalid_new_id: ['شناسه پلن معتبر نیست؛ ۲ تا ۳۲ نویسه شامل حروف کوچک انگلیسی، رقم، خط‌تیره یا زیرخط وارد کنید.', 'Invalid plan ID: use 2–32 lowercase letters, digits, hyphens or underscores.'],
    plan_exists: ['پلنی با این شناسه وجود دارد. شناسه دیگری انتخاب کنید.', 'A plan with this ID already exists. Choose another ID.'],
    plan_not_found: ['این پلن دیگر وجود ندارد.', 'This plan no longer exists.'],
    source_plan_not_found: ['پلن مبدأ دیگر وجود ندارد.', 'The source plan no longer exists.'],
    cannot_delete_default_plan: ['پلن پیش‌فرض قابل حذف نیست. ابتدا پلن دیگری را پیش‌فرض کنید.', 'The default plan cannot be deleted. Make another plan the default first.'],
    cannot_delete_last_plan: ['دست‌کم یک پلن باید باقی بماند.', 'At least one plan must remain.'],
    cannot_delete_builtin_plan: ['پلن‌های پایه سامانه حذف‌شدنی نیستند؛ در صورت نیاز، آن را غیرفعال کنید.', 'Built-in plans cannot be deleted; deactivate it instead.'],
    cannot_unset_default: ['برای تغییر پلن پیش‌فرض، پلن دیگری را پیش‌فرض کنید.', 'To change the default, mark another plan as default.'],
    default_must_be_active: ['پلن پیش‌فرض باید فعال بماند.', 'The default plan must stay active.'],
    invalid_order: ['ترتیب ارسالی معتبر نیست.', 'Invalid order.'],
    validation_failed: ['برخی مقادیر معتبر نیستند. موارد مشخص‌شده را اصلاح کنید.', 'Some values are invalid. Please fix the highlighted fields.'],
    invalid_ids: ['هیچ کاربری انتخاب نشده است.', 'No users selected.'],
    unknown: ['خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.', 'An unexpected error occurred. Please try again.']
  };
  const m = M[code] || M.unknown;
  return tr(m[0], m[1]);
}

// ── Icons (inline SVG, stroke-based, currentColor) ─────────────────────────
const P = {
  shield: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  plans: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/>',
  audit: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  system: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  forward: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  money: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  flask: '<path d="M9 2h6M10 2v6L4 19a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 8V2"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
};
export const icon = (name, cls = '') => `<svg ${cls ? `class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

// ── Toasts ────────────────────────────────────────────────────────────────
// Toasts never cover a persistent control. Re-measured every frame while a toast is on screen.
// - Phones: the stack sits in the header band over the page/drawer title (not interactive) and ends before
//   the header's inline-end buttons (measured), so the thumb zone (bottom nav, save/bulk bars, drawer
//   actions) stays clear.
// - Wider screens: the bottom stack floats above a sticky save bar, a stuck bulk-actions bar or the drawer's action footer under it.
const TOAST_PHONE = '(max-width: 860px)';
const TOAST_BASE = 24; // desktop `.toasts { bottom }` in admin.css
let toastRaf = 0;
const shown = (el) => { const r = el && el.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 && r.bottom > 0 ? r : null; };
function placeToasts() {
  toastRaf = 0;
  const host = document.querySelector('.toasts');
  if (!host || !host.childElementCount) return;
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  if (matchMedia(TOAST_PHONE).matches) {
    const rtl = document.documentElement.dir === 'rtl';
    const dh = document.querySelector('.drawer .drawer-head');
    const head = (shown(dh) && dh) || document.querySelector('.topbar');
    let end = 10;
    for (const btn of head ? head.querySelectorAll('button, a[href], select, input') : []) {
      const r = shown(btn);
      if (!r || (rtl ? r.left > vw / 2 : r.right < vw / 2)) continue; // only the inline-end cluster
      end = Math.max(end, (rtl ? r.right : vw - r.left) + 8);
    }
    const v = `${Math.ceil(end)}px`;
    if (host.style.getPropertyValue('--toast-end') !== v) host.style.setProperty('--toast-end', v);
    if (host.style.bottom) host.style.bottom = '';
    if (host.style.insetInlineStart) host.style.insetInlineStart = '';
  } else {
    // An open drawer owns the inline-end side. Centre the stack over the free area beside it so it never
    // straddles the drawer edge; when that area is narrower than the stack, centre it over the drawer.
    const dr = shown(document.querySelector('.drawer'));
    let start = '';
    if (dr) {
      const rtl = document.documentElement.dir === 'rtl';
      const free = rtl ? vw - dr.right : dr.left;
      const c = free >= host.offsetWidth + 24 ? (rtl ? dr.right + free / 2 : free / 2) : dr.left + dr.width / 2;
      start = `${Math.round(rtl ? vw - c : c)}px`;
    }
    if (host.style.insetInlineStart !== start) host.style.insetInlineStart = start;
    const hr = host.getBoundingClientRect();
    let lift = TOAST_BASE;
    for (const el of document.querySelectorAll('.sticky-save, #u-bulk .bulkbar, .drawer-foot')) {
      const r = el.getBoundingClientRect();
      if (r.height && r.top < vh && r.bottom > vh - TOAST_BASE - hr.height - 12 && r.right > hr.left && r.left < hr.right) lift = Math.max(lift, vh - r.top + 12);
    }
    const v = lift > TOAST_BASE ? `${Math.ceil(lift)}px` : '';
    if (host.style.bottom !== v) host.style.bottom = v;
  }
  toastRaf = requestAnimationFrame(placeToasts);
}

export function toast(msg, type = 'success', ms = 4200) {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check')}<div></div><button type="button" class="toast-x" aria-label="${tr('بستن پیام', 'Dismiss')}">${icon('close')}</button>`;
  el.querySelector('div').textContent = msg;
  el.querySelector('.toast-x').addEventListener('click', () => el.remove());
  // Each toast reports the latest action. Older successes and infos go, so a stale message never sits
  // next to a newer result; errors stay until they time out or are dismissed.
  for (const old of [...host.children]) if (!old.classList.contains('error')) old.remove();
  host.appendChild(el);
  placeToasts();
  if (!toastRaf) toastRaf = requestAnimationFrame(placeToasts);
  while (host.children.length > 3) host.firstElementChild.remove();
  // errors stay longer: they usually need reading + action
  setTimeout(() => el.remove(), type === 'error' ? Math.max(ms, 7000) : ms);
}

// ── Dialogs ───────────────────────────────────────────────────────────────
/**
 * Accessible modal dialog. Returns a Promise resolved with the onConfirm
 * result (or null on cancel). onConfirm(dialogEl) may throw to show an error
 * inline and keep the dialog open; return false to keep it open silently.
 */
export function openDialog({ title, body, confirmText, cancelText, danger = false, iconName = danger ? 'alert' : 'info', onConfirm, confirmDisabled = false, onOpen, noCancel = false }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    const id = 'dlg-' + Math.random().toString(36).slice(2, 8);
    wrap.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="${id}-t">
        <div class="dialog-head">
          <div class="dialog-icon" style="background:${danger ? 'var(--danger-soft)' : 'var(--accent-soft)'}; color:${danger ? 'var(--danger)' : 'var(--accent)'}">${icon(iconName)}</div>
          <h2 id="${id}-t">${esc(title)}</h2>
        </div>
        <div class="dialog-body">${body || ''}<div class="alert alert-danger" data-dlg-err hidden></div></div>
        <div class="dialog-foot">
          ${noCancel ? '' : `<button type="button" class="btn" data-dlg-cancel>${esc(cancelText || tr('انصراف', 'Cancel'))}</button>`}
          <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-dlg-ok ${confirmDisabled ? 'disabled' : ''}>${esc(confirmText || tr('تأیید', 'Confirm'))}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const dlg = wrap.querySelector('.dialog');
    const okBtn = wrap.querySelector('[data-dlg-ok]');
    const errBox = wrap.querySelector('[data-dlg-err]');
    let busy = false;
    const close = (val) => {
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      try { prevFocus?.focus?.(); } catch (e) { /* gone */ }
      resolve(val);
    };
    const confirm = async () => {
      if (busy || okBtn.disabled) return;
      busy = true; okBtn.disabled = true;
      const label = okBtn.innerHTML;
      okBtn.innerHTML = `<span class="spinner"></span>`;
      errBox.hidden = true;
      try {
        const r = onConfirm ? await onConfirm(dlg) : true;
        if (r === false) { busy = false; okBtn.disabled = false; okBtn.innerHTML = label; return; }
        close(r === undefined ? true : r);
      } catch (e) {
        errBox.textContent = e instanceof ApiError ? errMsg(e) : (e.message || String(e));
        errBox.hidden = false;
        busy = false; okBtn.disabled = false; okBtn.innerHTML = label;
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!busy) close(null); }
      else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); confirm(); }
      else if (e.key === 'Tab') {
        const f = [...dlg.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap && !busy) close(null); });
    wrap.querySelector('[data-dlg-cancel]')?.addEventListener('click', () => { if (!busy) close(null); });
    okBtn.addEventListener('click', confirm);
    onOpen?.(dlg, okBtn);
    setTimeout(() => (dlg.querySelector('input, select, textarea') || okBtn).focus(), 30);
  });
}

export const confirmDialog = (opts) => openDialog(opts).then(v => v !== null);
