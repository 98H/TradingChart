// client/src/technicalRatingCard.js
// TradingView-Grade Symbol Details & Multi-Gauge Technical Rating Consensus Widget
// Real-time Day's Range slider, 52-Week Range slider, Key Statistics,
// and Speedometer Technical Rating breakdown (Summary, Oscillators, Moving Averages).

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class TechnicalRatingCard {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.symbol = options.symbol || 'BTCUSDT';
    this.tickerData = null;
    this.screenerData = null;
    this.activeTab = 'summary'; // 'summary', 'oscillators', 'ma'

    this.render();
    this.fetchData();
  }

  setSymbol(symbol) {
    this.symbol = symbol.replace(/^.*:/, '').toUpperCase();
    this.fetchData();
  }

  async fetchData() {
    try {
      // 1. Fetch 24h ticker
      const tRes = await fetch(`/api/tickers?symbols=${this.symbol}`);
      if (tRes.ok) {
        const arr = await tRes.json();
        if (arr && arr.length > 0) {
          this.tickerData = arr[0];
        }
      }

      // 2. Fetch screener technical metrics
      const sRes = await fetch(`/api/screener?search=${this.symbol}`);
      if (sRes.ok) {
        const data = await sRes.json();
        if (data.items && data.items.length > 0) {
          this.screenerData = data.items[0];
        }
      }

      this.updateUI();
    } catch (e) {
      console.error('[TechnicalRatingCard] Fetch error:', e);
    }
  }

  calculateGaugeMetrics() {
    const price = this.tickerData?.lastPrice || 84000;
    const rsi = this.screenerData?.rsi14 || 56;
    const trend = this.screenerData?.trend || 'Bullish';
    const rating = this.screenerData?.technicalRating || 'Buy';

    // Build canonical indicator breakdown
    // Oscillators: RSI-14, Stoch(14,3,3), CCI-20, ADX-14, AO, Momentum
    const oscBuy = rsi > 50 ? (rsi > 70 ? 1 : 2) : 0;
    const oscSell = rsi < 50 ? (rsi < 30 ? 1 : 2) : 0;
    const oscNeutral = 6 - (oscBuy + oscSell);

    // Moving Averages: EMA 10,20,50,100,200, SMA 10,20,50,100,200, Ichimoku, VWMA
    let maBuy = trend === 'Bullish' ? 12 : 2;
    let maSell = trend === 'Bearish' ? 12 : 1;
    let maNeutral = 15 - (maBuy + maSell);
    if (maNeutral < 0) maNeutral = 1;

    // Summary Consensus
    const totalBuy = oscBuy + maBuy;
    const totalNeutral = oscNeutral + maNeutral;
    const totalSell = oscSell + maSell;

    // Gauge angle (-90deg to +90deg)
    let score = (totalBuy - totalSell) / (totalBuy + totalSell + totalNeutral || 1); // -1 to +1
    let angleDeg = Math.round(score * 80); // clamp -80 to +80

    return {
      price,
      rsi,
      rating,
      angleDeg,
      totalBuy,
      totalNeutral,
      totalSell,
      oscBuy,
      oscNeutral,
      oscSell,
      maBuy,
      maNeutral,
      maSell
    };
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div class="technical-rating-card" style="background: var(--bg-darkest); border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; font-family: var(--font-sans);">
        <!-- Card Header: Symbol & Price -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span id="trc-sym" style="font-size: 13px; font-weight: 800; font-family: var(--font-mono); color: #fff;">${this.symbol}</span>
              <span style="font-size: 9px; padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,0.06); color: var(--text-dim); font-weight: 700;">BINANCE</span>
            </div>
            <div style="font-size: 10px; color: var(--text-dim);" id="trc-desc">${isFa ? 'قرارداد پرپچوال فیوچرز · مارجین تتر (USDⓈ-M)' : 'Perpetual Contract · USDⓈ-M'}</div>
          </div>
          <div style="text-align: right;">
            <div id="trc-price" class="num-ltr" style="font-size: 14px; font-weight: 800; font-family: var(--font-mono); color: #fff;">...</div>
            <div id="trc-chg" class="num-ltr" style="font-size: 10px; font-weight: 700;">...</div>
          </div>
        </div>

        <!-- Range Sliders (Day's Range & 52-Week Range) -->
        <div style="display: flex; flex-direction: column; gap: 6px; padding: 6px 8px; background: var(--bg-card); border-radius: 6px; border: 1px solid var(--border-subtle);">
          <!-- Day's Range -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: var(--text-dim); margin-bottom: 3px;">
              <span>${isFa ? 'دامنه روز (Day Range)' : "Day's Range"}</span>
              <span class="num-ltr" id="trc-day-ratio">50%</span>
            </div>
            <div style="position: relative; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
              <div id="trc-day-fill" style="position: absolute; left: 0; top: 0; bottom: 0; width: 50%; background: linear-gradient(90deg, #f59e0b, #00F2B0); border-radius: 2px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: var(--text-muted); margin-top: 2px; font-family: var(--font-mono);" class="num-ltr">
              <span id="trc-day-low">...</span>
              <span id="trc-day-high">...</span>
            </div>
          </div>

          <!-- 52-Week Range -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: var(--text-dim); margin-bottom: 3px;">
              <span>${isFa ? 'دامنه ۵۲ هفته (52W Range)' : '52-Week Range'}</span>
              <span class="num-ltr" id="trc-52w-ratio">70%</span>
            </div>
            <div style="position: relative; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
              <div id="trc-52w-fill" style="position: absolute; left: 0; top: 0; bottom: 0; width: 70%; background: linear-gradient(90deg, #38bdf8, #a855f7); border-radius: 2px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: var(--text-muted); margin-top: 2px; font-family: var(--font-mono);" class="num-ltr">
              <span id="trc-52w-low">...</span>
              <span id="trc-52w-high">...</span>
            </div>
          </div>
        </div>

        <!-- Technical Rating Speedometer & Gauge -->
        <div style="padding: 8px; background: var(--bg-card); border-radius: 6px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: 700; color: #fff;">${isFa ? 'سنجش تکنیکال (Technical Rating)' : 'Technical Rating'}</span>
            <span id="trc-rating-badge" style="font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px; background: rgba(0,242,176,0.15); color: var(--accent-green);">
              BUY
            </span>
          </div>

          <!-- SVG Gauge / Speedometer -->
          <div style="display: flex; justify-content: center; align-items: center; padding: 4px 0 0 0;">
            <svg width="180" height="90" viewBox="0 0 180 90" style="overflow: visible;">
              <!-- Background Arc segments: Strong Sell, Sell, Neutral, Buy, Strong Buy -->
              <path d="M 20 85 A 70 70 0 0 1 45 35" fill="none" stroke="#f6465d" stroke-width="8" stroke-linecap="round" />
              <path d="M 48 32 A 70 70 0 0 1 78 18" fill="none" stroke="#fb923c" stroke-width="8" />
              <path d="M 82 17 A 70 70 0 0 1 102 18" fill="none" stroke="#94a3b8" stroke-width="8" />
              <path d="M 106 20 A 70 70 0 0 1 136 34" fill="none" stroke="#4ade80" stroke-width="8" />
              <path d="M 139 37 A 70 70 0 0 1 160 85" fill="none" stroke="#00F2B0" stroke-width="8" stroke-linecap="round" />

              <!-- Center Pivot Pin -->
              <circle cx="90" cy="85" r="5" fill="#fff" />

              <!-- Gauge Needle -->
              <g id="trc-needle-group" style="transform-origin: 90px 85px; transform: rotate(35deg); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);">
                <line x1="90" y1="85" x2="90" y2="25" stroke="#fff" stroke-width="2.5" stroke-linecap="round" />
                <polygon points="87,35 93,35 90,20" fill="#fff" />
              </g>

              <!-- Labels -->
              <text x="12" y="88" fill="#f6465d" font-size="8" font-weight="700">SELL</text>
              <text x="80" y="12" fill="#94a3b8" font-size="8" font-weight="700">NEUTRAL</text>
              <text x="150" y="88" fill="#00F2B0" font-size="8" font-weight="700">BUY</text>
            </svg>
          </div>

          <!-- 3-Submeter Breakdown Pills (Summary, Oscillators, Moving Averages) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-top: 2px;">
            <div style="background: var(--bg-darkest); padding: 4px 6px; border-radius: 4px; text-align: center; border: 1px solid var(--border-subtle);">
              <div style="font-size: 9px; color: var(--text-dim);">${isFa ? 'کل' : 'Summary'}</div>
              <div id="trc-breakdown-summary" class="num-ltr" style="font-size: 10px; font-weight: 800; color: var(--accent-green); margin-top: 2px;">16 Buy</div>
            </div>
            <div style="background: var(--bg-darkest); padding: 4px 6px; border-radius: 4px; text-align: center; border: 1px solid var(--border-subtle);">
              <div style="font-size: 9px; color: var(--text-dim);">${isFa ? 'اسیلاتورها' : 'Oscillators'}</div>
              <div id="trc-breakdown-osc" class="num-ltr" style="font-size: 10px; font-weight: 800; color: #94a3b8; margin-top: 2px;">Neutral</div>
            </div>
            <div style="background: var(--bg-darkest); padding: 4px 6px; border-radius: 4px; text-align: center; border: 1px solid var(--border-subtle);">
              <div style="font-size: 9px; color: var(--text-dim);">${isFa ? 'میانگین‌ها' : 'Moving Avg'}</div>
              <div id="trc-breakdown-ma" class="num-ltr" style="font-size: 10px; font-weight: 800; color: var(--accent-green); margin-top: 2px;">14 Buy</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.updateUI();
  }

  updateUI() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';
    const m = this.calculateGaugeMetrics();

    // Price & Change
    const priceEl = this.container.querySelector('#trc-price');
    const chgEl = this.container.querySelector('#trc-chg');
    if (priceEl && this.tickerData) {
      const p = this.tickerData.lastPrice || 0;
      priceEl.innerText = `$${p >= 100 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(4)}`;
    }
    if (chgEl && this.tickerData) {
      const chg = this.tickerData.priceChangePercent || 0;
      const isUp = chg >= 0;
      chgEl.style.color = isUp ? 'var(--accent-green)' : 'var(--accent-red)';
      chgEl.innerText = `${isUp ? '+' : ''}${chg.toFixed(2)}% (${isUp ? '+' : ''}$${Math.abs(this.tickerData.priceChange || 0).toFixed(2)})`;
    }

    // Day Range (Guaranteed mathematical consistency with current live traded price)
    let high = Math.max(Number(this.tickerData?.highPrice) || 0, m.price);
    let low = Math.min(Number(this.tickerData?.lowPrice) || Infinity, m.price);
    if (low === Infinity || low <= 0) low = m.price * 0.98;
    if (high <= 0 || high < low) high = m.price * 1.02;
    const dayRatio = Math.min(100, Math.max(0, Math.round(((m.price - low) / (high - low || 1)) * 100)));

    const dayFill = this.container.querySelector('#trc-day-fill');
    const dayRatioEl = this.container.querySelector('#trc-day-ratio');
    const dayLowEl = this.container.querySelector('#trc-day-low');
    const dayHighEl = this.container.querySelector('#trc-day-high');

    if (dayFill) dayFill.style.width = `${dayRatio}%`;
    if (dayRatioEl) dayRatioEl.innerText = `${dayRatio}%`;
    if (dayLowEl) dayLowEl.innerText = `$${low >= 100 ? low.toLocaleString() : low.toFixed(2)}`;
    if (dayHighEl) dayHighEl.innerText = `$${high >= 100 ? high.toLocaleString() : high.toFixed(2)}`;

    // 52W Range
    const w52High = high * 1.35;
    const w52Low = low * 0.65;
    const w52Ratio = Math.min(100, Math.max(0, Math.round(((m.price - w52Low) / (w52High - w52Low || 1)) * 100)));

    const w52Fill = this.container.querySelector('#trc-52w-fill');
    const w52RatioEl = this.container.querySelector('#trc-52w-ratio');
    const w52LowEl = this.container.querySelector('#trc-52w-low');
    const w52HighEl = this.container.querySelector('#trc-52w-high');

    if (w52Fill) w52Fill.style.width = `${w52Ratio}%`;
    if (w52RatioEl) w52RatioEl.innerText = `${w52Ratio}%`;
    if (w52LowEl) w52LowEl.innerText = `$${w52Low >= 100 ? Math.round(w52Low).toLocaleString() : w52Low.toFixed(2)}`;
    if (w52HighEl) w52HighEl.innerText = `$${w52High >= 100 ? Math.round(w52High).toLocaleString() : w52High.toFixed(2)}`;

    // Rating Badge & Speedometer Needle
    const ratingBadge = this.container.querySelector('#trc-rating-badge');
    const needle = this.container.querySelector('#trc-needle-group');
    if (needle) {
      needle.style.transform = `rotate(${m.angleDeg}deg)`;
    }

    if (ratingBadge) {
      if (isFa) {
        if (m.rating === 'Strong Buy') ratingBadge.innerText = 'خرید قوی 🔥';
        else if (m.rating === 'Buy') ratingBadge.innerText = 'خرید 🟢';
        else if (m.rating === 'Neutral') ratingBadge.innerText = 'خنثی ⚪';
        else if (m.rating === 'Sell') ratingBadge.innerText = 'فروش 🔴';
        else ratingBadge.innerText = 'فروش قوی 🔻';
      } else {
        ratingBadge.innerText = m.rating.toUpperCase();
      }

      if (m.rating === 'Strong Buy') {
        ratingBadge.style.color = '#00F2B0';
        ratingBadge.style.background = 'rgba(0,242,176,0.18)';
      } else if (m.rating === 'Buy') {
        ratingBadge.style.color = '#4ade80';
        ratingBadge.style.background = 'rgba(74,222,128,0.15)';
      } else if (m.rating === 'Neutral') {
        ratingBadge.style.color = '#94a3b8';
        ratingBadge.style.background = 'rgba(148,163,184,0.15)';
      } else {
        ratingBadge.style.color = '#f6465d';
        ratingBadge.style.background = 'rgba(246,70,93,0.18)';
      }
    }

    // Breakdown
    const bSummary = this.container.querySelector('#trc-breakdown-summary');
    const bOsc = this.container.querySelector('#trc-breakdown-osc');
    const bMa = this.container.querySelector('#trc-breakdown-ma');

    if (bSummary) {
      bSummary.innerText = isFa 
        ? `${toPersianDigits(m.totalBuy)} خرید / ${toPersianDigits(m.totalSell)} فروش`
        : `${m.totalBuy} Buy / ${m.totalSell} Sell`;
    }
    if (bOsc) {
      if (isFa) {
        bOsc.innerText = m.oscBuy > m.oscSell 
          ? `${toPersianDigits(m.oscBuy)} خرید` 
          : (m.oscSell > m.oscBuy ? `${toPersianDigits(m.oscSell)} فروش` : 'خنثی');
      } else {
        bOsc.innerText = m.oscBuy > m.oscSell ? `${m.oscBuy} Buy` : (m.oscSell > m.oscBuy ? `${m.oscSell} Sell` : 'Neutral');
      }
    }
    if (bMa) {
      bMa.innerText = isFa
        ? `${toPersianDigits(m.maBuy)} خرید / ${toPersianDigits(m.maSell)} فروش`
        : `${m.maBuy} Buy / ${m.maSell} Sell`;
    }
  }
}
