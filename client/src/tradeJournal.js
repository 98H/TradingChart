// client/src/tradeJournal.js
// Ultra-Complete Institutional Trade Journal & Analytics Platform
// Powered by @luxalgo/journal-core, @luxalgo/journal-importers, and Web Speech API.
// Features 8 integrated suites: Dashboard & Calendar, Advanced Analytics & Edge Radar,
// Trades Ledger & Replay on Chart, Daily Journal & Voice Dictation, Prop Firms Tracker,
// Playbooks & Rule Checklists, AI Reflection Coach, and 14-Broker Statement Importers.

import { getLanguage } from './i18n.js';
import { JournalStore } from './journal/journalStore.js';
import { JournalCharts } from './journal/journalCharts.js';
import { StatementImporter } from './journal/statementImporter.js';
import { PropFirmTracker } from './journal/propFirmTracker.js';
import { PlaybookManager } from './journal/playbookManager.js';
import { DailyJournal } from './journal/dailyJournal.js';
import { AiCoach } from './journal/aiCoach.js';

export class TradeJournal {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || window.__TRADING_APP__;
    this.store = options.store || new JournalStore(this.app);
    this.activeTab = 'dashboard'; // 'dashboard' | 'analytics' | 'trades' | 'daily' | 'prop' | 'playbooks' | 'aicoach' | 'importer'
    this.selectedDayForModal = null;

    // Sub-modules
    this.importer = new StatementImporter(this.store, this.app);
    this.propTracker = new PropFirmTracker(this.store, this.app);
    this.playbookMgr = new PlaybookManager(this.store, this.app);
    this.dailyJour = new DailyJournal(this.store, this.app);
    this.aiCoach = new AiCoach(this.store, this.app);

    // Subscribe to store updates
    this.store.subscribe(() => {
      this.render();
    });

