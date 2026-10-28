// client/src/depthOfMarket.js
// Institutional Depth of Market (DOM) / Level 2 Order Book Ladder for TradingChart
// Features live Bid/Ask depth bars, real-time spread, and 1-click Limit order placement

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class DepthOfMarketView {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.symbol = 'BINANCE:BTCUSDT';
    this.orderQty = 0.1;
    this.data = null;
    this.pollTimer = null;
    this.isLoading = false;
    this.isUnavailable = false;

    if (this.container) {
      this.container.classList.add('depth-panel');
      this.container.setAttribute('data-testid', 'dom-panel');
      if (!this.container.id) this.container.id = 'depth-of-market-panel';
    }

    this.render();
    this.fetchDepth();
    this.startPolling();
  }

  destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  setSymbol(symbol) {
    this.symbol = symbol || 'BINANCE:BTCUSDT';
    this.fetchDepth();
  }

  startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.fetchDepth(true), 1500);
  }

  /** Only poll while the ladder is actually on screen and the tab is visible
   *  (was: every 1.5 s forever, for every visitor, even with the panel closed). */
  isVisible() {
    if (document.hidden || !this.container) return false;
    return this.container.getClientRects().length > 0 && this.container.offsetParent !== null;
  }

  async fetchDepth(silent = false) {
    if (silent && !this.isVisible()) return;
    if (this._inflight) return;
    this._inflight = true;
    try {
      const res = await fetch(`/api/depth?symbol=${encodeURIComponent(this.symbol)}&levels=12`);
      if (res.ok) {
        this.isUnavailable = false;
        this.data = await res.json();
        this.updateLadder();
        this.updateSourceBadge();
      } else {
        this.isUnavailable = true;
        this.data = null;
        this.renderUnavailable();
      }
    } catch (e) {
      if (!silent) console.warn('[DOM] Fetch depth error:', e);
      this.isUnavailable = true;
      this.renderUnavailable();
    } finally {
      this._inflight = false;
    }
  }

  /** Honest provenance: real Binance order book or unavailable (FR-008). */
  updateSourceBadge() {
    const b = this.container?.querySelector('#dom-source-badge');
    if (!b) return;
    const isFa = getLanguage() === 'fa';
    if (this.isUnavailable) {
      b.style.display = 'inline-block';
      b.textContent = isFa ? 'عدم دسترسی' : 'Unavailable';
      b.style.color = '#ef4444';
      b.style.background = 'rgba(239, 68, 68, 0.12)';
      b.title = isFa ? 'دفتر سفارش برای این نماد در دسترس نیست.' : 'Order book unavailable for this symbol.';
      return;
    }
    if (!this.data) return;
    b.style.display = 'inline-block';
    b.textContent = isFa ? 'زنده · بایننس' : 'Live · Binance';
    b.style.color = 'var(--accent-green)';
    b.style.background = 'rgba(14,203,129,0.12)';
    b.title = isFa ? 'دفتر سفارش واقعی بایننس (به‌روزرسانی هر ۱٫۵ ثانیه)' : 'Real Binance order book (≈1.5 s refresh)';
  }

  renderUnavailable() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';
    const symEl = this.container.querySelector('#dom-symbol');
    if (symEl) symEl.textContent = this.symbol;

    this.updateSourceBadge();

    const priceEl = this.container.querySelector('#dom-last-price');
    const spreadEl = this.container.querySelector('#dom-spread');
    const midSpreadEl = this.container.querySelector('#dom-mid-spread');
    if (priceEl) priceEl.textContent = '—';
    if (spreadEl) spreadEl.textContent = '—';
    if (midSpreadEl) {
      midSpreadEl.textContent = isFa ? 'دفتر سفارش در دسترس نیست' : 'Order book unavailable';
    }

    const asksContainer = this.container.querySelector('#dom-asks-list');
    const bidsContainer = this.container.querySelector('#dom-bids-list');
    if (asksContainer) asksContainer.innerHTML = '';
    if (bidsContainer) bidsContainer.innerHTML = '';

    const ladderScroll = this.container.querySelector('.dom-ladder-scroll');
    if (ladderScroll) {
      ladderScroll.innerHTML = `
        <div class="dom-unavailable-notice" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 220px; padding: 24px; text-align: center; color: var(--text-dim); gap: 10px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-gold, #f59e0b); opacity: 0.8;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div style="font-size: 13px; font-weight: 700; color: #e6e9f0;">
            ${isFa ? 'دفتر سفارش برای این نماد در دسترس نیست' : 'Order book unavailable for this symbol'}
          </div>
          <div style="font-size: 11px; max-width: 260px; line-height: 1.6; color: var(--text-muted, #94a3b8);">
            ${isFa ? 'دفتر سفارش عمق بازار تنها برای جفت‌ارزهای کریپتو بایننس به‌صورت زنده فراهم است.' : 'Depth of market order book is only available live for Binance crypto pairs.'}
          </div>
        </div>
      `;
    }
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div class="dom-wrapper depth-panel" id="depth-of-market-panel" data-testid="dom-panel" style="display: flex; flex-direction: column; height: 100%; background: var(--bg-surface); overflow: hidden; font-family: var(--font-sans);">
        <!-- DOM Header Strip -->
        <div style="padding: 10px 14px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 800; font-family: var(--font-mono); color: #fff; font-size: 13px;" id="dom-symbol">${this.symbol}</span>
              <span style="font-size: 10px; color: var(--accent-cyan); background: rgba(0,242,176,0.1); padding: 1px 5px; border-radius: 3px; font-weight: 700;">${isFa ? 'عمق بازار' : 'DOM L2'}</span>
              <span id="dom-source-badge" style="font-size: 10px; padding: 1px 5px; border-radius: 3px; font-weight: 700; display: none;"></span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'حجم سفارش:' : 'Size:'}</span>
              <div style="display: flex; align-items: center; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 6px; overflow: hidden;">
                <button id="dom-qty-dec" style="background: transparent; border: none; color: #fff; padding: 0; min-width: 30px; min-height: 30px; cursor: pointer; font-weight: 800; font-size: 14px;" title="${isFa ? 'کاهش حجم سفارش' : 'Decrease order size'}" aria-label="Decrease order size">−</button>
                <input type="number" id="dom-order-qty" value="${this.orderQty.toFixed(2)}" step="0.05" min="0.01" style="width: 42px; height: 30px; background: transparent; border: none; color: #fff; text-align: center; font-family: var(--font-mono); font-size: 12px; padding: 0 4px; appearance: textfield; -moz-appearance: textfield;" aria-label="Order size" />
                <button id="dom-qty-inc" style="background: transparent; border: none; color: #fff; padding: 0; min-width: 30px; min-height: 30px; cursor: pointer; font-weight: 800; font-size: 14px;" title="${isFa ? 'افزایش حجم سفارش' : 'Increase order size'}" aria-label="Increase order size">+</button>
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
          <div style="text-align: start;">${isFa ? 'سفارش' : 'Order'}</div>
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
            ${isFa ? 'میانهٔ بازار و اسپرد' : 'Mid Market · Spread'}
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
    // Re-hydrate from the last snapshot: render() runs on language switches and re-mounts,
    // and polling is visibility-gated, so without this the ladder stays blank until the next
    // on-screen poll.
    if (this.data) {
      this.updateLadder();
      this.updateSourceBadge();
    } else if (this.isUnavailable) {
      this.renderUnavailable();
    }
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
        if (this.app.paperTrading.executeOrder({ side: 'buy', type: 'market', qty: this.orderQty, symbol: this.symbol })) {
          this.app.showExecutionToast?.('BUY', this.orderQty, this.symbol);
        }
      }
    });

    sellBtn?.addEventListener('click', () => {
      if (this.app?.paperTrading) {
        if (this.app.paperTrading.executeOrder({ side: 'sell', type: 'market', qty: this.orderQty, symbol: this.symbol })) {
          this.app.showExecutionToast?.('SELL', this.orderQty, this.symbol);
        }
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
              <button class="btn-dom-limit-sell" data-price="${ask.price}" style="background: rgba(246,70,93,0.2); border: 1px solid rgba(246,70,93,0.4); color: #f6465d; padding: 4px 8px; font-size: 11px; min-height: 32px; font-weight: 800; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" title="${isFa ? 'سفارش لیمیت فروش' : 'Limit Sell'}" aria-label="Limit Sell">
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
              <button class="btn-dom-limit-buy" data-price="${bid.price}" style="background: rgba(14,203,129,0.2); border: 1px solid rgba(14,203,129,0.4); color: #0ecb81; padding: 4px 8px; font-size: 11px; min-height: 32px; font-weight: 800; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" title="${isFa ? 'سفارش لیمیت خرید' : 'Limit Buy'}" aria-label="Limit Buy">
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
          // PaperTrading.placeOrder owns validation + the (single) confirmation toast
          this.app.paperTrading.executeOrder({ side: 'sell', type: 'limit', price, qty: this.orderQty, symbol: this.symbol });
        }
      });
    });

    this.container.querySelectorAll('.btn-dom-limit-buy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const price = parseFloat(btn.getAttribute('data-price'));
        if (price && this.app?.paperTrading) {
          // PaperTrading.placeOrder owns validation + the (single) confirmation toast
          this.app.paperTrading.executeOrder({ side: 'buy', type: 'limit', price, qty: this.orderQty, symbol: this.symbol });
        }
      });
    });
  }

  showToast(msg, type = 'info') {
    // Delegate to the app's single toast host (consistent style/timing/a11y).
    if (window.__TRADING_APP__?.showToast) return window.__TRADING_APP__.showToast(msg, type);
  }
}
