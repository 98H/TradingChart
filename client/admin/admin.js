// client/admin/admin.js — TradingChart back-office console (entry point)
// Sections: dashboard · users · plans · audit · settings · system.
// Auth: server-side admin session (HttpOnly cookie) or admin account role.

import {
  state, isFa, setLang, tr, api, ApiError, errMsg, esc, icon, toast, openDialog, confirmDialog,
  fmtNum, fmtMoney, fmtPct, fmtDate, fmtDay, fmtAgo, fmtBytes, fmtDuration, safeColor, setUnauthorizedHandler, plural } from './core.js';
import { renderPlans, plansDirty, confirmLeavePlans } from './plans.js';

const root = document.getElementById('adm-root');
const SECTIONS = ['dashboard', 'users', 'plans', 'audit', 'settings', 'system'];
const NAV = () => [
  { id: 'dashboard', icon: 'dashboard', label: tr('داشبورد', 'Dashboard') },
  { id: 'users', icon: 'users', label: tr('کاربران', 'Users') },
  { id: 'plans', icon: 'plans', label: tr('پلن‌ها', 'Plans') },
  { id: 'audit', icon: 'audit', label: tr('گزارش رویدادها', 'Audit log'), short: tr('رویدادها', 'Audit') },
  { id: 'settings', icon: 'settings', label: tr('تنظیمات', 'Settings') },
  { id: 'system', icon: 'system', label: tr('سلامت سامانه', 'System health'), short: tr('سامانه', 'System') }
];

const app = {
  session: null,
  section: 'dashboard',
  plansMeta: null,
  users: { q: '', plan: 'all', role: 'all', status: 'all', type: 'real', sort: 'createdAt', dir: 'desc', page: 1, pageSize: 20, selected: new Set(), data: null },
  audit: { q: '', action: 'all', status: 'all', page: 1, data: null },
  dashType: 'real',
  settingsEdit: null // { s, orig, draft }: module-level so a language switch keeps unsaved edits
};
// Sections that hold unsaved drafts ask before the user leaves them.
const LEAVE_GUARDS = {
  plans: { dirty: plansDirty, confirm: confirmLeavePlans },
  settings: { dirty: () => settingsDirty(), confirm: () => confirmLeaveSettings() }
};

// ── Boot ──────────────────────────────────────────────────────────────────
setLang(state.lang);
setUnauthorizedHandler(() => {
  if (!app.session) return;
  app.session = null;
  toast(errMsg({ data: { error: 'forbidden_admin_only' } }), 'error');
  renderGate();
});
window.addEventListener('hashchange', async () => {
  if (!app.session) return;
  const next = sectionFromHash();
  // Leaving a section with unsaved edits (plan editor, settings): hold the URL, ask first.
  const guard = next !== app.section ? LEAVE_GUARDS[app.section] : null;
  if (guard && guard.dirty()) {
    history.replaceState(null, '', `#/${app.section}`);
    if (!(await guard.confirm())) return;
    history.replaceState(null, '', `#/${next}`);
  }
  route();
});
window.addEventListener('beforeunload', (e) => { if (plansDirty() || settingsDirty()) { e.preventDefault(); e.returnValue = ''; } });
boot();

async function boot() {
  root.innerHTML = `<div class="gate"><div class="spinner" role="status" aria-label="${tr('در حال بارگذاری', 'Loading')}"></div></div>`;
  try {
    const s = await api('/api/admin/session');
    if (s.isAdmin) { app.session = s; renderShell(); route(); return; }
  } catch (e) { /* fall through to gate */ }
  renderGate();
}

function sectionFromHash() {
  const h = (location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
  return SECTIONS.includes(h) ? h : 'dashboard';
}

// ── Login gate ────────────────────────────────────────────────────────────
function renderGate(errorCode = null) {
  root.innerHTML = `
    <main class="gate">
      <form class="gate-card" id="gate-form" novalidate>
        <div class="gate-head">
          <div class="brand-logo">${icon('shield')}</div>
          <h1>${tr('ورود به پنل مدیریت', 'Admin console sign-in')}</h1>
          <p>${tr('این بخش فقط برای مدیران پلتفرم است. برای ادامه، کلید مدیریت سامانه را وارد کنید.', 'This area is restricted to platform administrators. Enter the system admin key to continue.')}</p>
        </div>
        <div class="field">
          <label for="gate-key">${tr('کلید مدیریت', 'Admin key')}</label>
          <div class="input-group">
            <input id="gate-key" class="input ltr" type="password" autocomplete="current-password" spellcheck="false" autocapitalize="off" required aria-describedby="gate-hint gate-err" />
            <button type="button" class="btn btn-ghost btn-icon" id="gate-eye" aria-label="${tr('نمایش کلید', 'Show key')}" aria-pressed="false">${icon('eye')}</button>
          </div>
          <span class="hint" id="gate-hint">${tr('کلید مدیریت را از مسئول فنی پلتفرم دریافت کنید. این کلید را با هیچ‌کس به اشتراک نگذارید.', 'Get the admin key from your platform’s technical owner. Never share it with anyone.')}</span>
          <div class="alert alert-danger" id="gate-err" role="alert" ${errorCode ? '' : 'hidden'}>${errorCode ? esc(errMsg({ data: { error: errorCode } })) : ''}</div>
        </div>
        <button type="submit" class="btn btn-primary" id="gate-submit">${icon('lock')}<span>${tr('ورود به پنل', 'Sign in')}</span></button>
        <div class="gate-foot">
          <a class="linkbtn" href="/">${icon(isFa() ? 'forward' : 'back')}<span>${tr('بازگشت به تریدینگ‌چارت', 'Back to TradingChart')}</span></a>
          <button type="button" class="btn btn-sm lang-btn" id="gate-lang">${icon('globe')}<span class="lang-name" lang="${isFa() ? 'en' : 'fa'}">${tr('English', 'فارسی')}</span></button>
        </div>
      </form>
    </main>`;
  const form = root.querySelector('#gate-form');
  const input = root.querySelector('#gate-key');
  const err = root.querySelector('#gate-err');
  const submit = root.querySelector('#gate-submit');
  const eye = root.querySelector('#gate-eye');
  eye.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? tr('پنهان کردن کلید', 'Hide key') : tr('نمایش کلید', 'Show key'));
    eye.innerHTML = icon(show ? 'eyeOff' : 'eye');
    input.focus();
  });
  root.querySelector('#gate-lang').addEventListener('click', () => { setLang(isFa() ? 'en' : 'fa'); renderGate(); });
  input.addEventListener('input', () => { err.hidden = true; input.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = input.value.trim();
    if (!key) {
      err.textContent = tr('کلید مدیریت را وارد کنید.', 'Enter the admin key.');
      err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus();
      return;
    }
    submit.disabled = true;
    submit.innerHTML = `<span class="spinner"></span><span>${tr('در حال بررسی…', 'Verifying…')}</span>`;
    try {
      await api('/api/admin/auth', { method: 'POST', body: { masterKey: key } });
      app.session = await api('/api/admin/session');
      input.value = '';
      renderShell(); route();
      // Short enough for one line in the phone header band (a 2-line toast spills over the page subtitle).
      toast(tr('وارد پنل مدیریت شدید.', 'Signed in.'));
    } catch (ex) {
      err.textContent = errMsg(ex);
      err.hidden = false; input.setAttribute('aria-invalid', 'true');
      submit.disabled = false;
      submit.innerHTML = `${icon('lock')}<span>${tr('ورود به پنل', 'Sign in')}</span>`;
      input.select();
    }
  });
  setTimeout(() => input.focus(), 30);
}

// ── Shell ─────────────────────────────────────────────────────────────────
function renderShell() {
  const nav = NAV();
  const who = app.session?.username
    ? `${esc(app.session.username)}`
    : tr('ورود با کلید مدیریت', 'Signed in with admin key');
  const whoTitle = app.session?.username
    ? tr(`واردشده با حساب ${app.session.username}`, `Signed in as ${app.session.username}`)
    : tr('واردشده با کلید مدیریت', 'Signed in with the admin key');
  root.innerHTML = `
    <div class="app">
      <aside class="sidebar" aria-label="${tr('ناوبری پنل', 'Console navigation')}">
        <div class="brand">
          <div class="brand-logo">${icon('shield')}</div>
          <div><div class="brand-title">${tr('پنل مدیریت', 'Admin Console')}</div><div class="brand-sub">${tr('تریدینگ‌چارت', 'TradingChart')}</div></div>
        </div>
        <nav class="nav">
          ${nav.map(n => `<a class="nav-item" href="#/${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}
        </nav>
        <div class="sidebar-foot">
          <a class="nav-item" href="/" target="_blank" rel="noopener">${icon('external')}<span>${tr('مشاهده پلتفرم', 'Open platform')}</span></a>
          <button type="button" class="nav-item" data-act="lang">${icon('globe')}<span class="lang-name" lang="${isFa() ? 'en' : 'fa'}">${tr('English', 'فارسی')}</span></button>
          <button type="button" class="nav-item" data-act="logout">${icon('logout', 'mirror-rtl')}<span>${tr('خروج از پنل', 'Sign out')}</span></button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <h1 id="page-title"></h1>
          <div class="spacer"></div>
          <div class="who">
            <span class="who-chip" title="${esc(whoTitle)}">${icon('shield')}<span class="who-label">${who}</span></span>
            <button type="button" class="btn btn-icon top-icon only-narrow" data-act="lang" aria-label="${tr('تغییر زبان به انگلیسی', 'Switch to Persian')}" title="${tr('English', 'فارسی')}">${icon('globe')}</button>
            <button type="button" class="btn btn-icon top-icon only-narrow" data-act="logout" aria-label="${tr('خروج از پنل', 'Sign out')}" title="${tr('خروج از پنل', 'Sign out')}">${icon('logout', 'mirror-rtl')}</button>
          </div>
        </header>
        <main class="content" id="view" tabindex="-1"></main>
      </div>
      <nav class="bottom-nav" aria-label="${tr('ناوبری پنل', 'Console navigation')}">
        ${nav.map(n => `<button type="button" data-nav="${n.id}">${icon(n.icon)}<span>${n.short || n.label}</span></button>`).join('')}
      </nav>
    </div>`;
  root.querySelectorAll('.bottom-nav [data-nav]').forEach(b => b.addEventListener('click', () => go(b.dataset.nav)));
  // Language switch keeps any unsaved plan draft (it lives in module state).
  root.querySelectorAll('[data-act="lang"]').forEach(b => b.addEventListener('click', () => {
    setLang(isFa() ? 'en' : 'fa'); renderShell(); route(true);
  }));
  root.querySelectorAll('[data-act="logout"]').forEach(b => b.addEventListener('click', logout));
}

function go(section) {
  if (section === app.section && location.hash === `#/${section}`) return;
  location.hash = `#/${section}`; // hashchange handler guards unsaved plan edits
}

