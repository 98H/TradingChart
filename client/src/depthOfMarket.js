// client/src/depthOfMarket.js
// Institutional Depth of Market (DOM) / Level 2 Order Book Ladder for TradingChart
// Features live Bid/Ask depth bars, real-time spread, and 1-click Limit order placement

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class DepthOfMarketView {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.symbol = 'BTCUSDT';
    this.orderQty = 0.1;
    this.data = null;
    this.pollTimer = null;
    this.isLoading = false;

    this.render();
    this.fetchDepth();
    this.startPolling();
  }

  destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  setSymbol(symbol) {
    this.symbol = symbol.replace(/^.*:/, '').toUpperCase();
    this.fetchDepth();
  }

  startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.fetchDepth(true), 1500);
  }

  async fetchDepth(silent = false) {
    try {
      const res = await fetch(`/api/depth?symbol=${this.symbol}&levels=12`);
      if (res.ok) {
        this.data = await res.json();
        this.updateLadder();
      }
    } catch (e) {
      if (!silent) console.error('[DOM] Fetch depth error:', e);
    }
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div class="dom-wrapper" style="display: flex; flex-direction: column; height: 100%; background: var(--bg-surface); overflow: hidden; font-family: var(--font-sans);">
        <!-- DOM Header Strip -->
        <div style="padding: 10px 14px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 800; font-family: var(--font-mono); color: #fff; font-size: 13px;" id="dom-symbol">${this.symbol}</span>
              <span style="font-size: 10px; color: var(--accent-cyan); background: rgba(0,242,176,0.1); padding: 1px 5px; border-radius: 3px; font-weight: 700;">DOM L2</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'حجم سفارش:' : 'Size:'}</span>
              <div style="display: flex; align-items: center; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 4px; overflow: hidden;">
                <button id="dom-qty-dec" style="background: transparent; border: none; color: #fff; padding: 3px 8px; min-width: 26px; min-height: 24px; cursor: pointer; font-weight: 800; font-size: 13px;" title="${isFa ? 'کاهش حجم سفارش' : 'Decrease order size'}" aria-label="Decrease order size">−</button>
                <input type="number" id="dom-order-qty" value="${this.orderQty.toFixed(2)}" step="0.05" min="0.01" style="width: 58px; background: transparent; border: none; color: #fff; text-align: center; font-family: var(--font-mono); font-size: 11px;" aria-label="Order size" />
                <button id="dom-qty-inc" style="background: transparent; border: none; color: #fff; padding: 3px 8px; min-width: 26px; min-height: 24px; cursor: pointer; font-weight: 800; font-size: 13px;" title="${isFa ? 'افزایش حجم سفارش' : 'Increase order size'}" aria-label="Increase order size">+</button>
              </div>
            </div>
          </div>

          <!-- Price & Spread Overview -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; background: var(--bg-card); padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-subtle);">
            <div>
              <span style="color: var(--text-dim);">${isFa ? 'قیمت مارک:' : 'Mark Price:'} </span>
              <span id="dom-last-price" style="font-weight: 800; font-family: var(--font-mono); color: #fff;" class="num-ltr">...</span>
            </div>
            <div>
              <span style="color: var(--text-dim);">${isFa ? 'اسپرد:' : 'Spread:'} </span>
              <span id="dom-spread" style="font-weight: 700; font-family: var(--font-mono); color: var(--accent-gold);" class="num-ltr">...</span>
            </div>
          </div>
        </div>

        <!-- Table Columns Header -->
        <div style="display: grid; grid-template-columns: 75px 1fr 1fr 65px; padding: 6px 12px; font-size: 10px; font-weight: 700; color: var(--text-dim); background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); text-align: end;">
          <div style="text-align: start;">${isFa ? 'اردر' : 'Order'}</div>
          <div>${isFa ? 'قیمت' : 'Price'}</div>
          <div>${isFa ? 'حجم' : 'Size'}</div>
          <div>${isFa ? 'مجموع' : 'Total'}</div>
        </div>

        <!-- Order Ladder Area -->
        <div class="dom-ladder-scroll" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column;">
          <!-- Asks Container (Red, reverse order down to best ask) -->
          <div id="dom-asks-list" style="display: flex; flex-direction: column;"></div>

          <!-- Mid-Market Spread Strip -->
          <div id="dom-mid-spread" style="padding: 6px 12px; text-align: center; font-size: 11px; font-weight: 700; background: rgba(255,184,0,0.08); border-top: 1px solid rgba(255,184,0,0.2); border-bottom: 1px solid rgba(255,184,0,0.2); color: var(--accent-gold);">
            ${isFa ? 'تراز بازار و اسپرد جاری' : 'Mid Market · Real-Time Spread'}
          </div>

          <!-- Bids Container (Green, best bid down to lowest) -->
          <div id="dom-bids-list" style="display: flex; flex-direction: column;"></div>
        </div>

        <!-- Footer Quick Execution Strip -->
        <div style="padding: 8px 12px; background: var(--bg-darkest); border-top: 1px solid var(--border-subtle); display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button id="dom-btn-market-buy" class="btn-primary" style="background: var(--accent-green); justify-content: center; font-size: 11px; font-weight: 800; padding: 6px;">
            ${isFa ? 'خرید در مارکت' : 'MARKET BUY'}
          </button>
          <button id="dom-btn-market-sell" class="btn-primary" style="background: var(--accent-red); justify-content: center; font-size: 11px; font-weight: 800; padding: 6px;">
            ${isFa ? 'فروش در مارکت' : 'MARKET SELL'}
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const qtyInput = this.container.querySelector('#dom-order-qty');
    const decBtn = this.container.querySelector('#dom-qty-dec');
    const incBtn = this.container.querySelector('#dom-qty-inc');

    if (decBtn && qtyInput) {
      decBtn.addEventListener('click', () => {
        let val = parseFloat(qtyInput.value) || 0.1;
        val = Math.max(0.01, Number((val - 0.05).toFixed(2)));
        qtyInput.value = val;
        this.orderQty = val;
      });
    }

    if (incBtn && qtyInput) {
      incBtn.addEventListener('click', () => {
        let val = parseFloat(qtyInput.value) || 0.1;
        val = Number((val + 0.05).toFixed(2));
        qtyInput.value = val;
        this.orderQty = val;
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener('change', () => {
        this.orderQty = parseFloat(qtyInput.value) || 0.1;
      });
    }

    // Market Buy / Sell
    const buyBtn = this.container.querySelector('#dom-btn-market-buy');
    const sellBtn = this.container.querySelector('#dom-btn-market-sell');

    buyBtn?.addEventListener('click', () => {
      if (this.app?.paperTrading) {
        this.app.paperTrading.executeOrder('buy', 'market', this.data?.lastPrice || 0, this.orderQty);
        const isFa = getLanguage() === 'fa';
        this.showToast(isFa ? `🟢 خرید مارکت به میزان ${this.orderQty} از ${this.symbol} اجرا گردید` : `🟢 ${this.symbol} Market Buy of ${this.orderQty} executed!`);
      }
    });

    sellBtn?.addEventListener('click', () => {
      if (this.app?.paperTrading) {
        this.app.paperTrading.executeOrder('sell', 'market', this.data?.lastPrice || 0, this.orderQty);
        const isFa = getLanguage() === 'fa';
        this.showToast(isFa ? `🔴 فروش مارکت به میزان ${this.orderQty} از ${this.symbol} اجرا گردید` : `🔴 ${this.symbol} Market Sell of ${this.orderQty} executed!`);
      }
    });
  }

  updateLadder() {
    if (!this.data) return;
    const isFa = getLanguage() === 'fa';

    // Update Header
    const symEl = this.container.querySelector('#dom-symbol');
    const priceEl = this.container.querySelector('#dom-last-price');
    const spreadEl = this.container.querySelector('#dom-spread');
    const midSpreadEl = this.container.querySelector('#dom-mid-spread');

    if (symEl) symEl.textContent = this.data.symbol;
    if (priceEl) priceEl.textContent = `$${Number(this.data.lastPrice).toLocaleString()}`;
    if (spreadEl) spreadEl.textContent = `$${this.data.spread} (${this.data.spreadPct}%)`;
    if (midSpreadEl) {
      midSpreadEl.textContent = isFa
        ? `اسپرد جاری: $${this.data.spread} (${this.data.spreadPct}%)`
        : `Spread: $${this.data.spread} (${this.data.spreadPct}%)`;
    }

    const asksContainer = this.container.querySelector('#dom-asks-list');
    const bidsContainer = this.container.querySelector('#dom-bids-list');

    const maxDepth = this.data.maxDepth || 10;
    const formatPrice = (p) => Number(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatQty = (q) => Number(q).toFixed(3);

    // Render Asks (Render in reverse order so lowest ask is at the bottom, closest to spread)
    if (asksContainer) {
      const reversedAsks = [...(this.data.asks || [])].reverse();
      asksContainer.innerHTML = reversedAsks.map(ask => {
        const depthPct = Math.min(100, Math.round((ask.total / maxDepth) * 100));
        return `
          <div class="dom-row dom-ask-row" data-price="${ask.price}" data-side="sell" style="position: relative; display: grid; grid-template-columns: 75px 1fr 1fr 65px; padding: 4px 12px; font-size: 11px; font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; align-items: center; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03);">
            <div style="position: absolute; right: 0; top: 0; bottom: 0; width: ${depthPct}%; background: rgba(246,70,93,0.12); pointer-events: none; z-index: 0;"></div>
            <div style="text-align: start; z-index: 1;">
              <button class="btn-dom-limit-sell" data-price="${ask.price}" style="background: rgba(246,70,93,0.2); border: 1px solid rgba(246,70,93,0.4); color: #f6465d; padding: 3px 8px; font-size: 10px; min-height: 22px; font-weight: 800; border-radius: 4px; cursor: pointer;" title="${isFa ? 'سفارش لیمیت فروش' : 'Limit Sell'}" aria-label="Limit Sell">
                ${isFa ? '− فروش' : '− Sell'}
              </button>
            </div>
            <div style="color: #f6465d; font-weight: 700; z-index: 1;" class="num-ltr">$${formatPrice(ask.price)}</div>
            <div style="color: var(--text-base); z-index: 1;" class="num-ltr">${formatQty(ask.size)}</div>
            <div style="color: var(--text-dim); z-index: 1;" class="num-ltr">${formatQty(ask.total)}</div>
          </div>
        `;
      }).join('');
    }

    // Render Bids (Highest bid at top, closest to spread)
    if (bidsContainer) {
      bidsContainer.innerHTML = (this.data.bids || []).map(bid => {
        const depthPct = Math.min(100, Math.round((bid.total / maxDepth) * 100));
        return `
          <div class="dom-row dom-bid-row" data-price="${bid.price}" data-side="buy" style="position: relative; display: grid; grid-template-columns: 75px 1fr 1fr 65px; padding: 4px 12px; font-size: 11px; font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: end; align-items: center; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03);">
            <div style="position: absolute; right: 0; top: 0; bottom: 0; width: ${depthPct}%; background: rgba(14,203,129,0.12); pointer-events: none; z-index: 0;"></div>
            <div style="text-align: start; z-index: 1;">
              <button class="btn-dom-limit-buy" data-price="${bid.price}" style="background: rgba(14,203,129,0.2); border: 1px solid rgba(14,203,129,0.4); color: #0ecb81; padding: 3px 8px; font-size: 10px; min-height: 22px; font-weight: 800; border-radius: 4px; cursor: pointer;" title="${isFa ? 'سفارش لیمیت خرید' : 'Limit Buy'}" aria-label="Limit Buy">
                ${isFa ? '+ خرید' : '+ Buy'}
              </button>
            </div>
            <div style="color: #0ecb81; font-weight: 700; z-index: 1;" class="num-ltr">$${formatPrice(bid.price)}</div>
            <div style="color: var(--text-base); z-index: 1;" class="num-ltr">${formatQty(bid.size)}</div>
            <div style="color: var(--text-dim); z-index: 1;" class="num-ltr">${formatQty(bid.total)}</div>
          </div>
        `;
      }).join('');
    }

    // Bind row limit buttons
    this.container.querySelectorAll('.btn-dom-limit-sell').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const price = parseFloat(btn.getAttribute('data-price'));
        if (price && this.app?.paperTrading) {
          this.app.paperTrading.executeOrder('sell', 'limit', price, this.orderQty);
          const isFa = getLanguage() === 'fa';
          this.showToast(isFa ? `سفارش لیمیت فروش در نرخ $${price} (${this.orderQty} ${this.symbol}) ثبت گردید` : `Limit Sell order placed at $${price} (${this.orderQty} ${this.symbol})`);
        }
      });
    });

    this.container.querySelectorAll('.btn-dom-limit-buy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const price = parseFloat(btn.getAttribute('data-price'));
        if (price && this.app?.paperTrading) {
          this.app.paperTrading.executeOrder('buy', 'limit', price, this.orderQty);
          const isFa = getLanguage() === 'fa';
          this.showToast(isFa ? `سفارش لیمیت خرید در نرخ $${price} (${this.orderQty} ${this.symbol}) ثبت گردید` : `Limit Buy order placed at $${price} (${this.orderQty} ${this.symbol})`);
        }
      });
    });
  }

  showToast(msg) {
    let toast = document.querySelector('#tradingchart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tradingchart-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: var(--bg-card);
        border: 1px solid var(--accent-cyan);
        color: #fff;
        padding: 12px 18px;
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        font-size: 13px;
        font-weight: 700;
        z-index: 999999;
        transition: opacity 0.2s;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
    }, 2500);
  }
}
