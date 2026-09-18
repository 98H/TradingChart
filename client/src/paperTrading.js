// client/src/paperTrading.js
// Institutional Paper Trading Terminal & Order Execution Manager with Level 2 DOM (Depth of Market)

import { getLanguage, t } from './i18n.js';

export class PaperTrading {
  constructor(options = {}) {
    this.container = options.container;
    this.currentSymbol = 'BTCUSDT';
    this.currentPrice = 78000.0;
    this.balance = 100000.0;
    this.activeTab = 'ticket'; // 'ticket' or 'dom'
    this.positions = [
      {
        id: 'pos-1',
        symbol: 'BTCUSDT',
        side: 'long',
        qty: 0.5,
        entryPrice: 77500.0,
        markPrice: 78000.0,
        leverage: 10,
        margin: 3875.0,
        unrealizedPnl: 250.0,
        unrealizedPnlPct: 6.45,
        sl: 76000.0,
        tp: 80500.0
      }
    ];
    this.orders = [];
    this.render();
  }

  setMarket(symbol, price) {
    this.currentSymbol = symbol.replace(/^.*:/, '').toUpperCase();
    if (price && !isNaN(price)) {
      this.currentPrice = price;
      for (const pos of this.positions) {
        if (pos.symbol === this.currentSymbol) {
          pos.markPrice = price;
          const diff = pos.side === 'long' ? (price - pos.entryPrice) : (pos.entryPrice - price);
          pos.unrealizedPnl = diff * pos.qty;
          pos.unrealizedPnlPct = (pos.unrealizedPnl / pos.margin) * 100;
        }
      }
      this.updatePositionsView();
      if (this.activeTab === 'dom') {
        this.renderDOMView();
      }
    }
  }

