// client/src/technicalScreener.js
// Institutional Real-Time Technical Screener for TradingChart (TradingView Parity)
// Rigid 1:1 Column-Locked Architecture with High-Contrast WCAG AAA Typography

import { getLanguage, t, toPersianDigits, localizeInstrumentName } from './i18n.js';

export class TechnicalScreenerView {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.currentCategory = 'all';
    this.currentRating = 'all';
    this.searchQuery = '';
    this.autoRefresh = true;
    this.refreshTimer = null;
    this.items = [];
    this.isLoading = false;

    this.render();
    this.fetchData();
    this.startAutoRefresh();
  }

  destroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  startAutoRefresh() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => {
      if (this.autoRefresh) {
        this.fetchData(true);
      }
    }, 5000);
  }

  async fetchData(silent = false) {
    if (!silent) this.isLoading = true;
    try {
      const url = new URL('/api/screener', window.location.origin);
      if (this.currentCategory !== 'all') url.searchParams.set('category', this.currentCategory);
      if (this.currentRating !== 'all') url.searchParams.set('rating', this.currentRating);
      if (this.searchQuery) url.searchParams.set('search', this.searchQuery);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        this.items = data.items || [];
      }
    } catch (e) {
      console.error('[TechnicalScreener] Fetch error:', e);
    } finally {
      this.isLoading = false;
      this.updateTable();
    }
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div class="screener-wrapper" style="display: flex; flex-direction: column; height: 100%; background: var(--bg-surface); overflow: hidden; font-family: var(--font-sans);">
        <!-- Top Toolbar & Filter Ribbon -->
        <div class="screener-topbar" style="padding: 8px 16px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <!-- Category Tabs -->
            <div class="screener-cat-pills" style="display: flex; gap: 4px; background: var(--bg-card); padding: 3px; border-radius: 6px; border: 1px solid var(--border-subtle);">
              <button class="screener-cat-btn active" data-cat="all">${isFa ? 'همه' : 'All'}</button>
              <button class="screener-cat-btn" data-cat="crypto">${isFa ? 'ارز دیجیتال' : 'Crypto'}</button>
              <button class="screener-cat-btn" data-cat="metals">${isFa ? 'فلزات' : 'Metals'}</button>
              <button class="screener-cat-btn" data-cat="commodities">${isFa ? 'کالاها' : 'Commodities'}</button>
              <button class="screener-cat-btn" data-cat="forex">${isFa ? 'فارکس' : 'Forex'}</button>
              <button class="screener-cat-btn" data-cat="stocks">${isFa ? 'سهام و شاخص' : 'Equities'}</button>
            </div>

            <!-- Rating Filter Dropdown -->
            <select id="screener-rating-filter" style="height: 30px; font-size: 11px; font-weight: 600; padding: 2px 8px; background: var(--bg-card); border: 1px solid var(--border-subtle); color: var(--text-base); border-radius: 4px;">
              <option value="all">${isFa ? 'همه رتبه‌بندی‌ها' : 'All Technical Ratings'}</option>
              <option value="strong_buy">${isFa ? 'خرید قوی (Strong Buy 🔥)' : 'Strong Buy 🔥'}</option>
              <option value="buy">${isFa ? 'خرید (Buy 🟢)' : 'Buy 🟢'}</option>
              <option value="sell">${isFa ? 'فروش (Sell 🔴)' : 'Sell 🔴'}</option>
              <option value="strong_sell">${isFa ? 'فروش قوی (Strong Sell 🔻)' : 'Strong Sell 🔻'}</option>
              <option value="overbought">${isFa ? 'اشباع خرید (RSI > 70)' : 'Overbought (RSI > 70)'}</option>
              <option value="oversold">${isFa ? 'اشباع فروش (RSI < 30)' : 'Oversold (RSI < 30)'}</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Search input -->
            <div style="position: relative; display: flex; align-items: center;">
              <input type="text" id="screener-search" placeholder="${isFa ? 'جستجوی نماد...' : 'Search symbol...'}" style="height: 28px; width: 140px; font-size: 11px; padding: 4px 8px; background: var(--bg-card); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px; text-transform: uppercase;" />
            </div>

            <!-- Auto refresh toggle & refresh button -->
            <button id="screener-refresh-btn" class="btn-secondary" title="${isFa ? 'بروزرسانی فوری' : 'Refresh now'}" style="height: 28px; padding: 0 8px; display: flex; align-items: center; gap: 4px; font-size: 11px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>${isFa ? 'بروزرسانی' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        <!-- Rigid Column-Locked Synchronized Table Container -->
        <div class="screener-table-container" style="flex: 1; overflow-y: auto; overflow-x: auto; position: relative;">
          <table style="width: 100%; min-width: 960px; table-layout: fixed; border-collapse: collapse; font-size: 11px;">
            <colgroup>
              <col style="width: 18%;">
              <col style="width: 11%;">
              <col style="width: 9%;">
              <col style="width: 10%;">
              <col style="width: 10%;">
              <col style="width: 9%;">
              <col style="width: 12%;">
              <col style="width: 8%;">
              <col style="width: 8%;">
              <col style="width: 5%;">
            </colgroup>
            <thead style="position: sticky; top: 0; background: var(--bg-darkest); z-index: 2;">
              <tr style="border-bottom: 1px solid var(--border-subtle); font-weight: 700; color: #cbd5e1; font-size: 11px;">
                <th style="padding: 8px 12px; text-align: left;">${isFa ? 'نماد دارایی' : 'Symbol'}</th>
                <th style="padding: 8px 10px; text-align: right;">${isFa ? 'آخرین قیمت' : 'Last Price'}</th>
                <th style="padding: 8px 10px; text-align: right;">${isFa ? 'تغییر ۲۴س' : '24h Change'}</th>
                <th style="padding: 8px 10px; text-align: right;">${isFa ? 'بالاترین' : '24h High'}</th>
                <th style="padding: 8px 10px; text-align: right;">${isFa ? 'پایین‌ترین' : '24h Low'}</th>
                <th style="padding: 8px 10px; text-align: right;">${isFa ? 'حجم ۲۴س' : '24h Vol'}</th>
                <th style="padding: 8px 10px; text-align: center;">${isFa ? 'شاخص قدرت (RSI)' : 'RSI (14)'}</th>
                <th style="padding: 8px 10px; text-align: center;">${isFa ? 'روند' : 'Trend'}</th>
                <th style="padding: 8px 10px; text-align: center;">${isFa ? 'رتبه‌بندی' : 'Technical Rating'}</th>
                <th style="padding: 8px 10px; text-align: center;">${isFa ? 'اقدام' : 'Action'}</th>
              </tr>
            </thead>
            <tbody id="screener-tbody">
              <!-- Rendered dynamically -->
            </tbody>
          </table>
        </div>

        <!-- Footer status bar with high contrast text -->
        <div style="padding: 6px 16px; background: var(--bg-darkest); border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #cbd5e1;">
          <span id="screener-count-status" style="font-weight: 700; color: #fff;">${isFa ? 'بارگذاری داده‌های تکنیکال...' : 'Loading market telemetry...'}</span>
          <span style="color: #94a3b8;">${isFa ? 'محاسبه لایو با هوش مصنوعی و شاخص‌های کانونیکال' : 'Real-time multi-indicator algorithmic consensus'}</span>
        </div>
      </div>
    `;

    this.bindEvents();
    if (this.items && this.items.length > 0) {
      this.updateTable();
    }
  }

  bindEvents() {
    // Category tabs
    this.container.querySelectorAll('.screener-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.screener-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.getAttribute('data-cat');
        this.fetchData();
      });
    });

    // Rating filter
    const ratingSelect = this.container.querySelector('#screener-rating-filter');
    if (ratingSelect) {
      ratingSelect.addEventListener('change', (e) => {
        this.currentRating = e.target.value;
        this.fetchData();
      });
    }

    // Search input
    const searchInput = this.container.querySelector('#screener-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.fetchData(true);
      });
    }

    // Refresh button
    const refreshBtn = this.container.querySelector('#screener-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.fetchData());
    }
    // render() rebuilds the table (including the header) in the new language with
    // an EMPTY <tbody> placeholder, so the already-fetched rows must be painted
    // back immediately — otherwise switching language blanks the screener.
    this.updateTable();
  }

  updateTable() {
    const tbody = this.container?.querySelector('#screener-tbody');
    const statusEl = this.container?.querySelector('#screener-count-status');
    if (!tbody) return;

    const isFa = getLanguage() === 'fa';
    if (statusEl) {
      statusEl.textContent = isFa
        ? `${this.items.length} نماد معاملاتی پایش شد`
        : `Showing ${this.items.length} instruments monitored`;
    }

    if (this.items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-dim); font-size: 12px;">
            ${isFa ? 'هیچ نمادی با فیلترهای انتخابی یافت نشد.' : 'No instruments matched current criteria.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.items.map(item => {
      const isUp = item.priceChangePercent >= 0;
      const chgColor = isUp ? 'var(--accent-green, #0ecb81)' : 'var(--accent-red, #f6465d)';
      const chgSign = isUp ? '+' : '';

      // Rating badge styling
      let badgeStyle = 'background: rgba(120,123,134,0.15); color: #b2b5be; border: 1px solid rgba(120,123,134,0.3);';
      let badgeLabel = item.technicalRating;
      if (item.technicalRating === 'Strong Buy') {
        badgeStyle = 'background: rgba(14,203,129,0.18); color: #0ecb81; border: 1px solid rgba(14,203,129,0.4);';
        badgeLabel = isFa ? 'خرید قوی 🔥' : 'Strong Buy 🔥';
      } else if (item.technicalRating === 'Buy') {
        badgeStyle = 'background: rgba(14,203,129,0.12); color: #0ecb81; border: 1px solid rgba(14,203,129,0.25);';
        badgeLabel = isFa ? 'خرید 🟢' : 'Buy 🟢';
      } else if (item.technicalRating === 'Strong Sell') {
        badgeStyle = 'background: rgba(246,70,93,0.18); color: #f6465d; border: 1px solid rgba(246,70,93,0.4);';
        badgeLabel = isFa ? 'فروش قوی 🔻' : 'Strong Sell 🔻';
      } else if (item.technicalRating === 'Sell') {
        badgeStyle = 'background: rgba(246,70,93,0.12); color: #f6465d; border: 1px solid rgba(246,70,93,0.25);';
        badgeLabel = isFa ? 'فروش 🔴' : 'Sell 🔴';
      } else {
        badgeLabel = isFa ? 'خنثی ⚪' : 'Neutral ⚪';
      }

      // RSI color: Amber for overbought (70+), Green for oversold (30-) / bullish momentum, Slate for neutral
      let rsiColor = '#94a3b8';
      if (item.rsi14 >= 70) rsiColor = 'var(--accent-gold, #f59e0b)';
      else if (item.rsi14 <= 30) rsiColor = 'var(--accent-green, #0ecb81)';

      return `
        <tr class="screener-row" data-symbol="${item.symbol}" style="border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: background 0.12s;">
          <!-- Symbol -->
          <td style="padding: 7px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 800; color: #fff; font-family: var(--font-mono); font-size: 12px;">${item.symbol}</span>
              <span style="font-size: 9px; color: var(--text-dim); background: var(--bg-card); padding: 1px 4px; border-radius: 3px; border: 1px solid var(--border-subtle);">${item.category.toUpperCase()}</span>
            </div>
            <div style="font-size: 10px; color: var(--text-dim); margin-top: 1px; overflow: hidden; text-overflow: ellipsis;">${localizeInstrumentName(item.name)}</div>
          </td>

          <!-- Price -->
          <td style="padding: 7px 10px; text-align: right; font-weight: 700; font-family: var(--font-mono); color: #fff;">
            $${Number(item.price).toLocaleString(undefined, { minimumFractionDigits: item.precision, maximumFractionDigits: item.precision })}
          </td>

          <!-- Change -->
          <td style="padding: 7px 10px; text-align: right; font-weight: 700; font-family: var(--font-mono); color: ${chgColor};">
            ${chgSign}${item.priceChangePercent.toFixed(2)}%
          </td>

          <!-- High -->
          <td style="padding: 7px 10px; text-align: right; font-family: var(--font-mono); color: var(--text-muted);">
            $${Number(item.highPrice).toLocaleString(undefined, { minimumFractionDigits: item.precision })}
          </td>

          <!-- Low -->
          <td style="padding: 7px 10px; text-align: right; font-family: var(--font-mono); color: var(--text-muted);">
            $${Number(item.lowPrice).toLocaleString(undefined, { minimumFractionDigits: item.precision })}
          </td>

          <!-- Volume -->
          <td style="padding: 7px 10px; text-align: right; font-family: var(--font-mono); color: var(--text-dim);">
            ${Number(item.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </td>

          <!-- RSI Gauge -->
          <td style="padding: 7px 10px; text-align: center;">
            <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
              <div style="width: 42px; height: 5px; background: var(--bg-darkest); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-subtle);">
                <div style="width: ${Math.min(100, Math.max(0, item.rsi14))}%; height: 100%; background: ${rsiColor};"></div>
              </div>
              <span style="font-family: var(--font-mono); font-weight: 700; color: ${rsiColor}; font-size: 10px;" class="num-ltr">${item.rsi14}</span>
            </div>
          </td>

          <!-- Trend -->
          <td style="padding: 7px 10px; text-align: center;">
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; ${item.trend === 'Bullish' ? 'color: var(--accent-green); background: rgba(14,203,129,0.1);' : 'color: var(--accent-red); background: rgba(246,70,93,0.1);'}">
              ${item.trend === 'Bullish'
                ? (isFa ? '▲ صعودی' : '▲ Bull')
                : (isFa ? '▼ نزولی' : '▼ Bear')}
            </span>
          </td>

          <!-- Technical Rating -->
          <td style="padding: 7px 10px; text-align: center;">
            <span style="display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; ${badgeStyle}">
              ${badgeLabel}
            </span>
          </td>

          <!-- Action -->
          <td style="padding: 7px 10px; text-align: center;">
            <button class="btn-screener-chart btn-secondary" data-symbol="${item.symbol}" style="padding: 4px 10px; font-size: 11px; min-height: 26px; border-radius: 4px;" title="${isFa ? 'مشاهده چارت ' + item.symbol : 'Open chart for ' + item.symbol}" aria-label="Open chart for ${item.symbol}">
              ${isFa ? 'چارت ↗' : 'Chart ↗'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Row click listeners
    tbody.querySelectorAll('.screener-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const sym = row.getAttribute('data-symbol');
        if (sym && this.app) {
          this.app.switchSymbol(sym);
        }
      });
    });

    tbody.querySelectorAll('.btn-screener-chart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sym = btn.getAttribute('data-symbol');
        if (sym && this.app) {
          this.app.switchSymbol(sym);
        }
      });
    });
  }
}
