// client/src/chartStylePicker.js
// TradingView-Grade Top Bar Chart Style Dropdown Picker
// Instant 1-click switching between Candlesticks, Bars, Heikin Ashi, Line, Area, and Baseline.

import { getLanguage, t } from './i18n.js';

export const CHART_STYLES = [
  {
    id: 'candles',
    nameEn: 'Candles',
    nameFa: 'کندل‌استیک',
    icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="2" x2="9" y2="6"/><rect x="6" y="6" width="6" height="12" rx="1" fill="currentColor" fill-opacity="0.3"/><line x1="9" y1="18" x2="9" y2="22"/><line x1="17" y1="4" x2="17" y2="9"/><rect x="14" y="9" width="6" height="8" rx="1"/><line x1="17" y1="17" x2="17" y2="21"/></svg>`
  },
  {
    id: 'bars',
    nameEn: 'Bars (OHLC)',
    nameFa: 'میله‌ای (OHLC)',
    icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="3" x2="8" y2="21"/><line x1="5" y1="8" x2="8" y2="8"/><line x1="8" y1="16" x2="11" y2="16"/><line x1="16" y1="5" x2="16" y2="19"/><line x1="13" y1="14" x2="16" y2="14"/><line x1="16" y1="9" x2="19" y2="9"/></svg>`
  },
  {
    id: 'heikinashi',
    nameEn: 'Heikin Ashi',
    nameFa: 'هیکن‌آشی',
    icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="3" x2="9" y2="7"/><rect x="6" y="7" width="6" height="10" rx="1" fill="currentColor"/><line x1="9" y1="17" x2="9" y2="21"/><line x1="17" y1="5" x2="17" y2="10"/><rect x="14" y="10" width="6" height="7" rx="1" fill="currentColor" fill-opacity="0.25"/><line x1="17" y1="17" x2="17" y2="20"/></svg>`
  },
  {
    id: 'line',
    nameEn: 'Line',
    nameFa: 'خطی',
    icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 17 9 11 13 15 21 7"/></svg>`
  },
  {
    id: 'area',
    nameEn: 'Area',
    nameFa: 'ناحیه‌ای (Area)',
    icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18 L9 12 L14 16 L21 8 L21 21 L3 21 Z" fill="currentColor" fill-opacity="0.25"/><polyline points="3 18 9 12 14 16 21 8"/></svg>`
  },
  {
    id: 'baseline',
    nameEn: 'Baseline',
    nameFa: 'خط پایه (Baseline)',
    icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2 2"/><path d="M4 8 Q9 5 12 12 Q16 19 20 15" stroke="currentColor" stroke-width="2"/></svg>`
  }
];

export class ChartStylePicker {
  constructor(app) {
    this.app = app;
    this.currentStyle = localStorage.getItem('tradingchart_price_style') || 'candles';
    this.isOpen = false;
    this.menuEl = null;

    this.init();
  }

  init() {
    this.createDropdownMenu();
    this.updateButtonUI();
    this.bindEvents();
  }

  createDropdownMenu() {
    let el = document.querySelector('#popover-chart-style');
    if (!el) {
      el = document.createElement('div');
      el.id = 'popover-chart-style';
      el.className = 'popover-chart-style';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    this.menuEl = el;
  }

  updateButtonUI() {
    const btn = document.querySelector('#btn-topbar-chart-style');
    const labelEl = document.querySelector('#topbar-chart-style-label');
    const iconWrap = document.querySelector('#topbar-chart-style-icon');
    if (!btn) return;

    const isFa = getLanguage() === 'fa';
    const styleObj = CHART_STYLES.find(s => s.id === this.currentStyle) || CHART_STYLES[0];

    if (labelEl) labelEl.innerText = isFa ? styleObj.nameFa : styleObj.nameEn;
    if (iconWrap) iconWrap.innerHTML = styleObj.icon;
  }

  bindEvents() {
    const btn = document.querySelector('#btn-topbar-chart-style');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }

    document.addEventListener('click', (e) => {
      if (this.isOpen && !e.target.closest('#popover-chart-style') && !e.target.closest('#btn-topbar-chart-style')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    const btn = document.querySelector('#btn-topbar-chart-style');
    if (!btn || !this.menuEl) return;

    const rect = btn.getBoundingClientRect();
    const isFa = getLanguage() === 'fa';

    this.menuEl.style.position = 'fixed';
    this.menuEl.style.top = `${rect.bottom + 6}px`;
    this.menuEl.style.left = isFa ? `${Math.max(10, rect.right - 180)}px` : `${rect.left}px`;
    this.menuEl.style.display = 'block';
    this.isOpen = true;

    this.menuEl.innerHTML = `
      <div class="style-menu-inner" style="background: rgba(14, 17, 23, 0.98); backdrop-filter: blur(16px); border: 1px solid var(--border-medium); border-radius: 8px; padding: 6px; box-shadow: 0 16px 36px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 2px; font-family: ${isFa ? 'var(--font-persian), sans-serif' : 'var(--font-sans)'}; min-width: 170px; z-index: 999999; direction: ${isFa ? 'rtl' : 'ltr'};">
        <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); padding: 4px 8px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 2px; text-align: ${isFa ? 'right' : 'left'};">
          ${isFa ? 'حالت نمایش چارت' : 'Chart Style'}
        </div>
        ${CHART_STYLES.map(s => {
          const isActive = s.id === this.currentStyle;
          return `
            <button class="style-menu-item chart-style-item ${isActive ? 'active' : ''}" data-style="${s.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 12px; font-weight: ${isActive ? '700' : '500'}; color: ${isActive ? 'var(--accent-green)' : '#fff'}; background: ${isActive ? 'rgba(0,242,176,0.1)' : 'transparent'}; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'}; transition: all 0.12s;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: flex; align-items: center; color: ${isActive ? 'var(--accent-green)' : 'var(--text-muted)'};">${s.icon}</span>
                <span>${isFa ? s.nameFa : s.nameEn}</span>
              </div>
              ${isActive ? '<span style="font-size: 11px; color: var(--accent-green);">✓</span>' : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;

    // Click handler for items
    this.menuEl.querySelectorAll('.style-menu-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        if (!item.classList.contains('active')) item.style.background = 'rgba(255,255,255,0.06)';
      });
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('active')) item.style.background = 'transparent';
      });
      item.addEventListener('click', () => {
        const styleId = item.getAttribute('data-style');
        this.setStyle(styleId);
        this.close();
      });
    });
  }

  setStyle(styleId) {
    this.currentStyle = styleId;
    localStorage.setItem('tradingchart_price_style', styleId);
    this.updateButtonUI();

    if (this.app?.chartManager) {
      this.app.chartManager.setPriceStyle(styleId);
      this.app.showExecutionToast('STYLE', 1, styleId.toUpperCase());
    }
  }

  close() {
    if (this.menuEl) {
      this.menuEl.style.display = 'none';
    }
    this.isOpen = false;
  }
}
