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
    this.lastCode = null;
    this.running = false;
    this.renderEmpty();
  }

  /** New candles: re-run the LAST strategy the user actually backtested (if any).
   *  Never auto-runs an invented strategy — no code, no report. */
  setCandles(candles) {
    this.candles = candles || [];
    if (this.lastCode && !this.running) this.runSimulation(this.lastCode, this.candles, { silent: true });
  }

  renderEmpty() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';
    this.container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-dim); flex-direction: column; gap: 12px; padding: 24px; text-align: center; ${isFa ? 'direction: rtl; font-family: var(--font-vazirmatn), sans-serif;' : 'direction: ltr;'}">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-cyan);"><polygon points="5 3 19 12 5 21 5 3"/><path d="M5 21v-4"/></svg>
        <div style="font-size: 14px; font-weight: 700; color: var(--text-main);">${isFa ? 'هنوز بک‌تستی اجرا نشده است' : 'No Strategy Backtest Results Yet'}</div>
        <div style="font-size: 12px; max-width: 440px; color: var(--text-muted); line-height: 1.7;">${isFa ? 'در ویرایشگر پاین یک اسکریپت <code>strategy()</code> بنویسید یا یکی از قالب‌ها را انتخاب کنید، سپس روی «بک‌تست استراتژی» بزنید. نتایج دقیقاً از اجرای همان کد روی کندل‌های چارت محاسبه می‌شود.' : 'Write a <code>strategy()</code> script in the Pine Editor (or pick a template) and click <b>Backtest Strategy</b>. Results are computed by running exactly that code on the chart\'s candles.'}</div>
      </div>
    `;
  }

  renderMessage(msg, tone = 'error') {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';
    const color = tone === 'error' ? 'var(--accent-red)' : 'var(--text-dim)';
    this.container.innerHTML = `<div style="padding: 24px; color: ${color}; line-height: 1.7; font-size: 12px; ${isFa ? 'direction: rtl; font-family: var(--font-vazirmatn), sans-serif;' : ''}">${msg}</div>`;
  }

  /**
   * Execute the user's Pine strategy() with the real PineTS runtime on the
   * chart's candles and build the report from the engine's own closed trades
   * (TradingView semantics: fills, sizing, initial_capital from the script).
   */
  async runSimulation(strategyCode, bars = this.candles, opts = {}) {
    const isFa = getLanguage() === 'fa';
    const esc = (x) => String(x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    if (!strategyCode || !/\bstrategy\s*\(/.test(strategyCode)) {
      if (!opts.silent) this.renderMessage(isFa
        ? 'این اسکریپت یک استراتژی نیست. بک‌تست فقط برای اسکریپت‌هایی که با <code>strategy()</code> تعریف شده‌اند و دستور <code>strategy.entry</code> دارند معنا دارد. اندیکاتورها را با «افزودن به چارت» اجرا کنید.'
        : 'This script is not a strategy. Backtesting needs a <code>strategy()</code> declaration with <code>strategy.entry</code> calls. Use “Add to chart” for indicators.');
      return;
    }
    if (!bars || bars.length < 30) {
      this.renderMessage(isFa ? 'حداقل ۳۰ کندل تاریخی برای اجرای بک‌تست لازم است.' : 'Need at least 30 historical bars to run a backtest.');
      return;
    }
    this.lastCode = strategyCode;
    this.running = true;
    if (!opts.silent) this.renderMessage(isFa ? `در حال اجرای استراتژی روی ${toPersianDigits(String(bars.length))} کندل…` : `Running strategy on ${bars.length} bars…`, 'info');
    let st;
    try {
      const { PineTS, Indicator } = await import('pinets');
      const md = bars.map(b => ({ openTime: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0, closeTime: b.closeTime }));
      const sym = (window.__TRADING_APP__?.currentSymbol || 'BTCUSDT').replace(/^.*:/, '');
      const tf = String(window.__TRADING_APP__?.currentTimeframe || '60');
      const provider = {
        getMarketData: async () => md,
        getSymbolInfo: async () => ({ ticker: sym, tickerid: sym, description: sym, type: 'crypto', currency: 'USD', timezone: 'UTC', session: '24x7', mintick: 0.01, pricescale: 100, pointvalue: 1, minmove: 1 })
      };
      const engine = new PineTS(provider, sym, tf, md.length);
      await engine.ready();
      const ctx = await engine.run(new Indicator(strategyCode));
      st = ctx?.fullContext?.strategy ?? ctx?.strategy;
    } catch (e) {
      this.running = false;
      this.renderMessage((isFa ? '<b>خطا در اجرای استراتژی:</b><br>' : '<b>Strategy runtime error:</b><br>') + esc(e?.message || e));
      return;
    }
    this.running = false;
    if (!st) {
      this.renderMessage(isFa ? 'موتور پاین برای این اسکریپت وضعیت استراتژی برنگرداند.' : 'The Pine engine returned no strategy state for this script.');
      return;
    }

    const initialCapital = Number(st.initial_capital) || 100000;
    const closed = Array.isArray(st.closedtrades) ? st.closedtrades : [];
    let equity = initialCapital, peakEquity = initialCapital, maxDd = 0, maxDdPct = 0;
    const trades = closed
      .filter(t => Number.isFinite(Number(t.exit_price)) && Number(t.size))
      .sort((x, y) => Number(x.exit_time) - Number(y.exit_time))
      .map((t, i) => {
        const size = Number(t.size);
        const side = size > 0 ? 'long' : 'short';
        const entryPrice = Number(t.entry_price), exitPrice = Number(t.exit_price);
        const profit = Number.isFinite(Number(t.profit)) ? Number(t.profit) : (exitPrice - entryPrice) * size;
        equity += profit;
        if (equity > peakEquity) peakEquity = equity;
        const dd = peakEquity - equity;
        if (dd > maxDd) maxDd = dd;
        const ddPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
        if (ddPct > maxDdPct) maxDdPct = ddPct;
        return {
          id: i + 1, side,
          entryTime: Number(t.entry_time), entryPrice,
          exitTime: Number(t.exit_time), exitPrice,
          qty: Number(Math.abs(size).toFixed(6)),
          profit: Number(profit.toFixed(2)),
          profitPct: Number((((exitPrice - entryPrice) / entryPrice) * 100 * (side === 'long' ? 1 : -1)).toFixed(2)),
          equity: Number(equity.toFixed(2)),
          barsHeld: Number(t.exit_bar_index) - Number(t.entry_bar_index)
        };
      });
    const openTrades = Array.isArray(st.opentrades) ? st.opentrades.length : 0;

    const winTrades = trades.filter(t => t.profit > 0);
    const lossTrades = trades.filter(t => t.profit < 0);
    const n = trades.length;
    const winRate = n > 0 ? (winTrades.length / n) * 100 : 0;
    const grossProfit = winTrades.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.profit, 0));
    // null = undefined metric (shown as "—"), never a made-up placeholder
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : null);
    const netProfit = equity - initialCapital;
    const netProfitPct = (netProfit / initialCapital) * 100;
    const avgWin = winTrades.length ? grossProfit / winTrades.length : 0;
    const avgLoss = lossTrades.length ? grossLoss / lossTrades.length : 0;
    const rMultiple = avgLoss > 0 ? avgWin / avgLoss : null;

    // Per-trade Sharpe/Sortino (not annualised — trades are not daily returns)
    const returns = trades.map(t => t.profitPct / 100);
    const mean = n ? returns.reduce((x, y) => x + y, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(returns.reduce((x, r) => x + (r - mean) ** 2, 0) / (n - 1)) : 0;
    const neg = returns.filter(r => r < 0);
    const dsd = neg.length > 1 ? Math.sqrt(neg.reduce((x, r) => x + r * r, 0) / (neg.length - 1)) : 0;
    const sharpeRatio = sd > 0 ? mean / sd : null;
    const sortinoRatio = dsd > 0 ? mean / dsd : null;
    const expectancy = n ? (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss) : 0;

    const spanMs = bars.length > 1 ? (bars.at(-1).time - bars[0].time) : 0;
    const days = spanMs > 0 ? spanMs / 864e5 : 0;

    this.results = {
      initialCapital,
      finalEquity: equity,
      netProfit, netProfitPct,
      grossProfit, grossLoss,
      profitFactor,
      winRate,
      totalTrades: n,
      openTrades,
      winTradesCount: winTrades.length,
      lossTradesCount: lossTrades.length,
      maxDrawdown: maxDd,
      maxDrawdownPct: maxDdPct,
      sharpeRatio: sharpeRatio == null ? null : Number(sharpeRatio.toFixed(2)),
      sortinoRatio: sortinoRatio == null ? null : Number(sortinoRatio.toFixed(2)),
      expectancy: Number(expectancy.toFixed(2)),
      trades,
      avgWinR: rMultiple == null ? null : Number(rMultiple.toFixed(2)),
      tradesPerDay: days > 0 ? Number((n / days).toFixed(2)) : null,
      barsTested: bars.length
    };

    this.renderReport();
  }

  renderReport() {
    if (!this.container) return;
    if (!this.results) {
      this.renderEmpty();
      return;
    }
    const r = this.results;
    const isFa = getLanguage() === 'fa';
    if (r.totalTrades === 0) {
      this.renderMessage(isFa
        ? `استراتژی روی ${toPersianDigits(String(r.barsTested))} کندل اجرا شد ولی هیچ معاملهٔ بسته‌شده‌ای تولید نکرد${r.openTrades ? ` (${toPersianDigits(String(r.openTrades))} معاملهٔ باز)` : ''}. شرط‌های ورود/خروج یا بازهٔ زمانی را بررسی کنید.`
        : `The strategy ran on ${r.barsTested} bars but produced no closed trades${r.openTrades ? ` (${r.openTrades} open)` : ''}. Check the entry/exit conditions or the timeframe.`, 'info');
      return;
    }

    const isProfit = r.netProfit >= 0;
    const profitColor = isProfit ? 'var(--accent-green)' : 'var(--accent-red)';

    // Equity curve: one point per closed trade, anchored at initial capital.
    const w = 450;
    const h = 90;
    const eqs = [r.initialCapital, ...r.trades.map(t => t.equity)];
    const minEq = Math.min(...eqs), maxEq = Math.max(...eqs);
    const range = maxEq - minEq || 1;
    const yOf = (v) => h - ((v - minEq) / range) * (h - 16) - 8;
    const pts = eqs.map((v, idx) => `${((idx / Math.max(1, eqs.length - 1)) * w).toFixed(1)},${yOf(v).toFixed(1)}`);
    const svgPath = pts.length > 1 ? `M 0,${h} L ${pts.join(' L ')} L ${w},${h} Z` : '';
    const linePath = pts.length > 1 ? `M ${pts.join(' L ')}` : '';
    const baseY = yOf(r.initialCapital).toFixed(1);
    const fmtK = (v) => '$' + Math.round(v).toLocaleString('en-US');
    const eqColor = r.finalEquity >= r.initialCapital ? '#00e5ff' : '#f6465d';

    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow-y: auto; ${isFa ? 'direction: rtl; text-align: right; font-family: var(--font-vazirmatn), sans-serif;' : 'direction: ltr; text-align: left;'}">
        <!-- Key Metrics Strip -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; padding: 12px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle);">
          <div class="strat-kpi-card kpi-card" style="background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'سود خالص' : 'Net Profit'}</div>
            <div id="strat-net-profit" style="font-size: 15px; font-weight: 800; color: ${profitColor};" class="num-ltr">
              ${isProfit ? '+' : '−'}$${Math.abs(r.netProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${r.netProfitPct.toFixed(2)}%)
            </div>
          </div>
          <div class="strat-kpi-card kpi-card" style="background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'ضریب سودآوری (Profit Factor)' : 'Profit Factor'}</div>
            <div id="strat-profit-factor" style="font-size: 15px; font-weight: 800; color: var(--accent-cyan);" class="num-ltr">${r.profitFactor == null ? '—' : (r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2))}</div>
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
            <div style="font-size: 11px; color: var(--text-dim);">${isFa ? 'شارپ (هر معامله) / امید ریاضی' : 'Sharpe (per trade) / Expectancy'}</div>
            <div id="strat-sharpe" style="font-size: 14px; font-weight: 800; color: var(--accent-gold);" class="num-ltr">${r.sharpeRatio ?? '—'} <span style="font-size: 11px; color: var(--text-dim);">(<bdi>${r.expectancy >= 0 ? '+' : '−'}$${Math.abs(r.expectancy).toFixed(2)}</bdi>${isFa ? ' در هر معامله' : '/trade'})</span></div>
          </div>
          <div style="background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 6px; justify-content: center; border: 1px solid var(--border-subtle);">
            <button id="btn-export-propsim" class="btn-primary" style="font-size: 11px; padding: 6px 12px; min-height: 32px; width: 100%; font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;" title="${isFa ? 'انتقال نتایج به شبیه‌ساز پراپ' : 'Export results to Prop-Sim'}" aria-label="Export to Prop-Sim">
              ${isFa ? 'انتقال به شبیه‌ساز پراپ ←' : 'Export to Prop-Sim →'}
            </button>
            <button id="btn-export-csv" class="btn-secondary" style="font-size: 11px; padding: 6px 12px; min-height: 32px; width: 100%; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;" title="${isFa ? 'دانلود دفتر کل معاملات به صورت CSV' : 'Download CSV Ledger'}" aria-label="Download CSV Ledger">
              ${isFa ? 'دریافت دفتر کل CSV' : 'Download CSV Ledger'}
            </button>
          </div>
        </div>

        <!-- Middle: Equity Curve & Details -->
        <div style="display: flex; gap: 16px; padding: 12px; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap;">
          <div style="flex: 1; min-width: 320px; background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">${isFa ? 'منحنی بازدهی اکوئیتی ($)' : 'Equity Curve ($)'}</div>
            <div style="direction: ltr !important; position: relative; height: 90px;">
              <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="position: absolute; inset: 0; width: 100%; height: 100%; display: block;">
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${eqColor}" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="${eqColor}" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>
                <line x1="0" x2="${w}" y1="${baseY}" y2="${baseY}" stroke="rgba(255,255,255,0.25)" stroke-dasharray="3 3" stroke-width="1" vector-effect="non-scaling-stroke" />
                <path d="${svgPath}" fill="url(#eqGrad)" />
                <path d="${linePath}" fill="none" stroke="${eqColor}" stroke-width="2" vector-effect="non-scaling-stroke" />
              </svg>
              <span class="eq-lbl" style="top: 0; left: 4px;">${fmtK(maxEq)}</span>
              <span class="eq-lbl" style="bottom: 0; left: 4px;">${fmtK(minEq)}</span>
              <span class="eq-lbl" style="right: 4px; top: ${Math.min(76, Math.max(12, (Number(baseY) / h) * 90 - 14)).toFixed(0)}px;">${isFa ? 'سرمایهٔ اولیه' : 'start'} ${fmtK(r.initialCapital)}</span>
            </div>
          </div>

          <!-- Trades Table -->
          <div style="flex: 1; min-width: 340px; background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px; max-height: 140px; overflow-y: auto; border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">${isFa ? `معاملات بسته‌شدهٔ اخیر (${toPersianDigits(String(Math.min(8, r.totalTrades)))} از ${toPersianDigits(String(r.totalTrades))} — همه در CSV)` : `Recent Closed Trades (${Math.min(8, r.totalTrades)} of ${r.totalTrades} — all in CSV)`}</div>
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
                      ${t.profit >= 0 ? '+' : '−'}$${Math.abs(t.profit).toFixed(2)}
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
        // TradingView parity: trades CSV export is Plus tier and above.
        if (window.__TRADING_APP__?.auth && !window.__TRADING_APP__.auth.enforce('csvTradesExport', 0, 'trades CSV export', 'خروجی CSV معاملات')) {
          return;
        }
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
