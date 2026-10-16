// client/admin/plans.js — Plan catalog editor: identity, pricing, status rules,
// entitlements (quotas + capabilities), ordering, duplication, deletion and a
// read-only comparison matrix. Exports renderPlans(), plansDirty() and
// confirmLeavePlans() for the console router.

import {
  isFa, tr, api, errMsg, esc, icon, toast, openDialog, confirmDialog,
  fmtNum, fmtMoney, fmtPct, safeColor, plural } from './core.js';

const EDIT_KEYS = ['nameFa', 'nameEn', 'badgeFa', 'badge', 'descriptionFa', 'descriptionEn', 'color', 'priceUSD', 'priceYearlyUSD', 'isActive', 'isDefault'];
const TEXT_LIMITS = { nameFa: 40, nameEn: 40, badgeFa: 16, badge: 16, descriptionFa: 240, descriptionEn: 240 };
const SWATCHES = ['#8b93a7', '#3b82f6', '#00F2B0', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#84cc16', '#f97316'];
const CAT_ICON = { chart: 'chart', alerts: 'bell', screener: 'search', trading: 'money', backtest: 'flask', platform: 'globe' };
const MAX_PRICE = 100000;
const PLAN_ID_RE = /^[a-z0-9_-]{2,32}$/;

const S = {
  data: null,      // GET /api/admin/plans payload
  sel: null,       // selected plan id
  draft: null,     // editable copy of the selected plan
  orig: null,      // JSON snapshot of the draft at load time
  raw: {},         // raw text of numeric inputs (keeps what the admin typed)
  errors: {},      // key -> message
  mode: 'editor',  // 'editor' | 'matrix'
  mobile: 'list',  // narrow screens: 'list' | 'editor'
  q: '',           // feature search
  onlyChanged: false
};
let V = null;      // view element
let C = null;      // console context { app, go, refreshPlansMeta }
let keysBound = false;

// ── Helpers ───────────────────────────────────────────────────────────────
const pick = (p) => { const o = {}; for (const k of EDIT_KEYS) o[k] = p[k]; o.features = { ...(p.features || {}) }; return o; };
const snapshot = () => (S.orig ? JSON.parse(S.orig) : null);
export const plansDirty = () => !!(S.draft && S.orig && JSON.stringify(S.draft) !== S.orig);
const catalog = () => S.data?.catalog || [];
const isBuiltin = (id) => (S.data?.builtin || []).includes(id);
const planLabel = (p) => (isFa() ? (p.nameFa || p.nameEn || p.id) : (p.nameEn || p.nameFa || p.id));
const narrow = () => window.matchMedia('(max-width: 980px)').matches;
const norm = (s) => String(s || '').toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s]+/g, '');
const digits = (s) => String(s ?? '').trim()
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const parsePrice = (s) => { const t = digits(s).replace(/٫/g, '.').replace(/[,٬\s]/g, ''); return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN; };
const parseQuota = (s) => { const t = digits(s).replace(/[,٬\s]/g, ''); return /^\d+$/.test(t) ? Number(t) : NaN; };
const plainNum = (n) => (Number.isFinite(n) ? String(n) : '');
const priceLabel = (v) => (Number(v) > 0 ? fmtMoney(v) : tr('رایگان', 'Free'));
// English units are stored plural ('charts'); exactly 1 takes the singular ("1 chart").
const unitFor = (f, v) => (isFa() ? (f.unitFa || '') : (v === 1 && /[a-z]s$/.test(f.unitEn || '') ? f.unitEn.slice(0, -1) : (f.unitEn || '')));
const fmtQuota = (f, v) => (v === -1 ? tr('نامحدود', 'Unlimited') : `${fmtNum(v)} ${unitFor(f, v)}`.trim());

function changedKeys() {
  const o = snapshot();
  if (!o || !S.draft) return [];
  const out = [];
  for (const k of EDIT_KEYS) if (JSON.stringify(o[k]) !== JSON.stringify(S.draft[k])) out.push(k);
  for (const f of catalog()) if (o.features[f.id] !== S.draft.features[f.id]) out.push(`f:${f.id}`);
  return out;
}

function startDraft() {
  const p = S.data?.plans?.[S.sel];
  if (!p) { S.draft = null; S.orig = null; return; }
  S.draft = pick(p);
  S.orig = JSON.stringify(S.draft);
  S.raw = {};
  S.errors = {};
}
function discardDraft() {
  if (S.orig) S.draft = JSON.parse(S.orig);
  S.raw = {}; S.errors = {};
}

/** Ask before throwing away unsaved plan edits. Resolves true when safe to leave. */
export async function confirmLeavePlans() {
  if (!plansDirty()) return true;
  const name = S.draft ? planLabel({ ...S.draft, id: S.sel }) : '';
  const ok = await confirmDialog({
    title: tr('تغییرات ذخیره نشده است', 'Unsaved changes'),
    body: `<p style="margin:0">${tr(`تغییرات پلن «${esc(name)}» هنوز ذخیره نشده است. در صورت ادامه، این تغییرات از بین می‌رود.`, `Changes to “${esc(name)}” have not been saved. If you continue, they will be lost.`)}</p>`,
    confirmText: tr('نادیده گرفتن تغییرات', 'Discard changes'), cancelText: tr('ماندن و ادامه ویرایش', 'Keep editing'), danger: true
  });
  if (ok) discardDraft();
  return ok;
}

async function load() {
  const d = await api('/api/admin/plans');
  S.data = d;
  if (C?.app) C.app.plansMeta = d;
  if (!S.sel || !d.plans[S.sel]) S.sel = d.planOrder[0] || null;
  return d;
}

// ── Entry point ───────────────────────────────────────────────────────────
export async function renderPlans(view, ctx) {
  V = view; C = ctx;
  bindKeys();
  if (S.data && plansDirty()) { paint(); return; } // returning with unsaved work
  view.innerHTML = `${headHtml()}<div class="plans-layout"><div class="skeleton" style="height:360px"></div><div class="skeleton" style="height:520px"></div></div>`;
  wireHead();
  try { await load(); }
  catch (e) {
    if (!view.isConnected) return;
    view.innerHTML = `${headHtml()}<div class="card"><div class="empty">${icon('alert')}<strong>${tr('بارگذاری پلن‌ها ناموفق بود', 'Could not load plans')}</strong><span>${esc(errMsg(e))}</span><button type="button" class="btn" id="pl-retry">${icon('refresh')}<span>${tr('تلاش دوباره', 'Try again')}</span></button></div></div>`;
    view.querySelector('#pl-retry')?.addEventListener('click', () => renderPlans(view, ctx));
    return;
  }
  if (!view.isConnected || C.app.section !== 'plans') return;
  startDraft();
  paint();
}

function paint() {
  if (!V?.isConnected || !S.data) return;
  V.innerHTML = headHtml() + (S.mode === 'matrix' ? matrixHtml() : layoutHtml());
  wireHead();
  if (S.mode === 'matrix') wireMatrix();
  else { wireList(); wireEditor(); }
  refreshChrome();
}

