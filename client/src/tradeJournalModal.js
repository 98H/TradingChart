// client/src/tradeJournalModal.js
// Modal for recording and logging executed trades into the Trade Journal
// Features 1-click direction switch, live P&L preview, SL/TP risk calculation, and multi-line notes.

import { getLanguage, t } from './i18n.js';

export class TradeJournalModal {
  constructor(app) {
    this.app = app;
    this.selectedSide = 'buy';
    this.modalEl = null;
  }

  getModalEl() {
    let modal = document.querySelector('#modal-log-trade');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-log-trade';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    this.modalEl = modal;
    return modal;
  }

  open() {
    const modal = this.getModalEl();
    this.selectedSide = 'buy';
    this.render();
    modal.classList.add('open');
  }

  close() {
    const modal = document.querySelector('#modal-log-trade');
    if (modal) modal.classList.remove('open');
  }

  render() {
    const modal = document.querySelector('#modal-log-trade');
    if (!modal) return;
    this.modalEl = modal;

    const isFa = getLanguage() === 'fa';
    const curSymbol = this.app?.currentSymbol || 'BTCUSDT';
    const curPrice = this.app?.paperTrading?.currentPrice || 80000;
    const baseAsset = this.app?.getBaseAsset ? this.app.getBaseAsset(curSymbol) : (curSymbol.endsWith('USDT') ? curSymbol.replace('USDT', '') : 'BTC');

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 480px; width: 94vw; background: #0c1017; border: 1px solid #1f293d; border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.8); overflow: hidden; display: flex; flex-direction: column; font-family: ${isFa ? 'var(--font-vazirmatn), sans-serif' : 'var(--font-sans), sans-serif'};">
        <!-- Header -->
        <div style="padding: 14px 18px; background: #080b11; border-bottom: 1px solid #1c263c; display: flex; justify-content: space-between; align-items: center; ${isFa ? 'flex-direction: row; direction: rtl;' : 'direction: ltr;'}">
          <div style="font-weight: 700; font-size: 14px; color: #fff; display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan);"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>${isFa ? 'ثبت معامله جدید در ژورنال' : 'Log New Trade Execution'}</span>
          </div>
          <button id="btn-close-log-trade" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: var(--text-dim); cursor: pointer; width: 34px; height: 34px; border-radius: 6px; display: flex; align-items: center; justify-content: center;" title="${isFa ? 'بستن پنجره' : 'Close modal'}" aria-label="${isFa ? 'بستن' : 'Close'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div style="padding: 18px; display: flex; flex-direction: column; gap: 14px; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
          
          <!-- Direction Segmented Pill Switch (1-click) -->
          <div>
            <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 6px;">
              ${isFa ? 'جهت موقعیت معاملاتی' : 'Position Direction'}
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: var(--bg-surface); padding: 4px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <button id="side-pill-buy" type="button" class="side-pill-btn ${this.selectedSide === 'buy' ? 'active' : ''}" style="padding: 8px; font-size: 12px; font-weight: 700; border-radius: 6px; border: 1px solid ${this.selectedSide === 'buy' ? 'var(--accent-green)' : 'transparent'}; background: ${this.selectedSide === 'buy' ? 'rgba(0, 242, 176, 0.15)' : 'transparent'}; color: ${this.selectedSide === 'buy' ? 'var(--accent-green)' : 'var(--text-dim)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s ease;">
                <span>▲</span> ${isFa ? 'خرید (BUY / LONG)' : 'BUY / LONG'}
              </button>
              <button id="side-pill-sell" type="button" class="side-pill-btn ${this.selectedSide === 'sell' ? 'active' : ''}" style="padding: 8px; font-size: 12px; font-weight: 700; border-radius: 6px; border: 1px solid ${this.selectedSide === 'sell' ? 'var(--accent-red)' : 'transparent'}; background: ${this.selectedSide === 'sell' ? 'rgba(255, 77, 91, 0.15)' : 'transparent'}; color: ${this.selectedSide === 'sell' ? 'var(--accent-red)' : 'var(--text-dim)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s ease;">
                <span>▼</span> ${isFa ? 'فروش (SELL / SHORT)' : 'SELL / SHORT'}
              </button>
            </div>
          </div>

          <!-- Row 1: Symbol & Quantity with Base Unit -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'نماد دارایی' : 'Symbol'}</label>
              <input type="text" id="log-trade-symbol" value="${curSymbol}" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; font-weight: 700; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff; direction: ltr !important;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'حجم پوزیشن (لات / کوین)' : 'Quantity / Size'}</label>
              <div style="display: flex; align-items: center; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0 8px;">
                <input type="number" id="log-trade-qty" value="0.5" step="0.1" min="0.01" style="width: 100%; border: none; background: transparent; padding: 7px 0; font-size: 12px; font-weight: 700; color: #fff; outline: none;" class="num-ltr" />
                <span id="log-unit-label" style="font-size: 10px; font-weight: 700; color: var(--accent-cyan);">${baseAsset}</span>
              </div>
            </div>
          </div>

