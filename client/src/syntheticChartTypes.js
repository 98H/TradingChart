// client/src/syntheticChartTypes.js
// Synthetic chart-type engine for TradingChart — TradingView-parity non-time-based
// series (Renko, Kagi, Line Break, Point & Figure, Range, Hollow & Volume-adjusted
// candles). Vela renders only time-based bars natively, so these types are computed
// client-side from the real OHLC stream and injected as synthetic series. All
// algorithms follow the canonical constructions (TradingView / classical TA).

// ── helpers ────────────────────────────────────────────────────────────────
export function defaultBoxSize(bars) {
  // TradingView 'traditional' auto box: ATR of the window, anchored to a round grid.
  if (!bars || bars.length < 2) return 1;
  let sum = 0;
  const n = Math.min(bars.length, 200);
  for (let i = bars.length - n; i < bars.length; i++) {
    const b = bars[i], p = bars[i - 1] || b;
    sum += Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close));
  }
  let atr = sum / n;
  if (!(atr > 0)) return 1;
  // Snap to a 1/2/5 × 10^k grid so boxes align to psychologically round prices,
  // like TradingView's traditional box assignment.
  const mag = Math.pow(10, Math.floor(Math.log10(atr)));
  const norm = atr / mag;
  const snapped = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return snapped * mag;
}

// ── Renko (classic, wickless bricks, absolute-grid anchored) ───────────────
export function toRenko(bars, boxSize) {
  const box = boxSize || defaultBoxSize(bars);
  if (!bars.length || box <= 0) return [];
  const out = [];
  let lastClose = Math.round(bars[0].close / box) * box; // anchored to absolute grid
  for (const b of bars) {
    let guard = 0;
    const move = b.close - lastClose;
    const steps = Math.floor(Math.abs(move) / box);
    if (steps <= 0) continue;
    const dir = move > 0 ? 1 : -1;
    const vol = (b.volume || 0) / steps;
    while (guard++ < steps && guard < 2000) {
      const open = lastClose;
      const close = lastClose + dir * box;
      out.push({ time: b.time, open, high: Math.max(open, close), low: Math.min(open, close), close, volume: vol });
      lastClose = close;
    }
  }
  return out;
}

// ── Kagi (thickness flips on reversal >= reversalAmount; horizontal on break of swing) ──
export function toKagi(bars, reversalAmount) {
  const rev = reversalAmount || defaultBoxSize(bars) * 2;
  if (!bars.length || rev <= 0) return [];
  const out = [];
  let direction = 0;           // +1 up, -1 down
  let linePrice = bars[0].close;
  let swingHigh = linePrice, swingLow = linePrice;
  let bar = { time: bars[0].time, open: linePrice, high: linePrice, low: linePrice, close: linePrice, volume: 0 };

  for (const b of bars) {
    const c = b.close;
    if (direction >= 0) {
      if (c > linePrice) { linePrice = c; swingHigh = Math.max(swingHigh, c); }
      else if (linePrice - c >= rev) { direction = -1; swingLow = c; linePrice = c; }
    }
    if (direction <= 0) {
      if (c < linePrice) { linePrice = c; swingLow = Math.min(swingLow, c); }
      else if (c - linePrice >= rev) { direction = 1; swingHigh = c; linePrice = c; }
    }
    const yin = swingHigh - swingLow >= rev ? 1 : 0;
    bar = {
      time: b.time,
      open: bar.close,
      high: Math.max(bar.close, linePrice),
      low: Math.min(bar.close, linePrice),
      close: linePrice,
      volume: b.volume || 0,
      // thickness encoded for consumers: yang (thick) when price beyond prior swing
      _yang: direction === 1 && linePrice > swingHigh - rev ? 1 : yin
    };
    out.push({ ...bar });
  }
  return out;
}

// ── Line Break (3-line) ────────────────────────────────────────────────────
export function toLineBreak(bars, lines = 3) {
  if (!bars.length) return [];
  const out = [];
  const closes = [];
  for (const b of bars) {
    const c = b.close;
    if (closes.length < lines) {
      const prev = closes.length ? closes[closes.length - 1] : c;
      closes.push(c);
      out.push({ time: b.time, open: prev, high: Math.max(prev, c), low: Math.min(prev, c), close: c, volume: b.volume });
      continue;
    }
    const last = closes[closes.length - 1];
    const lowest = Math.min(...closes.slice(-lines));
    const highest = Math.max(...closes.slice(-lines));
    if (c > highest || c < lowest) {
      closes.push(c);
      out.push({ time: b.time, open: last, high: Math.max(last, c), low: Math.min(last, c), close: c, volume: b.volume });
    }
    // else: no new line (classic line-break rule)
  }
  return out;
}