  calculateEquity() {
    const unPnl = this.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    return this.balance + unPnl;
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow-y: auto; padding: 12px; gap: 12px;">
        <!-- Account Overview Card -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">
                ${isFa ? 'موجودی کل حساب مجازی' : 'Paper Account Equity'}
              </div>
              <div style="font-size: 20px; font-weight: 800; color: #fff; margin-top: 2px;" class="num-ltr" id="paper-equity">
                $${this.calculateEquity().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button id="btn-reset-paper" class="btn-secondary" style="font-size: 10px; padding: 3px 8px; color: var(--text-dim);" title="Reset balance to $100,000">
              ${isFa ? 'بازنشانی' : 'Reset'}
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'موجودی آزاد' : 'Available Balance'}</div>
              <div style="font-size: 13px; font-weight: 700; color: var(--text-main); margin-top: 2px;" class="num-ltr">
                $${this.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'سود/زیان شناور' : 'Unrealized P&L'}</div>
              <div style="font-size: 13px; font-weight: 800; color: var(--accent-green); margin-top: 2px;" class="num-ltr" id="paper-total-pnl">
                +$250.00
              </div>
            </div>
          </div>
        </div>

        <!-- Mode Sub-Tabs: Ticket vs Level 2 DOM -->
        <div style="display: flex; gap: 4px; background: var(--bg-darkest); padding: 3px; border-radius: 6px; border: 1px solid var(--border-subtle);">
          <button id="btn-subtab-ticket" class="btn-secondary ${this.activeTab === 'ticket' ? 'active' : ''}" style="flex: 1; justify-content: center; font-size: 11px; padding: 5px; ${this.activeTab === 'ticket' ? 'background: var(--bg-card); color: var(--accent-cyan); border-color: var(--accent-cyan);' : 'border-color: transparent;'}">
            ${isFa ? 'اردر تیکت (Order Ticket)' : 'Order Ticket'}
          </button>
          <button id="btn-subtab-dom" class="btn-secondary ${this.activeTab === 'dom' ? 'active' : ''}" style="flex: 1; justify-content: center; font-size: 11px; padding: 5px; ${this.activeTab === 'dom' ? 'background: var(--bg-card); color: var(--accent-cyan); border-color: var(--accent-cyan);' : 'border-color: transparent;'}">
            ${isFa ? 'عمق بازار (Level 2 DOM)' : 'Depth of Market (DOM)'}
          </button>
        </div>

        <!-- View 1: Quick Order Ticket Form -->
        <div id="paper-ticket-view" style="display: ${this.activeTab === 'ticket' ? 'flex' : 'none'}; flex-direction: column; gap: 10px; background: var(--bg-darkest); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">
              ${isFa ? 'اردر معامله:' : 'Ticket:'} <span style="color: var(--accent-cyan); font-weight: 800;">${this.currentSymbol}</span>
            </span>
            <span style="font-size: 13px; font-weight: 800; color: #fff;" class="num-ltr" id="order-cur-price">$${this.currentPrice.toFixed(2)}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button id="btn-order-buy" class="btn-primary" style="background: var(--accent-green); color: #fff; justify-content: center; height: 34px; font-weight: 800;">
              ${isFa ? 'خرید (BUY / LONG)' : 'BUY / LONG'}
            </button>
            <button id="btn-order-sell" class="btn-primary" style="background: var(--accent-red); color: #fff; justify-content: center; height: 34px; font-weight: 800;">
              ${isFa ? 'فروش (SELL / SHORT)' : 'SELL / SHORT'}
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <div>
              <label style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;">${isFa ? 'نوع اردر' : 'Type'}</label>
              <select id="order-type-sel" style="width: 100%; padding: 4px 6px; font-size: 11px;">
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
              </select>
            </div>
            <div>
              <label style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;">${isFa ? 'حجم معامله' : 'Quantity'}</label>
              <input type="number" id="order-qty-input" value="0.25" step="0.05" style="width: 100%; padding: 4px 6px; font-size: 11px;" />
            </div>
            <div>
              <label style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;">${isFa ? 'اهرم (Leverage)' : 'Leverage'}</label>
              <select id="order-lev-sel" style="width: 100%; padding: 4px 6px; font-size: 11px;">
                <option value="1">1x (Spot)</option>
                <option value="5">5x</option>
                <option value="10" selected>10x</option>
                <option value="20">20x</option>
                <option value="50">50x</option>
              </select>
            </div>
          </div>
        </div>

        <!-- View 2: Level 2 Depth of Market (DOM) -->
        <div id="paper-dom-view" style="display: ${this.activeTab === 'dom' ? 'flex' : 'none'}; flex-direction: column; gap: 8px; background: var(--bg-darkest); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <span style="font-weight: 700; color: var(--text-muted);">${isFa ? 'دفتر سفارشات زنده L2' : 'L2 Order Book'}</span>
            <span id="dom-spread-badge" class="num-ltr" style="font-size: 10px; color: var(--accent-cyan); font-weight: 700;">Spread: $0.50</span>
          </div>
          <div id="dom-ladder-wrap" class="num-ltr" style="font-family: var(--font-mono); font-size: 11px; display: flex; flex-direction: column; gap: 2px;">
            <!-- DOM rows populated dynamically -->
          </div>
        </div>

        <!-- Open Positions List -->
        <div style="background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px; border: 1px solid var(--border-subtle);">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span>${isFa ? 'پوزیشن‌های باز معاملاتی' : 'Open Positions'}</span>
            <span id="pos-count-badge" style="font-size: 10px; background: var(--bg-surface); padding: 1px 6px; border-radius: 3px; color: var(--accent-cyan);">1 Active</span>
          </div>
          <div id="positions-table-wrap"></div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updatePositionsView();
    if (this.activeTab === 'dom') {
      this.renderDOMView();
    }
  }

  bindEvents() {
    // Sub-tab toggles
    this.container.querySelector('#btn-subtab-ticket')?.addEventListener('click', () => {
      this.activeTab = 'ticket';
      this.render();
    });

    this.container.querySelector('#btn-subtab-dom')?.addEventListener('click', () => {
      this.activeTab = 'dom';
      this.render();
    });

    const btnBuy = this.container.querySelector('#btn-order-buy');
    const btnSell = this.container.querySelector('#btn-order-sell');
    const inputQty = this.container.querySelector('#order-qty-input');
    const selLev = this.container.querySelector('#order-lev-sel');

    btnBuy?.addEventListener('click', () => {
      const qty = parseFloat(inputQty?.value) || 0.1;
      const lev = parseInt(selLev?.value, 10) || 1;
      this.openPosition('long', qty, lev);
    });

    btnSell?.addEventListener('click', () => {
      const qty = parseFloat(inputQty?.value) || 0.1;
      const lev = parseInt(selLev?.value, 10) || 1;
      this.openPosition('short', qty, lev);
    });

    const btnReset = this.container.querySelector('#btn-reset-paper');
    btnReset?.addEventListener('click', () => {
      this.balance = 100000.0;
      this.positions = [];
      this.updatePositionsView();
    });
  }

