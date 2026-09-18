// client/src/settingsModal.js
// Chart appearance, themes, colors, timezones, watermarks, and display settings modal (TradingView Parity)

import { getLanguage, t } from './i18n.js';

export class SettingsModal {
  constructor(options = {}) {
    this.modalEl = options.modalEl;
    this.onApplySettings = options.onApplySettings || (() => {});
    const saved = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
    this.settings = {
      theme: saved.theme || 'dark',
      bullColor: saved.bullColor || '#00F2B0',
      bearColor: saved.bearColor || '#FF4D5B',
      watermark: saved.watermark !== undefined ? saved.watermark : true,
      watermarkOpacity: saved.watermarkOpacity || 15,
      gridLines: saved.gridLines || 'both',
      gridColor: saved.gridColor || '#161922',
      scaleMode: saved.scaleMode || 'auto',
      timezone: saved.timezone || 'Etc/UTC',
      language: saved.language || getLanguage() || 'en'
    };
    this.render();
  }

  open() {
    this.render();
    if (this.modalEl) this.modalEl.classList.add('open');
  }

  close() {
    if (this.modalEl) this.modalEl.classList.remove('open');
  }

  render() {
    if (!this.modalEl) return;
    const isFa = getLanguage() === 'fa';

    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 540px; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            ${isFa ? 'تنظیمات جامع و ظاهر چارت' : 'Chart Settings & Visual Preferences'}
          </h3>
          <button class="modal-close-btn" id="modal-close-settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-content" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding: 18px 24px;">
          <!-- 1. Candlestick Colors -->
          <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 10px;">${isFa ? 'ظاهر و رنگ کندل‌ها' : 'Candlestick Appearance'}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'کندل صعودی (Bullish)' : 'Bullish Candle Body & Wick'}</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="color" id="cfg-bull-color" value="${this.settings.bullColor}" style="width: 32px; height: 32px; border: none; background: transparent; cursor: pointer;" />
                  <span style="font-size: 11px; font-family: var(--font-mono); color: #fff;">${this.settings.bullColor}</span>
                </div>
              </div>
              <div>
                <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'کندل نزولی (Bearish)' : 'Bearish Candle Body & Wick'}</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="color" id="cfg-bear-color" value="${this.settings.bearColor}" style="width: 32px; height: 32px; border: none; background: transparent; cursor: pointer;" />
                  <span style="font-size: 11px; font-family: var(--font-mono); color: #fff;">${this.settings.bearColor}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Background Watermark -->
          <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="font-size: 12px; font-weight: 700; color: #fff;">${isFa ? 'واترمارک پس‌زمینه نماد' : 'Background Symbol Watermark'}</div>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); cursor: pointer;">
                <input type="checkbox" id="cfg-watermark-toggle" ${this.settings.watermark ? 'checked' : ''} style="cursor: pointer;" />
                <span>${isFa ? 'نمایش واترمارک' : 'Enabled'}</span>
              </label>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-dim);">
              <span>${isFa ? 'میزان شفافیت:' : 'Opacity:'}</span>
              <input type="range" id="cfg-watermark-opacity" min="5" max="50" value="${this.settings.watermarkOpacity}" style="flex: 1; cursor: pointer;" />
              <span id="cfg-watermark-val" class="num-ltr" style="font-family: var(--font-mono);">${this.settings.watermarkOpacity}%</span>
            </div>
          </div>

          <!-- 3. Timezone & Grid Lines -->
          <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'منطقه زمانی چارت' : 'Chart Timezone'}</label>
              <select id="cfg-timezone-select" style="width: 100%; font-size: 11px; padding: 4px 6px; background: var(--bg-darkest); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px;">
                <option value="Etc/UTC" ${this.settings.timezone === 'Etc/UTC' ? 'selected' : ''}>UTC (Universal Time)</option>
                <option value="America/New_York" ${this.settings.timezone === 'America/New_York' ? 'selected' : ''}>New York (Wall St)</option>
                <option value="Europe/London" ${this.settings.timezone === 'Europe/London' ? 'selected' : ''}>London (LSE)</option>
                <option value="Europe/Frankfurt" ${this.settings.timezone === 'Europe/Frankfurt' ? 'selected' : ''}>Frankfurt (XETRA)</option>
                <option value="Asia/Tokyo" ${this.settings.timezone === 'Asia/Tokyo' ? 'selected' : ''}>Tokyo (JPX)</option>
                <option value="Asia/Singapore" ${this.settings.timezone === 'Asia/Singapore' ? 'selected' : ''}>Singapore (SGX)</option>
                <option value="Asia/Dubai" ${this.settings.timezone === 'Asia/Dubai' ? 'selected' : ''}>Dubai (DFM)</option>
                <option value="Asia/Tehran" ${this.settings.timezone === 'Asia/Tehran' ? 'selected' : ''}>Tehran (TSETMC)</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'خطوط گرید' : 'Grid Lines'}</label>
              <select id="cfg-grid-select" style="width: 100%; font-size: 11px; padding: 4px 6px; background: var(--bg-darkest); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px;">
                <option value="both" ${this.settings.gridLines === 'both' ? 'selected' : ''}>${isFa ? 'افقی و عمودی' : 'Horizontal & Vertical'}</option>
                <option value="horizontal" ${this.settings.gridLines === 'horizontal' ? 'selected' : ''}>${isFa ? 'فقط افقی' : 'Horizontal Only'}</option>
                <option value="vertical" ${this.settings.gridLines === 'vertical' ? 'selected' : ''}>${isFa ? 'فقط عمودی' : 'Vertical Only'}</option>
                <option value="none" ${this.settings.gridLines === 'none' ? 'selected' : ''}>${isFa ? 'بدون گرید (Dark OLED)' : 'None (Clean)'}</option>
              </select>
            </div>
          </div>

          <!-- 4. Theme & Language -->
          <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'تم رنگی بستر' : 'Color Theme'}</label>
              <select id="cfg-theme-select" style="width: 100%; font-size: 11px; padding: 4px 6px; background: var(--bg-darkest); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px;">
                <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Obsidian Dark (Default)</option>
                <option value="slate" ${this.settings.theme === 'slate' ? 'selected' : ''}>Deep Slate</option>
                <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Clean Light</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'زبان رابط کاربری' : 'Interface Language'}</label>
              <select id="cfg-lang-select" style="width: 100%; font-size: 11px; padding: 4px 6px; background: var(--bg-darkest); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px;">
                <option value="en" ${this.settings.language === 'en' ? 'selected' : ''}>English</option>
                <option value="fa" ${this.settings.language === 'fa' ? 'selected' : ''}>فارسی (Persian)</option>
              </select>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button id="btn-settings-cancel" class="btn-secondary" style="padding: 6px 14px; font-size: 11px;">${isFa ? 'انصراف' : 'Cancel'}</button>
            <button id="btn-settings-save" class="btn-primary" style="padding: 6px 18px; font-size: 11px;">${isFa ? 'ذخیره تنظیمات' : 'Save Settings'}</button>
          </div>
        </div>
      </div>
    `;

    const closeBtn = this.modalEl.querySelector('#modal-close-settings');
    const cancelBtn = this.modalEl.querySelector('#btn-settings-cancel');
    const saveBtn = this.modalEl.querySelector('#btn-settings-save');
    const opacitySlider = this.modalEl.querySelector('#cfg-watermark-opacity');
    const opacityVal = this.modalEl.querySelector('#cfg-watermark-val');

    opacitySlider?.addEventListener('input', (e) => {
      if (opacityVal) opacityVal.textContent = `${e.target.value}%`;
    });

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    saveBtn?.addEventListener('click', () => {
      this.settings.bullColor = this.modalEl.querySelector('#cfg-bull-color').value;
      this.settings.bearColor = this.modalEl.querySelector('#cfg-bear-color').value;
      this.settings.watermark = this.modalEl.querySelector('#cfg-watermark-toggle').checked;
      this.settings.watermarkOpacity = parseInt(this.modalEl.querySelector('#cfg-watermark-opacity').value, 10);
      this.settings.timezone = this.modalEl.querySelector('#cfg-timezone-select').value;
      this.settings.gridLines = this.modalEl.querySelector('#cfg-grid-select').value;
      this.settings.theme = this.modalEl.querySelector('#cfg-theme-select').value;
      this.settings.language = this.modalEl.querySelector('#cfg-lang-select').value;

      localStorage.setItem('tradingchart_user_settings', JSON.stringify(this.settings));
      this.onApplySettings(this.settings);
      this.close();
    });
  }
}
