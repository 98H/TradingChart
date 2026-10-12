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

      // 3. Listen to workspace events & sanitize script inputs on charts
      const patchChartIndicator = (chart) => {
        if (!chart || chart._indPatched) return;
        chart._indPatched = true;
        if (typeof chart.addIndicator === 'function') {
          const orig = chart.addIndicator.bind(chart);
          chart.addIndicator = (source, options) => {
            const sanitized = typeof source === 'string' ? source.replace(/\bcolor\.cyan\b/g, 'color.rgb(0, 229, 255)') : source;
            return orig(sanitized, options);
          };
        }
      };

      if (this.workspace.active?.chart) patchChartIndicator(this.workspace.active.chart);
      this.workspace.events?.on('cell:created', ({ id }) => {
        const c = this.workspace.cellsById?.get(id);
        if (c?.chart) patchChartIndicator(c.chart);
      });

      this.workspace.events?.on('market:changed', (e) => {
        if (e && e.symbol) {
          const clean = e.symbol.replace(/^.*:/, '').toUpperCase();
          this.swapDrawingsForSymbol(clean);
          this.activeSymbol = clean;
          this.onSymbolChange(clean);
        }
      });

      // 4. Pre-load official LuxAlgo Signals & Overlays on initial chart (only if brand new session)
      setTimeout(() => {
        try {
          const rawCurrent = localStorage.getItem('tradingchart_current_layout');
          const parsed = rawCurrent ? JSON.parse(rawCurrent) : null;
          const hasSavedState = !!(parsed?.state?.cells?.length || parsed?.state?.charts?.length);
          const handles = this.workspace?.active?.chart?.orchestrator?.handles;
          const currentCount = handles ? (handles.size || Object.keys(handles).length) : 0;
          if (!hasSavedState && currentCount <= 1) {
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
          }
        } catch (e) {}
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
        // The MutationObserver already covers dock open/close transitions; the
        // 200 ms interval is only a belt-and-suspenders catch-up, run at 1 s.
        const panelTimer = setInterval(updatePanelState, 1000);
        if (panelTimer.unref) panelTimer.unref();
        updatePanelState();
      }

      console.log('[ChartManager] Vela WebGL2 Workspace mounted with native LuxAlgo controls');
    } catch (err) {
      console.error('[ChartManager] Error mounting VelaWorkspace:', err);
    }
  }

  /* ---- Per-symbol drawings (TradingView semantics) ----------------------
   * Drawings are anchored to prices, so a BTC trendline at 83,000 is
   * meaningless on ETH at 2,500. The active cell's drawings are stashed under
   * the symbol they were made on and restored when that symbol returns. */
  _drawingStore() {
    if (!this._drawStore) {
      try { this._drawStore = JSON.parse(localStorage.getItem('tc_drawings_by_symbol') || '{}') || {}; }
      catch (e) { this._drawStore = {}; }
    }
    return this._drawStore;
  }

  stashActiveDrawings() {
    const d = this.workspace?.active?.chart?.drawings;
    const sym = this._drawSym;
    if (!d?.all || !sym) return;
    const store = this._drawingStore();
    try {
      if (d.all().length) store[sym] = d.toJSON(); else delete store[sym];
      localStorage.setItem('tc_drawings_by_symbol', JSON.stringify(store));
    } catch (e) {}
  }

  swapDrawingsForSymbol(newSym) {
    const d = this.workspace?.active?.chart?.drawings;
    if (!d?.all) return;
    if (!this._drawSym) {
      const cur = String(this.workspace?.active?.symbol || this.activeSymbol || '').replace(/^.*:/, '').toUpperCase();
      this._drawSym = cur || newSym;
    }
    if (this._drawSym === newSym) return;
    this.stashActiveDrawings();
    try {
      const ids = d.all().map(x => x.id);
      if (ids.length) d.removeMany(ids);
      const saved = this._drawingStore()[newSym];
      if (saved) d.fromJSON(saved);
    } catch (e) { console.warn('[Drawings] per-symbol swap failed:', e); }
    this._drawSym = newSym;
  }

  setSymbol(symbol) {
    const clean = symbol.replace(/^.*:/, '').toUpperCase();
    this.swapDrawingsForSymbol(clean);
    this.activeSymbol = clean;
    if (this.workspace?.active) {
      this.workspace.active.setSymbol(`universal:${clean}`);
    }
    // Propagate when symbol sync is enabled across multi-chart grid
    if (this.app?.layoutManager?.syncOpts?.symbol && this.workspace?.cellsById) {
      for (const cell of this.workspace.cellsById.values()) {
        if (cell && cell !== this.workspace.active && typeof cell.setSymbol === 'function') {
          try { cell.setSymbol(`universal:${clean}`); } catch (e) {}
        }
      }
    }
    this.app?.layoutManager?.updateCellStrip?.();
    this.app?.layoutManager?.schedulePersist?.();
  }

  setTimeframe(tf) {
    // '15m' / '4h' style labels → canonical Vela ids (see normalizeTf in main.js)
    if (typeof window !== 'undefined' && typeof window.__normalizeTf === 'function') tf = window.__normalizeTf(tf);
    this.activeTimeframe = String(tf);
    if (this.workspace) {
      // Route through setMarket so the deep-history `bars` depth is re-applied
      // on every switch (setTimeframe alone keeps Vela's default window).
      const cell = this.workspace.active;
      if (cell && typeof cell.setMarket === 'function') {
        try { cell.setMarket({ timeframe: String(tf), bars: 2000 }); } catch (e) {}
      } else if (cell && typeof cell.setTimeframe === 'function') {
        try { cell.setTimeframe(String(tf)); } catch (e) {}
      } else {
        this.workspace.setActiveTimeframe(String(tf));
      }

      // Propagate when timeframe sync is enabled across multi-chart grid
      if (this.app?.layoutManager?.syncOpts?.timeframe && this.workspace?.cellsById) {
        for (const c of this.workspace.cellsById.values()) {
          if (c && c !== this.workspace.active) {
            if (typeof c.setMarket === 'function') {
              try { c.setMarket({ timeframe: String(tf), bars: 2000 }); } catch (e) {}
            } else if (typeof c.setTimeframe === 'function') {
              try { c.setTimeframe(String(tf)); } catch (e) {}
            }
          }
        }
      }
    }
    this.app?.layoutManager?.updateCellStrip?.();
    this.app?.layoutManager?.schedulePersist?.();
  }

  setPriceStyle(style) {
    if (this.workspace?.active) {
      this.workspace.active.setPriceStyle(style);
    }
    // Propagate when style sync is enabled across multi-chart grid
    if (this.app?.layoutManager?.syncOpts?.style && this.workspace?.cellsById) {
      for (const c of this.workspace.cellsById.values()) {
        if (c && c !== this.workspace.active && typeof c.setPriceStyle === 'function') {
          try { c.setPriceStyle(style); } catch (e) {}
        }
      }
    }
    this.app?.layoutManager?.schedulePersist?.();
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
        this.app?.layoutManager?.schedulePersist?.();
        return { success: true, handleId: handle?.id };
      } catch (e) {
        console.error('[ChartManager] Add Pine Indicator failed:', e);
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: 'No active chart cell' };
  }

  removeIndicator(handleId) {
    if (!handleId) return false;
    const orch = this.workspace?.active?.chart?.orchestrator;
    if (orch?.removeIndicator) {
      try {
        orch.removeIndicator(handleId);
        this.app?.layoutManager?.schedulePersist?.();
        return true;
      } catch (e) {
        console.warn('[ChartManager] removeIndicator failed:', e);
      }
    }
    return false;
  }

  getIndicators() {
    try {
      const orch = this.workspace?.active?.chart?.orchestrator;
      if (!orch?.handles) return [];
      const handles = Array.from(orch.handles.values ? orch.handles.values() : Object.values(orch.handles));
      return handles.map(h => ({
        id: h.id,
        title: h.title,
        nativeType: h.nativeType || null,
        source: h.source || null,
        visible: h.visible !== false,
        inputs: orch.inputValuesOf ? orch.inputValuesOf(h.id) : {},
        props: orch.propValuesOf ? orch.propValuesOf(h.id) : {}
      }));
    } catch (e) {
      return [];
    }
  }

  /**
   * Plan-gate support: number of indicators on the ACTIVE chart cell
   * (native ledger + Pine manifest + orchestrator handles), read live from the engine.
   */
  countActiveIndicators() {
    try {
      const orch = this.workspace?.active?.chart?.orchestrator;
      if (orch?.handles) {
        const handles = Array.from(orch.handles.values ? orch.handles.values() : Object.values(orch.handles));
        return handles.length;
      }
      const ws = this.workspace;
      const st = typeof ws?.getState === 'function' ? ws.getState() : null;
      if (!st) return 0;
      const charts = Array.isArray(st.charts) ? st.charts : [];
      const activeId = st.activeCellId || ws?.active?.id || charts[0]?.id;
      const cell = charts.find(c => c.id === activeId) || charts[0];
      if (!cell?.indicators) return 0;
      const natives = Array.isArray(cell.indicators.natives) ? cell.indicators.natives.length : 0;
      const manifest = Array.isArray(cell.indicators.manifest) ? cell.indicators.manifest.length : 0;
      return natives + manifest;
    } catch (e) { return 0; }
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
