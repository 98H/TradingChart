// client/src/marketTrackersView.js
// Alternative data feeds viewer (Congressional Trades, Insider Trading, 13F, FINRA) with Full Persian Localization

import { getLanguage, t } from './i18n.js';

export class MarketTrackersView {
  constructor(options = {}) {
    this.container = options.container;
    this.data = null;
    this.activeSubTab = 'congress';
    this.searchQuery = '';
    this.render();
    this.fetchData();
  }

  async fetchData() {
    try {
      const res = await fetch('/api/market-trackers');
      if (res.ok) {
        this.data = await res.json();
        this.updateContent();
      }
    } catch (e) {
      console.warn('[Trackers] Failed to load data:', e.message);
    }
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow: hidden;">
        <!-- Subtabs -->
        <div style="height: 36px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 4px; padding: 0 12px;">
          <button class="subtab-btn ${this.activeSubTab === 'congress' ? 'active' : ''}" data-sub="congress" style="background: transparent; border: none; font-size: 11px; font-weight: 700; color: ${this.activeSubTab === 'congress' ? 'var(--accent-cyan)' : 'var(--text-dim)'}; padding: 4px 10px; cursor: pointer; border-radius: 4px;">
            ${isFa ? 'معاملات نمایندگان کنگره آمریکا' : 'Congressional Stock Trades'}
          </button>
          <button class="subtab-btn ${this.activeSubTab === 'insider' ? 'active' : ''}" data-sub="insider" style="background: transparent; border: none; font-size: 11px; font-weight: 700; color: ${this.activeSubTab === 'insider' ? 'var(--accent-cyan)' : 'var(--text-dim)'}; padding: 4px 10px; cursor: pointer; border-radius: 4px;">
            ${isFa ? 'معاملات مدیران ارشد (Form 4)' : 'SEC Form 4 Insider Trades'}
          </button>
          <button class="subtab-btn ${this.activeSubTab === '13f' ? 'active' : ''}" data-sub="13f" style="background: transparent; border: none; font-size: 11px; font-weight: 700; color: ${this.activeSubTab === '13f' ? 'var(--accent-cyan)' : 'var(--text-dim)'}; padding: 4px 10px; cursor: pointer; border-radius: 4px;">
            ${isFa ? 'پرتفوی صندوق‌های تامینی (13F)' : 'Hedge Fund 13F Portfolios'}
          </button>
          <button class="subtab-btn ${this.activeSubTab === 'short_vol' ? 'active' : ''}" data-sub="short_vol" style="background: transparent; border: none; font-size: 11px; font-weight: 700; color: ${this.activeSubTab === 'short_vol' ? 'var(--accent-cyan)' : 'var(--text-dim)'}; padding: 4px 10px; cursor: pointer; border-radius: 4px;">
            ${isFa ? 'حجم معاملات شورت FINRA' : 'FINRA Short Sale Volume'}
          </button>
          <input type="text" id="tracker-filter-input" placeholder="${isFa ? 'جستجوی نماد یا نام شخص...' : 'Search ticker or name...'}" style="margin-inline-start: auto; height: 26px; padding: 2px 8px; font-size: 11px; width: 180px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-card); color: #fff;" />
        </div>

        <!-- Body Area -->
        <div id="tracker-body-area" style="flex: 1; overflow-y: auto; padding: 12px;">
          <div style="color: var(--text-dim); font-size: 12px; padding: 16px; text-align: center;">
            ${isFa ? 'در حال بارگذاری گزارش‌های رسمی شفافیت وال‌استریت...' : 'Loading verified government disclosures...'}
          </div>
        </div>
      </div>
    `;

    const filterInput = this.container.querySelector('#tracker-filter-input');
    filterInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.updateContent();
    });

    this.container.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.subtab-btn').forEach(b => {
          b.style.color = 'var(--text-dim)';
          b.classList.remove('active');
        });
        btn.style.color = 'var(--accent-cyan)';
        btn.classList.add('active');
        this.activeSubTab = btn.getAttribute('data-sub');
        this.updateContent();
      });
    });
  }

  updateContent() {
    const body = this.container.querySelector('#tracker-body-area');
    if (!body || !this.data) return;
    const isFa = getLanguage() === 'fa';

    const filterRows = (arr) => {
      if (!this.searchQuery) return arr;
      return arr.filter(item => JSON.stringify(item).toLowerCase().includes(this.searchQuery));
    };

    if (this.activeSubTab === 'congress') {
      const rows = filterRows(this.data.congressionalTrades || []);
      body.innerHTML = `
        <table class="data-table" style="width: 100%; text-align: ${isFa ? 'right' : 'left'};">
          <thead>
            <tr>
              <th>${isFa ? 'عضو کنگره / شخص' : 'Member of Congress'}</th>
              <th>${isFa ? 'مجلس' : 'Chamber'}</th>
              <th>${isFa ? 'دارایی / سهم' : 'Asset / Description'}</th>
              <th>${isFa ? 'نوع معامله' : 'Type'}</th>
              <th>${isFa ? 'تاریخ معامله' : 'Transaction Date'}</th>
              <th>${isFa ? 'مبلغ' : 'Amount'}</th>
              <th>${isFa ? 'منبع رسمی' : 'Official Source'}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="font-weight: 700; color: #fff;">${r.member}</td>
                <td><span style="font-size: 10px; padding: 1px 6px; border-radius: 3px; background: var(--bg-card);">${r.chamber}</span></td>
                <td><b style="color: var(--accent-cyan);">${r.asset}</b> - <span style="font-size: 11px; color: var(--text-dim);">${r.assetDescription}</span></td>
                <td><span style="color: ${r.txType.includes('Purchase') ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 700;">${isFa ? (r.txType.includes('Purchase') ? 'خرید (Purchase)' : 'فروش (Sale)') : r.txType}</span></td>
                <td class="num-ltr">${r.txDate}</td>
                <td class="num-ltr" style="font-weight: 700;">${r.amount}</td>
                <td><a href="${r.sourceUrl}" target="_blank" style="color: var(--accent-cyan); text-decoration: none; font-size: 11px;">${isFa ? 'مشاهده سند رسمی ↗' : 'View Disclosure PDF ↗'}</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (this.activeSubTab === 'insider') {
      const rows = filterRows(this.data.insiderTrades || []);
      body.innerHTML = `
        <table class="data-table" style="width: 100%; text-align: ${isFa ? 'right' : 'left'};">
          <thead>
            <tr>
              <th>${isFa ? 'شرکت' : 'Company'}</th>
              <th>${isFa ? 'نام مدیر ارشد' : 'Insider Name'}</th>
              <th>${isFa ? 'سمت / رابطه' : 'Title / Relationship'}</th>
              <th>${isFa ? 'نوع معامله' : 'Type'}</th>
              <th>${isFa ? 'تاریخ ثبت' : 'Filing Date'}</th>
              <th>${isFa ? 'تعداد سهام' : 'Shares'}</th>
              <th>${isFa ? 'قیمت' : 'Price'}</th>
              <th>${isFa ? 'ارزش کل' : 'Total Value'}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="font-weight: 700; color: var(--accent-cyan);">${r.company}</td>
                <td style="font-weight: 600; color: #fff;">${r.insider}</td>
                <td><span style="font-size: 11px; color: var(--text-dim);">${r.relationship}</span></td>
                <td><span style="color: ${r.txType.includes('Purchase') ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 700;">${isFa ? (r.txType.includes('Purchase') ? 'خرید (Purchase)' : 'فروش (Sale)') : r.txType}</span></td>
                <td class="num-ltr">${r.filingDate}</td>
                <td class="num-ltr">${r.shares.toLocaleString()}</td>
                <td class="num-ltr">$${r.price.toFixed(2)}</td>
                <td class="num-ltr" style="font-weight: 800; color: var(--accent-gold);">$${r.value.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (this.activeSubTab === '13f') {
      const funds = filterRows(this.data.hedgeFund13F || []);
      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${funds.map(f => `
            <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 14px; font-weight: 800; color: #fff;">${f.fund} <span style="font-size: 11px; color: var(--text-dim); font-weight: 400;">(${f.manager})</span></div>
                <div style="font-size: 11px; color: var(--accent-cyan); font-weight: 600;">${isFa ? 'دوره گزارش:' : 'Report:'} ${f.period}</div>
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${f.topHoldings.map(h => `
                  <div style="background: var(--bg-surface); padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                    <div style="font-size: 11px; font-weight: 700; color: var(--accent-cyan);">${h.ticker} (${h.pctPortfolio}%)</div>
                    <div style="font-size: 10px; color: var(--text-dim);">${h.name}</div>
                    <div style="font-size: 10px; font-weight: 700; color: #fff; margin-top: 2px;" class="num-ltr">$${h.valueB}B</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (this.activeSubTab === 'short_vol') {
      const rows = filterRows(this.data.finraShortVolume || []);
      body.innerHTML = `
        <table class="data-table" style="width: 100%; text-align: ${isFa ? 'right' : 'left'};">
          <thead>
            <tr>
              <th>${isFa ? 'نماد' : 'Symbol'}</th>
              <th>${isFa ? 'تاریخ گزارش' : 'Reporting Date'}</th>
              <th>${isFa ? 'حجم معاملات شورت' : 'Short Sale Volume'}</th>
              <th>${isFa ? 'حجم کل معاملات' : 'Total Market Volume'}</th>
              <th>${isFa ? 'نسبت شورت (%)' : 'Short Volume Ratio (%)'}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="font-weight: 700; color: var(--accent-cyan);">${r.symbol}</td>
                <td class="num-ltr">${r.date}</td>
                <td class="num-ltr">${r.shortVolume.toLocaleString()}</td>
                <td class="num-ltr">${r.totalVolume.toLocaleString()}</td>
                <td class="num-ltr" style="font-weight: 800; color: ${r.shortRatioPct > 50 ? 'var(--accent-red)' : 'var(--accent-green)'};">
                  ${r.shortRatioPct.toFixed(2)}%
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }
}
