// client/src/timeframeManager.js
// Custom Timeframe Builder & Timeframe Favorites Manager (TradingView Parity)
// Enables traders to create non-standard timeframes (e.g. 7m, 45m, 2h, 3D) and star favorites

import { getLanguage, t, toPersianDigits } from './i18n.js';

export const STANDARD_TIMEFRAMES = [
  { id: '1s', label: '1s', name: '1 Second', nameFa: '۱ ثانیه', category: 'seconds', favorite: false },
  { id: '1', label: '1m', name: '1 Minute', nameFa: '۱ دقیقه', category: 'minutes', favorite: true },
  { id: '3', label: '3m', name: '3 Minutes', nameFa: '۳ دقیقه', category: 'minutes', favorite: false },
  { id: '5', label: '5m', name: '5 Minutes', nameFa: '۵ دقیقه', category: 'minutes', favorite: true },
  { id: '15', label: '15m', name: '15 Minutes', nameFa: '۱۵ دقیقه', category: 'minutes', favorite: true },
  { id: '30', label: '30m', name: '30 Minutes', nameFa: '۳۰ دقیقه', category: 'minutes', favorite: false },
  { id: '45', label: '45m', name: '45 Minutes', nameFa: '۴۵ دقیقه', category: 'minutes', favorite: false },
  { id: '60', label: '1h', name: '1 Hour', nameFa: '۱ ساعت', category: 'hours', favorite: true },
  { id: '120', label: '2h', name: '2 Hours', nameFa: '۲ ساعت', category: 'hours', favorite: false },
  { id: '240', label: '4h', name: '4 Hours', nameFa: '۴ ساعت', category: 'hours', favorite: true },
  { id: 'D', label: '1D', name: '1 Day', nameFa: '۱ روز', category: 'days', favorite: true },
  { id: 'W', label: '1W', name: '1 Week', nameFa: '۱ هفته', category: 'days', favorite: true },
  { id: 'M', label: '1M', name: '1 Month', nameFa: '۱ ماه', category: 'months', favorite: false }
];

export class TimeframeManager {
  constructor(app) {
    this.app = app;
    this.modalEl = null;
    this.storageKey = 'tradingchart_custom_timeframes';
    this.customTimeframes = this.loadCustomTimeframes();
    this.createModal();
  }

