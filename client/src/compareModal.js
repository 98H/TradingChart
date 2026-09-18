// client/src/compareModal.js
// TradingView-Grade Multi-Symbol Compare & Overlay Engine
// Allows side-by-side comparative analysis (% Scale, Price Overlay, Benchmarks)

import { getLanguage, t, toPersianDigits } from './i18n.js';

export const POPULAR_BENCHMARKS = [
  { symbol: 'ETHUSDT', name: 'Ethereum', category: 'crypto', color: '#f59e0b', defaultChecked: false },
  { symbol: 'SOLUSDT', name: 'Solana', category: 'crypto', color: '#00F2B0', defaultChecked: false },
  { symbol: 'BNBUSDT', name: 'BNB', category: 'crypto', color: '#eab308', defaultChecked: false },
  { symbol: 'XAUUSD', name: 'Gold Spot', category: 'metals', color: '#fbbf24', defaultChecked: false },
  { symbol: 'DXY', name: 'US Dollar Index', category: 'indices', color: '#60a5fa', defaultChecked: false },
  { symbol: 'SPX500', name: 'S&P 500', category: 'indices', color: '#38bdf8', defaultChecked: false },
  { symbol: 'NDX100', name: 'Nasdaq 100', category: 'indices', color: '#a78bfa', defaultChecked: false },
  { symbol: 'USOIL', name: 'WTI Crude Oil', category: 'commodities', color: '#f87171', defaultChecked: false },
  { symbol: 'EURUSD', name: 'Euro / USD', category: 'forex', color: '#34d399', defaultChecked: false }
];

export class CompareModal {
  constructor(app) {
    this.app = app;
    this.modalEl = null;
    this.overlays = new Map(); // symbol -> { symbol, name, color, mode, handleId, visible, lastPrice, changePct }
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.compareMode = 'percent'; // 'percent' or 'price'
    this.createModal();
    this.createFloatingLegend();
  }

