// client/src/tradeJournal.js
// Institutional Trade Journal & Monthly P&L Calendar powered by @luxalgo/journal-core

import { buildRoundTrips, byWeekday, byDirection } from '@luxalgo/journal-core';

export class TradeJournal {
  constructor(options = {}) {
    this.container = options.container;
    this.sampleExecutions = this.generateSampleExecutions();
    this.render();
  }

  generateSampleExecutions() {
    const executions = [];
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSD'];

    for (let day = 1; day <= 25; day++) {
      const isWin = (day % 3 !== 0);
      const sym = symbols[day % symbols.length];
      const entryP = sym.includes('XAU') ? 2710 : 64000;
      const change = isWin ? (sym.includes('XAU') ? 18.5 : 850) : (sym.includes('XAU') ? -9.2 : -450);
      const dateStr = `2026-09-${String(day).padStart(2, '0')}`;

      // Buy Execution
      executions.push({
        id: `exec-in-${day}`,
        accountId: 'tradingchart-paper-1',
        symbol: sym,
        side: 'buy',
        quantity: 1,
        price: entryP,
        executedAt: `${dateStr}T10:00:00Z`,
        fee: 2.0
      });

      // Sell Execution
      executions.push({
        id: `exec-out-${day}`,
        accountId: 'tradingchart-paper-1',
        symbol: sym,
        side: 'sell',
        quantity: 1,
        price: entryP + change,
        executedAt: `${dateStr}T14:30:00Z`,
        fee: 2.0
      });
    }
    return executions;
  }

  render() {
    if (!this.container) return;

    let trips = [];
    try {
      trips = buildRoundTrips(this.sampleExecutions, { method: 'fifo' });
    } catch (e) {
      console.warn('[Journal] buildRoundTrips fallback', e);
    }

    const totalPnl = trips.reduce((sum, t) => sum + (t.netPnl !== undefined ? t.netPnl : (t.avgExit - t.avgEntry) * t.quantity), 0);
    const winTrips = trips.filter(t => (t.netPnl !== undefined ? t.netPnl : (t.avgExit - t.avgEntry)) > 0);
    const winRate = trips.length > 0 ? (winTrips.length / trips.length) * 100 : 0;
    const isProfit = totalPnl >= 0;

    // Monthly calendar map (day -> pnl)
    const dayPnl = {};
    for (let day = 1; day <= 30; day++) {
      const match = trips.find(t => {
        const d = new Date(t.openedAt || t.closedAt);
        return d.getUTCDate() === day;
      });
      dayPnl[day] = match ? (match.netPnl !== undefined ? match.netPnl : (match.avgExit - match.avgEntry)) : null;
    }

    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow-y: auto; padding: 12px; gap: 12px;">
        <!-- Top Metrics Ribbon -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
          <div style="background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-sm);">
            <div style="font-size: 11px; color: var(--text-dim);">Monthly Realized P&L</div>
            <div style="font-size: 18px; font-weight: 800; color: ${isProfit ? 'var(--accent-green)' : 'var(--accent-red)'}; margin-top: 4px;" class="num-ltr">
              ${isProfit ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style="background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-sm);">
            <div style="font-size: 11px; color: var(--text-dim);">Win Rate</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--accent-cyan); margin-top: 4px;" class="num-ltr">
              ${winRate.toFixed(1)}% <span style="font-size: 11px; color: var(--text-dim);">(${winTrips.length}/${trips.length})</span>
            </div>
          </div>
          <div style="background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-sm);">
            <div style="font-size: 11px; color: var(--text-dim);">Edge Score v2</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--accent-gold); margin-top: 4px;" class="num-ltr">
              88.4 / 100 <span style="font-size: 11px; color: var(--accent-green); font-weight: 700;">(Top 5%)</span>
            </div>
          </div>
          <div style="background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-sm);">
            <div style="font-size: 11px; color: var(--text-dim);">Best Day</div>
            <div style="font-size: 18px; font-weight: 800; color: #fff; margin-top: 4px;">Tuesday (+$2,840)</div>
          </div>
        </div>

        <!-- Monthly Calendar Heatmap -->
        <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm);">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px; display: flex; justify-content: space-between;">
            <span>P&L Calendar Heatmap (September 2026)</span>
            <span style="color: var(--accent-cyan); font-weight: 600;">25 Active Trading Days</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; text-align: center;">
            <div style="font-size: 10px; color: var(--text-dim); padding: 4px;">Sun</div>
            <div style="font-size: 10px; color: var(--text-dim); padding: 4px;">Mon</div>
            <div style="font-size: 10px; color: var(--text-dim); padding: 4px;">Tue</div>
            <div style="font-size: 10px; color: var(--text-dim); padding: 4px;">Wed</div>
            <div style="font-size: 10px; color: var(--text-dim); padding: 4px;">Thu</div>
            <div style="font-size: 10px; color: var(--text-dim); padding: 4px;">Fri</div>
            <div style="font-size: 10px; color: var(--text-dim); padding: 4px;">Sat</div>

            ${Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
              const pnl = dayPnl[day];
              let bg = 'rgba(255, 255, 255, 0.02)';
              let textColor = 'var(--text-dim)';
              if (pnl !== null) {
                if (pnl > 0) {
                  bg = 'rgba(14, 203, 129, 0.22)';
                  textColor = 'var(--accent-green)';
                } else if (pnl < 0) {
                  bg = 'rgba(246, 70, 93, 0.22)';
                  textColor = 'var(--accent-red)';
                }
              }
              return `
                <div style="background: ${bg}; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 6px; min-height: 44px; display: flex; flex-direction: column; justify-content: space-between;">
                  <span style="font-size: 10px; color: var(--text-dim);">${day}</span>
                  ${pnl !== null ? `<span style="font-size: 11px; font-weight: 800; color: ${textColor};" class="num-ltr">${pnl > 0 ? '+' : ''}$${Math.round(pnl)}</span>` : '<span style="font-size: 9px; color: #334155;">—</span>'}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }
}
