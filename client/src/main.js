// client/src/main.js
// Master Application Coordinator for TradingChart (LuxAlgo Quant Architecture)

import { ChartManager } from './chartManager.js';
import { WatchlistManager } from './watchlistManager.js';
import { PaperTrading } from './paperTrading.js';
import { AlertsManager } from './alertsManager.js';
import { PineStudio } from './pineStudio.js';
import { StrategyTester } from './strategyTester.js';
import { PropFirmSimulator } from './propFirmSimulator.js';
import { TradeJournal } from './tradeJournal.js';
import { MarketTrackersView } from './marketTrackersView.js';
import { IndicatorsModal } from './indicatorsModal.js';
import { SettingsModal } from './settingsModal.js';
import { BarReplay } from './barReplay.js';
import { ShortcutsModal } from './shortcutsModal.js';
import { LayoutManager } from './layoutManager.js';
import { UserProfileModal, AVATAR_PRESETS } from './userProfileModal.js';
import { AuthManager } from './authManager.js';
import { TradeJournalModal } from './tradeJournalModal.js';
import { ScreenshotModal } from './screenshotModal.js';
import { CompareModal } from './compareModal.js';
import { ScaleControls } from './scaleControls.js';
import { EconomicCalendarView } from './economicCalendar.js';
import { DataExportModal } from './dataExport.js';
import { IndicatorSettingsModal } from './indicatorSettingsModal.js';
import { TimeframeManager } from './timeframeManager.js';
import { TemplateManager } from './templateManager.js';
import { TechnicalScreenerView } from './technicalScreener.js';
import { DepthOfMarketView } from './depthOfMarket.js';
import { FloatingDrawingToolbar } from './floatingDrawingToolbar.js';
import { DrawingToolsLibrary } from './drawingToolsLibrary.js';
import { GoToDateModal } from './goToDate.js';
import { CommandPalette } from './commandPalette.js';
import { ChartAlertsOverlay } from './chartAlertsOverlay.js';
import { MarketNewsView } from './marketNewsView.js';
import { GoldBubbleView } from './goldBubbleView.js';
import { TseTapeView } from './tseTapeView.js';
import { MarketSourcesModal } from './marketSourcesModal.js';
import { ChartStylePicker } from './chartStylePicker.js';
import { CanvasContextMenu } from './canvasContextMenu.js';
import { SoundEngine } from './soundEngine.js';
import { setLanguage, getLanguage, t, localizeMoreDrawer, toPersianDigits } from './i18n.js';
import { initPlatformBanner, relocalizePlatformBanner } from './platformBanner.js';
import { INDICATORS_FA } from './indicatorsFa.js';
import { migrateClientSymbol, CLIENT_LEGACY_ALIASES } from './watchlistManager.js';

// Canonical Vela timeframe ids are minute counts ('15', '60', '240') or
// 'D'/'W'/'M'. Human labels like '15m' / '4h' must be normalized first —
// Vela upper-cases the unit, so a raw '15m' silently became 15 MONTHS.
function normalizeTf(tf) {
  const s = String(tf ?? '').trim();
  const m = /^(\d+)\s*([mhdw])$/i.exec(s);
  if (!m) return s;
  const n = parseInt(m[1], 10), u = m[2];
  if (u === 'm') return String(n);                 // minutes (lower-case only)
  if (u === 'h' || u === 'H') return String(n * 60);
  if (u === 'd' || u === 'D') return n === 1 ? 'D' : `${n}D`;
  if (u === 'w' || u === 'W') return n === 1 ? 'W' : `${n}W`;
  return s; // 'M' (upper) = month: leave as-is
}
window.__normalizeTf = normalizeTf;

class TradingChartApp {
  constructor() {
    this.currentSymbol = 'BINANCE:BTCUSDT';
    this.currentTimeframe = '60';
    this.symbolCatalog = new Map();
    this.currentCatalogEntry = null;
    try {
      const prof = JSON.parse(localStorage.getItem('tradingchart_user_profile') || '{}');
      if (prof.defaultAsset) this.currentSymbol = migrateClientSymbol(prof.defaultAsset);
      if (prof.defaultTimeframe) this.currentTimeframe = normalizeTf(prof.defaultTimeframe);
    } catch (e) {}
    // TradingView-style deep links: /chart?symbol=BINANCE:BTCUSDT&interval=60
    try {
      const q = new URLSearchParams(window.location.search);
      const rawSym = q.get('symbol');
      if (rawSym) {
        this.currentSymbol = migrateClientSymbol(rawSym.trim());
        this.deepLink = { symbol: this.currentSymbol };
      }
      const qi = q.get('interval') || q.get('tf');
      if (qi && /^[0-9]{1,4}[smhdwSMHDW]?$|^[DWM]$/.test(qi)) { this.currentTimeframe = normalizeTf(qi); this.deepLink = { ...(this.deepLink || {}), interval: this.currentTimeframe }; }
    } catch (e) {}
    this.activeBars = [];
    this.activeWorkspaceView = 'quant'; // 'quant' or 'journal'
    this.chartManager = null;
    this.watchlist = null;
    this.paperTrading = null;
    this.alertsManager = null;
    this.pineStudio = null;
    this.strategyTester = null;
    this.propFirmSim = null;
    this.tradeJournal = null;
    this.fullPageJournal = null;
    this.marketTrackers = null;
    this.economicCalendar = null;
    this.technicalScreener = null;
    this.depthOfMarket = null;
    this.floatingToolbar = null;
    this.chartAlertsOverlay = null;
    this.indicatorsModal = null;
    this.settingsModal = null;
    this.barReplay = null;
    this.compareModal = null;
    this.scaleControls = null;
    this.dataExportModal = null;
    this.indicatorSettingsModal = null;
    this.timeframeManager = null;
    this.goldBubbleView = null;
    this.tseTapeView = null;
    this.tseEnabled = false;
    this.marketSourcesModal = null;
    // Last known-good candle series per symbol/timeframe, used to guarantee the
    // chart and indicator engine never receive an empty series during an outage.
    this.seriesCache = new Map();
    this.isBottomPanelCollapsed = true;

    this.init();
  }

  async init() {
    console.log('[TradingChart] Initializing LuxAlgo Quant Workspace...');
    window.__TRADING_APP__ = this;
    window.__TRADING_APP__.symbolCatalog = this.symbolCatalog;
    window.__TRADING_APP__.currentCatalogEntry = this.currentCatalogEntry;

    // 0. Account system boot (TradingView-parity accounts): resolves session,
    // applies cloud state to localStorage BEFORE any manager reads its prefs,
    // and renders the header auth zone. Guest mode proceeds unchanged.
    this.auth = new AuthManager(this);
    try { await this.auth.init(); } catch (e) { console.warn('[Auth] boot failed, continuing as guest:', e); }
    // Admin-controlled global announcement (back-office → Settings).
    initPlatformBanner();

    // 1. Initialize Chart Canvas Workspace (Vela WebGL2 + PineTS)
    const canonicalSwitchSymbol = this.switchSymbol.bind(this);
    this.chartManager = new ChartManager({
      app: this,
      mountId: '#vela-workspace-mount',
      onSymbolChange: (sym) => this.handleSymbolChange(sym)
    });
    this.switchSymbol = canonicalSwitchSymbol;
    if (window.__TRADING_APP__) {
      window.__TRADING_APP__.switchSymbol = canonicalSwitchSymbol;
    }
    this.applyStoredTheme();

    // 2. Initialize Modals
    this.indicatorsModal = new IndicatorsModal({
      modalEl: document.querySelector('#modal-indicators'),
      onAddIndicator: (item) => {
        // TradingView-parity plan gate: indicators-per-chart entitlement.
        if (this.auth && !this.auth.enforce('indicatorsPerChart', this.chartManager.countActiveIndicators(), 'indicators per chart', 'اندیکاتور در هر چارت')) {
          return { success: false, error: 'plan_limit' };
        }
        if (item.nativeName && this.chartManager?.workspace?.active?.chart?.addNativeIndicator) {
          try {
            const handle = this.chartManager.workspace.active.chart.addNativeIndicator(item.nativeName);
            if (handle) {
              const isFa = getLanguage() === 'fa';
              this.showToast(isFa ? `اندیکاتور «${INDICATORS_FA[item.id]?.name || item.name}» روی چارت اعمال شد` : `Added ${item.name} to active chart`, 'success');
              this.layoutManager?.schedulePersist?.();
              return { success: true, handleId: handle.id };
            }
          } catch (e) {
            console.warn('[AddIndicator] Native indicator fallback to Pine:', e);
          }
        }
        if (item.script) {
          const res = this.chartManager.addPineIndicator(item.script, item.name);
          const isFa = getLanguage() === 'fa';
          if (res?.success) {
            this.showToast(isFa ? `اندیکاتور «${INDICATORS_FA[item.id]?.name || item.name}» روی چارت اعمال شد` : `Added ${item.name} to active chart`, 'success');
          } else {
            this.showToast(isFa ? `افزودن اندیکاتور «${INDICATORS_FA[item.id]?.name || item.name}» ناموفق بود. لطفاً دوباره تلاش کنید.` : `Could not add ${item.name}. Please try again.`, 'error');
          }
          return res;
        }
      }
    });

    this.settingsModal = new SettingsModal({
      modalEl: document.querySelector('#modal-settings'),
      onApplySettings: (cfg) => {
        this.chartManager.applySettings(cfg);
        if (cfg.language && cfg.language !== getLanguage()) {
          this.switchLanguage(cfg.language);
        }
      }
    });

    this.shortcutsModal = new ShortcutsModal();

    // 3. Initialize Bar Replay with Interactive Simulated Execution
    this.barReplay = new BarReplay({
      container: document.querySelector('#replay-bar'),
      app: this,
      onBarStep: (idx) => {
        if (this.activeBars && this.activeBars.length > 0) {
          const slice = this.activeBars.slice(0, idx + 1);
          const chart = this.chartManager.workspace?.active?.chart;
          if (chart?.orchestrator) {
            chart.orchestrator.setBarSeries(slice, { preserveView: true });
          }
          if (slice.length > 0) {
            // Replay is a sandbox: its historical price drives ONLY the replay
            // position. Feeding it to paperTrading.setMarket would trigger the
            // live account's resting orders / P&L at a past price.
            const currentClose = slice[slice.length - 1].close;
            this.barReplay?.setPrice(currentClose);
          }
        }
      },
      onStart: () => {
        // Freeze the live tick stream: otherwise Vela re-appends the real latest
        // bars into the replay slice and shows the "future" mid-replay.
        const orch = this.chartManager.workspace?.active?.chart?.orchestrator;
        try { orch?.stopLive?.(); } catch (e) {}
        this._replayFrozen = !!orch;
      },
      onExit: () => {
        const chart = this.chartManager.workspace?.active?.chart;
        if (this._replayFrozen) {
          try { chart?.orchestrator?.startLive?.(); } catch (e) {}
          this._replayFrozen = false;
        }
        if (chart?.orchestrator && this.activeBars && this.activeBars.length > 0) {
          chart.orchestrator.setBarSeries(this.activeBars, { preserveView: true });
          // live bars that arrived during replay were buffered in activeBars — now shown
        }
      }
    });

    // 4. Initialize Floating Drawing Toolbar & Canvas Alert Overlay (TradingView Parity)
    this.floatingToolbar = new FloatingDrawingToolbar(this);
    this.drawingToolsLibrary = new DrawingToolsLibrary(this);
    // Keep floating toolbar highlight in sync with library selection
    this.drawingToolsLibrary.onToolSelected = (tool) => {
      this.floatingToolbar.activeTool = tool;
      this.floatingToolbar.render();
    };
    this.goToDateModal = new GoToDateModal(this);
    this.commandPalette = new CommandPalette(this);
    this.chartAlertsOverlay = new ChartAlertsOverlay(this);
    this.chartStylePicker = new ChartStylePicker(this);
    this.contextMenu = new CanvasContextMenu(this);

    // 4b. Sound Feedback Engine & Toggle Button
    this.soundEngine = new SoundEngine();
    const btnSound = document.querySelector('#btn-toggle-sound');
    btnSound?.addEventListener('click', () => {
      const isMuted = this.soundEngine.toggleMute();
      btnSound.style.opacity = isMuted ? '0.35' : '1';
      btnSound.setAttribute('title', isMuted ? 'Sound Muted' : 'Sound Active');
      if (!isMuted) this.soundEngine.playAlert();
    });

    // 5. Initialize Desktop Bottom Suite
    this.initDesktopBottomSuite();

    // 5b. Initialize Full-Page Trade Journal View
    this.initFullPageJournal();

    // 5c. Initialize TradingView Layout Studio & Auxiliary Modals
    this.layoutManager = new LayoutManager(this);
    this.userProfileModal = new UserProfileModal(this);
    this.tradeJournalModal = new TradeJournalModal(this);
    this.screenshotModal = new ScreenshotModal(this);
    this.compareModal = new CompareModal(this);
    this.scaleControls = new ScaleControls(this);
    this.dataExportModal = new DataExportModal(this);
    this.indicatorSettingsModal = new IndicatorSettingsModal(this);
    this.timeframeManager = new TimeframeManager(this);
    this.marketSourcesModal = new MarketSourcesModal({ app: this });

    // 6. Wire Top App Header & Modals
    this.bindEvents();

    // 7. Start live latency ping
    this.startLatencyPing();

    // 8. Initial Data Load
    this.loadActiveCandles();
    this.checkTseAvailability();
  }

