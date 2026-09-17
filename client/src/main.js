// client/src/main.js
// Master Application Coordinator for TradingChart

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
import { setLanguage, getLanguage, t } from './i18n.js';

class TradingChartApp {
  constructor() {
    this.currentSymbol = 'BTCUSDT';
    this.currentTimeframe = '60';
    this.activeBars = [];
    this.chartManager = null;
    this.watchlist = null;
    this.paperTrading = null;
    this.alertsManager = null;
    this.pineStudio = null;
    this.strategyTester = null;
    this.propFirmSim = null;
    this.tradeJournal = null;
    this.marketTrackers = null;
    this.indicatorsModal = null;
    this.settingsModal = null;
    this.barReplay = null;
    this.isBottomPanelCollapsed = false;
    this.isSidebarCollapsed = false;

    this.init();
  }

  async init() {
    console.log('[TradingChart] Initializing application...');

    // 1. Initialize Chart Canvas Workspace
    this.chartManager = new ChartManager({
      mountId: '#vela-workspace-mount',
      onSymbolChange: (sym) => this.handleSymbolChange(sym)
    });

    // 2. Initialize Watchlist (Right Sidebar Tab 1)
    this.watchlist = new WatchlistManager({
      container: document.querySelector('#sidebar-tab-watchlist'),
      onSelectSymbol: (sym) => this.switchSymbol(sym)
    });

    // 3. Initialize Paper Trading (Right Sidebar Tab 2)
    this.paperTrading = new PaperTrading({
      container: document.querySelector('#sidebar-tab-paper')
    });

    // 4. Initialize Alerts Manager (Right Sidebar Tab 3)
    this.alertsManager = new AlertsManager({
      container: document.querySelector('#sidebar-tab-alerts')
    });

    // 5. Initialize Pine Studio (Bottom Panel View 1)
    this.pineStudio = new PineStudio({
      container: document.querySelector('#view-pine'),
      onAddToChart: (code) => {
        const res = this.chartManager.addPineIndicator(code);
        if (res.success) {
          console.log('[TradingChart] Pine Indicator successfully mounted onto chart');
        }
      },
      onBacktest: (code) => {
        this.switchBottomView('strategy');
        this.strategyTester.runSimulation(code, this.activeBars);
      }
    });

    // 6. Initialize Strategy Tester (Bottom Panel View 2)
    this.strategyTester = new StrategyTester({
      container: document.querySelector('#view-strategy'),
      onExportToPropSim: (profile) => {
        this.switchBottomView('propsim');
        this.propFirmSim.setProfileParams(profile);
      }
    });

    // 7. Initialize Prop-Firm Simulator (Bottom Panel View 3)
    this.propFirmSim = new PropFirmSimulator({
      container: document.querySelector('#view-propsim')
    });

    // 8. Initialize Trade Journal (Bottom Panel View 4)
    this.tradeJournal = new TradeJournal({
      container: document.querySelector('#view-journal')
    });

    // 9. Initialize Market Trackers (Bottom Panel View 5)
    this.marketTrackers = new MarketTrackersView({
      container: document.querySelector('#view-trackers')
    });

    // 10. Initialize Indicators Library Modal
    this.indicatorsModal = new IndicatorsModal({
      modalEl: document.querySelector('#modal-indicators'),
      onAddIndicator: (item) => {
        if (item.script) {
          this.chartManager.addPineIndicator(item.script);
        } else {
          console.log('[TradingChart] Adding native indicator:', item.id);
        }
      }
    });

    // 11. Initialize Settings Modal
    this.settingsModal = new SettingsModal({
      modalEl: document.querySelector('#modal-settings'),
      onApplySettings: (cfg) => {
        if (cfg.language && cfg.language !== getLanguage()) {
          this.switchLanguage(cfg.language);
        }
      }
    });

    // 12. Initialize Bar Replay
    this.barReplay = new BarReplay({
      container: document.querySelector('#replay-bar'),
      onBarStep: (idx) => {
        console.log('[BarReplay] Stepping to bar index:', idx);
      },
      onExit: () => {
        console.log('[BarReplay] Exited replay mode');
      }
    });

    // 13. Wire DOM event listeners
    this.bindEvents();

    // 14. Responsive Initial State
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.isSidebarCollapsed = true;
      this.isBottomPanelCollapsed = true;
      document.querySelector('#right-sidebar')?.classList.add('collapsed');
      document.querySelector('#bottom-panel')?.classList.add('collapsed');
    }