// ── Range bars (fixed price range per bar) ─────────────────────────────────
export function toRangeBars(bars, rangeSize) {
  const r = rangeSize || defaultBoxSize(bars);
  if (!bars.length || r <= 0) return [];
  const out = [];
  let open = bars[0].open;
  let low = open, high = open;
  for (const b of bars) {
    let c = b.close;
    let guard = 0;
    while (guard++ < 500) {
      // if close would exceed range, print a bar pinned at the boundary and roll over
      if (c - low > r) {
        out.push({ time: b.time, open, high: low + r, low, close: low + r, volume: b.volume });
        open = low + r; low = open; high = open;
        continue;
      }
      if (high - c > r) {
        out.push({ time: b.time, open, high, low: high - r, close: high - r, volume: b.volume });
        open = high - r; low = open; high = open;
        continue;
      }
      high = Math.max(high, c);
      low = Math.min(low, c);
      if (high - low >= r) {
        out.push({ time: b.time, open, high, low, close: c, volume: b.volume });
        open = c; low = c; high = c;
        continue;
      }
      break;
    }
  }
  return out;
}

// ── Point & Figure (rendered as wickless step bars) ────────────────────────
export function toPnF(bars, boxSize, reversal = 3) {
  const box = boxSize || defaultBoxSize(bars);
  if (!bars.length || box <= 0) return [];
  const out = [];
  let col = Math.round(bars[0].close / box);   // current column extreme (in boxes)
  let dir = 0;
  for (const b of bars) {
    const c = Math.round(b.close / box);
    if (dir >= 0) {
      if (c > col) {
        for (let k = col + 1; k <= c; k++) out.push({ time: b.time, open: (k - 1) * box, high: k * box, low: (k - 1) * box, close: k * box, volume: 0 });
        col = c;
      } else if (col - c >= reversal) {
        dir = -1;
        for (let k = col - 1; k >= c; k--) out.push({ time: b.time, open: (k + 1) * box, high: (k + 1) * box, low: k * box, close: k * box, volume: 0 });
        col = c;
      }
    }
    if (dir <= 0) {
      if (c < col) {
        for (let k = col - 1; k >= c; k--) out.push({ time: b.time, open: (k + 1) * box, high: (k + 1) * box, low: k * box, close: k * box, volume: 0 });
        col = c;
      } else if (c - col >= reversal) {
        dir = 1;
        for (let k = col + 1; k <= c; k++) out.push({ time: b.time, open: (k - 1) * box, high: k * box, low: (k - 1) * box, close: k * box, volume: 0 });
        col = c;
      }
    }
  }
  return out;
}

// ── Hollow candles (same data, filled only when close > prior close) ───────
// Hollow candles are a *style* — Vela's candle renderer colors by direction; we
// emulate by adjusting open so down-after-up bars render hollow: encode as
// metadata the style layer can use; the series itself stays time-based.
export function toHollow(bars) {
  return bars.map((b, i) => {
    const prev = i > 0 ? bars[i - 1].close : b.open;
    return { ...b, _hollow: b.close > prev, _upBar: b.close >= b.open };
  });
}

// ── Volume candles (body width ∝ volume) — time-based, pass-through with meta ──
export function toVolumeCandles(bars) {
  const maxV = Math.max(...bars.map(b => b.volume || 0), 1);
  return bars.map(b => ({ ...b, _volWidth: (b.volume || 0) / maxV }));
}

export const SYNTHETIC_TYPES = {
  renko: { fn: toRenko, name: 'Renko', fa: 'رنکو' },
  kagi: { fn: toKagi, name: 'Kagi', fa: 'کاگی' },
  linebreak: { fn: toLineBreak, name: 'Line Break', fa: 'لاین‌بریک' },
  range: { fn: toRangeBars, name: 'Range Bars', fa: 'رنج‌بار' },
  pnf: { fn: toPnF, name: 'Point & Figure', fa: 'پوینت و فیگور' },
  hollow: { fn: toHollow, name: 'Hollow Candles', fa: 'کندل توخالی' },
  volumecandles: { fn: toVolumeCandles, name: 'Volume Candles', fa: 'کندل حجمی' },
};