  renderDOMView() {
    const wrap = this.container.querySelector('#dom-ladder-wrap');
    if (!wrap) return;

    const basePrice = this.currentPrice;
    const step = basePrice > 1000 ? 5 : (basePrice > 10 ? 0.05 : 0.0005);
    
    // Generate 5 Ask levels (above current price) and 5 Bid levels (below current price)
    const asks = [];
    for (let i = 5; i >= 1; i--) {
      const p = basePrice + i * step;
      const size = (Math.sin(i * 1.5) * 1.8 + 2.5).toFixed(3);
      asks.push({ price: p, size: parseFloat(size) });
    }

    const bids = [];
    for (let i = 1; i <= 5; i++) {
      const p = basePrice - i * step;
      const size = (Math.cos(i * 1.2) * 1.9 + 2.6).toFixed(3);
      bids.push({ price: p, size: parseFloat(size) });
    }

    const maxSize = Math.max(...asks.map(a => a.size), ...bids.map(b => b.size));

    let html = '';
    // Render Asks (Red)
    for (const ask of asks) {
      const pct = Math.round((ask.size / maxSize) * 100);
      html += `
        <div style="position: relative; display: flex; justify-content: space-between; align-items: center; padding: 2px 8px; border-radius: 3px; cursor: pointer; overflow: hidden; height: 22px;" class="dom-row dom-ask" data-price="${ask.price.toFixed(2)}">
          <div style="position: absolute; right: 0; top: 0; bottom: 0; width: ${pct}%; background: rgba(255, 77, 91, 0.15); pointer-events: none;"></div>
          <span style="color: var(--accent-red); font-weight: 700; z-index: 1;">$${ask.price.toFixed(2)}</span>
          <span style="color: var(--text-dim); z-index: 1;">${ask.size.toFixed(3)}</span>
        </div>
      `;
    }

    // Mid Market Price
    html += `
      <div style="background: var(--bg-surface); padding: 4px 8px; margin: 2px 0; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-weight: 800; border: 1px solid var(--border-subtle);">
        <span style="color: #fff; font-size: 12px;">$${basePrice.toFixed(2)}</span>
        <span style="font-size: 9px; color: var(--accent-green); background: rgba(0, 242, 176, 0.1); padding: 1px 4px; border-radius: 2px;">LAST TICK</span>
      </div>
    `;

    // Render Bids (Green)
    for (const bid of bids) {
      const pct = Math.round((bid.size / maxSize) * 100);
      html += `
        <div style="position: relative; display: flex; justify-content: space-between; align-items: center; padding: 2px 8px; border-radius: 3px; cursor: pointer; overflow: hidden; height: 22px;" class="dom-row dom-bid" data-price="${bid.price.toFixed(2)}">
          <div style="position: absolute; right: 0; top: 0; bottom: 0; width: ${pct}%; background: rgba(0, 242, 176, 0.15); pointer-events: none;"></div>
          <span style="color: var(--accent-green); font-weight: 700; z-index: 1;">$${bid.price.toFixed(2)}</span>
          <span style="color: var(--text-dim); z-index: 1;">${bid.size.toFixed(3)}</span>
        </div>
      `;
    }

    wrap.innerHTML = html;

    // Click on DOM price triggers order
    wrap.querySelectorAll('.dom-ask').forEach(row => {
      row.addEventListener('click', () => {
        const p = parseFloat(row.getAttribute('data-price'));
        this.openPosition('short', 0.2, 10, p);
      });
    });

    wrap.querySelectorAll('.dom-bid').forEach(row => {
      row.addEventListener('click', () => {
        const p = parseFloat(row.getAttribute('data-price'));
        this.openPosition('long', 0.2, 10, p);
      });
    });
  }