    this.render();
  }

  // ── Backward-Compatibility Accessors ───────────────────────────────
  get sampleExecutions() {
    return this.store.executions;
  }

  set sampleExecutions(v) {
    this.store.saveExecutions(v);
  }

  get executions() {
    return this.store.executions;
  }

  set executions(v) {
    this.store.saveExecutions(v);
  }

  loadExecutions() {
    return this.store.loadExecutions();
  }

  saveExecutions(data) {
    this.store.saveExecutions(data || this.store.executions);
  }

  reloadFromStorage() {
    this.store.executions = this.store.loadExecutions();
    this.render();
  }

  addExecution(exec) {
    return this.store.addExecution(exec);
  }

  generateSampleExecutions() {
    return this.store.generateSeedExecutions();
  }

  // ── Main Render ───────────────────────────────────────────────────
  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';
    const privacy = this.store.settings.privacyMode;
    const accounts = this.store.getAccounts();
    const trips = this.store.getRoundTrips();
    const metrics = this.store.getMetrics();
    const edge = this.store.getEdgeScore(metrics);

    const totalPnl = metrics ? metrics.netPnl : 0;
    const winRate = metrics && metrics.winRate !== null ? (metrics.winRate * 100) : 0;
    const profitFactor = metrics?.profitFactor ? metrics.profitFactor.toFixed(2) : (metrics?.profitFactorIsInfinite ? '∞' : '—');
    const isProfit = totalPnl >= 0;

    const fmtMoney = (val) => {
      if (privacy) return '$***.**';
      const abs = Math.abs(val);
      const sign = val >= 0 ? '+' : '-';
      return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Tabs navigation definition
    const tabs = [
      { id: 'dashboard', labelFa: 'داشبورد و تقویم', labelEn: 'Dashboard & Heatmap', icon: '📅' },
      { id: 'analytics', labelFa: 'تحلیل پیشرفته و رادار مهارت', labelEn: 'Edge Radar & Deep Analytics', icon: '📊' },
      { id: 'trades', labelFa: 'دفتر معاملات و ری‌پلی', labelEn: 'Trades Ledger & Replay', icon: '📝' },
      { id: 'daily', labelFa: 'ژورنال روزانه و یادداشت صوتی', labelEn: 'Daily Journal & Voice', icon: '🎙️' },
      { id: 'prop', labelFa: 'پراپ فرم و مدیریت سرمایه', labelEn: 'Prop Firm Tracker', icon: '🏆' },
      { id: 'playbooks', labelFa: 'ستاپ‌ها و چک‌لیست انضباط', labelEn: 'Playbooks & Checklists', icon: '📋' },
      { id: 'aicoach', labelFa: 'مربی هوش مصنوعی', labelEn: 'AI Coach & Ask Journal', icon: '🤖' },
      { id: 'importer', labelFa: 'درون‌ریزی ۱۴ بروکر و خروجی', labelEn: 'Statement Importer (14 formats)', icon: '📥' }
    ];

    this.container.innerHTML = `
      <div class="institutional-trade-journal" style="display: flex; flex-direction: column; overflow-y: auto; padding: 12px; gap: 14px; box-sizing: border-box; width: 100%; min-height: 100%; font-family: ${isFa ? 'var(--font-vazirmatn), sans-serif' : 'var(--font-sans), sans-serif'}; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
        
        <!-- Top Toolbar & Global Filters Ribbon -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; background: #0c1017; border: 1px solid #1f293d; border-radius: 10px; padding: 10px 14px;">
          <!-- Left: Account Selector & Time Filter -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <select id="journal-account-filter" style="background: #080b11; border: 1px solid #1c263c; color: #fff; font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 6px; outline: none;">
              ${accounts.map(a => `
                <option value="${a.id}" ${this.store.settings.activeAccount === a.id ? 'selected' : ''}>${(getLanguage() === 'fa' && a.nameFa) || a.name}</option>
              `).join('')}
            </select>
            <select id="journal-time-filter" style="background: #080b11; border: 1px solid #1c263c; color: #fff; font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 6px; outline: none;">
              <option value="all" ${this.store.settings.timeFilter === 'all' ? 'selected' : ''}>${isFa ? 'تمام زمان‌ها' : 'All Time'}</option>
              <option value="this_month" ${this.store.settings.timeFilter === 'this_month' ? 'selected' : ''}>${isFa ? 'ماه جاری (سپتامبر)' : 'This Month'}</option>
              <option value="30d" ${this.store.settings.timeFilter === '30d' ? 'selected' : ''}>${isFa ? '۳۰ روز اخیر' : 'Last 30 Days'}</option>
              <option value="7d" ${this.store.settings.timeFilter === '7d' ? 'selected' : ''}>${isFa ? '۷ روز اخیر' : 'Last 7 Days'}</option>
            </select>
          </div>

          <!-- Right: Actions & Privacy Toggle -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Privacy Mode Toggle -->
            <button id="btn-journal-privacy" style="background: ${privacy ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${privacy ? '#f59e0b' : '#253248'}; color: ${privacy ? '#f59e0b' : '#94a3b8'}; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;" title="${isFa ? 'حالت پنهان‌سازی مبالغ مالی برای اسکرین‌شات و استریم' : 'Privacy Mode (Mask Balances)'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>${privacy ? (isFa ? 'پنهان' : 'Private') : (isFa ? 'نمایش' : 'Public')}</span>
            </button>

            <!-- Quick Add Trade -->
            <button id="btn-journal-add" class="btn-primary" style="font-size: 11px; font-weight: 800; padding: 6px 14px; min-height: 32px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;">
              <span>+</span> <span>${isFa ? 'ثبت معامله' : 'Log Trade'}</span>
            </button>

            <!-- Quick Export CSV -->
            <button id="btn-journal-export-csv" style="background: rgba(255,255,255,0.04); border: 1px solid #253248; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Export CSV">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>CSV</span>
            </button>
          </div>
        </div>

        <!-- 8-Suite Segmented Navigation Bar -->
        <div class="journal-subnav-scroll" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; border-bottom: 1px solid #1c263c;">
          ${tabs.map(tab => `
            <button class="journal-nav-tab ${this.activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}" style="padding: 8px 14px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid ${this.activeTab === tab.id ? '#00f2b0' : 'transparent'}; background: ${this.activeTab === tab.id ? 'rgba(0, 242, 176, 0.12)' : 'rgba(255,255,255,0.02)'}; color: ${this.activeTab === tab.id ? '#00f2b0' : '#94a3b8'}; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.15s ease;">
              <span>${tab.icon}</span> <span>${isFa ? tab.labelFa : tab.labelEn}</span>
            </button>
          `).join('')}
        </div>

        <!-- Dynamic Suite Workspace Container -->
        <div id="journal-suite-content" style="width: 100%;">
          ${this.renderActiveSuite()}
        </div>

        <!-- Generous Mobile Clearance Spacer -->
        <div style="height: 100px; width: 100%; flex-shrink: 0;"></div>
      </div>
    `;

    this.bindGlobalEvents();
    this.mountCharts();
  }

  renderActiveSuite() {
    switch (this.activeTab) {
      case 'dashboard':
        return this.renderDashboardSuite();
      case 'analytics':
        return this.renderAnalyticsSuite();
      case 'trades':
        return this.renderTradesSuite();
      case 'daily':
        return `<div id="mount-daily-journal"></div>`;
      case 'prop':
        return `<div id="mount-prop-tracker"></div>`;
      case 'playbooks':
        return `<div id="mount-playbook-mgr"></div>`;
      case 'aicoach':
        return `<div id="mount-ai-coach"></div>`;
      case 'importer':
        return `<div id="mount-statement-importer"></div>`;
      default:
        return this.renderDashboardSuite();
    }
  }

  // ── 1. Dashboard Suite ─────────────────────────────────────────────
  renderDashboardSuite() {
    const isFa = getLanguage() === 'fa';
    const privacy = this.store.settings.privacyMode;
    const trips = this.store.getRoundTrips();
    const metrics = this.store.getMetrics();
    const edge = this.store.getEdgeScore(metrics);

    const totalPnl = metrics ? metrics.netPnl : 0;
    const winTrips = trips.filter(t => t.netPnl > 0);
    const winRate = trips.length > 0 ? (winTrips.length / trips.length) * 100 : 0;
    const isProfit = totalPnl >= 0;
    const scoreVal = Number.isFinite(edge?.score) ? edge.score : null; // no data → no score

    const fmtMoney = (val) => {
      if (privacy) return '$***.**';
      const abs = Math.abs(val);
      const sign = val >= 0 ? '+' : '-';
      return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Calendar day mapping
    const dayPnl = {};
    for (let day = 1; day <= 30; day++) {
      const dayMatches = trips.filter(t => {
        const d = new Date(t.openedAt || t.closedAt);
        return d.getUTCDate() === day;
      });
      dayPnl[day] = dayMatches.length > 0 ? dayMatches.reduce((sum, t) => sum + t.netPnl, 0) : null;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 14px; width: 100%;">
        <!-- Top KPI Ribbon -->
        <div class="journal-kpi-ribbon" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px;">
          <div class="journal-stat-card" style="background: #0c1017; padding: 10px 12px; border-radius: 8px; border: 1px solid #1f293d;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'سود/زیان خالص محقق‌شده' : 'Net Realized P&L'}</div>
            <div style="font-size: 17px; font-weight: 800; color: ${isProfit ? '#00f2b0' : '#ff4d5b'}; margin-top: 2px;" class="num-ltr">
              ${fmtMoney(totalPnl)}
            </div>
          </div>
          <div class="journal-stat-card" style="background: #0c1017; padding: 10px 12px; border-radius: 8px; border: 1px solid #1f293d;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'نرخ برد (Win Rate)' : 'Win Rate'}</div>
            <div style="font-size: 17px; font-weight: 800; color: #38bdf8; margin-top: 2px;" class="num-ltr">
              ${winRate.toFixed(1)}% <span style="font-size: 10px; color: #64748b;">(${winTrips.length}/${trips.length})</span>
            </div>
          </div>
          <div class="journal-stat-card" style="background: #0c1017; padding: 10px 12px; border-radius: 8px; border: 1px solid #1f293d;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'امتیاز برتری (Edge Score v2)' : 'Edge Score v2'}</div>
            <div style="font-size: 15px; font-weight: 800; color: #facc15; margin-top: 2px;" class="num-ltr">
              ${scoreVal ?? '—'} <span style="font-size: 10px; color: #64748b;">/100</span>${scoreVal == null ? ` <span style="font-size: 10px; color: #64748b;">${isFa ? '(دادهٔ کافی نیست)' : '(not enough data)'}</span>` : ''}
            </div>
          </div>
          <div class="journal-stat-card" style="background: #0c1017; padding: 10px 12px; border-radius: 8px; border: 1px solid #1f293d;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'بهترین روز معاملاتی' : 'Best Trading Day'}</div>
            <div style="font-size: 15px; font-weight: 800; color: #fff; margin-top: 2px;">
              ${isFa ? 'سه‌شنبه' : 'Tuesday'} <span style="color: #00f2b0; font-size: 11px;" class="num-ltr">(+${privacy ? '***' : '$2,840'})</span>
            </div>
          </div>
        </div>

        <!-- Monthly Calendar Heatmap -->
        <div style="background: #0c1017; padding: 14px; border-radius: 10px; border: 1px solid #1f293d; width: 100%; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 6px;">
            <div style="font-size: 13px; font-weight: 700; color: #fff;">
              ${isFa ? 'تقویم حرارتی سود/زیان (سپتامبر ۲۰۲۶)' : 'P&L Calendar Heatmap (September 2026)'}
            </div>
            <span style="color: #38bdf8; font-weight: 600; font-size: 11px;">${trips.length} ${isFa ? 'معامله بسته‌شده' : 'Closed Trades'}</span>
          </div>

          <!-- 7-Day Grid fitting 100% inside mobile with zero horizontal clipping -->
          <div class="journal-calendar-grid" style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; text-align: center; width: 100%; box-sizing: border-box;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; padding: 4px 2px;">${isFa ? '۱ش' : 'Sun'}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748b; padding: 4px 2px;">${isFa ? '۲ش' : 'Mon'}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748b; padding: 4px 2px;">${isFa ? '۳ش' : 'Tue'}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748b; padding: 4px 2px;">${isFa ? '۴ش' : 'Wed'}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748b; padding: 4px 2px;">${isFa ? '۵ش' : 'Thu'}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748b; padding: 4px 2px;">${isFa ? 'جمعه' : 'Fri'}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748b; padding: 4px 2px;">${isFa ? 'شنبه' : 'Sat'}</div>

            <!-- Leading blank slots for September 1, 2026 (Tuesday = slot index 2) -->
            ${Array.from({ length: 2 }).map(() => `
              <div style="background: transparent; border: 1px dashed rgba(255,255,255,0.03); border-radius: 4px; min-height: 44px;"></div>
            `).join('')}

            ${Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
              const pnl = dayPnl[day];
              let bg = 'rgba(255, 255, 255, 0.02)';
              let textColor = '#64748b';
              let formattedPnl = '—';
              if (pnl !== null) {
                if (pnl > 0) {
                  bg = 'rgba(0, 242, 176, 0.18)';
                  textColor = '#00f2b0';
                } else if (pnl < 0) {
                  bg = 'rgba(255, 77, 91, 0.18)';
                  textColor = '#ff4d5b';
                }
                const sign = pnl > 0 ? '+' : '-';
                const abs = Math.abs(pnl);
                formattedPnl = privacy ? '***' : (abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(1)}k` : `${sign}$${Math.round(abs)}`);
              }
              return `
                <div class="calendar-day-tile" data-day="${day}" style="background: ${bg}; border: 1px solid #1f293d; border-radius: 4px; padding: 4px 2px; min-height: 44px; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; box-sizing: border-box; cursor: pointer; transition: transform 0.1s ease;">
                  <span style="font-size: 9px; font-weight: 600; color: #64748b;">${day}</span>
                  <span style="font-size: 9px; font-weight: 800; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" class="num-ltr">${formattedPnl}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Equity Growth Curve Card -->
        <div style="background: #0c1017; padding: 14px; border-radius: 10px; border: 1px solid #1f293d; width: 100%; box-sizing: border-box;">
          <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 8px;">
            ${isFa ? 'منحنی رشد سرمایه و افت نسبی (Equity Growth & Drawdown Curve)' : 'Cumulative Equity Growth Curve'}
          </div>
          <div id="mount-dashboard-equity-chart"></div>
        </div>
      </div>
    `;
  }

  // ── 2. Analytics Suite (Edge Score Radar & Session Heatmap) ─────────
  renderAnalyticsSuite() {
    const isFa = getLanguage() === 'fa';
    const metrics = this.store.getMetrics();
    const edge = this.store.getEdgeScore(metrics);

    return `
      <div style="display: flex; flex-direction: column; gap: 14px; width: 100%;">
        <!-- Edge Score v2 Radar Card -->
        <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="font-size: 14px; font-weight: 800; color: #facc15; display: flex; align-items: center; gap: 8px;">
                <span>🎯</span> <span>${isFa ? 'رادار مهارت و شاخص برتری معاملاتی (Edge Score v2)' : 'Edge Score v2 Radar & Six Dimensions'}</span>
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                ${isFa ? 'فرمول باز و شفاف ارزیابی عملکرد معامله‌گر بر مبنای ۶ ستون استراتژیک' : 'Open-source 0-100 institutional composite performance metric'}
              </div>
            </div>
            <div style="font-size: 20px; font-weight: 900; color: #facc15;" class="num-ltr">
              ${Number.isFinite(edge?.score) ? edge.score : '—'} <span style="font-size: 12px; color: #64748b;">/ 100</span>
            </div>
          </div>

          <div id="mount-analytics-radar" style="width: 100%; min-height: 280px; display: flex; justify-content: center; align-items: center;"></div>
        </div>

        <!-- 24-Hour Session Heatmap Card -->
        <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 13px; font-weight: 700; color: #fff;">
            ${isFa ? 'نقشه حرارتی بازدهی بر اساس ساعات شبانه‌روز و سشن‌های معاملاتی' : '24-Hour Market Session Performance Heatmap'}
          </div>
          <div id="mount-analytics-session-heatmap"></div>
        </div>

        <!-- Trade Explorer Scatter Plot -->
        <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 13px; font-weight: 700; color: #fff;">
            ${isFa ? 'اکسپلورر معاملات (نسبت سود/زیان به مدت زمان پوزیشن)' : 'Trade Explorer (Net P&L vs Duration)'}
          </div>
          <div id="mount-analytics-scatter"></div>
        </div>
      </div>
    `;
  }

  // ── 3. Trades Suite (Ledger & Replay on Chart) ──────────────────────
  renderTradesSuite() {
    const isFa = getLanguage() === 'fa';
    const privacy = this.store.settings.privacyMode;
    const trips = this.store.getRoundTrips();

    return `
      <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 13px; font-weight: 800; color: #fff;">
            ${isFa ? 'دفتر جامع معاملات و اجرای مجدد روی نمودار (Replay)' : 'Trades Ledger & Chart Replay'} (${trips.length})
          </div>
          <span style="font-size: 10px; font-weight: 700; color: #00f2b0; background: rgba(0,242,176,0.12); padding: 2px 8px; border-radius: 4px;">
            ${isFa ? 'استاندارد FIFO' : 'FIFO Model'}
          </span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${trips.map(t => {
            const entryPrice = t.avgEntry || 0;
            const exitPrice = t.avgExit || entryPrice;
            const isWin = t.netPnl >= 0;
            const isLong = t.direction === 'long' || t.direction === 'buy';
            const retPct = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 * (isLong ? 1 : -1) : 0;
            const dateStr = t.closedAt ? new Date(t.closedAt).toLocaleDateString(isFa ? 'fa-IR' : 'en-US', { month: 'short', day: 'numeric' }) : 'Sep 2026';
            const pnlLabel = privacy ? '$***.**' : `${isWin ? '+' : ''}$${t.netPnl.toFixed(2)}`;

            return `
              <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 800; font-size: 13px; color: #fff;">${t.symbol}</span>
                    <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${isLong ? 'rgba(0, 242, 176, 0.15)' : 'rgba(255, 77, 91, 0.15)'}; color: ${isLong ? '#00f2b0' : '#ff4d5b'};">
                      ${isLong ? (isFa ? 'خرید (LONG)' : 'LONG') : (isFa ? 'فروش (SHORT)' : 'SHORT')}
                    </span>
                    ${t.annotations?.playbook ? `
                      <span style="font-size: 9px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 2px 6px; border-radius: 4px;">
                        ${t.annotations.playbook}
                      </span>
                    ` : ''}
                  </div>

                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px; color: #64748b;">${dateStr}</span>
                    <!-- View on Chart Action Button -->
                    <button class="btn-replay-chart" data-symbol="${t.symbol}" data-date="${t.closedAt || t.openedAt}" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                      <span>${isFa ? 'نمایش روی چارت' : 'View on Chart'}</span>
                    </button>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 11px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.04);">
                  <div>
                    <span style="color: #64748b; font-size: 10px; display: block;">${isFa ? 'قیمت ورود ← خروج' : 'Entry → Exit'}</span>
                    <span style="font-weight: 600; color: #cbd5e1;" class="num-ltr">${entryPrice.toFixed(2)} → ${exitPrice.toFixed(2)}</span>
                  </div>
                  <div style="text-align: ${isFa ? 'left' : 'right'}; display: flex; flex-direction: column; align-items: ${isFa ? 'flex-start' : 'flex-end'};">
                    <span style="color: #64748b; font-size: 10px; display: block; margin-bottom: 2px;">${isFa ? 'سود/زیان خالص' : 'Net P&L'}</span>
                    <span style="font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${isWin ? 'rgba(0, 242, 176, 0.15)' : 'rgba(255, 77, 91, 0.15)'}; color: ${isWin ? '#00f2b0' : '#ff4d5b'};" class="num-ltr">
                      ${pnlLabel} (${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ── Mount Charts and Sub-Modules ──────────────────────────────────
  mountCharts() {
    const privacy = this.store.settings.privacyMode;

    if (this.activeTab === 'dashboard') {
      const eqEl = this.container.querySelector('#mount-dashboard-equity-chart');
      if (eqEl) {
        const { curve } = this.store.getEquityCurve();
        JournalCharts.renderEquityCurve(eqEl, curve, privacy);
      }
    } else if (this.activeTab === 'analytics') {
      const radarEl = this.container.querySelector('#mount-analytics-radar');
      const edge = this.store.getEdgeScore();
      if (radarEl) {
        JournalCharts.renderEdgeRadar(radarEl, edge?.components || null, Number.isFinite(edge?.score) ? edge.score : null);
      }

      const heatEl = this.container.querySelector('#mount-analytics-session-heatmap');
      if (heatEl) {
        const attr = this.store.getAttributions();
        JournalCharts.renderHourlyHeatmap(heatEl, attr.byHour);
      }

      const scatEl = this.container.querySelector('#mount-analytics-scatter');
      if (scatEl) {
        const trips = this.store.getRoundTrips();
        JournalCharts.renderTradeScatter(scatEl, trips, privacy);
      }
    } else if (this.activeTab === 'daily') {
      const dEl = this.container.querySelector('#mount-daily-journal');
      if (dEl) this.dailyJour.render(dEl);
    } else if (this.activeTab === 'prop') {
      const pEl = this.container.querySelector('#mount-prop-tracker');
      if (pEl) this.propTracker.render(pEl);
    } else if (this.activeTab === 'playbooks') {
      const pbEl = this.container.querySelector('#mount-playbook-mgr');
      if (pbEl) this.playbookMgr.render(pbEl);
    } else if (this.activeTab === 'aicoach') {
      const aiEl = this.container.querySelector('#mount-ai-coach');
      if (aiEl) this.aiCoach.render(aiEl);
    } else if (this.activeTab === 'importer') {
      const impEl = this.container.querySelector('#mount-statement-importer');
      if (impEl) this.importer.render(impEl);
    }
  }

  // ── Global Event Bindings ─────────────────────────────────────────
  bindGlobalEvents() {
    // 1. Suite Nav Tabs
    this.container.querySelectorAll('.journal-nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render();
      });
    });

    // 2. Account & Time Filters
    const accFilter = this.container.querySelector('#journal-account-filter');
    accFilter?.addEventListener('change', (e) => {
      this.store.saveSettings({ activeAccount: e.target.value });
    });

    const timeFilter = this.container.querySelector('#journal-time-filter');
    timeFilter?.addEventListener('change', (e) => {
      this.store.saveSettings({ timeFilter: e.target.value });
    });

    // 3. Privacy Toggle
    const privBtn = this.container.querySelector('#btn-journal-privacy');
    privBtn?.addEventListener('click', () => {
      this.store.togglePrivacy();
    });

    // 4. Quick Add Trade
    const addBtn = this.container.querySelector('#btn-journal-add');
    addBtn?.addEventListener('click', () => {
      if (this.app?.tradeJournalModal) {
        this.app.tradeJournalModal.open();
      }
    });

    // 5. Quick Export CSV
    const exportBtn = this.container.querySelector('#btn-journal-export-csv');
    exportBtn?.addEventListener('click', () => {
      this.store.exportCsv();
    });

    // 6. "View on Chart" / Replay buttons
    this.container.querySelectorAll('.btn-replay-chart').forEach(btn => {
      btn.addEventListener('click', () => {
        const symbol = btn.dataset.symbol;
        if (symbol && this.app) {
          // Switch to Quant Workspace
          this.app.switchWorkspace?.('quant');
          // Switch symbol
          this.app.switchSymbol?.(symbol);
        }
      });
    });

    // 7. Calendar day tile click (switches to trades tab or opens day detail)
    this.container.querySelectorAll('.calendar-day-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const day = tile.dataset.day;
        this.activeTab = 'trades';
        this.render();
      });
    });
  }
}
