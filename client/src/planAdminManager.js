// client/src/planAdminManager.js
// Visual Subscription & Entitlements Management Studio for TradingChart
// Senior Product Designer & QA Lead standard: unlimited custom plans, granular feature toggles,
// live preview, drag/reorder, clone, delete, responsive mobile/desktop, formal Persian & English.

import { getLanguage, t, toPersianDigits } from './i18n.js';
import { FEATURES_CATALOG, CATEGORIES } from '../../server/featuresCatalog.js';

const MASTER_KEY_STORAGE = 'tradingchart_admin_key';
const DEFAULT_MASTER_KEY = 'tradingchart_master_nexus';

export class PlanAdminManager {
  constructor(app, authManager) {
    this.app = app;
    this.auth = authManager;
    this.plans = {};
    this.planOrder = [];
    this.catalog = FEATURES_CATALOG;
    this.selectedPlanId = 'basic';
    this.activeTab = 'general';
    this.searchTerm = '';
    this.pendingPlan = null;
    this.isDirty = false;
    this.mobileView = 'list';
  }

  isFa() {
    return getLanguage() === 'fa' || document.documentElement.getAttribute('dir') === 'rtl' || document.body.classList.contains('persian-mode');
  }

  getMasterKey() {
    return sessionStorage.getItem(MASTER_KEY_STORAGE) || localStorage.getItem(MASTER_KEY_STORAGE) || '';
  }

  setMasterKey(key) {
    sessionStorage.setItem(MASTER_KEY_STORAGE, key);
    localStorage.setItem(MASTER_KEY_STORAGE, key);
  }

  clearMasterKey() {
    sessionStorage.removeItem(MASTER_KEY_STORAGE);
    localStorage.removeItem(MASTER_KEY_STORAGE);
  }