async function logout() {
  if (!(await confirmLeavePlans()) || !(await confirmLeaveSettings())) return;
  const viaRole = app.session?.via === 'role';
  const ok = await confirmDialog({
    title: tr('خروج از پنل مدیریت', 'Sign out of the console'),
    body: `<p style="margin:0">${viaRole
      ? tr('شما با نقش مدیریتی حساب کاربری‌تان وارد شده‌اید؛ با خروج، به پلتفرم بازمی‌گردید و همچنان می‌توانید از منوی حساب به این پنل برگردید.', 'You are signed in through your account’s admin role; signing out returns you to the platform, and you can come back from the account menu.')
      : tr('نشست مدیریتی این مرورگر پایان می‌یابد. برای ورود دوباره به کلید مدیریت نیاز دارید.', 'The admin session in this browser will end. You will need the admin key to sign in again.')}</p>`,
    confirmText: tr('خروج', 'Sign out'), iconName: 'logout'
  });
  if (!ok) return;
  try { await api('/api/admin/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
  if (viaRole) { location.href = '/'; return; }
  app.session = null;
  renderGate();
}

function route(force = false) {
  const sec = sectionFromHash();
  const changed = sec !== app.section;
  app.section = sec;
  const meta = NAV().find(n => n.id === sec);
  const title = root.querySelector('#page-title');
  if (title) title.textContent = meta.label;
  document.title = `${meta.label} · ${tr('پنل مدیریت تریدینگ‌چارت', 'TradingChart Admin')}`;
  root.querySelectorAll('[data-nav]').forEach(el => {
    if (el.dataset.nav === sec) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  const view = root.querySelector('#view');
  if (!view) return;
  if (changed || force) window.scrollTo(0, 0);
  ({ dashboard: renderDashboard, users: renderUsers, plans: (v) => renderPlans(v, ctx), audit: renderAudit, settings: renderSettings, system: renderSystem })[sec](view);
}

const ctx = { app, go, refreshPlansMeta };
async function refreshPlansMeta() {
  try { const r = await api('/api/admin/plans'); app.plansMeta = r; } catch (e) { /* keep old */ }
  return app.plansMeta;
}
const planName = (id) => {
  const p = app.plansMeta?.plans?.[id];
  if (!p) return id;
  return isFa() ? (p.nameFa || p.nameEn || id) : (p.nameEn || id);
};
const planColor = (id) => safeColor(app.plansMeta?.plans?.[id]?.color);

function loadingBlock(h = 120) { return `<div class="skeleton" style="height:${h}px"></div>`; }
function errorBlock(e, retryId) {
  return `<div class="card"><div class="empty">${icon('alert')}<strong>${tr('بارگذاری اطلاعات ناموفق بود', 'Could not load data')}</strong><span>${esc(errMsg(e))}</span><button type="button" class="btn" id="${retryId}">${icon('refresh')}<span>${tr('تلاش دوباره', 'Try again')}</span></button></div></div>`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────
/** KPI money: the amount at value size, the currency unit smaller (no bidi split). */
function moneyHtml(n) {
  const s = esc(fmtMoney(n));
  return isFa() ? s.replace(/ دلار$/, ' <small class="kpi-unit">دلار</small>') : s.replace(/^\$/, '<small class="kpi-unit kpi-cur">$</small>');
}
/** Card-head "see all" link with a direction-aware arrow. */
const moreBtn = (go, label) => `<button type="button" class="btn btn-sm btn-ghost more-btn" data-go="${go}"><span>${label}</span>${icon(isFa() ? 'back' : 'forward')}</button>`;
async function renderDashboard(view) {
  view.innerHTML = `
    <div class="page-head">
      <div><p>${tr('نمای کلی کاربران، درآمد و فعالیت پلتفرم', 'Overview of users, revenue, and platform activity')}</p></div>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="${tr('دامنه آمار', 'Data scope')}">
          ${[['real', tr('کاربران واقعی', 'Real users')], ['all', tr('همه', 'All')], ['test', tr('حساب‌های آزمایشی', 'Test accounts')]].map(([v, l]) => `<button type="button" data-scope="${v}" aria-pressed="${app.dashType === v}">${l}</button>`).join('')}
        </div>
        <button type="button" class="btn btn-sm btn-collapse" id="dash-refresh" title="${tr('به‌روزرسانی', 'Refresh')}">${icon('refresh')}<span>${tr('به‌روزرسانی', 'Refresh')}</span></button>
      </div>
    </div>
    <div id="dash-body"><div class="grid kpis">${loadingBlock(96).repeat(4)}</div></div>`;
  view.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => { app.dashType = b.dataset.scope; renderDashboard(view); }));
  view.querySelector('#dash-refresh').addEventListener('click', () => renderDashboard(view));
  const body = view.querySelector('#dash-body');
  let d;
  try {
    if (!app.plansMeta) await refreshPlansMeta();
    d = await api(`/api/admin/overview?type=${app.dashType}`);
  } catch (e) {
    body.innerHTML = errorBlock(e, 'dash-retry');
    body.querySelector('#dash-retry')?.addEventListener('click', () => renderDashboard(view));
    return;
  }
  if (app.section !== 'dashboard') return;
  const k = d.kpi;
  const growth = k.prev30 ? (k.new30 - k.prev30) / k.prev30 : null;
  // Real peak (0 when the window is empty) — the bar scale alone is clamped to 1.
  const peak = Math.max(0, ...d.signups.map(s => s.count));
  const scale = Math.max(1, peak);
  const signTotal = d.signups.reduce((a, s) => a + s.count, 0);
  const planUsers = d.planDist.reduce((a, b) => a + b.count, 0);
  const totalPlanUsers = planUsers || 1;
  const chartHtml = signTotal
    ? `<div class="bars" role="img" aria-label="${tr(`نمودار ثبت‌نام روزانه؛ مجموع ${fmtNum(signTotal)} ثبت‌نام در ۳۰\u00A0روز، بیشینه ${fmtNum(peak)} در یک روز`, `Daily sign-ups chart: ${fmtNum(signTotal)} ${plural(signTotal, 'sign-up')} in 30\u00A0days, peak ${fmtNum(peak)} per day`)}">
        ${d.signups.map(s => `<div class="bar ${s.count ? '' : 'zero'}" style="height:${Math.max(2, (s.count / scale) * 100)}%" title="${esc(fmtDay(s.day))}: ${fmtNum(s.count)}"></div>`).join('')}
      </div>
      <div class="bars-axis"><span>${esc(fmtDay(d.signups[0].day))}</span><span>${esc(fmtDay(d.signups[14].day))}</span><span>${esc(fmtDay(d.signups[29].day))}</span></div>`
    : `<div class="chart-empty">${icon('chart')}<strong>${tr('در ۳۰\u00A0روز اخیر ثبت‌نامی انجام نشده است', 'No sign-ups in the last 30\u00A0days')}</strong><span>${app.dashType === 'real' && d.testCount ? tr('حساب‌های آزمایشی در این نما شمرده نمی‌شوند.', 'Test accounts are not counted in this view.') : tr('با ثبت‌نام اولین کاربر، روند روزانه اینجا نمایش داده می‌شود.', 'The daily trend appears here once users sign up.')}</span></div>`;
  const scopeNote = app.dashType === 'real' && d.testCount
    ? `<div class="alert alert-info">${icon('flask')}<div>${k.users === 0 ? tr('هنوز هیچ کاربر واقعی ثبت‌نام نکرده است. ', 'No real users have signed up yet. ') : ''}${tr(
      `${fmtNum(d.testCount)} حساب آزمایشی (دامنه‌های تست) از این آمار کنار گذاشته شده‌اند. فهرست دامنه‌ها در <button type="button" class="link-btn" data-go="settings">تنظیمات</button> قابل ویرایش است.`,
      `${fmtNum(d.testCount)} test ${plural(d.testCount, 'account')} (test email domains) ${plural(d.testCount, 'is', 'are')} excluded from these figures. Edit the domain list in <button type="button" class="link-btn" data-go="settings">Settings</button>.`)}</div></div>` : '';
  const kpi = (ic, label, value, sub = '') => `<div class="card kpi"><div class="kpi-label">${icon(ic)}<span>${label}</span></div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`;
  body.innerHTML = `
    <div class="grid" style="gap:14px">
      ${scopeNote}
      <div class="grid kpis">
        ${kpi('users', tr('کل کاربران', 'Total users'), fmtNum(k.users), tr(`${fmtNum(k.new7)} ثبت‌نام در ۷\u00A0روز اخیر`, `${fmtNum(k.new7)} ${plural(k.new7, 'sign-up')} in the last 7\u00A0days`))}
        ${kpi('activity', tr('کاربران فعال <span class="nw">(۲۴ ساعت)</span>', 'Active users <span class="nw">(24h)</span>'), fmtNum(k.active24), tr(`${fmtNum(k.active7)} کاربر فعال در ۷\u00A0روز اخیر`, `${fmtNum(k.active7)} active in the last 7\u00A0days`))}
        ${kpi('money', tr('درآمد ماهانه اشتراک‌ها', 'Monthly revenue'), moneyHtml(k.mrr), tr(`${fmtNum(k.paid)} اشتراک پولی فعال`, `${fmtNum(k.paid)} active paid subscriptions`))}
        ${kpi('chart', tr('ثبت‌نام ۳۰\u00A0روز اخیر', 'Sign-ups (30\u00A0days)'), fmtNum(k.new30),
          growth === null ? tr('بدون داده برای مقایسه با ۳۰\u00A0روز قبل', 'No prior 30\u00A0days to compare')
            : `<span class="${growth >= 0 ? 'delta-up' : 'delta-down'}">${growth >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(growth))}</span> ${tr('نسبت به ۳۰\u00A0روز قبل', 'vs previous 30\u00A0days')}`)}
      </div>
      <div class="grid cols-2">
        <section class="card">
          <div class="card-head"><h2>${tr('روند ثبت‌نام روزانه (۳۰\u00A0روز)', 'Daily sign-ups (30\u00A0days)')}</h2>${signTotal ? `<span class="badge b-gray">${tr(`بیشینه روزانه: ${fmtNum(peak)}`, `Daily peak: ${fmtNum(peak)}`)}</span>` : ''}</div>
          <div class="card-body">
            ${chartHtml}
          </div>
        </section>
        <section class="card">
          <div class="card-head"><h2>${tr('توزیع کاربران در پلن‌ها', 'Users by plan')}</h2>${moreBtn('plans', tr('مدیریت پلن‌ها', 'Manage plans'))}</div>
          <div class="card-body dist ${planUsers ? '' : 'is-empty'}">
            ${planUsers ? '' : `<p class="dim" style="margin:0;font-size:12.5px">${tr('هنوز کاربری در این نما عضو هیچ پلنی نیست؛ پلن‌های تعریف‌شده:', 'No users in this view are on a plan yet. Defined plans:')}</p>`}
            ${d.planDist.map(p => `
              <div class="dist-row">
                <span style="display:flex;align-items:center;gap:8px;min-width:0"><span class="dot" style="background:${safeColor(p.color)}"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(isFa() ? p.nameFa : p.nameEn)}</span></span>
                <span class="muted">${fmtNum(p.count)}${planUsers ? ` <span class="dim">(${fmtPct(p.count / totalPlanUsers)})</span>` : ''}</span>
                ${planUsers ? `<div class="dist-bar"><span style="width:${(p.count / totalPlanUsers) * 100}%; background:${safeColor(p.color)}"></span></div>` : ''}
              </div>`).join('')}
          </div>
        </section>
      </div>
      <div class="grid kpis">
        ${kpi('mail', tr('ایمیل تأییدشده', 'Verified email'), fmtPct(k.users ? k.verified / k.users : 0), tr(`${fmtNum(k.verified)} از ${fmtNum(k.users)} کاربر`, `${fmtNum(k.verified)} of ${fmtNum(k.users)} ${plural(k.users, 'user')}`))}
        ${kpi('key', tr('تأیید دومرحله‌ای فعال', '2FA enabled'), fmtNum(k.twofa), tr('کاربران دارای برنامه احراز هویت', 'Users with an authenticator app'))}
        ${kpi('ban', tr('حساب‌های تعلیق‌شده', 'Suspended accounts'), fmtNum(k.suspended), tr('بدون دسترسی ورود', 'Cannot sign in'))}
        ${kpi('shield', tr('مدیران پلتفرم', 'Administrators'), fmtNum(k.admins), tr(`${fmtNum(k.adminSessions ?? 0)} نشست فعال در پنل مدیریت`, `${fmtNum(k.adminSessions ?? 0)} active console ${(k.adminSessions ?? 0) === 1 ? 'session' : 'sessions'}`))}
      </div>
      <div class="grid cols-even">
        <section class="card">
          <div class="card-head"><h2>${tr('تازه‌ترین کاربران', 'Newest users')}</h2>${moreBtn('users', tr('همه کاربران', 'All users'))}</div>
          <div>${d.recentUsers.length ? d.recentUsers.map(u => `
            <button type="button" class="mitem" style="width:100%;background:none;border:none;border-bottom:1px solid var(--line);color:inherit;text-align:start;cursor:pointer" data-user="${esc(u.id)}">
              ${avatar(u)}
              <div class="mitem-body"><div class="mitem-row"><strong dir="auto" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.displayName || u.username)}</strong><span class="dim" style="font-size:12px;white-space:nowrap">${esc(fmtAgo(u.createdAt))}</span></div>
              <div class="mitem-row"><span class="dim ltr" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email)}</span>${planBadge(u.plan)}</div></div>
            </button>`).join('') : `<div class="empty">${tr('هنوز کاربری ثبت‌نام نکرده است.', 'No users yet.')}</div>`}</div>
        </section>
        <section class="card">
          <div class="card-head"><h2>${tr('آخرین رویدادهای مدیریتی', 'Latest admin events')}</h2>${moreBtn('audit', tr('گزارش کامل', 'Full log'))}</div>
          <div class="card-body">${d.recentEvents.length ? `<div class="timeline">${d.recentEvents.map(eventItem).join('')}</div>` : `<div class="empty" style="padding:20px">${tr('هنوز رویدادی ثبت نشده است.', 'No events recorded yet.')}</div>`}</div>
        </section>
      </div>
      <div class="dim" style="font-size:12px">${tr('به‌روزشده در', 'Updated')} ${esc(fmtDate(d.generatedAt))}</div>
    </div>`;
  body.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  body.querySelectorAll('[data-user]').forEach(b => b.addEventListener('click', () => openUser(b.dataset.user)));
}