  loadCustomTimeframes() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  saveCustomTimeframes() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.customTimeframes));
    } catch (e) {}
  }

  createModal() {
    let el = document.querySelector('#modal-timeframes, #modal-custom-timeframe');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-timeframes';
      el.className = 'modal-overlay modal-custom-timeframe';
      document.body.appendChild(el);
    } else {
      el.classList.add('modal-custom-timeframe');
    }
    this.modalEl = el;
  }

  open() {
    if (this.modalEl) {
      this.render();
      this.modalEl.classList.add('open');
    }
  }

  openCustomModal() {
    this.open();
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }

  setTimeframe(id) {
    const tfStr = String(id);
    if (this.app) {
      if (typeof this.app.setTimeframe === 'function') {
        this.app.setTimeframe(tfStr);
      } else {
        this.app.currentTimeframe = tfStr;
        this.app.chartManager?.setTimeframe?.(tfStr);
        this.app.loadActiveCandles?.();
      }
    }
    this.close();
  }

  render() {
    const isFa = getLanguage() === 'fa';
    const currentTf = String(this.app?.currentTimeframe || '60');

    const allList = [...STANDARD_TIMEFRAMES, ...this.customTimeframes];

    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 500px; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span id="tf-modal-title">${isFa ? 'تایم‌فریم‌ها و بازه‌های سفارشی (Timeframes)' : 'Select & Build Timeframes'}</span>
          </h3>
          <button class="modal-close-btn" id="modal-close-timeframes">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-content" style="flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 14px;">
          <!-- Quick Selector Grid -->
          <div>
            <div style="font-size: 11px; font-weight: 800; color: var(--accent-cyan); text-transform: uppercase; margin-bottom: 8px;">
              ${isFa ? 'تایم‌فریم‌های استاندارد' : 'Standard Intervals'}
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
              ${STANDARD_TIMEFRAMES.map(tf => `
                <button class="btn-select-tf ${tf.id === currentTf ? 'active' : ''}" data-id="${tf.id}" style="padding: 8px 4px; font-size: 12px; font-weight: 700; border-radius: 4px; border: 1px solid ${tf.id === currentTf ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; background: ${tf.id === currentTf ? 'rgba(0, 242, 176, 0.1)' : 'var(--bg-card)'}; color: ${tf.id === currentTf ? 'var(--accent-cyan)' : '#fff'}; cursor: pointer;">
                  ${tf.label} <span style="font-size: 10px; opacity: 0.7;">(${isFa ? tf.nameFa : tf.name})</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Custom Timeframe Builder -->
          <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: var(--accent-gold); text-transform: uppercase; margin-bottom: 8px;">
              + ${isFa ? 'ساخت تایم‌فریم سفارشی' : 'Add Custom Interval'}
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="number" id="input-custom-tf-val" value="10" min="1" max="1000" class="num-ltr" style="width: 80px; height: 34px; text-align: center; font-size: 13px;" />
              <select id="select-custom-tf-unit" style="flex: 1; height: 34px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                <option value="m">${isFa ? 'دقیقه (Minutes)' : 'Minutes'}</option>
                <option value="h">${isFa ? 'ساعت (Hours)' : 'Hours'}</option>
                <option value="D">${isFa ? 'روز (Days)' : 'Days'}</option>
              </select>
              <button id="btn-add-custom-tf" class="btn-primary" style="font-size: 12px; padding: 0 16px; height: 34px; font-weight: 700;">
                + ${isFa ? 'افزودن' : 'Add'}
              </button>
            </div>
          </div>

          <!-- Custom Timeframes List -->
          ${this.customTimeframes.length > 0 ? `
            <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
              <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); margin-bottom: 8px;">
                ${isFa ? 'تایم‌فریم‌های سفارشی شما' : 'Your Custom Intervals'}
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${this.customTimeframes.map(ctf => `
                  <div style="display: inline-flex; align-items: center; gap: 6px; background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    <span class="btn-select-tf" data-id="${ctf.id}" style="font-weight: 700; color: var(--accent-cyan); cursor: pointer;">${ctf.label}</span>
                    <button class="btn-delete-custom-tf" data-id="${ctf.id}" style="background: transparent; border: none; color: var(--accent-red); cursor: pointer; padding: 2px 6px; min-width: 22px; min-height: 22px; font-size: 12px; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center;" title="${isFa ? 'حذف این تایم‌فریم سفارشی' : 'Delete custom timeframe'}" aria-label="Delete custom timeframe">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.modalEl.querySelector('#modal-close-timeframes')?.addEventListener('click', () => this.close());

    // Select timeframe
    this.modalEl.querySelectorAll('.btn-select-tf').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.setTimeframe(id);
      });
    });

    // Add custom timeframe
    this.modalEl.querySelector('#btn-add-custom-tf')?.addEventListener('click', () => {
      const valInput = this.modalEl.querySelector('#input-custom-tf-val');
      const unitSelect = this.modalEl.querySelector('#select-custom-tf-unit');
      const val = parseInt(valInput?.value, 10) || 10;
      const unit = unitSelect?.value || 'm';

      let id = '';
      let label = '';
      if (unit === 'm') {
        id = String(val);
        label = `${val}m`;
      } else if (unit === 'h') {
        id = String(val * 60);
        label = `${val}h`;
      } else if (unit === 'D') {
        id = val === 1 ? 'D' : `${val}D`;
        label = `${val}D`;
      }

      if (!this.customTimeframes.find(x => x.id === id)) {
        this.customTimeframes.push({
          id,
          label,
          name: `${val} ${unit}`,
          nameFa: `${val} ${unit}`
        });
        this.saveCustomTimeframes();
      }

      this.setTimeframe(id);
    });

    // Delete custom timeframe
    this.modalEl.querySelectorAll('.btn-delete-custom-tf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetBtn = e.target.closest('.btn-delete-custom-tf');
        const id = targetBtn?.getAttribute('data-id') || btn.getAttribute('data-id');
        if (!id) return;
        this.customTimeframes = this.customTimeframes.filter(x => x.id !== id);
        this.saveCustomTimeframes();
        this.render();
      });
    });
  }
}
