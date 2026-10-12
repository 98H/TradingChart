// client/src/goldBubbleView.js
// Institutional Tehran Gold Market & Coin Bubble Studio for TradingChart
// Live calculation of 17k Melted Gold (Abshodeh), 18k Gram Gold, Ounce Parity, and Coin Bubbles

import { getLanguage, toPersianDigits } from './i18n.js';

export class GoldBubbleView {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.data = null;
    this.pollInterval = null;
    this.isLoading = false;

    this.render();
    this.fetchData();
  }

  mount() {
    this.fetchData();
    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => { if (!document.hidden) this.fetchData(true); }, 4000);
    }
  }

  unmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async fetchData(silent = false) {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const res = await fetch('/api/gold-snapshot');
      if (res.ok) {
        this.data = await res.json();
        this.updateUI();
      }
    } catch (e) {
      console.warn('[GoldBubbleView] Error fetching gold snapshot:', e.message);
    } finally {
      this.isLoading = false;
    }
  }

  formatToman(num) {
    if (typeof num !== 'number') return '—';
    const isFa = getLanguage() === 'fa';
    const formatted = Math.round(num).toLocaleString('en-US');
    return isFa ? toPersianDigits(formatted) : formatted;
  }

  formatUsd(num) {
    if (typeof num !== 'number') return '—';
    const isFa = getLanguage() === 'fa';
    const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return isFa ? toPersianDigits(formatted) : formatted;
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div class="gold-bubble-studio" style="height: 100%; display: flex; flex-direction: column; background: var(--bg-surface); color: #fff; overflow-y: auto; padding: 12px 16px; font-family: var(--font-sans); box-sizing: border-box; ${isFa ? 'direction: rtl;' : ''}">
        
        <!-- Header Strip -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: rgba(245, 158, 11, 0.15); color: #fbbf24;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>
              </span>
              <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff;">
                ${isFa ? 'میز محاسبات زنده مظنه و حباب مسکوکات طلای تهران' : 'Tehran Gold Market & Coin Bubble Studio'}
              </h3>
              <span style="font-size: 10px; font-weight: 700; background: rgba(0, 242, 176, 0.12); color: var(--accent-cyan); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(0, 242, 176, 0.2);">
                ${isFa ? 'فرمولاسیون استاندارد بنکداری' : 'Institutional Formula'}
              </span>
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 3px;">
              ${isFa ? 'ارزش ذاتی = [(انس جهانی × نرخ دلار / ۳۱.۱۰۳۵) × وزن × عیار] + حق ضرب بانک مرکزی' : 'Intrinsic = [(Ounce USD × USD Rate / 31.1035) × Weight × Purity] + Mint Wage'}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-gold-refresh" class="btn-secondary" style="display: flex; align-items: center; gap: 5px; padding: 4px 10px; font-size: 11px; border-radius: 4px; cursor: pointer;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>${isFa ? 'بروزرسانی' : 'Refresh'}</span>
            </button>
            <button id="btn-chart-abshodeh" class="btn-primary" style="padding: 4px 12px; font-size: 11px; font-weight: 700; border-radius: 4px; cursor: pointer; background: var(--accent-cyan); color: #04121e; border: none;">
              ${isFa ? 'چارت طلای آبشده' : 'Melted Gold Chart'}
            </button>
          </div>
        </div>

        <!-- 4 Key Market Pillar Cards -->
        <div id="gold-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 14px;">
          <!-- Loaded via updateUI -->
        </div>

        <!-- Comprehensive Coin Bubble Table -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;">
          <div style="padding: 10px 14px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; font-size: 12px; color: #fff;">
              ${isFa ? 'جدول ارزیابی ارزش ذاتی و حباب مسکوکات رسمی' : 'Official Gold Coins Bubble & Intrinsic Value Table'}
            </span>
            <span style="font-size: 11px; color: var(--text-dim);" id="gold-last-updated">—</span>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: ${isFa ? 'right' : 'left'};">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-subtle); background: rgba(255,255,255,0.02); color: var(--text-dim); font-size: 11px;">
                  <th style="padding: 8px 12px;">${isFa ? 'نوع مسکوک' : 'Coin Spec'}</th>
                  <th style="padding: 8px 12px; text-align: right;">${isFa ? 'قیمت بازار (تومان)' : 'Market Price'}</th>
                  <th style="padding: 8px 12px; text-align: right;">${isFa ? 'ارزش ذاتی طلا' : 'Intrinsic Value'}</th>
                  <th style="padding: 8px 12px; text-align: right;">${isFa ? 'مبلغ حباب (تومان)' : 'Bubble Amount'}</th>
                  <th style="padding: 8px 12px; text-align: center;">${isFa ? 'درصد حباب' : 'Bubble %'}</th>
                  <th style="padding: 8px 12px; text-align: center;">${isFa ? 'مشخصات فیزیکی' : 'Purity & Weight'}</th>
                  <th style="padding: 8px 12px; text-align: center;">${isFa ? 'عملیات' : 'Action'}</th>
                </tr>
              </thead>
              <tbody id="gold-coins-tbody">
                <!-- Dynamically loaded rows -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btn-gold-refresh')?.addEventListener('click', () => {
      this.fetchData();
    });

    this.container.querySelector('#btn-chart-abshodeh')?.addEventListener('click', () => {
      this.app?.switchSymbol?.('GOLD_ABSHODEH');
    });
  }

  updateUI() {
    if (!this.data || !this.container) return;
    const isFa = getLanguage() === 'fa';
    const d = this.data;

    // 1. Update Grid Cards
    const cardsGrid = this.container.querySelector('#gold-cards-grid');
    if (cardsGrid) {
      cardsGrid.innerHTML = `
        <!-- Card 1: Abshodeh 17k -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'مظنه مثقال آبشده ۱۷ عیار' : '17k Melted Gold (Mesghal)'}</span>
            <span style="font-size: 10px; color: #fbbf24; font-weight: 700; background: rgba(245,158,11,0.1); padding: 1px 6px; border-radius: 3px;">${isFa ? 'بازار تهران' : 'BAZAAR'}</span>
          </div>
          <div style="font-size: 18px; font-weight: 800; color: #fff; font-family: var(--font-mono);">
            ${this.formatToman(d.abshodeh.price)} <span style="font-size: 11px; font-weight: normal; color: var(--text-dim);">${isFa ? 'تومان' : 'TMN'}</span>
          </div>
          <div style="font-size: 11px; color: #00F2B0; font-weight: 700;">
            ▲ +${this.formatToman(d.abshodeh.change)} (${isFa ? toPersianDigits(d.abshodeh.changePercent) : d.abshodeh.changePercent}%)
          </div>
        </div>

        <!-- Card 2: 18k Gram Gold -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'یک گرم طلای ۱۸ عیار (۷۵۰)' : '18k Gram Gold (750)'}</span>
            <span style="font-size: 10px; color: #fbbf24; font-weight: 700; background: rgba(245,158,11,0.1); padding: 1px 6px; border-radius: 3px;">${isFa ? 'طلا ۷۵۰' : '750 Au'}</span>
          </div>
          <div style="font-size: 18px; font-weight: 800; color: #fff; font-family: var(--font-mono);">
            ${this.formatToman(d.gram18.price)} <span style="font-size: 11px; font-weight: normal; color: var(--text-dim);">${isFa ? 'تومان' : 'TMN'}</span>
          </div>
          <div style="font-size: 11px; color: #00F2B0; font-weight: 700;">
            ▲ +${this.formatToman(d.gram18.change)} (${isFa ? toPersianDigits(d.gram18.changePercent) : d.gram18.changePercent}%)
          </div>
        </div>

        <!-- Card 3: Global Ounce -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'انس طلای جهانی Spot' : 'Gold Spot Ounce'}</span>
            <span style="font-size: 10px; color: var(--accent-cyan); font-weight: 700; background: rgba(0,242,176,0.1); padding: 1px 6px; border-radius: 3px;">${isFa ? 'جهانی' : 'GLOBAL'}</span>
          </div>
          <div style="font-size: 18px; font-weight: 800; color: #fff; font-family: var(--font-mono);">
            $${this.formatUsd(d.ounceUsd)}
          </div>
          <div style="font-size: 11px; color: var(--text-dim);">
            ${isFa ? 'مبنای ۳۱.۱۰۳۵ گرم تروا' : 'Per 31.1035 Troy Grams'}
          </div>
        </div>

        <!-- Card 4: Free USD & Tether -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-dim);">${isFa ? 'دلار آزاد / تتر نوبیتکس' : 'Free USD / Nobitex USDT'}</span>
            <span style="font-size: 10px; color: #38bdf8; font-weight: 700; background: rgba(56,189,248,0.1); padding: 1px 6px; border-radius: 3px;">${isFa ? 'نرخ ارز' : 'FX RATE'}</span>
          </div>
          <div style="font-size: 18px; font-weight: 800; color: #fff; font-family: var(--font-mono);">
            ${this.formatToman(d.usdFree)} / ${this.formatToman(d.usdtNobitex)}
          </div>
          <div style="font-size: 11px; color: var(--text-dim);">
            ${isFa ? `حواله درهم دبی: ${this.formatToman(d.dirhamRate)} ت` : `AED Dirham: ${this.formatToman(d.dirhamRate)} TMN`}
          </div>
        </div>
      `;
    }

    // 2. Update Coins Table
    const tbody = this.container.querySelector('#gold-coins-tbody');
    if (tbody && d.coins) {
      const COIN_SYMBOL_MAP = {
        emami: { sym: 'COIN_EMAMI', tickerFa: 'سکه امامی' },
        bahar: { sym: 'COIN_BAHAR', tickerFa: 'سکه بهار آزادی' },
        nim: { sym: 'COIN_NIM', tickerFa: 'نیم سکه بهار' },
        rob: { sym: 'COIN_ROB', tickerFa: 'ربع سکه بهار' },
        gerami: { sym: 'COIN_GERMI', tickerFa: 'سکه گرمی' }
      };

      tbody.innerHTML = Object.entries(d.coins).map(([key, coin]) => {
        const item = COIN_SYMBOL_MAP[key] || { sym: 'COIN_EMAMI', tickerFa: 'سکه' };
        const sym = item.sym;
        const subLabel = isFa ? item.tickerFa : sym;
        const bubbleColor = coin.bubblePercent >= 30 ? '#ef4444' : coin.bubblePercent >= 20 ? '#f59e0b' : '#00F2B0';
        return `
          <tr style="border-bottom: 1px solid var(--border-subtle); transition: background 0.15s;" class="gold-coin-row">
            <td style="padding: 10px 12px;">
              <div style="font-weight: 700; color: #fff;">${isFa ? coin.name : coin.nameEn}</div>
              <div style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">${subLabel}</div>
            </td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 800; font-family: var(--font-mono); color: #fff;">
              ${this.formatToman(coin.marketPrice)}
            </td>
            <td style="padding: 10px 12px; text-align: right; font-family: var(--font-mono); color: var(--text-dim);">
              ${this.formatToman(coin.intrinsicValue)}
            </td>
            <td style="padding: 10px 12px; text-align: right; font-family: var(--font-mono); color: ${bubbleColor}; font-weight: 700;">
              +${this.formatToman(coin.bubbleAmount)}
            </td>
            <td style="padding: 10px 12px; text-align: center;">
              <span style="font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.06); color: ${bubbleColor}; border: 1px solid ${bubbleColor}40;">
                ${isFa ? toPersianDigits(coin.bubblePercent) : coin.bubblePercent}%
              </span>
            </td>
            <td style="padding: 10px 12px; text-align: center; color: var(--text-dim); font-size: 11px;">
              ${isFa ? `${toPersianDigits(coin.weightGrams)} گرم (عیار ${toPersianDigits(coin.purity * 1000)})` : `${coin.weightGrams}g (${coin.purity * 1000}‰)`}
            </td>
            <td style="padding: 10px 12px; text-align: center;">
              <button class="btn-open-coin-chart btn-secondary" data-symbol="${sym}" style="padding: 3px 8px; font-size: 11px; border-radius: 4px; cursor: pointer;">
                ${isFa ? 'مشاهده چارت' : 'Chart'}
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-open-coin-chart').forEach(btn => {
        btn.addEventListener('click', () => {
          const sym = btn.getAttribute('data-symbol');
          if (sym) this.app?.switchSymbol?.(sym);
        });
      });
    }

    const timeEl = this.container.querySelector('#gold-last-updated');
    if (timeEl) {
      timeEl.textContent = isFa ? 'برخط (پایش زنده هر ۴ ثانیه)' : 'Online (4s live telemetry)';
    }
  }
}
