// client/src/pineStudio.js
// In-browser Pine Script v5/v6 IDE & execution studio powered by pinets

import { Indicator } from 'pinets';

export const PINE_TEMPLATES = {
  smc_pro: {
    name: 'Smart Money Concepts (SMC Pro)',
    description: 'BOS, CHoCH, Order Blocks, and Fair Value Gaps',
    code: `//@version=5
indicator("Nexus SMC Pro", overlay=true)

// Lookback & Swing Detection
lb = input.int(5, "Swing Lookback", minval=2)
pHigh = ta.pivothigh(high, lb, lb)
pLow  = ta.pivotlow(low, lb, lb)

// Track Structural Swings
var float lastHigh = na
var float lastLow = na
if not na(pHigh)
    lastHigh := pHigh
if not na(pLow)
    lastLow := pLow

// Structure Breaks (Body Close Invariant)
bool bosBull = ta.crossover(close, lastHigh)
bool bosBear = ta.crossunder(close, lastLow)

plotshape(bosBull, title="BOS Bullish", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small, text="BOS")
plotshape(bosBear, title="BOS Bearish", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small, text="BOS")

// Fair Value Gap (FVG)
bool fvgBull = low > high[2] and close[1] > high[2]
bool fvgBear = high < low[2] and close[1] < low[2]

plotshape(fvgBull, title="+FVG", style=shape.circle, location=location.belowbar, color=color.rgb(0, 229, 255), size=size.tiny)
plotshape(fvgBear, title="-FVG", style=shape.circle, location=location.abovebar, color=color.rgb(246, 70, 93), size=size.tiny)
`
  },
  supertrend: {
    name: 'Supertrend Multi-ATR',
    description: 'Trend following system with ATR trailing stop',
    code: `//@version=5
indicator("Supertrend ATR", overlay=true)

atrPeriod = input.int(10, "ATR Period", minval=1)
factor = input.float(3.0, "ATR Factor", step=0.1)

[supertrend, direction] = ta.supertrend(factor, atrPeriod)

bodyMiddle = plot((open + close) / 2, display=display.none)
upTrend = plot(direction < 0 ? supertrend : na, "Up Trend", color=color.green, style=plot.style_linebr)
downTrend = plot(direction < 0 ? na : supertrend, "Down Trend", color=color.red, style=plot.style_linebr)

fill(bodyMiddle, upTrend, color.new(color.green, 90), fillgaps=false)
fill(bodyMiddle, downTrend, color.new(color.red, 90), fillgaps=false)
`
  },
  rsi_divergence: {
    name: 'RSI Momentum Oscillator',
    description: 'Relative Strength Index with Overbought/Oversold bands',
    code: `//@version=5
indicator("RSI Momentum", overlay=false)

len = input.int(14, "RSI Length", minval=1)
src = input.source(close, "Source")
up = ta.rma(math.max(ta.change(src), 0), len)
down = ta.rma(-math.min(ta.change(src), 0), len)
rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))

plot(rsi, "RSI", color=color.rgb(168, 85, 247), linewidth=2)
band1 = hline(70, "Overbought", color=color.gray, linestyle=hline.style_dashed)
band0 = hline(30, "Oversold", color=color.gray, linestyle=hline.style_dashed)
fill(band1, band0, color.new(color.purple, 90))
`
  },
  ma_cross: {
    name: 'EMA Triple Ribbon',
    description: 'Triple Exponential Moving Average (20, 50, 200)',
    code: `//@version=5
indicator("EMA Ribbon", overlay=true)

ema20 = ta.ema(close, 20)
ema50 = ta.ema(close, 50)
ema200 = ta.ema(close, 200)

plot(ema20, "EMA 20", color=color.rgb(0, 229, 255), linewidth=2)
plot(ema50, "EMA 50", color=color.rgb(245, 158, 11), linewidth=2)
plot(ema200, "EMA 200", color=color.rgb(246, 70, 93), linewidth=2)
`
  },
  rebalance_shannon: {
    name: 'Cover-Shannon Volatility Rebalance',
    description: 'Dynamic volatility band rebalancing strategy',
    code: `//@version=5
strategy("Shannon Rebalance Strategy", overlay=true, initial_capital=100000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

length = input.int(20, "Lookback Period")
mult = input.float(2.0, "Multiplier")

basis = ta.sma(close, length)
dev = mult * ta.stdev(close, length)
upper = basis + dev
lower = basis - dev

// Mean Reversion Rules
if (close < lower)
    strategy.entry("LongRebalance", strategy.long)

if (close > upper)
    strategy.close("LongRebalance")
`
  }
};

export class PineStudio {
  constructor(options = {}) {
    this.container = options.container;
    this.onAddToChart = options.onAddToChart || (() => {});
    this.onBacktest = options.onBacktest || (() => {});
    this.activeCode = PINE_TEMPLATES.smc_pro.code;
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; direction: ltr !important;">
        <!-- Top Toolbar -->
        <div style="height: 38px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; direction: ltr !important;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <select id="pine-template-select" style="padding: 4px 8px; font-size: 12px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-subtle); border-radius: 4px;">
              <option value="smc_pro">Nexus SMC Pro (Order Blocks & BOS)</option>
              <option value="supertrend">Supertrend Multi-ATR</option>
              <option value="rsi_divergence">RSI Momentum Oscillator</option>
              <option value="ma_cross">EMA Triple Ribbon (20/50/200)</option>
              <option value="rebalance_shannon">Shannon Rebalance Strategy</option>
            </select>
            <button id="btn-pine-new" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">New</button>
            <button id="btn-pine-save" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">Save</button>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-pine-compile" class="btn-primary" style="padding: 4px 12px; font-size: 12px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Add to Chart
            </button>
            <button id="btn-pine-backtest" class="btn-secondary" style="padding: 4px 12px; font-size: 12px; border-color: var(--accent-gold); color: var(--accent-gold);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Backtest Strategy
            </button>
          </div>
        </div>