  async checkTseAvailability() {
    try {
      const res = await fetch('/api/market-sources');
      if (res.ok) {
        const data = await res.json();
        const sources = Array.isArray(data?.sources) ? data.sources : [];
        this.tseEnabled = sources.some(s => s.id === 'brsapi' || s.id === 'tsetmc_proxy' || s.marketsCovered?.includes('TSE') || s.marketsCoveredFa?.includes('بورس تهران'));
        if (!this.tseEnabled) {
          this.hideTseElements();
        }
      } else {
        this.tseEnabled = false;
        this.hideTseElements();
      }
    } catch (e) {
      this.tseEnabled = false;
      this.hideTseElements();
    }
  }

  hideTseElements() {
    document.querySelectorAll('.rail-btn[data-panel="tse"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.panel-tab[data-view="tse"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.panel-menu-item[data-panel="tse"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sym-cat-btn[data-cat="iran_tse"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('option[value="iran_tse"], option[value="tsetmc"]').forEach(el => el.style.display = 'none');
    const tseView = document.querySelector('#view-tse');
    if (tseView) tseView.style.display = 'none';
    if (this.activeBottomView === 'tse') {
      this.switchBottomView('terminal');
    }
  }

  initDesktopBottomSuite() {
    // Only populated when viewed on desktop
    const pineEl = document.querySelector('#view-pine');
    if (pineEl) {
      this.pineStudio = new PineStudio({
        container: pineEl,
        onAddToChart: (code) => {
          const res = this.chartManager.addPineIndicator(code);
          if (res.success) {
            console.log('[TradingChart] Pine Indicator successfully mounted onto chart');
          }
        },
        onBacktest: (code) => {
          this.switchBottomView('strategy');
          this.strategyTester?.runSimulation(code, this.activeBars);
        }
      });
    }

    const stratEl = document.querySelector('#view-strategy');
    if (stratEl) {
      this.strategyTester = new StrategyTester({
        container: stratEl,
        onExportToPropSim: (profile) => {
          this.switchBottomView('propsim');
          this.propFirmSim?.setProfileParams(profile);
        }
      });
    }

    const propEl = document.querySelector('#view-propsim');
    if (propEl) {
      this.propFirmSim = new PropFirmSimulator({
        container: propEl
      });
    }

    const journalEl = document.querySelector('#view-journal');
    if (journalEl) {
      this.tradeJournal = new TradeJournal({
        container: journalEl,
        app: this
      });
    }

    const trackersEl = document.querySelector('#view-trackers');
    if (trackersEl) {
      this.marketTrackers = new MarketTrackersView({
        container: trackersEl
      });
    }

    const calendarEl = document.querySelector('#view-calendar');
    if (calendarEl) {
      this.economicCalendar = new EconomicCalendarView({
        container: calendarEl
      });
    }

    const screenerEl = document.querySelector('#view-screener');
    if (screenerEl) {
      this.technicalScreener = new TechnicalScreenerView({
        container: screenerEl,
        app: this
      });
    }

    const newsEl = document.querySelector('#view-news');
    if (newsEl) {
      this.marketNews = new MarketNewsView({
        container: newsEl,
        app: this
      });
    }

    const goldEl = document.querySelector('#view-gold');
    if (goldEl) {
      this.goldBubbleView = new GoldBubbleView({
        container: goldEl,
        app: this
      });
    }

    const tseEl = document.querySelector('#view-tse');
    if (tseEl) {
      this.tseTapeView = new TseTapeView({
        container: tseEl,
        app: this
      });
    }
  }

  initFullPageJournal() {
    const journalView = document.querySelector('#journal-workspace-view');
    if (journalView) {
      this.fullPageJournal = new TradeJournal({
        container: journalView,
        app: this,
        store: this.tradeJournal?.store
      });
    }
  }

  // ── Vela Native Side Panel Mount Handlers ──────────────────────────

  mountWatchlist(body) {
    this.watchlist = new WatchlistManager({
      app: this,
      container: body,
      onSelectSymbol: (sym) => this.switchSymbol(sym)
    });
  }

  mountPaperTrading(body) {
    if (!this.paperTrading) {
      this.paperTrading = new PaperTrading({
        app: this,
        container: body
      });
    } else {
      this.paperTrading.container = body;
      this.paperTrading.render();
    }
    if (this.activeBars.length > 0) {
      this.paperTrading.setMarket(this.currentSymbol, this.activeBars[this.activeBars.length - 1].close);
    }
  }

  mountAlerts(body) {
    if (!this.alertsManager) {
      this.alertsManager = new AlertsManager({
        app: this,
        container: body
      });
    } else {
      this.alertsManager.container = body;
      this.alertsManager.render();
    }
  }

  renderFeatureLocked(body, featureKey, labelEn, labelFa) {
    const isFa = getLanguage() === 'fa';
    body.innerHTML = `
      <div class="tc-feature-locked" data-locked-feature="${featureKey}" style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; text-align:center; gap:14px; background:var(--bg-card,#151c2d); color:#fff; ${isFa ? 'direction:rtl;' : ''}">
        <div style="font-size:36px; background:rgba(255,255,255,0.04); border-radius:50%; width:68px; height:68px; display:flex; align-items:center; justify-content:center;">🔒</div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <strong style="font-size:13px; color:#fff;">${isFa ? `قابلیت «${labelFa}» در پلن شما فعال نیست` : `The "${labelEn}" feature is not enabled`}</strong>
          <span style="font-size:11px; color:var(--text-dim,#8b93a7); line-height:1.6; max-width:280px;">
            ${isFa ? 'برای دسترسی به این بخش، لطفاً پلن کاربری خود را ارتقا دهید.' : 'Upgrade your subscription plan to unlock full access to this feature.'}
          </span>
        </div>
        <button class="tc-upgrade-btn btn-primary" style="padding:8px 18px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; background:var(--accent-cyan,#00F2B0); color:#04121e; border:none;">
          ${isFa ? 'مشاهده پلن‌ها و ارتقا' : 'View Plans & Upgrade'}
        </button>
      </div>`;
    body.querySelector('.tc-upgrade-btn')?.addEventListener('click', () => {
      this.auth?.openPlansModal();
    });
  }

  mountPineEditor(body) {
    if (this.auth && !this.auth.feature('pineStudio')) {
      this.renderFeatureLocked(body, 'pineStudio', 'Pine Script Studio', 'استودیو پاین‌اسکریپت');
      return;
    }
    new PineStudio({
      container: body,
      onAddToChart: (code) => {
        this.chartManager.addPineIndicator(code);
      },
      onBacktest: (code) => {
        this.chartManager.togglePanel('strategy', true);
        this.strategyTester?.runSimulation(code, this.activeBars);
      }
    });
  }

  mountStrategyTester(body) {
    if (this.auth && !this.auth.feature('strategyTester')) {
      this.renderFeatureLocked(body, 'strategyTester', 'Strategy Tester', 'تستر استراتژی');
      return;
    }
    const st = new StrategyTester({
      container: body,
      onExportToPropSim: (profile) => {
        this.chartManager.togglePanel('propsim', true);
        this.propFirmSim?.setProfileParams(profile);
      }
    });
    // Same backtest in both surfaces: mirror the bottom tester's last run.
    const main = this.strategyTester;
    if (main?.results) { st.results = main.results; st.lastCode = main.lastCode; st.candles = this.activeBars || []; st.renderReport(); }
    else st.setCandles(this.activeBars);
    this.strategyTesterSide = st;
  }

  mountPropFirmSim(body) {
    if (this.auth && !this.auth.feature('propFirmSim')) {
      this.renderFeatureLocked(body, 'propFirmSim', 'Prop-Firm Simulator', 'شبیه‌ساز چالش‌های پراپ‌فرم');
      return;
    }
    new PropFirmSimulator({
      container: body
    });
  }

  mountTradeJournal(body) {
    if (this.auth && !this.auth.feature('tradeJournal')) {
      this.renderFeatureLocked(body, 'tradeJournal', 'Trade Journal', 'ژورنال معاملاتی');
      return;
    }
    new TradeJournal({
      container: body
    });
  }

  mountMarketTrackers(body) {
    if (this.auth && !this.auth.feature('marketTrackers')) {
      this.renderFeatureLocked(body, 'marketTrackers', 'Institutional Trackers', 'دیده‌بان معامله‌گران نهادی');
      return;
    }
    new MarketTrackersView({
      container: body
    });
  }

  mountIndicatorTemplates(body) {
    this.templateManager = new TemplateManager(this, body);
  }

  mountEconomicCalendar(body) {
    if (this.auth && !this.auth.feature('economicCalendar')) {
      this.renderFeatureLocked(body, 'economicCalendar', 'Economic Calendar', 'تقویم اقتصادی');
      return;
    }
    // Keep a reference: this instance lives in Vela's drawer/dock, so it must be
    // reachable for language re-renders like every other surface.
    this.economicCalendarSide = new EconomicCalendarView({
      container: body
    });
  }

  mountTechnicalScreener(body) {
    // Keep a reference: this instance lives in Vela's drawer/dock, so it must be
    // reachable for language re-renders like every other surface.
    this.technicalScreenerSide = new TechnicalScreenerView({
      container: body,
      app: this
    });
  }

  mountDepthOfMarket(body) {
    if (this.auth && !this.auth.feature('depthOfMarket')) {
      this.renderFeatureLocked(body, 'depthOfMarket', 'Depth of Market (DOM)', 'عمق بازار (DOM)');
      return;
    }
    this.depthOfMarket = new DepthOfMarketView({
      container: body,
      app: this
    });
    this.depthOfMarket.setSymbol(this.currentSymbol);
  }

  mountMarketNews(body) {
    if (this.auth && !this.auth.feature('marketNews')) {
      this.renderFeatureLocked(body, 'marketNews', 'Market News', 'اخبار بازار');
      return;
    }
    this.marketNewsSide = new MarketNewsView({
      container: body,
      app: this
    });
  }

  mountWorkspaces(body) {
    this.workspacesBody = body;
    this.renderWorkspaces();
  }

  renderWorkspaces() {
    const body = this.workspacesBody;
    if (!body) return;
    const isFa = getLanguage() === 'fa';

    body.innerHTML = `
      <div style="padding: 12px; display: flex; flex-direction: column; gap: 14px; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 8px;">${isFa ? 'گرید چیدمان چندچارته' : 'Multi-Chart Layout Grid'}</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
            <button class="btn-ws-layout btn-secondary" data-layout="1" style="justify-content: center; font-size: 12px; padding: 8px;">${isFa ? 'تک پنجره (1×1)' : 'Single (1×1)'}</button>
            <button class="btn-ws-layout btn-secondary" data-layout="2h" style="justify-content: center; font-size: 12px; padding: 8px;">${isFa ? 'دو چارت افقی (2×1)' : 'Dual H (2×1)'}</button>
            <button class="btn-ws-layout btn-secondary" data-layout="2v" style="justify-content: center; font-size: 12px; padding: 8px;">${isFa ? 'دو چارت عمودی (1×2)' : 'Dual V (1×2)'}</button>
            <button class="btn-ws-layout btn-secondary" data-layout="4" style="justify-content: center; font-size: 12px; padding: 8px;">${isFa ? 'چهار چارت (2×2)' : 'Quad (2×2)'}</button>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
          <div style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 8px;">${isFa ? 'همگام‌سازی هوشمند چارت‌ها' : 'Chart Synchronization'}</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); cursor: pointer;">
              <span>${isFa ? 'همگام‌سازی نماد' : 'Sync Symbol'}</span>
              <input type="checkbox" id="sync-symbol-check" style="cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); cursor: pointer;">
              <span>${isFa ? 'همگام‌سازی بازه زمانی' : 'Sync Timeframe'}</span>
              <input type="checkbox" id="sync-tf-check" style="cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); cursor: pointer;">
              <span>${isFa ? 'همگام‌سازی کراس‌هیر' : 'Sync Crosshair'}</span>
              <input type="checkbox" id="sync-cross-check" checked style="cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); cursor: pointer;">
              <span>${isFa ? 'همگام‌سازی ترسیم‌ها' : 'Sync Drawings'}</span>
              <input type="checkbox" id="sync-drawings-check" style="cursor: pointer;" />
            </label>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
          <div style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 8px;">${isFa ? 'فضاهای کاری ذخیره‌شده' : 'Saved Workspaces'}</div>
          <div style="background: var(--bg-card); padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
            <span>${isFa ? 'طرح تحلیلی پیش‌فرض' : 'Default Master Layout'}</span>
            <span style="font-size: 10px; color: var(--accent-cyan); font-weight: 700;">${isFa ? 'فعال' : 'ACTIVE'}</span>
          </div>
        </div>
      </div>
    `;

    body.querySelectorAll('.btn-ws-layout').forEach(btn => {
      btn.addEventListener('click', () => {
        const lay = btn.getAttribute('data-layout');
        this.layoutManager?.setLayout(lay);
      });
    });

    body.querySelector('#sync-symbol-check')?.addEventListener('change', (e) => this.layoutManager?.toggleSync?.('symbol', e.target.checked));
    body.querySelector('#sync-tf-check')?.addEventListener('change', (e) => this.layoutManager?.toggleSync?.('timeframe', e.target.checked));
    body.querySelector('#sync-cross-check')?.addEventListener('change', (e) => this.layoutManager?.toggleSync?.('crosshair', e.target.checked));
    body.querySelector('#sync-drawings-check')?.addEventListener('change', (e) => this.layoutManager?.toggleSync?.('drawings', e.target.checked));
  }

  // ── Data Loading & Symbol Navigation ───────────────────────────────

  async loadActiveCandles() {
    try {
      // Pre-flight validation: a rejected/empty payload must never be applied.
      const bars = await this.fetchCandlesFor(this.currentSymbol, this.currentTimeframe, 2000);
      if (!bars || bars.length === 0) {
        console.warn('[TradingChart] Empty candles payload — retaining previous series');
        if (!this.activeBars || this.activeBars.length === 0) {
          const isFa = document.body.classList.contains('persian-mode');
          this.showToast?.(isFa
            ? 'داده‌ای از سرور دریافت نشد؛ نمایش آخرین داده معتبر'
            : 'No data received from server; showing last valid series');
        }
        return;
      }
      this.applyCandles(bars);
    } catch (e) {
      // Network/abort failures keep the last valid series on screen.
      console.warn('[TradingChart] Error loading initial candles:', e);
    }
  }

  getBaseAsset(sym) {
    if (!sym) return 'BTC';
    const clean = sym.replace(/^.*:/, '').toUpperCase();
    if (clean.endsWith('USDT')) return clean.slice(0, -4);
    if (clean.endsWith('USD')) return clean.slice(0, -3);
    if (clean.endsWith('BTC')) return clean.slice(0, -3);
    if (clean.startsWith('XAU')) return 'XAU';
    if (clean.startsWith('XAG')) return 'XAG';
    return clean.slice(0, 4);
  }

  showRemovedSymbolNotice(msg) {
    let el = document.querySelector('#removed-symbol-notice, .tc-chart-notice, .chart-feed-notice, [data-notice-id="unsupported_symbol"]');
    if (!el) {
      el = document.createElement('div');
      el.id = 'removed-symbol-notice';
      el.className = 'tc-chart-notice chart-feed-notice notice-banner';
      (document.querySelector('#chart-area') || document.body).appendChild(el);
    }
    el.setAttribute('data-notice-id', 'unsupported_symbol');
    el.style.display = 'flex';
    el.innerText = msg;
  }

  hideRemovedSymbolNotice() {
    const el = document.querySelector('#removed-symbol-notice, [data-notice-id="unsupported_symbol"]');
    if (el) {
      el.style.display = 'none';
      el.innerText = '';
    }
  }

  async switchSymbol(sym) {
    const raw = String(sym ?? '').trim();
    const clean = migrateClientSymbol(raw);
    const prev = this.currentSymbol;

    // Reject blank / malformed tickers up front
    if (!clean || !/^[A-Z0-9._:-]{2,35}$/i.test(clean)) {
      const isFa = document.body.classList.contains('persian-mode') || getLanguage() === 'fa';
      this.showToast?.(isFa
        ? `نماد «${String(sym).trim() || '—'}» معتبر نیست`
        : `Invalid symbol "${String(sym).trim() || '—'}"`);
      return false;
    }

    // Immediately update symbol and badge for zero-latency UI responsiveness
    this.currentSymbol = clean;
    this.updateTopbarSourceBadge(clean);

    // Lookup metadata
    let meta = this.symbolCatalog.get(clean);
    if (!meta) {
      try {
        const mRes = await fetch(`/api/symbol-info?symbol=${encodeURIComponent(clean)}`);
        if (mRes.ok) {
          meta = await mRes.json();
          this.symbolCatalog.set(clean, meta);
          if (meta.symbol) this.symbolCatalog.set(meta.symbol, meta);
        } else if (mRes.status === 404) {
          this.currentSymbol = prev;
          this.updateTopbarSourceBadge(prev);
          const isFa = document.body.classList.contains('persian-mode') || getLanguage() === 'fa';
          const removedMsg = isFa ? 'این نماد دیگر پشتیبانی نمی‌شود' : 'This symbol is no longer supported';
          this.showToast?.(removedMsg);
          this.showRemovedSymbolNotice(removedMsg);
          return false;
        }
      } catch (e) {}
    }

    if (meta) {
      this.currentCatalogEntry = meta;
      if (window.__TRADING_APP__) {
        window.__TRADING_APP__.currentCatalogEntry = meta;
        window.__TRADING_APP__.symbolCatalog = this.symbolCatalog;
      }
      if (meta.timeframes && Array.isArray(meta.timeframes) && meta.timeframes.length > 0) {
        if (!meta.timeframes.includes(this.currentTimeframe)) {
          this.currentTimeframe = meta.timeframes[0];
          this.chartManager?.setTimeframe?.(this.currentTimeframe);
        }
      }
    }
    this.updateTopbarSourceBadge(clean, meta);
    this.timeframeManager?.updateAllowedTimeframes(meta?.timeframes);

    // Pre-flight: never repoint the chart at a symbol with no data
    const bars = await this.fetchCandlesFor(clean, this.currentTimeframe);
    if (!bars || bars.length === 0) {
      this.currentSymbol = prev;
      this.updateTopbarSourceBadge(prev);
      const isFa = document.body.classList.contains('persian-mode') || getLanguage() === 'fa';
      const removedMsg = isFa ? 'این نماد دیگر پشتیبانی نمی‌شود' : 'This symbol is no longer supported';
      this.showToast?.(removedMsg);
      this.showRemovedSymbolNotice(removedMsg);
      return false;
    }

    this.hideRemovedSymbolNotice();
    this.tseTapeView?.setSymbol?.(clean);
    this.chartManager?.setSymbol?.(clean);
    this.depthOfMarket?.setSymbol(clean);
    this.watchlist?.setSymbol(clean);
    const lastClose = bars[bars.length - 1].close;
    this.paperTrading?.setMarket(clean, lastClose);

    const unitEl = document.querySelector('.qt-unit, #quick-trade-unit');
    if (unitEl) unitEl.innerText = this.getBaseAsset(clean);

    this.applyCandles(bars);
    return true;
  }

  /** Fetch a candle series for an arbitrary symbol/timeframe (pre-flight helper). */
  async fetchCandlesFor(symbol, timeframe, limit = 2000) {
    const key = `${symbol}_${timeframe}`;
    try {
      const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`);
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw = Array.isArray(data.candles) ? data.candles : [];
      const bars = raw.filter(b => b && Number.isFinite(Number(b.time)) && Number.isFinite(Number(b.close)));
      if (bars.length === 0) {
        const lastGood = this.seriesCache.get(key);
        if (lastGood && lastGood.length) return lastGood;
        return [];
      }
      this.seriesCache.set(key, bars);
      return bars;
    } catch (e) {
      // Network/HTTP failure: degrade to the last known-good series (never empty).
      const lastGood = this.seriesCache.get(key);
      if (lastGood && lastGood.length) return lastGood;
      return [];
    }
  }

  /** Apply a validated candle series to every dependent surface. */
  applyCandles(bars) {
    if (!Array.isArray(bars) || bars.length === 0) return;
    this.activeBars = bars;
    this.strategyTester?.setCandles(this.activeBars);
    const lastBar = this.activeBars[this.activeBars.length - 1];
    this.paperTrading?.setMarket(this.currentSymbol, lastBar.close);
    this.alertsManager?.setMarket(this.currentSymbol, lastBar.close);
    this.updateQuickTradePrices(lastBar);
    this.chartAlertsOverlay?.updateAlerts(this.alertsManager?.alerts, this.currentSymbol, lastBar.close);
  }

  /** A /chart?symbol=…&interval=… link wins over the autosaved layout
   *  (TradingView behaviour): re-apply it once the restored layout settled. */
  async applyDeepLink() {
    const dl = this.deepLink;
    if (!dl || this._deepLinkApplied) return;
    this._deepLinkApplied = true;
    try {
      // Compare against the ACTIVE CELL (the restored layout may have repointed
      // it after the constructor seeded currentSymbol/currentTimeframe).
      const cell = this.chartManager?.workspace?.active;
      const cellSym = String(cell?.symbol || this.currentSymbol || '').replace(/^.*:/, '').toUpperCase();
      const cellTf = String(cell?.timeframe || this.currentTimeframe || '');
      if (dl.symbol && dl.symbol !== cellSym) await this.switchSymbol(dl.symbol);
      if (dl.interval && String(dl.interval) !== cellTf) await this.setTimeframe(dl.interval);
      else if (dl.interval) this.currentTimeframe = String(dl.interval);
    } catch (e) { console.warn('[Chartivia] deep link not applied:', e?.message || e); }
  }

  async setTimeframe(tf) {
    const tfStr = String(tf);
    const prev = this.currentTimeframe;
    // Same pre-flight guarantee as symbol switching: an empty timeframe must not
    // leave the chart/indicator engine in a broken state.
    const bars = await this.fetchCandlesFor(this.currentSymbol, tfStr);
    if (!bars || bars.length === 0) {
      const isFa = document.body.classList.contains('persian-mode');
      this.showToast?.(isFa
        ? `داده‌ای برای تایم‌فریم ${tfStr} در دسترس نیست`
        : `No data available for timeframe ${tfStr}`);
      return false;
    }
    this.currentTimeframe = tfStr;
    this.chartManager?.setTimeframe?.(tfStr);
    this.applyCandles(bars);
    return true;
  }

  handleSymbolChange(sym) {
    const clean = String(sym ?? '').replace(/^.*:/, '').trim().toUpperCase();
    if (!clean || !/^[A-Z0-9._-]{2,20}$/.test(clean)) return;
    this.currentSymbol = clean;
    this.depthOfMarket?.setSymbol(clean);
    this.watchlist?.setSymbol(clean);
    const lastClose = this.activeBars && this.activeBars.length > 0 ? this.activeBars[this.activeBars.length - 1].close : null;
    this.paperTrading?.setMarket(clean, lastClose);

    const unitEl = document.querySelector('.qt-unit, #quick-trade-unit');
    if (unitEl) unitEl.innerText = this.getBaseAsset(clean);

    this.loadActiveCandles();
  }

  // ── Workspace Mode Switching (Quant vs Journal) ────────────────────

  switchWorkspace(mode) {
    this.activeWorkspaceView = mode;
    const quantBtn = document.querySelector('#nav-btn-quant');
    const journalBtn = document.querySelector('#nav-btn-journal');
    const chartArea = document.querySelector('#chart-area');
    const journalView = document.querySelector('#journal-workspace-view');

    if (mode === 'quant') {
      quantBtn?.classList.add('active');
      journalBtn?.classList.remove('active');
      if (chartArea) chartArea.style.display = 'flex';
      if (journalView) journalView.style.display = 'none';
      window.dispatchEvent(new Event('resize'));
    } else if (mode === 'journal') {
      quantBtn?.classList.remove('active');
      journalBtn?.classList.add('active');
      if (chartArea) chartArea.style.display = 'none';
      if (journalView) {
        journalView.style.display = 'flex';
        this.fullPageJournal?.render();
      }
    }
  }

  // ── Event Bindings ─────────────────────────────────────────────────

  bindEvents() {
    // 1. Workspace Pill Switching (Quant / Journal / + Panels)
    document.querySelector('#nav-btn-quant')?.addEventListener('click', () => {
      this.switchWorkspace('quant');
    });

    document.querySelector('#nav-btn-journal')?.addEventListener('click', () => {
      this.switchWorkspace('journal');
    });

    // 2. + Panels Menu Drawer Toggle
    const modalPanelsMenu = document.querySelector('#modal-panels-menu');
    const btnOpenPanels = document.querySelector('#nav-btn-panels');
    const btnClosePanels = document.querySelector('#modal-close-panels-menu');

    btnOpenPanels?.addEventListener('click', () => {
      modalPanelsMenu?.classList.add('open');
    });

    btnClosePanels?.addEventListener('click', () => {
      modalPanelsMenu?.classList.remove('open');
    });

    modalPanelsMenu?.addEventListener('click', (e) => {
      if (e.target === modalPanelsMenu) modalPanelsMenu.classList.remove('open');
    });

    // Panel Menu Item Clicks
    document.querySelectorAll('.panel-menu-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const panelId = btn.getAttribute('data-panel');
        modalPanelsMenu?.classList.remove('open');

        if (panelId === 'layouts') {
          this.layoutManager?.openLayoutStudio();
          return;
        }

        if (panelId === 'journal' && this.activeWorkspaceView !== 'journal') {
          this.switchWorkspace('journal');
          return;
        }

        if (panelId === 'compare') {
          this.compareModal?.open();
          return;
        }

        if (panelId === 'chartStyle') {
          this.chartStylePicker?.toggle();
          return;
        }
        if (panelId === 'barReplay') {
          this.toggleReplay();
          return;
        }
        if (panelId === 'dataExport') {
          this.dataExportModal?.open();
          return;
        }
        if (panelId === 'gold') {
          this.switchBottomView('gold');
          return;
        }
        if (panelId === 'tse') {
          this.switchBottomView('tse');
          return;
        }
        if (panelId === 'sources') {
          this.marketSourcesModal?.open();
          return;
        }

        if (this.activeWorkspaceView !== 'quant') {
          this.switchWorkspace('quant');
        }

        // Toggle panel via Vela's native dock
        this.chartManager.togglePanel(panelId, true);
      });
    });

    // 3. Sidebar Dock Toggle Button [◫]
    document.querySelector('#btn-toggle-panels-dock')?.addEventListener('click', () => {
      const currentOpen = this.chartManager.openPanelId;
      if (currentOpen) {
        this.chartManager.togglePanel(currentOpen, false);
      } else {
        this.chartManager.togglePanel('watchlist', true);
      }
    });

    // 4. User avatar → Account menu (login/signup/plans/devices). Profile
    // editing remains reachable from the account menu ("Profile & Settings").
    // (Direct click binding lives in AuthManager.bindAvatar.)

    // Mobile layout button
    document.querySelector('#btn-mobile-layout')?.addEventListener('click', () => {
      this.layoutManager?.openLayoutStudio();
    });

    // 4b. Keyboard Shortcuts Reference & Language Switcher (FA / EN)
    document.querySelector('#btn-shortcuts-help')?.addEventListener('click', () => {
      this.shortcutsModal?.open();
    });

    // 4c. Topbar Compare, Export, Market Sources & Replay Triggers
    document.querySelector('#btn-topbar-market-source')?.addEventListener('click', () => {
      this.marketSourcesModal?.open();
    });

    document.querySelector('#btn-topbar-compare')?.addEventListener('click', () => {
      this.compareModal?.open();
    });

    document.querySelector('#btn-topbar-export')?.addEventListener('click', () => {
      this.dataExportModal?.open();
    });

    // Drawing undo / redo — delegate to Vela's drawing history
    document.querySelector('#btn-undo')?.addEventListener('click', () => {
      try { this.chartManager?.workspace?.active?.chart?.drawings?.undo(); } catch (e) {}
    });
    document.querySelector('#btn-redo')?.addEventListener('click', () => {
      try { this.chartManager?.workspace?.active?.chart?.drawings?.redo(); } catch (e) {}
    });

    // Magnet snap mode — cycles off → weak → strong → off (TradingView parity)
    let magnetIdx = 0;
    const magnetModes = ['off', 'weak', 'strong'];
    const magnetLabels = { off: 'خاموش', weak: 'ضعیف', strong: 'قوی' };
    document.querySelector('#btn-magnet')?.addEventListener('click', () => {
      magnetIdx = (magnetIdx + 1) % magnetModes.length;
      const mode = magnetModes[magnetIdx];
      try { this.chartManager?.workspace?.active?.chart?.drawings?.setSnapMode(mode); } catch (e) {}
      const btn = document.querySelector('#btn-magnet');
      if (btn) btn.classList.toggle('active', mode !== 'off');
      this.showToast?.(getLanguage() === 'fa' ? `مگنت: ${magnetLabels[mode]}` : `Magnet: ${mode}`, mode === 'off' ? 'info' : 'success');
    });

    // Fullscreen toggle
    document.querySelector('#btn-fullscreen')?.addEventListener('click', () => {
      const root = document.documentElement;
      if (!document.fullscreenElement) {
        root.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', () => {
      document.querySelector('#btn-fullscreen')?.classList.toggle('active', !!document.fullscreenElement);
      window.dispatchEvent(new Event('resize'));
    });

    document.querySelector('#btn-topbar-replay')?.addEventListener('click', () => {
      const replayBar = document.querySelector('#replay-bar');
      const isVisible = replayBar?.classList.contains('visible');
      const replayBtn = document.querySelector('#btn-topbar-replay');

      if (isVisible) {
        this.barReplay?.stopReplay();
        replayBtn?.classList.remove('active');
      } else {
        const total = this.activeBars?.length || 500;
        const __tfMs = ({'1s':1e3,'1':6e4,'3':18e4,'5':3e5,'15':9e5,'30':18e5,'45':27e5,'60':36e5,'120':72e5,'180':108e5,'240':144e5,'D':864e5,'W':6048e5,'M':2592e6})[String(this.currentTimeframe||'60')] || 36e5;
        this.barReplay?.startReplay(total, Math.floor(total * 0.7), __tfMs);
        replayBtn?.classList.add('active');
      }
    });

    document.querySelector('#btn-toggle-lang')?.addEventListener('click', () => {
      const next = getLanguage() === 'en' ? 'fa' : 'en';
      this.switchLanguage(next);
    });

    // 5. Desktop Bottom Panel Controls
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.getAttribute('data-view');
        const isCurrentActive = tab.classList.contains('active') && !this.isBottomPanelCollapsed;
        if (isCurrentActive) {
          this.toggleBottomPanel(true);
        } else {
          this.switchBottomView(view);
        }
      });
    });

    document.querySelector('#btn-maximize-bottom-panel')?.addEventListener('click', () => {
      const panel = document.querySelector('#bottom-panel');
      if (panel) {
        panel.classList.remove('collapsed');
        panel.classList.toggle('maximized');
        this.isBottomPanelCollapsed = false;
        window.dispatchEvent(new Event('resize'));
      }
    });

    document.querySelector('#btn-toggle-bottom-panel')?.addEventListener('click', () => {
      this.toggleBottomPanel();
    });

    // 5b. Quick Trade 1-Click Execution & Mobile Fullscreen
    const qtWidget = document.querySelector('#chart-quick-trade');
    if (window.innerWidth <= 768) {
      qtWidget?.classList.add('minimized');
    }

    this.minimizeQuickTrade = () => {
      qtWidget?.classList.add('minimized');
    };

    this.restoreQuickTrade = () => {
      if (window.innerWidth > 768) {
        qtWidget?.classList.remove('minimized');
      }
    };

    document.querySelector('#qt-toggle-btn')?.addEventListener('click', () => {
      qtWidget?.classList.toggle('minimized');
    });

    document.querySelector('#qt-collapsed-trigger')?.addEventListener('click', () => {
      qtWidget?.classList.remove('minimized');
    });

    document.querySelector('#qt-qty-dec')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.querySelector('#quick-trade-qty');
      if (input) {
        const val = Math.max(0.01, (parseFloat(input.value) || 0.1) - 0.05);
        input.value = val.toFixed(2);
      }
    });

    document.querySelector('#qt-qty-inc')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.querySelector('#quick-trade-qty');
      if (input) {
        const val = (parseFloat(input.value) || 0.1) + 0.05;
        input.value = val.toFixed(2);
      }
    });

    document.querySelector('#quick-trade-sell-btn')?.addEventListener('click', () => {
      const qty = parseFloat(document.querySelector('#quick-trade-qty')?.value) || 0.1;
      if (this.paperTrading?.placeOrder({ side: 'short', type: 'market', qty })) {
        this.showExecutionToast('SELL', qty, this.currentSymbol);
      }
    });

    document.querySelector('#quick-trade-buy-btn')?.addEventListener('click', () => {
      const qty = parseFloat(document.querySelector('#quick-trade-qty')?.value) || 0.1;
      if (this.paperTrading?.placeOrder({ side: 'long', type: 'market', qty })) {
        this.showExecutionToast('BUY', qty, this.currentSymbol);
      }
    });

    document.querySelector('#btn-mobile-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // 6. Universal Symbol Search Modal
    this.bindSymbolSearch();

    // 7. Desktop Right-Hand Vertical Tool Rail (TradingView Signature Feature)
    document.querySelectorAll('.rail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panelId = btn.getAttribute('data-panel');
        if (panelId === 'gold') {
          this.switchBottomView('gold');
          return;
        }
        if (panelId === 'tse') {
          this.switchBottomView('tse');
          return;
        }

        const isAlreadyActive = btn.classList.contains('active') && this.chartManager.openPanelId === panelId;

        document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));

        if (isAlreadyActive) {
          this.chartManager.togglePanel(panelId, false);
        } else {
          btn.classList.add('active');
          this.chartManager.togglePanel(panelId, true);
        }
      });
    });

    // Keep rail buttons synchronized with Vela open panels (1 s cadence; the
    // click handlers toggle immediately on interaction, this is only catch-up)
    setInterval(() => {
      if (document.hidden) return;
      const currentOpen = this.chartManager?.openPanelId;
      document.querySelectorAll('.rail-btn').forEach(btn => {
        const panelId = btn.getAttribute('data-panel');
        btn.classList.toggle('active', !!currentOpen && currentOpen === panelId);
      });
    }, 1000);

    // 8. Time Range Bar active tracking
    this.bindTimeRangeActive();

    // 8. Capture topbar and mobilebar clicks for Indicators and Symbol Search
    document.addEventListener('click', (e) => {
      const indBtn = e.target.closest('.vela-widget-indicators, .vela-mb-indicators, [aria-label="Indicators"], [data-tool="indicators"]');
      if (indBtn) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        this.indicatorsModal?.open();
        return;
      }
      const symBtn = e.target.closest('.vela-widget-symbol');
      if (symBtn) {
        e.stopPropagation();
        e.preventDefault();
        this.openSymbolSearch();
        return;
      }
      const layoutBtn = e.target.closest('#vela-topbar-layout, .vela-widget-topbar button[aria-label*="Layout"]');
      if (layoutBtn) {
        e.stopPropagation();
        e.preventDefault();
        this.layoutManager?.openLayoutStudio();
        return;
      }
      const cameraBtn = e.target.closest('.vela-widget-screenshot, [aria-label*="screenshot"], [aria-label*="Screenshot"]');
      if (cameraBtn) {
        e.stopPropagation();
        e.preventDefault();
        this.screenshotModal?.open();
        return;
      }
      const logTradeBtn = e.target.closest('#btn-journal-add');
      if (logTradeBtn) {
        e.stopPropagation();
        e.preventDefault();
        this.tradeJournalModal?.open();
        return;
      }
      const indSettingsBtn = e.target.closest('[class*="vela-sl-settings"], [aria-label*="Settings"], [class*="legend-settings"], [data-action="settings"], .vela-ind-ctl');
      if (indSettingsBtn && (indSettingsBtn.getAttribute('aria-label') === 'Settings' || indSettingsBtn.classList.contains('vela-sl-settings') || indSettingsBtn.classList.contains('legend-settings'))) {
        e.stopPropagation();
        e.preventDefault();
        let targetHandleId = null;
        try {
          const chart = this.chartManager?.workspace?.active?.chart;
          const rows = chart?.orchestrator?.renderer?.inputsUI?.rows;
          if (rows) {
            for (const [id, r] of rows.entries()) {
              if (r.el?.contains(indSettingsBtn)) {
                targetHandleId = id;
                break;
              }
            }
          }
        } catch (err) {}
        this.indicatorSettingsModal?.open(targetHandleId);
        return;
      }
    }, true);

    // 8b. Ensure More Drawer is translated upon open
    document.addEventListener('click', (e) => {
      if (e.target.closest('.vela-mb-more')) {
        setTimeout(() => {
          const drawer = document.querySelector('.vela-drawer');
          if (drawer) {
            drawer.dataset.localizedLang = '';
            localizeMoreDrawer();
          }
        }, 120);
      }
    });

    // 9. Global TradingView Keyboard Shortcuts Engine & Universal Modal Dismiss
    window.addEventListener('keydown', (e) => {
      // Back-office console shortcut (Ctrl/⌘+Shift+A) — admins only; everyone
      // else keeps the keystroke (no hidden admin surface for regular users).
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A') && this.auth?.isAdmin?.()) {
        e.preventDefault();
        this.auth.openPlanAdminStudio('dashboard');
        return;
      }
      if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal-overlay.open, .modal-overlay.active');
        if (openModals.length > 0) {
          e.preventDefault();
          if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            document.activeElement.blur();
          }
          openModals.forEach(m => m.classList.remove('open', 'active'));
          this.chartStylePicker?.close();
          this.contextMenu?.close();
          return;
        }

        const tag = document.activeElement?.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
          document.activeElement.blur();
          return;
        }

        // TradingView Parity: Escape restores maximized chart cell in multi-grid
        const ws = this.chartManager?.workspace;
        if (ws?.maximizedId) {
          e.preventDefault();
          ws.clearMaximized();
          this.layoutManager?.updateCellStrip();
          return;
        }

        this.chartManager?.clearDrawingTool();
        this.chartStylePicker?.close();
        this.contextMenu?.close();
        return;
      }

      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        this.shortcutsModal?.open();
      } else if (e.key === '/') {
        e.preventDefault();
        this.indicatorsModal?.open();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        try { this.chartManager?.workspace?.active?.chart?.drawings?.undo(); } catch (err) {}
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
        e.preventDefault();
        try { this.chartManager?.workspace?.active?.chart?.drawings?.redo(); } catch (err) {}
      } else if (e.key === 'F11') {
        e.preventDefault();
        const root = document.documentElement;
        if (!document.fullscreenElement) root.requestFullscreen?.().catch(() => {});
        else document.exitFullscreen?.().catch(() => {});
      } else if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        this.layoutManager?.toggleMaximizeActiveCell();
      } else if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        this.openSymbolSearch();
      } else if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        this.openAlertsModal();
      } else if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        this.chartManager?.armDrawingTool('trendline');
      } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        this.chartManager?.armDrawingTool('hline');
      } else if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        this.chartManager?.armDrawingTool('fibretracement');
      } else if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        this.chartManager?.armDrawingTool('box');
      } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        this.chartManager?.armDrawingTool('position');
      } else if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        this.chartManager?.armDrawingTool('vline');
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        this.compareModal?.open();
      } else if (e.altKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        this.dataExportModal?.open();
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        this.scaleControls?.container?.querySelector('#btn-scale-auto')?.click();
      } else if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        this.scaleControls?.container?.querySelector('#btn-scale-invert')?.click();
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.screenshotModal?.open();
      } else if (e.key === ' ' && !e.shiftKey) {
        e.preventDefault();
        this.stepNextWatchlistSymbol(1);
      } else if (e.key === ' ' && e.shiftKey) {
        e.preventDefault();
        this.stepNextWatchlistSymbol(-1);
      } else if (e.key === ',') {
        e.preventDefault();
        this.timeframeManager?.open();
      }
    }, true);

    // 9b. Global Backdrop Click Dismiss for all Modals
    document.addEventListener('click', (e) => {
      if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open', 'active');
      }
    });
  }

  openAlertsModal(price = null) {
    this.chartManager?.togglePanel('alerts', true);
    this.alertsManager?.openCreateAlert?.(price);
  }

  openIndicatorsModal() {
    this.indicatorsModal?.open();
  }

  openSettingsModal() {
    this.settingsModal?.open();
  }

  updateTopbarSourceBadge(symbol, meta = null) {
    if (symbol !== undefined) this._srcBadgeSym = symbol;
    if (!this._srcBadgeLangHook) {
      this._srcBadgeLangHook = true;
      window.addEventListener('tc:languagechange', () => this.updateTopbarSourceBadge());
    }
    const sym = migrateClientSymbol(String(this._srcBadgeSym || this.currentSymbol || '').trim());
    const fa = getLanguage() === 'fa' || document.body.classList.contains('persian-mode');
    const lbl = document.querySelector('#topbar-source-label');
    const rte = document.querySelector('#topbar-source-route') || document.querySelector('#topbar-source-badge');
    const pulseDot = document.querySelector('.source-pulse-dot');
    if (!lbl || !rte) return;

    rte.classList.add('topbar-data-status');
    rte.setAttribute('data-testid', 'market-status-badge');

    // Retrieve or fetch metadata
    let info = meta || this.symbolCatalog?.get(sym) || this.currentCatalogEntry;
    if (!info || (info.symbol !== sym && info.symbol !== this._srcBadgeSym)) {
      fetch(`/api/symbol-info?symbol=${encodeURIComponent(sym)}`)
        .then(r => r.ok ? r.json() : null)
        .then(m => {
          if (m) {
            this.symbolCatalog?.set(sym, m);
            if (this.currentSymbol === sym || this._srcBadgeSym === sym) {
              this.currentCatalogEntry = m;
              this.updateTopbarSourceBadge(sym, m);
            }
          }
        }).catch(() => {});
    }

    let exchange = info?.exchange || (sym.includes(':') ? sym.split(':')[0] : 'BINANCE');
    let source = info?.source || (sym.startsWith('BINANCE:') ? 'binance' : (sym.startsWith('IR:') ? 'tgju' : 'tradingview'));
    let dataStatus = info?.dataStatus || (sym.startsWith('IR:') ? 'eod' : 'live');
    let delaySec = info?.delaySec || 0;

    if (sym === 'SP:SPX' || sym === 'SPX') {
      dataStatus = 'delayed';
      delaySec = 600;
      exchange = 'SP';
      source = 'tradingview';
    } else if (sym.startsWith('IR:') || source === 'tgju') {
      dataStatus = 'eod';
      exchange = 'TGJU';
      source = 'tgju';
    } else if (sym.startsWith('BINANCE:') || (!sym.includes(':') && (sym.endsWith('USDT') || sym.endsWith('BTC')))) {
      dataStatus = 'live';
      delaySec = 0;
      exchange = 'BINANCE';
      source = 'binance';
    }

    lbl.innerText = exchange.toUpperCase();

    let statusText = '';
    let statusColor = '#00F2B0';
    let statusBg = 'rgba(0, 242, 176, 0.1)';

    if (dataStatus === 'delayed' || delaySec > 0) {
      const delayMin = Math.max(1, Math.round(delaySec / 60));
      statusText = fa ? `تأخیر ${toPersianDigits(delayMin)} دقیقه` : `Delayed ${delayMin} min`;
      statusColor = '#fbbf24';
      statusBg = 'rgba(251, 191, 36, 0.15)';
      rte.parentElement?.setAttribute('title', fa ? `داده‌های این نماد با ${toPersianDigits(delayMin)} دقیقه تأخیر ارائه می‌شود` : `Data delayed by ${delayMin} min`);
    } else if (dataStatus === 'eod' || source === 'tgju') {
      statusText = fa ? 'پایان روز' : 'EOD';
      statusColor = '#38bdf8';
      statusBg = 'rgba(56, 189, 248, 0.15)';
      rte.parentElement?.setAttribute('title', fa ? 'داده‌های روزانه و پایان روز از TGJU' : 'End of day data from TGJU');
    } else if (dataStatus === 'closed' || info?.marketClosed) {
      statusText = fa ? 'بازار بسته است' : 'Market closed';
      statusColor = '#94a3b8';
      statusBg = 'rgba(148, 163, 184, 0.15)';
      rte.parentElement?.setAttribute('title', fa ? 'بازار در حال حاضر بسته است' : 'Market is currently closed');
    } else {
      statusText = fa ? 'زنده' : 'LIVE';
      statusColor = '#00F2B0';
      statusBg = 'rgba(0, 242, 176, 0.15)';
      rte.parentElement?.setAttribute('title', fa ? 'جریان داده زنده و لحظه‌ای' : 'Real-time live market feed');
    }

    lbl.style.color = statusColor;
    rte.innerText = statusText;
    rte.style.color = statusColor;
    rte.style.background = statusBg;
    if (pulseDot) {
      pulseDot.style.background = statusColor;
      pulseDot.style.boxShadow = `0 0 6px ${statusColor}`;
    }
  }

  openSymbolSearch() {
    const modal = document.querySelector('#modal-symbol-search');
    if (modal) {
      modal.classList.add('open');
      const input = document.querySelector('#symbol-search-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      this.populateSymbolSearch('', 'all');
    }
  }

  stepNextWatchlistSymbol(direction = 1) {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSD', 'EURUSD', 'SPX', 'NVDA', 'TSLA', 'AAPL'];
    let idx = symbols.indexOf(this.currentSymbol);
    if (idx === -1) idx = 0;
    idx = (idx + direction + symbols.length) % symbols.length;
    this.switchSymbol(symbols[idx]);
  }

  bindSymbolSearch() {
    const modal = document.querySelector('#modal-symbol-search');
    const closeBtn = document.querySelector('#modal-close-symbol');
    const input = document.querySelector('#symbol-search-input');
    const clearBtn = document.querySelector('#symbol-clear-search');

    closeBtn?.addEventListener('click', () => modal?.classList.remove('open'));
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    this.symbolSelectedIndex = -1;

    input?.addEventListener('keydown', (e) => {
      const rows = modal?.querySelectorAll('.sym-search-row') || [];
      if (rows.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.symbolSelectedIndex = (this.symbolSelectedIndex + 1) % rows.length;
        this.highlightSymbolRow(rows, this.symbolSelectedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.symbolSelectedIndex = (this.symbolSelectedIndex - 1 + rows.length) % rows.length;
        this.highlightSymbolRow(rows, this.symbolSelectedIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.symbolSelectedIndex >= 0 && this.symbolSelectedIndex < rows.length) {
          rows[this.symbolSelectedIndex].click();
        } else if (rows.length > 0) {
          rows[0].click();
        }
      }
    });

    const exchangeSelect = document.querySelector('#symbol-exchange-filter');

    const updateSearch = () => {
      const activeCat = document.querySelector('.sym-cat-btn.active')?.getAttribute('data-cat') || 'all';
      const activeEx = exchangeSelect ? exchangeSelect.value : 'all';
      const q = input ? input.value.trim() : '';
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
      this.populateSymbolSearch(q, activeCat, activeEx);
    };

    input?.addEventListener('input', updateSearch);
    exchangeSelect?.addEventListener('change', updateSearch);
    clearBtn?.addEventListener('click', () => {
      if (input) {
        input.value = '';
        updateSearch();
        input.focus();
      }
    });

    document.querySelectorAll('.sym-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sym-cat-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-dim)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--accent-cyan-dim)';
        btn.style.color = 'var(--accent-cyan)';
        updateSearch();
      });
    });
  }

  async populateSymbolSearch(query = '', category = 'all', exchange = 'all') {
    const listCont = document.querySelector('#symbol-results-list');
    const countBadge = document.querySelector('#sym-count-badge');
    if (!listCont) return;

    const isFa = getLanguage() === 'fa';

    try {
      const res = await fetch(`/api/symbols?q=${encodeURIComponent(query)}&category=${category}&exchange=${exchange}`);
      if (res.ok) {
        const symbols = await res.json();
        if (countBadge) {
          countBadge.innerText = isFa ? `${toPersianDigits(symbols.length)} نماد معاملاتی` : `${symbols.length} Instruments`;
        }

        if (symbols.length === 0) {
          listCont.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 48px 0; font-size: 13px;">${isFa ? 'هیچ نمادی مطابق با جستجوی شما یافت نشد.' : 'No instruments match your search.'}</div>`;
          return;
        }

        const CAT_COLORS = {
          crypto: { bg: 'rgba(0, 242, 176, 0.12)', color: '#00F2B0' },
          metals: { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' },
          commodities: { bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171' },
          forex: { bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399' },
          indices: { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' },
          stocks: { bg: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' },
          iran_gold: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
          iran_tse: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }
        };

        const CAT_NAMES_FA = {
          crypto: 'رمزارزها',
          metals: 'فلزات',
          commodities: 'کالاها',
          forex: 'فارکس',
          indices: 'شاخص‌ها',
          stocks: 'سهام بین‌الملل',
          iran_gold: 'طلای تهران و ارز',
          iran_tse: 'بورس و فرابورس ایران'
        };

        const TYPE_NAMES_FA = {
          crypto: 'رمزارز',
          forex: 'ارز',
          stock: 'سهام',
          index: 'شاخص',
          commodity: 'کالا',
          metal: 'فلز',
          gold: 'طلا',
          coin: 'سکه',
          currency: 'ارز',
          fund: 'صندوق',
          etf: 'صندوق',
          bond: 'اوراق'
        };

        const SOURCE_NAMES_FA = {
          binance: 'بایننس',
          tradingview: 'تریدینگ‌ویو',
          tgju: 'TGJU',
          brsapi: 'بورس',
          tsetmc_proxy: 'TSETMC'
        };

        listCont.innerHTML = symbols.map(s => {
          const catStyle = CAT_COLORS[s.category] || { bg: 'rgba(255,255,255,0.1)', color: '#fff' };
          const catLabel = isFa ? (CAT_NAMES_FA[s.category] || s.category) : s.category.toUpperCase();
          const EXCH_FA = { Binance: 'بایننس', OANDA: 'اواندا', CBOE: 'CBOE', DJ: 'داوجونز', 'Dubai FX': 'ارز دبی', FX_IDC: 'FX_IDC', ICE: 'ICE', NASDAQ: 'نزدک', Nobitex: 'نوبیتکس', NYMEX: 'نایمکس', 'Tehran Bazaar': 'بازار تهران', 'Tehran FX': 'ارز تهران', TSETMC: 'بورس تهران', Global: 'جهانی' };
          const exchangeLabel = isFa ? (EXCH_FA[s.exchange] || s.exchange || 'جهانی') : (s.exchange || 'Global');
          const typeLabel = isFa ? (TYPE_NAMES_FA[s.type] || s.type || 'دارایی') : String(s.type || 'asset').toUpperCase();
          const sourceLabel = isFa ? (SOURCE_NAMES_FA[s.source] || s.source || 'زنده') : String(s.source || 'live').toUpperCase();
          const displayName = (isFa && s.nameFa) ? s.nameFa : s.name;
          // Iranian instruments: show the Persian ticker (نماد) as primary label
          const displayTicker = (isFa && s.tickerFa) ? s.tickerFa : s.symbol;
          const glyph = (isFa && s.tickerFa) ? s.tickerFa.replace(/\s+/g, '').slice(0, 3) : s.symbol.slice(0, 3);
          return `
            <div class="sym-search-row symbol-search-item" data-symbol="${s.symbol}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 6px; background: var(--bg-card); cursor: pointer; transition: all 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 6px; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; color: ${catStyle.color}; border: 1px solid var(--border-subtle);">
                  ${glyph}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 800; font-size: 14px; color: #fff;">${displayTicker}</span>
                    <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; background: ${catStyle.bg}; color: ${catStyle.color}; padding: 1px 6px; border-radius: 3px;">
                      ${catLabel}
                    </span>
                  </div>
                  <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${displayName}${(isFa && s.tickerFa) ? '' : (s.base && s.quote ? ` (${s.base}/${s.quote})` : '')}</div>
                </div>
              </div>
              <div style="text-align: end; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                <span class="sym-badge-exchange" style="font-size: 10px; font-weight: 700; color: var(--text-muted); background: var(--bg-surface); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                  ${exchangeLabel}
                </span>
                <span class="sym-badge-type" style="font-size: 10px; font-weight: 700; color: var(--text-dim); background: var(--bg-surface); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                  ${typeLabel}
                </span>
                <span class="sym-badge-source" style="font-size: 10px; font-weight: 700; color: var(--accent-cyan); background: rgba(0, 242, 176, 0.08); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0, 242, 176, 0.2);">
                  ${sourceLabel}
                </span>
              </div>
            </div>
          `;
        }).join('');

        listCont.querySelectorAll('.sym-search-row').forEach(row => {
          row.addEventListener('click', () => {
            const sym = row.getAttribute('data-symbol');
            this.switchSymbol(sym);
            document.querySelector('#modal-symbol-search')?.classList.remove('open');
          });
          row.addEventListener('mouseenter', () => {
            row.style.borderColor = 'var(--accent-cyan)';
            row.style.background = 'var(--bg-card-hover)';
          });
          row.addEventListener('mouseleave', () => {
            row.style.borderColor = 'var(--border-subtle)';
            row.style.background = 'var(--bg-card)';
          });
        });
        this.symbolSelectedIndex = 0;
        this.highlightSymbolRow(listCont.querySelectorAll('.sym-search-row'), 0);
      }
    } catch (e) {
      listCont.innerHTML = `<div style="color: var(--accent-red); padding: 16px;">Error searching symbols</div>`;
    }
  }

  highlightSymbolRow(rows, idx) {
    rows.forEach((row, i) => {
      if (i === idx) {
        row.style.borderColor = 'var(--accent-cyan)';
        row.style.background = 'var(--bg-card-hover)';
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        row.style.borderColor = 'var(--border-subtle)';
        row.style.background = 'var(--bg-card)';
      }
    });
  }

  updateQuickTradePrices(bar) {
    if (!bar) return;
    const bidEl = document.querySelector('#quick-sell-price');
    const askEl = document.querySelector('#quick-buy-price');
    const spreadEl = document.querySelector('#quick-trade-spread');
    const unitEl = document.querySelector('.qt-unit, #quick-trade-unit');

    if (unitEl) {
      unitEl.innerText = this.getBaseAsset(this.currentSymbol);
    }

    // One spread model shared with the paper engine → the price on the button
    // is exactly the price the market order fills at.
    const spread = this.paperTrading?.spreadFor ? this.paperTrading.spreadFor(bar.close) : (bar.close > 1000 ? 5 : (bar.close > 10 ? 0.05 : 0.0005));
    const bid = bar.close - spread / 2;
    const ask = bar.close + spread / 2;
    const digits = bar.close > 1000 ? 2 : 4;
    const formatNum = (n) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (bidEl) bidEl.innerText = formatNum(bid);
    if (askEl) askEl.innerText = formatNum(ask);
    if (spreadEl) spreadEl.innerText = '$' + spread.toFixed(digits);
  }

  showToast(msg, type = 'info') {
    // Single accessible toast host; text-only (no innerHTML → no injection via
    // user-named layouts/accounts), colour-coded by severity, and on-screen
    // long enough to read a full Persian sentence.
    let toast = document.querySelector('#tradingchart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tradingchart-toast';
      toast.className = 'tc-toast';
      document.body.appendChild(toast);
    }
    const isErr = type === 'error';
    toast.setAttribute('role', isErr ? 'alert' : 'status');
    toast.setAttribute('aria-live', isErr ? 'assertive' : 'polite');
    toast.dataset.type = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    toast.dir = getLanguage() === 'fa' ? 'rtl' : 'ltr';
    toast.textContent = String(msg ?? '');
    toast.style.display = 'flex';
    // force reflow so the enter transition replays for back-to-back toasts
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    clearTimeout(toast._timer);
    const ms = Math.min(9000, Math.max(3200, String(msg ?? '').length * 55));
    toast._timer = setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => { if (!toast.classList.contains('is-visible')) toast.style.display = 'none'; }, 300);
    }, ms);
  }

