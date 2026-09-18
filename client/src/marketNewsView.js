// client/src/marketNewsView.js
// Real-Time Market News & Macro Catalyst Feed for TradingChart (TradingView Parity)
// Features live category filters, sentiment tagging, impact badges, and 1-click symbol chart switching

import { getLanguage, t } from './i18n.js';

export class MarketNewsView {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.newsItems = [];
    this.pollTimer = null;

    this.render();
    this.fetchNews();
    this.startPolling();
  }

  destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.fetchNews(true), 15000);
  }

  async fetchNews(silent = false) {
    try {
      const url = `/api/news?category=${this.currentCategory}&limit=30`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        this.newsItems = data.news || [];
        this.updateNewsList();
      }
    } catch (e) {
      if (!silent) console.error('[MarketNews] Fetch error:', e);
    }
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';
    const isInDock = !!this.container.closest('.vela-panel-body');

    this.container.innerHTML = `
      <div class="market-news-wrapper" style="display: flex; flex-direction: column; height: 100%; background: var(--bg-surface); overflow: hidden; font-family: var(--font-sans);">
        <!-- News Header Strip -->
        <div style="padding: 10px 14px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="pulse-dot" style="background: #38bdf8;"></span>
              <span style="font-weight: 800; color: #fff; font-size: 13px; ${isInDock ? 'display: none;' : ''}">${isFa ? 'اخبار زنده و کاتالیزورهای بازار' : 'Market News & Catalysts'}</span>
              <span style="font-size: 11px; font-weight: 700; color: var(--text-dim); ${!isInDock ? 'display: none;' : ''}">${isFa ? 'کاتالیزورهای بازار' : 'Macro Catalysts'}</span>
            </div>
            <span id="news-count-badge" style="font-size: 10px; color: #38bdf8; background: rgba(56,189,248,0.12); padding: 2px 8px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(56,189,248,0.25);">
              ${isFa ? 'فید زنده' : 'Live Feed'}
            </span>
          </div>

          <!-- Category Filter Pills -->
          <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px;">
            <button class="news-cat-btn active" data-cat="all" style="padding: 3px 8px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: #fff; cursor: pointer;">${isFa ? 'همه' : 'All'}</button>
            <button class="news-cat-btn" data-cat="crypto" style="padding: 3px 8px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-dim); cursor: pointer;">${isFa ? 'ارز دیجیتال' : 'Crypto'}</button>
            <button class="news-cat-btn" data-cat="metals" style="padding: 3px 8px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-dim); cursor: pointer;">${isFa ? 'فلزات' : 'Metals'}</button>
            <button class="news-cat-btn" data-cat="forex" style="padding: 3px 8px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-dim); cursor: pointer;">${isFa ? 'فارکس' : 'Forex'}</button>
            <button class="news-cat-btn" data-cat="equities" style="padding: 3px 8px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-dim); cursor: pointer;">${isFa ? 'سهام' : 'Equities'}</button>
            <button class="news-cat-btn" data-cat="commodities" style="padding: 3px 8px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: var(--text-dim); cursor: pointer;">${isFa ? 'کالاها' : 'Commodities'}</button>
          </div>

          <!-- Quick Search Filter -->
          <div style="position: relative;">
            <input type="text" id="news-search-input" placeholder="${isFa ? 'جستجو در اخبار و نمادها...' : 'Search headlines & symbols...'}" style="width: 100%; height: 28px; padding: 4px 8px; font-size: 11px; background: var(--bg-card); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px;" />
          </div>
        </div>

        <!-- News Feed List -->
        <div id="news-items-container" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateNewsList();
  }

  bindEvents() {
    // Category pills
    this.container.querySelectorAll('.news-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.news-cat-btn').forEach(b => {
          b.classList.remove('active');
          b.style.color = 'var(--text-dim)';
        });
        btn.classList.add('active');
        btn.style.color = '#fff';
        this.currentCategory = btn.getAttribute('data-cat');
        this.fetchNews();
      });
    });

    // Search input
    const searchInp = this.container.querySelector('#news-search-input');
    searchInp?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.updateNewsList();
    });
  }

  updateNewsList() {
    const listEl = this.container?.querySelector('#news-items-container');
    if (!listEl) return;
    const isFa = getLanguage() === 'fa';

    let filtered = this.newsItems;
    if (this.searchQuery) {
      filtered = filtered.filter(item => {
        const title = (isFa ? item.titleFa : item.titleEn).toLowerCase();
        const summary = (isFa ? item.summaryFa : item.summaryEn).toLowerCase();
        const sym = item.symbol.toLowerCase();
        return title.includes(this.searchQuery) || summary.includes(this.searchQuery) || sym.includes(this.searchQuery);
      });
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 30px 10px; text-align: center; color: var(--text-dim); font-size: 12px;">
          ${isFa ? 'خبری مطابق با فیلتر جاری یافت نشد.' : 'No headlines matched active filter.'}
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(item => {
      const title = isFa ? item.titleFa : item.titleEn;
      const summary = isFa ? item.summaryFa : item.summaryEn;
      const sentimentColor = item.sentiment === 'bullish' ? 'var(--accent-green)' : item.sentiment === 'bearish' ? 'var(--accent-red)' : 'var(--text-dim)';
      const sentimentBadge = item.sentiment === 'bullish'
        ? (isFa ? '🟢 صعودی' : '🟢 Bullish')
        : item.sentiment === 'bearish'
          ? (isFa ? '🔴 نزولی' : '🔴 Bearish')
          : (isFa ? '⚪ خنثی' : '⚪ Neutral');
      const impactBadge = item.impact === 'high'
        ? `<span style="color: #f59e0b; font-size: 10px; font-weight: 700;">🔥 ${isFa ? 'تأثیر بالا' : 'High Impact'}</span>`
        : '';

      const diffMins = Math.max(1, Math.round((Date.now() - (item.timestamp || Date.now())) / 60000));
      const timeAgoStr = isFa
        ? (diffMins < 60 ? `${diffMins} دقیقه قبل` : `${Math.floor(diffMins / 60)} ساعت قبل`)
        : (diffMins < 60 ? `${diffMins}m ago` : `${Math.floor(diffMins / 60)}h ago`);

      return `
        <div class="news-feed-card" style="padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 6px; display: flex; flex-direction: column; gap: 6px; transition: border-color 0.15s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="news-sym-pill num-ltr" data-symbol="${item.symbol}" title="${isFa ? 'مشاهده چارت' : 'Switch Chart'}" style="background: rgba(0,242,176,0.12); color: var(--accent-green); border: 1px solid rgba(0,242,176,0.25); border-radius: 3px; font-weight: 800; font-size: 10px; padding: 1px 5px; cursor: pointer;">
                ${item.symbol}
              </button>
              <span style="font-size: 10px; color: var(--text-dim);">${item.source}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${impactBadge}
              <span style="font-size: 10px; color: ${sentimentColor}; font-weight: 700;">${sentimentBadge}</span>
              <span style="font-size: 10px; color: var(--text-dim);">${timeAgoStr}</span>
            </div>
          </div>

          <div style="font-size: 12px; font-weight: 700; color: #fff; line-height: 1.4;">
            ${title}
          </div>

          <div style="font-size: 11px; color: var(--text-muted); line-height: 1.45;">
            ${summary}
          </div>
        </div>
      `;
    }).join('');

    // Symbol pill click handlers
    listEl.querySelectorAll('.news-sym-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const sym = pill.getAttribute('data-symbol');
        if (sym && this.app) {
          this.app.chartManager?.setSymbol(sym);
          this.app.showExecutionToast('SYMBOL', 1, sym);
        }
      });
    });
  }
}