  openPosition(side, qty, leverage, customPrice = null) {
    const execPrice = customPrice || this.currentPrice;
    const notional = execPrice * qty;
    const margin = notional / leverage;
    if (margin > this.balance) {
      alert('Insufficient available paper balance');
      return;
    }

    this.balance -= margin;
    this.positions.push({
      id: 'pos-' + Date.now(),
      symbol: this.currentSymbol,
      side,
      qty,
      entryPrice: execPrice,
      markPrice: this.currentPrice,
      leverage,
      margin,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0
    });

    this.updatePositionsView();
  }

  closePosition(posId) {
    const idx = this.positions.findIndex(p => p.id === posId);
    if (idx !== -1) {
      const p = this.positions[idx];
      this.balance += (p.margin + p.unrealizedPnl);
      this.positions.splice(idx, 1);
      this.updatePositionsView();
    }
  }

  updatePositionsView() {
    const isFa = getLanguage() === 'fa';
    const wrap = this.container.querySelector('#positions-table-wrap');
    const eqEl = this.container.querySelector('#paper-equity');
    const pnlEl = this.container.querySelector('#paper-total-pnl');
    const curPriceEl = this.container.querySelector('#order-cur-price');
    const countBadge = this.container.querySelector('#pos-count-badge');

    if (eqEl) eqEl.innerText = `$${this.calculateEquity().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (curPriceEl) curPriceEl.innerText = `$${this.currentPrice.toFixed(2)}`;
    if (countBadge) countBadge.innerText = `${this.positions.length} ${isFa ? 'فعال' : 'Active'}`;

    const totalUnrealized = this.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    if (pnlEl) {
      pnlEl.innerText = `${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`;
      pnlEl.style.color = totalUnrealized >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }

    if (!wrap) return;

    if (this.positions.length === 0) {
      wrap.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); padding: 12px 0; text-align: center;">${isFa ? 'هیچ پوزیشن بازی وجود ندارد.' : 'No active positions open.'}</div>`;
      return;
    }

    wrap.innerHTML = this.positions.map(p => {
      const isWin = p.unrealizedPnl >= 0;
      const color = isWin ? 'var(--accent-green)' : 'var(--accent-red)';
      const sideBg = p.side === 'long' ? 'rgba(0, 242, 176, 0.15)' : 'rgba(255, 77, 91, 0.15)';
      const sideColor = p.side === 'long' ? 'var(--accent-green)' : 'var(--accent-red)';

      return `
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 8px 10px; margin-bottom: 8px;">
          <!-- Card Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 800; font-size: 13px; color: #fff;">${p.symbol}</span>
              <span style="font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 3px; background: ${sideBg}; color: ${sideColor};">
                ${p.side.toUpperCase()} ${p.leverage}x
              </span>
            </div>
            <button class="btn-secondary close-pos-btn" data-id="${p.id}" style="padding: 2px 8px; font-size: 10px; color: var(--accent-red); border-color: rgba(255, 77, 91, 0.4);">
              ${isFa ? 'بستن' : 'Close'}
            </button>
          </div>

          <!-- Position Grid Metrics (Strict LTR for numbers) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
            <div>
              <span style="color: var(--text-dim);">${isFa ? 'حجم:' : 'Size:'}</span>
              <span class="num-ltr" style="font-weight: 700; color: var(--text-main); margin-left: 2px;">${p.qty}</span>
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-dim);">${isFa ? 'ورود:' : 'Entry:'}</span>
              <span class="num-ltr" style="font-weight: 600; color: var(--text-main); margin-left: 2px;">$${p.entryPrice.toFixed(2)}</span>
            </div>
            <div>
              <span style="color: var(--text-dim);">${isFa ? 'قیمت جاری:' : 'Mark:'}</span>
              <span class="num-ltr" style="font-weight: 600; color: var(--text-main); margin-left: 2px;">$${p.markPrice.toFixed(2)}</span>
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-dim);">${isFa ? 'سود/زیان:' : 'P&L:'}</span>
              <span class="num-ltr" style="font-weight: 800; color: ${color}; margin-left: 2px;">
                ${isWin ? '+' : ''}$${p.unrealizedPnl.toFixed(2)} (${isWin ? '+' : ''}${p.unrealizedPnlPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    wrap.querySelectorAll('.close-pos-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.closePosition(e.target.getAttribute('data-id'));
      });
    });
  }
}
