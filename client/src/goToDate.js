// client/src/goToDate.js
// TradingView-parity "Go to Date" dialog (Alt+G) — jumps the active chart to a
// specific date/time, framing a sensible window around it. Uses Vela's native
// chart.setVisibleRange (epoch-ms), so indicators/drawings stay intact.

import { getLanguage } from './i18n.js';

export class GoToDateModal {
  constructor(app) {
    this.app = app;
    this.el = null;
    this.mount();
  }

  mount() {
    let el = document.querySelector('#goto-date-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'goto-date-modal';
      el.className = 'modal-overlay';
      document.body.appendChild(el);
    }
    this.el = el;
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        this.open();
      }
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() { return this.el.classList.contains('open'); }

  open() {
    const isFa = getLanguage() === 'fa';
    const now = new Date();
    const def = new Date(now.getTime() - 7 * 86400000);
    const toLocalInput = (d) => {
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    this.el.innerHTML = `
      <div class="modal-box" dir="${isFa ? 'rtl' : 'ltr'}" style="width: 380px; max-width: 92vw;">
        <div class="modal-header">
          <div style="font-weight:700;font-size:14px;">${isFa ? 'برو به تاریخ (Go to Date)' : 'Go to Date'}</div>
          <button class="modal-close-btn" id="gtd-close">✕</button>
        </div>
        <div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'تاریخ و زمان مقصد' : 'Target date & time'}</label>
            <input type="datetime-local" id="gtd-input" value="${toLocalInput(def)}" style="width: 100%; padding: 8px 10px; font-size: 13px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${[
              ['1h-ago', isFa ? '۱ ساعت پیش' : '1h ago', 3600000],
              ['1d-ago', isFa ? 'دیروز' : '1d ago', 86400000],
              ['1w-ago', isFa ? 'هفته پیش' : '1w ago', 7 * 86400000],
              ['1m-ago', isFa ? 'ماه پیش' : '1M ago', 30 * 86400000],
              ['ytd', isFa ? 'ابتدای سال' : 'YTD', 'ytd'],
            ].map(([k, label, off]) => `<button class="btn-secondary gtd-quick" data-off="${off}" style="padding: 4px 10px; font-size: 11px;">${label}</button>`).join('')}
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button class="btn-secondary" id="gtd-cancel" style="padding: 6px 14px; font-size: 12px;">${isFa ? 'انصراف' : 'Cancel'}</button>
            <button class="btn-primary" id="gtd-apply" style="padding: 6px 16px; font-size: 12px;">${isFa ? 'برو به تاریخ' : 'Go'}</button>
          </div>
        </div>
      </div>`;

    this.el.classList.add('open');
    setTimeout(() => this.el.querySelector('#gtd-input')?.focus(), 50);

    this.el.querySelector('#gtd-close')?.addEventListener('click', () => this.close());
    this.el.querySelector('#gtd-cancel')?.addEventListener('click', () => this.close());
    this.el.addEventListener('mousedown', (e) => { if (e.target === this.el) this.close(); });
    this.el.querySelectorAll('.gtd-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        const off = btn.dataset.off;
        const d = off === 'ytd' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getTime() - Number(off));
        this.el.querySelector('#gtd-input').value = toLocalInput(d);
      });
    });
    this.el.querySelector('#gtd-apply')?.addEventListener('click', () => this.apply());
    this.el.querySelector('#gtd-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.apply(); });
  }

  apply() {
    const val = this.el.querySelector('#gtd-input')?.value;
    if (!val) return;
    const target = new Date(val).getTime();
    if (isNaN(target)) return;
    const cell = this.app?.chartManager?.workspace?.active;
    const chart = cell?.chart;
    if (!chart?.setVisibleRange) { this.close(); return; }
    // Frame a window ending shortly after the target so the date lands in view.
    const tfMs = this.tfMs();
    const barsVisible = 120;
    const span = tfMs * barsVisible;
    const to = target + Math.floor(span * 0.2);
    const from = to - span;
    try { chart.setVisibleRange({ from, to }); } catch (e) { console.warn('[GoToDate]', e.message); }
    this.close();
  }

  tfMs() {
    const tf = String(this.app?.currentTimeframe || '60');
    const m = { '1s': 1e3, '1': 6e4, '3': 18e4, '5': 3e5, '15': 9e5, '30': 18e5, '45': 27e5, '60': 36e5, '120': 72e5, '180': 108e5, '240': 144e5, 'D': 864e5, 'W': 6048e5, 'M': 2592e6 };
    return m[tf] || 36e5;
  }

  close() { this.el.classList.remove('open'); }
}
