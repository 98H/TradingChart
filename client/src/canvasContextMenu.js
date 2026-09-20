// client/src/canvasContextMenu.js
// TradingView-Grade Canvas & Price Scale Right-Click Context Menu
// Price-aware context actions, quick alerts, limit orders, scale toggles, and indicator shortcuts

import { getLanguage, t } from './i18n.js';

export class CanvasContextMenu {
  constructor(app) {
    this.app = app;
    this.menuEl = null;
    this.activePrice = null;
    this.activeTime = null;

    this.init();
  }

  init() {
    let el = document.querySelector('#canvas-context-menu');
    if (!el) {
      el = document.createElement('div');
      el.id = 'canvas-context-menu';
      el.className = 'canvas-context-menu';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    this.menuEl = el;

    this.bindEvents();
  }

  bindEvents() {
    const chartArea = document.querySelector('#chart-area');
    if (!chartArea) return;

    chartArea.addEventListener('contextmenu', (e) => {
      // Don't intercept if right clicking inside inputs or buttons
      if (e.target.closest('input, textarea, button, select, #floating-drawing-toolbar, #chart-quick-trade')) {
        return;
      }
      e.preventDefault();
      this.showMenu(e);
    });

    // Dismiss listeners
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#canvas-context-menu')) {
        this.hideMenu();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideMenu();
      }
    });
  }

  calculatePriceAtY(clientY) {
    const chartArea = document.querySelector('#chart-area');
    if (!chartArea) return this.app.barReplay?.currentPrice || 84000;
    const rect = chartArea.getBoundingClientRect();
    const relY = clientY - rect.top;
    const height = rect.height;

    // Use current symbol price and variance
    const basePrice = Number(document.querySelector('#quick-buy-price')?.innerText?.replace(/[^0-9.]/g, '')) || 84000;
    // Estimate price range: +- 3% from top to bottom
    const pct = (height / 2 - relY) / height;
    const estPrice = basePrice * (1 + pct * 0.05);
    return Math.round(estPrice * 100) / 100;
  }

  showMenu(e) {
    const isFa = getLanguage() === 'fa';
    this.activePrice = this.calculatePriceAtY(e.clientY);
    const priceStr = `$${this.activePrice >= 100 ? this.activePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : this.activePrice.toFixed(4)}`;

    const menuWidth = 240;
    const menuHeight = 360;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

    this.menuEl.style.left = `${x}px`;
    this.menuEl.style.top = `${y}px`;
    this.menuEl.style.display = 'block';

    this.menuEl.innerHTML = `
      <div class="ctx-menu-inner" style="background: rgba(14, 17, 23, 0.96); backdrop-filter: blur(16px); border: 1px solid var(--border-medium); border-radius: 8px; padding: 6px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 2px; font-family: ${isFa ? 'var(--font-vazirmatn), sans-serif' : 'var(--font-sans)'}; min-width: 220px; z-index: 99999; direction: ${isFa ? 'rtl' : 'ltr'};">
        <!-- Add Alert at price -->
        <button class="ctx-item context-menu-item" id="ctx-add-alert" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; font-weight: 600; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'}; transition: background 0.12s;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--accent-gold);">🔔</span>
            <span>${isFa ? `ثبت هشدار روی ${priceStr}` : `Add Alert at ${priceStr}`}</span>
          </div>
          <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">Alt+A</span>
        </button>

        <!-- Buy Limit -->
        <button class="ctx-item context-menu-item" id="ctx-buy-limit" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; font-weight: 600; color: var(--accent-green); background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>⚡</span>
            <span>${isFa ? `سفارش لیمیت خرید روی ${priceStr}` : `Buy Limit at ${priceStr}`}</span>
          </div>
        </button>

        <!-- Sell Limit -->
        <button class="ctx-item context-menu-item" id="ctx-sell-limit" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; font-weight: 600; color: var(--accent-red); background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>⚡</span>
            <span>${isFa ? `سفارش لیمیت فروش روی ${priceStr}` : `Sell Limit at ${priceStr}`}</span>
          </div>
        </button>

        <div style="height: 1px; background: var(--border-subtle); margin: 3px 4px;"></div>

        <!-- Add Indicator -->
        <button class="ctx-item context-menu-item" id="ctx-add-indicator" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--accent-cyan);">📐</span>
            <span>${isFa ? 'افزودن اندیکاتور...' : 'Add Indicator...'}</span>
          </div>
          <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">/</span>
        </button>

        <!-- Change Timeframe -->
        <button class="ctx-item context-menu-item" id="ctx-change-timeframe" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>⏱</span>
            <span>${isFa ? 'تغییر بازه زمانی (Timeframe)...' : 'Change Timeframe...'}</span>
          </div>
          <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">,</span>
        </button>

        <!-- Compare Symbol -->
        <button class="ctx-item context-menu-item" id="ctx-compare-symbol" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #38bdf8;">➕</span>
            <span>${isFa ? 'مقایسه دارایی (Compare)...' : 'Compare Symbol...'}</span>
          </div>
          <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">Alt+C</span>
        </button>

        <div style="height: 1px; background: var(--border-subtle); margin: 3px 4px;"></div>

        <!-- Reset Price Scale -->
        <button class="ctx-item context-menu-item" id="ctx-reset-scale" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>🔄</span>
            <span>${isFa ? 'بازنشانی مقیاس قیمت (Auto)' : 'Reset Price Scale'}</span>
          </div>
          <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">Alt+R</span>
        </button>

        <!-- Logarithmic Scale -->
        <button class="ctx-item context-menu-item" id="ctx-toggle-log" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>📈</span>
            <span>${isFa ? 'مقیاس لگاریتمی (Log)' : 'Logarithmic Scale'}</span>
          </div>
        </button>

        <!-- Invert Scale -->
        <button class="ctx-item context-menu-item" id="ctx-toggle-invert" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>↕</span>
            <span>${isFa ? 'معکوس‌سازی قیمت (Invert)' : 'Invert Price Scale'}</span>
          </div>
          <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">Alt+I</span>
        </button>

        <div style="height: 1px; background: var(--border-subtle); margin: 3px 4px;"></div>

        <!-- Take Screenshot -->
        <button class="ctx-item context-menu-item" id="ctx-take-screenshot" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>📸</span>
            <span>${isFa ? 'تصویر چارت و اشتراک‌گذاری' : 'Take Screenshot / Share'}</span>
          </div>
          <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">Alt+S</span>
        </button>

        <!-- Chart Settings -->
        <button class="ctx-item context-menu-item" id="ctx-open-settings" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>⚙</span>
            <span>${isFa ? 'تنظیمات چارت...' : 'Chart Settings...'}</span>
          </div>
        </button>
      </div>
    `;

    // Hover effect
    this.menuEl.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.06)');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    });

    // Action listeners
    this.menuEl.querySelector('#ctx-add-alert')?.addEventListener('click', () => {
      this.hideMenu();
      if (this.app) {
        this.app.chartAlertsOverlay?.addAlert(this.activePrice, `Alert at $${this.activePrice}`);
        this.app.openAlertsModal(this.activePrice);
        this.app.showExecutionToast('ALERT', 1, `$${this.activePrice}`);
        this.app.soundEngine?.playAlert();
      }
    });

    this.menuEl.querySelector('#ctx-buy-limit')?.addEventListener('click', () => {
      this.hideMenu();
      if (this.app?.paperTrading) {
        this.app.paperTrading.openPosition('long', 0.1, 10, this.activePrice);
        this.app.showExecutionToast('LIMIT BUY', 0.1, `$${this.activePrice}`);
        this.app.soundEngine?.playOrder();
      }
    });

    this.menuEl.querySelector('#ctx-sell-limit')?.addEventListener('click', () => {
      this.hideMenu();
      if (this.app?.paperTrading) {
        this.app.paperTrading.openPosition('short', 0.1, 10, this.activePrice);
        this.app.showExecutionToast('LIMIT SELL', 0.1, `$${this.activePrice}`);
        this.app.soundEngine?.playOrder();
      }
    });

    this.menuEl.querySelector('#ctx-add-indicator')?.addEventListener('click', () => {
      this.hideMenu();
      this.app?.indicatorsModal?.open();
    });

    this.menuEl.querySelector('#ctx-change-timeframe')?.addEventListener('click', () => {
      this.hideMenu();
      this.app?.timeframeManager?.open();
    });

    this.menuEl.querySelector('#ctx-compare-symbol')?.addEventListener('click', () => {
      this.hideMenu();
      this.app?.compareModal?.open();
    });

    this.menuEl.querySelector('#ctx-reset-scale')?.addEventListener('click', () => {
      this.hideMenu();
      document.querySelector('#btn-scale-auto')?.click();
    });

    this.menuEl.querySelector('#ctx-toggle-log')?.addEventListener('click', () => {
      this.hideMenu();
      document.querySelector('#btn-scale-log')?.click();
    });

    this.menuEl.querySelector('#ctx-toggle-invert')?.addEventListener('click', () => {
      this.hideMenu();
      document.querySelector('#btn-scale-invert')?.click();
    });

    this.menuEl.querySelector('#ctx-take-screenshot')?.addEventListener('click', () => {
      this.hideMenu();
      this.app?.screenshotModal?.open();
    });

    this.menuEl.querySelector('#ctx-open-settings')?.addEventListener('click', () => {
      this.hideMenu();
      this.app?.settingsModal?.open();
    });
  }

  hideMenu() {
    this.isOpen = false;
    if (this.menuEl) {
      this.menuEl.style.display = 'none';
    }
  }

  close() {
    this.hideMenu();
  }
}
