// client/src/settingsModal.js
// Chart appearance, themes, colors, timezones, and display settings modal

export class SettingsModal {
  constructor(options = {}) {
    this.modalEl = options.modalEl;
    this.onApplySettings = options.onApplySettings || (() => {});
    this.settings = {
      theme: 'dark',
      bullColor: '#0ecb81',
      bearColor: '#f6465d',
      gridLines: 'both',
      scaleMode: 'auto',
      timezone: 'Etc/UTC',
      language: 'en'
    };
    this.render();
  }

  open() {
    if (this.modalEl) this.modalEl.classList.add('open');
  }

  close() {
    if (this.modalEl) this.modalEl.classList.remove('open');
  }

  render() {
    if (!this.modalEl) return;
    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 520px;">
        <div class="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Chart Settings & Preferences
          </h3>
          <button class="modal-close-btn" id="modal-close-settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-content" style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Candle Colors -->
          <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 10px;">Candlestick Appearance</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">Bullish Candle Color</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="color" id="cfg-bull-color" value="${this.settings.bullColor}" style="width: 32px; height: 32px; border: none; background: transparent; cursor: pointer;" />
                  <span style="font-size: 12px; font-family: var(--font-mono);">${this.settings.bullColor}</span>
                </div>
              </div>
              <div>
                <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">Bearish Candle Color</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="color" id="cfg-bear-color" value="${this.settings.bearColor}" style="width: 32px; height: 32px; border: none; background: transparent; cursor: pointer;" />
                  <span style="font-size: 12px; font-family: var(--font-mono);">${this.settings.bearColor}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Timezone & Scales -->
          <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">Chart Timezone</label>
              <select id="cfg-timezone-select" style="width: 100%; font-size: 12px;">
                <option value="Etc/UTC" selected>UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">New York (Wall Street)</option>
                <option value="Europe/London">London (LSE)</option>
                <option value="Asia/Tokyo">Tokyo (JPX)</option>
                <option value="Asia/Tehran">Tehran (UTC+3:30)</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">Grid Lines</label>
              <select id="cfg-grid-select" style="width: 100%; font-size: 12px;">
                <option value="both" selected>Horizontal & Vertical</option>
                <option value="horizontal">Horizontal Only</option>
                <option value="vertical">Vertical Only</option>
                <option value="none">None (Clean Obsidian)</option>
              </select>
            </div>
          </div>

          <!-- Theme & Language -->
          <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">Color Theme</label>
              <select id="cfg-theme-select" style="width: 100%; font-size: 12px;">
                <option value="dark" selected>Obsidian Dark (Default)</option>
                <option value="slate">Deep Slate</option>
                <option value="light">Clean Light</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px;">Interface Language</label>
              <select id="cfg-lang-select" style="width: 100%; font-size: 12px;">
                <option value="en" selected>English (Default)</option>
                <option value="fa">فارسی (Persian Standard)</option>
              </select>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
            <button id="btn-settings-cancel" class="btn-secondary" style="padding: 8px 16px;">Cancel</button>
            <button id="btn-settings-save" class="btn-primary" style="padding: 8px 20px;">Save Settings</button>
          </div>
        </div>
      </div>
    `;

    const closeBtn = this.modalEl.querySelector('#modal-close-settings');
    const cancelBtn = this.modalEl.querySelector('#btn-settings-cancel');
    const saveBtn = this.modalEl.querySelector('#btn-settings-save');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    saveBtn.addEventListener('click', () => {
      this.settings.bullColor = this.modalEl.querySelector('#cfg-bull-color').value;
      this.settings.bearColor = this.modalEl.querySelector('#cfg-bear-color').value;
      this.settings.timezone = this.modalEl.querySelector('#cfg-timezone-select').value;
      this.settings.gridLines = this.modalEl.querySelector('#cfg-grid-select').value;
      this.settings.theme = this.modalEl.querySelector('#cfg-theme-select').value;
      this.settings.language = this.modalEl.querySelector('#cfg-lang-select').value;

      this.onApplySettings(this.settings);
      this.close();
    });
  }
}