// ── Shared renderers ──────────────────────────────────────────────────────
function avatar(u) {
  const name = (u.displayName || u.username || '?').trim();
  const words = name.split(/[\s._-]+/).filter(Boolean);
  const ch = (words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...name].slice(0, /^[A-Za-z]{2,3}$/.test(name) ? 2 : 1).join('')).toUpperCase() || '?';
  const color = planColor(u.plan);
  return `<span class="avatar" style="background:${color}" aria-hidden="true">${esc(ch)}</span>`;
}
function planBadge(id) {
  const known = !!app.plansMeta?.plans?.[id];
  const c = planColor(id);
  return `<span class="badge" style="background:${c}1f;color:${c}">${esc(known ? planName(id) : id)}</span>`;
}
function statusBadges(u) {
  const b = [];
  if (u.suspended) b.push(`<span class="badge b-red">${tr('تعلیق‌شده', 'Suspended')}</span>`);
  if (u.isAdmin) b.push(`<span class="badge b-blue">${tr('مدیر', 'Admin')}</span>`);
  if (!u.emailVerified) b.push(`<span class="badge b-amber">${tr('ایمیل تأییدنشده', 'Unverified')}</span>`);
  if (u.totpEnabled) b.push(`<span class="badge b-green">${tr('دومرحله‌ای', '2FA')}</span>`);
  if (u.isTest) b.push(`<span class="badge b-gray">${tr('آزمایشی', 'Test')}</span>`);
  return b.length ? `<div class="badges">${b.join('')}</div>` : `<span class="badge b-green">${tr('فعال', 'Active')}</span>`;
}
const ACTIONS = () => ({
  'admin.unlock': tr('ورود به پنل مدیریت', 'Admin sign-in'),
  'admin.lock': tr('خروج از پنل مدیریت', 'Admin sign-out'),
  'admin.revoke_session': tr('لغو نشست مدیریتی', 'Admin session revoked'),
  'user.update': tr('ویرایش کاربر', 'User updated'),
  'user.delete': tr('حذف کاربر', 'User deleted'),
  'user.revoke_sessions': tr('خروج کاربر از همه دستگاه‌ها', 'User signed out everywhere'),
  'user.revoke_session': tr('لغو یک نشست کاربر', 'User session revoked'),
  'user.reset_2fa': tr('غیرفعال‌سازی تأیید دومرحله‌ای', '2FA reset'),
  'user.send_reset': tr('ارسال کد بازیابی گذرواژه', 'Password reset sent'),
  'users.bulk': tr('عملیات گروهی کاربران', 'Bulk user action'),
  'users.export': tr('خروجی فهرست کاربران', 'Users exported'),
  'plan.create': tr('ایجاد پلن', 'Plan created'),
  'plan.update': tr('ویرایش پلن', 'Plan updated'),
  'plan.delete': tr('حذف پلن', 'Plan deleted'),
  'plan.clone': tr('تکثیر پلن', 'Plan duplicated'),
  'plan.reorder': tr('تغییر ترتیب پلن‌ها', 'Plans reordered'),
  'plan.reset': tr('بازنشانی پلن‌ها', 'Plans reset'),
  'settings.update': tr('تغییر تنظیمات پلتفرم', 'Platform settings changed')
});
const FAILED_ACTIONS = () => ({
  'admin.unlock': tr('تلاش ناموفق برای ورود به پنل', 'Failed admin sign-in attempt')
});
const actionLabel = (a, ok = true) => (!ok && FAILED_ACTIONS()[a]) || ACTIONS()[a] || a;
// First-strong isolate: keeps "@user_name" an atomic LTR run inside RTL text.
const isoUser = (u) => `\u2068@${u}\u2069`;
const iso = (s) => `\u2068${s}\u2069`;
const SETTING_LABELS = () => ({
  registrationOpen: tr('ثبت‌نام', 'registration'),
  maintenanceMode: tr('حالت نگهداری', 'maintenance mode'),
  announcementEnabled: tr('نمایش اطلاعیه', 'announcement visibility'),
  announcementLevel: tr('نوع اطلاعیه', 'announcement type'),
  announcementFa: tr('متن فارسی اطلاعیه', 'Persian announcement text'),
  announcementEn: tr('متن انگلیسی اطلاعیه', 'English announcement text'),
  testDomains: tr('دامنه‌های آزمایشی', 'test domains')
});
const settingLabel = (k) => SETTING_LABELS()[k] || k;
/** Human, localized label for who performed an audited action. */
function uaLabel(ua) {
  const s = String(ua || '');
  if (!s) return tr('مرورگر ناشناخته', 'Unknown browser');
  const br = /Edg\//.test(s) ? tr('مایکروسافت اج', 'Edge') : /OPR\//.test(s) ? tr('اپرا', 'Opera') : /HeadlessChrome/.test(s) ? tr('مرورگر خودکار (تست)', 'Automated browser (test)')
    : /Firefox\//.test(s) ? tr('فایرفاکس', 'Firefox') : /Chrome\//.test(s) ? tr('کروم', 'Chrome') : /Safari\//.test(s) ? tr('سافاری', 'Safari') : tr('مرورگر', 'Browser');
  const os = /Windows/.test(s) ? tr('ویندوز', 'Windows') : /Android/.test(s) ? tr('اندروید', 'Android') : /iPhone|iPad|iOS/.test(s) ? tr('آی‌اواس', 'iOS') : /Mac OS X|Macintosh/.test(s) ? tr('مک‌اواس', 'macOS') : /Linux|X11/.test(s) ? tr('لینوکس', 'Linux') : '';
  return os ? `${br} · ${os}` : br;
}
function actorLabel(ev) {
  const a = String(ev.actor || '');
  if (ev.actorVia === 'key' || a === 'master-key') return tr('کلید مدیریت (دسترسی خودکار)', 'Admin key (automation)');
  const viaKey = a.match(/^(.+) \(key\)$/);
  if (viaKey) return `${isoUser(viaKey[1])} · ${tr('با کلید مدیریت', 'via admin key')}`;
  if (/^admin-session /.test(a)) return tr(`ورود با کلید مدیریت ${iso(a.slice(14))}`, `Admin key sign-in ${a.slice(14)}`);
  if (!a || a === 'guest') return tr('ناشناس', 'Anonymous');
  return isoUser(a);
}
function eventDetail(ev) {
  const m = ev.meta || {};
  if (!ev.ok && m.reason === 'invalid_key') return tr('کلید نادرست', 'Wrong key');
  if (!ev.ok && m.reason === 'rate_limited') return tr('مسدودشده به‌دلیل تلاش زیاد', 'Blocked: too many attempts');
  if (ev.action === 'user.update' && m.changes) {
    const parts = [];
    const c = m.changes;
    if (c.plan) parts.push(tr(`پلن: ${planName(c.plan[0])} ← ${planName(c.plan[1])}`, `plan: ${planName(c.plan[0])} → ${planName(c.plan[1])}`));
    if (c.role) parts.push(tr(`نقش: ${c.role[1] === 'admin' ? 'مدیر' : 'کاربر'}`, `role: ${c.role[1]}`));
    if (c.suspended) parts.push(c.suspended[1] ? tr('تعلیق حساب', 'suspended') : tr('رفع تعلیق', 'unsuspended'));
    if (c.emailVerified) parts.push(c.emailVerified[1] ? tr('تأیید ایمیل', 'email verified') : tr('لغو تأیید ایمیل', 'email unverified'));
    if (c.displayName) parts.push(tr('نام نمایشی', 'display name'));
    if (c.notes) parts.push(tr('یادداشت داخلی', 'internal note'));
    if (c.testAccount) parts.push(tr('وضعیت حساب آزمایشی', 'test-account flag'));
    return `${m.username ? isoUser(m.username) + ' · ' : ''}${parts.join(tr('، ', ', '))}`;
  }
  if (ev.action === 'users.bulk') return tr(`${fmtNum(m.done || 0)} مورد انجام شد${m.skipped ? `، ${fmtNum(m.skipped)} مورد بدون تغییر` : ''}`, `${fmtNum(m.done || 0)} done${m.skipped ? `, ${fmtNum(m.skipped)} unchanged` : ''}`);
  if (ev.action === 'users.export') return tr(`${fmtNum(m.count || 0)} ردیف`, `${fmtNum(m.count || 0)} ${plural(m.count || 0, 'row')}`);
  if (ev.action === 'plan.update' && m.fields) return tr(`پلن «${planName(ev.target)}» · ${fmtNum(m.fields.length)} فیلد`, `plan “${planName(ev.target)}” · ${fmtNum(m.fields.length)} ${plural(m.fields.length, 'field')}`);
  if (ev.action === 'plan.delete') return tr(`پلن ${iso(ev.target)} · ${fmtNum(m.migratedUsers || 0)} کاربر منتقل شد`, `plan ${ev.target} · ${fmtNum(m.migratedUsers || 0)} ${plural(m.migratedUsers || 0, 'user')} migrated`);
  if (/^plan\.(create|clone)$/.test(ev.action) && ev.target) return tr(`پلن «${planName(ev.target)}»`, `plan “${planName(ev.target)}”`);
  if (ev.action === 'settings.update' && m.fields) return m.fields.map(settingLabel).join(tr('، ', ', '));
  if (m.username) return isoUser(m.username);
  if (ev.target) return String(ev.target);
  return '';
}
function eventItem(ev) {
  return `<div class="tl-item"><span class="tl-dot ${ev.ok ? '' : 'fail'}"></span><div style="min-width:0;flex:1">
    <div style="display:flex;justify-content:space-between;gap:8px"><strong style="font-size:13px">${esc(actionLabel(ev.action, ev.ok !== false))}</strong><span class="dim" style="white-space:nowrap">${esc(fmtAgo(ev.at))}</span></div>
    <div class="dim" style="overflow-wrap:anywhere"><span class="actor">${esc(actorLabel(ev))}</span>${eventDetail(ev) ? ' · ' + esc(eventDetail(ev)) : ''}</div></div></div>`;
}

