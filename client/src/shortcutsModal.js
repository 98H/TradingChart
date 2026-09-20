// client/src/shortcutsModal.js
// TradingChart Keyboard Shortcuts Reference & Modal

import { getLanguage, t } from './i18n.js';

export class ShortcutsModal {
  constructor(options = {}) {
    this.modalEl = options.modalEl || null;
    this.createModal();
  }

  createModal() {
    if (!this.modalEl) {
      let el = document.querySelector('#modal-shortcuts');
      if (!el) {
        el = document.createElement('div');
        el.id = 'modal-shortcuts';
        el.className = 'modal-overlay';
        document.body.appendChild(el);
      }
      this.modalEl = el;
    }
    this.render();
  }

  open() {
    if (this.modalEl) {
      this.render();
      this.modalEl.classList.add('open');
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }

  render() {
    const isFa = getLanguage() === 'fa';
    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 580px; max-height: 85vh; display: flex; flex-direction: column; ${isFa ? 'direction: rtl; text-align: right; font-family: var(--font-vazirmatn), sans-serif;' : 'direction: ltr; text-align: left;'}">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; ${isFa ? 'direction: rtl;' : 'direction: ltr;'}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan);">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8"/>
            </svg>
            <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #fff;">
              <span id="shortcuts-modal-title">${isFa ? 'کلیدهای میانبر صفحه‌کلید' : 'Keyboard Shortcuts Reference'}</span>
            </h3>
          </div>
          <button class="modal-close-btn" id="modal-close-shortcuts" style="${isFa ? 'order: -1;' : ''}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-content" style="flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 16px;">
          <!-- Navigation -->
          <div>
            <div style="font-size: 11px; font-weight: 800; color: var(--accent-cyan); text-transform: uppercase; margin-bottom: 8px;">
              ${isFa ? 'ناوبری و جستجو' : 'Navigation & Discovery'}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="shortcut-row">
                <span>${isFa ? 'دایره‌المعارف اندیکاتورها' : 'Indicators & Metrics'}</span>
                <span class="keys"><kbd>/</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'جستجوی نماد' : 'Symbol Search'}</span>
                <span class="keys"><kbd>Ctrl+K</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'تغییر سریع تایم‌فریم' : 'Quick Timeframe'}</span>
                <span class="keys"><kbd>,</kbd> or <kbd>1</kbd> <kbd>5</kbd> <kbd>15</kbd> <kbd>60</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'نماد بعدی دیده‌بان' : 'Next Watchlist Symbol'}</span>
                <span class="keys"><kbd>Space</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'نماد قبلی دیده‌بان' : 'Prev Watchlist Symbol'}</span>
                <span class="keys"><kbd>Shift+Space</kbd></span>
              </div>
            </div>
          </div>

          <!-- Drawing Tools -->
          <div>
            <div style="font-size: 11px; font-weight: 800; color: var(--accent-green); text-transform: uppercase; margin-bottom: 8px;">
              ${isFa ? 'ابزارهای تحلیل و ترسیم' : 'Chart Drawing Tools'}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="shortcut-row">
                <span>${isFa ? 'خط روند (Trend Line)' : 'Trend Line'}</span>
                <span class="keys"><kbd>Alt+T</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'خط افقی (Horizontal)' : 'Horizontal Line'}</span>
                <span class="keys"><kbd>Alt+H</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'خط عمودی (Vertical)' : 'Vertical Line'}</span>
                <span class="keys"><kbd>Alt+V</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'فیبوناچی ریتریسمنت' : 'Fib Retracement'}</span>
                <span class="keys"><kbd>Alt+F</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'باکس اردربلاک / FVG' : 'Rectangle / Zone'}</span>
                <span class="keys"><kbd>Alt+B</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'محاسبه پوزیشن لانگ/شورت' : 'Long/Short Position'}</span>
                <span class="keys"><kbd>Alt+P</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'مقایسه و افزودن نماد' : 'Compare / Add Symbol'}</span>
                <span class="keys"><kbd>Alt+C</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'خروجی داده‌های چارت' : 'Export Chart Data'}</span>
                <span class="keys"><kbd>Alt+E</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'تنظیم خودکار مقیاس چارت' : 'Auto Scale / Fit Data'}</span>
                <span class="keys"><kbd>Alt+R</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'معکوس‌سازی عمودی قیمت' : 'Invert Price Scale'}</span>
                <span class="keys"><kbd>Alt+I</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'حالت آهنربا (Magnet)' : 'Magnet Mode'}</span>
                <span class="keys"><kbd>Ctrl</kbd> ${isFa ? '(نگه‌داشتن)' : '(hold)'}</span>
              </div>
            </div>
          </div>

          <!-- Actions & History -->
          <div>
            <div style="font-size: 11px; font-weight: 800; color: var(--accent-gold); text-transform: uppercase; margin-bottom: 8px;">
              ${isFa ? 'عملیات و مدیریت پنجره‌ها' : 'Actions & Workspaces'}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="shortcut-row">
                <span>${isFa ? 'واگرد (Undo)' : 'Undo Action'}</span>
                <span class="keys"><kbd>Ctrl+Z</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'ازنو (Redo)' : 'Redo Action'}</span>
                <span class="keys"><kbd>Ctrl+Y</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'عکس از چارت' : 'Take Screenshot'}</span>
                <span class="keys"><kbd>Alt+S</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'حالت تمام‌صفحه' : 'Toggle Fullscreen'}</span>
                <span class="keys"><kbd>Shift+F</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'راهنمای میانبرها' : 'Show Shortcuts'}</span>
                <span class="keys"><kbd>?</kbd></span>
              </div>
              <div class="shortcut-row">
                <span>${isFa ? 'بستن پنجره‌ها / لغو ابزار' : 'Close / Deselect'}</span>
                <span class="keys"><kbd>Esc</kbd></span>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 10px 20px; font-size: 11px; color: var(--text-dim); background: var(--bg-darkest); border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <span>${isFa ? 'برای بستن کلید Esc را فشار دهید.' : 'Press ESC or click outside to dismiss.'}</span>
          <span style="color: var(--accent-cyan); font-weight: 700;">TradingView Parity</span>
        </div>
      </div>
    `;

    this.modalEl.querySelector('#modal-close-shortcuts')?.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });
  }
}