  showExecutionToast(side, qty, symbol) {
    const isFa = getLanguage() === 'fa';
    const isBuy = side === 'BUY';
    const sideFa = isBuy ? 'خرید' : (side === 'SELL' ? 'فروش' : side);
    this.showToast(isFa
      ? `✓ سفارش ${sideFa} ${toPersianDigits(String(qty))} ${symbol} به قیمت بازار اجرا شد`
      : `✓ Executed ${side} ${qty} ${symbol} @ market`, isBuy ? 'success' : 'warning');
    const el = document.querySelector('#tradingchart-toast');
    if (el) el.dataset.type = isBuy ? 'buy' : 'sell';
  }

  toggleBottomPanel(forceCollapse = null) {
    const panel = document.querySelector('#bottom-panel');
    if (!panel) return;
    if (forceCollapse !== null) {
      this.isBottomPanelCollapsed = forceCollapse;
    } else {
      this.isBottomPanelCollapsed = !this.isBottomPanelCollapsed;
    }
    panel.classList.remove('maximized');
    panel.classList.toggle('collapsed', this.isBottomPanelCollapsed);
    if (this.isBottomPanelCollapsed) {
      this.goldBubbleView?.unmount?.();
      this.tseTapeView?.unmount?.();
    } else {
      const activeTab = document.querySelector('.panel-tab.active')?.getAttribute('data-view');
      if (activeTab === 'gold') this.goldBubbleView?.mount?.();
      if (activeTab === 'tse') this.tseTapeView?.mount?.();
    }
    window.dispatchEvent(new Event('resize'));
  }

