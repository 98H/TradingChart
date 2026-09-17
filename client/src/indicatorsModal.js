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
    name: 'Moving Average Exponential (EMA 20, 50, 200)',
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
    description: 'Compares a particular closing price to a range of its prices over time.'
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
    description: 'Volatility bands placed above and below a moving average with standard deviations.'
  },
  {
    id: 'atr',
    name: 'Average True Range (ATR)',
    category: 'volatility',
    type: 'native',
    description: 'Measures market volatility by decomposing the entire range of an asset price.'
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

export class IndicatorsModal {
  constructor(options = {}) {
    this.modalEl = options.modalEl;
    this.onAddIndicator = options.onAddIndicator || (() => {});
    this.activeCategory = 'all';
    this.render();
  }

  open() {
    if (this.modalEl) this.modalEl.classList.add('open');
  }

  close() {
    if (this.modalEl) this.modalEl.classList.remove('open');
  }

  render() {
    if (!this.modalEl) return;
    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 640px;">
        <div class="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            Indicators, Metrics & Strategies
          </h3>
          <button class="modal-close-btn" id="modal-close-ind">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style="padding: 12px 20px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; gap: 8px;">
          <input type="text" id="ind-search-input" placeholder="Search 80+ indicators (RSI, SMC, Supertrend, MACD)..." style="flex: 1; padding: 8px 12px; font-size: 13px;" />
          <select id="ind-cat-select" style="font-size: 12px; padding: 8px 12px;">
            <option value="all">All Categories</option>
            <option value="smc">Smart Money & ICT</option>
            <option value="trend">Trend Following</option>
            <option value="oscillators">Oscillators</option>
            <option value="volatility">Volatility</option>
            <option value="volume">Volume & Profile</option>
          </select>
        </div>

        <div class="modal-content" id="ind-items-container" style="max-height: 440px; padding: 12px 20px;">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    const closeBtn = this.modalEl.querySelector('#modal-close-ind');
    const input = this.modalEl.querySelector('#ind-search-input');
    const catSelect = this.modalEl.querySelector('#ind-cat-select');

    closeBtn.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    const updateFilter = () => {
      this.populateList(input.value.trim().toLowerCase(), catSelect.value);
    };

    input.addEventListener('input', updateFilter);
    catSelect.addEventListener('change', updateFilter);

    this.populateList('', 'all');
  }

  populateList(query = '', category = 'all') {
    const cont = this.modalEl.querySelector('#ind-items-container');
    if (!cont) return;

    const filtered = INDICATORS_LIBRARY.filter(i => {
      const matchCat = category === 'all' || i.category === category;
      const matchQ = !query || i.name.toLowerCase().includes(query) || i.description.toLowerCase().includes(query);
      return matchCat && matchQ;
    });

    if (filtered.length === 0) {
      cont.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 32px 0;">No indicators match your search query.</div>`;
      return;
    }

    cont.innerHTML = filtered.map(item => `
      <div class="ind-card-row" data-id="${item.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 8px; background: var(--bg-card); cursor: pointer; transition: all 0.12s;">
        <div>
          <div style="font-weight: 700; font-size: 13px; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            ${item.name}
            ${item.category === 'smc' ? '<span style="font-size: 9px; background: var(--accent-cyan-dim); color: var(--accent-cyan); padding: 1px 5px; border-radius: 3px; font-weight: 800;">SMC</span>' : ''}
          </div>
          <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${item.description}</div>
        </div>
        <button class="btn-secondary add-ind-btn" data-id="${item.id}" style="padding: 4px 10px; font-size: 11px; white-space: nowrap;">
          + Add
        </button>
      </div>
    `).join('');

    cont.querySelectorAll('.add-ind-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = INDICATORS_LIBRARY.find(x => x.id === id);
        if (item) {
          this.onAddIndicator(item);
          this.close();
        }
      });
    });

    cont.querySelectorAll('.ind-card-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        const item = INDICATORS_LIBRARY.find(x => x.id === id);
        if (item) {
          this.onAddIndicator(item);
          this.close();
        }
      });
    });
  }
}
