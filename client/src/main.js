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
import { UserProfileModal } from './userProfileModal.js';
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
import { ChartAlertsOverlay } from './chartAlertsOverlay.js';
import { setLanguage, getLanguage, t, localizeMoreDrawer } from './i18n.js';

class TradingChartApp {
  constructor() {
    this.currentSymbol = 'BTCUSDT';
    this.currentTimeframe = '60';
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
    this.isBottomPanelCollapsed = true;

    this.init();
  }

  async init() {
    console.log('[TradingChart] Initializing LuxAlgo Quant Workspace...');
    window.__TRADING_APP__ = this;

    // 1. Initialize Chart Canvas Workspace (Vela WebGL2 + PineTS)
    this.chartManager = new ChartManager({
      app: this,
      mountId: '#vela-workspace-mount',
      onSymbolChange: (sym) => this.handleSymbolChange(sym)
    });

    // 2. Initialize Modals
    this.indicatorsModal = new IndicatorsModal({
      modalEl: document.querySelector('#modal-indicators'),
      onAddIndicator: (item) => {
        if (item.script) {
          const res = this.chartManager.addPineIndicator(item.script, item.name);
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
            const currentClose = slice[slice.length - 1].close;
            this.barReplay?.setPrice(currentClose);
            this.paperTrading?.setMarket(this.currentSymbol, currentClose);
          }
        }
      },
      onExit: () => {
        const chart = this.chartManager.workspace?.active?.chart;
        if (chart?.orchestrator && this.activeBars && this.activeBars.length > 0) {
          chart.orchestrator.setBarSeries(this.activeBars, { preserveView: true });
          const currentClose = this.activeBars[this.activeBars.length - 1].close;
          this.paperTrading?.setMarket(this.currentSymbol, currentClose);
        }
      }
    });

    // 4. Initialize Floating Drawing Toolbar & Canvas Alert Overlay (TradingView Parity)
    this.floatingToolbar = new FloatingDrawingToolbar(this);
    this.chartAlertsOverlay = new ChartAlertsOverlay(this);

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

    // 6. Wire Top App Header & Modals
    this.bindEvents();

    // 7. Start live latency ping
    this.startLatencyPing();

