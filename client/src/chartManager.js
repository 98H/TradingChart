// client/src/chartManager.js
// Manager for Vela WebGL2 Workspace, Pine Script Engine, and multi-asset providers
// Upgraded to official LuxAlgo Quant architecture (Vela v0.7.5 + PineTS v0.9.33)

import { VelaWorkspace } from '@luxalgo/vela/workspace';
import { PineEngine } from '@luxalgo/vela-pinets';
import { BinanceProvider } from '@luxalgo/vela/providers/binance';
import { HyperliquidProvider } from '@luxalgo/vela/providers/hyperliquid';
import { sharedBarStore } from '@luxalgo/vela';
import { registerAllVelaPanels } from './velaPanels.js';
import { UniversalMarketProvider } from './universalProvider.js';

export class ChartManager {
  constructor(options = {}) {
    this.mountId = options.mountId || '#vela-workspace-mount';
    this.app = options.app || null;
    this.onSymbolChange = options.onSymbolChange || (() => {});
    this.onPriceTick = options.onPriceTick || (() => {});
    this.workspace = null;
    this.activeSymbol = 'BTCUSDT';
    this.activeTimeframe = '60';
    this.init();
  }

  async init() {
    const mountEl = document.querySelector(this.mountId);
    if (!mountEl) {
      console.error('[ChartManager] Mount element not found:', this.mountId);
      return;
    }

    try {
      // 1. Register all side panels & custom SVG icons into Vela's native registry
      if (this.app) {
        registerAllVelaPanels(this.app);
      }

      // 2. Instantiate Vela WebGL2 Multi-Chart Workspace with full native capabilities
      this.workspace = new VelaWorkspace(this.mountId, {
        layout: '1', // Single chart default, allows dynamic setLayout ('2h', '2v', '4')
        symbol: 'universal:BTCUSDT',
        timeframe: '60',
        bars: 2000, // TradingView-grade history depth (≈83 days 1h / ≈3y daily)
        live: true,
        watermark: true,
        statusline: true,
        bottombar: true,
        drawingToolbar: true,
        timeframes: ['1s', '1', '3', '5', '15', '30', '60', '120', '240', 'D', 'W', 'M'],
        timeframeFavorites: ['1', '5', '15', '60', '240', 'D', 'W'],
        // Clean declarative topbar: symbols, timeframes, styles, indicators on left; undo/redo, screenshot, panels on right
        topbar: {
          left: ['symbol', 'timeframes', 'style', 'indicators'],
          right: ['undo-redo', 'screenshot', 'panels']
        },
        theme: {
          background: '#0b0e14',
          textColor: '#b2b5be',
          gridColor: '#161922',
          borderColor: '#1e222d',
          upColor: '#00F2B0',
          downColor: '#FF4D5B',
          fontFamily: 'Inter, var(--font-vazirmatn), sans-serif'
        },
        sync: {
          symbol: false,
          timeframe: false,
          crosshair: true,
          style: false,
          drawings: false
        },
        providers: {
          universal: () => new UniversalMarketProvider('universal', 'TradingChart Multi-Asset'),
          binance: () => new UniversalMarketProvider('binance', 'Binance Proxied Market Feed'),
          hyperliquid: () => new UniversalMarketProvider('hyperliquid', 'Hyperliquid DEX Feed')
        },
        engines: {
          pine: () => new PineEngine()
        },
        persist: true
      });

      // 3. Listen to workspace events
      this.workspace.events?.on('market:changed', (e) => {
        if (e && e.symbol) {
          const clean = e.symbol.replace(/^.*:/, '').toUpperCase();
          this.activeSymbol = clean;
          this.onSymbolChange(clean);
        }
      });

      // 4. Pre-load official LuxAlgo Signals & Overlays on initial chart (clean non-clipping signals)
      setTimeout(() => {
        this.addPineIndicator(`//@version=5
indicator("LuxAlgo - Signals & Overlays", overlay=true)
len = 16
[st, dir] = ta.supertrend(3.6, len)
plot(st, "Smart Trail", color = dir < 0 ? color.rgb(0, 242, 176) : color.rgb(255, 77, 91), linewidth=2)
var int lastSignal = 0
var int barsCount = 0
barsCount := barsCount + 1
validBar = bar_index > 15 and barsCount >= 10
buySig = validBar and dir < 0 and lastSignal != 1
sellSig = validBar and dir > 0 and lastSignal != -1
if buySig
    lastSignal := 1
    barsCount := 0
if sellSig
    lastSignal := -1
    barsCount := 0
plotshape(buySig, "Buy Signal", shape.triangleup, location.belowbar, color.rgb(0, 242, 176), size=size.small)
plotshape(sellSig, "Sell Signal", shape.triangledown, location.abovebar, color.rgb(255, 77, 91), size=size.small)
`, "LuxAlgo - Signals & Overlays");
      }, 1000);

      // 5. Setup Side Panel Dock Observer & Layout Auto-clearance
      const chartArea = document.querySelector('#chart-area');
      if (chartArea) {
        const updatePanelState = () => {
          const hasOpenPanel = !!(this.workspace?.dock?.openId) || Array.from(document.querySelectorAll('.vela-panel')).some(p => {
            const disp = window.getComputedStyle(p).display;
            return disp !== 'none' && disp !== '';
          });
          if (hasOpenPanel) {
            chartArea.classList.add('has-side-panel');
            chartArea.style.setProperty('--dock-offset', '340px');
          } else {
            chartArea.classList.remove('has-side-panel');
            chartArea.style.setProperty('--dock-offset', '0px');
          }
        };

        const observer = new MutationObserver(() => {
          updatePanelState();
          // Ensure volume canvas opacity is clamped to 0.22
          const r = this.workspace?.active?.chart?.orchestrator?.renderer;
          if (r?.volumeCanvas && r.volumeCanvas.style.opacity !== '0.22') {
            r.volumeCanvas.style.opacity = '0.22';
          }
        });

        observer.observe(mountEl, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
        setInterval(updatePanelState, 200);
        updatePanelState();
      }

      console.log('[ChartManager] Vela WebGL2 Workspace mounted with native LuxAlgo controls');
    } catch (err) {
      console.error('[ChartManager] Error mounting VelaWorkspace:', err);
    }
  }

  setSymbol(symbol) {
    const clean = symbol.replace(/^.*:/, '').toUpperCase();
    this.activeSymbol = clean;
    if (this.workspace?.active) {
      this.workspace.active.setSymbol(`universal:${clean}`);
    }
  }

  setTimeframe(tf) {
    this.activeTimeframe = String(tf);
    if (this.workspace) {
      // Route through setMarket so the deep-history `bars` depth is re-applied
      // on every switch (setTimeframe alone keeps Vela's default window).
      const cell = this.workspace.active;
      if (cell && typeof cell.setMarket === 'function') {
        try { cell.setMarket({ timeframe: String(tf), bars: 2000 }); return; } catch (e) {}
      }
      this.workspace.setActiveTimeframe(String(tf));
    }
  }

  setPriceStyle(style) {
    if (this.workspace?.active) {
      this.workspace.active.setPriceStyle(style);
    }
  }

  // Force the active chart cell to re-pull its series from the provider.
  // Used after switching to/from a synthetic chart type (Renko/Kagi/...),
  // whose transformation happens inside the provider's getBars().
  // Vela no-ops a same-symbol/same-timeframe set, so we bounce through a
  // DIFFERENT timeframe (not 1s — that series is cached and would flash),
  // wait for its fetch to settle, then restore.
  refreshData() {
    try {
      const cell = this.workspace?.active;
      if (!cell) return;
      const tf = String(this.activeTimeframe);
      const bounceTf = tf === '5' ? '15' : '5';
      // Invalidate Vela's module-level bar cache so the provider is re-consulted
      // and the synthetic transform (Renko/Kagi/...) is applied on reload.
      try { sharedBarStore.clear(); } catch (e) {}
      cell.setTimeframe?.(bounceTf);
      setTimeout(() => {
        cell.setTimeframe?.(tf);
      }, 700);
    } catch (e) {
      console.warn('[ChartManager] refreshData fallback failed:', e.message);
    }
  }

  setLayout(layoutId) {
    if (this.workspace) {
      this.workspace.setLayout(layoutId);
    }
  }

  togglePanel(panelId, open) {
    if (this.workspace?.dock) {
      this.workspace.dock.toggle(panelId, open);
      setTimeout(() => {
        const chartArea = document.querySelector('#chart-area');
        if (chartArea) {
          const hasOpenPanel = !!document.querySelector('.vela-panel.is-open');
          chartArea.classList.toggle('has-side-panel', hasOpenPanel);
          chartArea.style.setProperty('--dock-offset', hasOpenPanel ? '340px' : '0px');
        }
      }, 50);
    }
  }

  closeActivePanel() {
    if (this.openPanelId && this.workspace?.dock) {
      this.workspace.dock.toggle(this.openPanelId, false);
      setTimeout(() => {
        const chartArea = document.querySelector('#chart-area');
        if (chartArea) {
          chartArea.classList.remove('has-side-panel');
          chartArea.style.setProperty('--dock-offset', '0px');
        }
      }, 50);
    }
  }

  get openPanelId() {
    return this.workspace?.dock?.openId || null;
  }

  armDrawingTool(toolType) {
    if (this.workspace?.active?.chart?.drawings) {
      this.workspace.globalTool = toolType;
      this.workspace.active.chart.drawings.setTool(toolType);
    }
  }

  clearDrawingTool() {
    if (this.workspace?.active?.chart?.drawings) {
      this.workspace.globalTool = null;
      this.workspace.active.chart.drawings.setTool(null);
    }
  }

  addPineIndicator(scriptSource, title = 'Custom Indicator') {
    if (this.workspace?.active?.chart) {
      try {
        const sanitized = scriptSource.replace(/\bcolor\.cyan\b/g, 'color.rgb(0, 229, 255)');
        const handle = this.workspace.active.chart.addIndicator(sanitized, { language: 'pine', title });
        return { success: true, handleId: handle?.id };
      } catch (e) {
        console.error('[ChartManager] Add Pine Indicator failed:', e);
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: 'No active chart cell' };
  }

  takeScreenshot() {
    if (this.workspace) {
      this.workspace.downloadScreenshot();
    }
  }

  applySettings(cfg) {
    if (!this.workspace) return;
    if (cfg.timezone) {
      try { this.workspace.setTimezone(cfg.timezone); } catch (e) {}
    }
    if (cfg.theme && (cfg.theme === 'dark' || cfg.theme === 'light')) {
      try { this.workspace.setTheme(cfg.theme); } catch (e) {}
    }
    if (this.workspace.active && typeof cfg.watermark === 'boolean') {
      try { this.workspace.active.setWatermarkVisible(cfg.watermark); } catch (e) {}
    }
  }

  undo() {
    if (this.workspace?.active?.history) {
      this.workspace.active.history.undo();
    }
  }

  redo() {
    if (this.workspace?.active?.history) {
      this.workspace.active.history.redo();
    }
  }

  destroy() {
    if (this.workspace) {
      this.workspace.destroy();
      this.workspace = null;
    }
  }
}
