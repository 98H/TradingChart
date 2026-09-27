// client/src/watchlistManager.js
// Dynamic multi-watchlist & quote manager for TradingChart (TradingView Parity)
// Features color flags (Red, Green, Blue, Yellow, Purple), multi-column sorting, and custom list curation

import { getLanguage, toPersianDigits } from './i18n.js';
import { TechnicalRatingCard } from './technicalRatingCard.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const PRESET_WATCHLISTS = {
  crypto: {
    id: 'crypto',
    name: 'Crypto Top Assets',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'TONUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT', 'NEARUSDT']
  },
  metals: {
    id: 'metals',
    name: 'Metals & Commodities',
    symbols: ['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL', 'NATGAS']
  },
  forex: {
    id: 'forex',
    name: 'Forex Majors',
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'EURGBP', 'GBPJPY']
  },
  equities: {
    id: 'equities',
    name: 'Indices & US Tech',
    symbols: ['SPX', 'NDX', 'DJI', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'META']
  },
  iran_gold: {
    id: 'iran_gold',
    name: 'Tehran Gold & Currencies',
    symbols: ['GOLD_ABSHODEH', 'GOLD_18K', 'COIN_EMAMI', 'COIN_BAHAR', 'COIN_NIM', 'COIN_ROB', 'USD_TEHRAN', 'USDT_TOMAN', 'AED_DIRHAM']
  },
  iran_tse: {
    id: 'iran_tse',
    name: 'Iran Bourse & ETFs',
    symbols: ['FOOLAD', 'FAMELI', 'KHODRO', 'SAIPA', 'SHASTA', 'AHRAM', 'AGAS', 'TALA', 'AYAR', 'TAVAN', 'PALAYESH']
  }
};

export class WatchlistManager {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.onSelectSymbol = options.onSelectSymbol || (() => {});
    this.currentCategory = 'crypto';
    this.currentFlagFilter = 'all'; // 'all', 'red', 'green', 'blue', 'yellow', 'purple'
    this.sortField = null; // 'symbol', 'price', 'chg'
    this.sortAsc = true;
    this.tickers = new Map();
    this.customSymbols = JSON.parse(localStorage.getItem('tradingchart_custom_watchlist') || '["BTCUSDT", "ETHUSDT", "SOLUSDT", "XAUUSD"]');
    this.flags = JSON.parse(localStorage.getItem('tradingchart_watchlist_flags') || '{}'); // { "BTCUSDT": "red" }
    this.loadUserLists();

