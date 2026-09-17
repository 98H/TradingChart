// client/src/watchlistManager.js
// Dynamic multi-watchlist & quote manager for TradingChart

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
    this.tickers = new Map();
    this.customSymbols = JSON.parse(localStorage.getItem('tradingchart_custom_watchlist') || '["BTCUSDT", "ETHUSDT", "XAUUSD"]');
    this.render();
    this.fetchTickers();
    this.pollInterval = setInterval(() => this.fetchTickers(), 3000);
  }

  destroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  getActiveList() {
    if (this.currentCategory === 'custom') {
      return this.customSymbols;
    }
    return PRESET_WATCHLISTS[this.currentCategory]?.symbols || PRESET_WATCHLISTS.crypto.symbols;
  }

  async fetchTickers() {
    const list = this.getActiveList();
    if (list.length === 0) return;
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

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow: hidden;">
        <!-- Header & Category Select -->
        <div style="padding: 10px 12px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <select id="wl-category-select" style="flex: 1; font-size: 12px; font-weight: 700; padding: 4px 6px;">
              <option value="crypto">Crypto Top Assets</option>
              <option value="metals">Metals & Commodities</option>
              <option value="forex">Forex Majors</option>
              <option value="equities">Indices & US Tech</option>
              <option value="custom">★ Custom Watchlist</option>
            </select>
          </div>

          <!-- Quick Add Symbol -->
          <div style="display: flex; gap: 4px;">
            <input type="text" id="wl-add-input" placeholder="+ Add symbol..." style="flex: 1; padding: 4px 8px; font-size: 11px; text-transform: uppercase;" />
            <button id="wl-add-btn" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">Add</button>
          </div>
        </div>

        <!-- Watchlist Table -->
        <div id="wl-items-list" style="flex: 1; overflow-y: auto; padding: 4px 0;">
          <!-- Populated by updateListUI -->
        </div>
      </div>
    `;

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

    this.updateListUI();
  }

  updateListUI() {
    const listEl = this.container.querySelector('#wl-items-list');
    if (!listEl) return;
    const symbols = this.getActiveList();

    if (symbols.length === 0) {
      listEl.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 11px;">Watchlist is empty. Add symbols above.</div>`;
      return;
    }

    listEl.innerHTML = symbols.map(sym => {
      const t = this.tickers.get(sym) || {
        lastPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        highPrice: 0,
        lowPrice: 0
      };

      const isPos = t.priceChangePercent >= 0;
      const color = isPos ? 'var(--accent-green)' : 'var(--accent-red)';
      const bg = isPos ? 'rgba(14, 203, 129, 0.12)' : 'rgba(246, 70, 93, 0.12)';

      return `
        <div class="wl-row" data-symbol="${sym}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: background 0.12s;">
          <div>
            <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${sym}</div>
            <div style="font-size: 10px; color: var(--text-dim);">Vol: ${t.volume ? (t.volume > 1000000 ? (t.volume/1000000).toFixed(1)+'M' : (t.volume/1000).toFixed(0)+'K') : '—'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; font-size: 13px; color: #fff;" class="num-ltr">$${t.lastPrice ? (t.lastPrice < 1 ? t.lastPrice.toFixed(4) : t.lastPrice.toFixed(2)) : '...'}</div>
            <div style="font-size: 10px; font-weight: 700; color: ${color}; background: ${bg}; padding: 1px 6px; border-radius: 3px; display: inline-block;" class="num-ltr">
              ${isPos ? '+' : ''}${t.priceChangePercent ? t.priceChangePercent.toFixed(2) : '0.00'}%
            </div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.wl-row').forEach(row => {
      row.addEventListener('click', () => {
        const sym = row.getAttribute('data-symbol');
        this.onSelectSymbol(sym);
      });
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-card-hover)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
    });
  }
}
