// client/src/watchlistManager.js
// Dynamic multi-watchlist & quote manager for TradingChart (TradingView Parity)
// Features color flags (Red, Green, Blue, Yellow, Purple), multi-column sorting, and custom list curation

import { getLanguage } from './i18n.js';
import { TechnicalRatingCard } from './technicalRatingCard.js';

export const PRESET_WATCHLISTS = {
  crypto: {
    id: 'crypto',
    name: 'Crypto Top Assets',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT', 'NEARUSDT']
  },
  metals: {
    id: 'metals',
    name: 'Metals & Commodities',
    symbols: ['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL', 'NATGAS']
  },
  forex: {
    id: 'forex',
    name: 'Forex Majors',
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF']
  },
  equities: {
    id: 'equities',
    name: 'Indices & US Tech',
    symbols: ['SPX', 'NDX', 'DJI', 'AAPL', 'NVDA', 'TSLA', 'MSFT']
  }
};

export class WatchlistManager {
  constructor(options = {}) {
    this.container = options.container;
    this.onSelectSymbol = options.onSelectSymbol || (() => {});
    this.currentCategory = 'crypto';
    this.currentFlagFilter = 'all'; // 'all', 'red', 'green', 'blue', 'yellow', 'purple'
    this.sortField = null; // 'symbol', 'price', 'chg'
    this.sortAsc = true;
    this.tickers = new Map();
    this.customSymbols = JSON.parse(localStorage.getItem('tradingchart_custom_watchlist') || '["BTCUSDT", "ETHUSDT", "SOLUSDT", "XAUUSD"]');
    this.flags = JSON.parse(localStorage.getItem('tradingchart_watchlist_flags') || '{}'); // { "BTCUSDT": "red" }

    this.render();
    this.fetchTickers();
    this.pollInterval = setInterval(() => this.fetchTickers(), 3000);
  }

  destroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  getActiveList() {
    let list = this.currentCategory === 'custom'
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
    const list = this.currentCategory === 'custom' ? this.customSymbols : PRESET_WATCHLISTS[this.currentCategory]?.symbols;
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
              <option value="custom">${isFa ? '★ دیده‌بان سفارشی' : '★ Custom Watchlist'}</option>
            </select>
          </div>

          <!-- Color Flag Filter Pills -->
          <div style="display: flex; align-items: center; gap: 4px; padding: 2px 0;">
            <span style="font-size: 10px; color: var(--text-dim); margin-right: 2px;">${isFa ? 'برچسب:' : 'Flag:'}</span>
            <button class="wl-flag-filter-btn active" data-flag="all" style="padding: 1px 6px; font-size: 10px; border-radius: 3px; background: var(--bg-card); border: 1px solid var(--border-subtle); color: #fff; cursor: pointer;">All</button>
            <button class="wl-flag-filter-btn" data-flag="red" style="padding: 1px 5px; font-size: 10px; border-radius: 3px; background: rgba(246,70,93,0.2); border: 1px solid #f6465d; cursor: pointer;" title="Red Flag">🔴</button>
            <button class="wl-flag-filter-btn" data-flag="green" style="padding: 1px 5px; font-size: 10px; border-radius: 3px; background: rgba(14,203,129,0.2); border: 1px solid #0ecb81; cursor: pointer;" title="Green Flag">🟢</button>
            <button class="wl-flag-filter-btn" data-flag="blue" style="padding: 1px 5px; font-size: 10px; border-radius: 3px; background: rgba(56,189,248,0.2); border: 1px solid #38bdf8; cursor: pointer;" title="Blue Flag">🔵</button>
            <button class="wl-flag-filter-btn" data-flag="yellow" style="padding: 1px 5px; font-size: 10px; border-radius: 3px; background: rgba(250,204,21,0.2); border: 1px solid #facc15; cursor: pointer;" title="Yellow Flag">🟡</button>
            <button class="wl-flag-filter-btn" data-flag="purple" style="padding: 1px 5px; font-size: 10px; border-radius: 3px; background: rgba(192,132,252,0.2); border: 1px solid #c084fc; cursor: pointer;" title="Purple Flag">🟣</button>
          </div>

          <!-- Quick Add Symbol -->
          <div style="display: flex; gap: 4px;">
            <input type="text" id="wl-add-input" placeholder="${isFa ? '+ افزودن نماد...' : '+ Add symbol...'}" style="flex: 1; padding: 4px 8px; font-size: 11px; text-transform: uppercase; background: var(--bg-card); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px;" />
            <button id="wl-add-btn" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">Add</button>
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
      this.currentCategory = e.target.value;
      this.fetchTickers();
      this.updateListUI();
    });

    const handleAdd = () => {
      const sym = input.value.trim().toUpperCase();
      if (!sym) return;
      if (!this.customSymbols.includes(sym)) {
        this.customSymbols.push(sym);
        localStorage.setItem('tradingchart_custom_watchlist', JSON.stringify(this.customSymbols));
        this.currentCategory = 'custom';
        select.value = 'custom';
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
          <button class="btn-toggle-flag" data-symbol="${sym}" title="Change Flag Tag" style="background: transparent; border: none; font-size: 11px; cursor: pointer; padding: 0; color: ${currentFlag !== 'none' ? 'inherit' : 'var(--text-dim)'}; opacity: ${currentFlag !== 'none' ? '1' : '0.4'};">
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
          <button class="btn-remove-wl" data-symbol="${sym}" title="${isFa ? 'حذف نماد از دیده‌بان' : 'Remove symbol'}" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0; font-size: 11px; display: flex; align-items: center; justify-content: center; opacity: 0.4; transition: opacity 0.15s;">
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
    const flagCycle = ['none', 'red', 'green', 'blue', 'yellow', 'purple'];
    listEl.querySelectorAll('.btn-toggle-flag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sym = btn.getAttribute('data-symbol');
        const curr = this.flags[sym] || 'none';
        const nextIdx = (flagCycle.indexOf(curr) + 1) % flagCycle.length;
        this.setFlag(sym, flagCycle[nextIdx]);
      });
    });
  }

  setSymbol(sym) {
    if (!sym) return;
    this.activeSymbol = sym;
    this.technicalRatingCard?.setSymbol(sym);
  }
}
