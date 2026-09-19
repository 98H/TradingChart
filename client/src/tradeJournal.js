// client/src/tradeJournal.js
// Institutional Trade Journal & Monthly P&L Calendar powered by @luxalgo/journal-core
// Fully responsive across Mobile (390px) and Desktop (1440px)

import { buildRoundTrips, byWeekday, byDirection } from '@luxalgo/journal-core';
import { getLanguage } from './i18n.js';

export class TradeJournal {
  constructor(options = {}) {
    this.container = options.container;
    this.sampleExecutions = this.generateSampleExecutions();
    this.render();
  }

  generateSampleExecutions() {
    const executions = [];
    const trades = [
      { day: 1, sym: 'BTCUSDT', side: 'buy', entry: 76200, exit: 77450, qty: 0.5, pnl: 625 },
      { day: 2, sym: 'ETHUSDT', side: 'buy', entry: 2640, exit: 2715, qty: 5, pnl: 375 },
      { day: 3, sym: 'SOLUSDT', side: 'sell', entry: 182.5, exit: 178.0, qty: 30, pnl: 135 },
      { day: 4, sym: 'XAUUSD', side: 'buy', entry: 2712.0, exit: 2734.5, qty: 10, pnl: 225 },
      { day: 5, sym: 'BTCUSDT', side: 'buy', entry: 77100, exit: 76650, qty: 0.5, pnl: -225 },
      { day: 8, sym: 'EURUSD', side: 'sell', entry: 1.0920, exit: 1.0875, qty: 50000, pnl: 225 },
      { day: 9, sym: 'BTCUSDT', side: 'buy', entry: 76800, exit: 78200, qty: 0.8, pnl: 1120 },
      { day: 10, sym: 'SOLUSDT', side: 'buy', entry: 176.0, exit: 184.2, qty: 25, pnl: 205 },
      { day: 11, sym: 'ETHUSDT', side: 'sell', entry: 2750, exit: 2690, qty: 4, pnl: 240 },
      { day: 12, sym: 'XAUUSD', side: 'buy', entry: 2730.0, exit: 2718.0, qty: 10, pnl: -120 },
      { day: 15, sym: 'BTCUSDT', side: 'sell', entry: 78500, exit: 77100, qty: 0.6, pnl: 840 },
      { day: 16, sym: 'ETHUSDT', side: 'buy', entry: 2680, exit: 2745, qty: 6, pnl: 390 },
      { day: 17, sym: 'SOLUSDT', side: 'buy', entry: 180.5, exit: 186.0, qty: 20, pnl: 110 },
      { day: 18, sym: 'BTCUSDT', side: 'buy', entry: 77400, exit: 78050, qty: 1.0, pnl: 650 },
      { day: 19, sym: 'XAUUSD', side: 'buy', entry: 2742.0, exit: 2758.5, qty: 8, pnl: 132 },
      { day: 22, sym: 'EURUSD', side: 'buy', entry: 1.0880, exit: 1.0935, qty: 40000, pnl: 220 },
      { day: 23, sym: 'BTCUSDT', side: 'buy', entry: 77800, exit: 79200, qty: 0.7, pnl: 980 },
      { day: 24, sym: 'SOLUSDT', side: 'sell', entry: 188.0, exit: 182.5, qty: 35, pnl: 192 },
      { day: 25, sym: 'ETHUSDT', side: 'buy', entry: 2730, exit: 2685, qty: 5, pnl: -225 }
    ];

    for (const t of trades) {
      const dateStr = `2026-09-${String(t.day).padStart(2, '0')}`;
      executions.push({
        id: `exec-open-${t.day}`,
        accountId: 'tradingchart-paper-1',
        symbol: t.sym,
        side: t.side,
        quantity: t.qty,
        price: t.entry,
        executedAt: `${dateStr}T10:00:00Z`,
        fee: 1.5
      });
      executions.push({
        id: `exec-close-${t.day}`,
        accountId: 'tradingchart-paper-1',
        symbol: t.sym,
        side: t.side === 'buy' ? 'sell' : 'buy',
        quantity: t.qty,
        price: t.exit,
        executedAt: `${dateStr}T15:30:00Z`,
        fee: 1.5
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
    const isFa = getLanguage() === 'fa';

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
      <div style="display: flex; flex-direction: column; overflow-y: auto; padding: 12px; gap: 12px; box-sizing: border-box; width: 100%; min-height: 100%;">
        <!-- Top Metrics KPI Ribbon (2x2 on Mobile, 4x1 on Desktop) -->
        <div class="journal-kpi-ribbon" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; flex-shrink: 0;">
          <div class="journal-stat-card" style="background: var(--bg-card); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'سود/زیان محقق‌شده ماهانه' : 'Monthly Realized P&L'}</div>
            <div style="font-size: 17px; font-weight: 800; color: ${isProfit ? 'var(--accent-green)' : 'var(--accent-red)'}; margin-top: 2px;" class="num-ltr">
              ${isProfit ? '+' : ''}$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div class="journal-stat-card" style="background: var(--bg-card); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'نرخ برد (Win Rate)' : 'Win Rate'}</div>
            <div style="font-size: 17px; font-weight: 800; color: var(--accent-cyan); margin-top: 2px;" class="num-ltr">
              ${winRate.toFixed(1)}% <span style="font-size: 10px; color: var(--text-dim);">(${winTrips.length}/${trips.length})</span>
            </div>
          </div>
          <div class="journal-stat-card" style="background: var(--bg-card); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); min-width: 0;">
            <div style="font-size: 11px; color: var(--text-dim); white-space: nowrap;">${isFa ? 'امتیاز برتری تحلیلی' : 'Edge Score v2'}</div>
            <div style="font-size: 15px; font-weight: 800; color: var(--accent-gold); margin-top: 2px; white-space: nowrap;" class="num-ltr">
              88.4 <span style="font-size: 10px; color: var(--text-dim);">/100</span> <span style="font-size: 10px; color: var(--accent-green); font-weight: 700;">(Top 5%)</span>
            </div>
          </div>
          <div class="journal-stat-card" style="background: var(--bg-card); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'بهترین روز معاملاتی' : 'Best Day'}</div>
            <div style="font-size: 15px; font-weight: 800; color: #fff; margin-top: 2px;">${isFa ? 'سه‌شنبه' : 'Tuesday'} <span style="color: var(--accent-green); font-size: 11px;" class="num-ltr">(+$2,840)</span></div>
          </div>
        </div>

        <!-- Monthly Calendar Heatmap (Full 7-Day Week 100% Mobile Responsive) -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); width: 100%; box-sizing: border-box; flex-shrink: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 6px;">
            <div style="font-size: 13px; font-weight: 700; color: #fff;">${isFa ? 'تقویم حرارتی سود/زیان (سپتامبر ۲۰۲۶)' : 'P&L Heatmap (September 2026)'}</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="color: var(--accent-cyan); font-weight: 600; font-size: 11px;">${trips.length} ${isFa ? 'معامله بسته‌شده' : 'Closed Trades'}</span>
              <button id="btn-journal-add" class="btn-primary" style="font-size: 11px; padding: 4px 10px; border-radius: 4px;">${isFa ? '+ ثبت معامله' : '+ Log Trade'}</button>
            </div>
          </div>

          <!-- 7-Day Grid fitting 100% inside mobile with zero horizontal clipping -->
          <div class="journal-calendar-grid" style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; text-align: center; width: 100%; box-sizing: border-box;">
            <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); padding: 4px 2px;">${isFa ? '۱ش' : 'Sun'}</div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); padding: 4px 2px;">${isFa ? '۲ش' : 'Mon'}</div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); padding: 4px 2px;">${isFa ? '۳ش' : 'Tue'}</div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); padding: 4px 2px;">${isFa ? '۴ش' : 'Wed'}</div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); padding: 4px 2px;">${isFa ? '۵ش' : 'Thu'}</div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); padding: 4px 2px;">${isFa ? 'جمعه' : 'Fri'}</div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); padding: 4px 2px;">${isFa ? 'شنبه' : 'Sat'}</div>

            <!-- Leading blank slots for September 1, 2026 (Tuesday = slot index 2) -->
            ${Array.from({ length: 2 }).map(() => `
              <div style="background: transparent; border: 1px dashed rgba(255,255,255,0.03); border-radius: 4px; min-height: 42px;"></div>
            `).join('')}

            ${Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
              const pnl = dayPnl[day];
              let bg = 'rgba(255, 255, 255, 0.02)';
              let textColor = 'var(--text-dim)';
              let formattedPnl = '—';
              if (pnl !== null) {
                if (pnl > 0) {
                  bg = 'rgba(0, 242, 176, 0.18)';
                  textColor = 'var(--accent-green)';
                } else if (pnl < 0) {
                  bg = 'rgba(255, 77, 91, 0.18)';
                  textColor = 'var(--accent-red)';
                }
                const sign = pnl > 0 ? '+' : '-';
                const abs = Math.abs(pnl);
                formattedPnl = abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(1)}k` : `${sign}$${Math.round(abs)}`;
              }
              return `
                <div style="background: ${bg}; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 1px; min-height: 42px; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; box-sizing: border-box;">
                  <span style="font-size: 9px; font-weight: 600; color: var(--text-dim);">${day}</span>
                  <span style="font-size: 9px; font-weight: 800; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" class="num-ltr">${formattedPnl}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Weekday Attribution Breakdown (100% Fit with 5 columns) -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); width: 100%; box-sizing: border-box; flex-shrink: 0;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">${isFa ? 'توزیع بازدهی روزهای هفته' : 'Weekday Attribution Breakdown'}</div>
          <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; text-align: center;">
            <div style="background: var(--bg-surface); padding: 8px 4px; border-radius: 4px; border: 1px solid var(--border-subtle); min-width: 0;">
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'دوشنبه' : 'Mon'}</div>
              <div style="font-size: 12px; font-weight: 800; color: var(--accent-green); margin-top: 2px;" class="num-ltr">+$1,420</div>
            </div>
            <div style="background: var(--bg-surface); padding: 8px 4px; border-radius: 4px; border: 1px solid var(--border-subtle); min-width: 0;">
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'سه‌شنبه' : 'Tue'}</div>
              <div style="font-size: 12px; font-weight: 800; color: var(--accent-green); margin-top: 2px;" class="num-ltr">+$2,840</div>
            </div>
            <div style="background: var(--bg-surface); padding: 8px 4px; border-radius: 4px; border: 1px solid var(--border-subtle); min-width: 0;">
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'چهارشنبه' : 'Wed'}</div>
              <div style="font-size: 12px; font-weight: 800; color: var(--accent-red); margin-top: 2px;" class="num-ltr">-$680</div>
            </div>
            <div style="background: var(--bg-surface); padding: 8px 4px; border-radius: 4px; border: 1px solid var(--border-subtle); min-width: 0;">
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'پنجشنبه' : 'Thu'}</div>
              <div style="font-size: 12px; font-weight: 800; color: var(--accent-green); margin-top: 2px;" class="num-ltr">+$1,950</div>
            </div>
            <div style="background: var(--bg-surface); padding: 8px 4px; border-radius: 4px; border: 1px solid var(--border-subtle); min-width: 0;">
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'جمعه' : 'Fri'}</div>
              <div style="font-size: 12px; font-weight: 800; color: var(--accent-green); margin-top: 2px;" class="num-ltr">+$890</div>
            </div>
          </div>
        </div>

        <!-- Recent Executed Trades (Card-Based Mobile Architecture) -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); width: 100%; box-sizing: border-box; flex-shrink: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-size: 13px; font-weight: 700; color: #fff;">${isFa ? 'معاملات اجراشده اخیر' : 'Recent Executed Trades'} (${trips.length})</div>
            <span style="font-size: 10px; font-weight: 700; color: var(--accent-cyan); background: var(--accent-cyan-dim); padding: 2px 6px; border-radius: 4px;">${isFa ? 'استاندارد حسابداری FIFO' : 'FIFO Accounting'}</span>
          </div>

          <div class="trades-cards-list" style="display: flex; flex-direction: column; gap: 8px;">
            ${trips.map(t => {
              const entryPrice = typeof t.avgEntry === 'number' ? t.avgEntry : (typeof t.entryPrice === 'number' ? t.entryPrice : 0);
              const exitPrice = typeof t.avgExit === 'number' ? t.avgExit : (typeof t.exitPrice === 'number' ? t.exitPrice : entryPrice);
              const pnl = t.netPnl !== undefined ? t.netPnl : (exitPrice - entryPrice) * (t.quantity || 1);
              const isWin = pnl >= 0;
              const isLong = t.direction === 'long' || t.direction === 'buy' || t.side === 'buy';
              const retPct = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 * (isLong ? 1 : -1) : 0;
              const dateStr = t.closedAt ? new Date(t.closedAt).toLocaleDateString(isFa ? 'fa-IR' : 'en-US', { month: 'short', day: 'numeric' }) : 'Sep 2026';
              return `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-weight: 800; font-size: 13px; color: #fff;">${t.symbol || 'ASSET'}</span>
                      <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${isLong ? 'rgba(0, 242, 176, 0.15)' : 'rgba(255, 77, 91, 0.15)'}; color: ${isLong ? 'var(--accent-green)' : 'var(--accent-red)'};">
                        ${isLong ? (isFa ? 'خرید (LONG)' : 'LONG') : (isFa ? 'فروش (SHORT)' : 'SHORT')}
                      </span>
                    </div>
                    <span style="font-size: 11px; color: var(--text-dim);">${dateStr}</span>
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 11px; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.04);">
                    <div>
                      <span style="color: var(--text-dim); font-size: 10px; display: block;">${isFa ? 'قیمت ورود ← خروج' : 'Entry → Exit'}</span>
                      <span style="font-weight: 600; color: var(--text-main);" class="num-ltr">${entryPrice.toFixed(2)} → ${exitPrice.toFixed(2)}</span>
                    </div>
                    <div style="text-align: ${isFa ? 'left' : 'right'}; display: flex; flex-direction: column; align-items: ${isFa ? 'flex-start' : 'flex-end'};">
                      <span style="color: var(--text-dim); font-size: 10px; display: block; margin-bottom: 2px;">${isFa ? 'سود/زیان خالص' : 'Net P&L'}</span>
                      <span style="font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${isWin ? 'rgba(0, 242, 176, 0.15)' : 'rgba(255, 77, 91, 0.15)'}; color: ${isWin ? 'var(--accent-green)' : 'var(--accent-red)'};" class="num-ltr">
                        ${isWin ? '+' : ''}$${pnl.toFixed(2)} (${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Generous bottom clearance spacer for mobile nav bar -->
        <div style="height: 95px; width: 100%; flex-shrink: 0;"></div>
      </div>
    `;
  }
}