  async api(endpoint, options = {}) {
    const key = this.getMasterKey();
    const headers = {
      'Content-Type': 'application/json',
      ...(key ? { 'X-Master-Key': key } : {}),
      ...(options.headers || {})
    };
    const res = await fetch(endpoint, {
      ...options,
      credentials: 'same-origin',
      headers
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, status: res.status, data };
  }

  async checkAccess() {
    if (this.auth?.user?.role === 'admin' || this.auth?.user?.isAdmin === true) return true;
    const key = this.getMasterKey();
    if (!key) return false;
    const r = await this.api('/api/admin/plans');
    return r.ok;
  }

  openCustomModal({ title, icon = '⚙️', bodyHtml, confirmText, confirmClass = 'btn-primary', onConfirm, isDanger = false }) {
    const isFa = this.isFa();
    document.querySelector('#tc-custom-dialog-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'tc-custom-dialog-modal';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(6px); z-index:100020; display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;';
    overlay.innerHTML = `
      <div class="modal-box tc-custom-dialog-box" dir="${isFa ? 'rtl' : 'ltr'}" style="width:min(440px, 94vw); background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:14px; box-shadow:0 20px 50px rgba(0,0,0,0.7); ${isFa ? 'direction:rtl;' : 'direction:ltr;'}">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">${icon}</span>
            <strong style="font-size:14px; color:#fff;">${escapeHtml(title)}</strong>
          </div>
          <button data-close-dialog style="background:none; border:none; color:var(--text-dim); font-size:16px; cursor:pointer;">✕</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${bodyHtml}
        </div>
        <div id="tc-cd-err" style="display:none; color:#f87171; font-size:11px; line-height:1.5;"></div>
        <div style="display:flex; gap:8px; justify-content:flex-end; padding-top:4px;">
          <button data-close-dialog style="padding:8px 14px; border-radius:7px; border:1px solid var(--border-subtle); background:transparent; color:var(--text-dim); font-size:11px; font-weight:700; cursor:pointer;">
            ${isFa ? 'انصراف' : 'Cancel'}
          </button>
          <button id="tc-cd-confirm" class="${confirmClass}" style="padding:8px 18px; border-radius:7px; font-size:11px; font-weight:800; cursor:pointer; ${isDanger ? 'background:#ef4444; color:#fff; border:none;' : 'background:var(--accent-cyan,#00F2B0); color:#04121e; border:none;'}">
            ${escapeHtml(confirmText || (isFa ? 'تأیید' : 'Confirm'))}
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-close-dialog]').forEach(b => b.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#tc-cd-confirm')?.addEventListener('click', async () => {
      const errBox = overlay.querySelector('#tc-cd-err');
      try {
        const ok = await onConfirm(overlay, errBox);
        if (ok !== false) close();
      } catch (err) {
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = err.message || String(err);
        }
      }
    });

    const firstInput = overlay.querySelector('input, select');
    setTimeout(() => firstInput?.focus(), 50);
  }

  async promptMasterKey() {
    return new Promise((resolve) => {
      document.querySelector('#tc-master-key-modal')?.remove();
      const isFa = this.isFa();
      const overlay = document.createElement('div');
      overlay.id = 'tc-master-key-modal';
      overlay.className = 'modal-overlay open';
      overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); z-index:100010; display:flex; align-items:center; justify-content:center;';

      overlay.innerHTML = `
        <div class="modal-box" style="width:min(440px, 94vw); background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle, rgba(255,255,255,0.1)); border-radius:14px; padding:22px; display:flex; flex-direction:column; gap:16px; ${isFa ? 'direction:rtl;' : 'direction:ltr;'}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">🔐</span>
              <strong style="font-size:14px; color:#fff;">${isFa ? 'دسترسی مدیریت پلن‌ها' : 'Plans Management Gate'}</strong>
            </div>
            <button data-close style="background:none; border:none; color:var(--text-dim,#8b93a7); font-size:16px; cursor:pointer;">✕</button>
          </div>
          <div style="font-size:12px; color:var(--text-dim,#8b93a7); line-height:1.6;">
            ${isFa
              ? 'برای دسترسی به استودیوی طراحی و ویرایش نامحدود پلن‌های اشتراک، کلید اصلی مسترکی (Master Key) سیستم را وارد نمایید:'
              : 'Enter the system Master Key to access the visual plan customizer and subscription studio:'}
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <input type="password" id="tc-mk-input" placeholder="${isFa ? 'کلید اصلی مسترکی' : 'Master Key'}"
              style="padding:10px 12px; font-size:13px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:8px; color:#fff; outline:none; direction:ltr; text-align:left;" />
            <div id="tc-mk-err" style="display:none; color:#f87171; font-size:11px;"></div>
          </div>
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button data-close style="padding:8px 14px; border-radius:8px; border:1px solid var(--border-subtle); background:transparent; color:var(--text-dim); font-size:12px; font-weight:700; cursor:pointer;">${isFa ? 'انصراف' : 'Cancel'}</button>
            <button id="tc-mk-submit" class="btn-primary" style="padding:8px 16px; border-radius:8px; background:var(--accent-cyan,#00F2B0); color:#04121e; border:none; font-size:12px; font-weight:800; cursor:pointer;">${isFa ? 'ورود به استودیو' : 'Unlock Studio'}</button>
          </div>
        </div>`;

      document.body.appendChild(overlay);
      const input = overlay.querySelector('#tc-mk-input');
      const err = overlay.querySelector('#tc-mk-err');
      input?.focus();

      const close = (val = false) => {
        overlay.remove();
        resolve(val);
      };

      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close(false)));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

      const submit = async () => {
        const val = input.value.trim();
        if (!val) {
          err.style.display = 'block';
          err.textContent = isFa ? 'لطفاً کلید مسترکی را وارد نمایید.' : 'Please enter the master key.';
          return;
        }
        // Test key with auth endpoint
        this.setMasterKey(val);
        const r = await this.api('/api/admin/auth', { method: 'POST', body: JSON.stringify({ masterKey: val }) });
        if (r.ok) {
          if (this.auth?.user) {
            this.auth.user.role = 'admin';
            this.auth.user.isAdmin = true;
          }
          close(true);
        } else {
          this.clearMasterKey();
          err.style.display = 'block';
          err.textContent = isFa ? 'کلید واردشده نادرست است. دسترسی مجاز نیست.' : 'Invalid master key. Access denied.';
        }
      };

      overlay.querySelector('#tc-mk-submit')?.addEventListener('click', submit);
      input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    });
  }

  async open(selectedPlanId = null) {
    const hasAccess = await this.checkAccess();
    if (!hasAccess) {
      const unlocked = await this.promptMasterKey();
      if (!unlocked) return;
    }

    this.mobileView = 'list';
    await this.fetchData();
    if (selectedPlanId && this.plans[selectedPlanId]) {
      this.selectedPlanId = selectedPlanId;
    } else if (!this.plans[this.selectedPlanId] && this.planOrder.length > 0) {
      this.selectedPlanId = this.planOrder[0];
    }

    this.initPendingPlan();
    this.render();
  }

  async fetchData() {
    const r = await this.api('/api/admin/plans');
    if (r.ok) {
      this.plans = r.data.plans || {};
      this.planOrder = r.data.planOrder || Object.keys(this.plans);
      if (r.data.catalog) this.catalog = r.data.catalog;
    }
  }

  setDirty(val = true) {
    this.isDirty = val;
    const saveBtn = document.querySelector('#tc-pa-save');
    if (saveBtn) {
      const isFa = this.isFa();
      saveBtn.innerHTML = `<span>💾</span><span>${isFa ? (val ? 'ذخیره تغییرات ●' : 'ذخیره تغییرات') : (val ? 'Save Changes ●' : 'Save Changes')}</span>`;
      saveBtn.style.boxShadow = val ? '0 0 14px rgba(0,242,176,0.6)' : 'none';
    }
  }

  initPendingPlan() {
    const cur = this.plans[this.selectedPlanId];
    if (cur) {
      this.pendingPlan = JSON.parse(JSON.stringify(cur));
      this.setDirty(false);
    } else {
      this.pendingPlan = null;
    }
  }

  render() {
    document.querySelector('#tc-plan-admin-modal')?.remove();
    const isFa = this.isFa();
    const overlay = document.createElement('div');
    overlay.id = 'tc-plan-admin-modal';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); z-index:100005; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box;';

    overlay.innerHTML = `
      <style>
        @media (max-width: 900px) {
          .tc-pa-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 768px) {
          .tc-plan-admin-box {
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            border: none !important;
          }
          #tc-pa-sidebar {
            width: 100% !important;
            border: none !important;
          }
          #tc-pa-editor-wrap {
            width: 100% !important;
          }
          .tc-mobile-hide-sidebar #tc-pa-sidebar {
            display: none !important;
          }
          .tc-mobile-hide-editor #tc-pa-editor-wrap {
            display: none !important;
          }
          .tc-pa-mobile-back {
            display: inline-flex !important;
          }
        }
        @media (min-width: 769px) {
          #tc-pa-sidebar { display: flex !important; width: 310px !important; }
          #tc-pa-editor-wrap { display: flex !important; }
          .tc-pa-mobile-back { display: none !important; }
        }
        @media (max-width: 520px) {
          .tc-pa-grid-4 { grid-template-columns: 1fr !important; }
        }
      </style>
      <div class="modal-box tc-plan-admin-box" dir="${isFa ? 'rtl' : 'ltr'}" style="width:min(1180px, 98vw); height:min(88vh, 880px); background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle, rgba(255,255,255,0.1)); border-radius:14px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,0.6); ${isFa ? 'direction:rtl;' : 'direction:ltr;'}">
        <!-- Studio Header -->
        <div style="padding:14px 18px; background:var(--bg-surface,#0c1017); border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-shrink:0; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px;">⚙️</span>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <strong style="font-size:15px; color:#fff;">${isFa ? 'استودیوی جامع مدیریت پلن‌ها و سطوح دسترسی' : 'Subscription Plans & Entitlements Studio'}</strong>
                <span style="font-size:9px; background:rgba(0,242,176,0.12); color:var(--accent-cyan,#00F2B0); border:1px solid rgba(0,242,176,0.3); border-radius:12px; padding:2px 8px; font-weight:800;">${isFa ? 'نامحدود' : 'UNLIMITED TIERS'}</span>
              </div>
              <div style="font-size:11px; color:var(--text-dim,#8b93a7); margin-top:2px;">
                ${isFa ? 'تعریف پلن‌های اشتراک دلخواه، سقف‌های عددی و فعال/غیرفعال‌سازی تک‌تک فیچرهای پلتفرم' : 'Define unlimited tiers, configure numeric limits, and toggle individual feature flags'}
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button id="tc-pa-new-plan" style="padding:7px 12px; border-radius:8px; background:var(--accent-cyan,#00F2B0); color:#04121e; border:none; font-size:11px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
              <span>+</span><span>${isFa ? 'تعریف پلن جدید' : 'Create New Plan'}</span>
            </button>
            <button id="tc-pa-reset" title="${isFa ? 'بازنشانی به پلن‌های پیش‌فرض' : 'Reset to seed plans'}" style="padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.06); color:var(--text-dim); border:1px solid var(--border-subtle); font-size:11px; font-weight:700; cursor:pointer;">
              🔄 ${isFa ? 'پیش‌فرض' : 'Reset'}
            </button>
            <button data-close style="background:none; border:none; color:var(--text-dim,#8b93a7); font-size:18px; cursor:pointer; padding:4px 8px;">✕</button>
          </div>
        </div>

        <!-- Studio Main Body (Sidebar + Editor) -->
        <div class="tc-pa-main-body ${this.mobileView === 'editor' ? 'tc-mobile-hide-sidebar' : 'tc-mobile-hide-editor'}" style="display:flex; flex:1; min-height:0; overflow:hidden;">
          <!-- Left Sidebar: Plans list -->
          <div id="tc-pa-sidebar" style="width:310px; flex-shrink:0; background:rgba(12,16,23,0.6); border-${isFa ? 'left' : 'right'}:1px solid var(--border-subtle); display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:10px 12px; border-bottom:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:8px;">
              <input type="text" id="tc-pa-search" placeholder="${isFa ? 'جستجوی پلن...' : 'Search plans...'}" value="${escapeHtml(this.searchTerm)}"
                style="padding:7px 10px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; outline:none; width:100%; box-sizing:border-box;" />
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:var(--text-dim);">
                <span>${isFa ? `${toPersianDigits(String(this.planOrder.length))} پلن پیکربندی‌شده` : `${this.planOrder.length} plans configured`}</span>
                <span>${isFa ? 'ترتیب صعودی سطح' : 'Ascending tier order'}</span>
              </div>
            </div>
            <div id="tc-pa-plans-list" style="flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:6px;">
              <!-- Populated by renderPlansList() -->
            </div>
          </div>

          <!-- Right Workspace: Plan Editor -->
          <div id="tc-pa-editor-wrap" style="flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; background:var(--bg-card,#151c2d);">
            <!-- Populated by renderEditor() -->
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('[data-close]')?.addEventListener('click', () => {
      if (this.isDirty) {
        if (!confirm(isFa ? 'تغییرات ذخیره‌نشده‌ای دارید. آیا مطمئن به بستن پنجره هستید؟' : 'You have unsaved changes. Are you sure you want to close?')) {
          return;
        }
      }
      overlay.remove();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (this.isDirty) {
          if (!confirm(isFa ? 'تغییرات ذخیره‌نشده‌ای دارید. آیا مطمئن به بستن پنجره هستید؟' : 'You have unsaved changes. Are you sure you want to close?')) {
            return;
          }
        }
        overlay.remove();
      }
    });

    overlay.querySelector('#tc-pa-search')?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.renderPlansList(overlay);
    });

    overlay.querySelector('#tc-pa-new-plan')?.addEventListener('click', () => {
      this.promptNewPlan(overlay);
    });

    overlay.querySelector('#tc-pa-reset')?.addEventListener('click', () => {
      this.confirmReset(overlay);
    });

    this.renderPlansList(overlay);
    this.renderEditor(overlay);
  }

  renderPlansList(root) {
    const listEl = root.querySelector('#tc-pa-plans-list');
    if (!listEl) return;
    const isFa = this.isFa();
    const term = this.searchTerm.trim();

    const filtered = this.planOrder.filter(id => {
      const p = this.plans[id];
      if (!p) return false;
      if (!term) return true;
      return (
        p.id.includes(term) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(term)) ||
        (p.nameFa && p.nameFa.toLowerCase().includes(term))
      );
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding:20px; font-size:11px; color:var(--text-dim);">${isFa ? 'هیچ پلنی یافت نشد.' : 'No plans match search.'}</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((id, idx) => {
      const p = this.plans[id];
      const isSel = id === this.selectedPlanId;
      const isFirst = idx === 0;
      const isLast = idx === filtered.length - 1;
      const color = p.color || '#00F2B0';
      const name = isFa ? (p.nameFa || p.nameEn) : p.nameEn;
      const badge = isFa ? (p.badgeFa || p.badge) : p.badge;

      return `
        <div data-plan-item="${p.id}" style="padding:10px 12px; border-radius:10px; cursor:pointer; background:${isSel ? 'rgba(0,242,176,0.08)' : 'var(--bg-surface,#0c1017)'}; border:1px solid ${isSel ? 'var(--accent-cyan,#00F2B0)' : 'var(--border-subtle)'}; display:flex; flex-direction:column; gap:6px; transition:all .15s ease;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
              <span style="width:10px; height:10px; border-radius:50%; background:${color}; flex-shrink:0; box-shadow:0 0 8px ${color}80;"></span>
              <strong style="font-size:12px; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(name)}</strong>
              ${p.isDefault ? `<span style="font-size:8px; padding:1px 5px; border-radius:8px; background:rgba(255,255,255,0.12); color:#fff;">${isFa ? 'پیش‌فرض' : 'DEFAULT'}</span>` : ''}
              ${badge ? `<span style="font-size:8px; padding:1px 5px; border-radius:8px; background:${color}22; color:${color}; font-weight:800;">${escapeHtml(badge)}</span>` : ''}
            </div>
            <div style="font-size:11px; font-weight:800; color:${color}; display:inline-flex; align-items:center; gap:2px;">
              ${p.priceUSD === 0 ? (isFa ? 'رایگان' : 'Free') : `<bdi dir="ltr">$${p.priceUSD}</bdi><span style="font-size:10px; color:var(--text-dim);">${isFa ? '/ماه' : '/mo'}</span>`}
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:var(--text-dim);">
            <span dir="ltr" style="font-family:monospace; opacity:0.75;">#${escapeHtml(p.id)}</span>
            <div style="display:flex; align-items:center; gap:6px;" onclick="event.stopPropagation();">
              ${isFirst ? '' : `<button data-act="up" data-id="${p.id}" title="${isFa ? 'انتقال به بالا' : 'Move up'}" style="min-width:28px; min-height:26px; display:inline-flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); border-radius:6px; color:var(--text-dim); cursor:pointer; font-size:11px; padding:2px 4px;">⬆️</button>`}
              ${isLast ? '' : `<button data-act="down" data-id="${p.id}" title="${isFa ? 'انتقال به پایین' : 'Move down'}" style="min-width:28px; min-height:26px; display:inline-flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); border-radius:6px; color:var(--text-dim); cursor:pointer; font-size:11px; padding:2px 4px;">⬇️</button>`}
              <button data-act="clone" data-id="${p.id}" title="${isFa ? 'تکثیر / کلون پلن' : 'Clone plan'}" style="min-width:28px; min-height:26px; display:inline-flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); border-radius:6px; color:var(--text-dim); cursor:pointer; font-size:11px; padding:2px 4px;">📋</button>
              ${p.isDefault || this.planOrder.length <= 1 ? '' : `<button data-act="delete" data-id="${p.id}" title="${isFa ? 'حذف پلن' : 'Delete plan'}" style="min-width:28px; min-height:26px; display:inline-flex; align-items:center; justify-content:center; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:6px; color:#f87171; cursor:pointer; font-size:11px; padding:2px 4px;">🗑️</button>`}
            </div>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('[data-plan-item]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.planItem;
        if (id === this.selectedPlanId) {
          this.mobileView = 'editor';
          this.render();
          return;
        }
        if (this.isDirty) {
          if (!confirm(isFa ? 'تغییرات ذخیره‌نشده‌ای دارید. آیا مایل به صرف‌نظر و جابجایی هستید؟' : 'You have unsaved changes. Discard and switch plan?')) {
            return;
          }
        }
        this.selectedPlanId = id;
        this.mobileView = 'editor';
        this.initPendingPlan();
        this.render();
      });
    });

    listEl.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        if (act === 'up') await this.movePlan(id, -1, root);
        else if (act === 'down') await this.movePlan(id, 1, root);
        else if (act === 'clone') await this.promptClone(id, root);
        else if (act === 'delete') await this.confirmDelete(id, root);
      });
    });
  }

  async movePlan(id, dir, root) {
    const idx = this.planOrder.indexOf(id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= this.planOrder.length) return;
    const copy = [...this.planOrder];
    const [item] = copy.splice(idx, 1);
    copy.splice(newIdx, 0, item);
    const r = await this.api('/api/admin/plans/reorder', { method: 'POST', body: JSON.stringify({ order: copy }) });
    if (r.ok) {
      this.planOrder = r.data.planOrder || copy;
      await this.auth?.refreshPlans?.();
      this.renderPlansList(root);
    }
  }

  async promptClone(sourceId, root) {
    const isFa = this.isFa();
    const src = this.plans[sourceId];
    if (!src) return;

    let candidateId = `${src.id}_copy`;
    let i = 2;
    while (this.plans[candidateId]) {
      candidateId = `${src.id}_copy${i++}`;
    }

    this.openCustomModal({
      title: isFa ? `تکثیر پلن «${src.nameFa || src.id}»` : `Clone Plan "${src.nameEn || src.id}"`,
      icon: '📋',
      confirmText: isFa ? 'تکثیر پلن' : 'Clone Plan',
      bodyHtml: `
        <div style="display:flex; flex-direction:column; gap:5px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'شناسه یکتای پلن جدید' : 'New Plan ID'}</label>
          <input type="text" id="dlg-clone-id" value="${escapeHtml(candidateId)}" dir="ltr"
            style="padding:9px 12px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; font-family:monospace;" />
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'نام فارسی پلن جدید' : 'New Persian Name'}</label>
          <input type="text" id="dlg-clone-nameFa" value="${escapeHtml((src.nameFa || src.nameEn) + ' (کپی)')}"
            style="padding:9px 12px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'نام انگلیسی پلن جدید' : 'New English Name'}</label>
          <input type="text" id="dlg-clone-nameEn" value="${escapeHtml((src.nameEn || src.id) + ' (Copy)')}" dir="ltr"
            style="padding:9px 12px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
        </div>`,
      onConfirm: async (overlay, errBox) => {
        const idInput = overlay.querySelector('#dlg-clone-id');
        const nameFaInput = overlay.querySelector('#dlg-clone-nameFa');
        const nameEnInput = overlay.querySelector('#dlg-clone-nameEn');

        const cleanId = (idInput?.value || '').trim().toLowerCase();
        if (!cleanId || !/^[a-z0-9_-]{2,32}$/.test(cleanId)) {
          errBox.style.display = 'block';
          errBox.textContent = isFa ? 'شناسه نامعتبر است. ۲ تا ۳۲ حرف انگلیسی، رقم یا خط‌تیره وارد نمایید.' : 'Invalid ID.';
          return false;
        }
        if (this.plans[cleanId]) {
          errBox.style.display = 'block';
          errBox.textContent = isFa ? 'پلنی با این شناسه از قبل وجود دارد.' : 'Plan already exists.';
          return false;
        }

        const r = await this.api('/api/admin/plans/clone', {
          method: 'POST',
          body: JSON.stringify({
            sourceId,
            newId: cleanId,
            nameEn: nameEnInput?.value.trim() || `${src.nameEn} (Copy)`,
            nameFa: nameFaInput?.value.trim() || `${src.nameFa} (کپی)`
          })
        });

        if (r.ok) {
          await this.auth?.refreshPlans?.();
          await this.fetchData();
          this.selectedPlanId = cleanId;
          this.mobileView = 'editor';
          this.initPendingPlan();
          this.render();
          this.app?.showToast?.(isFa ? `پلن «${cleanId}» با موفقیت تکثیر شد.` : `Plan cloned as ${cleanId}.`, 'success');
          return true;
        } else {
          errBox.style.display = 'block';
          errBox.textContent = r.data.message || r.data.error || 'Clone error';
          return false;
        }
      }
    });
  }

  async confirmDelete(id, root) {
    const isFa = this.isFa();
    const p = this.plans[id];
    if (id === 'basic' || p?.isDefault) {
      this.app?.showToast?.(isFa ? 'حذف پلن پیش‌فرض پایه سیستم امکان‌پذیر نیست.' : 'Cannot delete default system plan.', 'error');
      return;
    }

    this.openCustomModal({
      title: isFa ? `حذف پلن «${p?.nameFa || id}»` : `Delete Plan "${p?.nameEn || id}"`,
      icon: '🗑️',
      isDanger: true,
      confirmText: isFa ? 'حذف دائمی پلن' : 'Delete Plan',
      bodyHtml: `
        <div style="font-size:12px; color:var(--text-dim); line-height:1.6;">
          ${isFa
            ? `آیا از حذف دائمی پلن <strong>«${escapeHtml(p?.nameFa || id)}»</strong> اطمینان دارید؟`
            : `Are you sure you want to delete plan <strong>"${escapeHtml(p?.nameEn || id)}"</strong> permanently?`}
        </div>
        <div style="padding:10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); border-radius:8px; font-size:11px; color:#fca5a5; line-height:1.6;">
          ⚠️ ${isFa
            ? 'کاربرانی که در حال حاضر این پلن را دارند، به صورت خودکار به پلن پیش‌فرض سیستم منتقل خواهند شد.'
            : 'Active users on this plan will be automatically migrated to the system default tier.'}
        </div>`,
      onConfirm: async (overlay, errBox) => {
        const r = await this.api(`/api/admin/plans/${id}`, { method: 'DELETE' });
        if (r.ok) {
          await this.auth?.refreshPlans?.();
          await this.fetchData();
          this.selectedPlanId = this.planOrder[0] || 'basic';
          this.initPendingPlan();
          this.render();
          this.app?.showToast?.(isFa ? `پلن «${id}» با موفقیت حذف گردید.` : `Plan ${id} deleted.`, 'success');
          return true;
        } else {
          errBox.style.display = 'block';
          errBox.textContent = r.data.message || r.data.error || 'Delete error';
          return false;
        }
      }
    });
  }

  async confirmReset(root) {
    const isFa = this.isFa();
    this.openCustomModal({
      title: isFa ? 'بازنشانی پلن‌ها به تنظیمات کارخانه' : 'Reset Plans to Factory Defaults',
      icon: '🔄',
      isDanger: true,
      confirmText: isFa ? 'تأیید و بازنشانی' : 'Confirm Reset',
      bodyHtml: `
        <div style="font-size:12px; color:var(--text-dim); line-height:1.6;">
          ${isFa
            ? 'آیا از بازنشانی کلیه پلن‌ها به ۵ پلن پیش‌فرض استاندارد پلتفرم اطمینان دارید؟'
            : 'Are you sure you want to reset all subscription tiers to the standard 5 factory seed plans?'}
        </div>
        <div style="padding:10px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); border-radius:8px; font-size:11px; color:#fcd34d; line-height:1.6;">
          ⚠️ ${isFa
            ? 'تمامی پلن‌های سفارشی ایجادشده پاک شده و سقف‌های ۵ پلن پایه، اسنشیال، پلاس، پریمیوم و آلتیمیت بازیابی می‌شوند.'
            : 'All custom tiers will be deleted, and original quotas for Basic, Essential, Plus, Premium, and Ultimate will be restored.'}
        </div>`,
      onConfirm: async (overlay, errBox) => {
        const r = await this.api('/api/admin/plans/reset', { method: 'POST' });
        if (r.ok) {
          await this.auth?.refreshPlans?.();
          await this.fetchData();
          this.selectedPlanId = 'basic';
          this.initPendingPlan();
          this.render();
          this.app?.showToast?.(isFa ? 'پلن‌ها به حالت پیش‌فرض بازنشانی شدند.' : 'Plans reset to defaults.', 'success');
          return true;
        } else {
          errBox.style.display = 'block';
          errBox.textContent = r.data.message || r.data.error || 'Reset error';
          return false;
        }
      }
    });
  }

  async promptNewPlan(root) {
    const isFa = this.isFa();
    const templateOptions = this.planOrder.map(id => {
      const p = this.plans[id];
      if (!p) return '';
      const name = isFa ? (p.nameFa || p.nameEn) : p.nameEn;
      return `<option value="${p.id}" ${id === 'plus' ? 'selected' : ''}>${escapeHtml(name)} (#${p.id})</option>`;
    }).join('');

    this.openCustomModal({
      title: isFa ? 'تعریف پلن اشتراک جدید' : 'Create New Subscription Plan',
      icon: '✨',
      confirmText: isFa ? 'ایجاد پلن' : 'Create Plan',
      bodyHtml: `
        <div style="display:flex; flex-direction:column; gap:5px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'شناسه یکتا (Slug ID)' : 'Unique Plan ID (slug)'}</label>
          <input type="text" id="dlg-plan-id" placeholder="e.g. algo-pro" dir="ltr"
            style="padding:9px 12px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; font-family:monospace;" />
          <span style="font-size:10px; color:var(--text-dim);">${isFa ? 'شامل ۲ تا ۳۲ کاراکتر انگلیسی، عدد، زیرخط یا خط‌تیره' : '2–32 lowercase letters, numbers, hyphen or underscore'}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'نام فارسی پلن' : 'Persian Name'}</label>
          <input type="text" id="dlg-plan-nameFa" placeholder="${isFa ? 'مانند: اسکالپر حرفه‌ای' : 'Persian name'}"
            style="padding:9px 12px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'نام انگلیسی پلن' : 'English Name'}</label>
          <input type="text" id="dlg-plan-nameEn" placeholder="e.g. Algo Pro Scalper" dir="ltr"
            style="padding:9px 12px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'پلن پایه جهت الگوبرداری از فیچرها' : 'Base Tier Template'}</label>
          <select id="dlg-plan-template" style="padding:9px 12px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;">
            ${templateOptions}
          </select>
        </div>`,
      onConfirm: async (overlay, errBox) => {
        const idInput = overlay.querySelector('#dlg-plan-id');
        const nameFaInput = overlay.querySelector('#dlg-plan-nameFa');
        const nameEnInput = overlay.querySelector('#dlg-plan-nameEn');
        const templateSelect = overlay.querySelector('#dlg-plan-template');

        const cleanId = (idInput?.value || '').trim().toLowerCase();
        if (!cleanId || !/^[a-z0-9_-]{2,32}$/.test(cleanId)) {
          errBox.style.display = 'block';
          errBox.textContent = isFa ? 'شناسه نامعتبر است. ۲ تا ۳۲ حرف انگلیسی، رقم یا خط‌تیره وارد نمایید.' : 'Invalid ID: must be 2–32 alphanumeric chars, hyphen or underscore.';
          return false;
        }
        if (this.plans[cleanId]) {
          errBox.style.display = 'block';
          errBox.textContent = isFa ? 'پلنی با این شناسه از قبل وجود دارد.' : 'A plan with this ID already exists.';
          return false;
        }

        const templateId = templateSelect?.value;
        const basePlan = this.plans[templateId] || this.plans.basic || {};
        const nameFa = nameFaInput?.value.trim() || cleanId;
        const nameEn = nameEnInput?.value.trim() || cleanId;

        const newPlan = {
          ...JSON.parse(JSON.stringify(basePlan)),
          id: cleanId,
          nameEn,
          nameFa,
          priceUSD: basePlan.priceUSD ? basePlan.priceUSD + 10 : 39.95,
          priceYearlyUSD: basePlan.priceYearlyUSD ? basePlan.priceYearlyUSD + 100 : 399.50,
          badge: 'CUSTOM',
          badgeFa: 'سفارشی',
          color: '#00F2B0',
          isDefault: false,
          isActive: true
        };

        const r = await this.api('/api/admin/plans', {
          method: 'POST',
          body: JSON.stringify(newPlan)
        });

        if (r.ok) {
          await this.auth?.refreshPlans?.();
          await this.fetchData();
          this.selectedPlanId = cleanId;
          this.mobileView = 'editor';
          this.initPendingPlan();
          this.render();
          this.app?.showToast?.(isFa ? `پلن جدید «${cleanId}» با موفقیت ایجاد گردید.` : `Plan ${cleanId} created successfully.`, 'success');
          return true;
        } else {
          errBox.style.display = 'block';
          errBox.textContent = r.data.message || r.data.error || 'Server error';
          return false;
        }
      }
    });
  }

  renderEditor(root) {
    const wrap = root.querySelector('#tc-pa-editor-wrap');
    if (!wrap) return;
    const isFa = this.isFa();
    const p = this.pendingPlan;

    if (!p) {
      wrap.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-dim); font-size:13px;">${isFa ? 'هیچ پلنی انتخاب نشده است.' : 'No plan selected.'}</div>`;
      return;
    }

    const tabs = [
      { id: 'general', nameEn: 'General', nameFa: 'مشخصات عمومی', icon: '🏷️' },
      { id: 'quotas', nameEn: 'Quotas', nameFa: 'سقف‌های مقداری', icon: '📊' },
      { id: 'chart', nameEn: 'Charts', nameFa: 'چارت و تحلیل', icon: '📈' },
      { id: 'trading', nameEn: 'Trading', nameFa: 'معاملات و پراپ', icon: '💼' },
      { id: 'backtest', nameEn: 'Pine', nameFa: 'پاین و بک‌تست', icon: '🔬' },
      { id: 'platform', nameEn: 'Platform', nameFa: 'هشدار و پلتفرم', icon: '🌐' },
      { id: 'preview', nameEn: 'Preview', nameFa: 'پیش‌نمایش کارت', icon: '👁️' }
    ];

    const tabButtons = tabs.map(t => {
      const active = this.activeTab === t.id;
      return `
        <button data-etab="${t.id}" style="padding:5px 8px; flex-shrink:0; border-radius:7px; font-size:10.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; border:1px solid ${active ? 'var(--accent-cyan,#00F2B0)' : 'var(--border-subtle)'}; background:${active ? 'rgba(0,242,176,0.1)' : 'transparent'}; color:${active ? 'var(--accent-cyan,#00F2B0)' : 'var(--text-dim)'}; white-space:nowrap;">
          <span style="font-size:12px;">${t.icon}</span><span>${isFa ? t.nameFa : t.nameEn}</span>
        </button>`;
    }).join('');

    wrap.innerHTML = `
      <!-- Editor Header -->
      <div style="padding:12px 18px; background:var(--bg-surface,#0c1017); border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <button id="tc-pa-mobile-back-btn" class="tc-pa-mobile-back" style="padding:6px 10px; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid var(--border-subtle); color:#fff; font-size:11px; font-weight:700; cursor:pointer; display:none; align-items:center; gap:6px;">
            <span>${isFa ? '←' : '→'}</span><span>${isFa ? 'فهرست پلن‌ها' : 'Plans List'}</span>
          </button>
          <span style="width:14px; height:14px; border-radius:50%; background:${p.color || '#00F2B0'}; box-shadow:0 0 10px ${p.color || '#00F2B0'};"></span>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:14px; color:#fff;">${escapeHtml(isFa ? (p.nameFa || p.nameEn) : p.nameEn)}</strong>
              <code dir="ltr" style="font-size:10px; background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; color:var(--accent-cyan,#00F2B0); font-family:monospace;">#${escapeHtml(p.id)}</code>
            </div>
            <div style="font-size:10px; color:var(--text-dim); margin-top:2px;">
              ${p.isDefault ? (isFa ? 'پلن پیش‌فرض برای کاربران بدون اشتراک' : 'Default tier for guests & free users') : (isFa ? 'پلن اشتراک سفارشی پلتفرم' : 'Custom platform tier')}
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button id="tc-pa-enable-all" style="padding:6px 10px; border-radius:6px; font-size:10px; font-weight:700; background:rgba(0,242,176,0.12); color:var(--accent-cyan,#00F2B0); border:1px solid rgba(0,242,176,0.3); cursor:pointer;">
            ✨ ${isFa ? 'فعال‌سازی همه فیچرها' : 'Enable All'}
          </button>
          <button id="tc-pa-disable-all" style="padding:6px 10px; border-radius:6px; font-size:10px; font-weight:700; background:rgba(248,113,113,0.12); color:#f87171; border:1px solid rgba(248,113,113,0.3); cursor:pointer;">
            🚫 ${isFa ? 'غیرفعال‌سازی همه فیچرها' : 'Disable All'}
          </button>
          <button id="tc-pa-save" class="btn-primary" style="padding:7px 16px; border-radius:8px; font-size:11px; font-weight:800; background:var(--accent-cyan,#00F2B0); color:#04121e; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; ${this.isDirty ? 'box-shadow:0 0 14px rgba(0,242,176,0.5);' : ''}">
            <span>💾</span><span>${isFa ? (this.isDirty ? 'ذخیره تغییرات ●' : 'ذخیره تغییرات') : (this.isDirty ? 'Save Changes ●' : 'Save Changes')}</span>
          </button>
        </div>
      </div>

      <!-- Category Tabbar -->
      <div class="tc-pa-tabbar" style="padding:8px 16px; background:rgba(12,16,23,0.4); border-bottom:1px solid var(--border-subtle); display:flex; gap:6px; overflow-x:auto; scrollbar-width:thin; -webkit-overflow-scrolling:touch; flex-wrap:nowrap;">
        ${tabButtons}
      </div>

      <!-- Tab Content Area -->
      <div id="tc-pa-tab-body" style="flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:14px;">
        <!-- Filled by renderTabContent() -->
      </div>`;

    wrap.querySelectorAll('[data-etab]').forEach(b => {
      b.addEventListener('click', () => {
        this.activeTab = b.dataset.etab;
        this.renderEditor(root);
      });
    });

    wrap.querySelector('#tc-pa-mobile-back-btn')?.addEventListener('click', () => {
      this.mobileView = 'list';
      this.render();
    });

    wrap.querySelector('#tc-pa-enable-all')?.addEventListener('click', () => {
      for (const f of this.catalog) {
        if (f.type === 'boolean') {
          p.features[f.id] = true;
          p[f.id] = true;
        } else if (f.type === 'numeric') {
          p.features[f.id] = -1; // unlimited
          p[f.id] = -1;
        }
      }
      this.setDirty(true);
      this.renderEditor(root);
      this.app?.showToast?.(isFa ? 'همه فیچرها و سقف‌های این پلن فعال و نامحدود شدند.' : 'All features enabled & set to unlimited.', 'info');
    });

    wrap.querySelector('#tc-pa-disable-all')?.addEventListener('click', () => {
      for (const f of this.catalog) {
        if (f.type === 'boolean') {
          p.features[f.id] = false;
          p[f.id] = false;
        } else if (f.type === 'numeric') {
          p.features[f.id] = 0;
          p[f.id] = 0;
        }
      }
      this.setDirty(true);
      this.renderEditor(root);
      this.app?.showToast?.(isFa ? 'همه فیچرها و سقف‌های اختیاری غیرفعال شدند.' : 'All features disabled.', 'info');
    });

    wrap.querySelector('#tc-pa-save')?.addEventListener('click', async () => {
      await this.saveCurrentPlan(root);
    });

    this.renderTabContent(wrap, root);
  }

  renderTabContent(wrap, root) {
    const body = wrap.querySelector('#tc-pa-tab-body');
    if (!body) return;
    const isFa = this.isFa();
    const p = this.pendingPlan;

    if (this.activeTab === 'general') {
      this.renderGeneralTab(body, p, isFa);
    } else if (this.activeTab === 'quotas') {
      this.renderQuotasTab(body, p, isFa);
    } else if (this.activeTab === 'preview') {
      this.renderPreviewTab(body, p, isFa);
    } else {
      // Feature toggles for specific categories
      this.renderFeatureTogglesTab(body, p, this.activeTab, isFa);
    }
  }

  renderGeneralTab(body, p, isFa) {
    const colors = ['#00F2B0', '#3b82f6', '#a855f7', '#f59e0b', '#f43f5e', '#ec4899', '#06b6d4', '#64748b'];
    const colorSwatches = colors.map(c => `
      <button type="button" data-color="${c}" style="width:17px; height:17px; border-radius:50%; background:${c}; border:2px solid ${p.color === c ? '#fff' : 'transparent'}; cursor:pointer; box-shadow:0 0 6px ${c}60; flex-shrink:0; padding:0;"></button>
    `).join('');

    body.innerHTML = `
      <!-- Section 1: Identity & Names (4 cols) -->
      <div style="background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:12px;">
        <div style="font-size:12px; font-weight:800; color:#fff; display:flex; align-items:center; gap:6px;">
          <span>🏷️</span><span>${isFa ? 'هویت و نام‌گذاری پلن' : 'Plan Identity & Names'}</span>
        </div>
        <div class="tc-pa-grid-4" style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px;">
          <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'شناسه یکتا (Plan ID)' : 'Unique Plan ID'}</label>
            <input type="text" id="inp-id" value="${escapeHtml(p.id)}" disabled dir="ltr"
              style="padding:9px 12px; font-size:12px; background:rgba(0,0,0,0.3); border:1px solid var(--border-subtle); border-radius:7px; color:var(--text-dim); opacity:0.8; font-family:monospace;" />
          </div>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'نام فارسی پلن' : 'Persian Name'}</label>
            <input type="text" id="inp-nameFa" value="${escapeHtml(p.nameFa || '')}"
              style="padding:9px 12px; font-size:12px; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
          </div>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'نام انگلیسی پلن' : 'English Name'}</label>
            <input type="text" id="inp-nameEn" value="${escapeHtml(p.nameEn || '')}" dir="ltr"
              style="padding:9px 12px; font-size:12px; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
          </div>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'رنگ تم و شناسه بصری' : 'Theme Accent Color'}</label>
            <div style="display:flex; align-items:center; gap:4px; height:36px; flex-wrap:nowrap; overflow:visible;">
              ${colorSwatches}
              <label style="width:17px; height:17px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.08); border:1px dashed var(--border-subtle); cursor:pointer; font-size:9px; flex-shrink:0;" title="${isFa ? 'انتخاب رنگ دلخواه' : 'Custom color'}">
                <span>🎨</span>
                <input type="color" id="inp-color-picker" value="${p.color || '#00F2B0'}" style="position:absolute; opacity:0; width:0; height:0; pointer-events:none;" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Pricing & Badges (4 cols) -->
      <div style="background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:12px;">
        <div style="font-size:12px; font-weight:800; color:#fff; display:flex; align-items:center; gap:6px;">
          <span>💳</span><span>${isFa ? 'تعرفه و نشان‌های برجسته' : 'Pricing & Highlight Badges'}</span>
        </div>
        <div class="tc-pa-grid-4" style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px;">
          <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'قیمت ماهانه (دلار USD)' : 'Monthly Price (USD)'}</label>
            <input type="number" step="0.01" min="0" id="inp-priceUSD" value="${p.priceUSD ?? 0}" dir="ltr"
              style="padding:9px 12px; font-size:12px; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
          </div>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'قیمت سالانه (دلار USD)' : 'Yearly Price (USD)'}</label>
            <input type="number" step="0.01" min="0" id="inp-priceYearlyUSD" value="${p.priceYearlyUSD ?? 0}" dir="ltr"
              style="padding:9px 12px; font-size:12px; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
          </div>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'نشان / برچسب فارسی (Badge)' : 'Persian Badge'}</label>
            <input type="text" id="inp-badgeFa" value="${escapeHtml(p.badgeFa || '')}" placeholder="${isFa ? 'مانند: ویژه، محبوب‌ترین' : 'e.g. Recommended'}"
              style="padding:9px 12px; font-size:12px; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
          </div>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'نشان انگلیسی (Badge EN)' : 'English Badge'}</label>
            <input type="text" id="inp-badge" value="${escapeHtml(p.badge || '')}" dir="ltr" placeholder="e.g. POPULAR, VIP"
              style="padding:9px 12px; font-size:12px; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none;" />
          </div>
        </div>
      </div>

      <!-- Descriptions -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-top:2px;">
        <div style="display:flex; flex-direction:column; gap:5px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'توضیحات معرفی پلن (فارسی)' : 'Persian Description'}</label>
          <textarea rows="2" id="inp-descFa" style="padding:9px 12px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; resize:none; height:56px; font-family:inherit;">${escapeHtml(p.descriptionFa || '')}</textarea>
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-dim);">${isFa ? 'توضیحات معرفی پلن (انگلیسی)' : 'English Description'}</label>
          <textarea rows="2" id="inp-descEn" dir="ltr" style="padding:9px 12px; font-size:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:7px; color:#fff; outline:none; resize:none; height:56px; font-family:inherit;">${escapeHtml(p.descriptionEn || '')}</textarea>
        </div>
      </div>

      <!-- Toggles for Status and Default -->
      <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:10px; padding:12px; background:var(--bg-surface,#0c1017); border-radius:9px; border:1px solid var(--border-subtle);">
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
          <input type="checkbox" id="chk-active" ${p.isActive !== false ? 'checked' : ''} style="accent-color:var(--accent-cyan,#00F2B0); width:16px; height:16px;" />
          <span style="font-size:12px; font-weight:700; color:#fff;">${isFa ? 'پلن فعال است (قابل انتخاب در فهرست ارتقا)' : 'Plan is active (selectable in pricing)'}</span>
        </label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
          <input type="checkbox" id="chk-default" ${p.isDefault ? 'checked' : ''} style="accent-color:var(--accent-cyan,#00F2B0); width:16px; height:16px;" />
          <span style="font-size:12px; font-weight:700; color:#fff;">${isFa ? 'پلن پیش‌فرض سیستم (کاربران بدون اشتراک)' : 'System default plan for free tier'}</span>
        </label>
      </div>`;

    // Bind inputs to pendingPlan
    const bind = (id, key, num = false) => {
      const el = body.querySelector('#' + id);
      if (el) {
        el.addEventListener('input', (e) => {
          p[key] = num ? parseFloat(e.target.value) || 0 : e.target.value;
          this.setDirty(true);
        });
      }
    };
    bind('inp-nameFa', 'nameFa');
    bind('inp-nameEn', 'nameEn');
    bind('inp-priceUSD', 'priceUSD', true);
    bind('inp-priceYearlyUSD', 'priceYearlyUSD', true);
    bind('inp-badgeFa', 'badgeFa');
    bind('inp-badge', 'badge');
    bind('inp-descFa', 'descriptionFa');
    bind('inp-descEn', 'descriptionEn');

    body.querySelector('#chk-active')?.addEventListener('change', (e) => {
      p.isActive = e.target.checked;
      this.setDirty(true);
    });
    body.querySelector('#chk-default')?.addEventListener('change', (e) => {
      p.isDefault = e.target.checked;
      this.setDirty(true);
    });

    body.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        p.color = btn.dataset.color;
        this.setDirty(true);
        this.renderGeneralTab(body, p, isFa);
      });
    });

    body.querySelector('#inp-color-picker')?.addEventListener('input', (e) => {
      p.color = e.target.value;
      this.setDirty(true);
    });
  }

  renderQuotasTab(body, p, isFa) {
    const numericFeatures = this.catalog.filter(f => f.type === 'numeric');

    body.innerHTML = `
      <div style="font-size:11px; color:var(--text-dim); margin-bottom:4px; line-height:1.6;">
        ${isFa
          ? 'سقف‌های مقداری مجاز برای هر بخش را مشخص نمایید. با فشردن دکمه «نامحدود (∞)»، سقف به بی‌نهایت تغییر می‌یابد.'
          : 'Define numeric quotas. Toggle "Unlimited (∞)" to allow unconstrained usage.'}
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:12px;">
        ${numericFeatures.map(f => {
          const val = p.features[f.id] !== undefined ? p.features[f.id] : (p[f.id] !== undefined ? p[f.id] : f.default);
          const isUnlim = val === -1;
          const label = isFa ? f.nameFa : f.nameEn;
          const desc = isFa ? f.descFa : f.descEn;
          const unit = isFa ? f.unitFa : f.unitEn;

          return `
            <div style="padding:12px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:10px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <div>
                  <strong style="font-size:12px; color:#fff;">${escapeHtml(label)}</strong>
                  <div style="font-size:10px; color:var(--text-dim); margin-top:2px;">${escapeHtml(desc)}</div>
                </div>
                <button type="button" data-unlim-toggle="${f.id}" style="padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; flex-shrink:0; border:1px solid ${isUnlim ? 'var(--accent-cyan,#00F2B0)' : 'var(--border-subtle)'}; background:${isUnlim ? 'rgba(0,242,176,0.14)' : 'transparent'}; color:${isUnlim ? 'var(--accent-cyan,#00F2B0)' : 'var(--text-dim)'};">
                  ${isUnlim ? (isFa ? '✓ نامحدود (∞)' : '✓ Unlimited (∞)') : (isFa ? 'نامحدود؟' : 'Unlimited?')}
                </button>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="number" id="quota-${f.id}" min="${f.min || 0}" max="${f.max || 100000}" step="${f.step || 1}" value="${isUnlim ? '' : val}" ${isUnlim ? 'disabled placeholder="∞"' : `placeholder="${val}"`} dir="ltr"
                  style="flex:1; padding:8px 10px; font-size:12px; background:${isUnlim ? 'rgba(0,0,0,0.3)' : 'var(--bg-card,#151c2d)'}; border:1px solid var(--border-subtle); border-radius:6px; color:#fff; outline:none; text-align:center; opacity:${isUnlim ? 0.6 : 1};" />
                <span style="font-size:11px; color:var(--text-dim); flex-shrink:0; min-width:34px;">${unit}</span>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    body.querySelectorAll('[data-unlim-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.unlimToggle;
        const curVal = p.features[id] !== undefined ? p.features[id] : (p[id] !== undefined ? p[id] : 0);
        if (curVal === -1) {
          // Restore default or previous number
          const featDef = this.catalog.find(x => x.id === id);
          p.features[id] = featDef?.default ?? 1;
        } else {
          p.features[id] = -1;
        }
        p[id] = p.features[id];
        this.setDirty(true);
        this.renderQuotasTab(body, p, isFa);
      });
    });

    numericFeatures.forEach(f => {
      const input = body.querySelector(`#quota-${f.id}`);
      if (input) {
        input.addEventListener('input', (e) => {
          const num = parseInt(e.target.value, 10);
          const val = isNaN(num) ? 0 : Math.max(0, num);
          p.features[f.id] = val;
          p[f.id] = val;
          this.setDirty(true);
        });
      }
    });
  }

  renderFeatureTogglesTab(body, p, category, isFa) {
    const categoryMap = {
      chart: ['chart', 'alerts'],
      trading: ['trading'],
      backtest: ['backtest'],
      platform: ['platform', 'alerts', 'screener']
    };
    const targetCategories = categoryMap[category] || [category];
    const toggles = this.catalog.filter(f => f.type === 'boolean' && targetCategories.includes(f.category));

    body.innerHTML = `
      <div style="font-size:11px; color:var(--text-dim); margin-bottom:4px; line-height:1.6;">
        ${isFa
          ? 'هر یک از فیچرهای زیر را به صورت اختصاصی برای این پلن فعال یا غیرفعال فرمایید. کاربرانی که این قابلیت در پلن آن‌ها غیرفعال باشد، هنگام دسترسی پیام ارتقا دریافت می‌کنند.'
          : 'Toggle individual feature flags for this plan. Users without access will see the upgrade modal when attempting to open them.'}
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:12px;">
        ${toggles.map(f => {
          const active = p.features[f.id] !== undefined ? Boolean(p.features[f.id]) : Boolean(p[f.id]);
          const label = isFa ? f.nameFa : f.nameEn;
          const desc = isFa ? f.descFa : f.descEn;

          return `
            <div style="padding:12px 14px; background:var(--bg-surface,#0c1017); border:1px solid ${active ? 'rgba(0,242,176,0.3)' : 'var(--border-subtle)'}; border-radius:10px; display:flex; justify-content:space-between; align-items:center; gap:12px; transition:border .15s ease;">
              <div style="flex:1; min-width:0;">
                <strong style="font-size:12px; color:${active ? '#fff' : 'var(--text-dim)'};">${escapeHtml(label)}</strong>
                <div style="font-size:10px; color:var(--text-dim); margin-top:2px; line-height:1.5;">${escapeHtml(desc)}</div>
              </div>
              <label style="position:relative; display:inline-block; width:42px; height:24px; flex-shrink:0; cursor:pointer;">
                <input type="checkbox" data-ftoggle="${f.id}" ${active ? 'checked' : ''} style="opacity:0; width:0; height:0;" />
                <span class="tc-slider" style="position:absolute; inset:0; background:${active ? 'var(--accent-cyan,#00F2B0)' : 'rgba(255,255,255,0.12)'}; border-radius:24px; transition:.25s ease;">
                  <span style="position:absolute; content:''; height:18px; width:18px; ${isFa ? (active ? 'right:20px;' : 'right:3px;') : (active ? 'left:20px;' : 'left:3px;')}; bottom:3px; background:${active ? '#04121e' : '#fff'}; border-radius:50%; transition:.25s ease;"></span>
                </span>
              </label>
            </div>`;
        }).join('')}
      </div>`;

    body.querySelectorAll('[data-ftoggle]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = chk.dataset.ftoggle;
        p.features[id] = e.target.checked;
        p[id] = e.target.checked;
        this.setDirty(true);
        this.renderFeatureTogglesTab(body, p, category, isFa);
      });
    });
  }

  renderPreviewTab(body, p, isFa) {
    const color = p.color || '#00F2B0';
    const name = isFa ? (p.nameFa || p.nameEn) : p.nameEn;
    const badge = isFa ? (p.badgeFa || p.badge) : p.badge;
    const priceText = p.priceUSD === 0 ? (isFa ? 'رایگان' : 'Free') : `$${p.priceUSD}`;

    // Select key features to show in preview
    const sampleFeatures = [
      ['chartsPerTab', isFa ? 'چارت در هر تب' : 'Charts per tab', p.chartsPerTab ?? p.features.chartsPerTab],
      ['savedLayouts', isFa ? 'چیدمان‌های ذخیره‌شده' : 'Saved layouts', p.savedLayouts ?? p.features.savedLayouts],
      ['indicatorsPerChart', isFa ? 'اندیکاتور در هر چارت' : 'Indicators per chart', p.indicatorsPerChart ?? p.features.indicatorsPerChart],
      ['histBars', isFa ? 'کندل‌های تاریخی' : 'Historical bars', p.histBars ?? p.features.histBars],
      ['secondIntervals', isFa ? 'تایم‌فریم‌های ثانیه‌ای' : 'Second intervals', p.secondIntervals ?? p.features.secondIntervals],
      ['propFirmSim', isFa ? 'شبیه‌ساز پراپ‌فرم' : 'Prop-firm simulator', p.propFirmSim ?? p.features.propFirmSim],
      ['tradeJournal', isFa ? 'ژورنال معاملاتی هوشمند' : 'Trade journal', p.tradeJournal ?? p.features.tradeJournal],
      ['depthOfMarket', isFa ? 'عمق بازار DOM لول ۲' : 'Depth of Market (DOM)', p.depthOfMarket ?? p.features.depthOfMarket],
      ['webhookAlerts', isFa ? 'هشدارهای وب‌هوک' : 'Webhook alerts', p.webhookAlerts ?? p.features.webhookAlerts],
      ['pineStudio', isFa ? 'استودیو پاین‌اسکریپت' : 'Pine script studio', p.pineStudio ?? p.features.pineStudio],
      ['deepBacktest', isFa ? 'بک‌تست عمیق نامحدود' : 'Deep backtesting', p.deepBacktest ?? p.features.deepBacktest]
    ];

    const fmt = (v) => v === -1 ? '∞' : (typeof v === 'boolean' ? (v ? '✓' : '—') : toPersianDigits(String(v)));

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
        <div style="font-size:12px; color:var(--text-dim); text-align:center;">
          ${isFa ? 'پیش‌نمایش بصری دقیق کارت این پلن همان‌گونه که در جدول مقایسه اشتراک به کاربران نمایش داده می‌شود:' : 'Live visual preview of this tier card as seen by end-users in the pricing modal:'}
        </div>
        <div style="width:min(360px, 92vw); background:var(--bg-surface,#0c1017); border:2px solid ${color}; border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:14px; box-shadow:0 12px 30px ${color}20;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:16px; color:#fff;">${escapeHtml(name)}</strong>
            ${badge ? `<span style="font-size:10px; background:${color}; color:#04121e; padding:2px 8px; border-radius:12px; font-weight:800;">${escapeHtml(badge)}</span>` : ''}
          </div>
          <div style="font-size:24px; font-weight:800; color:${color};">
            ${priceText}<span style="font-size:12px; color:var(--text-dim); font-weight:400;">${p.priceUSD ? (isFa ? '/ماه' : '/mo') : ''}</span>
          </div>
          <div style="font-size:11px; color:var(--text-dim); line-height:1.5;">${escapeHtml(isFa ? (p.descriptionFa || p.descriptionEn) : p.descriptionEn)}</div>
          <div style="border-top:1px solid var(--border-subtle); padding-top:12px; display:flex; flex-direction:column; gap:6px;">
            ${sampleFeatures.map(([id, label, val]) => `
              <div style="display:flex; justify-content:space-between; font-size:11px;">
                <span style="color:var(--text-dim);">${label}</span>
                <span style="font-weight:700; color:${(val === true || (typeof val === 'number' && val !== 0)) ? color : 'var(--text-dim)'};">${fmt(val)}</span>
              </div>`).join('')}
          </div>
          <button style="margin-top:8px; padding:10px; border-radius:8px; background:${color}; color:#04121e; border:none; font-weight:800; font-size:12px; cursor:pointer;">
            ${isFa ? 'ارتقا به این پلن' : 'Upgrade to Plan'}
          </button>
        </div>
      </div>`;
  }

  async saveCurrentPlan(root) {
    const p = this.pendingPlan;
    if (!p) return;
    const isFa = this.isFa();

    // Normalize and flatten all features
    for (const f of this.catalog) {
      if (p.features[f.id] !== undefined) {
        p[f.id] = p.features[f.id];
      }
    }

    const r = await this.api(`/api/admin/plans/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify(p)
    });

    if (r.ok) {
      this.setDirty(false);
      this.plans[p.id] = r.data.plan;
      await this.auth?.refreshPlans?.();
      this.renderPlansList(root);
      this.renderEditor(root);
      this.app?.showToast?.(isFa ? `پلن «${p.nameFa || p.id}» با موفقیت ذخیره و در سیستم اعمال شد.` : `Plan ${p.id} saved and applied across platform.`, 'success');
    } else {
      this.app?.showToast?.(isFa ? `خطا در ذخیره پلن: ${r.data.message || r.data.error}` : `Error saving plan: ${r.data.message || r.data.error}`, 'error');
    }
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