// ── Page head ─────────────────────────────────────────────────────────────
function headHtml() {
  return `
    <div class="page-head">
      <div><p>${tr('قیمت، سقف‌های مصرف و امکانات هر پلن اشتراک را تعریف و مدیریت کنید', 'Define pricing, usage quotas, and capabilities for each subscription plan')}</p></div>
      <div class="toolbar plans-head-tools">
        <div class="seg" role="group" aria-label="${tr('نمای پلن‌ها', 'Plans view')}">
          <button type="button" data-mode="editor" aria-pressed="${S.mode === 'editor'}">${tr('ویرایشگر', 'Editor')}</button>
          <button type="button" data-mode="matrix" aria-pressed="${S.mode === 'matrix'}">${tr('جدول مقایسه', 'Comparison')}</button>
        </div>
        <button type="button" class="btn btn-sm btn-primary" id="pl-new">${icon('plus')}<span>${tr('پلن جدید', 'New plan')}</span></button>
        <button type="button" class="btn btn-sm btn-ghost btn-ghost-danger" id="pl-reset">${icon('refresh')}<span>${tr('بازنشانی پلن‌ها', 'Reset plans')}</span></button>
      </div>
    </div>`;
}
function wireHead() {
  V.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    if (!S.data || S.mode === b.dataset.mode) return;
    S.mode = b.dataset.mode;
    paint();
    V.querySelector(`[data-mode="${S.mode}"]`)?.focus();
  }));
  V.querySelector('#pl-new')?.addEventListener('click', () => { if (S.data) newPlanDialog(); });
  V.querySelector('#pl-reset')?.addEventListener('click', () => { if (S.data) resetDialog(); });
}

// ── Layout: list + editor ─────────────────────────────────────────────────
function layoutHtml() {
  if (!S.draft) {
    return `<div class="card"><div class="empty">${icon('plans')}<strong>${tr('هیچ پلنی تعریف نشده است', 'No plans defined')}</strong><button type="button" class="btn btn-primary" id="pl-new-empty">${icon('plus')}<span>${tr('ایجاد نخستین پلن', 'Create the first plan')}</span></button></div></div>`;
  }
  return `
    <div class="plans-layout ${S.mobile === 'editor' ? 'mobile-editor' : 'mobile-list'}">
      <section class="card plan-list-card" aria-labelledby="pl-h">
        <div class="card-head"><h2 id="pl-h">${tr('پلن‌های اشتراک', 'Subscription plans')}</h2><span class="badge b-gray">${fmtNum(S.data.planOrder.length)}</span></div>
        <div class="plan-list" id="pl-list" role="list">${listItemsHtml()}</div>
        <p class="plan-list-note">${tr('ترتیب این فهرست، ترتیب نمایش پلن‌ها در صفحه قیمت‌گذاری کاربران است.', 'This order is the order plans appear on the user pricing page.')}</p>
      </section>
      ${editorHtml()}
    </div>`;
}

function listItemsHtml() {
  const { plans, planOrder, userCounts } = S.data;
  const dirty = plansDirty();
  return planOrder.map((id, i) => {
    const p = id === S.sel && S.draft ? { ...plans[id], ...S.draft, id } : { ...plans[id], id };
    const users = userCounts?.[id] || 0;
    const name = planLabel(p);
    const price = Number(p.priceUSD) > 0
      ? `${esc(fmtMoney(p.priceUSD))}<small>${tr(' / ماه', ' /mo')}</small>`
      : tr('رایگان', 'Free');
    return `
      <div class="plan-item" role="listitem" data-plan="${esc(id)}" aria-current="${id === S.sel}">
        <button type="button" class="plan-item-main" data-pick="${esc(id)}">
          <span class="plan-item-top"><span class="dot" style="background:${safeColor(p.color)}"></span><strong>${esc(name)}</strong><span class="price">${price}</span></span>
          <span class="plan-item-sub">
            <span class="mono">${esc(id)}</span>
            ${p.isDefault ? `<span class="badge b-blue">${tr('پیش‌فرض', 'Default')}</span>` : ''}
            ${p.isActive === false ? `<span class="badge b-amber">${tr('غیرفعال', 'Inactive')}</span>` : ''}
            <span>${tr(`${fmtNum(users)} کاربر`, `${fmtNum(users)} ${users === 1 ? 'user' : 'users'}`)}</span>
            ${id === S.sel && dirty ? `<span class="badge b-amber">${tr('ذخیره‌نشده', 'Unsaved')}</span>` : ''}
          </span>
        </button>
        <span class="plan-item-tools">
          <button type="button" class="btn btn-sm btn-icon btn-ghost" data-move="up" data-id="${esc(id)}" ${i === 0 ? 'disabled' : ''} aria-label="${esc(tr(`انتقال «${name}» به بالا`, `Move “${name}” up`))}" title="${tr('انتقال به بالا', 'Move up')}">${icon('up')}</button>
          <button type="button" class="btn btn-sm btn-icon btn-ghost" data-move="down" data-id="${esc(id)}" ${i === planOrder.length - 1 ? 'disabled' : ''} aria-label="${esc(tr(`انتقال «${name}» به پایین`, `Move “${name}” down`))}" title="${tr('انتقال به پایین', 'Move down')}">${icon('down')}</button>
        </span>
      </div>`;
  }).join('');
}

function wireList() {
  V.querySelector('#pl-new-empty')?.addEventListener('click', newPlanDialog);
  const list = V.querySelector('#pl-list');
  if (!list) return;
  list.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => pickPlan(b.dataset.pick)));
  list.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => move(b.dataset.id, b.dataset.move)));
}
function repaintList() {
  const list = V?.querySelector('#pl-list');
  if (!list) return;
  list.innerHTML = listItemsHtml();
  wireList();
}

async function pickPlan(id) {
  if (id === S.sel) {
    if (narrow()) { S.mobile = 'editor'; paint(); window.scrollTo(0, 0); }
    return;
  }
  if (!(await confirmLeavePlans())) return;
  S.sel = id;
  startDraft();
  S.mobile = 'editor';
  paint();
  if (narrow()) { window.scrollTo(0, 0); V.querySelector('#pe-back')?.focus(); }
  else V.querySelector(`[data-pick="${CSS.escape(id)}"]`)?.focus();
}