  switchBottomView(viewName) {
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-view') === viewName);
    });
    document.querySelectorAll('.panel-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });
    if (viewName !== 'gold') {
      this.goldBubbleView?.unmount?.();
    }
    if (viewName !== 'tse') {
      this.tseTapeView?.unmount?.();
    }
    if (viewName === 'pine') {
      this.pineStudio?.render?.();
    } else if (viewName === 'screener') {
      this.technicalScreener?.fetchData();
    } else if (viewName === 'calendar') {
      this.economicCalendar?.fetchEvents();
    } else if (viewName === 'propsim') {
      this.propFirmSim?.render?.();
    } else if (viewName === 'strategy') {
      this.strategyTester?.renderReport?.();
    } else if (viewName === 'journal') {
      this.tradeJournal?.render?.();
    } else if (viewName === 'gold') {
      this.goldBubbleView?.mount?.();
    } else if (viewName === 'tse') {
      this.tseTapeView?.mount?.();
      if (this.currentSymbol) {
        this.tseTapeView?.setSymbol?.(this.currentSymbol);
      }
    }
    // UX Mutex: Close identical right-rail panel if currently open to prevent dual-rendering clutter
    if (this.chartManager?.openPanelId === viewName) {
      this.chartManager.closeActivePanel();
    }
    this.isBottomPanelCollapsed = false;
    document.querySelector('#bottom-panel')?.classList.remove('collapsed');
    window.dispatchEvent(new Event('resize'));
  }

  toggleReplay() {
    const replayBar = document.querySelector('#replay-bar');
    const isVisible = replayBar?.classList.contains('visible');
    const replayBtn = document.querySelector('#btn-topbar-replay');

    if (isVisible) {
      this.barReplay?.stopReplay();
      replayBtn?.classList.remove('active');
    } else {
      const total = this.activeBars?.length || 500;
      const __tfMs = ({'1s':1e3,'1':6e4,'3':18e4,'5':3e5,'15':9e5,'30':18e5,'45':27e5,'60':36e5,'120':72e5,'180':108e5,'240':144e5,'D':864e5,'W':6048e5,'M':2592e6})[String(this.currentTimeframe||'60')] || 36e5;
      this.barReplay?.startReplay(total, Math.floor(total * 0.7), __tfMs);
      replayBtn?.classList.add('active');
    }
  }

  applyStoredTheme() {
    try {
      const t = localStorage.getItem('tradingchart_theme');
      const light = t === 'light';
      if (light) document.documentElement.dataset.theme = 'light';
      else delete document.documentElement.dataset.theme;
      // Re-theme every Vela chart canvas (per-cell setTheme), so candles/grid
      // flip to day mode too — workspace.setTheme alone is a no-op here.
      const ws = this.chartManager?.workspace;
      const cellThemes = light
        ? { background: '#ffffff', textColor: '#1f2937', gridColor: '#eef1f6', borderColor: '#d3dae6', upColor: '#059669', downColor: '#dc2626' }
        : { background: '#0b0e14', textColor: '#b2b5be', gridColor: '#161922', borderColor: '#1e222d', upColor: '#00F2B0', downColor: '#FF4D5B' };
      const apply = (cell) => { try { cell?.chart?.setTheme?.(cellThemes); } catch (e) {} };
      if (ws?.cellsById) ws.cellsById.forEach(apply);
      else if (ws?.active) apply(ws.active);
      this.layoutManager?.updateCellStrip?.();
    } catch (e) {}
  }

  // ── Account-system hooks (called by AuthManager) ────────────────────────
  // Cloud state just landed in localStorage: re-render every surface that
  // reads prefs at render time, and re-apply theme/lang synchronously.
  onCloudStateApplied() {
    this.applyStoredTheme();
    const settings = (() => { try { return JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}'); } catch (e) { return {}; } })();
    const cloudLang = settings.language;
    if (cloudLang && cloudLang !== getLanguage()) setLanguage(cloudLang);
    const prof = (() => { try { return JSON.parse(localStorage.getItem('tradingchart_user_profile') || '{}'); } catch (e) { return {}; } })();
    if (prof.defaultAsset && this.chartManager?.setSymbol) {
      try { this.chartManager.setSymbol(prof.defaultAsset.replace(/^.*:/, '').toUpperCase()); } catch (e) {}
    }
    // In-memory managers that cache localStorage state must reload it now.
    this.paperTrading?.reloadFromStorage?.();
    this.watchlist?.reloadFromStorage?.();
    this.alertsManager?.reloadFromStorage?.();
    if (this.userProfileModal) this.userProfileModal.profile = this.userProfileModal.loadProfile();
    // The account's avatar preset is the source of truth for the header badge —
    // keep the legacy profile avatar aligned so syncTopbarAvatar never clobbers it.
    const preset = this.auth?.user?.avatarPreset;
    if (preset && this.userProfileModal) {
      const found = AVATAR_PRESETS.find(a => a.id === preset);
      if (found) {
        this.userProfileModal.profile.avatar = found.icon;
        try {
          localStorage.setItem('tradingchart_user_profile', JSON.stringify(this.userProfileModal.profile));
        } catch (e) {}
      }
    }
    this.userProfileModal?.syncTopbarAvatar?.();
    this.renderWorkspaces?.();
  }

  onAuthChanged(kind) {
    // Re-render account surfaces + reflect plan limits everywhere.
    this.auth?.renderAccountBadge?.();
    this.renderWorkspaces?.();
    if (kind === 'logout') {
      const isFa = getLanguage() === 'fa';
      this.showToast?.(isFa ? 'از حساب خود خارج شدید.' : 'You have signed out.', 'info');
    }
  }

  onPlanChanged(planId) {
    // Plan entitlements changed → re-evaluate gates that already rendered
    // (e.g. re-render panels whose buttons are plan-limited).
    this.renderWorkspaces?.();
    // Screener auto-refresh cadence is plan-gated: restart both instances so a
    // plan switch takes effect without a page reload.
    this.technicalScreener?.startAutoRefresh?.();
    this.technicalScreenerSide?.startAutoRefresh?.();
  }


  switchLanguage(lang) {
    setLanguage(lang);
    // Persist the user's explicit choice so the RTL/Persian session survives
    // a full page reload (read back on DOMContentLoaded).
    try {
      const s = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
      s.language = lang;
      localStorage.setItem('tradingchart_user_settings', JSON.stringify(s));
    } catch (e) { /* storage unavailable — session-only */ }
    // Re-render every surface that builds HTML strings lazily so the new
    // language applies immediately and completely (desktop + mobile).
    relocalizePlatformBanner();
    this.chartStylePicker?.updateButtonUI?.();
    this.renderWorkspaces?.();
    this.marketNewsSide?.render?.();
    this.marketNews?.render?.();
    this.tradeJournal?.render?.();
    this.fullPageJournal?.render?.();
    this.depthOfMarket?.render?.();
    this.technicalScreener?.render?.();
    this.technicalScreenerSide?.render?.();
    this.economicCalendar?.render?.();
    this.economicCalendarSide?.render?.();
    this.paperTrading?.render?.();
    this.barReplay?.render?.();
    this.propFirmSim?.render?.();
    this.propFirmSimSide?.render?.();
    this.strategyTester?.renderReport?.();
    this.strategyTesterSide?.renderReport?.();
    this.scaleControls?.render?.();
    this.floatingDrawingToolbar?.render?.();
    this.layoutManager?.updateTopbarLabel?.();
    this.goldBubbleView?.render?.();
    if (this.goldBubbleView?.data) this.goldBubbleView.updateUI?.();
    this.tseTapeView?.render?.();
    if (this.tseTapeView?.data) this.tseTapeView.updateUI?.();
    if (!this.tseEnabled) {
      this.hideTseElements();
    }
    if (document.querySelector('#modal-market-sources')?.classList.contains('open')) {
      this.marketSourcesModal?.renderContent?.();
    }
    if (document.querySelector('#modal-layout-studio')?.classList.contains('open')) {
      this.layoutManager?.openLayoutStudio?.();
    }
    if (document.querySelector('#modal-user-profile')?.classList.contains('open')) {
      this.userProfileModal?.open?.();
    }
    // Account-system modals build their HTML at open() time — an open modal
    // keeps stale language after a switch, so re-render it in place.
    const accSettings = document.querySelector('#tc-account-settings-modal');
    if (accSettings) {
      const active = accSettings.querySelector('[data-atab][style*="0,242,176"], [data-atab][style*="var(--accent-cyan"]');
      this.auth?.openAccountSettingsModal?.(active?.dataset.atab || 'account');
    }
    const plansModal = document.querySelector('#tc-plans-modal');
    if (plansModal) this.auth?.openPlansModal?.();
    const devicesModal = document.querySelector('#tc-devices-modal');
    if (devicesModal) this.auth?.openDevicesModal?.();
    const authModal = document.querySelector('#tc-auth-modal');
    if (authModal) {
      const activeMode = authModal.querySelector('.tc-auth-tab.active')?.dataset.tab || 'login';
      this.auth?.openAuthModal?.(activeMode);
    }
    this.layoutManager?.updateCellStrip?.();
    // Modals & side panels that live in separate mount containers
    this.indicatorsModal?.render?.();
    this.settingsModal?.render?.();
    this.dataExportModal?.render?.();
    this.shortcutsModal?.render?.();
    this.compareModal?.render?.();
    this.timeframeManager?.render?.();
    this.pineStudio?.render?.();
    this.pineStudioSide?.render?.();
    this.watchlist?.render?.();
    this.alertsManager?.render?.();
    this.marketTrackers?.render?.();
    this.templateManager?.render?.();
    this.goldBubbleView?.render?.();
    this.goldBubbleView?.updateUI?.();
    this.tseTapeView?.render?.();
    this.tseTapeView?.updateUI?.();
    this.tradeJournalModal?.render?.();
    this.screenshotModal?.render?.();
    this.chartAlertsOverlay?.updateAlerts(
      this.alertsManager?.alerts,
      this.currentSymbol,
      this.activeBars?.[this.activeBars.length - 1]?.close
    );
    console.log('[TradingChart] Language switched to:', lang);
  }

  bindTimeRangeActive() {
    // The engine owns the range-chip state (data-active): it highlights a chip
    // only while that range is actually applied and clears it on manual
    // pan/zoom or timeframe change. A hard-coded default highlight would claim
    // "1M" while the chart shows ~9 days — a truthfulness defect — so the app
    // only strips any legacy class and lets CSS key off [data-active].
    const checkInterval = setInterval(() => {
      const rangeBtns = document.querySelectorAll('.vela-bb-range');
      if (rangeBtns.length > 0) {
        clearInterval(checkInterval);
        rangeBtns.forEach(b => b.classList.remove('is-active'));
      }
    }, 400);
  }

  startLatencyPing() {
    setInterval(async () => {
      const badge = document.querySelector('#latency-val');
      const dot = document.querySelector('.pulse-dot');
      if (!badge) return;
      const start = performance.now();
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
          // Report the REAL round-trip (smoothed), never a cosmetic clamp: a
          // trading UI that shows "42ms" while the link is at 900ms misleads
          // the user about order-entry risk.
          const rawMs = Math.round(performance.now() - start);
          this._latEma = this._latEma == null ? rawMs : Math.round(this._latEma * 0.6 + rawMs * 0.4);
          const ms = this._latEma;
          const isFaLat = getLanguage() === 'fa';
          badge.innerText = `${ms}ms`;
          badge.parentElement?.setAttribute('title', isFaLat ? `تأخیر ارتباط با سرور: ${toPersianDigits(String(ms))} میلی‌ثانیه` : `Server round-trip: ${ms} ms`);
          const isHighLatency = ms > 500;
          document.querySelector('#chart-quick-trade')?.classList.toggle('latency-warning', isHighLatency);
          badge.parentElement?.classList.toggle('is-high-latency', isHighLatency);
          if (dot) {
            dot.style.background = '#00F2B0';
            dot.style.boxShadow = '0 0 8px rgba(0, 242, 176, 0.6)';
          }
        }
      } catch (e) {
        badge.innerText = getLanguage() === 'fa' ? 'قطع' : 'OFFLINE';
        badge.parentElement?.classList.add('is-high-latency');
        if (dot) {
          dot.style.background = '#ef4444';
          dot.style.boxShadow = 'none';
        }
      }
    }, 3000);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new TradingChartApp();
  // Restore the user's persisted language preference so an RTL/Persian session
  // survives a full page reload (settings modal stores `tradingchart_user_settings`).
  try {
    const saved = JSON.parse(localStorage.getItem('tradingchart_user_settings') || '{}');
    if (saved && saved.language && saved.language !== getLanguage()) {
      window.app.switchLanguage(saved.language);
    }
  } catch (e) { /* ignore malformed storage */ }
});
