// client/src/templateManager.js
// Institutional Indicator Templates & Custom User Setups Manager (TradingView Parity)
// Curated algorithmic templates + Dynamic user template persistence (LocalStorage)

import { getLanguage, t, toPersianDigits } from './i18n.js';

export const CURATED_TEMPLATES = [
  {
    id: 'smc',
    name: 'Smart Money Concepts (SMC) Pro',
    nameFa: 'ستاپ تخصصی اسمارت مانی (SMC Pro)',
    category: 'SMC/ICT',
    color: '#00F2B0',
    description: 'Order Blocks, Fair Value Gaps (FVG), Liquidity Sweeps, and structural breaks.',
    descriptionFa: 'اردربلاک‌ها، شکاف‌های ارزش منصفانه (FVG)، جاروب نقدینگی و شکست ساختار.',
    scripts: [
      `//@version=5\nindicator("SMC Liquidity & FVG", overlay=true)\nplot(ta.highest(high, 20), "BSL Liquidity", color=color.rgb(255, 77, 91))\nplot(ta.lowest(low, 20), "SSL Liquidity", color=color.rgb(0, 242, 176))`
    ]
  },
  {
    id: 'trend',
    name: 'LuxAlgo Trend Confirmation',
    nameFa: 'تایید روند و سوپرترند لوکس‌آلگو',
    category: 'TREND',
    color: '#60a5fa',
    description: 'Supertrend ATR baseline with fast EMA ribbon and MACD momentum filter.',
    descriptionFa: 'خط پایه سوپرترند ATR با روبان میانگین‌های متحرک نمایی و مومنتوم.',
    scripts: [
      `//@version=5\nindicator("LuxAlgo Supertrend ATR", overlay=true)\n[st, dir] = ta.supertrend(3.0, 10)\nplot(st, "Supertrend", color = dir == 1 ? color.rgb(0, 242, 176) : color.rgb(255, 77, 91), linewidth=2)`
    ]
  },
  {
    id: 'scalper',
    name: 'Institutional Scalper Pro',
    nameFa: 'اسکالپر نهادی پرو (Scalper Pro)',
    category: 'VOLATILITY',
    color: '#f59e0b',
    description: 'Bollinger Bands mean-reversion channels with Stochastic RSI momentum filter.',
    descriptionFa: 'کانال‌های بازگشت به میانگین بولینگر باندز به همراه استوکاستیک RSI.',
    scripts: [
      `//@version=5\nindicator("Scalper Pro Bands", overlay=true)\n[mid, up, low] = ta.bb(close, 20, 2.0)\nplot(mid, "Basis", color=color.orange)\np1 = plot(up, "Upper", color=color.rgb(0, 242, 176))\np2 = plot(low, "Lower", color=color.rgb(255, 77, 91))\nfill(p1, p2, color=color.new(color.blue, 90))`
    ]
  },
  {
    id: 'reversal',
    name: 'Reversal & Volume Absorption',
    nameFa: 'شناساگر جذب حجم و برگشت روند',
    category: 'VOLUME',
    color: '#c084fc',
    description: 'Volume spike absorption detector paired with high-volume rejection levels.',
    descriptionFa: 'شناساگر جذب حجم و شکست با سطوح پس‌زدگی سنگین معاملات.',
    scripts: [
      `//@version=5\nindicator("Volume Absorption Spike", overlay=false)\nvolSma = ta.sma(volume, 20)\nisSpike = volume > volSma * 2.0\nplot(volume, "Volume", color = isSpike ? color.rgb(245, 158, 11) : (close >= open ? color.rgb(0, 242, 176) : color.rgb(255, 77, 91)), style=plot.style_columns)`
    ]
  },
  {
    id: 'ict_silver_bullet',
    name: 'ICT Silver Bullet & Killzones',
    nameFa: 'ستاپ سیلور بولت ICT و کیل‌زون‌ها',
    category: 'SMC/ICT',
    color: '#38bdf8',
    description: 'New York AM/PM Silver Bullet time windows with FVG confirmation levels.',
    descriptionFa: 'پنجره‌های زمانی کیل‌زون نقره‌ای لندن و نیویورک با تایید FVG.',
    scripts: [
      `//@version=5\nindicator("ICT Silver Bullet Range", overlay=true)\nplot(ta.highest(high, 10), "ICT High", color=color.rgb(56, 189, 248))\nplot(ta.lowest(low, 10), "ICT Low", color=color.rgb(56, 189, 248))`
    ]
  }
];

export class TemplateManager {
  constructor(app, container) {
    this.app = app;
    this.container = container;
    this.storageKey = 'tradingchart_user_templates';
    this.userTemplates = this.loadUserTemplates();
    this.isSavingNew = false;
    this.render();
  }