    this.render();
    this.fetchTickers();
    this.pollInterval = setInterval(() => this.fetchTickers(), 3000);
  }

  // ── Multi-watchlist layer (TradingView parity) ─────────────────────────
  /** External state (cloud sync) replaced localStorage — refresh in-memory view. */
  reloadFromStorage() {
    try {
      this.customSymbols = JSON.parse(localStorage.getItem('tradingchart_custom_watchlist') || '[]');
      this.flags = JSON.parse(localStorage.getItem('tradingchart_watchlist_flags') || '{}');
      this.loadUserLists();
      this.render?.();
    } catch (e) { /* keep current */ }
  }

  loadUserLists() {
    try {
      const raw = JSON.parse(localStorage.getItem('tradingchart_user_watchlists') || 'null');
      const deleted = JSON.parse(localStorage.getItem('tradingchart_watchlist_deleted') || '{}');
      if (raw && Array.isArray(raw.lists) && raw.lists.length > 0) {
        this.userLists = raw.lists.filter(l => l && l.id && !deleted[l.id]);
        if (this.userLists.length === 0) throw new Error('empty after deleted filter');
        this.activeListId = (raw.activeId && !deleted[raw.activeId]) ? raw.activeId : this.userLists[0].id;
      } else {
        // Migrate the legacy single custom list into a named "Main" list.
        this.userLists = [{
          id: 'wl_main',
          name: getLanguage() === 'fa' ? 'اصلی' : 'Main',
          symbols: [...this.customSymbols]
        }];
        this.activeListId = 'wl_main';
      }
    } catch (e) {
      this.userLists = [{ id: 'wl_main', name: 'Main', symbols: [...this.customSymbols] }];
      this.activeListId = 'wl_main';
    }
  }

  saveUserLists() {
    try {
      // Union-merge with storage first, respecting deletion tombstones so a
      // deleted watchlist is never resurrected on local save.
      const stored = JSON.parse(localStorage.getItem('tradingchart_user_watchlists') || 'null');
      const deleted = JSON.parse(localStorage.getItem('tradingchart_watchlist_deleted') || '{}');
      if (stored && Array.isArray(stored.lists)) {
        const byId = new Map((this.userLists || []).filter(l => l && l.id && !deleted[l.id]).map(l => [l.id, l]));
        for (const ext of stored.lists) {
          if (!ext || !ext.id || deleted[ext.id]) continue;
          if (!byId.has(ext.id)) { byId.set(ext.id, ext); continue; }
          // same list: union symbols (additive — removals flow via removeSymbol)
          const cur = byId.get(ext.id);
          const symSet = new Set([...(ext.symbols || []), ...(cur.symbols || [])]);
          cur.symbols = [...symSet];
        }
        this.userLists = [...byId.values()];
      }
      // keep the active list in sync with the live customSymbols mirror
      const active = this.userLists.find(l => l.id === this.activeListId);
      if (active) active.symbols = [...this.customSymbols];
      localStorage.setItem('tradingchart_user_watchlists', JSON.stringify({ activeId: this.activeListId, lists: this.userLists }));
    } catch (e) { /* quota */ }
  }

  activeList() { return this.userLists.find(l => l.id === this.activeListId) || this.userLists[0]; }

  /** True when the selected category is one of the user's named lists. */
  isCustomCategory() {
    return this.currentCategory === 'custom' || this.currentCategory === `list:${this.activeListId}` || this.currentCategory.startsWith('list:');
  }

  switchList(listId) {
    const target = this.userLists.find(l => l.id === listId);
    if (!target) return;
    this.saveUserLists(); // persist current symbols into its list first
    this.activeListId = listId;
    this.customSymbols = [...(target.symbols || [])];
    localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(this.customSymbols));
    this.currentCategory = 'custom';
    this.fetchTickers();
    this.render();
  }

  createList(name) {
    if (this.app?.auth && !this.app.auth.enforce('watchlists', this.userLists.length, 'watchlists', 'واچ‌لیست‌ها')) return null;
    const isFa = getLanguage() === 'fa';
    const list = {
      id: 'wl_' + Date.now().toString(36),
      name: (name || (isFa ? 'واچ‌لیست جدید' : 'New Watchlist')).slice(0, 40),
      symbols: []
    };
    this.userLists.push(list);
    this.saveUserLists();
    this.switchList(list.id);
    return list;
  }

  renameList(listId, name) {
    const list = this.userLists.find(l => l.id === listId);
    if (list && name) { list.name = String(name).slice(0, 40); this.saveUserLists(); this.render(); }
  }

  deleteList(listId) {
    if (this.userLists.length <= 1) return false;
    const idx = this.userLists.findIndex(l => l.id === listId);
    if (idx < 0) return false;
    const wasActive = listId === this.activeListId;
    this.userLists.splice(idx, 1);
    try {
      const ts = JSON.parse(localStorage.getItem('tradingchart_watchlist_deleted') || '{}');
      ts[listId] = Date.now();
      localStorage.setItem('tradingchart_watchlist_deleted', JSON.stringify(ts));
    } catch (e) {}
    if (wasActive) {
      this.activeListId = this.userLists[0].id;
      this.customSymbols = [...(this.userLists[0].symbols || [])];
      localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(this.customSymbols));
      this.fetchTickers();
    }
    this.saveUserLists();
    this.render();
    return true;
  }

  /** Bespoke glassmorphism manager for the active named list (rename/delete). */
  openListManager() {
    const isFa = getLanguage() === 'fa';
    const list = this.activeList();
    if (!list) return;
    document.querySelector('#wl-list-manager')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'wl-list-manager';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(5px); z-index:99999; display:flex; align-items:center; justify-content:center;';
    overlay.innerHTML = `
      <div style="max-width:340px; width:90vw; background:var(--bg-card,#151c2d); border:1px solid var(--border-subtle); border-radius:12px; overflow:hidden; ${isFa ? 'direction:rtl;' : ''}">
        <div style="padding:12px 16px; background:var(--bg-surface,#0c1017); border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:13px; color:#fff;">${isFa ? 'مدیریت واچ‌لیست' : 'Manage Watchlist'}</strong>
          <button data-close style="background:none; border:none; color:var(--text-dim); cursor:pointer;">✕</button>
        </div>
        <div style="padding:16px; display:flex; flex-direction:column; gap:10px;">
          <label style="display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--text-dim);">
            <span>${isFa ? 'نام واچ‌لیست' : 'Watchlist name'}</span>
            <input id="wl-rename-input" value="${escapeHtml(list.name)}" maxlength="40" style="padding:8px 10px; background:var(--bg-surface,#0c1017); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:12px;" />
          </label>
          <div style="font-size:10px; color:var(--text-dim);">${isFa ? `${toPersianDigits(String((list.symbols || []).length))} نماد در این لیست` : `${(list.symbols || []).length} symbols in this list`}</div>
          <div style="display:flex; gap:8px;">
            <button id="wl-rename-save" style="flex:1; padding:8px; border-radius:7px; border:1px solid var(--accent-cyan,#00F2B0); background:var(--accent-cyan,#00F2B0); color:#04121e; font-weight:800; font-size:12px; cursor:pointer;">${isFa ? 'ذخیره نام' : 'Rename'}</button>
            <button id="wl-delete-list" ${this.userLists.length <= 1 ? 'disabled style="flex:1; padding:8px; border-radius:7px; border:1px solid var(--border-subtle); background:transparent; color:var(--text-dim); font-weight:700; font-size:12px; opacity:0.5;"' : 'style="flex:1; padding:8px; border-radius:7px; border:1px solid #f87171; background:rgba(248,113,113,0.08); color:#f87171; font-weight:700; font-size:12px; cursor:pointer;"'}>${isFa ? 'حذف لیست' : 'Delete'}</button>
          </div>
          <div style="font-size:10px; color:var(--text-dim); line-height:1.5;">${this.userLists.length <= 1 ? (isFa ? 'حداقل یک واچ‌لیست باید باقی بماند. لیست‌های بیشتر با ارتقای پلن فعال می‌شوند.' : 'At least one watchlist must remain. More lists unlock with plan upgrades.') : (isFa ? 'حذف لیست، نمادهای آن را هم حذف می‌کند.' : 'Deleting a list also removes its symbols.')}</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-close]').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#wl-rename-save').onclick = () => {
      this.renameList(list.id, overlay.querySelector('#wl-rename-input').value.trim());
      close();
    };
    overlay.querySelector('#wl-delete-list').onclick = () => {
      if (this.userLists.length <= 1) return;
      this.deleteList(list.id);
      close();
    };
  }

  destroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  getActiveList() {
    let list = this.isCustomCategory()
      ? [...this.customSymbols]
      : [...(PRESET_WATCHLISTS[this.currentCategory]?.symbols || PRESET_WATCHLISTS.crypto.symbols)];

    // Filter by flag
    if (this.currentFlagFilter !== 'all') {
      list = list.filter(sym => this.flags[sym] === this.currentFlagFilter);
    }

    // Sort
    if (this.sortField) {
      list.sort((a, b) => {
        if (this.sortField === 'symbol') {
          return this.sortAsc ? a.localeCompare(b) : b.localeCompare(a);
        }
        const tA = this.tickers.get(a);
        const tB = this.tickers.get(b);
        const pA = tA ? (this.sortField === 'price' ? tA.lastPrice : tA.priceChangePercent) : 0;
        const pB = tB ? (this.sortField === 'price' ? tB.lastPrice : tB.priceChangePercent) : 0;
        return this.sortAsc ? pA - pB : pB - pA;
      });
    }

    return list;
  }

  async fetchTickers() {
    const list = this.isCustomCategory() ? this.customSymbols : PRESET_WATCHLISTS[this.currentCategory]?.symbols;
    if (!list || list.length === 0) return;
    try {
      const res = await fetch(`/api/tickers?symbols=${list.join(',')}`);
      if (res.ok) {
        const data = await res.json();
        for (const t of data) {
          this.tickers.set(t.symbol, t);
        }
        this.updateListUI();
      }
    } catch (e) {
      // ignore
    }
  }

  addSymbol(symbol) {
    if (!symbol) return;
    const clean = symbol.replace(/^.*:/, '').toUpperCase();
    if (!this.customSymbols.includes(clean)) {
      this.customSymbols.push(clean);
      localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(this.customSymbols));
      this.currentCategory = 'custom';
      const select = this.container?.querySelector('#wl-category-select');
      if (select) select.value = 'custom';
      this.fetchTickers();
      this.updateListUI();
    }
  }

  removeSymbol(symbol) {
    if (!symbol) return;
    const clean = symbol.replace(/^.*:/, '').toUpperCase();
    const idx = this.customSymbols.indexOf(clean);
    if (idx !== -1) {
      this.customSymbols.splice(idx, 1);
      localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(this.customSymbols));
    }
    // Also remove from preset if user specifically requested remove
    delete this.flags[clean];
    localStorage.setItem('tradingchart_watchlist_flags', JSON.stringify(this.flags));
    this.updateListUI();
  }

  setFlag(symbol, color) {
    if (color === 'none') {
      delete this.flags[symbol];
    } else {
      this.flags[symbol] = color;
    }
    localStorage.setItem('tradingchart_watchlist_flags', JSON.stringify(this.flags));
    this.updateListUI();
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow: hidden; font-family: var(--font-sans);">
        <!-- Header & Category Select -->
        <div style="padding: 10px 12px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
            <select id="wl-category-select" style="flex: 1; font-size: 11px; font-weight: 700; padding: 4px 6px; background: var(--bg-card); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px;">
              <option value="crypto">${isFa ? 'ارزهای دیجیتال برتر' : 'Crypto Top Assets'}</option>
              <option value="metals">${isFa ? 'فلزات و کالاها' : 'Metals & Commodities'}</option>
              <option value="forex">${isFa ? 'جفت‌ارزهای ماژور' : 'Forex Majors'}</option>
              <option value="equities">${isFa ? 'شاخص‌ها و سهام فناوری' : 'Indices & US Tech'}</option>
              <option value="iran_gold">${isFa ? 'طلای تهران و ارزها' : 'Tehran Gold & FX'}</option>
              <option value="iran_tse">${isFa ? 'بورس و فرابورس ایران' : 'Iran Bourse & ETFs'}</option>
              ${this.userLists.map(l => `<option value="list:${l.id}" ${this.currentCategory === 'list:' + l.id ? 'selected' : ''}>★ ${escapeHtml(l.name)}</option>`).join('')}
            </select>
            <button id="wl-new-list-btn" title="${isFa ? 'واچ‌لیست جدید' : 'New watchlist'}" style="width:24px; height:24px; border-radius:4px; background:var(--bg-card); border:1px solid var(--border-subtle); color:var(--accent-cyan); font-weight:800; cursor:pointer; flex-shrink:0;">+</button>
            <button id="wl-list-menu-btn" title="${isFa ? 'مدیریت واچ‌لیست' : 'Manage watchlist'}" style="width:24px; height:24px; border-radius:4px; background:var(--bg-card); border:1px solid var(--border-subtle); color:var(--text-dim); cursor:pointer; flex-shrink:0; font-size:11px;">✎</button>
          </div>

          <!-- Color Flag Filter Pills -->
          <div style="display: flex; align-items: center; gap: 4px; padding: 2px 0;">
            <span style="font-size: 10px; color: var(--text-dim); margin-right: 2px;">${isFa ? 'برچسب:' : 'Flag:'}</span>
            <button class="wl-flag-filter-btn active" data-flag="all" style="padding: 2px 8px; font-size: 11px; min-height: 24px; border-radius: 4px; background: var(--bg-card); border: 1px solid var(--border-subtle); color: #fff; cursor: pointer;">${isFa ? 'همه' : 'All'}</button>
            <button class="wl-flag-filter-btn" data-flag="red" style="padding: 2px 6px; font-size: 11px; min-height: 24px; border-radius: 4px; background: rgba(246,70,93,0.2); border: 1px solid #f6465d; cursor: pointer;" title="Red Flag" aria-label="Red Flag">🔴</button>
            <button class="wl-flag-filter-btn" data-flag="green" style="padding: 2px 6px; font-size: 11px; min-height: 24px; border-radius: 4px; background: rgba(14,203,129,0.2); border: 1px solid #0ecb81; cursor: pointer;" title="Green Flag" aria-label="Green Flag">🟢</button>
            <button class="wl-flag-filter-btn" data-flag="blue" style="padding: 2px 6px; font-size: 11px; min-height: 24px; border-radius: 4px; background: rgba(56,189,248,0.2); border: 1px solid #38bdf8; cursor: pointer;" title="Blue Flag" aria-label="Blue Flag">🔵</button>
            <button class="wl-flag-filter-btn" data-flag="yellow" style="padding: 2px 6px; font-size: 11px; min-height: 24px; border-radius: 4px; background: rgba(250,204,21,0.2); border: 1px solid #facc15; cursor: pointer;" title="Yellow Flag" aria-label="Yellow Flag">🟡</button>
            <button class="wl-flag-filter-btn" data-flag="purple" style="padding: 2px 6px; font-size: 11px; min-height: 24px; border-radius: 4px; background: rgba(192,132,252,0.2); border: 1px solid #c084fc; cursor: pointer;" title="Purple Flag" aria-label="Purple Flag">🟣</button>
          </div>

          <!-- Quick Add Symbol -->
          <div style="display: flex; gap: 4px;">
            <input type="text" id="wl-add-input" placeholder="${isFa ? '+ افزودن نماد...' : '+ Add symbol...'}" style="flex: 1; padding: 4px 8px; font-size: 11px; text-transform: uppercase; background: var(--bg-card); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px;" />
            <button id="wl-add-btn" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">${isFa ? 'افزودن' : 'Add'}</button>
          </div>
        </div>

        <!-- Sort Columns Header -->
        <div style="display: grid; grid-template-columns: 24px 1fr 1fr 1fr 20px; padding: 4px 12px; font-size: 10px; font-weight: 700; color: var(--text-dim); background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); align-items: center;">
          <div></div>
          <div class="wl-sort-head" data-field="symbol" style="cursor: pointer; display: flex; align-items: center; gap: 2px;">
            ${isFa ? 'نماد' : 'Symbol'} ⇅
          </div>
          <div class="wl-sort-head" data-field="price" style="text-align: right; cursor: pointer;">
            ${isFa ? 'قیمت' : 'Last'} ⇅
          </div>
          <div class="wl-sort-head" data-field="chg" style="text-align: right; cursor: pointer;">
            ${isFa ? 'تغییر' : 'Chg%'} ⇅
          </div>
          <div></div>
        </div>

        <!-- Watchlist Table -->
        <div id="wl-items-list" style="flex: 1; min-height: 160px; overflow-y: auto; padding: 2px 0;"></div>

        <!-- Symbol Details & Technical Rating Gauge Card -->
        <div id="wl-technical-rating-container" style="flex-shrink: 0; max-height: 52%; overflow-y: auto; border-top: 1px solid var(--border-subtle);"></div>
      </div>
    `;

    // Initialize Technical Rating Card
    const trcContainer = this.container.querySelector('#wl-technical-rating-container');
    if (trcContainer) {
      this.technicalRatingCard = new TechnicalRatingCard({
        container: trcContainer,
        symbol: this.activeSymbol || 'BTCUSDT'
      });
    }

    const select = this.container.querySelector('#wl-category-select');
    const input = this.container.querySelector('#wl-add-input');
    const btnAdd = this.container.querySelector('#wl-add-btn');

    select.addEventListener('change', (e) => {
      const v = e.target.value;
      if (v.startsWith('list:')) {
        this.switchList(v.slice(5));
      } else {
        this.currentCategory = v;
        this.fetchTickers();
        this.updateListUI();
      }
    });

    // New watchlist button — prompt via the bespoke dialog (no native prompt()).
    this.container.querySelector('#wl-new-list-btn')?.addEventListener('click', () => {
      import('./uiDialog.js').then(({ showPromptDialog }) => {
        const isFa = getLanguage() === 'fa';
        showPromptDialog({
          title: isFa ? 'واچ‌لیست جدید' : 'New Watchlist',
          placeholder: isFa ? 'نام واچ‌لیست' : 'Watchlist name',
          confirmText: isFa ? 'ایجاد' : 'Create',
          onConfirm: (name) => { if (name) this.createList(name); }
        });
      });
    });

    // Manage watchlist button — rename / delete the active named list.
    this.container.querySelector('#wl-list-menu-btn')?.addEventListener('click', () => {
      this.openListManager();
    });

    const handleAdd = () => {
      const sym = input.value.trim().toUpperCase();
      if (!sym) return;
      // TradingView-parity plan gates: symbols-per-watchlist + watchlist count.
      if (this.app?.auth && !this.app.auth.enforce('watchlistSymbols', this.customSymbols.length, 'symbols per watchlist', 'نماد در واچ‌لیست')) {
        return;
      }
      if (!this.customSymbols.includes(sym)) {
        this.customSymbols.push(sym);
        localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(this.customSymbols));
        this.currentCategory = 'list:' + this.activeListId;
        select.value = this.currentCategory;
        input.value = '';
        this.fetchTickers();
        this.updateListUI();
      }
    };

    btnAdd.addEventListener('click', handleAdd);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAdd(); });

    // Flag filter buttons
    this.container.querySelectorAll('.wl-flag-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.wl-flag-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFlagFilter = btn.getAttribute('data-flag');
        this.updateListUI();
      });
    });

    // Sort headers
    this.container.querySelectorAll('.wl-sort-head').forEach(head => {
      head.addEventListener('click', () => {
        const field = head.getAttribute('data-field');
        if (this.sortField === field) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortField = field;
          this.sortAsc = true;
        }
        this.updateListUI();
      });
    });

    this.updateListUI();
  }

  updateListUI() {
    const listEl = this.container?.querySelector('#wl-items-list');
    if (!listEl) return;
    const symbols = this.getActiveList();
    const isFa = getLanguage() === 'fa';

    if (symbols.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 11px;">
          ${isFa ? 'هیچ نمادی در این بخش یا فیلتر یافت نشد.' : 'No instruments matched filter.'}
        </div>
      `;
      return;
    }

    const flagIcons = {
      red: '🔴',
      green: '🟢',
      blue: '🔵',
      yellow: '🟡',
      purple: '🟣'
    };

    listEl.innerHTML = symbols.map(sym => {
      const t = this.tickers.get(sym) || {
        lastPrice: 0,
        priceChange: 0,
        priceChangePercent: 0
      };

      const isPos = t.priceChangePercent >= 0;
      const color = isPos ? 'var(--accent-green)' : 'var(--accent-red)';
      const bg = isPos ? 'rgba(14, 203, 129, 0.1)' : 'rgba(246, 70, 93, 0.1)';
      const currentFlag = this.flags[sym] || 'none';
      const flagDisplay = flagIcons[currentFlag] || '⚐';

      return `
        <div class="wl-item" data-symbol="${sym}" style="display: grid; grid-template-columns: 24px 1fr 1fr 1fr 20px; padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); align-items: center; cursor: pointer; transition: background 0.15s;">
          <!-- Flag Toggle Button -->
          <button class="btn-toggle-flag" data-symbol="${sym}" title="${isFa ? 'تغییر برچسب رنگی' : 'Change Flag Tag'}" aria-label="Change flag for ${sym}" style="background: transparent; border: none; font-size: 12px; cursor: pointer; padding: 2px 4px; min-width: 22px; min-height: 22px; display: inline-flex; align-items: center; justify-content: center; color: ${currentFlag !== 'none' ? 'inherit' : 'var(--text-dim)'}; opacity: ${currentFlag !== 'none' ? '1' : '0.5'};">
            ${flagDisplay}
          </button>

          <!-- Symbol Name -->
          <div>
            <span style="font-weight: 800; font-family: var(--font-mono); font-size: 11px; color: #fff;">${sym}</span>
          </div>

          <!-- Last Price -->
          <div style="text-align: right; font-family: var(--font-mono); font-weight: 700; color: #fff; font-size: 11px;" class="num-ltr">
            $${Number(t.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </div>

          <!-- Change Percent -->
          <div style="text-align: right; font-family: var(--font-mono); font-weight: 700; font-size: 10px;" class="num-ltr">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; background: ${bg}; color: ${color};">
              ${isPos ? '+' : ''}${t.priceChangePercent.toFixed(2)}%
            </span>
          </div>

          <!-- Remove Button -->
          <button class="btn-remove-wl" data-symbol="${sym}" title="${isFa ? 'حذف نماد از دیده‌بان' : 'Remove symbol'}" aria-label="Remove ${sym} from watchlist" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 2px 4px; min-width: 22px; min-height: 22px; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.5; transition: opacity 0.15s;">
            ✕
          </button>
        </div>
      `;
    }).join('');

    // Row selection listener
    listEl.querySelectorAll('.wl-item').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-toggle-flag') || e.target.closest('.btn-remove-wl')) return;
        const sym = row.getAttribute('data-symbol');
        if (sym) {
          this.activeSymbol = sym;
          this.technicalRatingCard?.setSymbol(sym);
          this.onSelectSymbol(sym);
        }
      });
      row.addEventListener('mouseenter', () => {
        const rm = row.querySelector('.btn-remove-wl');
        if (rm) rm.style.opacity = '1';
      });
      row.addEventListener('mouseleave', () => {
        const rm = row.querySelector('.btn-remove-wl');
        if (rm) rm.style.opacity = '0.4';
      });
    });

    // Remove symbol listener
    listEl.querySelectorAll('.btn-remove-wl').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sym = btn.getAttribute('data-symbol');
        this.removeSymbol(sym);
      });
    });

    // Flag toggle cycling: none -> red -> green -> blue -> yellow -> purple -> none
    // TradingView parity: Basic plan unlocks exactly ONE flag color; further
    // colors require a paid tier (7 colors from Essential upward).
    const flagCycle = ['none', 'red', 'green', 'blue', 'yellow', 'purple'];
    const allowedColors = this.app?.auth ? (this.app.auth.check('flagColors', 0).limit === -1 ? 7 : this.app.auth.check('flagColors', 0).limit) : 7;
    listEl.querySelectorAll('.btn-toggle-flag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sym = btn.getAttribute('data-symbol');
        const curr = this.flags[sym] || 'none';
        const usable = flagCycle.slice(0, Math.max(2, Math.min(flagCycle.length, allowedColors + 1))); // +1 for 'none'
        const nextIdx = (usable.indexOf(curr) + 1) % usable.length;
        const nextColor = usable[nextIdx];
        if (nextColor !== 'none' && flagCycle.indexOf(nextColor) > allowedColors) {
          this.app?.auth?.enforce('flagColors', 0, 'flag colors', 'رنگ برچسب‌ها');
          this.app?.auth?.openPlansModal?.();
          return;
        }
        this.setFlag(sym, nextColor);
      });
    });
  }

  setSymbol(sym) {
    if (!sym) return;
    this.activeSymbol = sym;
    this.technicalRatingCard?.setSymbol(sym);
  }
}