    // 8. Initial Data Load
    this.loadActiveCandles();
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
        container: journalEl
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
  }

  initFullPageJournal() {
    const journalView = document.querySelector('#journal-workspace-view');
    if (journalView) {
      this.fullPageJournal = new TradeJournal({
        container: journalView
      });
    }
  }

  // ── Vela Native Side Panel Mount Handlers ──────────────────────────

  mountWatchlist(body) {
    this.watchlist = new WatchlistManager({
      container: body,
      onSelectSymbol: (sym) => this.switchSymbol(sym)
    });
  }

  mountPaperTrading(body) {
    this.paperTrading = new PaperTrading({
      container: body
    });
    if (this.activeBars.length > 0) {
      this.paperTrading.setMarket(this.currentSymbol, this.activeBars[this.activeBars.length - 1].close);
    }
  }

  mountAlerts(body) {
    this.alertsManager = new AlertsManager({
      container: body
    });
  }

  mountPineEditor(body) {
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
    const st = new StrategyTester({
      container: body,
      onExportToPropSim: (profile) => {
        this.chartManager.togglePanel('propsim', true);
        this.propFirmSim?.setProfileParams(profile);
      }
    });
    st.setCandles(this.activeBars);
  }

  mountPropFirmSim(body) {
    new PropFirmSimulator({
      container: body
    });
  }

  mountTradeJournal(body) {
    new TradeJournal({
      container: body
    });
  }

  mountMarketTrackers(body) {
    new MarketTrackersView({
      container: body
    });
  }

  mountIndicatorTemplates(body) {
    new TemplateManager(this, body);
  }

  mountEconomicCalendar(body) {
    new EconomicCalendarView({
      container: body
    });
  }

  mountTechnicalScreener(body) {
    new TechnicalScreenerView({
      container: body,
      app: this
    });
  }

  mountDepthOfMarket(body) {
    this.depthOfMarket = new DepthOfMarketView({
      container: body,
      app: this
    });
    this.depthOfMarket.setSymbol(this.currentSymbol);
  }

  mountWorkspaces(body) {
    body.innerHTML = `
      <div style="padding: 12px; display: flex; flex-direction: column; gap: 14px;">
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 8px;">Multi-Chart Layout Grid</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
            <button class="btn-ws-layout btn-secondary" data-layout="1" style="justify-content: center; font-size: 12px; padding: 8px;">Single (1×1)</button>
            <button class="btn-ws-layout btn-secondary" data-layout="2h" style="justify-content: center; font-size: 12px; padding: 8px;">Dual H (2×1)</button>
            <button class="btn-ws-layout btn-secondary" data-layout="2v" style="justify-content: center; font-size: 12px; padding: 8px;">Dual V (1×2)</button>
            <button class="btn-ws-layout btn-secondary" data-layout="4" style="justify-content: center; font-size: 12px; padding: 8px;">Quad (2×2)</button>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
          <div style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 8px;">Chart Synchronization</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); cursor: pointer;">
              <span>Sync Symbol</span>
              <input type="checkbox" id="sync-symbol-check" style="cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); cursor: pointer;">
              <span>Sync Timeframe</span>
              <input type="checkbox" id="sync-tf-check" style="cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); cursor: pointer;">
              <span>Sync Crosshair</span>
              <input type="checkbox" id="sync-cross-check" checked style="cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); cursor: pointer;">
              <span>Sync Drawings</span>
              <input type="checkbox" id="sync-drawings-check" style="cursor: pointer;" />
            </label>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
          <div style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 8px;">Saved Workspaces</div>
          <div style="background: var(--bg-card); padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
            <span>Default Master Layout</span>
            <span style="font-size: 10px; color: var(--accent-cyan); font-weight: 700;">ACTIVE</span>
          </div>
        </div>
      </div>
    `;

    body.querySelectorAll('.btn-ws-layout').forEach(btn => {
      btn.addEventListener('click', () => {
        const lay = btn.getAttribute('data-layout');
        this.chartManager.setLayout(lay);
      });
    });

    body.querySelector('#sync-symbol-check')?.addEventListener('change', (e) => this.chartManager.workspace?.sync?.set('symbol', e.target.checked));
    body.querySelector('#sync-tf-check')?.addEventListener('change', (e) => this.chartManager.workspace?.sync?.set('timeframe', e.target.checked));
    body.querySelector('#sync-cross-check')?.addEventListener('change', (e) => this.chartManager.workspace?.sync?.set('crosshair', e.target.checked));
    body.querySelector('#sync-drawings-check')?.addEventListener('change', (e) => this.chartManager.workspace?.sync?.set('drawings', e.target.checked));
  }

  // ── Data Loading & Symbol Navigation ───────────────────────────────

  async loadActiveCandles() {
    try {
      const res = await fetch(`/api/candles?symbol=${this.currentSymbol}&timeframe=${this.currentTimeframe}&limit=500`);
      if (res.ok) {
        const data = await res.json();
        this.activeBars = data.candles || [];
        this.strategyTester?.setCandles(this.activeBars);

        if (this.activeBars.length > 0) {
          const lastBar = this.activeBars[this.activeBars.length - 1];
          this.paperTrading?.setMarket(this.currentSymbol, lastBar.close);
          this.alertsManager?.setMarket(this.currentSymbol, lastBar.close);
          this.updateQuickTradePrices(lastBar);
          this.chartAlertsOverlay?.updateAlerts(this.alertsManager?.alerts, this.currentSymbol, lastBar.close);
        }
      }
    } catch (e) {
      console.warn('[TradingChart] Error loading initial candles:', e);
    }
  }

  switchSymbol(sym) {
    const clean = sym.replace(/^.*:/, '').toUpperCase();
    this.currentSymbol = clean;
    this.chartManager.setSymbol(clean);
    this.depthOfMarket?.setSymbol(clean);
    this.loadActiveCandles();
  }

  handleSymbolChange(sym) {
    const clean = sym.replace(/^.*:/, '').toUpperCase();
    this.currentSymbol = clean;
    this.depthOfMarket?.setSymbol(clean);
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

        if (panelId === 'journal' && this.activeWorkspaceView !== 'journal') {
          this.switchWorkspace('journal');
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

    // 4. User Profile Modal Trigger on Avatar
    document.querySelector('.user-avatar-badge')?.addEventListener('click', () => {
      this.userProfileModal?.open();
    });

    // 4b. Keyboard Shortcuts Reference & Language Switcher (FA / EN)
    document.querySelector('#btn-shortcuts-help')?.addEventListener('click', () => {
      this.shortcutsModal?.open();
    });

    // 4c. Topbar Compare, Export & Replay Triggers
    document.querySelector('#btn-topbar-compare')?.addEventListener('click', () => {
      this.compareModal?.open();
    });

    document.querySelector('#btn-topbar-export')?.addEventListener('click', () => {
      this.dataExportModal?.open();
    });

    document.querySelector('#btn-topbar-replay')?.addEventListener('click', () => {
      this.barReplay?.startReplay(this.activeBars.length || 500);
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
      this.paperTrading?.openPosition('short', qty, 10);
      this.showExecutionToast('SELL', qty, this.currentSymbol);
    });

    document.querySelector('#quick-trade-buy-btn')?.addEventListener('click', () => {
      const qty = parseFloat(document.querySelector('#quick-trade-qty')?.value) || 0.1;
      this.paperTrading?.openPosition('long', qty, 10);
      this.showExecutionToast('BUY', qty, this.currentSymbol);
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

    // Keep rail buttons synchronized with Vela open panels
    setInterval(() => {
      const currentOpen = this.chartManager?.openPanelId;
      document.querySelectorAll('.rail-btn').forEach(btn => {
        const panelId = btn.getAttribute('data-panel');
        btn.classList.toggle('active', !!currentOpen && currentOpen === panelId);
      });
    }, 400);

    // 8. Time Range Bar active tracking
    this.bindTimeRangeActive();

    // 8. Capture topbar clicks for Indicators and Symbol Search
    document.addEventListener('click', (e) => {
      const indBtn = e.target.closest('.vela-widget-indicators');
      if (indBtn) {
        e.stopPropagation();
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
      const layoutBtn = e.target.closest('#vela-topbar-layout, .vela-widget-topbar button[aria-label*="Layout"], #btn-layout-manager');
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
      const indSettingsBtn = e.target.closest('[class*="vela-sl-settings"], [aria-label*="Settings"], [class*="legend-settings"], [data-action="settings"]');
      if (indSettingsBtn) {
        e.stopPropagation();
        e.preventDefault();
        this.indicatorSettingsModal?.open();
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

    // 9. Global TradingView Keyboard Shortcuts Engine
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        this.shortcutsModal?.open();
      } else if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        this.openSymbolSearch();
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
        this.chartManager?.takeScreenshot();
      } else if (e.key === ' ' && !e.shiftKey) {
        e.preventDefault();
        this.stepNextWatchlistSymbol(1);
      } else if (e.key === ' ' && e.shiftKey) {
        e.preventDefault();
        this.stepNextWatchlistSymbol(-1);
      } else if (e.key === 'Escape') {
        this.chartManager?.clearDrawingTool();
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });
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

    const updateSearch = () => {
      const activeCat = document.querySelector('.sym-cat-btn.active')?.getAttribute('data-cat') || 'all';
      const q = input ? input.value.trim() : '';
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
      this.populateSymbolSearch(q, activeCat);
    };

    input?.addEventListener('input', updateSearch);
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

  async populateSymbolSearch(query = '', category = 'all') {
    const listCont = document.querySelector('#symbol-results-list');
    const countBadge = document.querySelector('#sym-count-badge');
    if (!listCont) return;

    try {
      const res = await fetch(`/api/symbols?q=${encodeURIComponent(query)}&category=${category}`);
      if (res.ok) {
        const symbols = await res.json();
        if (countBadge) countBadge.innerText = `${symbols.length} Instruments`;

        if (symbols.length === 0) {
          listCont.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 48px 0; font-size: 13px;">No instruments match your search.</div>`;
          return;
        }

        const CAT_COLORS = {
          crypto: { bg: 'rgba(0, 242, 176, 0.12)', color: '#00F2B0' },
          metals: { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' },
          commodities: { bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171' },
          forex: { bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399' },
          indices: { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' },
          stocks: { bg: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }
        };

        listCont.innerHTML = symbols.map(s => {
          const catStyle = CAT_COLORS[s.category] || { bg: 'rgba(255,255,255,0.1)', color: '#fff' };
          return `
            <div class="sym-search-row" data-symbol="${s.symbol}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 6px; background: var(--bg-card); cursor: pointer; transition: all 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 6px; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; color: ${catStyle.color}; border: 1px solid var(--border-subtle);">
                  ${s.symbol.slice(0, 3)}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 800; font-size: 14px; color: #fff;">${s.symbol}</span>
                    <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; background: ${catStyle.bg}; color: ${catStyle.color}; padding: 1px 6px; border-radius: 3px;">
                      ${s.category}
                    </span>
                  </div>
                  <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${s.name} (${s.base}/${s.quote})</div>
                </div>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 10px; font-weight: 700; color: var(--text-muted); background: var(--bg-surface); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                  ${s.exchange || 'Global'}
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
    const spread = bar.close > 1000 ? 5 : (bar.close > 10 ? 0.05 : 0.0005);
    const bid = bar.close - spread / 2;
    const ask = bar.close + spread / 2;
    const digits = bar.close > 1000 ? 2 : 4;
    const formatNum = (n) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (bidEl) bidEl.innerText = formatNum(bid);
    if (askEl) askEl.innerText = formatNum(ask);
  }

  showExecutionToast(side, qty, symbol) {
    let toast = document.querySelector('#tradingchart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tradingchart-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: var(--bg-card);
        border: 1px solid var(--accent-cyan);
        color: #fff;
        padding: 12px 18px;
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        font-size: 13px;
        font-weight: 700;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    const isBuy = side === 'BUY';
    toast.innerHTML = `<span style="color: ${isBuy ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 800;">✓ EXECUTED</span> ${side} ${qty} ${symbol} @ MARKET`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 3000);
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
    window.dispatchEvent(new Event('resize'));
  }

  switchBottomView(viewName) {
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-view') === viewName);
    });
    document.querySelectorAll('.panel-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });
    if (viewName === 'screener') {
      this.technicalScreener?.fetchData();
    } else if (viewName === 'calendar') {
      this.economicCalendar?.fetchEvents();
    }
    this.isBottomPanelCollapsed = false;
    document.querySelector('#bottom-panel')?.classList.remove('collapsed');
    window.dispatchEvent(new Event('resize'));
  }

  switchLanguage(lang) {
    setLanguage(lang);
    console.log('[TradingChart] Language switched to:', lang);
  }

  bindTimeRangeActive() {
    const checkInterval = setInterval(() => {
      const rangeBtns = document.querySelectorAll('.vela-bb-range');
      if (rangeBtns.length > 0) {
        clearInterval(checkInterval);
        rangeBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            rangeBtns.forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
          });
        });
        const defaultBtn = Array.from(rangeBtns).find(b => b.innerText.trim() === '1M') || rangeBtns[2];
        if (defaultBtn && !document.querySelector('.vela-bb-range.is-active')) {
          defaultBtn.classList.add('is-active');
        }
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
        await fetch('/api/health');
        const ms = Math.max(1, Math.round(performance.now() - start));
        badge.innerText = `${ms}ms`;
        if (dot) {
          if (ms < 120) {
            dot.style.background = '#00F2B0';
            dot.style.boxShadow = '0 0 8px rgba(0, 242, 176, 0.6)';
          } else if (ms < 300) {
            dot.style.background = '#f59e0b';
            dot.style.boxShadow = '0 0 8px rgba(245, 158, 11, 0.6)';
          } else {
            dot.style.background = '#ef4444';
            dot.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.6)';
          }
        }
      } catch (e) {
        badge.innerText = 'OFFLINE';
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
});