// ── Users ─────────────────────────────────────────────────────────────────
async function renderUsers(view) {
  const U = app.users;
  if (!app.plansMeta) await refreshPlansMeta().catch(() => {});
  const planOpts = (app.plansMeta?.planOrder || []).map(id => `<option value="${esc(id)}" ${U.plan === id ? 'selected' : ''}>${esc(planName(id))}</option>`).join('');
  view.innerHTML = `
    <div class="page-head">
      <div><p>${tr('جستجو، فیلتر و مدیریت حساب‌های کاربری', 'Search, filter, and manage user accounts')}</p></div>
      <div class="toolbar">
        <button type="button" class="btn btn-sm" id="u-export">${icon('download')}<span>${tr('خروجی CSV', 'Export CSV')}</span></button>
      </div>
    </div>
    <section class="card">
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <div class="toolbar">
          <label class="search"><span class="sr-only">${tr('جستجو', 'Search')}</span>${icon('search')}<input class="input" id="u-q" type="search" dir="auto" value="${esc(U.q)}" placeholder="${tr('جستجو با نام کاربری، ایمیل یا نام نمایشی', 'Search by username, email, or name')}" autocomplete="off" /></label>
        </div>
        <div class="filters">
          <select class="select" id="u-type" aria-label="${tr('نوع حساب', 'Account type')}">
            <option value="real" ${U.type === 'real' ? 'selected' : ''}>${tr('حساب‌ها: واقعی', 'Accounts: real')}</option>
            <option value="test" ${U.type === 'test' ? 'selected' : ''}>${tr('حساب‌ها: آزمایشی', 'Accounts: test')}</option>
            <option value="all" ${U.type === 'all' ? 'selected' : ''}>${tr('حساب‌ها: همه', 'Accounts: all')}</option>
          </select>
          <select class="select" id="u-plan" aria-label="${tr('پلن', 'Plan')}"><option value="all">${tr('همه پلن‌ها', 'All plans')}</option>${planOpts}</select>
          <select class="select" id="u-status" aria-label="${tr('وضعیت', 'Status')}">
            ${[['all', tr('همه وضعیت‌ها', 'All statuses')], ['active', tr('فعال', 'Active')], ['suspended', tr('تعلیق‌شده', 'Suspended')], ['unverified', tr('ایمیل تأییدنشده', 'Unverified email')], ['verified', tr('ایمیل تأییدشده', 'Verified email')], ['twofa', tr('دارای تأیید دومرحله‌ای', '2FA enabled')]].map(([v, l]) => `<option value="${v}" ${U.status === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <select class="select" id="u-role" aria-label="${tr('نقش', 'Role')}">
            ${[['all', tr('همه نقش‌ها', 'All roles')], ['user', tr('کاربر', 'User')], ['admin', tr('مدیر', 'Admin')]].map(([v, l]) => `<option value="${v}" ${U.role === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="u-list">${loadingBlock(240)}</div>
      <div id="u-bulk"></div>
    </section>`;
  let tmr = null;
  view.querySelector('#u-q').addEventListener('input', (e) => {
    clearTimeout(tmr);
    tmr = setTimeout(() => { U.q = e.target.value; U.page = 1; U.selected.clear(); loadUsers(view); }, 280);
  });
  for (const [id, key] of [['#u-type', 'type'], ['#u-plan', 'plan'], ['#u-status', 'status'], ['#u-role', 'role']]) {
    view.querySelector(id).addEventListener('change', (e) => { U[key] = e.target.value; U.page = 1; U.selected.clear(); loadUsers(view); });
  }
  view.querySelector('#u-export').addEventListener('click', exportUsers);
  loadUsers(view);
}

function usersQuery(extra = {}) {
  const U = app.users;
  const p = new URLSearchParams({ q: U.q, plan: U.plan, role: U.role, status: U.status, type: U.type, sort: U.sort, dir: U.dir, page: U.page, pageSize: U.pageSize, ...extra });
  return p.toString();
}

async function loadUsers(view) {
  const U = app.users;
  const host = view.querySelector('#u-list');
  if (!host) return;
  host.setAttribute('aria-busy', 'true');
  let d;
  try { d = await api(`/api/admin/users?${usersQuery()}`); }
  catch (e) {
    host.innerHTML = errorBlock(e, 'u-retry');
    host.querySelector('#u-retry')?.addEventListener('click', () => loadUsers(view));
    return;
  }
  if (app.section !== 'users' || !view.isConnected) return;
  U.data = d;
  host.removeAttribute('aria-busy');
  const exBtn = view.querySelector('#u-export');
  // \u200F (RLM) after "CSV" keeps the count in the Persian run. Without it the digit binds to the Latin run and renders between the words: "CSV (۲) خروجی".
  if (exBtn) { exBtn.disabled = false; exBtn.removeAttribute('title'); const l = exBtn.querySelector('span'); if (l) l.textContent = d.total ? tr(`خروجی CSV\u200F (${fmtNum(d.total)})`, `Export CSV (${fmtNum(d.total)})`) : tr('خروجی CSV', 'Export CSV'); }
  if (!d.users.length) {
    const filtered = !!(U.q || U.plan !== 'all' || U.status !== 'all' || U.role !== 'all');
    const onlyTests = !filtered && U.type === 'real' && d.testCount > 0;
    const title = filtered ? tr('کاربری با این مشخصات یافت نشد', 'No users match these filters')
      : onlyTests ? tr('هنوز هیچ کاربر واقعی ثبت‌نام نکرده است', 'No real users have signed up yet')
      : tr('هنوز هیچ حسابی وجود ندارد', 'There are no accounts yet');
    const sub = filtered ? (U.q ? tr('عبارت جستجو یا فیلترها را تغییر دهید.', 'Try a different search or filters.') : tr('فیلترهای انتخاب‌شده را تغییر دهید.', 'Try different filters.'))
      : onlyTests ? tr(`${fmtNum(d.testCount)} حساب آزمایشی در این نما نمایش داده نمی‌شود.`, `${fmtNum(d.testCount)} test ${plural(d.testCount, 'account')} ${plural(d.testCount, 'is', 'are')} hidden in this view.`)
      : tr('کاربران پس از ثبت‌نام در پلتفرم اینجا نمایش داده می‌شوند.', 'Users appear here after they sign up on the platform.');
    host.innerHTML = `<div class="empty">${icon('users')}<strong>${title}</strong><span>${sub}</span>${filtered ? `<button type="button" class="btn btn-sm" id="u-clear">${tr('پاک‌کردن فیلترها', 'Clear filters')}</button>` : onlyTests ? `<button type="button" class="btn btn-sm btn-primary" id="u-show-all">${tr(`نمایش همه حساب‌ها (${fmtNum(d.testCount)} آزمایشی)`, `Show all accounts (${fmtNum(d.testCount)} test)`)}</button>` : ''}</div>`;
    host.querySelector('#u-clear')?.addEventListener('click', () => { Object.assign(U, { q: '', plan: 'all', role: 'all', status: 'all', page: 1 }); renderUsers(view); });
    host.querySelector('#u-show-all')?.addEventListener('click', () => { Object.assign(U, { type: 'all', page: 1 }); renderUsers(view); });
    const ex = view.querySelector('#u-export'); if (ex) { ex.disabled = true; ex.title = tr('فهرستی برای خروجی وجود ندارد', 'Nothing to export'); }
    renderBulk(view);
    return;
  }
  const sortTh = (key, label, cls = '') => `<th scope="col"${cls ? ` class="${cls}"` : ''}><button type="button" class="th-sort" data-sort="${key}" aria-sort="${U.sort === key ? (U.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${label}</button></th>`;
  const allSel = d.users.every(u => U.selected.has(u.id));
  host.innerHTML = `
    <div class="table-wrap responsive">
      <table class="tbl">
        <thead><tr>
          <th scope="col" style="width:52px"><label class="check-hit"><input type="checkbox" class="check" id="u-all" ${allSel ? 'checked' : ''} aria-label="${tr('انتخاب همه کاربران این صفحه', 'Select all users on this page')}" /></label></th>
          ${sortTh('username', tr('کاربر', 'User'))}
          ${sortTh('plan', tr('پلن', 'Plan'))}
          <th scope="col">${tr('وضعیت', 'Status')}</th>
          ${sortTh('createdAt', tr('تاریخ عضویت', 'Joined'))}
          ${sortTh('lastSeen', tr('آخرین فعالیت', 'Last active'))}
          ${sortTh('sessions', tr('نشست‌ها', 'Sessions'), 'num')}
        </tr></thead>
        <tbody>
          ${d.users.map(u => `
            <tr class="${U.selected.has(u.id) ? 'selected' : ''}">
              <td><label class="check-hit"><input type="checkbox" class="check" data-sel="${esc(u.id)}" ${U.selected.has(u.id) ? 'checked' : ''} aria-label="${tr('انتخاب', 'Select')} ${esc(u.username)}" /></label></td>
              <td><button type="button" class="user-cell" data-user="${esc(u.id)}" style="background:none;border:none;padding:0;color:inherit;text-align:start;cursor:pointer;max-width:320px">${avatar(u)}<span class="user-meta"><strong dir="auto">${esc(u.displayName || u.username)}</strong><span>${esc(u.email)}</span></span></button></td>
              <td>${planBadge(u.plan)}</td>
              <td>${statusBadges(u)}</td>
              <td class="muted" style="white-space:nowrap" title="${esc(fmtDate(u.createdAt))}">${esc(fmtDate(u.createdAt, false))}</td>
              <td class="muted" style="white-space:nowrap" title="${esc(fmtDate(u.lastSeen))}">${esc(fmtAgo(u.lastSeen))}</td>
              <td class="num">${fmtNum(u.sessions)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="mlist">
      <div class="mlist-head"><label class="check-hit"><input type="checkbox" class="check" id="u-all-m" ${allSel ? 'checked' : ''} /></label><label for="u-all-m" class="mlist-head-label">${tr('انتخاب همه کاربران این صفحه', 'Select all users on this page')}</label></div>
      ${d.users.map(u => `
        <div class="mitem ${U.selected.has(u.id) ? 'selected' : ''}">
          <label class="check-hit" style="margin-top:-5px"><input type="checkbox" class="check" data-sel="${esc(u.id)}" ${U.selected.has(u.id) ? 'checked' : ''} aria-label="${tr('انتخاب', 'Select')} ${esc(u.username)}" /></label>
          <button type="button" data-user="${esc(u.id)}" class="mitem-body" style="background:none;border:none;padding:0;color:inherit;text-align:start;cursor:pointer">
            <div class="mitem-row"><span class="user-cell">${avatar(u)}<span class="user-meta"><strong dir="auto">${esc(u.displayName || u.username)}</strong><span>${esc(u.email)}</span></span></span></div>
            <div class="mitem-row">${planBadge(u.plan)}<span class="dim" style="font-size:12px;white-space:nowrap">${tr('آخرین فعالیت:', 'Last active:')} ${esc(fmtAgo(u.lastSeen))}</span></div>
            ${statusBadges(u)}
          </button>
        </div>`).join('')}
    </div>
    <div class="pager">
      <span>${tr(`نمایش ${fmtNum((d.page - 1) * d.pageSize + 1)} تا ${fmtNum(Math.min(d.total, d.page * d.pageSize))} از ${fmtNum(d.total)} کاربر`, `Showing ${fmtNum((d.page - 1) * d.pageSize + 1)}–${fmtNum(Math.min(d.total, d.page * d.pageSize))} of ${fmtNum(d.total)} ${plural(d.total, 'user')}`)}</span>
      <div class="toolbar">
        <button type="button" class="btn btn-sm" data-page="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>${tr('قبلی', 'Previous')}</button>
        <span>${tr(`صفحه ${fmtNum(d.page)} از ${fmtNum(d.pages)}`, `Page ${fmtNum(d.page)} of ${fmtNum(d.pages)}`)}</span>
        <button type="button" class="btn btn-sm" data-page="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>${tr('بعدی', 'Next')}</button>
      </div>
    </div>`;
  host.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.sort;
    if (U.sort === k) U.dir = U.dir === 'asc' ? 'desc' : 'asc'; else { U.sort = k; U.dir = k === 'username' || k === 'plan' ? 'asc' : 'desc'; }
    U.page = 1; loadUsers(view);
  }));
  host.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { U.page = Number(b.dataset.page); loadUsers(view); view.querySelector('#u-list')?.scrollIntoView({ block: 'start' }); }));
  host.querySelectorAll('[data-user]').forEach(b => b.addEventListener('click', () => openUser(b.dataset.user, () => loadUsers(view))));
  // Header + mobile select-all mirror the page selection (indeterminate when partial).
  const syncAll = () => {
    const n = d.users.filter(u => U.selected.has(u.id)).length;
    host.querySelectorAll('#u-all, #u-all-m').forEach(a => { a.checked = n > 0 && n === d.users.length; a.indeterminate = n > 0 && n < d.users.length; });
  };
  syncAll();
  host.querySelectorAll('[data-sel]').forEach(c => c.addEventListener('change', () => {
    if (c.checked) U.selected.add(c.dataset.sel); else U.selected.delete(c.dataset.sel);
    host.querySelectorAll(`[data-sel="${CSS.escape(c.dataset.sel)}"]`).forEach(x => { x.checked = c.checked; x.closest('tr, .mitem')?.classList.toggle('selected', c.checked); });
    syncAll();
    renderBulk(view);
  }));
  host.querySelectorAll('#u-all, #u-all-m').forEach(a => a.addEventListener('change', (e) => {
    d.users.forEach(u => (e.target.checked ? U.selected.add(u.id) : U.selected.delete(u.id)));
    loadUsers(view);
  }));
  renderBulk(view);
}

function renderBulk(view) {
  const U = app.users;
  const host = view.querySelector('#u-bulk');
  if (!host) return;
  if (!U.selected.size) { host.innerHTML = ''; return; }
  const planOpts = (app.plansMeta?.planOrder || []).map(id => `<option value="${esc(id)}">${esc(planName(id))}</option>`).join('');
  host.innerHTML = `
    <div class="card-body" style="padding-top:0">
      <div class="bulkbar" role="region" aria-label="${tr('عملیات گروهی', 'Bulk actions')}">
        <strong>${tr(`${fmtNum(U.selected.size)} کاربر انتخاب شده`, `${fmtNum(U.selected.size)} selected`)}</strong>
        <select class="select" id="b-plan" style="width:auto;min-height:32px;font-size:12px" aria-label="${tr('تغییر پلن به', 'Change plan to')}"><option value="">${tr('تغییر پلن به…', 'Change plan to…')}</option>${planOpts}</select>
        <button type="button" class="btn btn-sm" data-bulk="verify">${tr('تأیید ایمیل', 'Verify email')}</button>
        <button type="button" class="btn btn-sm" data-bulk="unsuspend">${tr('رفع تعلیق', 'Unsuspend')}</button>
        <button type="button" class="btn btn-sm btn-danger" data-bulk="suspend">${tr('تعلیق', 'Suspend')}</button>
        <button type="button" class="btn btn-sm btn-danger" data-bulk="delete">${icon('trash')}<span>${tr('حذف', 'Delete')}</span></button>
        <button type="button" class="btn btn-sm btn-ghost" data-bulk="clear">${tr('لغو انتخاب', 'Clear selection')}</button>
      </div>
    </div>`;
  host.querySelector('#b-plan').addEventListener('change', (e) => { if (e.target.value) bulk(view, 'plan', e.target.value); });
  host.querySelectorAll('[data-bulk]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.bulk === 'clear') { U.selected.clear(); loadUsers(view); return; }
    bulk(view, b.dataset.bulk);
  }));
}

async function bulk(view, action, plan) {
  const U = app.users;
  const n = U.selected.size;
  const labels = {
    plan: [tr('تغییر گروهی پلن', 'Change plan'), tr(`پلن ${fmtNum(n)} کاربر انتخاب‌شده به «${planName(plan)}» تغییر می‌کند.`, `${fmtNum(n)} selected ${plural(n, 'user')} will be moved to “${planName(plan)}”.`), tr('تغییر پلن', 'Change plan')],
    verify: [tr('تأیید گروهی ایمیل', 'Verify e-mails'), tr(`ایمیل ${fmtNum(n)} کاربر انتخاب‌شده به‌عنوان تأییدشده ثبت می‌شود.`, `${fmtNum(n)} selected ${plural(n, 'user')} will be marked as verified.`), tr('تأیید ایمیل‌ها', 'Verify')],
    unsuspend: [tr('رفع تعلیق گروهی', 'Unsuspend users'), tr(`دسترسی ${fmtNum(n)} کاربر انتخاب‌شده دوباره برقرار می‌شود.`, `Access will be restored for ${fmtNum(n)} selected ${plural(n, 'user')}.`), tr('رفع تعلیق', 'Unsuspend')],
    suspend: [tr('تعلیق گروهی حساب‌ها', 'Suspend users'), tr(`${fmtNum(n)} کاربر انتخاب‌شده از همه دستگاه‌ها خارج می‌شوند و تا رفع تعلیق امکان ورود ندارند.`, `${fmtNum(n)} selected ${plural(n, 'user')} will be signed out everywhere and blocked until unsuspended.`), tr('تعلیق حساب‌ها', 'Suspend')],
    delete: [tr('حذف دائمی حساب‌ها', 'Delete accounts permanently'), tr(`${fmtNum(n)} حساب کاربری به‌همراه همه داده‌های ابری‌شان برای همیشه حذف می‌شوند. این کار برگشت‌پذیر نیست.`, `${fmtNum(n)} ${plural(n, 'account')} and all ${plural(n, 'its', 'their')} cloud data will be permanently deleted. This cannot be undone.`), tr('حذف دائمی', 'Delete permanently')]
  }[action];
  const danger = action === 'suspend' || action === 'delete';
  const word = tr('حذف', 'DELETE');
  const body = `<p style="margin:0">${labels[1]}</p>${action === 'delete' ? `<div class="field"><label for="bulk-confirm">${tr(`برای تأیید، عبارت «${word}» را تایپ کنید`, `Type “${word}” to confirm`)}</label><input id="bulk-confirm" class="input" autocomplete="off" /></div>` : ''}`;
  const res = await openDialog({
    title: labels[0], body, confirmText: labels[2], danger, confirmDisabled: action === 'delete',
    onOpen: (dlg, ok) => dlg.querySelector('#bulk-confirm')?.addEventListener('input', (e) => { ok.disabled = e.target.value.trim() !== word; }),
    onConfirm: async () => api('/api/admin/users/bulk', { method: 'POST', body: { ids: [...U.selected], action, plan } })
  });
  const sel = view.querySelector('#b-plan');
  if (sel) sel.value = '';
  if (!res) return;
  U.selected.clear();
  // Name what happened, in the words of the confirm dialog and the single-user toasts.
  const k = res.done || 0, nk = fmtNum(k);
  const doneMsg = {
    plan: tr(`پلن ${nk} کاربر تغییر کرد`, `Plan changed for ${nk} ${plural(k, 'user')}`),
    verify: tr(`ایمیل ${nk} کاربر تأیید شد`, `${nk} ${plural(k, 'email')} marked verified`),
    unsuspend: tr(`تعلیق ${nk} حساب برداشته شد`, `${nk} ${plural(k, 'account')} unsuspended`),
    suspend: tr(`${nk} حساب تعلیق شد`, `${nk} ${plural(k, 'account')} suspended`),
    delete: tr(`${nk} حساب حذف شد`, `${nk} ${plural(k, 'account')} deleted`)
  }[action];
  const skipped = res.skipped ? tr(`${fmtNum(res.skipped)} مورد نیازی به تغییر نداشت یا مجاز نبود`, `${fmtNum(res.skipped)} unchanged or not allowed`) : '';
  if (!k) toast(skipped ? tr(`تغییری اعمال نشد؛ ${skipped}.`, `No changes: ${skipped}.`) : tr('تغییری اعمال نشد.', 'No changes were made.'), 'info');
  else toast(skipped ? `${doneMsg}${tr('؛ ', '; ')}${skipped}.` : `${doneMsg}.`);
  loadUsers(view);
}

async function exportUsers() {
  try {
    const res = await api(`/api/admin/users.csv?${usersQuery({ page: 1 })}`, { raw: true });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tradingchart-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(tr('فایل CSV کاربران آماده و دریافت شد.', 'Users CSV downloaded.'));
  } catch (e) { toast(errMsg(e), 'error'); }
}

// ── User detail drawer ────────────────────────────────────────────────────
async function openUser(id, onChange) {
  document.querySelector('.scrim')?.remove();
  document.querySelector('.drawer')?.remove();
  const prevFocus = document.activeElement;
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const dr = document.createElement('aside');
  dr.className = 'drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-modal', 'true'); dr.setAttribute('aria-labelledby', 'dr-title');
  dr.innerHTML = `<div class="drawer-head"><h2 id="dr-title" style="margin:0;font-size:15px;flex:1">${tr('جزئیات کاربر', 'User details')}</h2><button type="button" class="btn btn-icon btn-ghost" data-close aria-label="${tr('بستن', 'Close')}">${icon('close')}</button></div><div class="drawer-body">${loadingBlock(80)}${loadingBlock(200)}</div>`;
  document.body.append(scrim, dr);
  document.body.style.overflow = 'hidden';
  let changed = false;
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    scrim.remove(); dr.remove(); document.body.style.overflow = '';
    try { prevFocus?.focus?.(); } catch (e) { /* gone */ }
    if (changed) onChange?.();
  };
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.dialog-wrap')) { e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  scrim.addEventListener('click', close);
  dr.querySelector('[data-close]').addEventListener('click', close);
  dr.querySelector('[data-close]').focus();
  let tab = 'overview';

  const load = async () => {
    let d;
    try { d = await api(`/api/admin/users/${encodeURIComponent(id)}`); }
    catch (e) {
      dr.querySelector('.drawer-body').innerHTML = errorBlock(e, 'dr-retry');
      dr.querySelector('#dr-retry')?.addEventListener('click', load);
      return;
    }
    if (!dr.isConnected) return;
    paint(d);
  };

  const patch = async (body, okMsg) => {
    const r = await api(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body });
    changed = true;
    if (okMsg) toast(okMsg);
    return r;
  };

  function paint(d) {
    const u = d.user;
    const plans = app.plansMeta?.planOrder || [];
    const self = app.session?.userId && app.session.userId === u.id;
    dr.querySelector('#dr-title').textContent = tr('جزئیات کاربر', 'User details');
    dr.setAttribute('aria-label', tr(`جزئیات کاربر ${u.displayName || u.username}`, `User details: ${u.displayName || u.username}`));
    const body = dr.querySelector('.drawer-body');
    body.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        ${avatar(u).replace('class="avatar"', 'class="avatar" style="width:52px;height:52px;font-size:20px;background:' + planColor(u.plan) + '"')}
        <div style="min-width:0;flex:1"><div class="id-name" dir="auto">${esc(u.displayName || u.username)}</div>
        <div class="id-lines"><span class="ltr">@${esc(u.username)}</span><span class="ltr">${esc(u.email)}</span></div>
        <div style="margin-top:6px">${statusBadges(u)}</div></div>
      </div>
      ${u.suspended ? `<div class="alert alert-danger">${icon('ban')}<div>${tr('این حساب تعلیق شده است', 'This account is suspended')}${u.suspendedAt ? ` · ${esc(fmtDate(u.suspendedAt))}` : ''}${u.suspendReason ? `<br>${tr('دلیل:', 'Reason:')} ${esc(u.suspendReason)}` : ''}</div></div>` : ''}
      ${self ? `<div class="alert alert-info">${icon('info')}<div>${tr('این حساب خودتان است؛ تعلیق، حذف و لغو نقش مدیریتی آن مجاز نیست.', 'This is your own account; suspending, deleting, or demoting it is not allowed.')}</div></div>` : ''}
      <div class="tabs" role="tablist">
        ${[['overview', tr('نمای کلی', 'Overview')], ['sessions', tr(`نشست‌ها (${fmtNum(d.sessions.length)})`, `Sessions (${fmtNum(d.sessions.length)})`)], ['activity', tr('سوابق مدیریتی', 'Admin history')]].map(([k, l]) => `<button type="button" class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}
      </div>
      <div id="dr-tab"></div>`;
    body.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; paint(d); }));
    const t = body.querySelector('#dr-tab');
    if (tab === 'overview') {
      t.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="form-grid-2">
            <div class="field"><label for="dr-plan">${tr('پلن اشتراک', 'Subscription plan')}</label>
              <select class="select" id="dr-plan">${plans.map(pid => `<option value="${esc(pid)}" ${pid === u.plan ? 'selected' : ''}>${esc(planName(pid))}${app.plansMeta?.plans?.[pid]?.isActive === false ? tr(' (غیرفعال)', ' (inactive)') : ''}</option>`).join('')}${u.planKnown ? '' : `<option selected value="${esc(u.plan)}">${esc(u.plan)} ${tr('(حذف‌شده)', '(deleted)')}</option>`}</select>
              <span class="hint">${tr('تاریخ شروع پلن فعلی:', 'Current plan since')} ${esc(fmtDate(u.planSince, false))}</span></div>
            <div class="field"><label for="dr-role">${tr('نقش', 'Role')}</label>
              <select class="select" id="dr-role" ${self ? 'disabled' : ''}><option value="user" ${!u.isAdmin ? 'selected' : ''}>${tr('کاربر عادی', 'User')}</option><option value="admin" ${u.isAdmin ? 'selected' : ''}>${tr('مدیر پلتفرم', 'Administrator')}</option></select>
              <span class="hint">${tr('با انتخاب «مدیر»، این کاربر می‌تواند با حساب خود و بدون کلید مدیریت وارد این پنل شود.', 'Choosing “Admin” lets this user sign in to this console with their own account — no admin key needed.')}</span></div>
          </div>
          <div class="field"><label for="dr-name">${tr('نام نمایشی', 'Display name')}</label>
            <div style="display:flex;gap:8px"><input class="input input-mixed" id="dr-name" dir="auto" value="${esc(u.displayName || '')}" maxlength="64" /><button type="button" class="btn btn-primary" id="dr-name-save" disabled>${tr('ذخیره', 'Save')}</button></div></div>
          <div class="field"><label for="dr-notes">${tr('یادداشت داخلی (فقط برای مدیران)', 'Internal note (admins only)')}</label>
            <textarea class="textarea" id="dr-notes" dir="auto" maxlength="1000" placeholder="${tr('مثلاً: پیگیری درخواست بازپرداخت', 'e.g. follow-up on refund request')}">${esc(u.notes || '')}</textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="hint" id="dr-notes-count" data-count>${tr(`${fmtNum((u.notes || '').length)} از ${fmtNum(1000)} نویسه`, `${fmtNum((u.notes || '').length)} of ${fmtNum(1000)} characters`)}</span><button type="button" class="btn btn-sm btn-primary" id="dr-notes-save" disabled>${tr('ذخیره یادداشت', 'Save note')}</button></div></div>
          <div><p class="section-title">${tr('مصرف و داده‌ها', 'Usage & data')}</p>
            <div class="stat-mini">
              <div><b>${fmtNum(d.usage.layouts)}</b><span>${tr('چیدمان', 'Layouts')}</span></div>
              <div><b>${fmtNum(d.usage.watchlists)}</b><span>${tr('دیده‌بان', 'Watchlists')}</span></div>
              <div><b>${fmtNum(d.usage.alerts)}</b><span>${tr('هشدار', 'Alerts')}</span></div>
              <div><b>${fmtNum(d.usage.templates)}</b><span>${tr('قالب اندیکاتور', 'Indicator templates')}</span></div>
              <div><b>${fmtNum(d.usage.paperAccounts)}</b><span>${tr('حساب معاملات مجازی', 'Paper accounts')}</span></div>
              <div><b>${esc(fmtBytes(d.usage.stateBytes))}</b><span>${tr('فضای ابری', 'Cloud storage')}</span></div>
            </div></div>
          <dl class="kv">
            <dt>${tr('شناسه کاربر', 'User ID')}</dt><dd><span class="mono ltr">${esc(u.id)}</span></dd>
            <dt>${tr('تاریخ عضویت', 'Joined')}</dt><dd>${esc(fmtDate(u.createdAt))}</dd>
            <dt>${tr('آخرین فعالیت', 'Last active')}</dt><dd>${esc(u.lastSeen ? fmtDate(u.lastSeen) : tr('هرگز', 'Never'))}</dd>
            <dt>${tr('آخرین همگام‌سازی', 'Last cloud sync')}</dt><dd>${esc(d.usage.stateUpdatedAt ? fmtDate(d.usage.stateUpdatedAt) : tr('هرگز', 'Never'))}</dd>
            <dt>${tr('تغییر نام کاربری باقی‌مانده', 'Username changes left')}</dt><dd>${fmtNum(u.usernameChangesLeft)}</dd>
            <dt>${tr('منطقه زمانی / ارز', 'Time zone / currency')}</dt><dd class="ltr" style="text-align:${isFa() ? 'right' : 'left'}">${esc(u.timezone)} · ${esc(u.currency)}</dd>
          </dl>
          <div><p class="section-title">${tr('دسترسی و امنیت', 'Access & security')}</p>
            <div class="row-actions">
              <button type="button" class="btn btn-sm" id="dr-verify">${u.emailVerified ? tr('لغو تأیید ایمیل', 'Mark email unverified') : tr('تأیید دستی ایمیل', 'Mark email verified')}</button>
              <button type="button" class="btn btn-sm" id="dr-reset">${icon('mail')}<span>${tr('ارسال کد بازیابی گذرواژه', 'Send password reset')}</span></button>
              <button type="button" class="btn btn-sm" id="dr-2fa" ${u.totpEnabled ? '' : 'disabled'} title="${u.totpEnabled ? '' : tr('تأیید دومرحله‌ای فعال نیست', '2FA is not enabled')}">${icon('key')}<span>${tr('غیرفعال‌سازی تأیید دومرحله‌ای', 'Reset 2FA')}</span></button>
              <button type="button" class="btn btn-sm" id="dr-test">${icon('flask')}<span>${u.isTest ? tr('علامت‌گذاری به‌عنوان کاربر واقعی', 'Mark as real user') : tr('علامت‌گذاری به‌عنوان حساب آزمایشی', 'Mark as test account')}</span></button>
            </div></div>
        </div>`;
      const nameIn = t.querySelector('#dr-name'), nameBtn = t.querySelector('#dr-name-save');
      nameIn.addEventListener('input', () => { nameBtn.disabled = !nameIn.value.trim() || nameIn.value.trim() === (u.displayName || ''); });
      nameBtn.addEventListener('click', async () => {
        nameBtn.disabled = true;
        try { const r = await patch({ displayName: nameIn.value.trim() }, tr('نام نمایشی ذخیره شد.', 'Display name saved.')); d.user = r.user; paint(d); }
        catch (e) { toast(errMsg(e), 'error'); nameBtn.disabled = false; }
      });
      const notes = t.querySelector('#dr-notes'), notesBtn = t.querySelector('#dr-notes-save'), cnt = t.querySelector('#dr-notes-count');
      notes.addEventListener('input', () => { notesBtn.disabled = notes.value === (u.notes || ''); cnt.textContent = tr(`${fmtNum(notes.value.length)} از ${fmtNum(1000)} نویسه`, `${fmtNum(notes.value.length)} of ${fmtNum(1000)} characters`); });
      notesBtn.addEventListener('click', async () => {
        notesBtn.disabled = true;
        try { const r = await patch({ notes: notes.value }, tr('یادداشت ذخیره شد.', 'Note saved.')); d.user = r.user; u.notes = r.user.notes; }
        catch (e) { toast(errMsg(e), 'error'); notesBtn.disabled = false; }
      });
      t.querySelector('#dr-plan').addEventListener('change', async (e) => {
        const pid = e.target.value;
        const ok = await confirmDialog({
          title: tr('تغییر پلن کاربر', 'Change plan'),
          body: `<p style="margin:0">${tr(`پلن «${esc(u.displayName || u.username)}» از «${esc(planName(u.plan))}» به «${esc(planName(pid))}» تغییر می‌کند و بلافاصله اعمال می‌شود.`, `“${esc(u.displayName || u.username)}” will move from “${esc(planName(u.plan))}” to “${esc(planName(pid))}”, effective immediately.`)}</p>`,
          confirmText: tr('تغییر پلن', 'Change plan'),
          onConfirm: async () => { const r = await patch({ plan: pid }, tr('پلن کاربر تغییر کرد.', 'Plan changed.')); d.user = r.user; return true; }
        });
        if (!ok) e.target.value = u.plan;
        paint(d);
      });
      t.querySelector('#dr-role').addEventListener('change', async (e) => {
        const role = e.target.value;
        const ok = await confirmDialog({
          title: role === 'admin' ? tr('اعطای دسترسی مدیریت', 'Grant admin access') : tr('لغو دسترسی مدیریت', 'Revoke admin access'),
          body: `<p style="margin:0">${role === 'admin'
            ? tr('این کاربر به همه بخش‌های پنل مدیریت (کاربران، پلن‌ها، تنظیمات) دسترسی کامل خواهد داشت.', 'This user will get full access to the admin console (users, plans, settings).')
            : tr('دسترسی این کاربر به پنل مدیریت فوراً قطع می‌شود.', 'This user will immediately lose access to the admin console.')}</p>`,
          danger: role === 'admin', confirmText: role === 'admin' ? tr('اعطای دسترسی', 'Grant access') : tr('لغو دسترسی', 'Revoke access'),
          onConfirm: async () => { const r = await patch({ role }, tr('نقش کاربر به‌روزرسانی شد.', 'Role updated.')); d.user = r.user; return true; }
        });
        if (!ok) e.target.value = u.isAdmin ? 'admin' : 'user';
        paint(d);
      });
      t.querySelector('#dr-verify').addEventListener('click', async () => {
        try { const r = await patch({ emailVerified: !u.emailVerified }, u.emailVerified ? tr('وضعیت ایمیل به «تأییدنشده» تغییر کرد.', 'Email marked unverified.') : tr('ایمیل کاربر تأیید شد.', 'Email marked verified.')); d.user = r.user; paint(d); }
        catch (e) { toast(errMsg(e), 'error'); }
      });
      t.querySelector('#dr-reset').addEventListener('click', () => confirmDialog({
        title: tr('ارسال کد بازیابی گذرواژه', 'Send password reset'),
        body: `<p style="margin:0">${tr(`یک کد بازیابی ۶ رقمی با اعتبار ۱۵ دقیقه به نشانی <span class="ltr">${esc(u.email)}</span> ارسال می‌شود.`, `A 6-digit reset code valid for 15 minutes will be sent to <span class="ltr">${esc(u.email)}</span>.`)}</p>`,
        confirmText: tr('ارسال کد', 'Send code'), iconName: 'mail',
        onConfirm: async () => { await api(`/api/admin/users/${encodeURIComponent(id)}/send-reset`, { method: 'POST' }); changed = true; toast(tr('کد بازیابی ارسال شد.', 'Reset code sent.')); return true; }
      }));
      t.querySelector('#dr-2fa').addEventListener('click', () => confirmDialog({
        title: tr('غیرفعال‌سازی تأیید دومرحله‌ای', 'Reset two-factor authentication'),
        body: `<p style="margin:0">${tr('این کار را فقط پس از احراز هویت کاربر از راه دیگری انجام دهید (مثلاً گم‌شدن گوشی). کاربر پس از آن فقط با گذرواژه وارد می‌شود.', 'Only do this after verifying the user’s identity another way (e.g. lost phone). The user will then sign in with a password only.')}</p>`,
        danger: true, confirmText: tr('غیرفعال‌سازی', 'Reset 2FA'),
        onConfirm: async () => { await api(`/api/admin/users/${encodeURIComponent(id)}/reset-2fa`, { method: 'POST' }); changed = true; toast(tr('تأیید دومرحله‌ای کاربر غیرفعال شد.', '2FA has been reset.')); await load(); return true; }
      }));
      t.querySelector('#dr-test').addEventListener('click', async () => {
        try { const r = await patch({ testAccount: !u.isTest }, !u.isTest ? tr('حساب به‌عنوان آزمایشی علامت خورد و از آمار کنار گذاشته شد.', 'Marked as a test account (excluded from KPIs).') : tr('حساب به‌عنوان کاربر واقعی علامت خورد.', 'Marked as a real user.')); d.user = r.user; paint(d); }
        catch (e) { toast(errMsg(e), 'error'); }
      });
    } else if (tab === 'sessions') {
      t.innerHTML = d.sessions.length ? `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${d.sessions.map(s => `
            <div class="card" style="padding:12px 14px;display:flex;gap:10px;align-items:flex-start">
              <div style="flex:1;min-width:0">
                <strong style="font-size:13px">${s.device === 'Mobile Browser' ? tr('مرورگر موبایل', 'Mobile browser') : tr('مرورگر دسکتاپ', 'Desktop browser')}</strong>
                <div class="dim ltr" style="font-size:11.5px;text-align:${isFa() ? 'right' : 'left'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(s.ua)}">${esc(s.ua || '—')}</div>
                <div class="dim" style="font-size:12px">${tr('آی‌پی:', 'IP:')} <span class="ltr">${esc(s.ip || '—')}</span> · ${tr('آخرین فعالیت', 'Last active')} ${esc(fmtAgo(s.lastSeen))}</div>
              </div>
              <button type="button" class="btn btn-sm btn-danger" data-revoke="${esc(s.id)}">${tr('خروج', 'Sign out')}</button>
            </div>`).join('')}
          <button type="button" class="btn btn-danger" id="dr-revoke-all">${icon('logout', 'mirror-rtl')}<span>${tr('خروج از همه دستگاه‌ها', 'Sign out of all devices')}</span></button>
        </div>` : `<div class="empty">${icon('system')}<strong>${tr('نشست فعالی وجود ندارد', 'No active sessions')}</strong><span>${tr('این کاربر در حال حاضر روی هیچ دستگاهی وارد نشده است.', 'This user is not signed in on any device.')}</span></div>`;
      t.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        try { await api(`/api/admin/users/${encodeURIComponent(id)}/sessions/${encodeURIComponent(b.dataset.revoke)}`, { method: 'DELETE' }); changed = true; toast(tr('نشست پایان یافت.', 'Session ended.')); await load(); }
        catch (e) { toast(errMsg(e), 'error'); b.disabled = false; }
      }));
      t.querySelector('#dr-revoke-all')?.addEventListener('click', () => confirmDialog({
        title: tr('خروج از همه دستگاه‌ها', 'Sign out everywhere'),
        body: `<p style="margin:0">${tr(`همه ${fmtNum(d.sessions.length)} نشست فعال این کاربر پایان می‌یابد و باید دوباره وارد شود.`, `${d.sessions.length === 1 ? 'The active session will end' : `All ${fmtNum(d.sessions.length)} active sessions will end`}; the user must sign in again.`)}</p>`,
        danger: true, confirmText: tr('خروج از همه', 'Sign out all'),
        onConfirm: async () => { await api(`/api/admin/users/${encodeURIComponent(id)}/revoke-sessions`, { method: 'POST' }); changed = true; toast(tr('کاربر از همه دستگاه‌ها خارج شد.', 'User signed out everywhere.')); await load(); return true; }
      }));
    } else {
      t.innerHTML = d.events.length ? `<div class="timeline">${d.events.map(eventItem).join('')}</div>` : `<div class="empty">${icon('audit')}<strong>${tr('سابقه‌ای ثبت نشده است', 'No history yet')}</strong><span>${tr('اقدامات مدیران روی این حساب اینجا نمایش داده می‌شود.', 'Admin actions on this account will appear here.')}</span></div>`;
    }
    // footer actions
    dr.querySelector('.drawer-foot')?.remove();
    const foot = document.createElement('div');
    foot.className = 'drawer-foot';
    foot.innerHTML = `
      <button type="button" class="btn ${u.suspended ? '' : 'btn-warn'}" id="dr-suspend" ${self ? 'disabled' : ''}>${icon('ban')}<span>${u.suspended ? tr('رفع تعلیق حساب', 'Unsuspend account') : tr('تعلیق حساب', 'Suspend account')}</span></button>
      <button type="button" class="btn btn-danger" id="dr-delete" ${self ? 'disabled' : ''}>${icon('trash')}<span>${tr('حذف حساب', 'Delete account')}</span></button>`;
    dr.appendChild(foot);
    foot.querySelector('#dr-suspend').addEventListener('click', async () => {
      if (u.suspended) {
        try { const r = await patch({ suspended: false }, tr('تعلیق حساب برداشته شد.', 'Account unsuspended.')); d.user = r.user; paint(d); } catch (e) { toast(errMsg(e), 'error'); }
        return;
      }
      await confirmDialog({
        title: tr('تعلیق حساب کاربری', 'Suspend account'),
        body: `<p style="margin:0">${tr('کاربر بلافاصله از همه دستگاه‌ها خارج می‌شود و تا رفع تعلیق نمی‌تواند وارد شود. داده‌های حساب حفظ می‌شود.', 'The user is signed out everywhere and cannot sign in until unsuspended. Account data is kept.')}</p>
          <div class="field"><label for="sus-reason">${tr('دلیل تعلیق (اختیاری، فقط برای مدیران)', 'Reason (optional, admins only)')}</label><input id="sus-reason" class="input" dir="auto" maxlength="200" /></div>`,
        danger: true, confirmText: tr('تعلیق حساب', 'Suspend'),
        onConfirm: async (dlg) => { const r = await patch({ suspended: true, suspendReason: dlg.querySelector('#sus-reason').value }, tr('حساب کاربر تعلیق شد.', 'Account suspended.')); d.user = r.user; d.sessions = []; paint(d); return true; }
      });
    });
    foot.querySelector('#dr-delete').addEventListener('click', () => openDialog({
      title: tr('حذف دائمی حساب', 'Delete account permanently'),
      body: `<p style="margin:0">${tr('حساب، نشست‌ها و همه داده‌های ابری این کاربر برای همیشه حذف می‌شود. این کار برگشت‌پذیر نیست.', 'The account, its sessions, and all cloud data will be permanently deleted. This cannot be undone.')}</p>
        <div class="field"><label for="del-confirm">${tr('برای تأیید، نام کاربری را تایپ کنید:', 'Type the username to confirm:')} <span class="ltr mono">${esc(u.username)}</span></label><input id="del-confirm" class="input ltr" autocomplete="off" spellcheck="false" /></div>`,
      danger: true, confirmText: tr('حذف دائمی', 'Delete permanently'), confirmDisabled: true,
      onOpen: (dlg, ok) => dlg.querySelector('#del-confirm').addEventListener('input', (e) => { ok.disabled = e.target.value.trim() !== u.username; }),
      onConfirm: async (dlg) => {
        await api(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', body: { confirm: dlg.querySelector('#del-confirm').value.trim() } });
        changed = true; toast(tr('حساب کاربر حذف شد.', 'Account deleted.'));
        app.users.selected.delete(id);
        close();
        return true;
      }
    }));
  }
  load();
}

