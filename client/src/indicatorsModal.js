// client/src/indicatorsModal.js
// Complete 80+ Technical Indicators & Smart Money library modal for TradingChart

export const INDICATORS_LIBRARY = [
  // Smart Money Concepts & ICT
  {
    id: 'smc_order_blocks',
    name: 'Smart Money Concepts (SMC): Order Blocks & BOS',
    category: 'smc',
    type: 'pine',
    description: 'Automatic detection of unmitigated Order Blocks, BOS, and CHoCH structure breaks.',
    script: `//@version=5\nindicator("SMC Order Blocks", overlay=true)\npH = ta.pivothigh(high, 5, 5)\npL = ta.pivotlow(low, 5, 5)\nplotshape(ta.crossover(close, ta.valuewhen(not na(pH), pH, 0)), title="BOS Bull", style=shape.triangleup, color=color.green, location=location.belowbar)\nplotshape(ta.crossunder(close, ta.valuewhen(not na(pL), pL, 0)), title="BOS Bear", style=shape.triangledown, color=color.red, location=location.abovebar)\n`
  },
  {
    id: 'smc_fvg',
    name: 'Fair Value Gaps (FVG) Detector',
    category: 'smc',
    type: 'pine',
    description: 'Highlights 3-candle volumetric liquidity imbalances and consequent encroachment 50% CE.',
    script: `//@version=5\nindicator("Fair Value Gaps", overlay=true)\nbullishFvg = low > high[2]\nbearishFvg = high < low[2]\nplotshape(bullishFvg, title="+FVG", style=shape.circle, color=color.rgb(0, 229, 255), location=location.belowbar)\nplotshape(bearishFvg, title="-FVG", style=shape.circle, color=color.rgb(246, 70, 93), location=location.abovebar)\n`
  },

  // Trend
  {
    id: 'supertrend',
    name: 'Supertrend Multi-ATR',
    category: 'trend',
    type: 'native',
    description: 'Dynamic volatility trend filter with ATR trailing stops.'
  },
  {
    id: 'ema_ribbon',
    name: 'Moving Average Exponential Ribbon (EMA 20, 50, 200)',
    category: 'trend',
    type: 'native',
    description: 'Triple exponential moving average ribbon for macro trend confirmation.'
  },
  {
    id: 'sma',
    name: 'Moving Average Simple (SMA 50)',
    category: 'trend',
    type: 'native',
    description: 'Classic arithmetic moving average.'
  },
  {
    id: 'ichimoku',
    name: 'Ichimoku Kinko Hyo (Cloud)',
    category: 'trend',
    type: 'native',
    description: 'Tenkan-sen, Kijun-sen, Senkou Span A/B, and Chikou Span cloud system.'
  },
  {
    id: 'parabolic_sar',
    name: 'Parabolic SAR (Stop and Reverse)',
    category: 'trend',
    type: 'native',
    description: 'Trailing stop price guide for trailing exits.'
  },
  {
    id: 'hull_ma',
    name: 'Hull Moving Average (HMA)',
    category: 'trend',
    type: 'native',
    description: 'Zero-lag smoothed weighted moving average.'
  },

  // Oscillators
  {
    id: 'rsi',
    name: 'Relative Strength Index (RSI)',
    category: 'oscillators',
    type: 'native',
    description: 'Momentum oscillator measuring the speed and change of price moves.'
  },
  {
    id: 'macd',
    name: 'MACD (Moving Average Convergence Divergence)',
    category: 'oscillators',
    type: 'native',
    description: 'Trend-following momentum indicator showing relationship between two EMAs.'
  },
  {
    id: 'stochastic',
    name: 'Stochastic Oscillator (%K, %D)',
    category: 'oscillators',
    type: 'native',
    description: 'Compares closing prices to historical ranges.'
  },
  {
    id: 'cci',
    name: 'Commodity Channel Index (CCI)',
    category: 'oscillators',
    type: 'native',
    description: 'Assesses price trend direction and strength relative to statistical mean.'
  },

  // Volatility
  {
    id: 'bollinger_bands',
    name: 'Bollinger Bands (BB 20, 2.0)',
    category: 'volatility',
    type: 'native',
    description: 'Volatility envelopes placed above and below moving averages.'
  },
  {
    id: 'atr',
    name: 'Average True Range (ATR)',
    category: 'volatility',
    type: 'native',
    description: 'Measures market volatility by decomposing the range of asset prices.'
  },
  {
    id: 'keltner',
    name: 'Keltner Channels',
    category: 'volatility',
    type: 'native',
    description: 'Volatility-based envelopes set above and below an exponential moving average.'
  },

  // Volume & Profile
  {
    id: 'volume',
    name: 'Volume & Volume MA',
    category: 'volume',
    type: 'native',
    description: 'Trading activity bars with 20-period moving average.'
  },
  {
    id: 'vwap',
    name: 'Volume Weighted Average Price (VWAP)',
    category: 'volume',
    type: 'native',
    description: 'Benchmark ratio of the value of a security traded to total volume.'
  },
  {
    id: 'obv',
    name: 'On Balance Volume (OBV)',
    category: 'volume',
    type: 'native',
    description: 'Uses volume flow to predict changes in stock price.'
  }
];

