// client/src/tseTapeView.js
// Tehran Stock Exchange (TSETMC) Market Tape & Smart Money Inspector for TradingChart
// Features real-time individual vs institutional volume, buyer power ratio, and orderflow metrics

import { getLanguage, toPersianDigits } from './i18n.js';

export class TseTapeView {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.activeSymbol = 'FOOLAD';
    this.data = null;
    this.pollInterval = null;
    this.isLoading = false;

    this.render();
    this.fetchData();
  }

  mount() {
    this.fetchData();
    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => this.fetchData(true), 3000);
    }
  }

  unmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  setSymbol(sym) {
    this.activeSymbol = String(sym || 'FOOLAD').replace(/^.*:/, '').toUpperCase();
    this.renderActiveSymbolChip();
    this.fetchData();
  }

  async fetchData(silent = false) {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const res = await fetch(`/api/tse-tape?symbol=${this.activeSymbol}`);
      if (res.ok) {
        this.data = await res.json();
        this.updateUI();
      }
    } catch (e) {
      console.warn('[TseTapeView] Error fetching tape:', e.message);
    } finally {
      this.isLoading = false;
    }
  }

  formatNum(num) {
    if (typeof num !== 'number') return '—';
    const isFa = getLanguage() === 'fa';
    const formatted = Math.round(num).toLocaleString('en-US');
    return isFa ? toPersianDigits(formatted) : formatted;
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    const QUICK_SYMBOLS = [
      { sym: 'FOOLAD', nameFa: 'فولاد مبارکه' },
      { sym: 'FAMELI', nameFa: 'ملی مس' },
      { sym: 'KHODRO', nameFa: 'ایران خودرو' },
      { sym: 'AHRAM', nameFa: 'اهرم کاریزما' },
      { sym: 'SHASTA', nameFa: 'شستا' },
      { sym: 'TALA', nameFa: 'طلای لوتوس' },
      { sym: 'AYAR', nameFa: 'طلای عیار' },
      { sym: 'TAVAN', nameFa: 'توان مفید' }
    ];

    this.container.innerHTML = `
      <div class="tse-tape-studio" style="height: 100%; display: flex; flex-direction: column; background: var(--bg-surface); color: #fff; overflow-y: auto; padding: 12px 16px; font-family: var(--font-sans); box-sizing: border-box; ${isFa ? 'direction: rtl;' : ''}">
        
        <!-- Header & Symbol Chips -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: rgba(16, 185, 129, 0.15); color: #34d399;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              </span>
              <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff;">
                ${isFa ? 'تابلوخوانی هوشمند و جریان نقدینگی بورس ایران (TSETMC)' : 'TSETMC Smart Money & Market Tape Inspector'}
              </h3>
              <span id="tse-active-sym-title" style="font-size: 11px; font-weight: 800; background: rgba(0, 242, 176, 0.12); color: var(--accent-cyan); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(0, 242, 176, 0.2);">
                ${this.activeSymbol}
              </span>
              <span style="font-size: 10px; font-weight: 700; background: rgba(16, 185, 129, 0.12); color: #34d399; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.2);">
                ${isFa ? 'ریزساختار حقیقی / حقوقی' : 'Retail vs Institutional'}
              </span>
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 3px;">
              ${isFa ? 'پایش سرانه معاملات حقیقی، نسبت قدرت خریدار و شناسایی پول هوشمند' : 'Real-time per-capita volume, buyer power ratio & smart money flow'}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-tse-refresh" class="btn-secondary" style="display: flex; align-items: center; gap: 5px; padding: 4px 10px; font-size: 11px; border-radius: 4px; cursor: pointer;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>${isFa ? 'بروزرسانی تابلو' : 'Refresh Tape'}</span>
            </button>
            <button id="btn-tse-load-chart" class="btn-primary" style="padding: 4px 12px; font-size: 11px; font-weight: 700; border-radius: 4px; cursor: pointer; background: var(--accent-cyan); color: #04121e; border: none;">
              ${isFa ? 'مشاهده چارت نماد' : 'Open Symbol Chart'}
            </button>
          </div>
        </div>

        <!-- Quick Symbol Selector Chips -->
        <div style="display: flex; gap: 6px; overflow-x: auto; padding: 4px 0 10px 0; margin-bottom: 8px; border-bottom: 1px solid var(--border-subtle);" id="tse-symbol-chips">
          ${QUICK_SYMBOLS.map(item => `
            <button class="tse-sym-chip ${item.sym === this.activeSymbol ? 'active' : ''}" data-sym="${item.sym}" style="padding: 4px 10px; font-size: 11px; border-radius: 6px; border: 1px solid ${item.sym === this.activeSymbol ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; background: ${item.sym === this.activeSymbol ? 'rgba(0,242,176,0.1)' : 'var(--bg-card)'}; color: ${item.sym === this.activeSymbol ? 'var(--accent-cyan)' : '#fff'}; cursor: pointer; white-space: nowrap; font-weight: 600;">
              ${item.sym} (${isFa ? item.nameFa : item.sym})
            </button>
          `).join('')}
        </div>

        <!-- Microstructure Tape Scoreboard Grid -->
        <div id="tse-tape-scoreboard" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 14px;">
          <!-- Loaded via updateUI -->
        </div>

        <!-- Institutional Volume Bar & Details Card -->
        <div id="tse-tape-details" style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
          <!-- Loaded via updateUI -->
        </div>

      </div>
    `;

    this.bindEvents();
  }

  renderActiveSymbolChip() {
    const titleEl = this.container?.querySelector('#tse-active-sym-title');
    if (titleEl) titleEl.innerText = this.activeSymbol;

    this.container?.querySelectorAll('.tse-sym-chip').forEach(btn => {
      const sym = btn.getAttribute('data-sym');
      const isActive = sym === this.activeSymbol;
      btn.classList.toggle('active', isActive);
      btn.style.borderColor = isActive ? 'var(--accent-cyan)' : 'var(--border-subtle)';
      btn.style.background = isActive ? 'rgba(0,242,176,0.1)' : 'var(--bg-card)';
      btn.style.color = isActive ? 'var(--accent-cyan)' : '#fff';
    });
  }

  bindEvents() {
    this.container.querySelectorAll('.tse-sym-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const sym = chip.getAttribute('data-sym');
        if (sym) this.setSymbol(sym);
      });
    });

    this.container.querySelector('#btn-tse-refresh')?.addEventListener('click', () => {
      this.fetchData();
    });

    this.container.querySelector('#btn-tse-load-chart')?.addEventListener('click', () => {
      this.app?.switchSymbol?.(this.activeSymbol);
    });
  }

  updateUI() {
    if (!this.data || !this.container) return;
    const isFa = getLanguage() === 'fa';
    const d = this.data;

    // 1. Update Scoreboard Cards
    const grid = this.container.querySelector('#tse-tape-scoreboard');
    if (grid) {
      const buyerPowerColor = d.buyerPowerRatio >= 1.25 ? '#00F2B0' : d.buyerPowerRatio <= 0.85 ? '#ef4444' : '#fbbf24';
      const powerBadge = d.buyerPowerRatio >= 1.25
        ? (isFa ? '🟢 خریدار پرقدرت' : '🟢 Strong Buyer')
        : d.buyerPowerRatio <= 0.85
        ? (isFa ? '🔴 فروشنده غالب' : '🔴 Seller Dominated')
        : (isFa ? '🟡 تعادل قوا' : '🟡 Balanced');

      grid.innerHTML = `
        <!-- Card 1: Last Price & Session Status -->
        <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'آخرین قیمت معامله' : 'Last Traded Price'}</span>
            <span style="font-size: 10px; color: ${d.change >= 0 ? '#00F2B0' : '#ef4444'}; font-weight: 700; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 3px;">
              ${d.change >= 0 ? '▲' : '▼'} ${isFa ? toPersianDigits(d.changePercent) : d.changePercent}%
            </span>
          </div>
          <div style="font-size: 20px; font-weight: 800; color: #fff; font-family: var(--font-mono);">
            ${this.formatNum(d.lastPrice)} <span style="font-size: 11px; font-weight: normal; color: var(--text-dim);">${isFa ? 'ریال' : 'IRR'}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-dim);">
            ${isFa ? `پایانی: ${this.formatNum(d.closePrice)} | دیروز: ${this.formatNum(d.yesterdayPrice)}` : `Close: ${this.formatNum(d.closePrice)} | Prev: ${this.formatNum(d.yesterdayPrice)}`}
          </div>
        </div>

        <!-- Card 2: Buyer Power Ratio -->
        <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'نسبت قدرت خریدار به فروشنده' : 'Buyer Power Ratio'}</span>
            <span style="font-size: 10px; color: ${buyerPowerColor}; font-weight: 700; background: ${buyerPowerColor}20; padding: 1px 6px; border-radius: 3px;">
              ${powerBadge}
            </span>
          </div>
          <div style="font-size: 20px; font-weight: 800; color: ${buyerPowerColor}; font-family: var(--font-mono);">
            ${isFa ? toPersianDigits(d.buyerPowerRatio) : d.buyerPowerRatio}x
          </div>
          <div style="font-size: 11px; color: var(--text-dim);">
            ${isFa ? (d.smartMoneyInflow ? '⚡ سیگنال ورود پول هوشمند تایید شد' : 'جریان سفارشات در محدوده متعادل') : (d.smartMoneyInflow ? '⚡ Smart Money Inflow Verified' : 'Normal Orderflow Zone')}
          </div>
        </div>

        <!-- Card 3: Per-Capita Volume -->
        <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'سرانه خرید در برابر فروش حقیقی' : 'Retail Per-Capita Buy/Sell'}</span>
            <span style="font-size: 10px; color: #38bdf8; font-weight: 700; background: rgba(56,189,248,0.1); padding: 1px 6px; border-radius: 3px;">${isFa ? 'سرانه' : 'PER PERSON'}</span>
          </div>
          <div style="font-size: 16px; font-weight: 800; color: #fff; font-family: var(--font-mono);">
            ${this.formatNum(d.buyPerCapitaToman)} / ${this.formatNum(d.sellPerCapitaToman)}
          </div>
          <div style="font-size: 11px; color: var(--text-dim);">
            ${isFa ? 'تومان به ازای هر کد معاملاتی حقیقی' : 'Tomans per individual account'}
          </div>
        </div>

        <!-- Card 4: Suspicious Volume & Queue -->
        <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'حجم مشکوک و وضعیت صف' : 'Suspicious Vol & Queue'}</span>
            <span style="font-size: 10px; color: #c084fc; font-weight: 700; background: rgba(192,132,252,0.1); padding: 1px 6px; border-radius: 3px;">${isFa ? 'تابلو' : 'TAPE'}</span>
          </div>
          <div style="font-size: 16px; font-weight: 800; color: #fff; font-family: var(--font-mono);">
            ${isFa ? toPersianDigits(d.suspiciousVolumeRatio) : d.suspiciousVolumeRatio}x <span style="font-size: 12px; font-weight: normal; color: var(--text-dim);">${isFa ? 'میانگین ماه' : '30D avg'}</span>
          </div>
          <div style="font-size: 11px; color: var(--accent-cyan); font-weight: 600;">
            ${d.queueStatus}
          </div>
        </div>
      `;
    }

    // 2. Update Details & Retail/Institutional Distribution Bar
    const details = this.container.querySelector('#tse-tape-details');
    if (details) {
      const totVol = Math.max(1, d.volume);
      const retailBuyPct = Number(((d.individualBuyVolume / totVol) * 100).toFixed(1));
      const instBuyPct = Number((100 - retailBuyPct).toFixed(1));

      details.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 12px; color: #fff;">
            ${isFa ? 'توزیع حجم معاملات (حقیقی در برابر حقوقی)' : 'Volume Distribution (Retail vs Institutional)'}
          </span>
          <span style="font-size: 11px; color: var(--text-dim);">
            ${isFa ? `حجم کل: ${this.formatNum(d.volume)} سهم | ارزش: ${this.formatNum(d.value / 10000000)} میلیون تومان` : `Total Vol: ${this.formatNum(d.volume)} | Value: ${this.formatNum(d.value / 10000000)} M TMN`}
          </span>
        </div>

        <!-- Volume Bar -->
        <div style="width: 100%; height: 12px; background: rgba(255,255,255,0.06); border-radius: 6px; overflow: hidden; display: flex;">
          <div style="width: ${retailBuyPct}%; background: #00F2B0; height: 100%;" title="Retail Buy: ${retailBuyPct}%"></div>
          <div style="width: ${instBuyPct}%; background: #38bdf8; height: 100%;" title="Institutional Buy: ${instBuyPct}%"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #00F2B0; font-weight: 700;">
            ● ${isFa ? `حقیقی: ${isFa ? toPersianDigits(retailBuyPct) : retailBuyPct}٪ (${this.formatNum(d.individualBuyVolume)} سهم)` : `Retail: ${retailBuyPct}% (${this.formatNum(d.individualBuyVolume)} shares)`}
          </span>
          <span style="color: #38bdf8; font-weight: 700;">
            ● ${isFa ? `حقوقی: ${isFa ? toPersianDigits(instBuyPct) : instBuyPct}٪ (${this.formatNum(d.institutionalBuyVolume)} سهم)` : `Institutional: ${instBuyPct}% (${this.formatNum(d.institutionalBuyVolume)} shares)`}
          </span>
        </div>

        <!-- Range Metrics -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding-top: 6px; border-top: 1px solid var(--border-subtle); font-size: 11px; text-align: center;">
          <div>
            <span style="color: var(--text-dim); display: block;">${isFa ? 'کمترین روز' : 'Day Low'}</span>
            <span style="font-weight: 700; font-family: var(--font-mono); color: #fff;">${this.formatNum(d.lowPrice)}</span>
          </div>
          <div>
            <span style="color: var(--text-dim); display: block;">${isFa ? 'بیشترین روز' : 'Day High'}</span>
            <span style="font-weight: 700; font-family: var(--font-mono); color: #fff;">${this.formatNum(d.highPrice)}</span>
          </div>
          <div>
            <span style="color: var(--text-dim); display: block;">${isFa ? 'تعداد کل معاملات' : 'Trades Count'}</span>
            <span style="font-weight: 700; font-family: var(--font-mono); color: #fff;">${this.formatNum(d.tradesCount)}</span>
          </div>
          <div>
            <span style="color: var(--text-dim); display: block;">${isFa ? 'خریدار به فروشنده' : 'Buyer/Seller Cnt'}</span>
            <span style="font-weight: 700; font-family: var(--font-mono); color: #fff;">${this.formatNum(d.individualBuyCount)} / ${this.formatNum(d.individualSellCount)}</span>
          </div>
        </div>
      `;
    }
  }
}
