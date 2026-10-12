// client/src/journal/journalStore.js
// Institutional reactive data store for Trade Journal, Prop Firms, Playbooks, and Multi-Broker imports
// Backed by @luxalgo/journal-core and @luxalgo/journal-importers

import {
  buildRoundTrips,
  computeMetrics,
  computeEdgeScore,
  equityCurve,
  drawdown,
  dailyStats,
  byWeekday,
  byHour,
  byDirection,
  bySymbol,
  byAssetClass,
  byPlaybook,
  byTag,
  byMistake,
  byDuration,
  analyzeAdherence
} from './core/index.ts';
import { parseAuto, detectFormat } from './importers/index.ts';

const STORAGE_KEYS = {
  EXECUTIONS: 'tradingchart_trade_journal',
  LEGACY_EXECUTIONS: 'trading_journal_executions',
  ACCOUNTS: 'tradingchart_journal_accounts',
  PROP_FIRMS: 'tradingchart_prop_firms',
  PLAYBOOKS: 'tradingchart_journal_playbooks',
  NOTES: 'tradingchart_journal_notes',
  ANNOTATIONS: 'tradingchart_journal_annotations',
  SETTINGS: 'tradingchart_journal_settings'
};

const DEFAULT_ACCOUNTS = [
  { id: 'all', name: 'All Accounts', nameFa: 'تمام حساب‌ها', currency: 'USD', type: 'aggregate' },
  { id: 'tradingchart-paper-1', name: 'Paper Trading', nameFa: 'حساب آزمایشی', currency: 'USD', type: 'paper' },
  { id: 'prop-ftmo-100k', name: 'FTMO $100K Challenge (Phase 1)', nameFa: 'چالش FTMO صد هزار دلاری (مرحله ۱)', currency: 'USD', type: 'prop', startingBalance: 100000, target: 10000, maxLoss: 10000, dailyLoss: 5000 },
  { id: 'binance-futures-main', name: 'Binance Futures', nameFa: 'بایننس فیوچرز', currency: 'USDT', type: 'live' }
];

const DEFAULT_PLAYBOOKS = [
  {
    id: 'smc-order-block',
    name: 'SMC Order Block & Liquidity Sweep',
    nameFa: 'اردربلاک اسمارت مانی و شکار نقدینگی',
    rules: [
      'Higher timeframe market structure alignment (تایید ساختار تایم‌فریم بالاتر)',
      'Clear liquidity sweep prior to mitigation (شکار نقدینگی قبل از برخورد به سطح)',
      'Strong displacement leaving FVG (حرکت پرقدرت و ایجاد گپ منصفانه)',
      'Risk capped strictly at <= 1.0% of equity (سقف ریسک حداکثر ۱ درصد)',
      'Stop-loss placed beyond the invalidation swing (حد ضرر فراتر از سوینگ مبنا)'
    ]
  },
  {
    id: 'fvg-retest',
    name: 'Fair Value Gap (FVG) Retest',
    nameFa: 'پولبک به گپ ارزش منصفانه (FVG)',
    rules: [
      'Identified pristine unmitigated FVG (شناسایی FVG دست‌نخورده)',
      'Confluence with Premium/Discount equilibrium (تلاقی با ناحیه ارزندگی دیسکانت/پریمیوم)',
      'Lower timeframe shift of character (CHoCH) on entry (تغییر ماهیت روند در تایم ورود)',
      'Minimum 2.5:1 Risk-to-Reward ratio (حداقل نسبت ریسک به ریوارد ۲.۵)',
      'Target previous opposing liquidity pool (هدف‌گذاری نقدینگی مخالف)'
    ]
  },
  {
    id: 'break-and-retest',
    name: 'Key Level Breakout & Volume Retest',
    nameFa: 'شکست سطح کلیدی و پولبک با حجم',
    rules: [
      'Clean breakout of significant daily/4h level (شکست تمیز سطح روزانه یا ۴ساعته)',
      'Decreasing volume on retest pullback (کاهش حجم در موج پولبک)',
      'Rejection candlestick confirmation (کندل تایید پرایس‌اکشنی در تست مجدد)',
      'Trailing stop-loss strategy prepared (برنامه مشخص تریلینگ استاپ)'
    ]
  },
  {
    id: 'trend-pullback',
    name: 'EMA 20/50 Trend Dynamic Pullback',
    nameFa: 'پولبک به میانگین‌های متحرک در جهت روند',
    rules: [
      'EMA 20 > EMA 50 for Long or EMA 20 < EMA 50 for Short (جهت میانگین‌های متحرک)',
      'RSI pullback to 40-50 zone without divergence (تثبیت شاخص قدرت نسبی)',
      'Trigger candle close back in trend direction (بسته شدن کندل تریگر)'
    ]
  }
];

