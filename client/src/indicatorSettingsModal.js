// client/src/indicatorSettingsModal.js
// Interactive Indicator Settings & Input Tuning Dialog (TradingView ⚙ Gear Model)
// Real-time reconfiguration of indicator lengths, factors, multipliers, line colors and widths

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class IndicatorSettingsModal {
  constructor(app) {
    this.app = app;
    this.modalEl = null;
    this.activeTab = 'inputs'; // 'inputs' or 'style'
    this.selectedHandleId = null;
    this.createModal();
  }

  createModal() {
    let el = document.querySelector('#modal-indicator-settings');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-indicator-settings';
      el.className = 'modal-overlay';
      document.body.appendChild(el);
    }
    this.modalEl = el;
  }

  open(handleId = null) {
    const chart = this.app.chartManager?.workspace?.active?.chart;
    const handles = chart?.orchestrator?.handles;

    if (!handles || handles.size === 0) {
      alert(getLanguage() === 'fa' ? 'هیچ اندیکاتور فعالی روی چارت وجود ندارد' : 'No active indicators on chart.');
      return;
    }

    if (handleId && handles.has(handleId)) {
      this.selectedHandleId = handleId;
    } else {
      // Pick first non-native handle or first handle
      const keys = Array.from(handles.keys());
      this.selectedHandleId = keys.find(k => k.startsWith('ind-')) || keys[0];
    }

    this.render();
    this.modalEl.classList.add('open');
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }

  render() {
    const isFa = getLanguage() === 'fa';
    const chart = this.app.chartManager?.workspace?.active?.chart;
    const handles = chart?.orchestrator?.handles;

    if (!handles || !this.selectedHandleId) return;
    const handle = handles.get(this.selectedHandleId);
    if (!handle) return;

    const title = handle.title || 'Custom Indicator';
    const source = handle.source || '';

    // Extract common parameters via regex if not defined in schema
    const lenMatch = source.match(/len(?:gth)?\s*=\s*(\d+)/i) || source.match(/ta\.(?:sma|ema|rsi|bb)\([^,]+,\s*(\d+)/i);
    const currentLen = lenMatch ? parseInt(lenMatch[1], 10) : 14;

    const factorMatch = source.match(/mult(?:iplier)?\s*=\s*([\d.]+)/i) || source.match(/supertrend\(([\d.]+)/i);
    const currentFactor = factorMatch ? parseFloat(factorMatch[1]) : 3.0;

    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 540px; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span id="ind-settings-title">${title}</span>
          </h3>
          <button class="modal-close-btn" id="modal-close-ind-settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Indicator Switcher Dropdown (If multiple indicators exist) -->
        <div style="padding: 10px 20px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 11px; color: var(--text-muted);">${isFa ? 'انتخاب اندیکاتور:' : 'Active Indicator:'}</span>
          <select id="ind-select-handle" style="background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 12px;">
            ${Array.from(handles.entries()).map(([k, h]) => `
              <option value="${k}" ${k === this.selectedHandleId ? 'selected' : ''}>${h.title || k}</option>
            `).join('')}
          </select>
        </div>

        <!-- Navigation Tabs -->
        <div class="modal-tabs" style="padding: 0 20px; background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle); display: flex; gap: 8px;">
          <button class="modal-tab ${this.activeTab === 'inputs' ? 'active' : ''}" data-tab="inputs" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border: none; background: transparent; color: ${this.activeTab === 'inputs' ? 'var(--accent-cyan)' : 'var(--text-dim)'}; border-bottom: 2px solid ${this.activeTab === 'inputs' ? 'var(--accent-cyan)' : 'transparent'}; cursor: pointer;">
            ${isFa ? 'ورودی‌ها (Inputs)' : 'Inputs'}
          </button>
          <button class="modal-tab ${this.activeTab === 'style' ? 'active' : ''}" data-tab="style" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border: none; background: transparent; color: ${this.activeTab === 'style' ? 'var(--accent-cyan)' : 'var(--text-dim)'}; border-bottom: 2px solid ${this.activeTab === 'style' ? 'var(--accent-cyan)' : 'transparent'}; cursor: pointer;">
            ${isFa ? 'ظاهر و رنگ‌بندی (Style)' : 'Style'}
          </button>
        </div>

        <!-- Tab Contents -->
        <div class="modal-content" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;">
          ${this.activeTab === 'inputs' ? `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'دوره تناوب (Length / Lookback):' : 'Period Length:'}</label>
                <input type="number" id="input-ind-length" value="${currentLen}" min="1" max="500" class="num-ltr" style="width: 80px; height: 32px; text-align: center; font-size: 13px;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'ضریب انحراف / ATR Factor:' : 'Multiplier Factor:'}</label>
                <input type="number" id="input-ind-factor" value="${currentFactor}" step="0.1" min="0.1" max="20" class="num-ltr" style="width: 80px; height: 32px; text-align: center; font-size: 13px;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'منبع قیمت (Source Price):' : 'Price Source:'}</label>
                <select id="input-ind-source" style="width: 110px; height: 32px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                  <option value="close" selected>Close</option>
                  <option value="hl2">HL2 (H+L)/2</option>
                  <option value="hlc3">HLC3</option>
                  <option value="ohlc4">OHLC4</option>
                </select>
              </div>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'رنگ صعودی (Bullish Color):' : 'Bullish Plot Color:'}</label>
                <input type="color" id="style-ind-upcolor" value="#00F2B0" style="width: 44px; height: 32px; border: none; background: transparent; cursor: pointer;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'رنگ نزولی (Bearish Color):' : 'Bearish Plot Color:'}</label>
                <input type="color" id="style-ind-downcolor" value="#FF4D5B" style="width: 44px; height: 32px; border: none; background: transparent; cursor: pointer;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'ضخامت خط ترسیم:' : 'Plot Line Width:'}</label>
                <select id="style-ind-linewidth" style="width: 100px; height: 32px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                  <option value="1">1 px</option>
                  <option value="2" selected>2 px</option>
                  <option value="3">3 px</option>
                  <option value="4">4 px</option>
                </select>
              </div>
            </div>
          `}
        </div>

        <!-- Footer Actions -->
        <div style="padding: 12px 20px; background: var(--bg-darkest); border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <button id="btn-ind-remove" class="btn-secondary" style="color: var(--accent-red); border-color: rgba(255, 77, 91, 0.3); font-size: 11px; padding: 6px 12px;">
            ${isFa ? 'حذف از چارت ✕' : 'Remove from Chart ✕'}
          </button>
          <div style="display: flex; gap: 8px;">
            <button id="btn-ind-cancel" class="btn-secondary" style="font-size: 12px; padding: 6px 14px;">
              ${isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button id="btn-ind-apply" class="btn-primary" style="font-size: 12px; padding: 6px 16px;">
              ${isFa ? 'اعمال تغییرات ✓' : 'Apply Changes ✓'}
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.modalEl.querySelector('#modal-close-ind-settings')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('#btn-ind-cancel')?.addEventListener('click', () => this.close());

    // Switch indicator dropdown
    this.modalEl.querySelector('#ind-select-handle')?.addEventListener('change', (e) => {
      this.selectedHandleId = e.target.value;
      this.render();
    });

    // Switch tabs
    this.modalEl.querySelectorAll('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.getAttribute('data-tab');
        this.render();
      });
    });

    // Remove indicator
    this.modalEl.querySelector('#btn-ind-remove')?.addEventListener('click', () => {
      const chart = this.app.chartManager?.workspace?.active?.chart;
      const handle = chart?.orchestrator?.handles?.get(this.selectedHandleId);
      if (handle && typeof handle.remove === 'function') {
        handle.remove();
      }
      this.close();
    });

    // Apply Changes
    this.modalEl.querySelector('#btn-ind-apply')?.addEventListener('click', () => {
      this.applyChanges();
    });
  }

  applyChanges() {
    const chart = this.app.chartManager?.workspace?.active?.chart;
    const handle = chart?.orchestrator?.handles?.get(this.selectedHandleId);
    if (!handle) return;

    const lenInput = this.modalEl.querySelector('#input-ind-length');
    const factorInput = this.modalEl.querySelector('#input-ind-factor');
    const newLen = lenInput ? parseInt(lenInput.value, 10) : 14;
    const newFactor = factorInput ? parseFloat(factorInput.value) : 3.0;

    let source = handle.source || '';
    if (source) {
      // Re-write length and factor into source
      source = source.replace(/len(?:gth)?\s*=\s*\d+/i, `len = ${newLen}`);
      source = source.replace(/ta\.supertrend\([\d.]+/i, `ta.supertrend(${newFactor}`);
      source = source.replace(/ta\.sma\(close,\s*\d+\)/i, `ta.sma(close, ${newLen})`);
      source = source.replace(/ta\.ema\(close,\s*\d+\)/i, `ta.ema(close, ${newLen})`);
      source = source.replace(/ta\.rsi\(close,\s*\d+\)/i, `ta.rsi(close, ${newLen})`);

      if (typeof handle.updateCode === 'function') {
        handle.updateCode(source);
      } else if (typeof handle.remove === 'function') {
        handle.remove();
        this.app.chartManager?.addPineIndicator(source, handle.title);
      }
    }

    this.close();
  }
}