  createModal() {
    let el = document.querySelector('#modal-compare');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-compare';
      el.className = 'modal-overlay';
      document.body.appendChild(el);
    }
    this.modalEl = el;
    this.render();
  }

  createFloatingLegend() {
    let container = document.querySelector('#compare-legend-badges');
    if (!container) {
      container = document.createElement('div');
      container.id = 'compare-legend-badges';
      container.className = 'compare-floating-legend';
      const chartArea = document.querySelector('#chart-area');
      if (chartArea) {
        chartArea.appendChild(container);
      }
    }
    this.legendEl = container;
  }

  open() {
    if (this.modalEl) {
      this.render();
      this.modalEl.classList.add('open');
      const input = this.modalEl.querySelector('#compare-search-input');
      if (input) {
        setTimeout(() => input.focus(), 50);
      }
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }

  render() {
    const isFa = getLanguage() === 'fa';
    const activeSymbol = this.app?.currentSymbol || 'BTCUSDT';

    let filtered = POPULAR_BENCHMARKS.filter(b => b.symbol !== activeSymbol);
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(b => b.category === this.selectedCategory);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(b => b.symbol.toLowerCase().includes(q) || b.name.toLowerCase().includes(q));
    }

    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 580px; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <span id="compare-modal-title">${isFa ? 'مقایسه و افزودن نماد (Compare / Add Symbol)' : 'Compare or Add Symbol'}</span>
          </h3>
          <button class="modal-close-btn" id="modal-close-compare">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style="padding: 12px 20px 8px 20px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 10px;">
          <div style="position: relative; display: flex; align-items: center;">
            <input type="text" id="compare-search-input" value="${this.searchQuery}" placeholder="${isFa ? 'جستجوی نماد مقایسه (مثلاً ETH, SOL, XAU, DXY, SPX)...' : 'Search comparison symbol (e.g. ETH, SOL, XAU, DXY)...'}" style="width: 100%; height: 36px; padding: 6px 12px; font-size: 13px;" />
          </div>

          <!-- Comparison Mode Selector -->
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
            <span style="color: var(--text-muted);">${isFa ? 'نوع مقیاس مقایسه:' : 'Comparison Mode:'}</span>
            <div style="display: flex; gap: 4px; background: rgba(0,0,0,0.3); padding: 2px; border-radius: 4px; border: 1px solid var(--border-subtle);">
              <button class="compare-mode-btn ${this.compareMode === 'percent' ? 'active' : ''}" data-mode="percent" style="font-size: 11px; padding: 3px 8px; border: none; border-radius: 3px; cursor: pointer; background: ${this.compareMode === 'percent' ? 'var(--accent-cyan)' : 'transparent'}; color: ${this.compareMode === 'percent' ? '#000' : 'var(--text-dim)'}; font-weight: 700;">
                ${isFa ? 'مقیاس درصدی (%)' : 'Same % Scale'}
              </button>
              <button class="compare-mode-btn ${this.compareMode === 'price' ? 'active' : ''}" data-mode="price" style="font-size: 11px; padding: 3px 8px; border: none; border-radius: 3px; cursor: pointer; background: ${this.compareMode === 'price' ? 'var(--accent-cyan)' : 'transparent'}; color: ${this.compareMode === 'price' ? '#000' : 'var(--text-dim)'}; font-weight: 700;">
                ${isFa ? 'قیمت مستقل' : 'New Price Scale'}
              </button>
            </div>
          </div>
        </div>

        <!-- Category Filters -->
        <div style="display: flex; gap: 4px; padding: 6px 20px; background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle); overflow-x: auto;">
          <button class="comp-cat-btn ${this.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">${isFa ? 'همه' : 'All'}</button>
          <button class="comp-cat-btn ${this.selectedCategory === 'crypto' ? 'active' : ''}" data-cat="crypto">${isFa ? 'کریپتو' : 'Crypto'}</button>
          <button class="comp-cat-btn ${this.selectedCategory === 'metals' ? 'active' : ''}" data-cat="metals">${isFa ? 'طلا و فلزات' : 'Metals'}</button>
          <button class="comp-cat-btn ${this.selectedCategory === 'indices' ? 'active' : ''}" data-cat="indices">${isFa ? 'شاخص‌ها' : 'Indices'}</button>
          <button class="comp-cat-btn ${this.selectedCategory === 'commodities' ? 'active' : ''}" data-cat="commodities">${isFa ? 'کالاها' : 'Commodities'}</button>
          <button class="comp-cat-btn ${this.selectedCategory === 'forex' ? 'active' : ''}" data-cat="forex">${isFa ? 'فارکس' : 'Forex'}</button>
        </div>

        <!-- Active Overlays Section -->
        ${this.overlays.size > 0 ? `
          <div style="padding: 10px 20px; background: rgba(0, 242, 176, 0.04); border-bottom: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px; text-transform: uppercase;">
              ${isFa ? 'نمادهای مقایسه‌ای فعال روی چارت' : 'Active Overlays On Chart'} (${this.overlays.size})
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${Array.from(this.overlays.values()).map(o => `
                <div style="display: inline-flex; align-items: center; gap: 6px; background: var(--bg-card); border: 1px solid ${o.color}; padding: 3px 8px; border-radius: 4px; font-size: 11px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: ${o.color};"></span>
                  <span style="font-weight: 700; color: #fff;">${o.symbol}</span>
                  <span style="color: var(--text-dim); font-size: 10px;">(${o.mode === 'percent' ? '%' : '$'})</span>
                  <button class="btn-remove-overlay" data-symbol="${o.symbol}" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0 2px; font-size: 11px;" title="Remove Overlay">✕</button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Benchmark Symbols List -->
        <div class="modal-content" style="flex: 1; max-height: 380px; padding: 10px 20px; overflow-y: auto;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${filtered.map(b => {
              const isAdded = this.overlays.has(b.symbol);
              return `
                <div class="compare-item-row" data-symbol="${b.symbol}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 4px; transition: background 0.15s;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${b.color};"></span>
                    <div>
                      <div style="font-weight: 700; font-size: 13px; color: #fff;">${b.symbol}</div>
                      <div style="font-size: 11px; color: var(--text-dim);">${b.name}</div>
                    </div>
                  </div>
                  <div>
                    ${isAdded ? `
                      <button class="btn-toggle-overlay btn-secondary" data-symbol="${b.symbol}" style="font-size: 11px; padding: 4px 10px; color: var(--accent-red); border-color: rgba(255, 77, 91, 0.3);">
                        ${isFa ? 'حذف مقایسه ✕' : 'Remove ✕'}
                      </button>
                    ` : `
                      <button class="btn-add-overlay btn-primary" data-symbol="${b.symbol}" data-name="${b.name}" data-color="${b.color}" style="font-size: 11px; padding: 4px 12px;">
                        ${isFa ? '+ افزودن به چارت' : '+ Compare'}
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="padding: 8px 20px; font-size: 11px; color: var(--text-dim); background: var(--bg-darkest); border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <span>${isFa ? 'مقایسه همبستگی چند دارایی با مقیاس درصدی خودکار' : 'Multi-Asset Correlation & Return Comparison'}</span>
          <span style="color: var(--accent-cyan); font-weight: 600;">${this.overlays.size} ${isFa ? 'مقایسه فعال' : 'Active'}</span>
        </div>
      </div>
    `;

    this.bindModalEvents();
  }

  bindModalEvents() {
    this.modalEl.querySelector('#modal-close-compare')?.addEventListener('click', () => this.close());

    // Search input
    const searchInput = this.modalEl.querySelector('#compare-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render();
      const updated = this.modalEl.querySelector('#compare-search-input');
      if (updated) {
        updated.focus();
        updated.selectionStart = updated.selectionEnd = updated.value.length;
      }
    });

    // Mode Buttons
    this.modalEl.querySelectorAll('.compare-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.compareMode = btn.getAttribute('data-mode');
        this.render();
      });
    });

    // Category Buttons
    this.modalEl.querySelectorAll('.comp-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.getAttribute('data-cat');
        this.render();
      });
    });

    // Add overlay button
    this.modalEl.querySelectorAll('.btn-add-overlay').forEach(btn => {
      btn.addEventListener('click', () => {
        const symbol = btn.getAttribute('data-symbol');
        const name = btn.getAttribute('data-name');
        const color = btn.getAttribute('data-color');
        this.addOverlay(symbol, name, color, this.compareMode);
        this.render();
      });
    });

    // Remove overlay buttons
    this.modalEl.querySelectorAll('.btn-remove-overlay, .btn-toggle-overlay').forEach(btn => {
      btn.addEventListener('click', () => {
        const symbol = btn.getAttribute('data-symbol');
        this.removeOverlay(symbol);
        this.render();
      });
    });
  }

  async addOverlay(symbol, name, color, mode = 'percent') {
    if (this.overlays.has(symbol)) return;

    console.log(`[CompareModal] Adding ${symbol} overlay in ${mode} mode...`);

    // Prepare Pine Script for comparison overlay
    // Pine Script fetches security and plots either normalized % return or price
    let script = '';
    const cleanSym = symbol.replace(/^.*:/, '').toUpperCase();

    if (mode === 'percent') {
      script = `//@version=5
indicator("${cleanSym} vs ${this.app.currentSymbol} (%)", overlay=false)
secClose = request.security("universal:${cleanSym}", timeframe.period, close)
baseVal = ta.valuewhen(not na(secClose), secClose, 100)
pctChange = not na(baseVal) and baseVal != 0 ? ((secClose - baseVal) / baseVal) * 100 : 0
hline(0, "Zero Baseline", color=color.gray, linestyle=hline.style_dotted)
plot(pctChange, "${cleanSym} %", color=color.rgb(${this.hexToRgb(color)}), linewidth=2)
`;
    } else {
      script = `//@version=5
indicator("${cleanSym} Price Overlay", overlay=false)
secClose = request.security("universal:${cleanSym}", timeframe.period, close)
plot(secClose, "${cleanSym}", color=color.rgb(${this.hexToRgb(color)}), linewidth=2)
`;
    }

    let handleId = null;
    const res = this.app.chartManager?.addPineIndicator(script, `${cleanSym} Compare`);
    if (res && res.success) {
      handleId = res.handleId;
    }

    this.overlays.set(symbol, {
      symbol,
      name,
      color,
      mode,
      handleId,
      visible: true,
      lastPrice: 0,
      changePct: 0
    });

    // Subscribe to WebSocket ticks for this symbol to update the floating legend
    if (this.app.chartManager?.workspace?.providers?.universal) {
      try {
        fetch(`/api/tickers?symbols=${symbol}`).then(r => r.json()).then(data => {
          if (Array.isArray(data) && data[0]) {
            const item = this.overlays.get(symbol);
            if (item) {
              item.lastPrice = data[0].lastPrice;
              item.changePct = data[0].priceChangePercent;
              this.updateFloatingLegend();
            }
          }
        }).catch(() => {});
      } catch (e) {}
    }

    this.updateFloatingLegend();
  }

  removeOverlay(symbol) {
    const item = this.overlays.get(symbol);
    if (!item) return;

    if (item.handleId && this.app.chartManager?.workspace?.active?.chart) {
      const chart = this.app.chartManager.workspace.active.chart;
      const handle = chart.orchestrator?.handles?.get(item.handleId);
      if (handle && typeof handle.remove === 'function') {
        handle.remove();
      }
    }

    this.overlays.delete(symbol);
    this.updateFloatingLegend();
  }

  toggleOverlayVisibility(symbol) {
    const item = this.overlays.get(symbol);
    if (!item) return;

    item.visible = !item.visible;
    if (item.handleId && this.app.chartManager?.workspace?.active?.chart) {
      const chart = this.app.chartManager.workspace.active.chart;
      const handle = chart.orchestrator?.handles?.get(item.handleId);
      if (handle && typeof handle.setVisible === 'function') {
        handle.setVisible(item.visible);
      }
    }
    this.updateFloatingLegend();
  }

  updateFloatingLegend() {
    if (!this.legendEl) return;

    if (this.overlays.size === 0) {
      this.legendEl.style.display = 'none';
      this.legendEl.innerHTML = '';
      return;
    }

    this.legendEl.style.display = 'flex';
    this.legendEl.innerHTML = Array.from(this.overlays.values()).map(o => {
      const isPositive = o.changePct >= 0;
      const formattedPct = `${isPositive ? '+' : ''}${o.changePct.toFixed(2)}%`;
      return `
        <div class="compare-badge-pill" style="display: flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); border: 1px solid ${o.color}; padding: 3px 8px; border-radius: 4px; font-size: 11px; opacity: ${o.visible ? '1' : '0.5'};">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${o.color};"></span>
          <span style="font-weight: 700; color: #fff;">${o.symbol}</span>
          ${o.lastPrice ? `<span class="num-ltr" style="color: var(--text-dim); font-size: 10px;">$${o.lastPrice.toLocaleString()}</span>` : ''}
          <span class="num-ltr" style="font-weight: 700; color: ${isPositive ? 'var(--accent-green)' : 'var(--accent-red)'}; font-size: 10px;">
            ${formattedPct}
          </span>
          <button class="btn-legend-eye" data-symbol="${o.symbol}" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0 2px;" title="Toggle Visibility">
            ${o.visible ? '👁' : '🚫'}
          </button>
          <button class="btn-legend-remove" data-symbol="${o.symbol}" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0 2px; font-size: 12px;" title="Remove Overlay">✕</button>
        </div>
      `;
    }).join('');

    this.legendEl.querySelectorAll('.btn-legend-eye').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleOverlayVisibility(btn.getAttribute('data-symbol'));
      });
    });

    this.legendEl.querySelectorAll('.btn-legend-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeOverlay(btn.getAttribute('data-symbol'));
      });
    });
  }

  hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
  }
}
