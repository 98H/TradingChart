// client/src/marketTrackersView.js
// Alternative data feeds viewer (Congressional Trades, Insider Trading, 13F, FINRA)

export class MarketTrackersView {
  constructor(options = {}) {
    this.container = options.container;
    this.data = null;
    this.activeSubTab = 'congress';
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
    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow: hidden;">
        <!-- Subtabs -->
        <div style="height: 36px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 4px; padding: 0 12px;">
          <button class="subtab-btn active" data-sub="congress" style="background: transparent; border: none; font-size: 11px; font-weight: 700; color: var(--accent-cyan); padding: 4px 10px; cursor: pointer; border-radius: 4px;">
            Congressional Stock Trades
          </button>
          <button class="subtab-btn" data-sub="insider" style="background: transparent; border: none; font-size: 11px; font-weight: 700; color: var(--text-dim); padding: 4px 10px; cursor: pointer; border-radius: 4px;">
            SEC Form 4 Insider Trades
          </button>
          <button class="subtab-btn" data-sub="13f" style="background: transparent; border: none; font-size: 11px; font-weight: 700; color: var(--text-dim); padding: 4px 10px; cursor: pointer; border-radius: 4px;">
            Hedge Fund 13F Portfolios
          </button>
          <button class="subtab-btn" data-sub="short_vol" style="background: transparent; border: none; font-size: 11px; font-weight: 700; color: var(--text-dim); padding: 4px 10px; cursor: pointer; border-radius: 4px;">
            FINRA Short Sale Volume
          </button>
        </div>

        <!-- Body Area -->
        <div id="tracker-body-area" style="flex: 1; overflow-y: auto; padding: 12px;">
          <div style="color: var(--text-dim); font-size: 12px; padding: 16px; text-align: center;">Loading verified government disclosures...</div>
        </div>
      </div>
    `;

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

    if (this.activeSubTab === 'congress') {
      const rows = this.data.congressionalTrades || [];
      body.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Member of Congress</th>
              <th>Chamber</th>
              <th>Asset / Description</th>
              <th>Type</th>
              <th>Transaction Date</th>
              <th>Amount</th>
              <th>Official Source</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="font-weight: 700; color: #fff;">${r.member}</td>
                <td><span style="font-size: 10px; padding: 1px 6px; border-radius: 3px; background: var(--bg-card);">${r.chamber}</span></td>
                <td><b style="color: var(--accent-cyan);">${r.asset}</b> - <span style="font-size: 11px; color: var(--text-dim);">${r.assetDescription}</span></td>
                <td><span style="color: ${r.txType.includes('Purchase') ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 700;">${r.txType}</span></td>
                <td class="num-ltr">${r.txDate}</td>
                <td class="num-ltr" style="font-weight: 700;">${r.amount}</td>
                <td><a href="${r.sourceUrl}" target="_blank" style="color: var(--accent-cyan); text-decoration: none; font-size: 11px;">View Disclosure PDF ↗</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (this.activeSubTab === 'insider') {
      const rows = this.data.insiderTrades || [];
      body.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Insider Name</th>
              <th>Title / Relationship</th>
              <th>Type</th>
              <th>Filing Date</th>
              <th>Shares</th>
              <th>Price</th>
              <th>Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="font-weight: 700; color: var(--accent-cyan);">${r.company}</td>
                <td style="font-weight: 600; color: #fff;">${r.insider}</td>
                <td><span style="font-size: 11px; color: var(--text-dim);">${r.relationship}</span></td>
                <td><span style="color: ${r.txType.includes('Purchase') ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 700;">${r.txType}</span></td>
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
      const funds = this.data.hedgeFund13F || [];
      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${funds.map(f => `
            <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 14px; font-weight: 800; color: #fff;">${f.fund} <span style="font-size: 11px; color: var(--text-dim); font-weight: 400;">(${f.manager})</span></div>
                <div style="font-size: 11px; color: var(--accent-cyan); font-weight: 600;">Report: ${f.period}</div>
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
      const rows = this.data.finraShortVolume || [];
      body.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Reporting Date</th>
              <th>Short Sale Volume</th>
              <th>Total Market Volume</th>
              <th>Short Volume Ratio (%)</th>
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