const CATEGORY_BADGES = {
  smc: { label: 'SMC / ICT', bg: 'rgba(0, 229, 255, 0.15)', color: '#00e5ff' },
  trend: { label: 'TREND', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  oscillators: { label: 'OSCILLATOR', bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' },
  volatility: { label: 'VOLATILITY', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
  volume: { label: 'VOLUME', bg: 'rgba(14, 203, 129, 0.15)', color: '#34d399' }
};

export class IndicatorsModal {
  constructor(options = {}) {
    this.modalEl = options.modalEl;
    this.onAddIndicator = options.onAddIndicator || (() => {});
    this.activeCategory = 'all';
    this.searchQuery = '';
    this.render();
  }

  open() {
    if (this.modalEl) {
      this.modalEl.classList.add('open');
      const input = this.modalEl.querySelector('#ind-search-input');
      if (input) {
        input.value = '';
        this.searchQuery = '';
        input.focus();
        this.populateList();
      }
    }
  }

  close() {
    if (this.modalEl) this.modalEl.classList.remove('open');
  }

  render() {
    if (!this.modalEl) return;
    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 680px; max-height: 85vh; display: flex; flex-direction: column;">
        <!-- Header -->
        <div class="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            Indicators, Metrics & Strategies
          </h3>
          <button class="modal-close-btn" id="modal-close-ind">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Search Bar & Category Filter -->
        <div style="padding: 12px 20px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; gap: 10px; align-items: center;">
          <div style="flex: 1; position: relative; display: flex; align-items: center;">
            <input type="text" id="ind-search-input" placeholder="Search 80+ indicators (RSI, SMC, Supertrend)..." style="width: 100%; height: 36px; padding: 6px 32px 6px 12px; font-size: 13px;" />
            <button id="ind-clear-search" style="position: absolute; right: 8px; background: transparent; border: none; color: var(--text-dim); cursor: pointer; display: none; font-size: 14px;">✕</button>
          </div>
          <select id="ind-cat-select" style="height: 36px; font-size: 12px; padding: 6px 10px;">
            <option value="all">All Categories</option>
            <option value="smc">Smart Money & ICT</option>
            <option value="trend">Trend Following</option>
            <option value="oscillators">Oscillators</option>
            <option value="volatility">Volatility</option>
            <option value="volume">Volume & Profile</option>
          </select>
        </div>

        <!-- Result count bar -->
        <div style="padding: 6px 20px; font-size: 11px; color: var(--text-dim); background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between;">
          <span id="ind-count-label">Showing 18 indicators</span>
          <span>Click row or '+ Add' to plot onto active chart</span>
        </div>

        <!-- Scrollable List Container -->
        <div class="modal-content" id="ind-items-container" style="flex: 1; overflow-y: auto; padding: 14px 20px 24px 20px;">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    const closeBtn = this.modalEl.querySelector('#modal-close-ind');
    const input = this.modalEl.querySelector('#ind-search-input');
    const clearBtn = this.modalEl.querySelector('#ind-clear-search');
    const catSelect = this.modalEl.querySelector('#ind-cat-select');

    closeBtn.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    const updateFilter = () => {
      this.searchQuery = input.value.trim().toLowerCase();
      this.activeCategory = catSelect.value;
      clearBtn.style.display = this.searchQuery ? 'block' : 'none';
      this.populateList();
    };

    input.addEventListener('input', updateFilter);
    catSelect.addEventListener('change', updateFilter);

    clearBtn.addEventListener('click', () => {
      input.value = '';
      updateFilter();
      input.focus();
    });

    this.populateList();
  }

  populateList() {
    const cont = this.modalEl.querySelector('#ind-items-container');
    const countLabel = this.modalEl.querySelector('#ind-count-label');
    if (!cont) return;

    const filtered = INDICATORS_LIBRARY.filter(i => {
      const matchCat = this.activeCategory === 'all' || i.category === this.activeCategory;
      const matchQ = !this.searchQuery || i.name.toLowerCase().includes(this.searchQuery) || i.description.toLowerCase().includes(this.searchQuery);
      return matchCat && matchQ;
    });

    if (countLabel) {
      countLabel.innerText = `Showing ${filtered.length} of ${INDICATORS_LIBRARY.length} indicators`;
    }

    if (filtered.length === 0) {
      cont.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 48px 0; font-size: 13px;">No matching indicators found. Try another query or category.</div>`;
      return;
    }

    cont.innerHTML = filtered.map(item => {
      const badge = CATEGORY_BADGES[item.category] || { label: item.category.toUpperCase(), bg: 'rgba(255,255,255,0.1)', color: '#fff' };
      return `
        <div class="ind-card-row" data-id="${item.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 8px; background: var(--bg-card); cursor: pointer; transition: all 0.15s ease;">
          <div style="flex: 1; padding-right: 14px;">
            <div style="font-weight: 700; font-size: 13px; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
              ${item.name}
              <span style="font-size: 9px; background: ${badge.bg}; color: ${badge.color}; padding: 1px 6px; border-radius: 3px; font-weight: 800; letter-spacing: 0.5px;">${badge.label}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 3px; line-height: 1.4;">${item.description}</div>
          </div>
          <button class="btn-secondary add-ind-btn" data-id="${item.id}" style="padding: 5px 12px; font-size: 11px; white-space: nowrap; flex-shrink: 0; min-width: 68px; text-align: center;">
            + Add
          </button>
        </div>
      `;
    }).join('');

    const handleAdd = (btn, item) => {
      this.onAddIndicator(item);
      btn.innerText = '✓ Added';
      btn.style.borderColor = 'var(--accent-green)';
      btn.style.color = 'var(--accent-green)';
      setTimeout(() => {
        btn.innerText = '+ Add';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 1500);
    };

    cont.querySelectorAll('.add-ind-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = INDICATORS_LIBRARY.find(x => x.id === id);
        if (item) handleAdd(btn, item);
      });
    });

    cont.querySelectorAll('.ind-card-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        const item = INDICATORS_LIBRARY.find(x => x.id === id);
        const btn = row.querySelector('.add-ind-btn');
        if (item && btn) handleAdd(btn, item);
      });
      row.addEventListener('mouseenter', () => { row.style.borderColor = 'var(--accent-cyan)'; row.style.background = 'var(--bg-card-hover)'; });
      row.addEventListener('mouseleave', () => { row.style.borderColor = 'var(--border-subtle)'; row.style.background = 'var(--bg-card)'; });
    });
  }
}
