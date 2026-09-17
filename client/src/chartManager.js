// client/src/chartManager.js
// Manager for Vela WebGL2 Workspace, Pine Script Engine, and multi-asset providers

import { VelaWorkspace } from '@luxalgo/vela/workspace';
import { PineEngine } from '@luxalgo/vela-pinets';
import { UniversalMarketProvider } from './universalProvider.js';

export class ChartManager {
  constructor(options = {}) {
    this.mountId = options.mountId || '#vela-workspace-mount';
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
      this.workspace = new VelaWorkspace(this.mountId, {
        layout: false, // Single chart by default
        symbol: 'universal:BTCUSDT',
        timeframe: '60',
        live: true,
        theme: 'dark',
        providers: {
          universal: () => new UniversalMarketProvider('universal', 'TradingChart Multi-Asset'),
          binance: () => new UniversalMarketProvider('binance', 'Binance Proxied Feed')
        },
        engines: {
          pine: () => new PineEngine()
        },
        persist: true
      });

      // Listen to workspace events
      this.workspace.events?.on('market:changed', (e) => {
        if (e && e.symbol) {
          const clean = e.symbol.replace(/^.*:/, '').toUpperCase();
          this.activeSymbol = clean;
          this.onSymbolChange(clean);
        }
      });

      console.log('[ChartManager] Vela WebGL2 Workspace mounted successfully');
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
      this.workspace.setActiveTimeframe(String(tf));
    }
  }

  setPriceStyle(style) {
    if (this.workspace?.active) {
      this.workspace.active.setPriceStyle(style);
    }
  }

  setLayout(layoutId) {
    if (this.workspace) {
      this.workspace.setLayout(layoutId);
    }
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

  addPineIndicator(scriptSource) {
    if (this.workspace?.active?.chart) {
      try {
        this.workspace.active.chart.addIndicator(scriptSource, { engine: 'pine' });
        return { success: true };
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