export class JournalStore {
  constructor(app = null) {
    this.app = app;
    this.listeners = new Set();
    this.executions = this.loadExecutions();
    this.accounts = this.loadAccounts();
    this.propFirms = this.loadPropFirms();
    this.playbooks = this.loadPlaybooks();
    this.notes = this.loadNotes();
    this.annotations = this.loadAnnotations();
    this.settings = this.loadSettings();

    // Bind storage bus for cloud state sync
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEYS.EXECUTIONS) {
        this.executions = this.loadExecutions();
        this.notify();
      }
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (e) {
        console.error('[JournalStore] Listener error:', e);
      }
    }
  }

  // ── Storage Helpers ────────────────────────────────────────────────
  readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn(`[JournalStore] Failed to read ${key}:`, e);
    }
    return fallback;
  }

  writeStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      // Notify TradingChart AuthManager cloud-sync if available
      if (this.app?.auth?.syncEnabled) {
        this.app.auth.scheduleSync?.();
      }
    } catch (e) {
      console.warn(`[JournalStore] Failed to write ${key}:`, e);
    }
  }

  // ── Loaders ────────────────────────────────────────────────────────
  loadExecutions() {
    let list = this.readStorage(STORAGE_KEYS.EXECUTIONS, null);
    if (!list) {
      list = this.readStorage(STORAGE_KEYS.LEGACY_EXECUTIONS, null);
    }
    if (Array.isArray(list) && list.length > 0) return list;

    const seed = this.generateSeedExecutions();
    this.saveExecutions(seed);
    return seed;
  }

  saveExecutions(data = this.executions) {
    this.executions = data;
    this.writeStorage(STORAGE_KEYS.EXECUTIONS, data);
    this.writeStorage(STORAGE_KEYS.LEGACY_EXECUTIONS, data);
    this.notify();
  }

  getAccounts() {
    return this.accounts || DEFAULT_ACCOUNTS;
  }

  loadAccounts() {
    const list = this.readStorage(STORAGE_KEYS.ACCOUNTS, null);
    if (Array.isArray(list) && list.length > 0) {
      // Migrate legacy bilingual default names ("All Accounts / تمام حساب‌ها")
      // to the {name, nameFa} shape so each locale shows a single clean label.
      let changed = false;
      const migrated = list.map(a => {
        const def = DEFAULT_ACCOUNTS.find(d => d.id === a.id);
        if (def && (!a.nameFa || / \/ /.test(a.name || ''))) { changed = true; return { ...a, name: def.name, nameFa: def.nameFa }; }
        return a;
      });
      if (changed) this.writeStorage(STORAGE_KEYS.ACCOUNTS, migrated);
      return migrated;
    }
    this.writeStorage(STORAGE_KEYS.ACCOUNTS, DEFAULT_ACCOUNTS);
    return DEFAULT_ACCOUNTS;
  }

  saveAccounts(data = this.accounts) {
    this.accounts = data;
    this.writeStorage(STORAGE_KEYS.ACCOUNTS, data);
    this.notify();
  }

  getPropFirms() {
    return this.propFirms || [];
  }

  loadPropFirms() {
    const list = this.readStorage(STORAGE_KEYS.PROP_FIRMS, null);
    if (Array.isArray(list) && list.length > 0) return list;
    const initial = [
      {
        id: 'ftmo-1',
        firmName: 'FTMO',
        accountId: 'prop-ftmo-100k',
        accountNumber: 'FTMO-98241',
        initialBalance: 100000,
        currentBalance: 106420,
        targetProfit: 10000,
        maxLossLimit: 10000,
        dailyLossLimit: 5000,
        phase: 'Phase 1',
        status: 'active',
        evalFee: 540,
        resetFees: 0,
        payoutsRequested: 0,
        payoutsReceived: 0,
        startDate: '2026-09-01',
        notes: 'FTMO Swing Trader challenge. Target 10% with zero news trading restrictions.'
      }
    ];
    this.writeStorage(STORAGE_KEYS.PROP_FIRMS, initial);
    return initial;
  }

  savePropFirms(data = this.propFirms) {
    this.propFirms = data;
    this.writeStorage(STORAGE_KEYS.PROP_FIRMS, data);
    this.notify();
  }

  getPlaybooks() {
    return this.playbooks || DEFAULT_PLAYBOOKS;
  }

  loadPlaybooks() {
    const list = this.readStorage(STORAGE_KEYS.PLAYBOOKS, null);
    if (Array.isArray(list) && list.length > 0) return list;
    this.writeStorage(STORAGE_KEYS.PLAYBOOKS, DEFAULT_PLAYBOOKS);
    return DEFAULT_PLAYBOOKS;
  }

  savePlaybooks(data = this.playbooks) {
    this.playbooks = data;
    this.writeStorage(STORAGE_KEYS.PLAYBOOKS, data);
    this.notify();
  }

  loadNotes() {
    return this.readStorage(STORAGE_KEYS.NOTES, {});
  }

  saveNotes(data = this.notes) {
    this.notes = data;
    this.writeStorage(STORAGE_KEYS.NOTES, data);
    this.notify();
  }

  loadAnnotations() {
    return this.readStorage(STORAGE_KEYS.ANNOTATIONS, {});
  }

  saveAnnotations(data = this.annotations) {
    this.annotations = data;
    this.writeStorage(STORAGE_KEYS.ANNOTATIONS, data);
    this.notify();
  }

  loadSettings() {
    const s = this.readStorage(STORAGE_KEYS.SETTINGS, {
      privacyMode: false,
      method: 'fifo',
      activeAccount: 'all',
      timeFilter: 'all',
      timeZone: 'UTC'
    });
    return s;
  }

  saveSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this.writeStorage(STORAGE_KEYS.SETTINGS, this.settings);
    this.notify();
  }

  togglePrivacy() {
    this.saveSettings({ privacyMode: !this.settings.privacyMode });
    return this.settings.privacyMode;
  }

  // ── Executions Operations ──────────────────────────────────────────
  addExecution(exec) {
    if (!exec) return;
    const item = {
      id: exec.id || `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      accountId: exec.accountId || (this.settings.activeAccount !== 'all' ? this.settings.activeAccount : 'tradingchart-paper-1'),
      symbol: (exec.symbol || 'BTCUSDT').toUpperCase(),
      side: exec.side === 'buy' || exec.side === 'long' ? 'buy' : 'sell',
      quantity: Number(exec.quantity) || 1,
      price: Number(exec.price) || 0,
      fee: Number(exec.fee || 0),
      executedAt: exec.executedAt || new Date().toISOString(),
      source: exec.source || 'manual',
      assetClass: exec.assetClass || 'crypto'
    };
    this.executions.unshift(item);
    this.saveExecutions();
    return item;
  }

  addExecutions(execList, targetAccountId = null) {
    if (!Array.isArray(execList) || execList.length === 0) return 0;
    const existingSignatures = new Set(
      this.executions.map(e => `${e.symbol}|${e.side}|${e.price}|${e.quantity}|${e.executedAt}`)
    );

    let count = 0;
    const toAdd = [];
    for (const raw of execList) {
      const sig = `${raw.symbol}|${raw.side}|${raw.price}|${raw.quantity}|${raw.executedAt}`;
      if (existingSignatures.has(sig)) continue;
      existingSignatures.add(sig);

      toAdd.push({
        id: raw.id || `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        accountId: targetAccountId || raw.accountId || 'tradingchart-paper-1',
        symbol: (raw.symbol || 'BTCUSDT').toUpperCase(),
        side: raw.side === 'buy' || raw.side === 'long' ? 'buy' : 'sell',
        quantity: Math.abs(Number(raw.quantity) || 1),
        price: Number(raw.price) || 0,
        fee: Math.abs(Number(raw.fee || 0)),
        executedAt: raw.executedAt || new Date().toISOString(),
        source: raw.source || 'import',
        assetClass: raw.assetClass || 'crypto',
        importMetadata: raw.importMetadata
      });
      count++;
    }

    if (toAdd.length > 0) {
      this.executions = [...toAdd, ...this.executions];
      this.saveExecutions();
    }
    return count;
  }

  deleteExecution(id) {
    this.executions = this.executions.filter(e => e.id !== id);
    this.saveExecutions();
  }

  clearExecutions(accountId = null) {
    if (!accountId || accountId === 'all') {
      this.executions = [];
    } else {
      this.executions = this.executions.filter(e => e.accountId !== accountId);
    }
    this.saveExecutions();
  }

  // ── Annotations & Notes ────────────────────────────────────────────
  setAnnotation(tradeKey, data) {
    this.annotations[tradeKey] = {
      ...(this.annotations[tradeKey] || {}),
      ...data
    };
    this.saveAnnotations();
  }

  getAnnotation(tradeKey) {
    return this.annotations[tradeKey] || null;
  }

  getDailyNote(dateStr) {
    return this.notes[dateStr] || { text: '', voiceDictations: [], emotion: 'Calm', rulesCompleted: [] };
  }

  saveDailyNote(dateStr, noteData) {
    this.notes[dateStr] = {
      ...(this.notes[dateStr] || {}),
      ...noteData,
      updatedAt: new Date().toISOString()
    };
    this.saveNotes();
  }

  // ── Domain Calculations via @luxalgo/journal-core ──────────────────
  getExecutions(filterOverride = {}) {
    return this.getFilteredExecutions(filterOverride);
  }

  getTrades(filterOverride = {}) {
    return this.getRoundTrips(filterOverride);
  }

  getFilteredExecutions(filterOverride = {}) {
    const filter = {
      account: this.settings.activeAccount,
      time: this.settings.timeFilter,
      ...filterOverride
    };

    return this.executions.filter(e => {
      if (filter.account && filter.account !== 'all' && e.accountId !== filter.account) {
        return false;
      }
      if (filter.symbol && e.symbol !== filter.symbol) {
        return false;
      }
      if (filter.time && filter.time !== 'all') {
        const d = new Date(e.executedAt).getTime();
        const now = Date.now();
        if (filter.time === 'this_month') {
          const currentMonth = new Date().getUTCMonth();
          const execMonth = new Date(e.executedAt).getUTCMonth();
          if (currentMonth !== execMonth) return false;
        } else if (filter.time === '30d') {
          if (now - d > 30 * 86400 * 1000) return false;
        } else if (filter.time === '7d') {
          if (now - d > 7 * 86400 * 1000) return false;
        }
      }
      return true;
    });
  }

  getRoundTrips(filterOverride = {}) {
    const execs = this.getFilteredExecutions(filterOverride);
    try {
      const trips = buildRoundTrips(execs, { method: this.settings.method || 'fifo' });
      // Overlay user annotations
      return trips.map(t => {
        const ann = this.annotations[t.key] || {};
        return {
          ...t,
          annotations: {
            ...ann,
            playbook: ann.playbook || t.annotations?.playbook,
            tags: ann.tags || t.annotations?.tags || [],
            mistakes: ann.mistakes || t.annotations?.mistakes || [],
            notes: ann.notes || t.annotations?.notes || '',
            rating: ann.rating || t.annotations?.rating || 0
          }
        };
      });
    } catch (e) {
      console.warn('[JournalStore] buildRoundTrips failed:', e);
      return [];
    }
  }

  getMetrics(filterOverride = {}) {
    const trades = this.getRoundTrips(filterOverride);
    try {
      return computeMetrics(trades, {
        timeZone: this.settings.timeZone || 'UTC',
        initialBalance: 100000
      });
    } catch (e) {
      console.warn('[JournalStore] computeMetrics failed:', e);
      return null;
    }
  }

  getEdgeScore(metrics = null) {
    const m = metrics || this.getMetrics();
    if (!m) return null;
    try {
      return computeEdgeScore(m);
    } catch (e) {
      console.warn('[JournalStore] computeEdgeScore failed:', e);
      return null;
    }
  }

  getEquityCurve(filterOverride = {}) {
    const trades = this.getRoundTrips(filterOverride);
    try {
      const curve = equityCurve(trades);
      const dd = drawdown(curve, 100000);
      return { curve, drawdown: dd };
    } catch (e) {
      console.warn('[JournalStore] equityCurve failed:', e);
      return { curve: [], drawdown: null };
    }
  }

  getDailyStats(filterOverride = {}) {
    const trades = this.getRoundTrips(filterOverride);
    try {
      return dailyStats(trades, this.settings.timeZone || 'UTC');
    } catch (e) {
      console.warn('[JournalStore] dailyStats failed:', e);
      return [];
    }
  }

  getAttributions(filterOverride = {}) {
    const trades = this.getRoundTrips(filterOverride);
    try {
      return {
        byWeekday: byWeekday(trades),
        byHour: byHour(trades),
        byDirection: byDirection(trades),
        bySymbol: bySymbol(trades),
        byAssetClass: byAssetClass(trades),
        byPlaybook: byPlaybook(trades),
        byTag: byTag(trades),
        byMistake: byMistake(trades),
        byDuration: byDuration(trades)
      };
    } catch (e) {
      console.warn('[JournalStore] getAttributions failed:', e);
      return {};
    }
  }

  getAdherence() {
    const trades = this.getRoundTrips();
    const books = this.playbooks.map(p => ({ id: p.id, rules: p.rules }));
    const checks = [];
    for (const [key, ann] of Object.entries(this.annotations)) {
      if (ann.playbook && ann.rulesChecked) {
        for (const [rule, followed] of Object.entries(ann.rulesChecked)) {
          checks.push({ tradeKey: key, playbookId: ann.playbook, rule, followed: Boolean(followed) });
        }
      }
    }
    try {
      return analyzeAdherence(trades, books, checks);
    } catch (e) {
      console.warn('[JournalStore] analyzeAdherence failed:', e);
      return [];
    }
  }

  // ── Import / Export Utilities ──────────────────────────────────────
  importStatementContent(content, targetAccountId = null) {
    if (!content || typeof content !== 'string') {
      return { success: false, error: 'Empty statement content' };
    }
    const detected = detectFormat(content);
    const parsed = parseAuto(content);
    if (!parsed || !parsed.executions || parsed.executions.length === 0) {
      return {
        success: false,
        format: detected?.name || 'Unknown',
        error: 'No recognizable trade executions found in file.'
      };
    }

    const inserted = this.addExecutions(parsed.executions, targetAccountId);
    return {
      success: true,
      format: detected?.name || 'Auto-Detected',
      executionsCount: parsed.executions.length,
      insertedCount: inserted,
      skippedDuplicates: parsed.executions.length - inserted
    };
  }

  exportCsv() {
    const trips = this.getRoundTrips();
    const headers = [
      'TradeKey', 'AccountId', 'Symbol', 'Direction', 'Status',
      'OpenedAt', 'ClosedAt', 'Quantity', 'AvgEntry', 'AvgExit',
      'GrossPnl', 'Fees', 'NetPnl', 'DurationMinutes', 'Playbook', 'Tags', 'Mistakes', 'Notes'
    ];

    const rows = trips.map(t => [
      `"${t.key}"`,
      `"${t.accountId}"`,
      `"${t.symbol}"`,
      `"${t.direction}"`,
      `"${t.status}"`,
      `"${t.openedAt}"`,
      `"${t.closedAt || ''}"`,
      t.quantity,
      t.avgEntry.toFixed(4),
      (t.avgExit || 0).toFixed(4),
      t.grossPnl.toFixed(2),
      t.fees.toFixed(2),
      t.netPnl.toFixed(2),
      t.durationMs ? Math.round(t.durationMs / 60000) : 0,
      `"${t.annotations?.playbook || ''}"`,
      `"${(t.annotations?.tags || []).join(';')}"`,
      `"${(t.annotations?.mistakes || []).join(';')}"`,
      `"${(t.annotations?.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradingchart_journal_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  exportJson() {
    const payload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      executions: this.executions,
      accounts: this.accounts,
      propFirms: this.propFirms,
      playbooks: this.playbooks,
      notes: this.notes,
      annotations: this.annotations,
      settings: this.settings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradingchart_journal_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Seed Data Generation ───────────────────────────────────────────
  generateSeedExecutions() {
    const executions = [];
    const trades = [
      { day: 1, sym: 'BTCUSDT', side: 'buy', entry: 76200, exit: 77450, qty: 0.5, pnl: 625, playbook: 'smc-order-block', tag: 'A+ Setup', mistake: 'None' },
      { day: 2, sym: 'ETHUSDT', side: 'buy', entry: 2640, exit: 2715, qty: 5, pnl: 375, playbook: 'fvg-retest', tag: 'London Open', mistake: 'None' },
      { day: 3, sym: 'SOLUSDT', side: 'sell', entry: 182.5, exit: 178.0, qty: 30, pnl: 135, playbook: 'break-and-retest', tag: 'NY Reversal', mistake: 'None' },
      { day: 4, sym: 'XAUUSD', side: 'buy', entry: 2712.0, exit: 2734.5, qty: 10, pnl: 225, playbook: 'smc-order-block', tag: 'Asian Range Sweep', mistake: 'None' },
      { day: 5, sym: 'BTCUSDT', side: 'buy', entry: 77100, exit: 76650, qty: 0.5, pnl: -225, playbook: 'trend-pullback', tag: 'FOMO Entry', mistake: 'Chased Candle' },
      { day: 8, sym: 'EURUSD', side: 'sell', entry: 1.0920, exit: 1.0875, qty: 50000, pnl: 225, playbook: 'fvg-retest', tag: 'ECB Rate Play', mistake: 'None' },
      { day: 9, sym: 'BTCUSDT', side: 'buy', entry: 76800, exit: 78200, qty: 0.8, pnl: 1120, playbook: 'smc-order-block', tag: 'Institutional OB', mistake: 'None' },
      { day: 10, sym: 'SOLUSDT', side: 'buy', entry: 176.0, exit: 184.2, qty: 25, pnl: 205, playbook: 'trend-pullback', tag: 'Breakout', mistake: 'None' },
      { day: 11, sym: 'ETHUSDT', side: 'sell', entry: 2750, exit: 2690, qty: 4, pnl: 240, playbook: 'smc-order-block', tag: 'Liquidity Grab', mistake: 'None' },
      { day: 12, sym: 'XAUUSD', side: 'buy', entry: 2730.0, exit: 2718.0, qty: 10, pnl: -120, playbook: 'break-and-retest', tag: 'CPI News', mistake: 'Moved Stop' },
      { day: 15, sym: 'BTCUSDT', side: 'sell', entry: 78500, exit: 77100, qty: 0.6, pnl: 840, playbook: 'fvg-retest', tag: 'Weekly High Rejection', mistake: 'None' },
      { day: 16, sym: 'ETHUSDT', side: 'buy', entry: 2680, exit: 2745, qty: 6, pnl: 390, playbook: 'trend-pullback', tag: 'EMA Bounce', mistake: 'None' },
      { day: 17, sym: 'SOLUSDT', side: 'buy', entry: 180.5, exit: 186.0, qty: 20, pnl: 110, playbook: 'smc-order-block', tag: 'Order Flow', mistake: 'None' },
      { day: 18, sym: 'BTCUSDT', side: 'buy', entry: 77400, exit: 78050, qty: 1.0, pnl: 650, playbook: 'fvg-retest', tag: 'Discount Sweep', mistake: 'None' },
      { day: 19, sym: 'XAUUSD', side: 'buy', entry: 2742.0, exit: 2758.5, qty: 8, pnl: 132, playbook: 'trend-pullback', tag: 'Gold Breakout', mistake: 'None' },
      { day: 22, sym: 'EURUSD', side: 'buy', entry: 1.0880, exit: 1.0935, qty: 40000, pnl: 220, playbook: 'smc-order-block', tag: 'London Sweep', mistake: 'None' },
      { day: 23, sym: 'BTCUSDT', side: 'buy', entry: 77800, exit: 79200, qty: 0.7, pnl: 980, playbook: 'fvg-retest', tag: 'All Time High Run', mistake: 'None' },
      { day: 24, sym: 'SOLUSDT', side: 'sell', entry: 188.0, exit: 182.5, qty: 35, pnl: 192, playbook: 'break-and-retest', tag: 'Resistance Rejection', mistake: 'None' },
      { day: 25, sym: 'ETHUSDT', side: 'buy', entry: 2730, exit: 2685, qty: 5, pnl: -225, playbook: 'trend-pullback', tag: 'False Breakout', mistake: 'Overleveraged' }
    ];

    const anns = {};
    for (const t of trades) {
      const dateStr = `2026-09-${String(t.day).padStart(2, '0')}`;
      const openTime = `${dateStr}T10:00:00Z`;
      const closeTime = `${dateStr}T15:30:00Z`;
      const openId = `exec-open-${t.day}`;
      const closeId = `exec-close-${t.day}`;

      executions.push({
        id: openId,
        accountId: 'tradingchart-paper-1',
        symbol: t.sym,
        side: t.side,
        quantity: t.qty,
        price: t.entry,
        executedAt: openTime,
        fee: 1.5,
        source: 'manual',
        assetClass: t.sym.endsWith('USDT') ? 'crypto' : (t.sym === 'XAUUSD' ? 'other' : 'forex')
      });

      executions.push({
        id: closeId,
        accountId: 'tradingchart-paper-1',
        symbol: t.sym,
        side: t.side === 'buy' ? 'sell' : 'buy',
        quantity: t.qty,
        price: t.exit,
        executedAt: closeTime,
        fee: 1.5,
        source: 'manual',
        assetClass: t.sym.endsWith('USDT') ? 'crypto' : (t.sym === 'XAUUSD' ? 'other' : 'forex')
      });

      const tradeKey = `tradingchart-paper-1|${t.sym}|${t.side === 'buy' ? 'long' : 'short'}|${openTime}`;
      anns[tradeKey] = {
        playbook: t.playbook,
        tags: [t.tag],
        mistakes: t.mistake !== 'None' ? [t.mistake] : [],
        notes: `Trade executed according to ${t.playbook}. Market reaction was precise.`,
        rating: t.pnl > 0 ? 5 : 2,
        rulesChecked: {
          [DEFAULT_PLAYBOOKS[0].rules[0]]: true,
          [DEFAULT_PLAYBOOKS[0].rules[1]]: true,
          [DEFAULT_PLAYBOOKS[0].rules[2]]: true
        }
      };
    }

    this.annotations = anns;
    this.writeStorage(STORAGE_KEYS.ANNOTATIONS, anns);
    return executions;
  }
}