async function move(id, dir) {
  const order = [...S.data.planOrder];
  const i = order.indexOf(id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  V.querySelectorAll('[data-move]').forEach((b) => { b.disabled = true; });
  try {
    const r = await api('/api/admin/plans/reorder', { method: 'POST', body: { order } });
    S.data.planOrder = r.planOrder;
    if (C?.app?.plansMeta) C.app.plansMeta.planOrder = r.planOrder;
    toast(tr('ترتیب نمایش پلن‌ها به‌روزرسانی شد.', 'Plan order updated.'));
  } catch (e) {
    toast(errMsg(e), 'error');
  }
  repaintList();
  const sel = (d) => V.querySelector(`[data-move="${d}"][data-id="${CSS.escape(id)}"]`);
  const btn = sel(dir);
  (btn && !btn.disabled ? btn : sel(dir === 'up' ? 'down' : 'up'))?.focus();
}

// ── Editor ────────────────────────────────────────────────────────────────
function editorHtml() {
  const d = S.draft;
  const id = S.sel;
  const saved = S.data.plans[id];
  const users = S.data.userCounts?.[id] || 0;
  const delReason = saved.isDefault
    ? tr('پلن پیش‌فرض قابل حذف نیست؛ ابتدا پلن دیگری را پیش‌فرض کنید.', 'The default plan cannot be deleted; make another plan the default first.')
    : isBuiltin(id) ? tr('پلن‌های پایه سامانه حذف‌شدنی نیستند؛ در صورت نیاز، آن را غیرفعال کنید.', 'Built-in plans cannot be deleted; deactivate it instead if needed.') : '';
  const tf = (key, label, dir, area = false) => {
    const v = d[key] ?? '';
    const lim = TEXT_LIMITS[key];
    const ctl = area
      ? `<textarea class="textarea" id="pf-${key}" data-text="${key}" dir="${dir}" maxlength="${lim}" aria-describedby="pf-${key}-e pf-${key}-c">${esc(v)}</textarea>`
      : `<input class="input" id="pf-${key}" data-text="${key}" dir="${dir}" maxlength="${lim}" value="${esc(v)}" autocomplete="off" aria-describedby="pf-${key}-e pf-${key}-c" />`;
    return `<div class="field"><label for="pf-${key}">${label}<span class="chg" data-chg="${key}" hidden title="${tr('تغییر یافته', 'Changed')}"></span></label>${ctl}
      <div class="field-foot"><span class="err" id="pf-${key}-e" data-err="${key}" hidden></span><span class="hint" id="pf-${key}-c" data-count="${key}"></span></div></div>`;
  };
  const pf = (key, label) => `
    <div class="field"><label for="pf-${key}">${label}<span class="chg" data-chg="${key}" hidden title="${tr('تغییر یافته', 'Changed')}"></span></label>
      <div class="input-affix"><span class="affix" aria-hidden="true">$</span><input class="input" id="pf-${key}" data-price="${key}" inputmode="decimal" autocomplete="off" value="${esc(S.raw[key] ?? plainNum(d[key]))}" aria-describedby="pf-${key}-e" /></div>
      <span class="err" id="pf-${key}-e" data-err="${key}" hidden></span></div>`;
  const colorKnown = SWATCHES.some((c) => c.toLowerCase() === String(d.color).toLowerCase());
  return `
    <section class="card plan-editor-card" aria-labelledby="pe-title">
      <div class="card-head pe-head">
        <button type="button" class="btn btn-sm btn-ghost only-mobile-plans" id="pe-back">${icon(isFa() ? 'forward' : 'back')}<span>${tr('همه پلن‌ها', 'All plans')}</span></button>
        <div class="pe-title-wrap">
          <span class="dot" id="pe-dot" style="width:12px;height:12px;background:${safeColor(d.color)}"></span>
          <h2 id="pe-title">${esc(planLabel({ ...d, id }))}</h2>
          <span class="badge b-gray mono">${esc(id)}</span>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn-sm" id="pe-clone">${icon('copy')}<span>${tr('تکثیر', 'Duplicate')}</span></button>
          <button type="button" class="btn btn-sm btn-danger" id="pe-delete" ${delReason ? 'disabled aria-describedby="pe-del-why"' : ''}>${icon('trash')}<span>${tr('حذف', 'Delete')}</span></button>
        </div>
        ${delReason ? `<div class="hint pe-del-why" id="pe-del-why">${icon('info')}<span>${delReason}</span></div>` : ''}
      </div>
      <div class="card-body plan-form">
        <section class="pf-sec">
          <div class="pf-sec-head"><h3>${tr('مشخصات و نمایش', 'Identity & display')}</h3><p>${tr('نام، برچسب و توضیحی که کاربران در صفحه قیمت‌گذاری می‌بینند', 'Name, badge, and description users see on the pricing page')}</p></div>
          <div class="pf-two">
            <div class="form-grid-2">
              ${tf('nameFa', tr('نام فارسی', 'Persian name'), 'rtl')}
              ${tf('nameEn', tr('نام انگلیسی', 'English name'), 'ltr')}
              ${tf('badgeFa', tr('برچسب فارسی (اختیاری)', 'Persian badge (optional)'), 'rtl')}
              ${tf('badge', tr('برچسب انگلیسی (اختیاری)', 'English badge (optional)'), 'ltr')}
              <div class="span-2">${tf('descriptionFa', tr('توضیح فارسی', 'Persian description'), 'rtl', true)}</div>
              <div class="span-2">${tf('descriptionEn', tr('توضیح انگلیسی', 'English description'), 'ltr', true)}</div>
            </div>
            <div class="pv-wrap"><span class="field-label">${tr('پیش‌نمایش کارت قیمت‌گذاری', 'Pricing card preview')}</span><div id="pf-preview"></div></div>
          </div>
        </section>
        <section class="pf-sec">
          <div class="pf-sec-head"><h3>${tr('قیمت‌گذاری و رنگ', 'Pricing & color')}</h3><p>${tr('مبالغ به دلار آمریکا؛ برای پلن رایگان مقدار صفر وارد کنید', 'Amounts in US dollars; enter zero for a free plan')}</p></div>
          <div class="form-grid">
            ${pf('priceUSD', tr('قیمت ماهانه', 'Monthly price'))}
            ${pf('priceYearlyUSD', tr('قیمت سالانه', 'Yearly price'))}
            <div class="field span-2"><span class="field-label" id="pf-color-l">${tr('رنگ شاخص پلن', 'Plan accent color')}<span class="chg" data-chg="color" hidden></span></span>
              <div class="swatches" role="group" aria-labelledby="pf-color-l">
                ${SWATCHES.map((c) => `<button type="button" class="swatch" data-color="${c}" aria-pressed="${String(d.color).toLowerCase() === c.toLowerCase()}" style="background:${c}" aria-label="${tr('رنگ', 'Color')} ${c}" title="${c}"></button>`).join('')}
                <label class="swatch swatch-custom" title="${tr('رنگ دلخواه', 'Custom color')}" data-on="${!colorKnown}"><input type="color" id="pf-color-custom" value="${safeColor(d.color)}" aria-label="${tr('انتخاب رنگ دلخواه', 'Pick a custom color')}" /></label>
                <span class="mono dim ltr" id="pf-color-hex">${esc(safeColor(d.color))}</span>
              </div>
            </div>
          </div>
          <div class="hint" id="pf-yearly-note"></div>
        </section>
        <section class="pf-sec">
          <div class="pf-sec-head"><h3>${tr('وضعیت پلن', 'Plan status')}</h3><p>${tr(`${fmtNum(users)} کاربر هم‌اکنون روی این پلن هستند`, `${fmtNum(users)} ${users === 1 ? 'user is' : 'users are'} currently on this plan`)}</p></div>
          <div>
            <div class="setting-row"><div class="txt"><strong>${tr('فعال برای کاربران', 'Available to users')}<span class="chg" data-chg="isActive" hidden></span></strong><span id="pf-active-hint"></span></div>
              <span class="switch"><input type="checkbox" id="pf-active" ${d.isActive ? 'checked' : ''} aria-describedby="pf-active-hint" aria-label="${tr('فعال برای کاربران', 'Available to users')}" /><span class="track"></span></span></div>
            <div class="setting-row"><div class="txt"><strong>${tr('پلن پیش‌فرض ثبت‌نام', 'Default sign-up plan')}<span class="chg" data-chg="isDefault" hidden></span></strong><span id="pf-default-hint"></span></div>
              <span class="switch"><input type="checkbox" id="pf-default" ${d.isDefault ? 'checked' : ''} ${saved.isDefault ? 'disabled' : ''} aria-describedby="pf-default-hint" aria-label="${tr('پلن پیش‌فرض ثبت‌نام', 'Default sign-up plan')}" /><span class="track"></span></span></div>
          </div>
        </section>
        <section class="pf-sec">
          <div class="pf-sec-head"><h3>${tr('امکانات و سقف‌های مصرف', 'Capabilities & quotas')}</h3><p id="pf-fsum"></p></div>
          <div class="toolbar">
            <label class="search"><span class="sr-only">${tr('جستجو در امکانات', 'Search features')}</span>${icon('search')}<input class="input" id="pf-q" type="search" dir="auto" value="${esc(S.q)}" placeholder="${tr('جستجو در امکانات این پلن', 'Search this plan’s features')}" autocomplete="off" /></label>
            <div class="seg" role="group" aria-label="${tr('فیلتر امکانات', 'Feature filter')}">
              <button type="button" data-fmode="all" aria-pressed="${!S.onlyChanged}">${tr('همه', 'All')}</button>
              <button type="button" data-fmode="changed" aria-pressed="${S.onlyChanged}">${tr('فقط تغییرکرده‌ها', 'Changed only')}</button>
            </div>
          </div>
          <div id="pf-features" class="pf-features">${featuresHtml()}</div>
        </section>
      </div>
      <div class="sticky-save pe-save">
        <span class="muted" id="pe-state" role="status" aria-live="polite"></span>
        <div class="toolbar">
          <button type="button" class="btn" id="pe-discard">${tr('بازگردانی', 'Discard')}</button>
          <button type="button" class="btn btn-primary" id="pe-save">${tr('ذخیره تغییرات', 'Save changes')}</button>
        </div>
      </div>
    </section>`;
}

function featuresHtml() {
  const cats = [...(S.data.categories || [])];
  const known = new Set(cats.map((c) => c.id));
  if (catalog().some((f) => !known.has(f.category))) cats.push({ id: '__other', nameFa: 'سایر امکانات', nameEn: 'Other' });
  const o = snapshot();
  const q = norm(S.q);
  const match = (f) => (!q || norm(`${f.nameFa} ${f.nameEn} ${f.descFa} ${f.descEn} ${f.id}`).includes(q))
    && (!S.onlyChanged || o.features[f.id] !== S.draft.features[f.id]);
  let html = '';
  for (const c of cats) {
    const fs = catalog().filter((f) => (c.id === '__other' ? !known.has(f.category) : f.category === c.id) && match(f));
    if (!fs.length) continue;
    const nums = fs.filter((f) => f.type === 'numeric');
    const bools = fs.filter((f) => f.type !== 'numeric');
    html += `
      <div class="cat-block">
        <h4 class="cat-title">${icon(CAT_ICON[c.id] || 'plans')}<span>${esc(isFa() ? c.nameFa : c.nameEn)}</span><span class="badge b-gray">${fmtNum(fs.length)}</span></h4>
        ${nums.length ? `<div class="feat-grid">${nums.map(quotaHtml).join('')}</div>` : ''}
        ${bools.length ? `<div class="feat-grid">${bools.map(boolHtml).join('')}</div>` : ''}
      </div>`;
  }
  if (!html) {
    html = `<div class="empty" style="padding:24px">${icon('search')}<strong>${S.onlyChanged && !q ? tr('هنوز امکانی تغییر نکرده است', 'No features changed yet') : tr('امکانی یافت نشد', 'No matching features')}</strong><span>${S.onlyChanged && !q ? tr('امکاناتی که تغییر می‌دهید اینجا فهرست می‌شوند.', 'Features you change will be listed here.') : tr('عبارت جستجو را تغییر دهید.', 'Try a different search term.')}</span></div>`;
  }
  return html;
}

function quotaHtml(f) {
  const v = S.draft.features[f.id];
  const key = `f:${f.id}`;
  const unl = v === -1;
  const name = isFa() ? f.nameFa : f.nameEn;
  return `
    <div class="quota" data-fid="${esc(f.id)}">
      <div class="quota-top"><div style="min-width:0"><strong>${esc(name)}<span class="chg" data-chg="${key}" hidden></span></strong><span>${esc(isFa() ? f.descFa : f.descEn)}</span></div></div>
      <div class="quota-input">
        <input class="input" id="q-${esc(f.id)}" data-quota="${esc(f.id)}" inputmode="numeric" autocomplete="off" value="${unl ? '' : esc(S.raw[key] ?? plainNum(v))}" placeholder="${unl ? '∞' : ''}" ${unl ? 'disabled' : ''} aria-label="${esc(name)}" aria-describedby="q-${esc(f.id)}-h q-${esc(f.id)}-e" />
        <span class="unit">${esc(isFa() ? f.unitFa : f.unitEn)}</span>
        ${f.allowUnlimited !== false ? `<label class="unlim"><input type="checkbox" class="check" data-unl="${esc(f.id)}" ${unl ? 'checked' : ''} aria-label="${esc(tr(`${name}: نامحدود`, `${name}: unlimited`))}" /><span aria-hidden="true">${tr('نامحدود', 'Unlimited')}</span></label>` : ''}
      </div>
      <span class="hint" id="q-${esc(f.id)}-h">${tr(`محدوده مجاز: ${fmtNum(f.min)} تا ${fmtNum(f.max)}`, `Allowed range: ${fmtNum(f.min)}–${fmtNum(f.max)}`)}</span>
      <span class="err" id="q-${esc(f.id)}-e" data-err="${key}" hidden></span>
    </div>`;
}

function boolHtml(f) {
  const on = !!S.draft.features[f.id];
  const name = isFa() ? f.nameFa : f.nameEn;
  return `
    <label class="feat ${on ? 'on' : ''}" data-fid="${esc(f.id)}">
      <span class="feat-text"><strong>${esc(name)}<span class="chg" data-chg="f:${esc(f.id)}" hidden></span></strong><span>${esc(isFa() ? f.descFa : f.descEn)}</span></span>
      <span class="switch"><input type="checkbox" data-bool="${esc(f.id)}" ${on ? 'checked' : ''} aria-label="${esc(name)}" /><span class="track"></span></span>
    </label>`;
}

function previewHtml() {
  const d = S.draft;
  const c = safeColor(d.color);
  const name = isFa() ? (d.nameFa || d.nameEn) : (d.nameEn || d.nameFa);
  const badge = isFa() ? (d.badgeFa || d.badge) : (d.badge || d.badgeFa);
  const desc = isFa() ? (d.descriptionFa || d.descriptionEn) : (d.descriptionEn || d.descriptionFa);
  const price = Number.isFinite(d.priceUSD) ? priceLabel(d.priceUSD) : '—';
  const hi = ['chartsPerTab', 'indicatorsPerChart', 'priceAlerts', 'histBars'].map((id) => catalog().find((f) => f.id === id)).filter(Boolean);
  const caps = catalog().filter((f) => f.type !== 'numeric');
  const on = caps.filter((f) => d.features[f.id]).length;
  return `
    <div class="preview-card" style="border-color:${c}">
      <div class="pv-top"><strong>${esc(name || '—')}</strong>${badge ? `<span class="badge" style="background:${c}22;color:${c}">${esc(badge)}</span>` : ''}</div>
      <div class="pv-price">${esc(price)}${Number(d.priceUSD) > 0 ? `<small>${tr(' / ماه', ' /mo')}</small>` : ''}</div>
      ${desc ? `<p class="pv-desc">${esc(desc)}</p>` : ''}
      <ul class="pv-list">
        ${hi.map((f) => `<li>${icon('check')}<span>${esc(isFa() ? f.nameFa : f.nameEn)}: <b>${esc(fmtQuota(f, d.features[f.id]))}</b></span></li>`).join('')}
        <li>${icon('check')}<span>${tr(`${fmtNum(on)} از ${fmtNum(caps.length)} قابلیت ویژه`, `${fmtNum(on)} of ${fmtNum(caps.length)} ${plural(caps.length, 'capability', 'capabilities')}`)}</span></li>
      </ul>
      ${d.isActive ? '' : `<span class="badge b-amber" style="align-self:flex-start">${tr('در صفحه قیمت‌گذاری نمایش داده نمی‌شود', 'Hidden from the pricing page')}</span>`}
    </div>`;
}

// ── Validation ────────────────────────────────────────────────────────────
function setErr(key, msg) {
  if (msg) S.errors[key] = msg; else delete S.errors[key];
  const el = V?.querySelector(`[data-err="${CSS.escape(key)}"]`);
  if (el) { el.textContent = msg || ''; el.hidden = !msg; }
  const input = key.startsWith('f:')
    ? V?.querySelector(`[data-quota="${CSS.escape(key.slice(2))}"]`)
    : V?.querySelector(`#pf-${CSS.escape(key)}`);
  if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
}
function validateText(key) {
  const v = String(S.draft[key] || '').trim();
  if ((key === 'nameFa' || key === 'nameEn') && !v) {
    setErr(key, key === 'nameFa' ? tr('نام فارسی پلن الزامی است.', 'The Persian name is required.') : tr('نام انگلیسی پلن الزامی است.', 'The English name is required.'));
  } else setErr(key, null);
}
function validatePrices() {
  for (const key of ['priceUSD', 'priceYearlyUSD']) {
    const v = S.draft[key];
    if (!Number.isFinite(v)) setErr(key, tr('مبلغ را به‌صورت عدد وارد کنید (حداکثر دو رقم اعشار).', 'Enter a number (up to two decimals).'));
    else if (v < 0 || v > MAX_PRICE) setErr(key, tr(`مبلغ باید بین ۰ تا ${fmtNum(MAX_PRICE)} دلار باشد.`, `Amount must be between 0 and ${fmtNum(MAX_PRICE)} USD.`));
    else setErr(key, null);
  }
  const m = S.draft.priceUSD, y = S.draft.priceYearlyUSD;
  if (Number.isFinite(m) && Number.isFinite(y) && m === 0 && y > 0) {
    setErr('priceYearlyUSD', tr('برای پلن رایگان، قیمت سالانه نیز باید صفر باشد.', 'A free plan must also have a zero yearly price.'));
  }
}
function validateQuota(f) {
  const key = `f:${f.id}`;
  const v = S.draft.features[f.id];
  if (v === -1 && f.allowUnlimited !== false) { setErr(key, null); return; }
  if (!Number.isInteger(v) || v < f.min || v > f.max) {
    setErr(key, tr(`عدد صحیحی بین ${fmtNum(f.min)} تا ${fmtNum(f.max)} وارد کنید.`, `Enter a whole number from ${fmtNum(f.min)} to ${fmtNum(f.max)}.`));
  } else setErr(key, null);
}
function focusFirstError() {
  const key = Object.keys(S.errors)[0];
  if (!key) return;
  let input;
  if (key.startsWith('f:')) {
    input = V.querySelector(`[data-quota="${CSS.escape(key.slice(2))}"]`);
    if (!input) { // hidden by the feature filter: clear it and retry
      S.q = ''; S.onlyChanged = false; repaintFeatures();
      const qi = V.querySelector('#pf-q'); if (qi) qi.value = '';
      input = V.querySelector(`[data-quota="${CSS.escape(key.slice(2))}"]`);
    }
  } else input = V.querySelector(`#pf-${CSS.escape(key)}`);
  input?.scrollIntoView({ block: 'center' });
  input?.focus();
}

// ── Live chrome (no full repaint → focus is preserved) ───────────────────
function refreshChrome() {
  if (!V?.isConnected || !S.draft || S.mode !== 'editor') return;
  const ch = new Set(changedKeys());
  V.querySelectorAll('[data-chg]').forEach((el) => { el.hidden = !ch.has(el.dataset.chg); });
  V.querySelectorAll('[data-count]').forEach((el) => {
    const k = el.dataset.count;
    const n = String(S.draft[k] || '').length, max = TEXT_LIMITS[k];
    el.textContent = tr(`${fmtNum(n)} از ${fmtNum(max)} نویسه`, `${fmtNum(n)} of ${fmtNum(max)} characters`);
    el.dataset.near = String(n >= max * 0.9);
  });
  const title = V.querySelector('#pe-title');
  if (title) title.textContent = planLabel({ ...S.draft, id: S.sel });
  const dot = V.querySelector('#pe-dot');
  if (dot) dot.style.background = safeColor(S.draft.color);
  const pv = V.querySelector('#pf-preview');
  if (pv) pv.innerHTML = previewHtml();
  // yearly note
  const yn = V.querySelector('#pf-yearly-note');
  if (yn) {
    const m = S.draft.priceUSD, y = S.draft.priceYearlyUSD;
    let txt = '';
    if (Number.isFinite(m) && Number.isFinite(y) && m > 0 && y > 0) {
      const full = m * 12;
      if (y < full) txt = tr(`قیمت سالانه معادل ${fmtPct(1 - y / full)} تخفیف نسبت به ۱۲ ماه پرداخت ماهانه (${fmtMoney(full)}) است.`, `The yearly price is a ${fmtPct(1 - y / full)} discount vs 12 monthly payments (${fmtMoney(full)}).`);
      else if (y > full) txt = tr(`توجه: قیمت سالانه از ۱۲ برابر قیمت ماهانه (${fmtMoney(full)}) بیشتر است.`, `Note: the yearly price exceeds 12 monthly payments (${fmtMoney(full)}).`);
      else txt = tr('قیمت سالانه دقیقاً برابر ۱۲ ماه پرداخت ماهانه است (بدون تخفیف).', 'The yearly price equals 12 monthly payments (no discount).');
    } else if (Number.isFinite(m) && m > 0 && y === 0) {
      txt = tr('قیمت سالانه صفر است؛ گزینه پرداخت سالانه برای این پلن ارائه نمی‌شود.', 'Yearly price is zero; yearly billing will not be offered for this plan.');
    }
    yn.textContent = txt;
    yn.hidden = !txt;
  }
  // status hints
  const saved = S.data.plans[S.sel];
  const ah = V.querySelector('#pf-active-hint');
  const act = V.querySelector('#pf-active');
  if (ah && act) {
    const lockActive = saved.isDefault || S.draft.isDefault;
    act.disabled = lockActive;
    ah.textContent = lockActive
      ? tr('پلن پیش‌فرض همیشه باید فعال بماند.', 'The default plan must always stay active.')
      : tr('پلن غیرفعال در صفحه قیمت‌گذاری نمایش داده نمی‌شود و قابل انتخاب نیست؛ کاربران فعلی آن همچنان از امکاناتش استفاده می‌کنند.', 'An inactive plan is hidden from the pricing page and cannot be chosen; its current users keep their entitlements.');
  }
  const dh = V.querySelector('#pf-default-hint');
  if (dh) {
    const cur = Object.values(S.data.plans).find((p) => p.isDefault);
    dh.textContent = saved.isDefault
      ? tr('کاربران جدید پس از ثبت‌نام با این پلن شروع می‌کنند. برای تغییر، پلن دیگری را پیش‌فرض کنید.', 'New users start on this plan. To change it, make another plan the default.')
      : tr(`کاربران جدید پس از ثبت‌نام با پلن پیش‌فرض شروع می‌کنند (اکنون: «${cur ? planLabel(cur) : '—'}»).`, `New users start on the default plan (currently “${cur ? planLabel(cur) : '—'}”).`);
  }
  // feature summary
  const fsum = V.querySelector('#pf-fsum');
  if (fsum) {
    const caps = catalog().filter((f) => f.type !== 'numeric');
    const quotas = catalog().filter((f) => f.type === 'numeric');
    const on = caps.filter((f) => S.draft.features[f.id]).length;
    const unl = quotas.filter((f) => S.draft.features[f.id] === -1).length;
    fsum.textContent = tr(`${fmtNum(on)} از ${fmtNum(caps.length)} قابلیت فعال · ${fmtNum(quotas.length)} سقف مصرف${unl ? ` (${fmtNum(unl)} نامحدود)` : ''}`, `${fmtNum(on)} of ${fmtNum(caps.length)} ${plural(caps.length, 'capability', 'capabilities')} on · ${fmtNum(quotas.length)} ${plural(quotas.length, 'quota')}${unl ? ` (${fmtNum(unl)} unlimited)` : ''}`);
  }
  // save bar
  const dirty = ch.size > 0;
  const nErr = Object.keys(S.errors).length;
  const st = V.querySelector('#pe-state');
  if (st) {
    st.innerHTML = nErr
      ? `<span class="dirty-dot" style="background:var(--danger)"></span> ${tr(`${fmtNum(nErr)} مقدار نامعتبر باید اصلاح شود`, `${fmtNum(nErr)} invalid ${nErr === 1 ? 'value' : 'values'} to fix`)}`
      : dirty
        ? `<span class="dirty-dot"></span> ${tr(`${fmtNum(ch.size)} تغییر ذخیره‌نشده`, `${fmtNum(ch.size)} unsaved ${ch.size === 1 ? 'change' : 'changes'}`)}`
        : `<span class="save-ok">${icon('check')}${tr('همه تغییرات ذخیره شده است', 'All changes saved')}</span>`;
    st.closest('.sticky-save')?.setAttribute('data-clean', String(!dirty && !nErr));
  }
  const sv = V.querySelector('#pe-save');
  const ds = V.querySelector('#pe-discard');
  if (sv) sv.disabled = !dirty;
  if (ds) ds.disabled = !dirty;
  // list item for the selected plan mirrors the draft
  const item = V.querySelector(`.plan-item[data-plan="${CSS.escape(S.sel)}"]`);
  if (item && !item.contains(document.activeElement)) {
    const fresh = document.createElement('div');
    fresh.innerHTML = listItemsHtml();
    const repl = fresh.querySelector(`.plan-item[data-plan="${CSS.escape(S.sel)}"]`);
    if (repl) {
      item.replaceWith(repl);
      repl.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => pickPlan(b.dataset.pick)));
      repl.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => move(b.dataset.id, b.dataset.move)));
    }
  }
}

