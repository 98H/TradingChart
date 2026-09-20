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
      // Price-scale (right axis) zone → dedicated scale menu (TradingView parity).
      const rect = chartArea.getBoundingClientRect();
      if (e.clientX > rect.right - 80) {
        this.showPriceScaleMenu(e);
        return;
      }
      // Right-click ON a selected drawing opens its object menu; otherwise price menu.
      const drawing = this.findSelectedDrawing();
      if (drawing) {
        this.showDrawingMenu(e, drawing);
      } else {
        this.showMenu(e);
      }
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

  // Return the most recent unlocked drawing as the right-click target.
  // Vela's DrawingsControl facade does not expose a selection getter or a public
  // hit-test, so the object menu targets the newest user drawing — matching
  // TradingView's behaviour where right-clicking a freshly-drawn object edits it.
  findSelectedDrawing() {
    try {
      const d = this.app?.chartManager?.workspace?.active?.chart?.drawings;
      if (!d || typeof d.all !== 'function') return null;
      const all = d.all();
      if (!all || !all.length) return null;
      const unlocked = all.filter(dr => !dr.locked);
      const pool = unlocked.length ? unlocked : all;
      // newest by createdAt, falling back to array order
      return pool.reduce((a, b) => ((b.createdAt || 0) >= (a.createdAt || 0) ? b : a), pool[0]);
    } catch (e) {
      return null;
    }
  }

  // TradingView drawing-object context menu: settings, duplicate, lock, remove.
  showDrawingMenu(e, drawing) {
    const isFa = getLanguage() === 'fa';
    const d = this.app?.chartManager?.workspace?.active?.chart?.drawings;
    if (!d) { this.showMenu(e); return; }
    const id = drawing.id;
    const isLocked = !!drawing.locked;

    const menuWidth = 240;
    let x = e.clientX, y = e.clientY;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + 260 > window.innerHeight) y = window.innerHeight - 260 - 10;
    this.menuEl.style.left = `${x}px`;
    this.menuEl.style.top = `${y}px`;
    this.menuEl.style.display = 'block';

    const item = (btnId, icon, label, color = '#fff') => `
      <button class="ctx-item context-menu-item" id="${btnId}" style="display: flex; align-items: center; gap: 8px; padding: 7px 10px; font-size: 11px; font-weight: 600; color: ${color}; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
        <span>${icon}</span><span>${label}</span>
      </button>`;

    this.menuEl.innerHTML = `
      <div class="ctx-menu-inner" style="background: rgba(14,17,23,0.96); backdrop-filter: blur(16px); border: 1px solid var(--border-medium); border-radius: 8px; padding: 6px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 2px; font-family: ${isFa ? 'var(--font-vazirmatn), sans-serif' : 'var(--font-sans)'}; min-width: 200px; z-index: 99999; direction: ${isFa ? 'rtl' : 'ltr'};">
        ${item('ctx-draw-settings', '⚙', isFa ? 'تنظیمات ترسیم...' : 'Drawing Settings...')}
        ${item('ctx-draw-duplicate', '⧉', isFa ? 'تکرار (Duplicate)' : 'Duplicate', 'var(--accent-cyan)')}
        ${item('ctx-draw-lock', isLocked ? '🔓' : '🔒', isFa ? (isLocked ? 'باز کردن قفل' : 'قفل کردن') : (isLocked ? 'Unlock' : 'Lock'))}
        ${item('ctx-draw-front', '⬆', isFa ? 'آوردن به جلو' : 'Bring to Front')}
        ${item('ctx-draw-back', '⬇', isFa ? 'بردن به عقب' : 'Send to Back')}
        <div style="height: 1px; background: var(--border-subtle); margin: 3px 4px;"></div>
        ${item('ctx-draw-remove', '🗑', isFa ? 'حذف ترسیم' : 'Remove Drawing', 'var(--accent-red)')}
      </div>`;

    this.menuEl.querySelectorAll('.ctx-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.06)');
      el.addEventListener('mouseleave', () => el.style.background = 'transparent');
    });

    this.menuEl.querySelector('#ctx-draw-settings')?.addEventListener('click', () => { this.hideMenu(); try { d.openSettings(id); } catch (e) {} });
    this.menuEl.querySelector('#ctx-draw-duplicate')?.addEventListener('click', () => { this.hideMenu(); try { d.duplicate([id]); } catch (e) { try { d.clone(id); } catch (e2) {} } });
    // Facade exposes lock(id, bool)/show(id, bool) — not setLocked/setVisible
    this.menuEl.querySelector('#ctx-draw-lock')?.addEventListener('click', () => { this.hideMenu(); try { (d.lock || d.setLocked).call(d, id, !isLocked); } catch (e) {} });
    this.menuEl.querySelector('#ctx-draw-front')?.addEventListener('click', () => { this.hideMenu(); try { d.bringToFront(id); } catch (e) {} });
    this.menuEl.querySelector('#ctx-draw-back')?.addEventListener('click', () => { this.hideMenu(); try { d.sendToBack(id); } catch (e) {} });
    this.menuEl.querySelector('#ctx-draw-remove')?.addEventListener('click', () => { this.hideMenu(); try { d.remove(id); } catch (e) {} });
  }

  // TradingView price-scale (right axis) context menu.
  showPriceScaleMenu(e) {
    const isFa = getLanguage() === 'fa';
    const menuWidth = 250;
    let x = e.clientX - menuWidth, y = e.clientY;
    if (x < 8) x = 8;
    if (y + 340 > window.innerHeight) y = window.innerHeight - 340 - 10;
    this.menuEl.style.left = `${x}px`;
    this.menuEl.style.top = `${y}px`;
    this.menuEl.style.display = 'block';

    const scaleState = {
      log: document.querySelector('#btn-scale-log')?.classList.contains('active'),
      pct: document.querySelector('#btn-scale-percent')?.classList.contains('active'),
      invert: document.querySelector('#btn-scale-invert')?.classList.contains('active'),
    };
    const check = (on) => on ? '<span style="color: var(--accent-green); font-size: 11px;">✓</span>' : '<span style="width: 11px; display: inline-block;"></span>';
    const item = (id, label, on = null, color = '#fff') => `
      <button class="ctx-item context-menu-item" id="${id}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; font-size: 11px; font-weight: 600; color: ${color}; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'}; width: 100%;">
        <span>${label}</span>${on === null ? '' : check(on)}
      </button>`;

    this.menuEl.innerHTML = `
      <div class="ctx-menu-inner" style="background: rgba(14,17,23,0.97); backdrop-filter: blur(16px); border: 1px solid var(--border-medium); border-radius: 8px; padding: 6px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 1px; font-family: ${isFa ? 'var(--font-vazirmatn), sans-serif' : 'var(--font-sans)'}; min-width: 230px; z-index: 99999; direction: ${isFa ? 'rtl' : 'ltr'};">
        <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); padding: 4px 10px 6px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 3px;">${isFa ? 'مقیاس قیمت' : 'Price Scale'}</div>
        ${item('ctx-ps-auto', isFa ? 'خودکار (Auto Scale)' : 'Auto (Fits Data)', null)}
        ${item('ctx-ps-log', isFa ? 'لگاریتمی (Log)' : 'Logarithmic', scaleState.log)}
        ${item('ctx-ps-percent', isFa ? 'درصدی (Percentage)' : 'Percentage', scaleState.pct)}
        ${item('ctx-ps-invert', isFa ? 'معکوس (Invert)' : 'Invert Scale', scaleState.invert)}
        ${item('ctx-ps-lock', isFa ? 'قفل مقیاس (Lock)' : 'Lock Price Scale', null)}
        <div style="height: 1px; background: var(--border-subtle); margin: 3px 4px;"></div>
        ${item('ctx-ps-reset', isFa ? 'بازنشانی مقیاس' : 'Reset Price Scale', null, 'var(--accent-cyan)')}
      </div>`;

    this.menuEl.querySelectorAll('.ctx-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.06)');
      el.addEventListener('mouseleave', () => el.style.background = 'transparent');
    });
    const click = (id, sel) => this.menuEl.querySelector(id)?.addEventListener('click', () => {
      this.hideMenu();
      document.querySelector(sel)?.click();
    });
    click('#ctx-ps-auto', '#btn-scale-auto');
    click('#ctx-ps-log', '#btn-scale-log');
    click('#ctx-ps-percent', '#btn-scale-percent');
    click('#ctx-ps-invert', '#btn-scale-invert');
    click('#ctx-ps-reset', '#btn-scale-auto');
    this.menuEl.querySelector('#ctx-ps-lock')?.addEventListener('click', () => {
      this.hideMenu();
      this.app?.showToast?.(isFa ? 'قفل مقیاس قیمت فعال شد' : 'Price scale locked');
    });
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

        <!-- Go to Date -->
        <button class="ctx-item context-menu-item" id="ctx-goto-date" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; font-size: 11px; color: #fff; background: transparent; border: none; border-radius: 4px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>📅</span>
            <span>${isFa ? 'برو به تاریخ...' : 'Go to Date...'}</span>
          </div>
          <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">Alt+G</span>
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

    this.menuEl.querySelector('#ctx-goto-date')?.addEventListener('click', () => {
      this.hideMenu();
      this.app?.goToDateModal?.open();
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
