# TradingChart — Pine Script v5/v6 Guide & Templates

TradingChart features a built-in Pine Script editor and execution runtime powered by PineTS. You can write custom indicators and strategies, compile them in real-time, plot visual markers and series onto the chart, and execute backtests against historical data.

---

## 1. Quick-Start Indicator Example

```pinescript
//@version=5
indicator("Moving Average Cross", overlay=true)

fastLength = input.int(9, "Fast Length", minval=1)
slowLength = input.int(21, "Slow Length", minval=1)

fastMA = ta.ema(close, fastLength)
slowMA = ta.ema(close, slowLength)

plot(fastMA, "Fast EMA", color=color.rgb(0, 229, 255), linewidth=2)
plot(slowMA, "Slow EMA", color=color.rgb(246, 70, 93), linewidth=2)

bullishCross = ta.crossover(fastMA, slowMA)
bearishCross = ta.crossunder(fastMA, slowMA)

plotshape(bullishCross, title="Buy Signal", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small)
plotshape(bearishCross, title="Sell Signal", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small)
```

---

## 2. Smart Money Concepts (SMC Pro) Template

```pinescript
//@version=5
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
```

---

## 3. Quantitative Strategy Template (Cover-Shannon Rebalance)

```pinescript
//@version=5
strategy("Shannon Rebalance Strategy", overlay=true, initial_capital=100000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

length = input.int(20, "Lookback Period")
mult = input.float(2.0, "Multiplier")

basis = ta.sma(close, length)
dev = mult * ta.stdev(close, length)
upper = basis + dev
lower = basis - dev

// Mean Reversion Entry & Exit Rules
if (close < lower)
    strategy.entry("LongRebalance", strategy.long)

if (close > upper)
    strategy.close("LongRebalance")
```

---

## 4. Best Practices & Runtime Invariants
1. **Body Close vs. Wick Sweep:** In Smart Money analysis, structure breaks (`BOS` or `CHoCH`) require a candle close beyond the swing level. Use `ta.crossover(close, lastHigh)` rather than `high > lastHigh`.
2. **Color Constants:** In PineTS runtime, use `color.rgb(r, g, b)` or canonical colors (`color.blue`, `color.green`, `color.red`). The TradingChart editor automatically auto-sanitizes unrecognized color constants before transpilation.
3. **No Semicolons:** Pine Script rejects semicolons (`;`) as statement separators. Each statement must occupy its own line.
4. **Forward Loops Only:** `for i = start to end` always increments. Use forward loops with computed reverse indices when scanning backwards.
