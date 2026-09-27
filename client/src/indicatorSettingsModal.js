// client/src/indicatorSettingsModal.js
// Interactive Indicator Settings & Input Tuning Dialog (TradingView ⚙ Gear Model)
// Real-time reconfiguration of indicator lengths, factors, multipliers, sources, line colors and widths
// Supports both Native WebGL indicators (RSI, SMA, EMA, MACD, Volume...) and Custom Pine Scripts.

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
      this.app?.showToast?.(getLanguage() === 'fa' ? 'هیچ اندیکاتور فعالی روی چارت وجود ندارد' : 'No active indicators on chart.');
      return;
    }

    if (handleId && handles.has(handleId)) {
      this.selectedHandleId = handleId;
    } else {
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
    const orch = chart?.orchestrator;
    const handles = orch?.handles;

    if (!handles || !this.selectedHandleId) return;
    const handle = handles.get(this.selectedHandleId);
    if (!handle) return;

    const title = handle.title || 'Custom Indicator';
    const source = handle.source || '';

    // Extract live inputs and properties
    const liveInputs = orch?.inputValuesOf ? orch.inputValuesOf(this.selectedHandleId) : (handle.inputValues ? handle.inputValues() : {});
    const liveProps = orch?.propValuesOf ? orch.propValuesOf(this.selectedHandleId) : (handle.propValues ? handle.propValues() : {});

    // Common fallback regex if inputs not in liveInputs
    const lenMatch = source.match(/len(?:gth)?\s*=\s*(\d+)/i) || source.match(/ta\.(?:sma|ema|rsi|bb)\([^,]+,\s*(\d+)/i);
    const fallbackLen = lenMatch ? parseInt(lenMatch[1], 10) : 14;

    const factorMatch = source.match(/mult(?:iplier)?\s*=\s*([\d.]+)/i) || source.match(/supertrend\(([\d.]+)/i);
    const fallbackFactor = factorMatch ? parseFloat(factorMatch[1]) : 3.0;

    // Build list of inputs to render
    const inputEntries = Object.entries(liveInputs);
    const hasDynamicInputs = inputEntries.length > 0;

    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 540px; display: flex; flex-direction: column; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; ${isFa ? 'direction: rtl;' : 'direction: ltr;'}">
          <h3 style="display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 700; color: #fff;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan);">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span id="ind-settings-title">${title}</span>
          </h3>
          <button class="modal-close-btn" id="modal-close-ind-settings" style="cursor: pointer;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Indicator Switcher Dropdown -->
        <div style="padding: 10px 20px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 11px; color: var(--text-muted);">${isFa ? 'انتخاب اندیکاتور فعال:' : 'Active Indicator:'}</span>
          <select id="ind-select-handle" style="background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 12px; max-width: 280px;">
            ${Array.from(handles.entries()).map(([k, h]) => `
              <option value="${k}" ${k === this.selectedHandleId ? 'selected' : ''}>${h.title || k}</option>
            `).join('')}
          </select>
        </div>

        <!-- Navigation Tabs -->
        <div class="modal-tabs" style="padding: 0 20px; background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle); display: flex; gap: 8px;">
          <button class="modal-tab ${this.activeTab === 'inputs' ? 'active' : ''}" data-tab="inputs" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border: none; background: transparent; color: ${this.activeTab === 'inputs' ? 'var(--accent-cyan)' : 'var(--text-dim)'}; border-bottom: 2px solid ${this.activeTab === 'inputs' ? 'var(--accent-cyan)' : 'transparent'}; cursor: pointer;">
            ${isFa ? 'ورودی‌ها و پارامترها (Inputs)' : 'Inputs'}
          </button>
          <button class="modal-tab ${this.activeTab === 'style' ? 'active' : ''}" data-tab="style" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border: none; background: transparent; color: ${this.activeTab === 'style' ? 'var(--accent-cyan)' : 'var(--text-dim)'}; border-bottom: 2px solid ${this.activeTab === 'style' ? 'var(--accent-cyan)' : 'transparent'}; cursor: pointer;">
            ${isFa ? 'ظاهر و رنگ‌بندی (Style)' : 'Style'}
          </button>
        </div>

        <!-- Tab Contents -->
        <div class="modal-content" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; max-height: 55vh; overflow-y: auto;">
          ${this.activeTab === 'inputs' ? `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${hasDynamicInputs ? inputEntries.map(([key, val]) => {
                const label = this.formatInputLabel(key, isFa);
                if (typeof val === 'number') {
                  const isFloat = !Number.isInteger(val) || key.toLowerCase().includes('factor') || key.toLowerCase().includes('mult') || key.toLowerCase().includes('std');
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${label}</label>
                      <input type="number" class="dynamic-input num-ltr" data-key="${key}" value="${val}" step="${isFloat ? '0.1' : '1'}" min="${isFloat ? '0.01' : '1'}" style="width: 90px; height: 32px; text-align: center; font-size: 13px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px;" />
                    </div>
                  `;
                } else if (typeof val === 'string' && (val.toLowerCase() === 'close' || val.toLowerCase() === 'open' || val.toLowerCase() === 'high' || val.toLowerCase() === 'low' || val.toLowerCase() === 'hl2' || val.toLowerCase() === 'hlc3' || val.toLowerCase() === 'ohlc4')) {
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${label}</label>
                      <select class="dynamic-input" data-key="${key}" style="width: 120px; height: 32px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                        <option value="Close" ${val.toLowerCase() === 'close' ? 'selected' : ''}>Close</option>
                        <option value="Open" ${val.toLowerCase() === 'open' ? 'selected' : ''}>Open</option>
                        <option value="High" ${val.toLowerCase() === 'high' ? 'selected' : ''}>High</option>
                        <option value="Low" ${val.toLowerCase() === 'low' ? 'selected' : ''}>Low</option>
                        <option value="hl2" ${val.toLowerCase() === 'hl2' ? 'selected' : ''}>HL2</option>
                        <option value="hlc3" ${val.toLowerCase() === 'hlc3' ? 'selected' : ''}>HLC3</option>
                        <option value="ohlc4" ${val.toLowerCase() === 'ohlc4' ? 'selected' : ''}>OHLC4</option>
                      </select>
                    </div>
                  `;
                } else if (typeof val === 'string' && /^#[0-9a-fA-F]{6}$/i.test(val)) {
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${label}</label>
                      <input type="color" class="dynamic-input" data-key="${key}" value="${val}" style="width: 50px; height: 32px; border: none; background: transparent; cursor: pointer;" />
                    </div>
                  `;
                } else if (typeof val === 'boolean') {
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${label}</label>
                      <input type="checkbox" class="dynamic-input" data-key="${key}" ${val ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
                    </div>
                  `;
                } else {
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${label}</label>
                      <input type="text" class="dynamic-input" data-key="${key}" value="${val}" style="width: 120px; height: 32px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 12px;" />
                    </div>
                  `;
                }
              }).join('') : `
                <!-- Standard Fallback Controls for Custom Scripts -->
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'دوره تناوب (Length / Lookback):' : 'Period Length:'}</label>
                  <input type="number" id="input-ind-length" value="${fallbackLen}" min="1" max="500" class="num-ltr" style="width: 80px; height: 32px; text-align: center; font-size: 13px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px;" />
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'ضریب انحراف / Multiplier:' : 'Multiplier Factor:'}</label>
                  <input type="number" id="input-ind-factor" value="${fallbackFactor}" step="0.1" min="0.1" max="20" class="num-ltr" style="width: 80px; height: 32px; text-align: center; font-size: 13px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px;" />
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'منبع قیمت (Source Price):' : 'Price Source:'}</label>
                  <select id="input-ind-source" style="width: 110px; height: 32px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                    <option value="close" selected>Close</option>
                    <option value="open">Open</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                    <option value="hl2">HL2 (H+L)/2</option>
                    <option value="hlc3">HLC3</option>
                    <option value="ohlc4">OHLC4</option>
                  </select>
                </div>
              `}
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'رنگ اصلی / صعودی (Color / Bullish):' : 'Primary / Bullish Color:'}</label>
                <input type="color" id="style-ind-upcolor" value="${liveProps.color || liveProps.upColor || '#00F2B0'}" style="width: 50px; height: 32px; border: none; background: transparent; cursor: pointer;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'رنگ ثانویه / نزولی (Secondary / Bearish):' : 'Secondary / Bearish Color:'}</label>
                <input type="color" id="style-ind-downcolor" value="${liveProps.downColor || '#FF4D5B'}" style="width: 50px; height: 32px; border: none; background: transparent; cursor: pointer;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 12px; font-weight: 600; color: var(--text-main);">${isFa ? 'ضخامت خط ترسیم:' : 'Plot Line Width:'}</label>
                <select id="style-ind-linewidth" style="width: 100px; height: 32px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                  <option value="1" ${liveProps.linewidth == 1 ? 'selected' : ''}>1 px</option>
                  <option value="2" ${(!liveProps.linewidth || liveProps.linewidth == 2) ? 'selected' : ''}>2 px</option>
                  <option value="3" ${liveProps.linewidth == 3 ? 'selected' : ''}>3 px</option>
                  <option value="4" ${liveProps.linewidth == 4 ? 'selected' : ''}>4 px</option>
                </select>
              </div>
            </div>
          `}
        </div>

        <!-- Footer Actions -->
        <div style="padding: 12px 20px; background: var(--bg-darkest); border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <button id="btn-ind-remove" class="btn-secondary" style="color: var(--accent-red); border-color: rgba(255, 77, 91, 0.3); font-size: 11px; padding: 6px 12px; cursor: pointer;">
            ${isFa ? 'حذف از چارت ✕' : 'Remove from Chart ✕'}
          </button>
          <div style="display: flex; gap: 8px;">
            <button id="btn-ind-cancel" class="btn-secondary" style="font-size: 12px; padding: 6px 14px; cursor: pointer;">
              ${isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button id="btn-ind-apply" class="btn-primary" style="font-size: 12px; padding: 6px 16px; cursor: pointer;">
              ${isFa ? 'اعمال و ذخیره ✓' : 'Apply & Save ✓'}
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  formatInputLabel(key, isFa) {
    const k = String(key).toLowerCase();
    if (k === 'length' || k === 'len') return isFa ? 'دوره تناوب (Length):' : 'Length:';
    if (k === 'fastlength') return isFa ? 'دوره سریع (Fast Length):' : 'Fast Length:';
    if (k === 'slowlength') return isFa ? 'دوره آرام (Slow Length):' : 'Slow Length:';
    if (k === 'signalsmoothing' || k === 'signallength') return isFa ? 'هموارسازی سیگنال (Signal):' : 'Signal Smoothing:';
    if (k === 'factor' || k === 'mult' || k === 'multiplier') return isFa ? 'ضریب (Multiplier):' : 'Multiplier:';
    if (k === 'source') return isFa ? 'منبع قیمت (Source):' : 'Price Source:';
    if (k === 'color') return isFa ? 'رنگ اندیکاتور:' : 'Color:';
    if (k === 'malength') return isFa ? 'دوره میانگین (MA Length):' : 'MA Length:';
    return isFa ? `${key}:` : `${key.charAt(0).toUpperCase() + key.slice(1)}:`;
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
      const isFa = getLanguage() === 'fa';
      if (handle) {
        if (typeof handle.remove === 'function') {
          handle.remove();
        } else if (chart?.orchestrator?.removeIndicator) {
          chart.orchestrator.removeIndicator(this.selectedHandleId);
        }
        this.app?.layoutManager?.schedulePersist?.();
        this.app?.showToast?.(isFa ? 'اندیکاتور از چارت حذف شد' : 'Indicator removed', 'success');
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
    const orch = chart?.orchestrator;
    const handle = orch?.handles?.get(this.selectedHandleId);
    if (!handle) return;

    const isFa = getLanguage() === 'fa';
    const newInputs = {};

    // Collect dynamic inputs if present
    const dynInputs = this.modalEl.querySelectorAll('.dynamic-input');
    if (dynInputs && dynInputs.length > 0) {
      dynInputs.forEach(el => {
        const key = el.getAttribute('data-key');
        if (!key) return;
        if (el.type === 'checkbox') {
          newInputs[key] = el.checked;
        } else if (el.type === 'number') {
          newInputs[key] = parseFloat(el.value);
        } else {
          newInputs[key] = el.value;
        }
      });
    } else {
      const lenInput = this.modalEl.querySelector('#input-ind-length');
      const factorInput = this.modalEl.querySelector('#input-ind-factor');
      const sourceInput = this.modalEl.querySelector('#input-ind-source');
      if (lenInput) newInputs.length = parseInt(lenInput.value, 10);
      if (factorInput) newInputs.mult = parseFloat(factorInput.value);
      if (sourceInput) newInputs.source = sourceInput.value;
    }

    // Collect style props
    const upColorInput = this.modalEl.querySelector('#style-ind-upcolor');
    const downColorInput = this.modalEl.querySelector('#style-ind-downcolor');
    const lineWidthInput = this.modalEl.querySelector('#style-ind-linewidth');
    const newProps = {};
    if (upColorInput) newProps.color = upColorInput.value;
    if (downColorInput) newProps.downColor = downColorInput.value;
    if (lineWidthInput) newProps.linewidth = parseInt(lineWidthInput.value, 10);

    // Apply inputs to handle and orchestrator
    if (Object.keys(newInputs).length > 0) {
      if (typeof handle.setInputs === 'function') {
        try { handle.setInputs(newInputs); } catch (e) {}
      }
      if (orch?.applyInputs) {
        try { orch.applyInputs(this.selectedHandleId, newInputs); } catch (e) {}
      }
    }

    // Apply props to handle and orchestrator
    if (Object.keys(newProps).length > 0) {
      if (typeof handle.setProps === 'function') {
        try { handle.setProps(newProps); } catch (e) {}
      }
      if (orch?.applyProps) {
        try { orch.applyProps(this.selectedHandleId, newProps); } catch (e) {}
      }
    }

    // Also support source code rewriting for plain Pine scripts if needed
    let source = handle.source || '';
    if (source && (newInputs.length || newInputs.mult)) {
      if (newInputs.length) {
        source = source.replace(/len(?:gth)?\s*=\s*\d+/i, `len = ${newInputs.length}`);
        source = source.replace(/ta\.sma\(close,\s*\d+\)/i, `ta.sma(close, ${newInputs.length})`);
        source = source.replace(/ta\.ema\(close,\s*\d+\)/i, `ta.ema(close, ${newInputs.length})`);
        source = source.replace(/ta\.rsi\(close,\s*\d+\)/i, `ta.rsi(close, ${newInputs.length})`);
      }
      if (newInputs.mult) {
        source = source.replace(/ta\.supertrend\([\d.]+/i, `ta.supertrend(${newInputs.mult}`);
      }
      if (typeof handle.updateCode === 'function') {
        try { handle.updateCode(source); } catch (e) {}
      }
    }

    // Immediately schedule layout persistence
    this.app?.layoutManager?.schedulePersist?.();
    this.app?.showToast?.(isFa ? 'تنظیمات اندیکاتور با موفقیت اعمال شد' : 'Indicator settings updated', 'success');

    this.close();
  }
}