    // 15. Initial Data Load
    this.loadActiveCandles();
  }

  async loadActiveCandles() {
    try {
      const res = await fetch(`/api/candles?symbol=${this.currentSymbol}&timeframe=${this.currentTimeframe}&limit=500`);
      if (res.ok) {
        const data = await res.json();
        this.activeBars = data.candles || [];
        this.strategyTester.setCandles(this.activeBars);

        if (this.activeBars.length > 0) {
          const lastBar = this.activeBars[this.activeBars.length - 1];
          this.paperTrading.setMarket(this.currentSymbol, lastBar.close);
          this.updateHeaderPrice(lastBar.close);
        }
      }
    } catch (e) {
      console.warn('[TradingChart] Error loading initial candles:', e);
    }
  }

  switchSymbol(sym) {
    const clean = sym.replace(/^.*:/, '').toUpperCase();
    this.currentSymbol = clean;
    document.querySelector('#header-symbol-label').innerText = clean;
    this.chartManager.setSymbol(clean);
    this.loadActiveCandles();
  }

  handleSymbolChange(sym) {
    this.currentSymbol = sym;
    document.querySelector('#header-symbol-label').innerText = sym;
    this.loadActiveCandles();
  }

  updateHeaderPrice(price) {
    const badge = document.querySelector('#header-price-badge');
    if (badge) {
      badge.innerText = `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  bindEvents() {
    // Symbol Search Modal
    const btnSymbol = document.querySelector('#btn-symbol-search');
    const modalSymbol = document.querySelector('#modal-symbol-search');
    const closeSymbol = document.querySelector('#modal-close-symbol');
    const inputSymbol = document.querySelector('#symbol-search-input');
    const filterCat = document.querySelector('#symbol-cat-filter');

    if (btnSymbol && modalSymbol) {
      btnSymbol.addEventListener('click', () => {
        modalSymbol.classList.add('open');
        inputSymbol.focus();
        this.populateSymbolSearch('', 'all');
      });

      closeSymbol?.addEventListener('click', () => modalSymbol.classList.remove('open'));
      modalSymbol.addEventListener('click', (e) => {
        if (e.target === modalSymbol) modalSymbol.classList.remove('open');
      });

      const updateSymbolSearch = () => {
        this.populateSymbolSearch(inputSymbol.value.trim(), filterCat.value);
      };
      inputSymbol?.addEventListener('input', updateSymbolSearch);
      filterCat?.addEventListener('change', updateSymbolSearch);
    }

    // Timeframe Chips
    document.querySelectorAll('#header-tf-group .tf-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#header-tf-group .tf-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const tf = chip.getAttribute('data-tf');
        this.currentTimeframe = tf;
        this.chartManager.setTimeframe(tf);
        this.loadActiveCandles();
      });
    });

    // Style Select
    document.querySelector('#header-style-select')?.addEventListener('change', (e) => {
      this.chartManager.setPriceStyle(e.target.value);
    });

    // Layout Select
    document.querySelector('#header-layout-select')?.addEventListener('change', (e) => {
      this.chartManager.setLayout(e.target.value);
    });

    // Indicators Modal
    document.querySelector('#btn-open-indicators')?.addEventListener('click', () => {
      this.indicatorsModal.open();
    });

    // Settings Modal
    document.querySelector('#btn-open-settings')?.addEventListener('click', () => {
      this.settingsModal.open();
    });

    // Fullscreen
    document.querySelector('#btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Screenshot
    document.querySelector('#btn-screenshot')?.addEventListener('click', () => {
      this.chartManager.takeScreenshot();
    });

    // Undo / Redo
    document.querySelector('#btn-undo')?.addEventListener('click', () => this.chartManager.undo());
    document.querySelector('#btn-redo')?.addEventListener('click', () => this.chartManager.redo());

    // Language Toggle
    document.querySelector('#btn-toggle-lang')?.addEventListener('click', () => {
      const next = getLanguage() === 'en' ? 'fa' : 'en';
      this.switchLanguage(next);
    });

    // Replay Mode Toggle
    document.querySelector('#btn-toggle-replay')?.addEventListener('click', () => {
      this.barReplay.startReplay(this.activeBars.length);
    });

    // Sidebar Tabs
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        const tabWl = document.querySelector('#sidebar-tab-watchlist');
        const tabPaper = document.querySelector('#sidebar-tab-paper');
        const tabAlerts = document.querySelector('#sidebar-tab-alerts');
        if (tabWl) tabWl.style.display = tab === 'watchlist' ? 'flex' : 'none';
        if (tabPaper) tabPaper.style.display = tab === 'paper' ? 'flex' : 'none';
        if (tabAlerts) tabAlerts.style.display = tab === 'alerts' ? 'flex' : 'none';
      });
    });

    // Toggle Sidebar
    document.querySelector('#btn-toggle-sidebar')?.addEventListener('click', (e) => {
      const sb = document.querySelector('#right-sidebar');
      if (sb) {
        if (window.innerWidth <= 768) {
          sb.classList.toggle('mobile-open');
        } else {
          this.isSidebarCollapsed = !this.isSidebarCollapsed;
          sb.classList.toggle('collapsed', this.isSidebarCollapsed);
          e.currentTarget.classList.toggle('active', !this.isSidebarCollapsed);
        }
      }
    });

    // Bottom Panel Tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.getAttribute('data-view');
        this.switchBottomView(view);
      });
    });

    // Toggle Bottom Panel
    document.querySelector('#btn-toggle-bottom-panel')?.addEventListener('click', () => {
      const panel = document.querySelector('#bottom-panel');
      if (panel) {
        if (window.innerWidth <= 768) {
          panel.classList.toggle('mobile-expanded');
        } else {
          this.isBottomPanelCollapsed = !this.isBottomPanelCollapsed;
          panel.classList.toggle('collapsed', this.isBottomPanelCollapsed);
        }
      }
    });
  }

  async populateSymbolSearch(query = '', category = 'all') {
    const listCont = document.querySelector('#symbol-results-list');
    if (!listCont) return;

    try {
      const res = await fetch(`/api/symbols?q=${encodeURIComponent(query)}&category=${category}`);
      if (res.ok) {
        const symbols = await res.json();
        if (symbols.length === 0) {
          listCont.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 32px 0;">No symbols found.</div>`;
          return;
        }

        listCont.innerHTML = symbols.map(s => `
          <div class="sym-search-row" data-symbol="${s.symbol}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); cursor: pointer; transition: background 0.12s;">
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #fff;">${s.symbol}</div>
              <div style="font-size: 11px; color: var(--text-dim);">${s.name}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; background: var(--bg-card); padding: 2px 8px; border-radius: 4px; color: var(--accent-cyan);">
                ${s.category}
              </span>
            </div>
          </div>
        `).join('');

        listCont.querySelectorAll('.sym-search-row').forEach(row => {
          row.addEventListener('click', () => {
            const sym = row.getAttribute('data-symbol');
            this.switchSymbol(sym);
            document.querySelector('#modal-symbol-search')?.classList.remove('open');
          });
        });
      }
    } catch (e) {
      listCont.innerHTML = `<div style="color: var(--accent-red); padding: 16px;">Error searching symbols</div>`;
    }
  }

  switchBottomView(viewName) {
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-view') === viewName);
    });
    document.querySelectorAll('.panel-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });
    if (this.isBottomPanelCollapsed) {
      this.isBottomPanelCollapsed = false;
      document.querySelector('#bottom-panel')?.classList.remove('collapsed');
    }
  }

  switchLanguage(lang) {
    setLanguage(lang);
    console.log('[TradingChart] Language switched to:', lang);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new TradingChartApp();
});
