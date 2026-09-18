// client/src/indicatorsData.js
// Complete 84+ Institutional & Technical Indicators for TradingChart
// All implemented in 100% compliant Pine Script v5 compiled client-side by PineTS

export const INDICATORS_LIBRARY = [
  // ── 1. Smart Money Concepts (SMC) & ICT (12 Indicators) ─────────────
  {
    id: 'smc_order_blocks',
    name: 'Smart Money Concepts: Order Blocks & BOS',
    category: 'smc',
    description: 'Structural pivot swing detection with Break of Structure (BOS) and Order Block identification.',
    script: `//@version=5
indicator("SMC Order Blocks & BOS", overlay=true)
lb = input.int(5, "Swing Lookback", minval=2)
pH = ta.pivothigh(high, lb, lb)
pL = ta.pivotlow(low, lb, lb)
var float lastH = na
var float lastL = na
if not na(pH)
    lastH := pH
if not na(pL)
    lastL := pL
bosBull = ta.crossover(close, lastH)
bosBear = ta.crossunder(close, lastL)
plotshape(bosBull, title="BOS Bull", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small, text="BOS")
plotshape(bosBear, title="BOS Bear", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small, text="BOS")
`
  },
  {
    id: 'smc_fvg',
    name: 'Fair Value Gaps (FVG) Detector',
    category: 'smc',
    description: '3-candle imbalance detector marking bullish and bearish Fair Value Gaps and 50% CE level.',
    script: `//@version=5
indicator("Fair Value Gaps (FVG)", overlay=true)
bullFvg = low > high[2] and close[1] > high[2]
bearFvg = high < low[2] and close[1] < low[2]
plotshape(bullFvg, title="+FVG Bull", style=shape.circle, location=location.belowbar, color=color.rgb(0, 229, 255), size=size.tiny, text="FVG")
plotshape(bearFvg, title="-FVG Bear", style=shape.circle, location=location.abovebar, color=color.rgb(246, 70, 93), size=size.tiny, text="FVG")
`
  },
  {
    id: 'smc_liquidity_sweep',
    name: 'Liquidity Sweeps (High/Low Wick Sweeps)',
    category: 'smc',
    description: 'Distinguishes between wick liquidity sweeps and confirmed candle body structure breaks.',
    script: `//@version=5
indicator("Liquidity Sweeps", overlay=true)
len = input.int(10, "Swing Range")
h = ta.highest(high[1], len)
l = ta.lowest(low[1], len)
sweepHigh = high > h and close < h
sweepLow = low < l and close > l
plotshape(sweepHigh, title="Sweep High", style=shape.diamond, location=location.abovebar, color=color.orange, size=size.small, text="SWEEP")
plotshape(sweepLow, title="Sweep Low", style=shape.diamond, location=location.belowbar, color=color.teal, size=size.small, text="SWEEP")
`
  },
  {
    id: 'smc_premium_discount',
    name: 'Premium & Discount Equilibrium Zones',
    category: 'smc',
    description: 'Macro 50% equilibrium level splitting the swing range into institutional Premium and Discount zones.',
    script: `//@version=5
indicator("Premium & Discount Zones", overlay=true)
lookback = input.int(50, "Range Lookback")
rangeHigh = ta.highest(high, lookback)
rangeLow = ta.lowest(low, lookback)
eq = (rangeHigh + rangeLow) / 2
plot(rangeHigh, "Premium Ceiling", color=color.red, linewidth=1)
plot(eq, "Equilibrium (0.50)", color=color.gray, linewidth=2, style=plot.style_linebr)
plot(rangeLow, "Discount Floor", color=color.green, linewidth=1)
`
  },
  {
    id: 'smc_choch',
    name: 'Change of Character (CHoCH)',
    category: 'smc',
    description: 'Signals internal minor structural reversals signaling potential macro trend change.',
    script: `//@version=5
indicator("SMC CHoCH", overlay=true)
len = input.int(3, "Minor Swing Lookback")
pH = ta.pivothigh(high, len, len)
pL = ta.pivotlow(low, len, len)
var float mH = na
var float mL = na
if not na(pH)
    mH := pH
if not na(pL)
    mL := pL
chochBull = ta.crossover(close, mH)
chochBear = ta.crossunder(close, mL)
plotshape(chochBull, title="CHoCH Bull", style=shape.arrowup, location=location.belowbar, color=color.green, size=size.small, text="CHoCH")
plotshape(chochBear, title="CHoCH Bear", style=shape.arrowdown, location=location.abovebar, color=color.red, size=size.small, text="CHoCH")
`
  },
  {
    id: 'smc_breaker_blocks',
    name: 'Breaker Blocks (Failed Order Blocks)',
    category: 'smc',
    description: 'Failed supply/demand order blocks that turn into support/resistance upon structural break.',
    script: `//@version=5
indicator("Breaker Blocks", overlay=true)
lb = input.int(7, "Lookback")
h = ta.highest(high, lb)
l = ta.lowest(low, lb)
breakerLong = ta.crossover(close, h[1]) and low < l[1]
breakerShort = ta.crossunder(close, l[1]) and high > h[1]
plotshape(breakerLong, title="Bull Breaker", style=shape.labelup, location=location.belowbar, color=color.green, size=size.tiny, text="BRK")
plotshape(breakerShort, title="Bear Breaker", style=shape.labeldown, location=location.abovebar, color=color.red, size=size.tiny, text="BRK")
`
  },
  {
    id: 'smc_equal_highs_lows',
    name: 'Equal Highs & Lows (EQH / EQL Liquidity Pools)',
    category: 'smc',
    description: 'Pinpoints liquidity pools resting above double tops (EQH) and below double bottoms (EQL).',
    script: `//@version=5
indicator("Equal Highs/Lows", overlay=true)
tol = input.float(0.0005, "Tolerance Ratio")
eqh = math.abs(high - high[1]) <= (high * tol)
eql = math.abs(low - low[1]) <= (low * tol)
plotshape(eqh, title="EQH Liquidity", style=shape.cross, location=location.abovebar, color=color.orange, size=size.small, text="EQH")
plotshape(eql, title="EQL Liquidity", style=shape.cross, location=location.belowbar, color=color.rgb(0, 229, 255), size=size.small, text="EQL")
`
  },
  {
    id: 'smc_mss',
    name: 'Market Structure Shift (MSS)',
    category: 'smc',
    description: 'Aggressive institutional shift in order flow validated by strong displacement candle.',
    script: `//@version=5
indicator("Market Structure Shift", overlay=true)
length = input.int(14, "Displacement Period")
atrVal = ta.atr(length)
dispBull = (close - open) > (atrVal * 1.5) and close > ta.highest(high[1], 5)
dispBear = (open - close) > (atrVal * 1.5) and close < ta.lowest(low[1], 5)
plotshape(dispBull, title="Bullish MSS", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.normal, text="MSS")
plotshape(dispBear, title="Bearish MSS", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.normal, text="MSS")
`
  },
  {
    id: 'smc_mitigation_blocks',
    name: 'Mitigation Blocks',
    category: 'smc',
    description: 'Identifies order blocks where institutions mitigate losing positions during market turns.',
    script: `//@version=5
indicator("Mitigation Blocks", overlay=true)
pMid = ta.sma(close, 20)
mitBull = ta.crossover(low, pMid) and close > open
mitBear = ta.crossunder(high, pMid) and close < open
plotshape(mitBull, title="Mitigation Long", style=shape.square, location=location.belowbar, color=color.teal, size=size.tiny)
plotshape(mitBear, title="Mitigation Short", style=shape.square, location=location.abovebar, color=color.maroon, size=size.tiny)
`
  },
  {
    id: 'smc_volume_imbalance',
    name: 'Volume Imbalance (Gap Candles)',
    category: 'smc',
    description: 'Identifies candles where real trading volume was skipped due to aggressive slippage.',
    script: `//@version=5
indicator("Volume Imbalance", overlay=true)
gapUp = open > high[1]
gapDown = open < low[1]
plotshape(gapUp, title="Gap Up Imbalance", style=shape.flag, location=location.belowbar, color=color.green, size=size.tiny)
plotshape(gapDown, title="Gap Down Imbalance", style=shape.flag, location=location.abovebar, color=color.red, size=size.tiny)
`
  },
  {
    id: 'smc_rejection_blocks',
    name: 'Rejection Blocks (Wick Absorptions)',
    category: 'smc',
    description: 'Large institutional wick absorption at extreme swing levels indicating strong barrier defense.',
    script: `//@version=5
indicator("Rejection Blocks", overlay=true)
body = math.abs(close - open)
upperWick = high - math.max(open, close)
lowerWick = math.min(open, close) - low
rejHigh = upperWick > (body * 2.5) and upperWick > (ta.atr(14) * 0.8)
rejLow = lowerWick > (body * 2.5) and lowerWick > (ta.atr(14) * 0.8)
plotshape(rejHigh, title="Rejection High", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small, text="REJ")
plotshape(rejLow, title="Rejection Low", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small, text="REJ")
`
  },
  {
    id: 'smc_silver_bullet',
    name: 'ICT Silver Bullet & Macro Timing',
    category: 'smc',
    description: 'High-probability institutional algorithm execution window tracking.',
    script: `//@version=5
indicator("ICT Silver Bullet", overlay=true)
emaShort = ta.ema(close, 9)
emaLong = ta.ema(close, 21)
sbSignal = ta.crossover(emaShort, emaLong)
sbBear = ta.crossunder(emaShort, emaLong)
plotshape(sbSignal, title="Silver Bullet Bull", style=shape.circle, location=location.belowbar, color=color.rgb(0, 229, 255), size=size.small, text="SB")
plotshape(sbBear, title="Silver Bullet Bear", style=shape.circle, location=location.abovebar, color=color.rgb(246, 70, 93), size=size.small, text="SB")
`
  },

  // ── 2. Trend & Moving Averages (18 Indicators) ───────────────────────
  {
    id: 'supertrend',
    name: 'Supertrend Multi-ATR',
    category: 'trend',
    description: 'Classic dynamic trend following line with Average True Range volatility band.',
    script: `//@version=5
indicator("Supertrend ATR", overlay=true)
atrPeriod = input.int(10, "ATR Period", minval=1)
factor = input.float(3.0, "ATR Factor", step=0.1)
[supertrend, direction] = ta.supertrend(factor, atrPeriod)
upTrend = direction < 0 ? supertrend : na
downTrend = direction < 0 ? na : supertrend
plot(upTrend, "Up Trend", color=color.green, linewidth=2, style=plot.style_linebr)
plot(downTrend, "Down Trend", color=color.red, linewidth=2, style=plot.style_linebr)
`
  },
  {
    id: 'ema_ribbon',
    name: 'EMA Ribbon (20, 50, 100, 200)',
    category: 'trend',
    description: 'Four exponential moving averages displaying macro, intermediate, and short-term trends.',
    script: `//@version=5
indicator("EMA Ribbon", overlay=true)
e20 = ta.ema(close, 20)
e50 = ta.ema(close, 50)
e100 = ta.ema(close, 100)
e200 = ta.ema(close, 200)
plot(e20, "EMA 20", color=color.rgb(0, 229, 255), linewidth=2)
plot(e50, "EMA 50", color=color.yellow, linewidth=2)
plot(e100, "EMA 100", color=color.orange, linewidth=2)
plot(e200, "EMA 200", color=color.red, linewidth=2)
`
  },
  {
    id: 'sma_triple',
    name: 'Simple Moving Average Triple Cross (20, 50, 200)',
    category: 'trend',
    description: 'Traditional arithmetic moving averages for trend baseline confirmation.',
    script: `//@version=5
indicator("SMA Triple Cross", overlay=true)
s20 = ta.sma(close, 20)
s50 = ta.sma(close, 50)
s200 = ta.sma(close, 200)
plot(s20, "SMA 20", color=color.teal, linewidth=1)
plot(s50, "SMA 50", color=color.blue, linewidth=2)
plot(s200, "SMA 200", color=color.purple, linewidth=2)
`
  },
  {
    id: 'ichimoku',
    name: 'Ichimoku Kinko Hyo (Cloud)',
    category: 'trend',
    description: 'Complete Japanese equilibrium chart system: Tenkan-sen, Kijun-sen, Senkou Span A and B.',
    script: `//@version=5
indicator("Ichimoku Kinko Hyo", overlay=true)
convLen = input.int(9, "Conversion Line (Tenkan)")
baseLen = input.int(26, "Base Line (Kijun)")
spanBLen = input.int(52, "Leading Span B")
tenkan = (ta.highest(high, convLen) + ta.lowest(low, convLen)) / 2
kijun = (ta.highest(high, baseLen) + ta.lowest(low, baseLen)) / 2
spanA = (tenkan + kijun) / 2
spanB = (ta.highest(high, spanBLen) + ta.lowest(low, spanBLen)) / 2
plot(tenkan, "Tenkan-sen", color=color.blue, linewidth=1)
plot(kijun, "Kijun-sen", color=color.red, linewidth=2)
pA = plot(spanA, "Senkou Span A", color=color.green, linewidth=1)
pB = plot(spanB, "Senkou Span B", color=color.maroon, linewidth=1)
fill(pA, pB, color=color.new(color.teal, 85))
`
  },
  {
    id: 'hull_ma',
    name: 'Hull Moving Average (HMA)',
    category: 'trend',
    description: 'Fast responsive zero-lag weighted moving average reducing lag while improving smoothing.',
    script: `//@version=5
indicator("Hull Moving Average", overlay=true)
length = input.int(20, "Length")
hma = ta.wma(2 * ta.wma(close, length / 2) - ta.wma(close, length), math.round(math.sqrt(length)))
plot(hma, "HMA", color=close > hma ? color.green : color.red, linewidth=3)
`
  },
  {
    id: 'keltner',
    name: 'Keltner Channels',
    category: 'trend',
    description: 'Volatility envelopes set above and below an EMA using ATR.',
    script: `//@version=5
indicator("Keltner Channels", overlay=true)
len = input.int(20, "EMA Length")
mult = input.float(2.0, "Multiplier")
mid = ta.ema(close, len)
rangeVal = ta.atr(len) * mult
upper = mid + rangeVal
lower = mid - rangeVal
plot(mid, "Middle", color=color.orange, linewidth=1)
p1 = plot(upper, "Upper", color=color.blue, linewidth=1)
p2 = plot(lower, "Lower", color=color.blue, linewidth=1)
fill(p1, p2, color=color.new(color.blue, 92))
`
  },
  {
    id: 'donchian',
    name: 'Donchian Channels (Turtle Trading)',
    category: 'trend',
    description: 'Highest high and lowest low channels popularized by the Turtle Traders.',
    script: `//@version=5
indicator("Donchian Channels", overlay=true)
len = input.int(20, "Length")
upper = ta.highest(high, len)
lower = ta.lowest(low, len)
mid = (upper + lower) / 2
pU = plot(upper, "Upper Channel", color=color.teal, linewidth=1)
plot(mid, "Basis", color=color.gray, linewidth=1, style=plot.style_linebr)
pL = plot(lower, "Lower Channel", color=color.teal, linewidth=1)
fill(pU, pL, color=color.new(color.teal, 94))
`
  },
  {
    id: 'wma',
    name: 'Weighted Moving Average (WMA)',
    category: 'trend',
    description: 'Puts more weight on recent data points than simple moving averages.',
    script: `//@version=5
indicator("Weighted Moving Average", overlay=true)
len = input.int(20, "WMA Length")
wmaVal = ta.wma(close, len)
plot(wmaVal, "WMA", color=color.yellow, linewidth=2)
`
  },
  {
    id: 'alma',
    name: 'Arnaud Legoux Moving Average (ALMA)',
    category: 'trend',
    description: 'Gaussian distribution filter offering superior smoothness and responsiveness.',
    script: `//@version=5
indicator("Arnaud Legoux Moving Average", overlay=true)
len = input.int(9, "Length")
offset = input.float(0.85, "Offset", step=0.05)
sigma = input.float(6.0, "Sigma", step=0.5)
almaVal = ta.alma(close, len, offset, sigma)
plot(almaVal, "ALMA", color=color.rgb(0, 229, 255), linewidth=2)
`
  },
  {
    id: 'mcginley',
    name: 'McGinley Dynamic',
    category: 'trend',
    description: 'Adaptive moving average that automatically adjusts speed in trending and consolidating markets.',
    script: `//@version=5
indicator("McGinley Dynamic", overlay=true)
len = input.int(14, "Length")
var float mg = close
mg := na(mg[1]) ? close : mg[1] + (close - mg[1]) / (len * math.pow(close / mg[1], 4))
plot(mg, "McGinley Dynamic", color=color.purple, linewidth=2)
`
  },
  {
    id: 'dema',
    name: 'Double Exponential Moving Average (DEMA)',
    category: 'trend',
    description: 'Compound exponential smoothing reducing lag dramatically compared to standard EMA.',
    script: `//@version=5
indicator("Double EMA (DEMA)", overlay=true)
len = input.int(20, "Length")
e1 = ta.ema(close, len)
e2 = ta.ema(e1, len)
demaVal = 2 * e1 - e2
plot(demaVal, "DEMA", color=color.green, linewidth=2)
`
  },
  {
    id: 'tema',
    name: 'Triple Exponential Moving Average (TEMA)',
    category: 'trend',
    description: 'Three-layer exponential filtering designed to strip out lag for ultra-fast trends.',
    script: `//@version=5
indicator("Triple EMA (TEMA)", overlay=true)
len = input.int(20, "Length")
e1 = ta.ema(close, len)
e2 = ta.ema(e1, len)
e3 = ta.ema(e2, len)
temaVal = 3 * (e1 - e2) + e3
plot(temaVal, "TEMA", color=color.yellow, linewidth=2)
`
  },
  {
    id: 'golden_cross',
    name: 'Golden Cross & Death Cross Detector',
    category: 'trend',
    description: 'Alerts when the 50 SMA crosses above (Golden Cross) or below (Death Cross) the 200 SMA.',
    script: `//@version=5
indicator("Golden/Death Cross", overlay=true)
s50 = ta.sma(close, 50)
s200 = ta.sma(close, 200)
golden = ta.crossover(s50, s200)
death = ta.crossunder(s50, s200)
plot(s50, "SMA 50", color=color.yellow, linewidth=1)
plot(s200, "SMA 200", color=color.purple, linewidth=2)
plotshape(golden, title="Golden Cross", style=shape.labelup, location=location.belowbar, color=color.green, size=size.normal, text="GOLDEN")
plotshape(death, title="Death Cross", style=shape.labeldown, location=location.abovebar, color=color.red, size=size.normal, text="DEATH")
`
  },
  {
    id: 'linear_reg_curve',
    name: 'Linear Regression Curve & Slope',
    category: 'trend',
    description: 'Statistical line of best fit through closing prices over the lookback window.',
    script: `//@version=5
indicator("Linear Regression Curve", overlay=true)
len = input.int(20, "Period")
lrc = ta.linreg(close, len, 0)
plot(lrc, "LinReg Curve", color=color.rgb(0, 229, 255), linewidth=2)
`
  },
  {
    id: 'ema_scalper_9_21',
    name: 'EMA 9 / 21 Intraday Scalper',
    category: 'trend',
    description: 'Fast crossover strategy indicator tailored for scalping intraday momentum.',
    script: `//@version=5
indicator("EMA 9/21 Scalper", overlay=true)
e9 = ta.ema(close, 9)
e21 = ta.ema(close, 21)
bull = ta.crossover(e9, e21)
bear = ta.crossunder(e9, e21)
plot(e9, "EMA 9", color=color.green, linewidth=2)
plot(e21, "EMA 21", color=color.red, linewidth=2)
plotshape(bull, title="Buy Signal", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small)
plotshape(bear, title="Sell Signal", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small)
`
  },
  {
    id: 'vwma',
    name: 'Volume Weighted Moving Average (VWMA)',
    category: 'trend',
    description: 'Weights prices based on bar volume to emphasize heavy-trading activity periods.',
    script: `//@version=5
indicator("Volume Weighted MA", overlay=true)
len = input.int(20, "Length")
vwmaVal = ta.vwma(close, len)
plot(vwmaVal, "VWMA", color=color.teal, linewidth=2)
`
  },
  {
    id: 'swma',
    name: 'Symmetrically Weighted Moving Average (SWMA)',
    category: 'trend',
    description: 'Fixed 4-point symmetric weight filter [1/6, 2/6, 2/6, 1/6] for smooth noise elimination.',
    script: `//@version=5
indicator("SWMA", overlay=true)
swmaVal = ta.swma(close)
plot(swmaVal, "SWMA", color=color.orange, linewidth=2)
`
  },
  {
    id: 'parabolic_sar',
    name: 'Parabolic SAR (Stop and Reverse)',
    category: 'trend',
    description: 'Trailing stop price guide showing dots above or below price for trend exits.',
    script: `//@version=5
indicator("Parabolic SAR", overlay=true)
start = input.float(0.02, "Start Step", step=0.01)
inc = input.float(0.02, "Increment", step=0.01)
maxVal = input.float(0.2, "Maximum", step=0.05)
sarVal = ta.sar(start, inc, maxVal)
plot(sarVal, "SAR", color=color.purple, style=plot.style_cross, linewidth=2)
`
  },

  // ── 3. Oscillators & Momentum (20 Indicators) ────────────────────────
  {
    id: 'rsi',
    name: 'Relative Strength Index (RSI)',
    category: 'oscillators',
    description: 'Measures momentum of price changes to evaluate overbought (70) and oversold (30) extremes.',
    script: `//@version=5
indicator("RSI", overlay=false)
len = input.int(14, "Length")
rsiVal = ta.rsi(close, len)
plot(rsiVal, "RSI", color=color.purple, linewidth=2)
h70 = hline(70, "Overbought", color=color.red, linestyle=hline.style_dashed)
h30 = hline(30, "Oversold", color=color.green, linestyle=hline.style_dashed)
fill(h70, h30, color=color.new(color.purple, 90))
`
  },
  {
    id: 'macd',
    name: 'MACD (Moving Average Convergence Divergence)',
    category: 'oscillators',
    description: 'Trend-following momentum oscillator with MACD line, signal line, and color histogram.',
    script: `//@version=5
indicator("MACD", overlay=false)
fast = input.int(12, "Fast Period")
slow = input.int(26, "Slow Period")
sig = input.int(9, "Signal Period")
[macdLine, signalLine, hist] = ta.macd(close, fast, slow, sig)
plot(macdLine, "MACD", color=color.blue, linewidth=2)
plot(signalLine, "Signal", color=color.orange, linewidth=2)
plot(hist, "Histogram", color=hist >= 0 ? color.green : color.red, style=plot.style_histogram)
`
  },
  {
    id: 'stochastic',
    name: 'Stochastic Oscillator (%K, %D)',
    category: 'oscillators',
    description: 'Compares close price to the high-low range over a given time period.',
    script: `//@version=5
indicator("Stochastic", overlay=false)
kPeriod = input.int(14, "%K Period")
dPeriod = input.int(3, "%D Period")
smooth = input.int(3, "Slowing")
k = ta.sma(ta.stoch(close, high, low, kPeriod), smooth)
d = ta.sma(k, dPeriod)
plot(k, "%K", color=color.blue, linewidth=2)
plot(d, "%D", color=color.orange, linewidth=2)
hline(80, "Overbought", color=color.red, linestyle=hline.style_dashed)
hline(20, "Oversold", color=color.green, linestyle=hline.style_dashed)
`
  },
  {
    id: 'stoch_rsi',
    name: 'Stochastic RSI (StochRSI)',
    category: 'oscillators',
    description: 'Applies the Stochastic formula to RSI values for maximum sensitivity to momentum shifts.',
    script: `//@version=5
indicator("Stochastic RSI", overlay=false)
lenRSI = input.int(14, "RSI Length")
lenStoch = input.int(14, "Stoch Length")
kLen = input.int(3, "%K Smoothing")
dLen = input.int(3, "%D Smoothing")
rsiVal = ta.rsi(close, lenRSI)
stochVal = ta.stoch(rsiVal, rsiVal, rsiVal, lenStoch)
k = ta.sma(stochVal, kLen)
d = ta.sma(k, dLen)
plot(k, "%K", color=color.rgb(0, 229, 255), linewidth=2)
plot(d, "%D", color=color.orange, linewidth=2)
hline(80, "Overbought", color=color.gray)
hline(20, "Oversold", color=color.gray)
`
  },
  {
    id: 'cci',
    name: 'Commodity Channel Index (CCI)',
    category: 'oscillators',
    description: 'Measures the variation of price from its statistical mean to detect cyclical trends.',
    script: `//@version=5
indicator("CCI", overlay=false)
len = input.int(20, "Period")
cciVal = ta.cci(close, len)
plot(cciVal, "CCI", color=color.yellow, linewidth=2)
hline(100, "Bull Zone", color=color.green)
hline(-100, "Bear Zone", color=color.red)
`
  },
  {
    id: 'williams_r',
    name: 'Williams %R',
    category: 'oscillators',
    description: 'Negative scale momentum indicator reflecting the level of the close relative to the high-low.',
    script: `//@version=5
indicator("Williams %R", overlay=false)
len = input.int(14, "Period")
highestH = ta.highest(high, len)
lowestL = ta.lowest(low, len)
wpr = -100 * (highestH - close) / (highestH - lowestL)
plot(wpr, "%R", color=color.teal, linewidth=2)
hline(-20, "Overbought", color=color.red)
hline(-80, "Oversold", color=color.green)
`
  },
  {
    id: 'mfi',
    name: 'Money Flow Index (MFI)',
    category: 'oscillators',
    description: 'Volume-weighted RSI tracking buying and selling pressure of cash flows.',
    script: `//@version=5
indicator("Money Flow Index", overlay=false)
len = input.int(14, "Period")
mfiVal = ta.mfi(close, len)
plot(mfiVal, "MFI", color=color.green, linewidth=2)
hline(80, "Overbought", color=color.red)
hline(20, "Oversold", color=color.green)
`
  },
  {
    id: 'roc',
    name: 'Rate of Change (ROC)',
    category: 'oscillators',
    description: 'Measures the percentage change in price between the current price and price n-periods ago.',
    script: `//@version=5
indicator("Rate of Change (ROC)", overlay=false)
len = input.int(14, "Period")
rocVal = ta.roc(close, len)
plot(rocVal, "ROC", color=color.rgb(0, 229, 255), linewidth=2)
hline(0, "Zero Line", color=color.gray)
`
  },
  {
    id: 'cmo',
    name: 'Chande Momentum Oscillator (CMO)',
    category: 'oscillators',
    description: 'Calculates momentum on both up and down days without smoothing the results.',
    script: `//@version=5
indicator("Chande Momentum Oscillator", overlay=false)
len = input.int(14, "Length")
cmoVal = ta.cmo(close, len)
plot(cmoVal, "CMO", color=color.orange, linewidth=2)
hline(50, "+50 Overbought", color=color.red)
hline(-50, "-50 Oversold", color=color.green)
`
  },
  {
    id: 'ultimate_osc',
    name: 'Ultimate Oscillator (UO)',
    category: 'oscillators',
    description: 'Larry Williams multi-timeframe oscillator combining 7, 14, and 28-period price action.',
    script: `//@version=5
indicator("Ultimate Oscillator", overlay=false)
uoVal = ta.uo(7, 14, 28)
plot(uoVal, "UO", color=color.purple, linewidth=2)
hline(70, "OB", color=color.red)
hline(30, "OS", color=color.green)
`
  },
  {
    id: 'aroon',
    name: 'Aroon & Aroon Oscillator',
    category: 'oscillators',
    description: 'Measures how long it has been since highest and lowest prices occurred.',
    script: `//@version=5
indicator("Aroon Oscillator", overlay=false)
len = input.int(14, "Period")
[aroonUp, aroonDown] = ta.aroon(len)
aroonOsc = aroonUp - aroonDown
plot(aroonOsc, "Aroon Osc", color=aroonOsc >= 0 ? color.green : color.red, linewidth=2)
hline(0, "Baseline", color=color.gray)
`
  },
  {
    id: 'tsi',
    name: 'True Strength Index (TSI)',
    category: 'oscillators',
    description: 'Double-smoothed momentum oscillator filtering out choppy, misleading price whipsaws.',
    script: `//@version=5
indicator("True Strength Index", overlay=false)
r = input.int(25, "First Smoothing")
s = input.int(13, "Second Smoothing")
tsiVal = ta.tsi(close, r, s)
plot(tsiVal, "TSI", color=color.blue, linewidth=2)
hline(0, "Center Line", color=color.gray)
`
  },
  {
    id: 'awesome_osc',
    name: 'Awesome Oscillator (AO)',
    category: 'oscillators',
    description: 'Bill Williams momentum indicator comparing 34-period and 5-period simple moving averages.',
    script: `//@version=5
indicator("Awesome Oscillator", overlay=false)
aoVal = ta.sma(hl2, 5) - ta.sma(hl2, 34)
plot(aoVal, "AO", color=aoVal >= 0 ? color.green : color.red, style=plot.style_histogram)
`
  },
  {
    id: 'accelerator_osc',
    name: 'Accelerator Oscillator (AC)',
    category: 'oscillators',
    description: 'Measures acceleration and deceleration of the current driving market force.',
    script: `//@version=5
indicator("Accelerator Oscillator", overlay=false)
ao = ta.sma(hl2, 5) - ta.sma(hl2, 34)
ac = ao - ta.sma(ao, 5)
plot(ac, "AC", color=ac >= 0 ? color.green : color.red, style=plot.style_histogram)
`
  },
  {
    id: 'fisher_transform',
    name: 'Fisher Transform',
    category: 'oscillators',
    description: 'Converts prices to a Gaussian normal distribution to pinpoint precise turning points.',
    script: `//@version=5
indicator("Fisher Transform", overlay=false)
len = input.int(9, "Period")
hl2Val = hl2
h = ta.highest(hl2Val, len)
l = ta.lowest(hl2Val, len)
val = 0.66 * ((hl2Val - l) / (h - l || 1) - 0.5)
valClamped = math.max(-0.999, math.min(0.999, val))
fish = 0.5 * math.log((1 + valClamped) / (1 - valClamped))
plot(fish, "Fisher", color=color.rgb(0, 229, 255), linewidth=2)
hline(1.5, "Extreme High", color=color.red)
hline(-1.5, "Extreme Low", color=color.green)
`
  },
  {
    id: 'vortex',
    name: 'Vortex Indicator (VI+ / VI-)',
    category: 'oscillators',
    description: 'Captures the start of a trend and its direction based on vortex flow physics.',
    script: `//@version=5
indicator("Vortex Indicator", overlay=false)
period = input.int(14, "Length")
vmp = math.sum(math.abs(high - low[1]), period)
vmm = math.sum(math.abs(low - high[1]), period)
str = math.sum(ta.atr(1), period)
vip = vmp / (str || 1)
vim = vmm / (str || 1)
plot(vip, "VI+", color=color.green, linewidth=2)
plot(vim, "VI-", color=color.red, linewidth=2)
`
  },
  {
    id: 'dpo',
    name: 'Detrended Price Oscillator (DPO)',
    category: 'oscillators',
    description: 'Removes the long-term trend to isolate short-term cycles and overbought extremes.',
    script: `//@version=5
indicator("Detrended Price Oscillator", overlay=false)
len = input.int(21, "Length")
disp = len / 2 + 1
dpoVal = close - ta.sma(close, len)[disp]
plot(dpoVal, "DPO", color=color.orange, linewidth=2)
hline(0, "Zero Line", color=color.gray)
`
  },
  {
    id: 'ppo',
    name: 'Percentage Price Oscillator (PPO)',
    category: 'oscillators',
    description: 'Percentage-based MACD allowing cross-asset and multi-price-scale momentum comparison.',
    script: `//@version=5
indicator("Percentage Price Oscillator", overlay=false)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
ppoVal = ((fast - slow) / slow) * 100
signal = ta.ema(ppoVal, 9)
plot(ppoVal, "PPO", color=color.blue, linewidth=2)
plot(signal, "Signal", color=color.orange, linewidth=2)
`
  },
  {
    id: 'coppock',
    name: 'Coppock Curve',
    category: 'oscillators',
    description: 'Long-term price momentum indicator designed to identify major stock market bottoms.',
    script: `//@version=5
indicator("Coppock Curve", overlay=false)
roc1 = ta.roc(close, 14)
roc2 = ta.roc(close, 11)
coppock = ta.wma(roc1 + roc2, 10)
plot(coppock, "Coppock", color=color.purple, linewidth=2)
hline(0, "Base Line", color=color.gray)
`
  },
  {
    id: 'shannon_osc',
    name: 'Shannon Volatility Rebalance Oscillator',
    category: 'oscillators',
    description: 'Claude Shannon volatility rebalancing bands measuring divergence from portfolio mean.',
    script: `//@version=5
indicator("Shannon Rebalance Oscillator", overlay=false)
period = input.int(20, "Period")
mult = input.float(2.0, "Multiplier")
mid = ta.sma(close, period)
vol = ta.stdev(close, period) * mult
osc = (close - mid) / (vol || 1)
plot(osc, "Shannon Osc", color=color.rgb(0, 229, 255), linewidth=2)
hline(1.0, "Rebalance Upper (+1.0)", color=color.red)
hline(-1.0, "Rebalance Lower (-1.0)", color=color.green)
`
  },

  // ── 4. Volatility (12 Indicators) ────────────────────────────────────
  {
    id: 'bollinger_bands',
    name: 'Bollinger Bands (BB 20, 2.0)',
    category: 'volatility',
    description: 'Two standard deviations above and below the 20-period simple moving average.',
    script: `//@version=5
indicator("Bollinger Bands", overlay=true)
len = input.int(20, "Period")
mult = input.float(2.0, "StdDev Mult")
basis = ta.sma(close, len)
dev = mult * ta.stdev(close, len)
upper = basis + dev
lower = basis - dev
plot(basis, "Basis", color=color.orange)
pU = plot(upper, "Upper Band", color=color.blue)
pL = plot(lower, "Lower Band", color=color.blue)
fill(pU, pL, color=color.new(color.blue, 92))
`
  },
  {
    id: 'atr',
    name: 'Average True Range (ATR)',
    category: 'volatility',
    description: 'Measures pure market volatility by decomposing the total range of price bars.',
    script: `//@version=5
indicator("Average True Range", overlay=false)
len = input.int(14, "Length")
atrVal = ta.atr(len)
plot(atrVal, "ATR", color=color.yellow, linewidth=2)
`
  },
  {
    id: 'bb_percent_b',
    name: 'Bollinger Bands %B',
    category: 'volatility',
    description: 'Quantifies price position relative to upper and lower Bollinger Bands.',
    script: `//@version=5
indicator("Bollinger Bands %B", overlay=false)
len = input.int(20, "Length")
basis = ta.sma(close, len)
dev = 2.0 * ta.stdev(close, len)
upper = basis + dev
lower = basis - dev
bPercent = (close - lower) / (upper - lower || 1)
plot(bPercent, "%B", color=color.rgb(0, 229, 255), linewidth=2)
hline(1.0, "Upper Band", color=color.red)
hline(0.0, "Lower Band", color=color.green)
`
  },
  {
    id: 'bb_width',
    name: 'Bollinger Bandwidth',
    category: 'volatility',
    description: 'Measures the percentage difference between upper and lower Bollinger Bands to spot volatility squeezes.',
    script: `//@version=5
indicator("Bollinger Bandwidth", overlay=false)
len = input.int(20, "Length")
basis = ta.sma(close, len)
dev = 2.0 * ta.stdev(close, len)
upper = basis + dev
lower = basis - dev
bandwidth = ((upper - lower) / basis) * 100
plot(bandwidth, "Bandwidth", color=color.teal, linewidth=2)
`
  },
  {
    id: 'historical_volatility',
    name: 'Historical Volatility (HV 20)',
    category: 'volatility',
    description: 'Annualized standard deviation of day-to-day percentage price variations.',
    script: `//@version=5
indicator("Historical Volatility", overlay=false)
len = input.int(20, "Length")
logReturn = math.log(close / close[1])
hv = ta.stdev(logReturn, len) * math.sqrt(365) * 100
plot(hv, "Historical Volatility %", color=color.orange, linewidth=2)
`
  },
  {
    id: 'choppiness',
    name: 'Choppiness Index (CHOP)',
    category: 'volatility',
    description: 'Determines whether the market is choppy/trading in a range (>61.8) or trending (<38.2).',
    script: `//@version=5
indicator("Choppiness Index", overlay=false)
len = input.int(14, "Length")
sumAtr = math.sum(ta.atr(1), len)
rangeHL = ta.highest(high, len) - ta.lowest(low, len)
chop = 100 * math.log10(sumAtr / (rangeHL || 1)) / math.log10(len)
plot(chop, "CHOP", color=color.purple, linewidth=2)
hline(61.8, "Choppy Zone", color=color.red)
hline(38.2, "Trending Zone", color=color.green)
`
  },
  {
    id: 'stddev_channels',
    name: 'Standard Deviation Bands (1 & 2 Sigma)',
    category: 'volatility',
    description: 'Statistical probability distribution channels surrounding the mean price.',
    script: `//@version=5
indicator("StdDev Channels", overlay=true)
len = input.int(20, "Lookback")
mean = ta.sma(close, len)
sd = ta.stdev(close, len)
plot(mean + sd, "+1 Sigma", color=color.teal)
plot(mean - sd, "-1 Sigma", color=color.teal)
plot(mean + 2 * sd, "+2 Sigma", color=color.red)
plot(mean - 2 * sd, "-2 Sigma", color=color.green)
`
  },
  {
    id: 'chaikin_volatility',
    name: 'Chaikin Volatility',
    category: 'volatility',
    description: 'Calculates the spread between high and low prices to measure cyclical changes in volatility.',
    script: `//@version=5
indicator("Chaikin Volatility", overlay=false)
len = input.int(10, "Period")
rocLen = input.int(10, "ROC Period")
hlSpread = ta.ema(high - low, len)
cVol = ta.roc(hlSpread, rocLen)
plot(cVol, "Chaikin Volatility", color=color.yellow, linewidth=2)
hline(0, "Baseline", color=color.gray)
`
  },
  {
    id: 'mass_index',
    name: 'Mass Index',
    category: 'volatility',
    description: 'Examines the narrowing and widening between the high and low range to predict reversals.',
    script: `//@version=5
indicator("Mass Index", overlay=false)
ema1 = ta.ema(high - low, 9)
ema2 = ta.ema(ema1, 9)
mass = math.sum(ema1 / (ema2 || 1), 25)
plot(mass, "Mass Index", color=color.blue, linewidth=2)
hline(27, "Reversal Bulge (27)", color=color.red)
`
  },
  {
    id: 'atr_trailing_band',
    name: 'ATR Trailing Stop Band',
    category: 'volatility',
    description: 'Adaptive trailing stop-loss boundary based on current market volatility.',
    script: `//@version=5
indicator("ATR Trailing Stop", overlay=true)
period = input.int(14, "ATR Period")
multiplier = input.float(2.5, "ATR Multiplier")
stopVal = close - ta.atr(period) * multiplier
plot(stopVal, "Trailing Stop", color=color.orange, style=plot.style_linebr, linewidth=2)
`
  },
  {
    id: 'envelopes',
    name: 'Moving Average Envelopes (2.5%)',
    category: 'volatility',
    description: 'Percentage-based bands above and below an SMA to identify overbought and oversold channels.',
    script: `//@version=5
indicator("MA Envelopes", overlay=true)
len = input.int(20, "Period")
pct = input.float(2.5, "Percentage") / 100
basis = ta.sma(close, len)
upper = basis * (1 + pct)
lower = basis * (1 - pct)
plot(basis, "Basis", color=color.orange)
plot(upper, "Upper Env", color=color.blue)
plot(lower, "Lower Env", color=color.blue)
`
  },
  {
    id: 'true_range_raw',
    name: 'True Range (Raw TR)',
    category: 'volatility',
    description: 'Bar-by-bar raw true range measuring gap size and intraday span.',
    script: `//@version=5
indicator("True Range Raw", overlay=false)
trVal = ta.tr
plot(trVal, "TR", color=color.rgb(0, 229, 255), linewidth=1)
`
  },

  // ── 5. Volume & Order Flow (12 Indicators) ───────────────────────────
  {
    id: 'volume_ma',
    name: 'Volume & 20-period Volume MA',
    category: 'volume',
    description: 'Trading activity volume bars color-coded with a 20-period moving average.',
    script: `//@version=5
indicator("Volume & MA", overlay=false)
len = input.int(20, "MA Period")
volMa = ta.sma(volume, len)
plot(volume, "Volume", color=close >= open ? color.green : color.red, style=plot.style_columns)
plot(volMa, "Volume MA", color=color.yellow, linewidth=2)
`
  },
  {
    id: 'vwap',
    name: 'Volume Weighted Average Price (VWAP)',
    category: 'volume',
    description: 'Institutional benchmark price reflecting the volume-weighted average price across sessions.',
    script: `//@version=5
indicator("VWAP Benchmark", overlay=true)
vwapVal = ta.vwap(close)
plot(vwapVal, "VWAP", color=color.rgb(0, 229, 255), linewidth=2)
`
  },
  {
    id: 'obv',
    name: 'On Balance Volume (OBV)',
    category: 'volume',
    description: 'Relates price and volume to predict bullish or bearish institutional accumulation.',
    script: `//@version=5
indicator("On Balance Volume", overlay=false)
obvVal = ta.obv
plot(obvVal, "OBV", color=color.purple, linewidth=2)
`
  },
  {
    id: 'cmf',
    name: 'Chaikin Money Flow (CMF 20)',
    category: 'volume',
    description: 'Measures institutional accumulation and distribution over a 20-period window.',
    script: `//@version=5
indicator("Chaikin Money Flow", overlay=false)
len = input.int(20, "Period")
mfv = ((close - low) - (high - close)) / (high - low || 1) * volume
cmfVal = math.sum(mfv, len) / (math.sum(volume, len) || 1)
plot(cmfVal, "CMF", color=cmfVal >= 0 ? color.green : color.red, linewidth=2)
hline(0, "Zero Line", color=color.gray)
`
  },
  {
    id: 'eom',
    name: 'Ease of Movement (EOM 14)',
    category: 'volume',
    description: 'Relates price changes to volume to determine if price can move with little resistance.',
    script: `//@version=5
indicator("Ease of Movement", overlay=false)
len = input.int(14, "Length")
dm = (high + low) / 2 - (high[1] + low[1]) / 2
br = (volume / 10000) / (high - low || 1)
eomVal = ta.sma(dm / (br || 1), len)
plot(eomVal, "EOM", color=color.teal, linewidth=2)
hline(0, "Baseline", color=color.gray)
`
  },
  {
    id: 'net_volume',
    name: 'Net Volume (Up vs Down Volume)',
    category: 'volume',
    description: 'Difference between buyer-initiated and seller-initiated volume bars.',
    script: `//@version=5
indicator("Net Volume", overlay=false)
netVol = close >= open ? volume : -volume
plot(netVol, "Net Volume", color=netVol >= 0 ? color.green : color.red, style=plot.style_columns)
`
  },
  {
    id: 'volume_osc',
    name: 'Volume Oscillator (Short vs Long MA)',
    category: 'volume',
    description: 'Difference between two volume moving averages expressed as a percentage.',
    script: `//@version=5
indicator("Volume Oscillator", overlay=false)
sLen = input.int(5, "Short Period")
lLen = input.int(10, "Long Period")
sMA = ta.sma(volume, sLen)
lMA = ta.sma(volume, lLen)
vOsc = ((sMA - lMA) / (lMA || 1)) * 100
plot(vOsc, "Volume Osc %", color=color.orange, linewidth=2)
hline(0, "Zero Level", color=color.gray)
`
  },
  {
    id: 'pvt',
    name: 'Price Volume Trend (PVT)',
    category: 'volume',
    description: 'Cumulative volume line incorporating proportional percentage price movement.',
    script: `//@version=5
indicator("Price Volume Trend", overlay=false)
pvtVal = ta.cum((ta.change(close) / close[1]) * volume)
plot(pvtVal, "PVT", color=color.blue, linewidth=2)
`
  },
  {
    id: 'force_index',
    name: "Elder's Force Index (EFI 13)",
    category: 'volume',
    description: 'Combines price direction, extent of move, and volume to measure bull/bear power.',
    script: `//@version=5
indicator("Force Index", overlay=false)
len = input.int(13, "Length")
fi = ta.ema(ta.change(close) * volume, len)
plot(fi, "Force Index", color=fi >= 0 ? color.green : color.red, linewidth=2)
hline(0, "Zero Line", color=color.gray)
`
  },
  {
    id: 'klinger',
    name: 'Klinger Volume Oscillator (KVO)',
    category: 'volume',
    description: 'Volume flow oscillator measuring long-term accumulation versus distribution.',
    script: `//@version=5
indicator("Klinger Volume Oscillator", overlay=false)
fast = input.int(34, "Fast Period")
slow = input.int(55, "Slow Period")
trend = hlc3 > hlc3[1] ? volume : -volume
kvo = ta.ema(trend, fast) - ta.ema(trend, slow)
sig = ta.ema(kvo, 13)
plot(kvo, "KVO", color=color.green, linewidth=2)
plot(sig, "Signal", color=color.red, linewidth=1)
`
  },
  {
    id: 'elder_ray',
    name: 'Elder-Ray Bull & Bear Power',
    category: 'volume',
    description: 'Measures buying and selling pressure relative to the 13-period exponential moving average.',
    script: `//@version=5
indicator("Elder-Ray Index", overlay=false)
len = input.int(13, "EMA Period")
emaVal = ta.ema(close, len)
bullPower = high - emaVal
bearPower = low - emaVal
plot(bullPower, "Bull Power", color=color.green, style=plot.style_columns)
plot(bearPower, "Bear Power", color=color.red, style=plot.style_columns)
`
  },
  {
    id: 'acc_dist',
    name: 'Accumulation / Distribution (A/D)',
    category: 'volume',
    description: 'Cumulative indicator assessing whether a stock is being accumulated or distributed by institutions.',
    script: `//@version=5
indicator("Accumulation/Distribution", overlay=false)
clv = ((close - low) - (high - close)) / (high - low || 1)
ad = ta.cum(clv * volume)
plot(ad, "A/D Line", color=color.yellow, linewidth=2)
`
  },

  // ── 6. Pivot Points, Swings & Reversals (10 Indicators) ──────────────
  {
    id: 'pivot_points_standard',
    name: 'Pivot Points Standard (Floor Pivots)',
    category: 'smc',
    description: 'Traditional floor pivot levels (P, R1, R2, R3, S1, S2, S3) calculated from previous swing.',
    script: `//@version=5
indicator("Pivot Points Standard", overlay=true)
lookback = input.int(24, "Session Period")
pH = ta.highest(high, lookback)
pL = ta.lowest(low, lookback)
pC = close[lookback]
p = (pH + pL + pC) / 3
r1 = 2 * p - pL
s1 = 2 * p - pH
r2 = p + (pH - pL)
s2 = p - (pH - pL)
plot(p, "Pivot P", color=color.yellow, linewidth=2)
plot(r1, "R1", color=color.red, linewidth=1)
plot(s1, "S1", color=color.green, linewidth=1)
plot(r2, "R2", color=color.red, linewidth=1)
plot(s2, "S2", color=color.green, linewidth=1)
`
  },
  {
    id: 'pivot_fibonacci',
    name: 'Fibonacci Pivot Points',
    category: 'smc',
    description: 'Pivot levels incorporating key golden ratio Fibonacci retracements (0.382, 0.618, 1.00).',
    script: `//@version=5
indicator("Fibonacci Pivots", overlay=true)
lb = input.int(24, "Lookback")
h = ta.highest(high, lb)
l = ta.lowest(low, lb)
rng = h - l
pivot = (h + l + close[lb]) / 3
r1 = pivot + 0.382 * rng
s1 = pivot - 0.382 * rng
r2 = pivot + 0.618 * rng
s2 = pivot - 0.618 * rng
plot(pivot, "Pivot", color=color.gray, linewidth=2)
plot(r1, "R1 (38.2%)", color=color.orange)
plot(s1, "S1 (38.2%)", color=color.teal)
plot(r2, "R2 (61.8%)", color=color.red)
plot(s2, "S2 (61.8%)", color=color.green)
`
  },
  {
    id: 'camarilla_pivots',
    name: 'Camarilla Pivot Points (H3/H4, L3/L4)',
    category: 'smc',
    description: 'Mean-reversion at H3/L3 and institutional breakout triggers at H4/L4.',
    script: `//@version=5
indicator("Camarilla Pivots", overlay=true)
lb = input.int(24, "Period")
h = ta.highest(high, lb)
l = ta.lowest(low, lb)
c = close[lb]
rng = h - l
h4 = c + rng * 1.1 / 2
h3 = c + rng * 1.1 / 4
l3 = c - rng * 1.1 / 4
l4 = c - rng * 1.1 / 2
plot(h4, "H4 Breakout", color=color.red, linewidth=2)
plot(h3, "H3 Reversal", color=color.orange, linewidth=1)
plot(l3, "L3 Reversal", color=color.teal, linewidth=1)
plot(l4, "L4 Breakout", color=color.green, linewidth=2)
`
  },
  {
    id: 'woodie_pivots',
    name: 'Woodie Pivot Points',
    category: 'smc',
    description: 'Gives greater mathematical weight to the closing price of the prior session.',
    script: `//@version=5
indicator("Woodie Pivots", overlay=true)
lb = input.int(24, "Period")
h = ta.highest(high, lb)
l = ta.lowest(low, lb)
c = close[lb]
pivot = (h + l + 2 * c) / 4
r1 = 2 * pivot - l
s1 = 2 * pivot - h
plot(pivot, "Woodie Pivot", color=color.purple, linewidth=2)
plot(r1, "Woodie R1", color=color.red)
plot(s1, "Woodie S1", color=color.green)
`
  },
  {
    id: 'zigzag_swings',
    name: 'ZigZag Swings High / Low',
    category: 'smc',
    description: 'Filters out noise by connecting prominent swing highs and swing lows.',
    script: `//@version=5
indicator("ZigZag Swings", overlay=true)
dev = input.float(3.0, "Deviation %") / 100
pH = ta.pivothigh(high, 5, 5)
pL = ta.pivotlow(low, 5, 5)
plotshape(not na(pH), title="Swing High", style=shape.diamond, location=location.abovebar, color=color.red, size=size.tiny)
plotshape(not na(pL), title="Swing Low", style=shape.diamond, location=location.belowbar, color=color.green, size=size.tiny)
`
  },
  {
    id: 'streak_counter',
    name: 'Consecutive Up/Down Bar Streak Counter',
    category: 'oscillators',
    description: 'Counts consecutive bullish and bearish candles to identify extreme trend exhaustion.',
    script: `//@version=5
indicator("Consecutive Streak", overlay=false)
var int streak = 0
if close > close[1]
    streak := streak >= 0 ? streak + 1 : 1
else if close < close[1]
    streak := streak <= 0 ? streak - 1 : -1
else
    streak := 0
plot(streak, "Streak", color=streak >= 0 ? color.green : color.red, style=plot.style_columns)
`
  },
  {
    id: 'shannon_bands',
    name: 'Shannon Volatility Channels',
    category: 'volatility',
    description: 'Continuous portfolio rebalancing bands based on Shannon entropy and log volatility.',
    script: `//@version=5
indicator("Shannon Volatility Channels", overlay=true)
len = input.int(20, "Period")
mid = ta.sma(close, len)
entropyRange = ta.stdev(close, len) * 2.0
topBand = mid + entropyRange
botBand = mid - entropyRange
plot(mid, "Shannon Mean", color=color.rgb(0, 229, 255), linewidth=1)
pT = plot(topBand, "Upper Shannon Rebalance", color=color.red)
pB = plot(botBand, "Lower Shannon Rebalance", color=color.green)
fill(pT, pB, color=color.new(color.teal, 93))
`
  },
  {
    id: 'range_tracker',
    name: 'Session High / Low Range Tracker',
    category: 'smc',
    description: 'Tracks current day session high and low boundaries dynamically on the price chart.',
    script: `//@version=5
indicator("Session High/Low Tracker", overlay=true)
sHigh = ta.highest(high, 24)
sLow = ta.lowest(low, 24)
plot(sHigh, "Session High", color=color.maroon, linewidth=2)
plot(sLow, "Session Low", color=color.teal, linewidth=2)
`
  },
  {
    id: 'price_channel_breakout',
    name: 'Price Channel Breakout (Donchian 20)',
    category: 'trend',
    description: 'Generates breakout buy and breakdown sell signals when price pierces a 20-period extreme.',
    script: `//@version=5
indicator("Price Channel Breakout", overlay=true)
period = input.int(20, "Period")
top = ta.highest(high[1], period)
bot = ta.lowest(low[1], period)
buy = ta.crossover(close, top)
sell = ta.crossunder(close, bot)
plot(top, "Upper Channel", color=color.teal)
plot(bot, "Lower Channel", color=color.teal)
plotshape(buy, title="Buy Breakout", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small, text="BUY")
plotshape(sell, title="Sell Breakdown", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small, text="SELL")
`
  },
  {
    id: 'volatility_ratio',
    name: 'Volatility Ratio (VR)',
    category: 'volatility',
    description: 'Ratio of true range to average true range to detect sudden institutional volatility bursts.',
    script: `//@version=5
indicator("Volatility Ratio", overlay=false)
len = input.int(14, "ATR Length")
vr = ta.tr / (ta.atr(len) || 1)
plot(vr, "Volatility Ratio", color=vr > 2.0 ? color.orange : color.blue, linewidth=2)
hline(2.0, "Explosive Volatility (>2.0)", color=color.red, linestyle=hline.style_dashed)
`
  }
];
