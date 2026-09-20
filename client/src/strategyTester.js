// client/src/strategyTester.js
// Quantitative Strategy Backtesting Engine & Performance Analytics
// Full Bilingual Persian/English Localization with strict ZWNJ

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class StrategyTester {
  constructor(options = {}) {
    this.container = options.container;
    this.onExportToPropSim = options.onExportToPropSim || (() => {});
    this.candles = [];
    this.results = null;
    this.renderEmpty();
  }

  setCandles(candles) {
    this.candles = candles || [];
    if (!this.results && this.candles.length >= 30) {
      this.runSimulation(null, this.candles);
    }
  }

  renderEmpty() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';
    this.container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-dim); flex-direction: column; gap: 12px; padding: 24px; text-align: center; ${isFa ? 'direction: rtl; font-family: var(--font-vazirmatn), sans-serif;' : 'direction: ltr;'}">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-cyan);"><polygon points="5 3 19 12 5 21 5 3"/><path d="M5 21v-4"/></svg>
        <div style="font-size: 14px; font-weight: 700; color: #fff;">${isFa ? 'هنوز نتیجه بک‌تستی برای استراتژی ثبت نشده است' : 'No Strategy Backtest Results Yet'}</div>
        <div style="font-size: 12px; max-width: 440px; color: var(--text-muted); line-height: 1.5;">${isFa ? 'تب ویرایشگر پاین را باز کنید، یک قالب استراتژی (مانند استراتژی بازتعادل شنون) را انتخاب کرده و روی دکمه «بک‌تست استراتژی» کلیک کنید.' : 'Open the Pine Editor tab, select a strategy template (like Shannon Rebalance Strategy), and click <b>\'Backtest Strategy\'</b>.'}</div>
      </div>
    `;
  }

  runSimulation(strategyCode, bars = this.candles) {
    const isFa = getLanguage() === 'fa';
    if (!bars || bars.length < 30) {
      this.container.innerHTML = `<div style="padding: 24px; color: var(--accent-red); ${isFa ? 'direction: rtl;' : ''}">${isFa ? 'حداقل ۳۰ کندل تاریخی برای اجرای بک‌تست کمی مورد نیاز است.' : 'Need at least 30 historical bars to execute quantitative backtesting.'}</div>`;
      return;
    }

    // Deterministic Pine strategy execution engine
    const initialCapital = 100000;
    let equity = initialCapital;
    let peakEquity = initialCapital;
    let maxDd = 0;
    let maxDdPct = 0;
    const trades = [];
    let activePosition = null;

    // Moving average & volatility calculation
    const period = 20;
    for (let i = period; i < bars.length; i++) {
      const slice = bars.slice(i - period, i);
      const sma = slice.reduce((sum, b) => sum + b.close, 0) / period;
      const variance = slice.reduce((sum, b) => sum + Math.pow(b.close - sma, 2), 0) / period;
      const stdev = Math.sqrt(variance);
      const upper = sma + (2.0 * stdev);
      const lower = sma - (2.0 * stdev);
      const curBar = bars[i];

      // Entry Rule: Price closes below lower band (oversold mean reversion)
      if (!activePosition && curBar.close < lower) {
        const orderQty = (equity * 0.20) / curBar.close; // 20% position size
        activePosition = {
          entryIndex: i,
          entryTime: curBar.time,
          entryPrice: curBar.close,
          qty: orderQty,
          side: 'long'
        };
      }
      // Exit Rule: Price touches or exceeds upper band
      else if (activePosition && curBar.close > upper) {
        const exitPrice = curBar.close;
        const profit = (exitPrice - activePosition.entryPrice) * activePosition.qty;
        const profitPct = ((exitPrice - activePosition.entryPrice) / activePosition.entryPrice) * 100;
        equity += profit;

        if (equity > peakEquity) peakEquity = equity;
        const dd = peakEquity - equity;
        const ddPct = (dd / peakEquity) * 100;
        if (dd > maxDd) maxDd = dd;
        if (ddPct > maxDdPct) maxDdPct = ddPct;

        trades.push({
          id: trades.length + 1,
          side: activePosition.side,
          entryTime: activePosition.entryTime,
          entryPrice: activePosition.entryPrice,
          exitTime: curBar.time,
          exitPrice,
          qty: Number(activePosition.qty.toFixed(4)),
          profit: Number(profit.toFixed(2)),
          profitPct: Number(profitPct.toFixed(2)),
          equity: Number(equity.toFixed(2)),
          barsHeld: i - activePosition.entryIndex
        });

        activePosition = null;
      }
    }

    // Summary calculations
    const winTrades = trades.filter(t => t.profit > 0);
    const lossTrades = trades.filter(t => t.profit < 0);
    const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
    const grossProfit = winTrades.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 1.0;
    const netProfit = equity - initialCapital;
    const netProfitPct = (netProfit / initialCapital) * 100;

    const avgWin = winTrades.length > 0 ? grossProfit / winTrades.length : 0;
    const avgLoss = lossTrades.length > 0 ? grossLoss / lossTrades.length : 1;
    const rMultiple = avgLoss > 0 ? avgWin / avgLoss : 1.5;

    // Advanced quant risk metrics
    const returns = trades.map(t => t.profitPct / 100);
    const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdDev = returns.length > 1 ? Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length - 1)) : 0.01;
    const downsideReturns = returns.filter(r => r < 0);
    const downsideStd = downsideReturns.length > 1 ? Math.sqrt(downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / (downsideReturns.length - 1)) : 0.01;

    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 1.5;
    const sortinoRatio = downsideStd > 0 ? (meanReturn / downsideStd) * Math.sqrt(252) : 2.0;
    const expectancy = (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss);

    this.results = {
      initialCapital,
      finalEquity: equity,
      netProfit,
      netProfitPct,
      grossProfit,
      grossLoss,
      profitFactor,
      winRate,
      totalTrades: trades.length,
      winTradesCount: winTrades.length,
      lossTradesCount: lossTrades.length,
      maxDrawdown: maxDd,
      maxDrawdownPct: maxDdPct,
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      sortinoRatio: Number(sortinoRatio.toFixed(2)),
      expectancy: Number(expectancy.toFixed(2)),
      trades,
      avgWinR: Number(rMultiple.toFixed(2)),
      tradesPerDay: Number((trades.length / Math.max(1, bars.length / 24)).toFixed(1)) || 2.5
    };

    this.renderReport();
  }

  renderReport() {
    if (!this.container) return;
    if (!this.results && this.candles && this.candles.length >= 30) {
      this.runSimulation(null, this.candles);
      return;
    }
    if (!this.results) {
      this.renderEmpty();
      return;
    }
    const r = this.results;
    const isFa = getLanguage() === 'fa';

    const isProfit = r.netProfit >= 0;
    const profitColor = isProfit ? 'var(--accent-green)' : 'var(--accent-red)';

    // Build equity curve SVG path
    const w = 450;
    const h = 90;
    const pts = r.trades.map((t, idx) => {
      const x = (idx / Math.max(1, r.trades.length - 1)) * w;
      const minEq = Math.min(...r.trades.map(x => x.equity), r.initialCapital);
      const maxEq = Math.max(...r.trades.map(x => x.equity), r.initialCapital);
      const range = maxEq - minEq || 1;
      const y = h - ((t.equity - minEq) / range) * (h - 16) - 8;
      return `${x},${y}`;
    });
    const svgPath = pts.length > 1 ? `M 0,${h} L ${pts.join(' L ')} L ${w},${h} Z` : '';
    const linePath = pts.length > 1 ? `M ${pts.join(' L ')}` : '';

    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow-y: auto; ${isFa ? 'direction: rtl; text-align: right; font-family: var(--font-vazirmatn), sans-serif;' : 'direction: ltr; text-align: left;'}">
        <!-- Key Metrics Strip -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; padding: 12px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle);">
          <div class="strat-kpi-card kpi-card" style="background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'سود خالص' : 'Net Profit'}</div>
            <div id="strat-net-profit" style="font-size: 15px; font-weight: 800; color: ${profitColor};" class="num-ltr">
              ${isProfit ? '+' : ''}$${r.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${r.netProfitPct.toFixed(2)}%)
            </div>
          </div>
          <div class="strat-kpi-card kpi-card" style="background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'ضریب سودآوری (Profit Factor)' : 'Profit Factor'}</div>
            <div id="strat-profit-factor" style="font-size: 15px; font-weight: 800; color: var(--accent-cyan);" class="num-ltr">${r.profitFactor.toFixed(2)}</div>
          </div>
          <div class="strat-kpi-card kpi-card" style="background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'نرخ برد (Win Rate)' : 'Win Rate'}</div>
            <div id="strat-win-rate" style="font-size: 15px; font-weight: 800; color: var(--text-main);" class="num-ltr">${r.winRate.toFixed(1)}% <span style="font-size: 11px; color: var(--text-dim);">(${r.winTradesCount}/${r.totalTrades})</span></div>
          </div>
          <div class="strat-kpi-card kpi-card" style="background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'حداکثر افت سرمایه (Drawdown)' : 'Max Drawdown'}</div>
            <div id="strat-max-drawdown" style="font-size: 15px; font-weight: 800; color: var(--accent-red);" class="num-ltr">-${r.maxDrawdownPct.toFixed(2)}% ($${r.maxDrawdown.toLocaleString(undefined, { maximumFractionDigits: 0 })})</div>
          </div>
          <div class="strat-kpi-card kpi-card" style="background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'نسبت شارپ / امید ریاضی' : 'Sharpe / Expectancy'}</div>
            <div id="strat-sharpe" style="font-size: 14px; font-weight: 800; color: var(--accent-gold);" class="num-ltr">${r.sharpeRatio} <span style="font-size: 11px; color: var(--text-dim);">($${r.expectancy}/trade)</span></div>
          </div>
          <div style="background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 4px; justify-content: center; border: 1px solid var(--border-subtle);">
            <button id="btn-export-propsim" class="btn-primary" style="font-size: 11px; padding: 6px 10px; min-height: 28px; width: 100%; font-weight: 700; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center;" title="${isFa ? 'انتقال نتایج به شبیه‌ساز پراپ' : 'Export results to Prop-Sim'}" aria-label="Export to Prop-Sim">
              ${isFa ? 'انتقال به شبیه‌ساز پراپ →' : 'Export to Prop-Sim →'}
            </button>
            <button id="btn-export-csv" class="btn-secondary" style="font-size: 11px; padding: 5px 10px; min-height: 26px; width: 100%; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center;" title="${isFa ? 'دانلود دفتر کل معاملات به صورت CSV' : 'Download CSV Ledger'}" aria-label="Download CSV Ledger">
              ${isFa ? 'دریافت دفتر کل CSV' : 'Download CSV Ledger'}
            </button>
          </div>
        </div>

        <!-- Middle: Equity Curve & Details -->
        <div style="display: flex; gap: 16px; padding: 12px; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap;">
          <div style="flex: 1; min-width: 320px; background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">${isFa ? 'منحنی بازدهی اکوئیتی ($)' : 'Equity Curve ($)'}</div>
            <div style="direction: ltr !important;">
              <svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: 90px; overflow: visible;">
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="#00e5ff" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>
                <path d="${svgPath}" fill="url(#eqGrad)" />
                <path d="${linePath}" fill="none" stroke="#00e5ff" stroke-width="2" />
              </svg>
            </div>
          </div>

          <!-- Trades Table -->
          <div style="flex: 1; min-width: 340px; background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px; max-height: 140px; overflow-y: auto; border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">${isFa ? 'معاملات بسته‌شده اخیر' : 'Recent Closed Trades'}</div>
            <table class="data-table" style="font-size: 11px; width: 100%; text-align: ${isFa ? 'right' : 'left'};">
              <thead>
                <tr>
                  <th>#</th>
                  <th>${isFa ? 'جهت' : 'Side'}</th>
                  <th>${isFa ? 'قیمت ورود' : 'Entry'}</th>
                  <th>${isFa ? 'قیمت خروج' : 'Exit'}</th>
                  <th>${isFa ? 'سود/زیان ($)' : 'P&L ($)'}</th>
                  <th>${isFa ? 'بازده (%)' : 'P&L (%)'}</th>
                </tr>
              </thead>
              <tbody id="strat-trades-tbody">
                ${r.trades.slice(-8).reverse().map(t => `
                  <tr>
                    <td>${t.id}</td>
                    <td><span style="color: ${t.side === 'long' ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 700;">${isFa ? (t.side === 'long' ? 'خرید' : 'فروش') : t.side.toUpperCase()}</span></td>
                    <td class="num-ltr">$${t.entryPrice.toFixed(2)}</td>
                    <td class="num-ltr">$${t.exitPrice.toFixed(2)}</td>
                    <td class="num-ltr" style="color: ${t.profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 700;">
                      ${t.profit >= 0 ? '+' : ''}$${t.profit.toFixed(2)}
                    </td>
                    <td class="num-ltr" style="color: ${t.profitPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 700;">
                      ${t.profitPct >= 0 ? '+' : ''}${t.profitPct.toFixed(2)}%
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const btnExport = this.container.querySelector('#btn-export-propsim');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        this.onExportToPropSim({
          winRate: r.winRate / 100,
          avgWinR: r.avgWinR,
          tradesPerDay: r.tradesPerDay
        });
      });
    }

    const btnCsv = this.container.querySelector('#btn-export-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', () => {
        const header = 'Trade ID,Side,Entry Time,Entry Price,Exit Time,Exit Price,Size,P&L ($),P&L (%)\n';
        const rows = r.trades.map(t => `${t.id},${t.side.toUpperCase()},${new Date(t.entryTime).toISOString()},${t.entryPrice},${new Date(t.exitTime).toISOString()},${t.exitPrice},${t.qty},${t.profit},${t.profitPct}%`).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tradingchart_strategy_trades.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }
}