// ── Audit log ─────────────────────────────────────────────────────────────
async function renderAudit(view) {
  const A = app.audit;
  if (!app.plansMeta) await refreshPlansMeta().catch(() => {});
  view.innerHTML = `
    <div class="page-head"><div><p>${tr('همه اقدامات مدیریتی و تلاش‌های ورود به پنل، با زمان، عامل و جزئیات', 'Every admin action and console sign-in attempt, with time, actor, and details')}</p></div></div>
    <section class="card">
      <div class="card-body">
        <div class="toolbar">
          <label class="search"><span class="sr-only">${tr('جستجو', 'Search')}</span>${icon('search')}<input class="input" id="a-q" type="search" dir="auto" value="${esc(A.q)}" placeholder="${tr('جستجو در رویدادها: عامل، کاربر هدف یا نشانی IP', 'Search events: actor, target user, or IP')}" autocomplete="off" /></label>
          <select class="select" id="a-action" style="width:auto;flex:1 1 160px" aria-label="${tr('نوع رویداد', 'Event type')}"><option value="all">${tr('همه رویدادها', 'All events')}</option></select>
          <select class="select" id="a-status" style="width:auto;flex:1 1 140px" aria-label="${tr('نتیجه', 'Result')}">
            ${[['all', tr('همه نتایج', 'All results')], ['ok', tr('موفق', 'Succeeded')], ['failed', tr('ناموفق', 'Failed')]].map(([v, l]) => `<option value="${v}" ${A.status === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="a-list">${loadingBlock(240)}</div>
    </section>`;
  let tmr = null;
  view.querySelector('#a-q').addEventListener('input', (e) => { clearTimeout(tmr); tmr = setTimeout(() => { A.q = e.target.value; A.page = 1; loadAudit(view); }, 280); });
  view.querySelector('#a-action').addEventListener('change', (e) => { A.action = e.target.value; A.page = 1; loadAudit(view); });
  view.querySelector('#a-status').addEventListener('change', (e) => { A.status = e.target.value; A.page = 1; loadAudit(view); });
  loadAudit(view);
}

async function loadAudit(view) {
  const A = app.audit;
  const host = view.querySelector('#a-list');
  if (!host) return;
  let d;
  try { d = await api(`/api/admin/audit?${new URLSearchParams({ q: A.q, action: A.action, status: A.status, page: A.page })}`); }
  catch (e) {
    host.innerHTML = errorBlock(e, 'a-retry');
    host.querySelector('#a-retry')?.addEventListener('click', () => loadAudit(view));
    return;
  }
  if (app.section !== 'audit' || !view.isConnected) return;
  const sel = view.querySelector('#a-action');
  if (sel && sel.options.length <= 1) {
    sel.innerHTML = `<option value="all">${tr('همه رویدادها', 'All events')}</option>` + d.actions.map(a => `<option value="${esc(a)}" ${A.action === a ? 'selected' : ''}>${esc(actionLabel(a))}</option>`).join('');
  }
  if (!d.events.length) {
    host.innerHTML = `<div class="empty">${icon('audit')}<strong>${tr('رویدادی یافت نشد', 'No events found')}</strong><span>${tr('فیلترها را تغییر دهید یا بعد از انجام یک اقدام مدیریتی دوباره سر بزنید.', 'Adjust the filters, or check back after an admin action.')}</span></div>`;
    return;
  }
  const resBadge = (ev) => ev.ok ? `<span class="badge b-green">${tr('موفق', 'OK')}</span>` : `<span class="badge b-red">${tr('ناموفق', 'Failed')}</span>`;
  host.innerHTML = `
    <div class="table-wrap responsive"><table class="tbl">
      <thead><tr><th scope="col">${tr('زمان', 'Time')}</th><th scope="col">${tr('رویداد', 'Event')}</th><th scope="col">${tr('عامل', 'Actor')}</th><th scope="col">${tr('جزئیات', 'Details')}</th><th scope="col">${tr('نشانی IP', 'IP address')}</th><th scope="col">${tr('نتیجه', 'Result')}</th></tr></thead>
      <tbody>${d.events.map(ev => `<tr>
        <td class="muted" style="white-space:nowrap" title="${esc(fmtDate(ev.at))}">${esc(fmtDate(ev.at))}</td>
        <td class="ev-name">${esc(actionLabel(ev.action, ev.ok !== false))}</td>
        <td><span class="actor">${esc(actorLabel(ev))}</span></td>
        <td class="muted" style="max-width:280px;overflow-wrap:anywhere">${esc(eventDetail(ev)) || '<span class="dim" aria-label="' + tr('بدون جزئیات', 'No details') + '">—</span>'}</td>
        <td class="muted"><span class="ltr mono">${esc(ev.ip || '—')}</span></td>
        <td>${resBadge(ev)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="mlist">${d.events.map(ev => `
      <div class="mitem"><div class="mitem-body">
        <div class="mitem-row"><strong style="font-size:13px">${esc(actionLabel(ev.action, ev.ok !== false))}</strong>${resBadge(ev)}</div>
        <div class="dim" style="font-size:12px;overflow-wrap:anywhere"><span class="actor">${esc(actorLabel(ev))}</span>${eventDetail(ev) ? ' · ' + esc(eventDetail(ev)) : ''}</div>
        <div class="dim" style="font-size:12px">${esc(fmtDate(ev.at))} · <span class="ltr mono">${esc(ev.ip || '—')}</span></div>
      </div></div>`).join('')}</div>
    <div class="pager">
      <span>${tr(`${fmtNum(d.total)} رویداد`, `${fmtNum(d.total)} ${plural(d.total, 'event')}`)}</span>
      <div class="toolbar">
        <button type="button" class="btn btn-sm" data-page="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>${tr('قبلی', 'Previous')}</button>
        <span>${tr(`صفحه ${fmtNum(d.page)} از ${fmtNum(d.pages)}`, `Page ${fmtNum(d.page)} of ${fmtNum(d.pages)}`)}</span>
        <button type="button" class="btn btn-sm" data-page="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>${tr('بعدی', 'Next')}</button>
      </div>
    </div>`;
  host.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { A.page = Number(b.dataset.page); loadAudit(view); }));
}

// ── Settings ──────────────────────────────────────────────────────────────
function settingsDirty() {
  return Boolean(app.settingsEdit && JSON.stringify(app.settingsEdit.draft) !== app.settingsEdit.orig);
}
async function confirmLeaveSettings() {
  if (!settingsDirty()) return true;
  const ok = await confirmDialog({
    title: tr('تغییرات ذخیره نشده است', 'Unsaved changes'),
    body: `<p style="margin:0">${tr('تغییرات تنظیمات پلتفرم هنوز ذخیره نشده است. در صورت ادامه، این تغییرات از بین می‌رود.', 'Your platform settings changes have not been saved. If you continue, they will be lost.')}</p>`,
    confirmText: tr('نادیده گرفتن تغییرات', 'Discard changes'), cancelText: tr('ماندن و ادامه ویرایش', 'Keep editing'), danger: true
  });
  if (ok) app.settingsEdit = null;
  return ok;
}

async function renderSettings(view) {
  view.innerHTML = `<div class="page-head"><div><p>${tr('کنترل ثبت‌نام، حالت نگهداری، اطلاعیه سراسری و تعریف حساب‌های آزمایشی', 'Control registration, maintenance mode, the global announcement, and test-account rules')}</p></div></div><div id="s-body">${loadingBlock(320)}</div>`;
  let ed = settingsDirty() ? app.settingsEdit : null; // unsaved edits survive re-renders
  if (!ed) {
    let fetched;
    try { fetched = (await api('/api/admin/settings')).settings; }
    catch (e) {
      view.querySelector('#s-body').innerHTML = errorBlock(e, 's-retry');
      view.querySelector('#s-retry')?.addEventListener('click', () => renderSettings(view));
      return;
    }
    if (app.section !== 'settings' || !view.isConnected) return;
    const o = JSON.stringify(fetched);
    ed = app.settingsEdit = { s: fetched, orig: o, draft: JSON.parse(o) };
  }
  const { s, orig, draft } = ed;
  const body = view.querySelector('#s-body');
  body.innerHTML = `
    <div class="grid" style="gap:14px">
      <section class="card">
        <div class="card-head"><h2>${tr('دسترسی پلتفرم', 'Platform access')}</h2></div>
        <div class="card-body" style="padding-top:4px;padding-bottom:4px">
          <div class="setting-row"><div class="txt"><strong>${tr('ثبت‌نام کاربر جدید', 'New user registration')}</strong><span>${tr('در صورت غیرفعال‌بودن، فرم ثبت‌نام با پیام «ثبت‌نام بسته است» پاسخ می‌دهد. کاربران فعلی همچنان وارد می‌شوند.', 'When off, sign-up is rejected with a “registration closed” message. Existing users can still sign in.')}</span></div>
            <span class="head-switch"><span class="switch-state" id="s-reg-state" aria-hidden="true"></span><label class="switch"><input type="checkbox" id="s-reg" ${draft.registrationOpen ? 'checked' : ''} aria-label="${tr('ثبت‌نام کاربر جدید', 'New user registration')}" /><span class="track"></span></label></span></div>
          <div class="setting-row"><div class="txt"><strong>${tr('حالت نگهداری', 'Maintenance mode')}</strong><span>${tr('ورود و ثبت‌نام کاربران عادی موقتاً متوقف می‌شود؛ مدیران همچنان وارد می‌شوند. نشست‌های فعال قطع نمی‌شوند.', 'Sign-in and sign-up are paused for regular users; administrators can still sign in. Active sessions are not interrupted.')}</span></div>
            <span class="head-switch" data-tone="warn"><span class="switch-state" id="s-maint-state" aria-hidden="true"></span><label class="switch"><input type="checkbox" id="s-maint" ${draft.maintenanceMode ? 'checked' : ''} aria-label="${tr('حالت نگهداری', 'Maintenance mode')}" /><span class="track"></span></label></span></div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${tr('اطلاعیه سراسری', 'Global announcement')}</h2>
          <span class="head-switch" id="s-ann-wrap"><span class="switch-state" id="s-ann-state" aria-hidden="true"></span><label class="switch"><input type="checkbox" id="s-ann" ${draft.announcementEnabled ? 'checked' : ''} aria-label="${tr('نمایش اطلاعیه', 'Show announcement')}" /><span class="track"></span></label></span></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
          <span class="hint dim" style="font-size:12.5px">${tr('این پیام بالای صفحه پلتفرم برای همه کاربران نمایش داده می‌شود و کاربر می‌تواند آن را ببندد.', 'Shown at the top of the platform for every user; users can dismiss it.')}</span>
          <div class="field"><span class="field-label" id="s-level-l">${tr('نوع اطلاعیه', 'Announcement type')}</span>
            <div class="seg" role="group" aria-labelledby="s-level-l">${[['info', tr('اطلاع‌رسانی', 'Info')], ['warning', tr('هشدار', 'Warning')], ['success', tr('خبر خوب', 'Good news')]].map(([v, l]) => `<button type="button" data-level="${v}" aria-pressed="${draft.announcementLevel === v}">${l}</button>`).join('')}</div></div>
          <div class="form-grid-2">
            <div class="field"><label for="s-ann-fa">${tr('متن فارسی', 'Persian text')}</label><textarea class="textarea" id="s-ann-fa" dir="rtl" maxlength="280" aria-describedby="s-ann-fa-c" placeholder="مثلاً: امشب از ساعت ۲ تا ۳ بامداد، سامانه برای به‌روزرسانی در دسترس نیست.">${esc(draft.announcementFa)}</textarea><div class="field-foot"><span class="hint" id="s-ann-fa-c" data-count="s-ann-fa"></span></div></div>
            <div class="field"><label for="s-ann-en">${tr('متن انگلیسی', 'English text')}</label><textarea class="textarea" id="s-ann-en" dir="ltr" maxlength="280" aria-describedby="s-ann-en-c" placeholder="e.g. The platform will be unavailable tonight from 2:00 to 3:00 a.m. for scheduled maintenance.">${esc(draft.announcementEn)}</textarea><div class="field-foot"><span class="hint" id="s-ann-en-c" data-count="s-ann-en"></span></div></div>
          </div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${tr('حساب‌های آزمایشی', 'Test accounts')}</h2></div>
        <div class="card-body field">
          <label for="s-domains">${tr('دامنه‌های ایمیل آزمایشی', 'Test email domains')}</label>
          <input class="input ltr" id="s-domains" value="${esc(draft.testDomains.join(', '))}" spellcheck="false" autocomplete="off" />
          <span class="hint">${tr('کاربرانی که ایمیلشان به این دامنه‌ها ختم می‌شود «آزمایشی» محسوب و از آمار داشبورد کنار گذاشته می‌شوند. دامنه‌ها را با ویرگول جدا کنید.', 'Users with these email domains count as test accounts and are excluded from dashboard KPIs. Separate domains with commas.')}</span>
          <span class="err" id="s-domains-err" hidden></span>
        </div>
      </section>
      <div class="card sticky-save" style="border-radius:var(--radius)">
        <span class="muted" id="s-state" style="font-size:12.5px"></span>
        <div class="toolbar"><button type="button" class="btn" id="s-discard" disabled>${tr('بازگردانی', 'Discard')}</button><button type="button" class="btn btn-primary" id="s-save" disabled>${tr('ذخیره تنظیمات', 'Save settings')}</button></div>
      </div>
    </div>`;
  const st = body.querySelector('#s-state'), saveBtn = body.querySelector('#s-save'), discardBtn = body.querySelector('#s-discard'), annState = body.querySelector('#s-ann-state');
  const counts = () => body.querySelectorAll('[data-count]').forEach(h => {
    const n = body.querySelector('#' + h.dataset.count).value.length;
    h.textContent = tr(`${fmtNum(n)} از ${fmtNum(280)} نویسه`, `${fmtNum(n)} of ${fmtNum(280)} characters`);
    h.dataset.near = String(n >= 252);
  });
  const sync = () => {
    const dirty = JSON.stringify(draft) !== orig;
    saveBtn.disabled = !dirty; discardBtn.disabled = !dirty;
    st.innerHTML = dirty
      ? `<span class="dirty-dot"></span> ${tr('تغییرات ذخیره‌نشده', 'Unsaved changes')}`
      : `<span class="save-ok">${icon('check')}${tr('همه تغییرات ذخیره شده است', 'All changes saved')}</span>${s.updatedAt ? `<span class="save-when"><span class="save-dot" aria-hidden="true"> · </span>${tr('آخرین تغییر:', 'Last changed:')} <bdi>${esc(fmtDate(s.updatedAt))}</bdi></span>` : ''}`;
    st.closest('.sticky-save')?.setAttribute('data-clean', String(!dirty));
    annState.textContent = draft.announcementEnabled ? tr('فعال', 'On') : tr('غیرفعال', 'Off');
    for (const [id, on] of [['s-reg', draft.registrationOpen], ['s-maint', draft.maintenanceMode]]) {
      const lbl = body.querySelector(`#${id}-state`);
      lbl.textContent = on ? tr('فعال', 'On') : tr('غیرفعال', 'Off');
      lbl.parentElement.setAttribute('data-on', String(Boolean(on)));
    }
    body.querySelector('#s-ann-wrap')?.setAttribute('data-on', String(Boolean(draft.announcementEnabled)));
    counts();
  };
  body.querySelector('#s-reg').addEventListener('change', e => { draft.registrationOpen = e.target.checked; sync(); });
  body.querySelector('#s-maint').addEventListener('change', e => { draft.maintenanceMode = e.target.checked; sync(); });
  body.querySelector('#s-ann').addEventListener('change', e => { draft.announcementEnabled = e.target.checked; sync(); });
  body.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => { draft.announcementLevel = b.dataset.level; body.querySelectorAll('[data-level]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); sync(); }));
  body.querySelector('#s-ann-fa').addEventListener('input', e => { draft.announcementFa = e.target.value; sync(); });
  body.querySelector('#s-ann-en').addEventListener('input', e => { draft.announcementEn = e.target.value; sync(); });
  body.querySelector('#s-domains').addEventListener('input', e => {
    draft.testDomains = e.target.value.split(/[\s,،]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
    body.querySelector('#s-domains-err').hidden = true; e.target.removeAttribute('aria-invalid');
    sync();
  });
  discardBtn.addEventListener('click', () => { app.settingsEdit = null; renderSettings(view); });
  saveBtn.addEventListener('click', async () => {
    const trimmed = { ...draft, announcementFa: draft.announcementFa.trim(), announcementEn: draft.announcementEn.trim() };
    if (trimmed.announcementEnabled && !trimmed.announcementFa && !trimmed.announcementEn) {
      toast(tr('برای نمایش اطلاعیه، دست‌کم یکی از متن‌های فارسی یا انگلیسی را وارد کنید.', 'Enter Persian or English text to show the announcement.'), 'error');
      body.querySelector('#s-ann-fa').focus();
      return;
    }
    if (trimmed.maintenanceMode && !s.maintenanceMode) {
      const ok = await confirmDialog({ title: tr('فعال‌سازی حالت نگهداری', 'Enable maintenance mode'), body: `<p style="margin:0">${tr('تا غیرفعال‌شدن این حالت، کاربران عادی نمی‌توانند وارد شوند یا ثبت‌نام کنند.', 'Until it is turned off, regular users cannot sign in or sign up.')}</p>`, danger: true, confirmText: tr('فعال‌سازی', 'Enable') });
      if (!ok) return;
    }
    saveBtn.disabled = true;
    try {
      await api('/api/admin/settings', { method: 'PUT', body: trimmed });
      toast(tr('تنظیمات پلتفرم ذخیره شد.', 'Platform settings saved.'));
      app.settingsEdit = null;
      renderSettings(view);
    } catch (e) {
      const bad = e.data?.errors?.find(x => x.field === 'testDomains');
      if (bad) {
        const er = body.querySelector('#s-domains-err');
        er.textContent = tr(`دامنه نامعتبر: ${bad.values.join('، ')}`, `Invalid domain: ${bad.values.join(', ')}`);
        er.hidden = false; body.querySelector('#s-domains').setAttribute('aria-invalid', 'true');
      }
      toast(errMsg(e), 'error'); saveBtn.disabled = false;
    }
  });
  sync();
}

// ── System health ─────────────────────────────────────────────────────────
async function renderSystem(view) {
  view.innerHTML = `<div class="page-head"><div><p>${tr('وضعیت سرور، ذخیره‌سازی، نشست‌های مدیریتی و صف ارسال پیام', 'Server status, storage, admin sessions, and the message outbox')}</p></div><div class="toolbar"><button type="button" class="btn btn-sm" id="sys-refresh">${icon('refresh')}<span>${tr('به‌روزرسانی', 'Refresh')}</span></button></div></div><div id="sys-body">${loadingBlock(300)}</div>`;
  view.querySelector('#sys-refresh').addEventListener('click', () => renderSystem(view));
  let d, ss;
  try { [d, ss] = await Promise.all([api('/api/admin/system'), api('/api/admin/sessions')]); }
  catch (e) {
    view.querySelector('#sys-body').innerHTML = errorBlock(e, 'sys-retry');
    view.querySelector('#sys-retry')?.addEventListener('click', () => renderSystem(view));
    return;
  }
  if (app.section !== 'system' || !view.isConnected) return;
  const sv = d.server, sto = d.storage;
  const memUsed = 1 - sv.memFreeMB / sv.memTotalMB;
  const kpi = (label, value, sub) => `<div class="card kpi"><div class="kpi-label"><span>${label}</span></div><div class="kpi-value" style="font-size:20px">${value}</div><div class="kpi-sub">${sub}</div></div>`;
  view.querySelector('#sys-body').innerHTML = `
    <div class="grid" style="gap:14px">
      <div class="grid kpis">
        ${kpi(tr('مدت فعالیت سرویس', 'Service uptime'), esc(fmtDuration(sv.uptimeSec)), `${tr('راه‌اندازی:', 'Started:')} <span class="nw">${esc(fmtDate(sv.bootAt))}</span>`)}
        ${kpi(tr('حافظه سرویس', 'Service memory'), `${fmtNum(sv.rssMB)}\u00A0${tr('مگابایت', 'MB')}`, `<span class="sub-part">${tr(`هیپ: ${fmtNum(sv.heapMB)}\u00A0مگابایت`, `Heap: ${fmtNum(sv.heapMB)}\u00A0MB`)}</span><span class="sub-dot" aria-hidden="true"> · </span><span class="sub-part"><span class="ltr">Node ${esc(sv.node)}</span></span>`)}
        ${kpi(tr('بار پردازنده <span class="nw">(۱ / ۵ / ۱۵ دقیقه)</span>', 'CPU load <span class="nw">(1 / 5 / 15 min)</span>'), `<span class="${isFa() ? '' : 'ltr '}load-avg">${sv.load.map(x => `<span>${fmtNum(x, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`).join('<span class="sep" aria-hidden="true">/</span>')}</span>`, tr(`${fmtNum(sv.cpus)} هسته پردازشی`, `${fmtNum(sv.cpus)} CPU cores`))}
        ${kpi(tr('حافظه سرور (درحال استفاده)', 'Server memory (in use)'), fmtPct(memUsed), tr(`${fmtNum(sv.memFreeMB)}\u00A0مگابایت آزاد از ${fmtNum(sv.memTotalMB)}\u00A0مگابایت`, `${fmtNum(sv.memFreeMB)}\u00A0MB free of ${fmtNum(sv.memTotalMB)}\u00A0MB`))}
      </div>
      <div class="grid cols-even">
        <section class="card"><div class="card-head"><h2>${tr('ذخیره‌سازی داده‌ها', 'Data storage')}</h2></div>
          <div class="card-body"><dl class="kv">
            <dt>${tr('حساب‌های کاربری', 'User accounts')}</dt><dd>${fmtNum(sto.users)}</dd>
            <dt>${tr('نشست‌های فعال کاربران', 'Active user sessions')}</dt><dd>${fmtNum(sto.sessions)}</dd>
            <dt>${tr('فایل‌های فضای ابری', 'Cloud state files')}</dt><dd>${fmtNum(sto.stateFiles)}</dd>
            <dt>${tr('حجم فضای ابری', 'Cloud state size')}</dt><dd>${esc(fmtBytes(sto.stateBytes))}</dd>
            <dt>${tr('منبع کلید مدیریت', 'Admin key source')}</dt><dd>${sv.keySource === 'env' ? tr('متغیر محیطی', 'Environment variable') : tr('فایل امن روی سرور', 'Protected file on server')}</dd>
          </dl></div></section>
        <section class="card"><div class="card-head"><h2>${tr('نشست‌های فعال پنل مدیریت', 'Active admin sessions')}</h2></div>
          <div class="card-body">${ss.sessions.length ? `<div class="sess-list">${[...ss.sessions].sort((x, y) => (y.current - x.current) || (y.createdAt - x.createdAt)).map(s => `
            <div style="display:flex;gap:10px;align-items:flex-start;padding-bottom:10px;border-bottom:1px dashed var(--line)">
              <div style="flex:1;min-width:0"><div class="sess-title"><strong>${esc(uaLabel(s.ua))}</strong>${s.current ? `<span class="badge b-green">${tr('همین مرورگر', 'This browser')}</span>` : ''}</div>
                <div class="dim" style="font-size:12px">${tr('آی‌پی:', 'IP:')} <span class="ltr">${esc(s.ip || '—')}</span> · ${tr('ورود', 'Signed in')} ${esc(fmtAgo(s.createdAt))}</div>
                <div class="dim" style="font-size:12px">${tr('انقضا:', 'Expires:')} ${esc(fmtDate(s.expiresAt))}</div></div>
              <button type="button" class="btn btn-sm ${s.current ? '' : 'btn-danger'}" data-asess="${esc(s.id)}" data-current="${s.current}">${s.current ? tr('خروج از پنل', 'Sign out') : tr('پایان نشست', 'End session')}</button>
            </div>`).join('')}</div>` : `<div class="empty" style="padding:16px">${tr('هیچ نشست کلیدی فعالی وجود ندارد (ورود با نقش مدیریتی حساب انجام شده است).', 'No active key sessions (you signed in with an admin account role).')}</div>`}</div></section>
      </div>
      <section class="card"><div class="card-head"><h2>${tr('صف ارسال کدها (تأیید ایمیل / بازیابی گذرواژه)', 'Code outbox (verification / password reset)')}</h2><span class="badge b-gray">${tr('کدها برای امنیت نمایش داده نمی‌شوند', 'Codes are hidden for security')}</span></div>
        ${d.outbox.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th scope="col">${tr('زمان', 'Time')}</th><th scope="col">${tr('نوع', 'Type')}</th><th scope="col">${tr('گیرنده', 'Recipient')}</th></tr></thead><tbody>
          ${d.outbox.map(m => `<tr><td class="muted" style="white-space:nowrap">${esc(fmtDate(Date.parse(m.at)))}</td><td>${m.kind === 'reset' ? `<span class="badge b-amber">${tr('بازیابی گذرواژه', 'Password reset')}</span>` : `<span class="badge b-blue">${tr('تأیید ایمیل', 'Email verification')}</span>`}</td><td><span class="ltr">${esc(m.email)}</span></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="empty">${tr('پیامی در صف نیست.', 'The outbox is empty.')}</div>`}
      </section>
    </div>`;
  view.querySelectorAll('[data-asess]').forEach(b => b.addEventListener('click', async () => {
    const current = b.dataset.current === 'true';
    const ok = await confirmDialog({
      title: tr('پایان نشست مدیریتی', 'End admin session'),
      body: `<p style="margin:0">${current ? tr('این نشست متعلق به همین مرورگر است؛ پس از پایان آن از پنل خارج می‌شوید.', 'This is your current session; you will be signed out of the console.') : tr('دسترسی آن مرورگر به پنل مدیریت فوراً قطع می‌شود.', 'That browser will immediately lose console access.')}</p>`,
      danger: true, confirmText: tr('پایان نشست', 'End session'),
      onConfirm: async () => api(`/api/admin/sessions/${encodeURIComponent(b.dataset.asess)}`, { method: 'DELETE' })
    });
    if (!ok) return;
    toast(tr('نشست مدیریتی پایان یافت.', 'Admin session ended.'));
    if (current) { boot(); return; }
    renderSystem(view);
  }));
}

export { planName, planColor };
