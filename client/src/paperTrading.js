// client/src/paperTrading.js
// Institutional Paper Trading Terminal & Order Execution Manager with Level 2 DOM (Depth of Market)

import { getLanguage, t, toPersianDigits } from './i18n.js';
import { showConfirmDialog, showPromptDialog } from './uiDialog.js';

function escapeHtmlAcc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export class PaperTrading {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.currentSymbol = 'BTCUSDT';
    this.currentPrice = 78000.0;
    this.activeTab = 'ticket'; // 'ticket' or 'dom'
    this.orders = [];
    this.loadActiveAccount();
    this.render();
  }

  // ── Multi-account paper layer (TradingView "Portfolios" parity) ────────
  // Accounts persist across reloads and sync with the user's cloud state.
  loadAccounts() {
    try {
      const raw = JSON.parse(localStorage.getItem('tradingchart_paper_accounts') || 'null');
      if (Array.isArray(raw) && raw.length > 0) return raw;
    } catch (e) { /* fall through */ }
    return [];
  }

  saveAccounts() {
    // Persist the UNION of in-memory and stored accounts: an in-memory save must
    // never resurrect an account the user deleted on another device, and must
    // never drop one another device just added.
    try {
      const existing = JSON.parse(localStorage.getItem('tradingchart_paper_accounts') || '[]');
      const deleted = JSON.parse(localStorage.getItem('tradingchart_paper_deleted') || '{}');
      if (Array.isArray(existing) && existing.length) {
        const byId = new Map((this.accounts || []).map(a => [a.id, a]));
        for (const ext of existing) {
          if (ext && ext.id && !byId.has(ext.id) && !deleted[ext.id]) byId.set(ext.id, ext);
        }
        this.accounts = [...byId.values()];
      }
      localStorage.setItem('tradingchart_paper_accounts', JSON.stringify(this.accounts || []));
    } catch (e) { /* quota */ }
  }

  /** External state (cloud sync) replaced localStorage — refresh in-memory view.
   *  Union by id: cloud adds accounts this tab never saw; locally-known accounts
   *  survive (the sync layer already merged before writing localStorage). */
  reloadFromStorage() {
    try {
      const raw = JSON.parse(localStorage.getItem('tradingchart_paper_accounts') || '[]');
      if (!Array.isArray(raw)) return;
      const deleted = JSON.parse(localStorage.getItem('tradingchart_paper_deleted') || '{}');
      const byId = new Map(raw.filter(a => a && a.id && !deleted[a.id]).map(a => [a.id, a]));
      for (const loc of this.accounts || []) {
        if (loc && loc.id && !byId.has(loc.id) && !deleted[loc.id]) byId.set(loc.id, loc);
      }
      this.accounts = [...byId.values()];
      this.render?.();
    } catch (e) { /* keep current */ }
  }

  accountDefaults() {
    // Default account name is a system label, not user data: keep it
    // language-neutral in storage and translate at render time so switching
    // languages renames it (no stale 'Main Paper' chip in a Persian session).
    return [
      { id: 'pap_main', name: 'Main Paper', isSystem: true, balance: 100000.0, positions: [], history: [], createdAt: Date.now() }
    ];
  }

  displayNameFor(a, isFa) {
    if (a && (a.isSystem || (a.id === 'pap_main' && (a.name === 'Main Paper' || a.name === 'حساب اصلی دمو')))) {
      return isFa ? 'حساب اصلی دمو' : 'Main Paper';
    }
    return a ? a.name : '';
  }

  loadActiveAccount() {
    this.accounts = this.loadAccounts();
    if (this.accounts.length === 0) this.accounts = this.accountDefaults();
    let activeId = null;
    try { activeId = localStorage.getItem('tradingchart_paper_active'); } catch (e) {}
    this.activeAccountId = this.accounts.some(a => a.id === activeId) ? activeId : this.accounts[0].id;
    this.hydrateFromActive();
  }

  hydrateFromActive() {
    const acc = this.accounts.find(a => a.id === this.activeAccountId) || this.accounts[0];
    this.activeAccountId = acc.id;
    this.balance = Number(acc.balance) || 0;
    this.positions = Array.isArray(acc.positions) ? acc.positions : [];
    this.history = Array.isArray(acc.history) ? acc.history : [];
    this.orders = Array.isArray(acc.orders) ? acc.orders : [];
    try { localStorage.setItem('tradingchart_paper_active', this.activeAccountId); } catch (e) {}
  }

  /** Snapshot the live account into the store (called after every mutation). */
  persistAccount() {
    // Cheap change-signature guard: setMarket() ticks call this constantly,
    // but the store must only be written when something actually changed.
    const sig = `${this.balance}|${this.positions.length}|${this.positions[this.positions.length - 1]?.id || ''}|${(this.history || []).length}|${(this.orders || []).map(o => o.id).join(',')}`;
    if (this._persistSig === sig) return;
    this._persistSig = sig;
    const acc = this.accounts.find(a => a.id === this.activeAccountId);
    if (acc) {
      acc.balance = this.balance;
      acc.positions = this.positions;
      acc.history = this.history || [];
      acc.orders = this.orders || [];
      this.saveAccounts();
    }
  }

  switchAccount(accountId) {
    if (!this.accounts.some(a => a.id === accountId)) return;
    this.persistAccount();
    this.activeAccountId = accountId;
    this.hydrateFromActive();
    this.render();
  }

  createAccount(name) {
    if (this.app?.auth && !this.app.auth.enforce('paperAccounts', this.accounts.length, 'paper accounts', 'حساب‌های معاملاتی کاغذی')) return null;
    const isFa = getLanguage() === 'fa';
    const defaultCap = window.__TRADING_APP__?.userProfileModal?.profile?.defaultStartingCapital || 100000.0;
    const acc = {
      id: 'pap_' + Date.now().toString(36),
      name: (name || (isFa ? 'حساب دمو جدید' : 'New Paper Account')).slice(0, 40),
      balance: Number(defaultCap),
      positions: [],
      history: [],
      createdAt: Date.now()
    };
    this.accounts.push(acc);
    this.saveAccounts();
    this.switchAccount(acc.id);
    return acc;
  }

  renameAccount(accountId, name) {
    const acc = this.accounts.find(a => a.id === accountId);
    if (acc && name) { acc.name = String(name).slice(0, 40); acc.isSystem = false; this.saveAccounts(); this.render(); }
  }

  deleteAccount(accountId) {
    if (this.accounts.length <= 1) return false;
    const idx = this.accounts.findIndex(a => a.id === accountId);
    if (idx < 0) return false;
    this.accounts.splice(idx, 1);
    // Tombstone: deletion must survive the save-time union merge, otherwise a
    // stale localStorage copy resurrects the account the user just removed.
    try {
      const ts = JSON.parse(localStorage.getItem('tradingchart_paper_deleted') || '{}');
      ts[accountId] = Date.now();
      localStorage.setItem('tradingchart_paper_deleted', JSON.stringify(ts));
    } catch (e) { /* quota */ }
    if (this.activeAccountId === accountId) {
      this.activeAccountId = this.accounts[0].id;
      this.hydrateFromActive();
    }
    this.saveAccounts();
    this.render();
    return true;
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
      this.checkPendingOrders();
      this.updatePositionsView();
      if (this.activeTab === 'dom') {
        this.renderDOMView();
      }
    }
  }

  // ── Pending order engine (limit / stop) ────────────────────────────────
  // Real exchange semantics: a resting order fills only when the market
  // trades through its price. Marketable orders (buy-limit ≥ ask, sell-limit
  // ≤ bid) fill immediately at the market, never at a better fictitious price.
  isMarketable(o, px) {
    if (o.type === 'limit') return o.side === 'long' ? px <= o.price : px >= o.price;
    if (o.type === 'stop') return o.side === 'long' ? px >= o.price : px <= o.price;
    return true;
  }

  checkPendingOrders() {
    if (!this.orders?.length || !this.currentPrice) return;
    const px = this.currentPrice;
    const still = [];
    const filled = [];
    for (const o of this.orders) {
      if (o.symbol === this.currentSymbol && this.isMarketable(o, px)) filled.push(o);
      else still.push(o);
    }
    if (!filled.length) return;
    this.orders = still;
    const isFa = getLanguage() === 'fa';
    for (const o of filled) {
      // limit: fill at the limit price (or better); stop: becomes market
      const fillPx = o.type === 'limit'
        ? (o.side === 'long' ? Math.min(o.price, px) : Math.max(o.price, px))
        : px;
      const ok = this.openPosition(o.side, o.qty, o.leverage, fillPx, { silent: true });
      const sideTxt = isFa ? (o.side === 'long' ? 'خرید' : 'فروش') : (o.side === 'long' ? 'Buy' : 'Sell');
      const typeTxt = isFa ? (o.type === 'limit' ? 'لیمیت' : 'استاپ') : (o.type === 'limit' ? 'limit' : 'stop');
      if (ok) {
        window.__TRADING_APP__?.showToast?.(isFa
          ? `سفارش ${typeTxt} ${sideTxt} ${o.symbol} در قیمت ${this.fmtPx(fillPx)} اجرا شد`
          : `${sideTxt} ${typeTxt} ${o.symbol} filled at ${this.fmtPx(fillPx)}`, 'success');
      }
    }
  }

  /** Simulated half-spread model (paper venue). Same function feeds the
   *  quick-trade bid/ask display, so displayed price === fill price. */
  spreadFor(px) {
    const n = Number(px) || 0;
    return n > 1000 ? 5 : (n > 10 ? 0.05 : 0.0005);
  }
  quote(side) {
    const h = this.spreadFor(this.currentPrice) / 2;
    return side === 'long' ? this.currentPrice + h : this.currentPrice - h;
  }

  fmtPnl(v) {
    const n = Number(v) || 0;
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n > 0.004 ? `+$${abs}` : n < -0.004 ? `−$${abs}` : `$0.00`;
  }

  fmtPx(v) {
    const n = Number(v) || 0;
    const d = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: d });
  }

  /** Single entry point for every order source (ticket, DOM, chart, API). */
  placeOrder({ side, type = 'market', price = null, qty = 0.1, leverage = null } = {}) {
    const isFa = getLanguage() === 'fa';
    const s = (side === 'buy' || side === 'long') ? 'long' : 'short';
    const q = Number(qty);
    const lev = Number(leverage) || this.defaultLeverage();
    if (!(q > 0)) {
      window.__TRADING_APP__?.showToast?.(isFa ? 'حجم سفارش باید بزرگ‌تر از صفر باشد.' : 'Order quantity must be greater than zero.', 'error');
      return null;
    }
    const px = this.currentPrice;
    if (type === 'market' || price == null || price === '') {
      // market: buy lifts the ask, sell hits the bid
      return this.openPosition(s, q, lev, this.quote(s)) ? 'filled' : null;
    }
    const p = Number(price);
    if (!(p > 0)) {
      window.__TRADING_APP__?.showToast?.(isFa ? 'قیمت سفارش معتبر نیست.' : 'Invalid order price.', 'error');
      return null;
    }
    const order = {
      id: 'ord-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      symbol: this.currentSymbol, side: s, type, price: p, qty: q, leverage: lev,
      createdAt: new Date().toISOString()
    };
    if (this.isMarketable(order, px)) {
      // marketable on arrival → fills now at the market price
      const q0 = this.quote(s); // buy lifts ask, sell hits bid
      const fillPx = type === 'limit' ? (s === 'long' ? Math.min(p, q0) : Math.max(p, q0)) : q0;
      return this.openPosition(s, q, lev, fillPx) ? 'filled' : null;
    }
    // reserve margin check up-front so the user is told now, not at trigger time
    if ((p * q) / lev > this.balance) {
      window.__TRADING_APP__?.showToast?.(isFa ? 'موجودی مارجین دمو برای این سفارش کافی نیست.' : 'Insufficient paper balance for this order.', 'error');
      return null;
    }
    this.orders.push(order);
    const sideTxt = isFa ? (s === 'long' ? 'خرید' : 'فروش') : (s === 'long' ? 'Buy' : 'Sell');
    const typeTxt = isFa ? (type === 'limit' ? 'لیمیت' : 'استاپ') : (type === 'limit' ? 'limit' : 'stop');
    window.__TRADING_APP__?.showToast?.(isFa
      ? `سفارش ${typeTxt} ${sideTxt} ${toPersianDigits(String(q))} ${order.symbol} در قیمت ${this.fmtPx(p)} ثبت شد و در انتظار اجراست`
      : `${sideTxt} ${typeTxt} ${q} ${order.symbol} @ ${this.fmtPx(p)} placed (pending)`, 'info');
    this.updatePositionsView();
    return order.id;
  }

  cancelOrder(id) {
    const n = this.orders.length;
    this.orders = this.orders.filter(o => o.id !== id);
    if (this.orders.length !== n) {
      const isFa = getLanguage() === 'fa';
      window.__TRADING_APP__?.showToast?.(isFa ? 'سفارش لغو شد.' : 'Order cancelled.', 'info');
      this.updatePositionsView();
    }
  }

  defaultLeverage() {
    const sel = this.container?.querySelector?.('#order-lev-sel');
    const v = parseInt(sel?.value, 10);
    if (v > 0) return v;
    const prof = window.__TRADING_APP__?.userProfileModal?.profile;
    return Number(prof?.defaultLeverage) || 1;
  }

  calculateEquity() {
    const unPnl = this.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    return this.balance + unPnl;
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';
    const defaultCap = window.__TRADING_APP__?.userProfileModal?.profile?.defaultStartingCapital || 100000;
    const defaultLev = Number(window.__TRADING_APP__?.userProfileModal?.profile?.defaultLeverage) || 10;

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
                $${this.calculateEquity().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button id="btn-reset-paper" class="btn-secondary" style="font-size: 11px; padding: 5px 12px; min-height: 32px; color: var(--text-dim); font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;" title="${isFa ? `بازنشانی موجودی به $${Number(defaultCap).toLocaleString()}` : `Reset balance to $${Number(defaultCap).toLocaleString()}`}" aria-label="Reset account balance">
              ${isFa ? 'بازنشانی' : 'Reset'}
            </button>
          </div>

          <!-- Multi-account switcher (TradingView Portfolios parity) -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-size:10px; color:var(--text-dim);">${isFa ? 'حساب:' : 'Account:'}</span>
            ${this.accounts.map(a => `
              <button class="paper-account-chip ${a.id === this.activeAccountId ? 'active' : ''}" data-acc="${a.id}" style="padding:4px 10px; min-height:28px; border-radius:12px; font-size:10px; font-weight:700; cursor:pointer; border:1px solid ${a.id === this.activeAccountId ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; background:${a.id === this.activeAccountId ? 'rgba(0,242,176,0.12)' : 'var(--bg-surface)'}; color:${a.id === this.activeAccountId ? 'var(--accent-cyan)' : 'var(--text-dim)'}; display: inline-flex; align-items: center;">
                ${escapeHtmlAcc(this.displayNameFor(a, isFa))}
              </button>`).join('')}
            <button id="btn-paper-new-account" title="${isFa ? 'حساب دمو جدید' : 'New paper account'}" style="width:28px; height:28px; min-width:28px; min-height:28px; border-radius:50%; border:1px dashed var(--border-subtle); background:transparent; color:var(--accent-cyan); font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;">+</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'موجودی آزاد (بدون مارجین درگیر)' : 'Free Balance (excl. margin)'}</div>
              <div style="font-size: 13px; font-weight: 700; color: var(--text-main); margin-top: 2px;" class="num-ltr">
                $${this.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'سود/زیان شناور' : 'Unrealized P&L'}</div>
              <div style="font-size: 13px; font-weight: 800; color: var(--text-main); margin-top: 2px;" class="num-ltr" id="paper-total-pnl">
                ${this.fmtPnl(this.positions.reduce((a, x) => a + (x.unrealizedPnl || 0), 0))}
              </div>
            </div>
          </div>
        </div>

        <!-- Mode Sub-Tabs: Ticket vs Level 2 DOM -->
        <div style="display: flex; gap: 4px; background: var(--bg-darkest); padding: 3px; border-radius: 6px; border: 1px solid var(--border-subtle);">
          <button id="btn-subtab-ticket" class="btn-secondary ${this.activeTab === 'ticket' ? 'active' : ''}" style="flex: 1; justify-content: center; font-size: 11px; padding: 5px; ${this.activeTab === 'ticket' ? 'background: var(--bg-card); color: var(--accent-cyan); border-color: var(--accent-cyan);' : 'border-color: transparent;'}">
            ${isFa ? 'تیکت سفارش' : 'Order Ticket'}
          </button>
          <button id="btn-subtab-dom" class="btn-secondary ${this.activeTab === 'dom' ? 'active' : ''}" style="flex: 1; justify-content: center; font-size: 11px; padding: 5px; ${this.activeTab === 'dom' ? 'background: var(--bg-card); color: var(--accent-cyan); border-color: var(--accent-cyan);' : 'border-color: transparent;'}">
            ${isFa ? 'عمق بازار (DOM)' : 'Depth of Market (DOM)'}
          </button>
        </div>

        <!-- View 1: Quick Order Ticket Form -->
        <div id="paper-ticket-view" style="display: ${this.activeTab === 'ticket' ? 'flex' : 'none'}; flex-direction: column; gap: 10px; background: var(--bg-darkest); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">
              ${isFa ? 'سفارش روی' : 'Ticket:'} <bdi id="order-ticket-sym" style="color: var(--accent-cyan); font-weight: 800;">${this.currentSymbol}</bdi>
            </span>
            <span style="font-size: 13px; font-weight: 800; color: #fff;" class="num-ltr" id="order-cur-price">$${this.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button id="btn-order-buy" class="btn-primary" style="background: var(--accent-green); color: #fff; justify-content: center; height: 34px; font-weight: 800;">
              ${isFa ? 'خرید' : 'Buy / Long'}
            </button>
            <button id="btn-order-sell" class="btn-primary" style="background: var(--accent-red); color: #fff; justify-content: center; height: 34px; font-weight: 800;">
              ${isFa ? 'فروش' : 'Sell / Short'}
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <div>
              <label style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;">${isFa ? 'نوع سفارش' : 'Type'}</label>
              <select id="order-type-sel" style="width: 100%; padding: 4px 6px; font-size: 11px;">
                <option value="market">${isFa ? 'بازار' : 'Market'}</option>
                <option value="limit">${isFa ? 'لیمیت' : 'Limit'}</option>
                <option value="stop">${isFa ? 'استاپ' : 'Stop'}</option>
              </select>
            </div>
            <div>
              <label style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;">${isFa ? 'حجم معامله' : 'Quantity'}</label>
              <input type="number" id="order-qty-input" value="0.25" min="0" step="0.05" inputmode="decimal" class="num-ltr" style="width: 100%; padding: 4px 6px; font-size: 11px;" />
            </div>
            <div>
              <label style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;">${isFa ? 'اهرم' : 'Leverage'}</label>
              <select id="order-lev-sel" style="width: 100%; padding: 4px 6px; font-size: 11px;">
                <option value="1" ${defaultLev === 1 ? 'selected' : ''}>${isFa ? '1x (اسپات)' : '1x (Spot)'}</option>
                <option value="2" ${defaultLev === 2 ? 'selected' : ''}>2x</option>
                <option value="5" ${defaultLev === 5 ? 'selected' : ''}>5x</option>
                <option value="10" ${defaultLev === 10 ? 'selected' : ''}>10x</option>
                <option value="20" ${defaultLev === 20 ? 'selected' : ''}>20x</option>
                <option value="50" ${defaultLev === 50 ? 'selected' : ''}>50x</option>
                <option value="100" ${defaultLev === 100 ? 'selected' : ''}>100x</option>
              </select>
            </div>
          </div>
          <div id="order-price-wrap" style="display: none;">
            <label for="order-price-input" style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;"><span id="order-price-label">${isFa ? 'قیمت سفارش' : 'Order price'}</span> <span style="opacity:.7">(USD)</span></label>
            <input type="number" id="order-price-input" class="num-ltr" min="0" step="any" inputmode="decimal" style="width: 100%; padding: 4px 6px; font-size: 11px;" />
          </div>
        </div>

        <!-- View 2: Level 2 Depth of Market (DOM) -->
        <div id="paper-dom-view" style="display: ${this.activeTab === 'dom' ? 'flex' : 'none'}; flex-direction: column; gap: 8px; background: var(--bg-darkest); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <span style="font-weight: 700; color: var(--text-muted);">${isFa ? 'دفتر سفارشات زنده L2' : 'L2 Order Book'}</span>
            <span id="dom-spread-badge" class="num-ltr" style="font-size: 10px; color: var(--accent-cyan); font-weight: 700;"></span>
          </div>
          <div id="dom-ladder-wrap" class="num-ltr" style="font-family: var(--font-mono); font-size: 11px; display: flex; flex-direction: column; gap: 2px;">
            <!-- DOM rows populated dynamically -->
          </div>
        </div>

        <!-- Open Positions List -->
        <div style="background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px; border: 1px solid var(--border-subtle);">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span>${isFa ? 'پوزیشن‌های باز معاملاتی' : 'Open Positions'}</span>
            <span id="pos-count-badge" style="font-size: 10px; background: var(--bg-surface); padding: 1px 6px; border-radius: 3px; color: var(--accent-cyan);"></span>
          </div>
          <div id="positions-table-wrap"></div>
        </div>

        <!-- Pending (resting) orders -->
        <div id="pending-orders-card" style="background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px; border: 1px solid var(--border-subtle);">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span>${isFa ? 'سفارش‌های در انتظار' : 'Pending Orders'}</span>
            <span id="ord-count-badge" style="font-size: 10px; background: var(--bg-surface); padding: 1px 6px; border-radius: 3px; color: var(--accent-gold, #f59e0b);"></span>
          </div>
          <div id="orders-table-wrap"></div>
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

    const selType = this.container.querySelector('#order-type-sel');
    const priceWrap = this.container.querySelector('#order-price-wrap');
    const inputPrice = this.container.querySelector('#order-price-input');
    const syncType = () => {
      const isMkt = (selType?.value || 'market') === 'market';
      if (priceWrap) priceWrap.style.display = isMkt ? 'none' : 'block';
      if (!isMkt && inputPrice && !inputPrice.value) inputPrice.value = String(+this.currentPrice.toFixed(this.currentPrice >= 1 ? 2 : 6));
      this.ticketType = selType?.value || 'market';
      const lbl = this.container.querySelector('#order-price-label');
      const fa = getLanguage() === 'fa';
      if (lbl) lbl.textContent = selType?.value === 'stop' ? (fa ? 'قیمت فعال‌سازی استاپ' : 'Stop trigger price') : (fa ? 'قیمت لیمیت' : 'Limit price');
    };
    selType?.addEventListener('change', syncType);
    if (selType && this.ticketType) selType.value = this.ticketType;
    syncType();
    const submit = (side) => {
      const qty = parseFloat(inputQty?.value);
      const lev = parseInt(selLev?.value, 10) || 1;
      const type = selType?.value || 'market';
      this.placeOrder({ side, type, price: type === 'market' ? null : inputPrice?.value, qty, leverage: lev });
    };
    btnBuy?.addEventListener('click', () => submit('long'));
    btnSell?.addEventListener('click', () => submit('short'));

    const btnReset = this.container.querySelector('#btn-reset-paper');
    // Multi-account switcher events (TradingView Portfolios parity)
    this.container.querySelectorAll('.paper-account-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchAccount(chip.getAttribute('data-acc'));
      });
    });
    this.container.querySelector('#btn-paper-new-account')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isFaNew = getLanguage() === 'fa';
      showPromptDialog({
        title: isFaNew ? 'حساب دمو جدید' : 'New Paper Account',
        placeholder: isFaNew ? 'نام حساب' : 'Account name',
        confirmText: isFaNew ? 'ایجاد' : 'Create',
        onConfirm: (name) => { if (name) this.createAccount(name); }
      });
    });
    btnReset?.addEventListener('click', () => {
      const isFa = getLanguage() === 'fa';
      const defaultCap = window.__TRADING_APP__?.userProfileModal?.profile?.defaultStartingCapital || 100000.0;
      showConfirmDialog({
        title: isFa ? 'بازنشانی حساب دمو' : 'Reset Paper Account',
        message: isFa 
          ? `آیا از بازنشانی موجودی حساب دمو به $${Number(defaultCap).toLocaleString()} و بستن تمام پوزیشن‌ها اطمینان دارید؟`
          : `Are you sure you want to reset your paper account balance to $${Number(defaultCap).toLocaleString()} and close all open positions?`,
        confirmText: isFa ? 'بازنشانی حساب دمو' : 'Reset Paper Account',
        cancelText: isFa ? 'انصراف' : 'Cancel',
        danger: true,
        onConfirm: () => {
          this.balance = Number(defaultCap);
          this.positions = [];
          this.orders = [];
          this.updatePositionsView();
          window.__TRADING_APP__?.showToast?.(isFa ? 'حساب دمو بازنشانی شد' : 'Paper account reset', 'success');
        }
      });
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
        <span style="font-size: 9px; color: var(--accent-green); background: rgba(0, 242, 176, 0.1); padding: 1px 4px; border-radius: 2px;">${getLanguage() === 'fa' ? 'آخرین قیمت' : 'LAST'}</span>
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
    const spreadBadge = this.container.querySelector('#dom-spread-badge');
    if (spreadBadge) spreadBadge.textContent = `${getLanguage() === 'fa' ? 'اسپرد' : 'Spread'}: $${this.fmtPx(step * 2)}`;
    wrap.title = getLanguage() === 'fa' ? 'برای ثبت سفارش لیمیت، روی سطح قیمت کلیک کنید' : 'Click a price level to place a limit order';

    // Click on DOM price triggers order
    wrap.querySelectorAll('.dom-ask').forEach(row => {
      row.addEventListener('click', () => {
        const p = parseFloat(row.getAttribute('data-price'));
        // Ask level above market → resting SELL limit
        this.placeOrder({ side: 'short', type: 'limit', price: p, qty: parseFloat(this.container.querySelector('#order-qty-input')?.value) || 0.1 });
      });
    });

    wrap.querySelectorAll('.dom-bid').forEach(row => {
      row.addEventListener('click', () => {
        const p = parseFloat(row.getAttribute('data-price'));
        // Bid level below market → resting BUY limit
        this.placeOrder({ side: 'long', type: 'limit', price: p, qty: parseFloat(this.container.querySelector('#order-qty-input')?.value) || 0.1 });
      });
    });
  }

  openPosition(side, qty, leverage, customPrice = null, opts = {}) {
    const execPrice = Number(customPrice) || this.currentPrice;
    const lev = Number(leverage) || 1;
    const notional = execPrice * qty;
    const margin = notional / lev;
    if (margin > this.balance) {
      window.__TRADING_APP__?.showToast?.(getLanguage() === 'fa' ? 'موجودی مارجین دمو ناکافی است.' : 'Insufficient available paper balance', 'error');
      return false;
    }
    // TradingView-parity plan gate: holdings-per-account entitlement.
    if (this.app?.auth && !this.app.auth.enforce('holdingsPerAccount', this.positions.length, 'open holdings', 'پوزیشن‌های باز')) {
      return false;
    }

    this.balance -= margin;
    const diff0 = side === 'long' ? (this.currentPrice - execPrice) : (execPrice - this.currentPrice);
    this.positions.push({
      id: 'pos-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      symbol: this.currentSymbol,
      side,
      qty,
      entryPrice: execPrice,
      markPrice: this.currentPrice,
      leverage: lev,
      margin,
      unrealizedPnl: diff0 * qty,
      unrealizedPnlPct: margin ? (diff0 * qty / margin) * 100 : 0,
      openedAt: new Date().toISOString()
    });

    this.updatePositionsView();
    if (!opts.silent && window.__TRADING_APP__?.soundEngine) {
      window.__TRADING_APP__.soundEngine.playOrder?.();
    }
    return true;
  }

  executeOrder(side, type = 'market', price = null, qty = 0.1) {
    if (typeof side === 'object' && side !== null) {
      const opts = side;
      side = opts.side;
      type = opts.type || 'market';
      price = opts.price ?? null;
      qty = opts.qty || opts.quantity || 0.1;
      const want = opts.symbol ? String(opts.symbol).replace(/^.*:/, '').toUpperCase() : null;
      if (want && want !== this.currentSymbol) {
        // Never price one instrument with another's quote.
        const isFa = getLanguage() === 'fa';
        window.__TRADING_APP__?.showToast?.(isFa
          ? `برای ثبت سفارش روی ${want}، ابتدا همین نماد را روی چارت باز کنید.`
          : `Open ${want} on the chart before trading it.`, 'warning');
        return null;
      }
      return this.placeOrder({ side, type, price, qty, leverage: opts.leverage });
    }
    return this.placeOrder({ side, type, price, qty });
  }

  closePosition(posId) {
    const idx = this.positions.findIndex(p => p.id === posId);
    if (idx !== -1) {
      const p = this.positions[idx];
      this.balance += (p.margin + p.unrealizedPnl);
      const closedPos = this.positions.splice(idx, 1)[0];
      if (!this.history) this.history = [];
      this.history.unshift({
        ...closedPos,
        closedAt: new Date().toISOString(),
        finalPnl: closedPos.unrealizedPnl
      });

      // Synchronize closed paper trade into Trade Journal
      if (window.__TRADING_APP__?.tradeJournal?.sampleExecutions) {
        const now = new Date();
        // Real timestamps only — never fabricate an open time.
        const openTime = closedPos.openedAt || now.toISOString();
        const closeTime = now.toISOString();
        const accId = this.activeAccountId || 'pap_main';

        const execOpen = {
          id: `exec-open-${closedPos.id}`,
          accountId: accId,
          symbol: closedPos.symbol,
          side: closedPos.side === 'long' ? 'buy' : 'sell',
          quantity: closedPos.qty,
          price: closedPos.entryPrice,
          executedAt: openTime,
          fee: 0
        };

        const execClose = {
          id: `exec-close-${closedPos.id}`,
          accountId: accId,
          symbol: closedPos.symbol,
          side: closedPos.side === 'long' ? 'sell' : 'buy',
          quantity: closedPos.qty,
          price: closedPos.markPrice,
          executedAt: closeTime,
          fee: 0
        };

        window.__TRADING_APP__.tradeJournal.sampleExecutions.unshift(execClose, execOpen);
        window.__TRADING_APP__.tradeJournal.saveExecutions?.();
        window.__TRADING_APP__.tradeJournal.render();
        if (window.__TRADING_APP__?.fullPageJournal) {
          window.__TRADING_APP__.fullPageJournal.sampleExecutions = window.__TRADING_APP__.tradeJournal.sampleExecutions;
          window.__TRADING_APP__.fullPageJournal.render?.();
        }
      }

      this.updatePositionsView();
    }
  }

  renderOrdersView(isFa) {
    const wrap = this.container?.querySelector('#orders-table-wrap');
    const badge = this.container?.querySelector('#ord-count-badge');
    const n = (this.orders || []).length;
    if (badge) badge.textContent = isFa ? toPersianDigits(String(n)) : String(n);
    if (!wrap) return;
    if (!n) {
      wrap.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); padding: 8px 0; text-align: center;">${isFa ? 'سفارش در انتظاری ندارید.' : 'No pending orders.'}</div>`;
      return;
    }
    wrap.innerHTML = this.orders.map(o => {
      const sideTxt = isFa ? (o.side === 'long' ? 'خرید' : 'فروش') : (o.side === 'long' ? 'BUY' : 'SELL');
      const typeTxt = isFa ? (o.type === 'limit' ? 'لیمیت' : 'استاپ') : o.type.toUpperCase();
      const col = o.side === 'long' ? 'var(--accent-green)' : 'var(--accent-red)';
      return `<div class="pending-order-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; margin-bottom: 6px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; font-size: 11px;">
        <span style="font-weight: 800; color: ${col};">${sideTxt} ${typeTxt}</span>
        <span style="color: #fff; font-weight: 700;">${escapeHtmlAcc(o.symbol)}</span>
        <span class="num-ltr" style="color: var(--text-main);">${o.qty} @ $${this.fmtPx(o.price)}</span>
        <button class="btn-secondary cancel-ord-btn" data-id="${o.id}" style="padding: 2px 10px; font-size: 11px; min-height: 28px; color: var(--accent-red);" title="${isFa ? 'لغو سفارش' : 'Cancel order'}" aria-label="${isFa ? 'لغو سفارش' : 'Cancel order'}">${isFa ? 'لغو' : 'Cancel'}</button>
      </div>`;
    }).join('');
    wrap.querySelectorAll('.cancel-ord-btn').forEach(b => b.addEventListener('click', () => this.cancelOrder(b.getAttribute('data-id'))));
  }

  updatePositionsView() {
    // Persist after every balance/positions mutation so accounts survive
    // reloads and sync with the user's cloud state.
    this.persistAccount();
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';
    const wrap = this.container.querySelector('#positions-table-wrap');
    const eqEl = this.container.querySelector('#paper-equity');
    const pnlEl = this.container.querySelector('#paper-total-pnl');
    const curPriceEl = this.container.querySelector('#order-cur-price');
    const countBadge = this.container.querySelector('#pos-count-badge');

    const ticketSymEl = this.container.querySelector('#order-ticket-sym');
    if (ticketSymEl) ticketSymEl.innerText = this.currentSymbol;

    if (eqEl) eqEl.innerText = `$${this.calculateEquity().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (curPriceEl) curPriceEl.innerText = `$${this.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (countBadge) countBadge.innerText = isFa ? `${toPersianDigits(String(this.positions.length))} فعال` : `${this.positions.length} Active`;
    this.renderOrdersView(isFa);

    const totalUnrealized = this.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    if (pnlEl) {
      pnlEl.innerText = this.fmtPnl(totalUnrealized);
      pnlEl.style.color = totalUnrealized > 0.004 ? 'var(--accent-green)' : totalUnrealized < -0.004 ? 'var(--accent-red)' : 'var(--text-main)';
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
        <div class="position-card pos-card" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; transition: border-color 0.15s ease;">
          <!-- Card Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 800; font-size: 13px; color: #fff;">${p.symbol}</span>
              <span style="font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 3px; background: ${sideBg}; color: ${sideColor};">
                ${isFa ? (p.side === 'long' ? 'خرید' : 'فروش') : p.side.toUpperCase()} <span class="num-ltr">${p.leverage}x</span>
              </span>
            </div>
            <button class="btn-secondary close-pos-btn" data-id="${p.id}" style="padding: 4px 12px; font-size: 11px; min-height: 30px; color: var(--accent-red); border-color: rgba(255, 77, 91, 0.4); font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;" title="${isFa ? 'بستن پوزیشن' : 'Close position'}" aria-label="Close position">
              ${isFa ? 'بستن' : 'Close'}
            </button>
          </div>

          <!-- Position Grid Metrics (Strict LTR for numbers & Tabular figures) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; font-family: var(--font-mono); font-variant-numeric: tabular-nums;">
            <div>
              <span style="color: var(--text-dim);">${isFa ? 'حجم:' : 'Size:'}</span>
              <span class="num-ltr" style="font-weight: 700; color: var(--text-main); margin-left: 2px;">${p.qty}</span>
            </div>
            <div style="text-align: end;">
              <span style="color: var(--text-dim);">${isFa ? 'ورود:' : 'Entry:'}</span>
              <span class="num-ltr" style="font-weight: 600; color: var(--text-main); margin-left: 2px;">$${p.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span style="color: var(--text-dim);">${isFa ? 'قیمت جاری:' : 'Mark:'}</span>
              <span class="num-ltr" style="font-weight: 600; color: var(--text-main); margin-left: 2px;">$${p.markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style="text-align: end;">
              <span style="color: var(--text-dim);">${isFa ? 'سود/زیان:' : 'P&L:'}</span>
              <span class="num-ltr" style="font-weight: 800; color: ${color}; margin-left: 2px;">
                ${this.fmtPnl(p.unrealizedPnl)} (${p.unrealizedPnlPct > 0.05 ? '+' : ''}${p.unrealizedPnlPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    wrap.querySelectorAll('.close-pos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Always read the id from the button itself — `e.target` can be the
        // button's text/child, which carries no data-id and would no-op.
        const id = btn.getAttribute('data-id');
        if (!id) return;
        this.closePosition(id);
      });
    });
  }
}
