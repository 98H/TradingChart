// client/src/paperTrading.js
// Institutional Paper Trading Terminal & Order Execution Manager

export class PaperTrading {
  constructor(options = {}) {
    this.container = options.container;
    this.currentSymbol = 'BTCUSDT';
    this.currentPrice = 64500.0;
    this.balance = 100000.0;
    this.positions = [
      {
        id: 'pos-1',
        symbol: 'BTCUSDT',
        side: 'long',
        qty: 0.5,
        entryPrice: 63800.0,
        markPrice: 64500.0,
        leverage: 10,
        margin: 3190.0,
        unrealizedPnl: 350.0,
        unrealizedPnlPct: 10.97,
        sl: 62500.0,
        tp: 67000.0
      }
    ];
    this.orders = [];
    this.render();
  }

  setMarket(symbol, price) {
    this.currentSymbol = symbol.replace(/^.*:/, '').toUpperCase();
    if (price && !isNaN(price)) {
      this.currentPrice = price;
      // update unrealized PnL
      for (const pos of this.positions) {
        if (pos.symbol === this.currentSymbol) {
          pos.markPrice = price;
          const diff = pos.side === 'long' ? (price - pos.entryPrice) : (pos.entryPrice - price);
          pos.unrealizedPnl = diff * pos.qty;
          pos.unrealizedPnlPct = (pos.unrealizedPnl / pos.margin) * 100;
        }
      }
      this.updatePositionsView();
    }
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow-y: auto; padding: 12px; gap: 14px;">
        <!-- Account Overview Card -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-subtle);">
          <div>
            <div style="font-size: 11px; color: var(--text-dim);">Paper Account Equity</div>
            <div style="font-size: 20px; font-weight: 800; color: #fff;" class="num-ltr" id="paper-equity">$${this.calculateEquity().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div style="display: flex; gap: 12px; text-align: right;">
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">Available Balance</div>
              <div style="font-size: 13px; font-weight: 700; color: var(--text-main);" class="num-ltr">$${this.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">Unrealized P&L</div>
              <div style="font-size: 13px; font-weight: 700; color: var(--accent-green);" class="num-ltr" id="paper-total-pnl">+$350.00</div>
            </div>
          </div>
        </div>

        <!-- Quick Order Ticket Form -->
        <div style="background: var(--bg-darkest); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">Order Ticket: <span style="color: var(--accent-cyan);">${this.currentSymbol}</span></span>
            <span style="font-size: 12px; font-weight: 800; color: #fff;" class="num-ltr" id="order-cur-price">$${this.currentPrice.toFixed(2)}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button id="btn-order-buy" class="btn-primary" style="background: var(--accent-green); color: #fff; justify-content: center; height: 36px;">
              BUY / LONG
            </button>
            <button id="btn-order-sell" class="btn-primary" style="background: var(--accent-red); color: #fff; justify-content: center; height: 36px;">
              SELL / SHORT
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <div>
              <label style="font-size: 10px; color: var(--text-dim);">Type</label>
              <select id="order-type-sel" style="width: 100%; padding: 4px 6px; font-size: 11px;">
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
              </select>
            </div>
            <div>
              <label style="font-size: 10px; color: var(--text-dim);">Quantity</label>
              <input type="number" id="order-qty-input" value="0.25" step="0.05" style="width: 100%; padding: 4px 6px; font-size: 11px;" />
            </div>
            <div>
              <label style="font-size: 10px; color: var(--text-dim);">Leverage</label>
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

        <!-- Open Positions Table -->
        <div style="background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">Open Positions</div>
          <div id="positions-table-wrap"></div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updatePositionsView();
  }

  calculateEquity() {
    const unPnl = this.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    return this.balance + unPnl;
  }

  bindEvents() {
    const btnBuy = this.container.querySelector('#btn-order-buy');
    const btnSell = this.container.querySelector('#btn-order-sell');
    const inputQty = this.container.querySelector('#order-qty-input');
    const selLev = this.container.querySelector('#order-lev-sel');

    btnBuy.addEventListener('click', () => {
      const qty = parseFloat(inputQty.value) || 0.1;
      const lev = parseInt(selLev.value, 10) || 1;
      this.openPosition('long', qty, lev);
    });

    btnSell.addEventListener('click', () => {
      const qty = parseFloat(inputQty.value) || 0.1;
      const lev = parseInt(selLev.value, 10) || 1;
      this.openPosition('short', qty, lev);
    });
  }

  openPosition(side, qty, leverage) {
    const notional = this.currentPrice * qty;
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
      entryPrice: this.currentPrice,
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
    const wrap = this.container.querySelector('#positions-table-wrap');
    const eqEl = this.container.querySelector('#paper-equity');
    const pnlEl = this.container.querySelector('#paper-total-pnl');
    const curPriceEl = this.container.querySelector('#order-cur-price');

    if (eqEl) eqEl.innerText = `$${this.calculateEquity().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (curPriceEl) curPriceEl.innerText = `$${this.currentPrice.toFixed(2)}`;

    const totalUnrealized = this.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    if (pnlEl) {
      pnlEl.innerText = `${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`;
      pnlEl.style.color = totalUnrealized >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }

    if (!wrap) return;
    if (this.positions.length === 0) {
      wrap.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); padding: 8px 0;">No active positions open.</div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table" style="font-size: 11px;">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Size</th>
            <th>Entry</th>
            <th>Mark</th>
            <th>P&L ($)</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${this.positions.map(p => `
            <tr>
              <td style="font-weight: 700;">${p.symbol}</td>
              <td><span style="color: ${p.side === 'long' ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 800;">${p.side.toUpperCase()} ${p.leverage}x</span></td>
              <td class="num-ltr">${p.qty}</td>
              <td class="num-ltr">$${p.entryPrice.toFixed(2)}</td>
              <td class="num-ltr">$${p.markPrice.toFixed(2)}</td>
              <td class="num-ltr" style="color: ${p.unrealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 800;">
                ${p.unrealizedPnl >= 0 ? '+' : ''}$${p.unrealizedPnl.toFixed(2)}
              </td>
              <td>
                <button class="btn-secondary close-pos-btn" data-id="${p.id}" style="padding: 2px 6px; font-size: 10px; color: var(--accent-red); border-color: rgba(246, 70, 93, 0.4);">Close</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('.close-pos-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.closePosition(e.target.getAttribute('data-id'));
      });
    });
  }
}