  loadUserTemplates() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  saveUserTemplates() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.userTemplates));
    } catch (e) {}
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div class="template-panel-container" style="padding: 20px 14px 14px 14px; display: flex; flex-direction: column; gap: 14px; background: var(--bg-surface); height: 100%; overflow-y: auto;">
        <!-- Header & Save Current Trigger -->
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: 800; color: var(--accent-cyan); text-transform: uppercase;">
              ${isFa ? 'قالب‌های تحلیلی اندیکاتورها' : 'Indicator Templates'}
            </span>
            <button id="btn-toggle-save-template" class="btn-primary" style="font-size: 11px; padding: 4px 10px;">
              + ${isFa ? 'ذخیره ستاپ جاری' : 'Save Current Setup'}
            </button>
          </div>

          <!-- Save Template Inline Form -->
          ${this.isSavingNew ? `
            <div style="background: var(--bg-card); border: 1px solid var(--accent-cyan); border-radius: 4px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 11px; font-weight: 700; color: #fff;">${isFa ? 'نام قالب جدید:' : 'Template Name:'}</span>
              <input type="text" id="input-new-template-name" placeholder="${isFa ? 'مثلاً: استراتژی شخصی ICT' : 'e.g. My ICT Strategy'}" style="height: 32px; font-size: 12px; padding: 4px 8px;" />
              <div style="display: flex; justify-content: flex-end; gap: 6px;">
                <button id="btn-cancel-save-template" class="btn-secondary" style="font-size: 11px; padding: 4px 10px;">${isFa ? 'انصراف' : 'Cancel'}</button>
                <button id="btn-confirm-save-template" class="btn-primary" style="font-size: 11px; padding: 4px 12px;">${isFa ? 'ذخیره ✓' : 'Save ✓'}</button>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- User Saved Templates Section -->
        ${this.userTemplates.length > 0 ? `
          <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px;">
            <div style="font-size: 11px; font-weight: 700; color: #fff; margin-bottom: 8px; display: flex; justify-content: space-between;">
              <span>${isFa ? 'قالب‌های ذخیره‌شده شما' : 'Your Saved Templates'}</span>
              <span style="color: var(--accent-cyan);">${this.userTemplates.length}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${this.userTemplates.map(ut => `
                <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 12px; font-weight: 700; color: #fff;">${ut.name}</div>
                    <div style="font-size: 10px; color: var(--text-dim);">${ut.date} &nbsp;·&nbsp; ${ut.scripts.length} ${isFa ? 'اندیکاتور' : 'indicators'}</div>
                  </div>
                  <div style="display: flex; gap: 4px; align-items: center;">
                    <button class="btn-apply-user-template btn-secondary" data-id="${ut.id}" style="font-size: 10px; padding: 3px 8px; color: var(--accent-cyan);">
                      ${isFa ? 'اعمال' : 'Apply'}
                    </button>
                    <button class="btn-delete-user-template" data-id="${ut.id}" style="background: transparent; border: none; color: var(--accent-red); cursor: pointer; padding: 2px 4px; font-size: 12px;" title="Delete Template">
                      ✕
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Curated Algorithmic Presets -->
        <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">
            ${isFa ? 'قالب‌های الگوریتمی آماده (Curated)' : 'Curated Algorithmic Setups'}
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${CURATED_TEMPLATES.map(t => `
              <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <div style="font-weight: 700; font-size: 12px; color: #fff;">${isFa ? (t.nameFa || t.name) : t.name}</div>
                  <span style="font-size: 9px; font-weight: 800; background: rgba(255,255,255,0.06); color: ${t.color}; padding: 1px 5px; border-radius: 3px;">${t.category}</span>
                </div>
                <div style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px; line-height: 1.3;">
                  ${isFa ? (t.descriptionFa || t.description) : t.description}
                </div>
                <button class="btn-apply-curated btn-primary" data-id="${t.id}" style="width: 100%; justify-content: center; font-size: 11px; padding: 5px 10px;">
                  ✓ ${isFa ? 'اعمال قالب به چارت' : 'Apply Setup to Chart'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btn-toggle-save-template')?.addEventListener('click', () => {
      this.isSavingNew = !this.isSavingNew;
      this.render();
      if (this.isSavingNew) {
        this.container.querySelector('#input-new-template-name')?.focus();
      }
    });

    this.container.querySelector('#btn-cancel-save-template')?.addEventListener('click', () => {
      this.isSavingNew = false;
      this.render();
    });

    this.container.querySelector('#btn-confirm-save-template')?.addEventListener('click', () => {
      const input = this.container.querySelector('#input-new-template-name');
      const name = input ? input.value.trim() : '';
      if (!name) return;

      const chart = this.app.chartManager?.workspace?.active?.chart;
      const handles = chart?.orchestrator?.handles;
      const scripts = [];

      if (handles && handles.size > 0) {
        handles.forEach(h => {
          if (h.source) scripts.push(h.source);
        });
      }

      if (scripts.length === 0) {
        alert(getLanguage() === 'fa' ? 'هیچ اسکریپت یا اندیکاتوری روی چارت برای ذخیره وجود ندارد' : 'No active indicators on chart to save.');
        return;
      }

      this.userTemplates.push({
        id: 'tmpl-' + Date.now(),
        name,
        date: new Date().toISOString().slice(0, 10),
        scripts
      });

      this.saveUserTemplates();
      this.isSavingNew = false;
      this.render();
    });

    // Apply Curated
    this.container.querySelectorAll('.btn-apply-curated').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const t = CURATED_TEMPLATES.find(x => x.id === id);
        if (t) {
          for (const s of t.scripts) {
            this.app.chartManager?.addPineIndicator(s, t.name);
          }
          btn.innerText = '✓ Applied to Canvas!';
          setTimeout(() => this.render(), 1500);
        }
      });
    });

    // Apply User Template
    this.container.querySelectorAll('.btn-apply-user-template').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const ut = this.userTemplates.find(x => x.id === id);
        if (ut) {
          for (const s of ut.scripts) {
            this.app.chartManager?.addPineIndicator(s, ut.name);
          }
          btn.innerText = '✓ Done';
          setTimeout(() => this.render(), 1500);
        }
      });
    });

    // Delete User Template
    this.container.querySelectorAll('.btn-delete-user-template').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.userTemplates = this.userTemplates.filter(x => x.id !== id);
        this.saveUserTemplates();
        this.render();
      });
    });
  }
}