        <!-- Split View: Editor + Line Numbers + Diagnostics -->
        <div style="flex: 1; display: flex; overflow: hidden; direction: ltr !important;">
          <!-- Line Numbers Gutter -->
          <div id="pine-line-gutter" style="width: 42px; background: #06080d; color: #475569; font-family: var(--font-mono); font-size: 12px; line-height: 1.6; text-align: right; padding: 12px 6px 12px 0; user-select: none; border-right: 1px solid var(--border-subtle); overflow: hidden;">
            1
          </div>

          <!-- Code Textarea -->
          <div style="flex: 1; position: relative; overflow: hidden;">
            <textarea id="pine-code-editor" style="width: 100%; height: 100%; resize: none; background: #070a10; color: #e2e8f0; font-family: var(--font-mono); font-size: 13px; line-height: 1.6; padding: 12px; border: none; outline: none; white-space: pre;" spellcheck="false"></textarea>
          </div>

          <!-- Diagnostics Console with Clear Visual Divider -->
          <div id="pine-diagnostics-pane" style="width: 300px; background: var(--bg-darkest); border-left: 1px solid var(--border-subtle); padding: 14px; overflow-y: auto; font-size: 12px; display: flex; flex-direction: column; gap: 10px; direction: ltr !important; text-align: left !important; box-shadow: -4px 0 16px rgba(0,0,0,0.4);">
            <div style="font-weight: 700; color: var(--text-muted); display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green);"></span>
              Diagnostics Console
            </div>
            <div id="pine-diag-content" style="color: var(--text-dim); font-family: var(--font-mono); font-size: 11px; line-height: 1.6; white-space: pre-wrap; direction: ltr !important; text-align: left !important; margin: 0; padding: 0;">
              Ready. Click 'Add to Chart' to compile Pine Script.
            </div>
          </div>
        </div>
      </div>
    `;

    const textarea = this.container.querySelector('#pine-code-editor');
    const gutter = this.container.querySelector('#pine-line-gutter');
    const select = this.container.querySelector('#pine-template-select');
    const btnCompile = this.container.querySelector('#btn-pine-compile');
    const btnBacktest = this.container.querySelector('#btn-pine-backtest');
    const btnNew = this.container.querySelector('#btn-pine-new');
    const btnSave = this.container.querySelector('#btn-pine-save');
    const diag = this.container.querySelector('#pine-diag-content');

    const updateGutter = () => {
      if (!textarea || !gutter) return;
      const linesCount = textarea.value.split('\n').length;
      let gutterStr = '';
      for (let i = 1; i <= Math.max(linesCount, 1); i++) {
        gutterStr += i + '\n';
      }
      gutter.innerText = gutterStr;
    };

    textarea.addEventListener('scroll', () => {
      gutter.scrollTop = textarea.scrollTop;
    });

    textarea.addEventListener('input', updateGutter);

    // Restore saved code or default
    const saved = localStorage.getItem('tradingchart_pine_code');
    textarea.value = saved || this.activeCode;
    updateGutter();

    select.addEventListener('change', (e) => {
      const tpl = PINE_TEMPLATES[e.target.value];
      if (tpl) {
        textarea.value = tpl.code;
        this.activeCode = tpl.code;
        updateGutter();
      }
    });

    btnNew.addEventListener('click', () => {
      textarea.value = `//@version=5\nindicator("My Custom Indicator", overlay=true)\n\nlen = input.int(14, "Length")\nplot(ta.sma(close, len), color=color.yellow, linewidth=2)\n`;
      updateGutter();
    });

    btnSave.addEventListener('click', () => {
      localStorage.setItem('tradingchart_pine_code', textarea.value);
      diag.innerHTML = `<span style="color: var(--accent-green);">✓ Script saved to local storage</span>`;
    });

    btnCompile.addEventListener('click', () => {
      this.compileAndAdd(textarea.value, diag);
    });

    btnBacktest.addEventListener('click', () => {
      this.runBacktest(textarea.value, diag);
    });
  }

  compileAndAdd(source, diagEl) {
    try {
      const sanitized = source.replace(/\bcolor\.cyan\b/g, 'color.rgb(0, 229, 255)');
      const ind = Indicator.from(sanitized);
      const declaration = ind.getDeclarationType();
      const meta = ind.getInputsMeta();

      diagEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 700;">✓ AST Validation Succeeded</span>\nMode: ${declaration.toUpperCase()}\nDetected Inputs: ${meta.length} inputs\nMounting into active chart...`;

      this.onAddToChart(sanitized);
    } catch (e) {
      diagEl.innerHTML = `<span style="color: var(--accent-red); font-weight: 700;">✗ Compilation Error:</span>\n${e.message}`;
    }
  }

  runBacktest(source, diagEl) {
    try {
      const sanitized = source.replace(/\bcolor\.cyan\b/g, 'color.rgb(0, 229, 255)');
      const ind = Indicator.from(sanitized);
      diagEl.innerHTML = `<span style="color: var(--accent-green); font-weight: 700;">✓ Initializing Backtest Engine</span>\nExecuting on active candle dataset...`;
      this.onBacktest(sanitized);
    } catch (e) {
      diagEl.innerHTML = `<span style="color: var(--accent-red); font-weight: 700;">✗ Backtest Parse Error:</span>\n${e.message}`;
    }
  }
}
