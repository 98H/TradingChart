// client/src/settingsModal.js
// TradingView-Grade Tabbed Chart Settings & Visual Configuration Suite
// Features 4 Category Tabs (Appearance, Scales & Grid, Trading & Audio, System & Language)

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class SettingsModal {
  constructor(options = {}) {
    this.modalEl = options.modalEl;
    this.onApplySettings = options.onApplySettings || (() => {});
    this.activeTab = 'appearance'; // 'appearance', 'scales', 'trading', 'system'

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
      language: saved.language || getLanguage() || 'en',
      soundEffects: saved.soundEffects !== undefined ? saved.soundEffects : true,
      orderConfirm: saved.orderConfirm !== undefined ? saved.orderConfirm : false,
      countdownEnabled: saved.countdownEnabled !== undefined ? saved.countdownEnabled : true
    };

    this.render();
  }

  open(tab = null) {
    if (tab) this.activeTab = tab;
    this.render();
    if (this.modalEl) this.modalEl.classList.add('open');
  }

  close() {
    if (this.modalEl) this.modalEl.classList.remove('open');
  }

  setTab(tab) {
    this.activeTab = tab;
    this.render();
  }

  render() {
    if (!this.modalEl) return;
    const isFa = getLanguage() === 'fa';

    this.modalEl.innerHTML = `
      <div class="modal-box settings-modal-box" style="width: 580px; max-height: 90vh; display: flex; flex-direction: column; ${isFa ? 'direction: rtl; text-align: right; font-family: var(--font-persian), sans-serif;' : 'direction: ltr; text-align: left;'}">
        <!-- Header -->
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-darkest); ${isFa ? 'direction: rtl;' : 'direction: ltr;'}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan);"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <h3 class="modal-title" style="margin: 0; font-size: 14px; font-weight: 700; color: #fff;">
              ${isFa ? 'تنظیمات جامع و ظاهر چارت' : 'Chart Settings & Visual Preferences'}
            </h3>
          </div>
          <button class="modal-close-btn" id="modal-close-settings" style="${isFa ? 'order: -1;' : ''}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Category Tabs Bar -->
        <div class="settings-tabs-bar" style="display: flex; gap: 4px; padding: 8px 16px; background: rgba(15, 20, 30, 0.95); border-bottom: 1px solid var(--border-subtle); overflow-x: auto;">
          <button class="settings-tab-btn ${this.activeTab === 'appearance' ? 'active' : ''}" data-tab="appearance" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid ${this.activeTab === 'appearance' ? 'var(--accent-cyan)' : 'transparent'}; background: ${this.activeTab === 'appearance' ? 'rgba(0,242,176,0.12)' : 'transparent'}; color: ${this.activeTab === 'appearance' ? '#fff' : 'var(--text-dim)'}; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>🕯️</span> ${isFa ? 'ظاهر و کندل‌ها' : 'Appearance'}
          </button>
          <button class="settings-tab-btn ${this.activeTab === 'scales' ? 'active' : ''}" data-tab="scales" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid ${this.activeTab === 'scales' ? 'var(--accent-cyan)' : 'transparent'}; background: ${this.activeTab === 'scales' ? 'rgba(0,242,176,0.12)' : 'transparent'}; color: ${this.activeTab === 'scales' ? '#fff' : 'var(--text-dim)'}; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>📐</span> ${isFa ? 'مقیاس و شبکه' : 'Scales & Grid'}
          </button>
          <button class="settings-tab-btn ${this.activeTab === 'trading' ? 'active' : ''}" data-tab="trading" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid ${this.activeTab === 'trading' ? 'var(--accent-cyan)' : 'transparent'}; background: ${this.activeTab === 'trading' ? 'rgba(0,242,176,0.12)' : 'transparent'}; color: ${this.activeTab === 'trading' ? '#fff' : 'var(--text-dim)'}; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>⚡</span> ${isFa ? 'معاملات و صدا' : 'Trading & Audio'}
          </button>
          <button class="settings-tab-btn ${this.activeTab === 'system' ? 'active' : ''}" data-tab="system" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid ${this.activeTab === 'system' ? 'var(--accent-cyan)' : 'transparent'}; background: ${this.activeTab === 'system' ? 'rgba(0,242,176,0.12)' : 'transparent'}; color: ${this.activeTab === 'system' ? '#fff' : 'var(--text-dim)'}; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>🌐</span> ${isFa ? 'سیستم و زبان' : 'System & Language'}
          </button>
        </div>

        <!-- Body -->
        <div class="modal-content" style="display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding: 20px 24px;">
          ${this.renderTabContent(isFa)}
        </div>

        <!-- Footer -->
        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 12px 20px; background: var(--bg-darkest); border-top: 1px solid var(--border-subtle); ${isFa ? 'direction: rtl;' : 'direction: ltr;'}">
          <button id="btn-settings-cancel" class="btn-secondary" style="padding: 6px 14px; font-size: 11px;">${isFa ? 'انصراف' : 'Cancel'}</button>
          <button id="btn-settings-save" class="btn-primary" style="padding: 6px 20px; font-size: 11px; font-weight: 800; background: var(--accent-cyan); color: #000;">${isFa ? 'ذخیره تنظیمات' : 'Save Settings'}</button>
        </div>
      </div>
    `;

    this.bindEvents(isFa);
  }

  renderTabContent(isFa) {
    if (this.activeTab === 'appearance') {
      return `
        <!-- Candlestick Colors Section -->
        <div style="background: var(--bg-card); padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border-subtle);">
          <div style="font-size: 12px; font-weight: 800; color: #fff; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <span>🕯️</span> ${isFa ? 'رنگ‌بندی کندل‌های قیمتی' : 'Candlestick Color Scheme'}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 6px;">${isFa ? 'کندل صعودی (Bullish)' : 'Bullish Candle Body & Wick'}</label>
              <div style="display: flex; align-items: center; gap: 10px; background: var(--bg-surface); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                <input type="color" id="cfg-bull-color" value="${this.settings.bullColor}" style="width: 28px; height: 28px; border: none; background: transparent; cursor: pointer; border-radius: 4px;" />
                <span style="font-size: 11px; font-family: var(--font-mono); font-weight: 700; color: #fff;" class="num-ltr">${this.settings.bullColor}</span>
              </div>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 6px;">${isFa ? 'کندل نزولی (Bearish)' : 'Bearish Candle Body & Wick'}</label>
              <div style="display: flex; align-items: center; gap: 10px; background: var(--bg-surface); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                <input type="color" id="cfg-bear-color" value="${this.settings.bearColor}" style="width: 28px; height: 28px; border: none; background: transparent; cursor: pointer; border-radius: 4px;" />
                <span style="font-size: 11px; font-family: var(--font-mono); font-weight: 700; color: #fff;" class="num-ltr">${this.settings.bearColor}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Watermark Section -->
        <div style="background: var(--bg-card); padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>🪪</span> ${isFa ? 'واترمارک پس‌زمینه نماد' : 'Background Symbol Watermark'}
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: var(--text-base); cursor: pointer;">
              <input type="checkbox" id="cfg-watermark-toggle" ${this.settings.watermark ? 'checked' : ''} style="accent-color: var(--accent-cyan); width: 15px; height: 15px; cursor: pointer;" />
              <span>${isFa ? 'فعال' : 'Enabled'}</span>
            </label>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-dim); background: var(--bg-surface); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-subtle);">
            <span>${isFa ? 'میزان شفافیت:' : 'Opacity:'}</span>
            <input type="range" id="cfg-watermark-opacity" min="5" max="50" value="${this.settings.watermarkOpacity}" style="flex: 1; accent-color: var(--accent-cyan); cursor: pointer;" />
            <input type="number" id="cfg-watermark-num" min="5" max="50" value="${this.settings.watermarkOpacity}" style="width: 44px; background: var(--bg-darkest); border: 1px solid var(--border-subtle); color: #fff; text-align: center; border-radius: 4px; font-size: 11px; font-family: var(--font-mono);" class="num-ltr" />
            <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-dim);">%</span>
          </div>
        </div>
      `;
    } else if (this.activeTab === 'scales') {
      return `
        <!-- Timezone & Grids -->
        <div style="background: var(--bg-card); padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border-subtle); display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 6px;">${isFa ? 'منطقه زمانی چارت' : 'Chart Timezone'}</label>
            <select id="cfg-timezone-select" style="width: 100%; font-size: 11px; padding: 6px 10px; background: var(--bg-darkest); border: 1px solid var(--border-subtle); color: #fff; border-radius: 6px;">
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
            <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 6px;">${isFa ? 'خطوط شبکه پس‌زمینه' : 'Grid Lines'}</label>
            <select id="cfg-grid-select" style="width: 100%; font-size: 11px; padding: 6px 10px; background: var(--bg-darkest); border: 1px solid var(--border-subtle); color: #fff; border-radius: 6px;">
              <option value="both" ${this.settings.gridLines === 'both' ? 'selected' : ''}>${isFa ? 'افقی و عمودی' : 'Horizontal & Vertical'}</option>
              <option value="horizontal" ${this.settings.gridLines === 'horizontal' ? 'selected' : ''}>${isFa ? 'فقط افقی' : 'Horizontal Only'}</option>
              <option value="vertical" ${this.settings.gridLines === 'vertical' ? 'selected' : ''}>${isFa ? 'فقط عمودی' : 'Vertical Only'}</option>
              <option value="none" ${this.settings.gridLines === 'none' ? 'selected' : ''}>${isFa ? 'بدون گرید (Dark OLED)' : 'None (Clean)'}</option>
            </select>
          </div>
        </div>

        <div style="background: var(--bg-card); padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 12px; font-weight: 800; color: #fff;">${isFa ? 'رفتار مقیاس قیمت' : 'Price Scale Behavior'}</div>
          <label style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-base); cursor: pointer;">
            <span>${isFa ? 'شمارش معکوس تا بسته شدن کندل جاری' : 'Countdown to Bar Close on Price Scale'}</span>
            <input type="checkbox" id="cfg-countdown-toggle" ${this.settings.countdownEnabled ? 'checked' : ''} style="accent-color: var(--accent-cyan); width: 15px; height: 15px; cursor: pointer;" />
          </label>
        </div>
      `;
    } else if (this.activeTab === 'trading') {
      return `
        <!-- Audio & Order Confirmation -->
        <div style="background: var(--bg-card); padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 12px; font-weight: 800; color: #fff;">${isFa ? 'جلوه‌های صوتی معاملات و هشدارها' : 'Web Audio Feedback (Orders & Alerts)'}</div>
              <div style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">${isFa ? 'پخش صدای تایید در هنگام اجرای اردر یا فعال شدن آلرت' : 'Synthesized chime triggers on market fills and price threshold hits'}</div>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: var(--text-base); cursor: pointer;">
              <input type="checkbox" id="cfg-sound-toggle" ${this.settings.soundEffects ? 'checked' : ''} style="accent-color: var(--accent-cyan); width: 15px; height: 15px; cursor: pointer;" />
              <span>${isFa ? 'فعال' : 'Enabled'}</span>
            </label>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 12px; font-weight: 800; color: #fff;">${isFa ? 'تاییدیه سفارش قبل از اجرا' : 'Order Execution Confirmation Dialog'}</div>
              <div style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">${isFa ? 'نمایش پاپ‌آپ تاییدیه قبل از ارسال سفارش به مارکت' : 'Prompt for verification before submitting orders'}</div>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: var(--text-base); cursor: pointer;">
              <input type="checkbox" id="cfg-confirm-toggle" ${this.settings.orderConfirm ? 'checked' : ''} style="accent-color: var(--accent-cyan); width: 15px; height: 15px; cursor: pointer;" />
              <span>${isFa ? 'فعال' : 'Enabled'}</span>
            </label>
          </div>
        </div>
      `;
    } else {
      return `
        <!-- System & Language -->
        <div style="background: var(--bg-card); padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border-subtle); display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 6px;">${isFa ? 'تم رنگی بستر' : 'Color Theme'}</label>
            <select id="cfg-theme-select" style="width: 100%; font-size: 11px; padding: 6px 10px; background: var(--bg-darkest); border: 1px solid var(--border-subtle); color: #fff; border-radius: 6px;">
              <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Obsidian Dark (Default)</option>
              <option value="slate" ${this.settings.theme === 'slate' ? 'selected' : ''}>Deep Slate</option>
              <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Clean Light</option>
            </select>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 6px;">${isFa ? 'زبان رابط کاربری' : 'Interface Language'}</label>
            <select id="cfg-lang-select" style="width: 100%; font-size: 11px; padding: 6px 10px; background: var(--bg-darkest); border: 1px solid var(--border-subtle); color: #fff; border-radius: 6px;">
              <option value="en" ${this.settings.language === 'en' ? 'selected' : ''}>English (LTR)</option>
              <option value="fa" ${this.settings.language === 'fa' ? 'selected' : ''}>فارسی (Persian RTL)</option>
            </select>
          </div>
        </div>
      `;
    }
  }

  bindEvents(isFa) {
    const closeBtn = this.modalEl.querySelector('#modal-close-settings');
    const cancelBtn = this.modalEl.querySelector('#btn-settings-cancel');
    const saveBtn = this.modalEl.querySelector('#btn-settings-save');

    // Tab buttons
    this.modalEl.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.setTab(tab);
      });
    });

    // Watermark sync slider & number
    const slider = this.modalEl.querySelector('#cfg-watermark-opacity');
    const numInput = this.modalEl.querySelector('#cfg-watermark-num');
    if (slider && numInput) {
      slider.addEventListener('input', (e) => {
        numInput.value = e.target.value;
        this.settings.watermarkOpacity = parseInt(e.target.value, 10);
      });
      numInput.addEventListener('input', (e) => {
        let v = parseInt(e.target.value, 10);
        if (isNaN(v)) v = 15;
        v = Math.max(5, Math.min(50, v));
        slider.value = v;
        this.settings.watermarkOpacity = v;
      });
    }

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    saveBtn?.addEventListener('click', () => {
      const bull = this.modalEl.querySelector('#cfg-bull-color');
      const bear = this.modalEl.querySelector('#cfg-bear-color');
      const wm = this.modalEl.querySelector('#cfg-watermark-toggle');
      const tz = this.modalEl.querySelector('#cfg-timezone-select');
      const grid = this.modalEl.querySelector('#cfg-grid-select');
      const theme = this.modalEl.querySelector('#cfg-theme-select');
      const lang = this.modalEl.querySelector('#cfg-lang-select');
      const snd = this.modalEl.querySelector('#cfg-sound-toggle');
      const cfm = this.modalEl.querySelector('#cfg-confirm-toggle');
      const cd = this.modalEl.querySelector('#cfg-countdown-toggle');

      if (bull) this.settings.bullColor = bull.value;
      if (bear) this.settings.bearColor = bear.value;
      if (wm) this.settings.watermark = wm.checked;
      if (tz) this.settings.timezone = tz.value;
      if (grid) this.settings.gridLines = grid.value;
      if (theme) this.settings.theme = theme.value;
      if (lang) this.settings.language = lang.value;
      if (snd) this.settings.soundEffects = snd.checked;
      if (cfm) this.settings.orderConfirm = cfm.checked;
      if (cd) this.settings.countdownEnabled = cd.checked;

      localStorage.setItem('tradingchart_user_settings', JSON.stringify(this.settings));
      this.onApplySettings(this.settings);
      this.close();
    });
  }
}