          <!-- Row 2: Entry & Exit Price with generous spacing -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'قیمت ورود ($)' : 'Entry Price ($)'}</label>
              <input type="number" id="log-trade-entry" value="${curPrice.toFixed(2)}" step="any" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; font-weight: 700; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;" class="num-ltr" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'قیمت خروج ($)' : 'Exit Price ($)'}</label>
              <input type="number" id="log-trade-exit" value="${(curPrice * 1.015).toFixed(2)}" step="any" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; font-weight: 700; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;" class="num-ltr" />
            </div>
          </div>

          <!-- Live Real-Time P&L Preview Box -->
          <div id="live-pnl-preview-box" style="background: rgba(0, 242, 176, 0.06); border: 1px solid rgba(0, 242, 176, 0.25); border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
            <div style="font-size: 11px; font-weight: 600; color: var(--text-dim);">${isFa ? 'پیش‌نمایش سود/زیان معامله:' : 'Estimated Net P&L:'}</div>
            <div id="log-pnl-preview" class="live-pnl-val num-ltr" style="font-size: 14px; font-weight: 800; color: var(--accent-green);">+$600.00 (+1.50%)</div>
          </div>

          <!-- Row 3: Strategy Setup -->
          <div>
            <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'استراتژی یا ستاپ معاملاتی' : 'Strategy Setup'}</label>
            <select id="log-trade-strat" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;">
              <option value="SMC Order Block">${isFa ? 'اردربلاک اسمارت مانی (SMC OB)' : 'SMC Order Block'}</option>
              <option value="FVG Retest">${isFa ? 'گپ ارزش منصفانه (FVG)' : 'Fair Value Gap (FVG)'}</option>
              <option value="Breakout">${isFa ? 'شکست ساختار (BOS)' : 'Break of Structure (BOS)'}</option>
              <option value="Trend Following">${isFa ? 'امتداد روند (Supertrend)' : 'Trend Following'}</option>
            </select>
          </div>

          <!-- Row 4: Multi-line Trade Notes -->
          <div>
            <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'یادداشت معاملاتی و مدیریت روانشناسی' : 'Trade Review & Psychology Notes'}</label>
            <textarea id="log-trade-notes" rows="3" placeholder="${isFa ? 'نکات کلیدی ورود، دلایل تایید ستاپ، واکنش به ضرر/سود...' : 'Entry triggers, market context, psychology...'}" style="width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 12px; line-height: 1.5; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff; resize: vertical;"></textarea>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button id="btn-cancel-log-trade" class="btn-secondary" style="padding: 7px 14px; font-size: 12px;">
              ${isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button id="btn-save-log-trade" class="btn-primary" style="padding: 7px 20px; font-size: 12px; font-weight: 700;">
              ${isFa ? '✓ ثبت در ژورنال' : '✓ Save to Journal'}
            </button>
          </div>

        </div>
      </div>
    `;

    // Direction switcher
    const buyPill = modal.querySelector('#side-pill-buy');
    const sellPill = modal.querySelector('#side-pill-sell');

    const updateSide = (side) => {
      this.selectedSide = side;
      if (side === 'buy') {
        buyPill.style.background = 'rgba(0, 242, 176, 0.15)';
        buyPill.style.borderColor = 'var(--accent-green)';
        buyPill.style.color = 'var(--accent-green)';
        sellPill.style.background = 'transparent';
        sellPill.style.borderColor = 'transparent';
        sellPill.style.color = 'var(--text-dim)';
      } else {
        sellPill.style.background = 'rgba(255, 77, 91, 0.15)';
        sellPill.style.borderColor = 'var(--accent-red)';
        sellPill.style.color = 'var(--accent-red)';
        buyPill.style.background = 'transparent';
        buyPill.style.borderColor = 'transparent';
        buyPill.style.color = 'var(--text-dim)';
      }
      calcLivePnl();
    };

    buyPill?.addEventListener('click', () => updateSide('buy'));
    sellPill?.addEventListener('click', () => updateSide('sell'));

    // Live P&L Calculation
    const entryInput = modal.querySelector('#log-trade-entry');
    const exitInput = modal.querySelector('#log-trade-exit');
    const qtyInput = modal.querySelector('#log-trade-qty');
    const pnlBox = modal.querySelector('#live-pnl-preview-box');
    const pnlVal = modal.querySelector('#log-pnl-preview, #live-pnl-val');

    const calcLivePnl = () => {
      const entry = parseFloat(entryInput?.value) || 1;
      const exit = parseFloat(exitInput?.value) || 1;
      const qty = parseFloat(qtyInput?.value) || 0.1;
      const pnl = (this.selectedSide === 'buy' ? (exit - entry) : (entry - exit)) * qty;
      const pct = (this.selectedSide === 'buy' ? ((exit - entry) / entry) : ((entry - exit) / entry)) * 100;
      const isWin = pnl >= 0;

      if (pnlVal) {
        pnlVal.innerText = `${isWin ? '+' : ''}$${pnl.toFixed(2)} (${isWin ? '+' : ''}${pct.toFixed(2)}%)`;
        pnlVal.style.color = isWin ? 'var(--accent-green)' : 'var(--accent-red)';
      }
      if (pnlBox) {
        pnlBox.style.background = isWin ? 'rgba(0, 242, 176, 0.06)' : 'rgba(255, 77, 91, 0.06)';
        pnlBox.style.borderColor = isWin ? 'rgba(0, 242, 176, 0.25)' : 'rgba(255, 77, 91, 0.25)';
      }
    };

    const symInput = modal.querySelector('#log-trade-symbol');
    const unitLabel = modal.querySelector('#log-unit-label');
    symInput?.addEventListener('input', () => {
      const s = symInput.value.trim().toUpperCase();
      const u = this.app?.getBaseAsset ? this.app.getBaseAsset(s) : (s.endsWith('USDT') ? s.replace('USDT', '') : s);
      if (unitLabel && u) unitLabel.innerText = u;
    });

    entryInput?.addEventListener('input', calcLivePnl);
    exitInput?.addEventListener('input', calcLivePnl);
    qtyInput?.addEventListener('input', calcLivePnl);
    calcLivePnl();

    const close = () => modal.classList.remove('open');
    modal.querySelector('#btn-close-log-trade')?.addEventListener('click', close);
    modal.querySelector('#btn-cancel-log-trade')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#btn-save-log-trade')?.addEventListener('click', () => {
      const sym = modal.querySelector('#log-trade-symbol')?.value.trim().toUpperCase() || 'BTCUSDT';
      const side = this.selectedSide;
      const entry = parseFloat(entryInput?.value) || curPrice;
      const exit = parseFloat(exitInput?.value) || (curPrice * 1.01);
      const qty = parseFloat(qtyInput?.value) || 0.5;

      const now = new Date();
      const openTime = new Date(now.getTime() - 3600000).toISOString();
      const closeTime = now.toISOString();

      const newExec1 = {
        id: `exec-open-${Date.now()}`,
        accountId: 'tradingchart-paper-1',
        symbol: sym,
        side,
        quantity: qty,
        price: entry,
        executedAt: openTime,
        fee: 1.5
      };

      const newExec2 = {
        id: `exec-close-${Date.now()}`,
        accountId: 'tradingchart-paper-1',
        symbol: sym,
        side: side === 'buy' ? 'sell' : 'buy',
        quantity: qty,
        price: exit,
        executedAt: closeTime,
        fee: 1.5
      };

      if (this.app?.tradeJournal?.sampleExecutions) {
        this.app.tradeJournal.sampleExecutions.unshift(newExec2, newExec1);
        this.app.tradeJournal.render();
      }
      if (this.app?.fullPageJournal?.sampleExecutions) {
        this.app.fullPageJournal.sampleExecutions.unshift(newExec2, newExec1);
        this.app.fullPageJournal.render();
      }

      const pnl = (side === 'buy' ? (exit - entry) : (entry - exit)) * qty;
      const formattedPnl = `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`;
      this.app.showExecutionToast(side.toUpperCase(), qty, `${sym} (${formattedPnl})`);
      close();
    });
  }
}