function repaintFeatures() {
  const host = V?.querySelector('#pf-features');
  if (!host) return;
  host.innerHTML = featuresHtml();
  wireFeatures();
  for (const key of Object.keys(S.errors)) setErr(key, S.errors[key]);
  refreshChrome();
}

// ── Editor wiring ─────────────────────────────────────────────────────────
function wireEditor() {
  if (!S.draft) return;
  V.querySelector('#pe-back')?.addEventListener('click', () => {
    S.mobile = 'list';
    paint();
    window.scrollTo(0, 0);
    V.querySelector(`[data-pick="${CSS.escape(S.sel)}"]`)?.focus();
  });
  V.querySelector('#pe-clone')?.addEventListener('click', () => newPlanDialog(S.sel));
  V.querySelector('#pe-delete')?.addEventListener('click', deleteDialog);
  V.querySelectorAll('[data-text]').forEach((el) => {
    const key = el.dataset.text;
    el.addEventListener('input', () => { S.draft[key] = el.value; if (S.errors[key]) validateText(key); refreshChrome(); });
    el.addEventListener('blur', () => { S.draft[key] = el.value.trim(); if (el.value !== S.draft[key]) el.value = S.draft[key]; validateText(key); refreshChrome(); });
  });
  V.querySelectorAll('[data-price]').forEach((el) => {
    const key = el.dataset.price;
    el.addEventListener('input', () => {
      S.raw[key] = el.value;
      S.draft[key] = parsePrice(el.value);
      validatePrices();
      refreshChrome();
    });
    el.addEventListener('blur', () => {
      if (Number.isFinite(S.draft[key])) { delete S.raw[key]; el.value = plainNum(S.draft[key]); }
    });
  });
  V.querySelectorAll('.swatch[data-color]').forEach((b) => b.addEventListener('click', () => setColor(b.dataset.color)));
  const custom = V.querySelector('#pf-color-custom');
  custom?.addEventListener('input', () => setColor(custom.value));
  V.querySelector('#pf-active')?.addEventListener('change', (e) => { S.draft.isActive = e.target.checked; refreshChrome(); });
  V.querySelector('#pf-default')?.addEventListener('change', (e) => {
    S.draft.isDefault = e.target.checked;
    if (S.draft.isDefault && !S.draft.isActive) {
      S.draft.isActive = true;
      const a = V.querySelector('#pf-active'); if (a) a.checked = true;
    }
    refreshChrome();
  });
  let tmr = null;
  V.querySelector('#pf-q')?.addEventListener('input', (e) => {
    clearTimeout(tmr);
    tmr = setTimeout(() => { S.q = e.target.value; repaintFeatures(); }, 160);
  });
  V.querySelectorAll('[data-fmode]').forEach((b) => b.addEventListener('click', () => {
    S.onlyChanged = b.dataset.fmode === 'changed';
    V.querySelectorAll('[data-fmode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    repaintFeatures();
  }));
  V.querySelector('#pe-discard')?.addEventListener('click', () => {
    discardDraft();
    paint();
    toast(tr('تغییرات ذخیره‌نشده کنار گذاشته شد.', 'Unsaved changes discarded.'), 'info');
  });
  V.querySelector('#pe-save')?.addEventListener('click', save);
  wireFeatures();
}

function wireFeatures() {
  V.querySelectorAll('[data-bool]').forEach((el) => el.addEventListener('change', () => {
    S.draft.features[el.dataset.bool] = el.checked;
    el.closest('.feat')?.classList.toggle('on', el.checked);
    refreshChrome();
  }));
  V.querySelectorAll('[data-quota]').forEach((el) => {
    const f = catalog().find((x) => x.id === el.dataset.quota);
    if (!f) return;
    el.addEventListener('input', () => {
      S.raw[`f:${f.id}`] = el.value;
      S.draft.features[f.id] = parseQuota(el.value);
      validateQuota(f);
      refreshChrome();
    });
    el.addEventListener('blur', () => {
      if (!S.errors[`f:${f.id}`] && Number.isFinite(S.draft.features[f.id])) { delete S.raw[`f:${f.id}`]; el.value = plainNum(S.draft.features[f.id]); }
    });
  });
  V.querySelectorAll('[data-unl]').forEach((cb) => cb.addEventListener('change', () => {
    const f = catalog().find((x) => x.id === cb.dataset.unl);
    if (!f) return;
    const input = V.querySelector(`[data-quota="${CSS.escape(f.id)}"]`);
    if (cb.checked) {
      S.draft.features[f.id] = -1;
      delete S.raw[`f:${f.id}`];
      if (input) { input.value = ''; input.placeholder = '∞'; input.disabled = true; }
    } else {
      const o = snapshot().features[f.id];
      const back = o !== -1 && Number.isFinite(o) ? o : f.max;
      S.draft.features[f.id] = back;
      if (input) { input.disabled = false; input.placeholder = ''; input.value = plainNum(back); input.focus(); input.select(); }
    }
    validateQuota(f);
    refreshChrome();
  }));
}

function setColor(c) {
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) return;
  S.draft.color = c;
  V.querySelectorAll('.swatch[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color.toLowerCase() === c.toLowerCase())));
  const known = SWATCHES.some((s) => s.toLowerCase() === c.toLowerCase());
  V.querySelector('.swatch-custom')?.setAttribute('data-on', String(!known));
  const hex = V.querySelector('#pf-color-hex'); if (hex) hex.textContent = c;
  const custom = V.querySelector('#pf-color-custom'); if (custom && custom.value.toLowerCase() !== c.toLowerCase()) custom.value = c;
  refreshChrome();
}

// ── Save ──────────────────────────────────────────────────────────────────
function serverErrorText(er) {
  if (er.code === 'required') return tr('این فیلد الزامی است.', 'This field is required.');
  if (er.code === 'out_of_range' && er.min !== undefined) return tr(`مقدار باید بین ${fmtNum(er.min)} تا ${fmtNum(er.max)} باشد.`, `Value must be between ${fmtNum(er.min)} and ${fmtNum(er.max)}.`);
  if (er.code === 'too_long') return tr(`حداکثر ${fmtNum(er.max)} نویسه مجاز است.`, `At most ${fmtNum(er.max)} characters.`);
  return tr('مقدار نامعتبر است.', 'Invalid value.');
}

async function save() {
  if (!plansDirty()) return;
  for (const k of ['nameFa', 'nameEn']) validateText(k);
  validatePrices();
  for (const f of catalog()) if (f.type === 'numeric') validateQuota(f);
  refreshChrome();
  if (Object.keys(S.errors).length) {
    toast(tr('ابتدا مقادیر نامعتبر را اصلاح کنید.', 'Please fix the invalid values first.'), 'error');
    focusFirstError();
    return;
  }
  const o = snapshot();
  const id = S.sel;
  const users = S.data.userCounts?.[id] || 0;
  if (S.draft.isDefault && !o.isDefault) {
    const cur = Object.values(S.data.plans).find((p) => p.isDefault);
    const ok = await confirmDialog({
      title: tr('تغییر پلن پیش‌فرض', 'Change the default plan'),
      body: `<p style="margin:0">${tr(`از این پس کاربران جدید به‌جای «${esc(cur ? planLabel(cur) : '—')}» با پلن «${esc(planLabel({ ...S.draft, id }))}» شروع می‌کنند. پلن کاربران فعلی تغییر نمی‌کند.`, `New users will start on “${esc(planLabel({ ...S.draft, id }))}” instead of “${esc(cur ? planLabel(cur) : '—')}”. Existing users keep their plans.`)}</p>`,
      confirmText: tr('تأیید و ذخیره', 'Confirm & save')
    });
    if (!ok) return;
  }
  if (!S.draft.isActive && o.isActive && users > 0) {
    const ok = await confirmDialog({
      title: tr('غیرفعال‌سازی پلن دارای کاربر', 'Deactivate a plan with users'),
      body: `<p style="margin:0">${tr(`این پلن از صفحه قیمت‌گذاری حذف می‌شود و دیگر قابل انتخاب نیست. ${fmtNum(users)} کاربر فعلی آن همچنان روی همین پلن می‌مانند.`, `The plan will be removed from the pricing page and can no longer be chosen. Its ${fmtNum(users)} current ${plural(users, 'user')} ${plural(users, 'stays', 'stay')} on it.`)}</p>`,
      confirmText: tr('غیرفعال‌سازی و ذخیره', 'Deactivate & save'), danger: true
    });
    if (!ok) return;
  }
  const btn = V.querySelector('#pe-save');
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span><span>${tr('در حال ذخیره…', 'Saving…')}</span>`; }
  const body = { ...S.draft, nameFa: S.draft.nameFa.trim(), nameEn: S.draft.nameEn.trim() };
  try {
    await api(`/api/admin/plans/${encodeURIComponent(id)}`, { method: 'PUT', body });
    await load();
    startDraft();
    paint();
    toast(tr(`تغییرات پلن «${planLabel({ ...S.data.plans[id], id })}» ذخیره شد.`, `“${planLabel({ ...S.data.plans[id], id })}” saved.`));
  } catch (e) {
    if (btn) { btn.innerHTML = label; btn.disabled = false; }
    if (e.data?.error === 'plan_not_found') {
      toast(errMsg(e), 'error');
      S.draft = null; S.orig = null; S.sel = null;
      await load().catch(() => {}); startDraft(); paint();
      return;
    }
    if (Array.isArray(e.data?.errors)) {
      for (const er of e.data.errors) {
        const key = String(er.field || '').startsWith('features.') ? `f:${er.field.slice(9)}` : er.field;
        if (key) setErr(key, serverErrorText(er));
      }
      refreshChrome();
      focusFirstError();
    }
    toast(errMsg(e), 'error');
  }
}

// ── Dialogs: new / duplicate, delete, reset ───────────────────────────────
async function newPlanDialog(sourceId = '') {
  if (!(await confirmLeavePlans())) return;
  const { plans, planOrder } = S.data;
  const src = sourceId && plans[sourceId] ? plans[sourceId] : null;
  const opts = planOrder.map((id) => `<option value="${esc(id)}" ${id === sourceId ? 'selected' : ''}>${esc(planLabel({ ...plans[id], id }))}</option>`).join('');
  const res = await openDialog({
    title: src ? tr('تکثیر پلن', 'Duplicate plan') : tr('ایجاد پلن جدید', 'Create a new plan'),
    iconName: src ? 'copy' : 'plus',
    confirmText: src ? tr('ایجاد نسخه تکثیری', 'Create duplicate') : tr('ایجاد پلن', 'Create plan'),
    body: `
      <div class="field"><label for="np-id">${tr('شناسه پلن', 'Plan ID')}</label>
        <input id="np-id" class="input ltr" maxlength="32" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="pro-team" aria-describedby="np-id-h" />
        <span class="hint" id="np-id-h">${tr('۲ تا ۳۲ نویسه شامل حروف کوچک انگلیسی، رقم، خط‌تیره یا زیرخط؛ پس از ایجاد قابل تغییر نیست.', '2–32 lowercase letters, digits, hyphens, or underscores; cannot be changed later.')}</span></div>
      <div class="form-grid-2">
        <div class="field"><label for="np-fa">${tr('نام فارسی', 'Persian name')}</label><input id="np-fa" class="input" dir="rtl" maxlength="40" autocomplete="off" value="${src ? esc(`${src.nameFa} (نسخه دوم)`.slice(0, 40)) : ''}" /></div>
        <div class="field"><label for="np-en">${tr('نام انگلیسی', 'English name')}</label><input id="np-en" class="input" dir="ltr" maxlength="40" autocomplete="off" value="${src ? esc(`${src.nameEn} (Copy)`.slice(0, 40)) : ''}" /></div>
      </div>
      <div class="field"><label for="np-src">${tr('مقادیر اولیه امکانات و قیمت', 'Start features & pricing from')}</label>
        <select id="np-src" class="select"><option value="">${tr('مقادیر پیش‌فرض کاتالوگ امکانات', 'Feature catalog defaults')}</option>${opts}</select></div>
      <div class="alert alert-info">${icon('info')}<div>${tr('پلن جدید غیرفعال ایجاد می‌شود تا پس از تکمیل تنظیمات، آن را برای کاربران فعال کنید.', 'The new plan is created inactive so you can finish configuring it before users see it.')}</div></div>`,
    onOpen: (dlg) => {
      const idIn = dlg.querySelector('#np-id');
      idIn.addEventListener('input', () => {
        const v = idIn.value.toLowerCase().replace(/\s+/g, '-');
        if (v !== idIn.value) idIn.value = v;
        idIn.removeAttribute('aria-invalid');
      });
    },
    onConfirm: async (dlg) => {
      const id = dlg.querySelector('#np-id').value.trim().toLowerCase();
      const nameFa = dlg.querySelector('#np-fa').value.trim();
      const nameEn = dlg.querySelector('#np-en').value.trim();
      const from = dlg.querySelector('#np-src').value;
      const bad = (sel, msg) => { const el = dlg.querySelector(sel); el.setAttribute('aria-invalid', 'true'); el.focus(); throw new Error(msg); };
      if (!PLAN_ID_RE.test(id)) bad('#np-id', errMsg({ data: { error: 'invalid_plan_id' } }));
      if (plans[id]) bad('#np-id', errMsg({ data: { error: 'plan_exists' } }));
      if (!nameFa) bad('#np-fa', tr('نام فارسی پلن الزامی است.', 'The Persian name is required.'));
      if (!nameEn) bad('#np-en', tr('نام انگلیسی پلن الزامی است.', 'The English name is required.'));
      if (from) await api('/api/admin/plans/clone', { method: 'POST', body: { sourceId: from, newId: id, nameFa, nameEn } });
      else await api('/api/admin/plans', { method: 'POST', body: { id, nameFa, nameEn, isActive: false, isDefault: false } });
      return id;
    }
  });
  if (!res) return;
  try { await load(); } catch (e) { toast(errMsg(e), 'error'); return; }
  S.sel = res;
  S.mode = 'editor';
  S.mobile = 'editor';
  S.q = ''; S.onlyChanged = false;
  startDraft();
  paint();
  window.scrollTo(0, 0);
  toast(tr('پلن جدید ایجاد شد؛ پس از تکمیل تنظیمات، آن را فعال کنید.', 'Plan created; activate it once it is configured.'));
}

async function deleteDialog() {
  const id = S.sel;
  const p = S.data.plans[id];
  if (!p || p.isDefault || isBuiltin(id)) return;
  if (!(await confirmLeavePlans())) return;
  const users = S.data.userCounts?.[id] || 0;
  const def = Object.values(S.data.plans).find((x) => x.isDefault);
  const res = await openDialog({
    title: tr('حذف دائمی پلن', 'Delete plan permanently'),
    danger: true, confirmDisabled: true, confirmText: tr('حذف پلن', 'Delete plan'),
    body: `
      <p style="margin:0">${tr(`پلن «${esc(planLabel({ ...p, id }))}» برای همیشه حذف می‌شود.`, `“${esc(planLabel({ ...p, id }))}” will be permanently deleted.`)}</p>
      ${users ? `<div class="alert alert-warn">${icon('users')}<div>${tr(`${fmtNum(users)} کاربر این پلن به پلن پیش‌فرض «${esc(def ? planLabel(def) : '—')}» منتقل می‌شوند.`, `${fmtNum(users)} ${users === 1 ? 'user' : 'users'} on this plan will be moved to the default plan “${esc(def ? planLabel(def) : '—')}”.`)}</div></div>` : ''}
      <div class="field"><label for="dp-confirm">${tr('برای تأیید، شناسه پلن را تایپ کنید:', 'Type the plan ID to confirm:')} <span class="mono ltr">${esc(id)}</span></label><input id="dp-confirm" class="input ltr" autocomplete="off" spellcheck="false" autocapitalize="off" /></div>`,
    onOpen: (dlg, ok) => dlg.querySelector('#dp-confirm').addEventListener('input', (e) => { ok.disabled = e.target.value.trim() !== id; }),
    onConfirm: async () => api(`/api/admin/plans/${encodeURIComponent(id)}`, { method: 'DELETE' })
  });
  if (!res) return;
  S.sel = null;
  try { await load(); } catch (e) { /* keep going */ }
  startDraft();
  S.mobile = 'list';
  paint();
  toast(res.migratedUsers
    ? tr(`پلن حذف شد و ${fmtNum(res.migratedUsers)} کاربر به پلن پیش‌فرض منتقل شدند.`, `Plan deleted; ${fmtNum(res.migratedUsers)} ${plural(res.migratedUsers, 'user')} moved to the default plan.`)
    : tr('پلن حذف شد.', 'Plan deleted.'));
}

async function resetDialog() {
  if (!(await confirmLeavePlans())) return;
  const word = tr('بازنشانی', 'RESET');
  const custom = S.data.planOrder.filter((id) => !isBuiltin(id));
  const res = await openDialog({
    title: tr('بازنشانی همه پلن‌ها', 'Reset all plans'),
    danger: true, confirmDisabled: true, confirmText: tr('بازنشانی پلن‌ها', 'Reset plans'),
    body: `
      <p style="margin:0">${tr('قیمت، امکانات و ترتیب همه پلن‌ها به مقادیر اولیه سامانه برمی‌گردد.', 'Pricing, capabilities, and order of all plans return to the system defaults.')}</p>
      ${custom.length ? `<div class="alert alert-warn">${icon('alert')}<div>${tr(`پلن‌های سفارشی (${custom.map((x) => esc(x)).join('، ')}) حذف و کاربرانشان به پلن پیش‌فرض منتقل می‌شوند.`, `Custom plans (${custom.map((x) => esc(x)).join(', ')}) will be deleted and their users moved to the default plan.`)}</div></div>` : ''}
      <div class="field"><label for="rp-confirm">${tr(`برای تأیید، عبارت «${word}» را تایپ کنید`, `Type “${word}” to confirm`)}</label><input id="rp-confirm" class="input" autocomplete="off" /></div>`,
    onOpen: (dlg, ok) => dlg.querySelector('#rp-confirm').addEventListener('input', (e) => { ok.disabled = e.target.value.trim() !== word; }),
    onConfirm: async () => api('/api/admin/plans/reset', { method: 'POST' })
  });
  if (!res) return;
  try { await load(); } catch (e) { /* ignore */ }
  startDraft();
  paint();
  toast(tr('پلن‌ها به مقادیر اولیه سامانه بازنشانی شدند.', 'Plans were reset to the system defaults.'));
}

// ── Comparison matrix ─────────────────────────────────────────────────────
function matrixHtml() {
  const { plans, planOrder } = S.data;
  const cats = [...(S.data.categories || [])];
  const known = new Set(cats.map((c) => c.id));
  if (catalog().some((f) => !known.has(f.category))) cats.push({ id: '__other', nameFa: 'سایر امکانات', nameEn: 'Other' });
  const cell = (f, v) => {
    if (f.type !== 'numeric') {
      return v
        ? `<span class="mx-yes">${icon('check')}<span class="sr-only">${tr('دارد', 'Included')}</span></span>`
        : `<span class="mx-no" aria-hidden="true">—</span><span class="sr-only">${tr('ندارد', 'Not included')}</span>`;
    }
    return v === -1 ? `<span class="badge b-green">${tr('نامحدود', 'Unlimited')}</span>` : esc(fmtNum(v));
  };
  const rows = cats.map((c) => {
    const fs = catalog().filter((f) => (c.id === '__other' ? !known.has(f.category) : f.category === c.id));
    if (!fs.length) return '';
    return `<tr class="mx-cat"><th colspan="${planOrder.length + 1}" scope="colgroup"><span class="mx-cat-label">${icon(CAT_ICON[c.id] || 'plans')}<span>${esc(isFa() ? c.nameFa : c.nameEn)}</span></span></th></tr>
      ${fs.map((f) => `<tr><th scope="row"><span class="mx-name">${esc(isFa() ? f.nameFa : f.nameEn)}</span>${f.type === 'numeric' ? `<span class="mx-unit">${esc(isFa() ? f.unitFa : f.unitEn)}</span>` : ''}</th>${planOrder.map((id) => `<td>${cell(f, plans[id].features?.[f.id])}</td>`).join('')}</tr>`).join('')}`;
  }).join('');
  return `
    ${plansDirty() ? `<div class="alert alert-warn">${icon('info')}<div>${tr('این جدول مقادیر ذخیره‌شده را نشان می‌دهد؛ تغییرات ذخیره‌نشده پلن جاری در آن لحاظ نشده است.', 'This table shows saved values; unsaved changes to the current plan are not included.')}</div></div>` : ''}
    <section class="card">
      <div class="table-wrap mx-wrap">
        <table class="tbl matrix">
          <thead><tr><th scope="col">${tr('امکان', 'Feature')}</th>${planOrder.map((id) => {
            const p = plans[id];
            return `<th scope="col"><button type="button" class="mx-plan" data-open="${esc(id)}" title="${tr('ویرایش این پلن', 'Edit this plan')}"><span class="mx-plan-name"><span class="dot" style="background:${safeColor(p.color)}"></span>${esc(planLabel({ ...p, id }))}</span><span class="mx-plan-price">${esc(priceLabel(p.priceUSD))}${Number(p.priceUSD) > 0 ? tr(' / ماه', ' /mo') : ''}</span>${p.isActive === false ? `<span class="badge b-amber">${tr('غیرفعال', 'Inactive')}</span>` : ''}</button></th>`;
          }).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}
function wireMatrix() {
  V.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.open;
    if (id !== S.sel && !(await confirmLeavePlans())) return;
    if (id !== S.sel) { S.sel = id; startDraft(); }
    S.mode = 'editor';
    S.mobile = 'editor';
    paint();
    window.scrollTo(0, 0);
  }));
}

// ── Keyboard: Ctrl/Cmd+S saves the plan being edited ─────────────────────
function bindKeys() {
  if (keysBound) return;
  keysBound = true;
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || String(e.key).toLowerCase() !== 's') return;
    if (!V?.isConnected || C?.app?.section !== 'plans' || S.mode !== 'editor') return;
    if (document.querySelector('.dialog-wrap')) return;
    e.preventDefault();
    if (plansDirty()) save();
  });
}
