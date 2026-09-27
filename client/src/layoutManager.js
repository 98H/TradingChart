// client/src/layoutManager.js
// TradingView-Grade Multi-Chart Layout Management Studio
// Supports 1x1, 2H, 2V, 2x2, 3H, 3V, 3x2, 4x2 grids, 6-Axis Sync (Symbol, Timeframe, Crosshair, Viewport, Drawings, Style),
// Layout Presets, Search/Sort, Auto-Save Engine, Custom Glassmorphism Dialogs, and Mobile Multi-Chart Cell Strip.

import { getLanguage, t, toPersianDigits } from './i18n.js';
import { showPromptDialog, showConfirmDialog } from './uiDialog.js';

export const DEFAULT_LAYOUT_PRESETS = [
  {
    id: 'single',
    layoutId: '1',
    nameEn: '1x1 Single Chart',
    nameFa: 'تک‌چارت (1x1)',
    cols: 1,
    rows: 1,
    descEn: 'Focus on single asset with full technical markers',
    descFa: 'تمرکز روی یک دارایی با نمایش تمام علائم تکنیکال'
  },
  {
    id: 'dual_h',
    layoutId: '2h',
    nameEn: '2x1 Dual Horizontal',
    nameFa: 'دو چارت افقی (2x1)',
    cols: 2,
    rows: 1,
    descEn: 'Side-by-side asset comparison or correlation check',
    descFa: 'مقایسه کنار هم دو دارایی یا سنجش همبستگی'
  },
  {
    id: 'dual_v',
    layoutId: '2v',
    nameEn: '1x2 Dual Vertical',
    nameFa: 'دو چارت عمودی (1x2)',
    cols: 1,
    rows: 2,
    descEn: 'Multi-timeframe analysis (Higher Timeframe + Trigger)',
    descFa: 'تحلیل مولتی‌تایم‌فریم (تایم‌فریم ساختاری + تریگر)'
  },
  {
    id: 'quad',
    layoutId: '4',
    nameEn: '2x2 Quad Grid',
    nameFa: 'چهار چارت مربعی (2x2)',
    cols: 2,
    rows: 2,
    descEn: '4-chart matrix for Bitcoin, Ethereum, Solana & Gold',
    descFa: 'ماتریس ۴ چارته برای بررسی همزمان ارزها و طلا'
  },
  {
    id: 'triple_h',
    layoutId: 'g1x3',
    nameEn: '3x1 Triple Horizontal',
    nameFa: 'سه چارت افقی (3x1)',
    cols: 3,
    rows: 1,
    descEn: '3-stage trend progression analysis',
    descFa: 'تحلیل سه‌مرحله‌ای امتداد روند'
  },
  {
    id: 'triple_v',
    layoutId: 'g3x1',
    nameEn: '1x3 Triple Vertical',
    nameFa: 'سه چارت عمودی (1x3)',
    cols: 1,
    rows: 3,
    descEn: 'Daily, 4-Hour, and 15-Minute execution waterfall',
    descFa: 'آبشار تحلیل روزانه، ۴ ساعته و تریگر ۱۵ دقیقه'
  },
  {
    id: 'six_pack',
    layoutId: 'g2x3',
    nameEn: '3x2 Six-Chart Matrix',
    nameFa: 'شش چارت ماتریسی (3x2)',
    cols: 3,
    rows: 2,
    descEn: 'Portfolio surveillance across major market sectors',
    descFa: 'پایش سبد دارایی و بخش‌های پیشرو بازار'
  },
  {
    id: 'eight_pack',
    layoutId: '8',
    nameEn: '4x2 Institutional Matrix',
    nameFa: 'هشت چارت نهادی (4x2)',
    cols: 4,
    rows: 2,
    descEn: 'Institutional multi-asset market radar terminal',
    descFa: 'ترمینال رادار مارکت نهادی برای تمام کلاس‌های دارایی'
  }
];

export class LayoutManager {
  constructor(app) {
    this.app = app;
    this.activeLayoutId = '1';
    this.activeLayoutName = '1x1 Single Chart';
    this.activeSavedLayoutId = null;
    this.isMaximizedCell = false;
    this.searchQuery = '';
    this.sortBy = 'date'; // 'date' | 'name'
    this._wiredCells = new WeakSet();
    this._wsEventsBound = false;
    
    // TradingView 6-Axis Sync
    this.syncOpts = {
      symbol: false,
      timeframe: false,
      crosshair: true,
      viewport: true,
      drawings: false,
      style: false
    };

    // Auto-Save Engine
    this.autoSaveEnabled = localStorage.getItem('tradingchart_layout_autosave') !== 'false';
    this.isDirty = false;
    this.autoSaveTimer = null;
    this._persistDebounceTimer = null;

    this.savedLayouts = this.loadSavedLayouts();
    this.restoreCurrentLayout();
    this.initDOM();
    this.setupAutoSave();
    this.setupCellStrip();
    this.setupUnloadHandler();
  }

  setupUnloadHandler() {
    window.addEventListener('beforeunload', () => {
      this.persistCurrentLayout();
    });
    window.addEventListener('pagehide', () => {
      this.persistCurrentLayout();
    });
  }

  // Bind reactive listeners to all cells in workspace (indicators, inputs, visibility, drawings, configs)
  bindWorkspaceCellListeners() {
    const ws = this.app?.chartManager?.workspace;
    if (!ws) return;

    if (!this._wiredCells) this._wiredCells = new WeakSet();

    const wireCell = (cell) => {
      if (!cell || this._wiredCells.has(cell)) return;
      this._wiredCells.add(cell);

      const chart = cell.chart;
      const orch = chart?.orchestrator;
      if (orch?.events?.on) {
        orch.events.on('indicator:inputs', () => this.schedulePersist());
        orch.events.on('indicator:visibility', () => this.schedulePersist());
        orch.events.on('indicator:removed', () => this.schedulePersist());
        orch.events.on('indicator:added', () => this.schedulePersist());
        orch.events.on('indicator:moved', () => this.schedulePersist());
        orch.events.on('market:changed', () => this.schedulePersist());
        orch.events.on('timeframe:changed', () => this.schedulePersist());
        orch.events.on('style:changed', () => this.schedulePersist());
      }

      if (chart?.drawings?.events?.on) {
        chart.drawings.events.on('drawing:created', () => this.schedulePersist());
        chart.drawings.events.on('drawing:edited', () => this.schedulePersist());
        chart.drawings.events.on('drawing:removed', () => this.schedulePersist());
      } else if (chart?.drawings?.on) {
        try {
          chart.drawings.on('drawing:created', () => this.schedulePersist());
          chart.drawings.on('drawing:edited', () => this.schedulePersist());
          chart.drawings.on('drawing:removed', () => this.schedulePersist());
        } catch (e) {}
      }

      if (typeof chart?.onConfigChanged === 'function') {
        try { chart.onConfigChanged(() => this.schedulePersist()); } catch (e) {}
      }
    };

    if (ws.cellsById) {
      for (const cell of ws.cellsById.values()) {
        wireCell(cell);
      }
    }
    if (ws.active) {
      wireCell(ws.active);
    }

    if (ws.events?.on && !this._wsEventsBound) {
      this._wsEventsBound = true;
      ws.events.on('cell:created', ({ id }) => {
        const cell = ws.cellsById?.get(id);
        if (cell) wireCell(cell);
        this.updateCellStrip();
        this.schedulePersist();
      });
      ws.events.on('cell:destroyed', () => {
        this.updateCellStrip();
        this.schedulePersist();
      });
      ws.events.on('layout:changed', () => {
        if (ws.cellsById) {
          for (const cell of ws.cellsById.values()) wireCell(cell);
        }
        this.updateCellStrip();
      });
      ws.events.on('cell:active', ({ id }) => {
        const cell = ws.cellsById?.get(id) || ws.active;
        if (cell) {
          if (cell.symbol) {
            const cleanSym = cell.symbol.replace(/^.*:/, '').toUpperCase();
            this.app.currentSymbol = cleanSym;
            if (this.app.chartManager) this.app.chartManager.activeSymbol = cleanSym;
            this.app.depthOfMarket?.setSymbol?.(cleanSym);
            this.app.watchlist?.setSymbol?.(cleanSym);
          }
          if (cell.timeframe) {
            this.app.currentTimeframe = String(cell.timeframe);
            if (this.app.chartManager) this.app.chartManager.activeTimeframe = String(cell.timeframe);
          }
          this.updateCellStrip();
          this.schedulePersist();
        }
      });
    }
  }

  // Restore the last-active grid after a page reload (TradingView parity).
  restoreCurrentLayout() {
    try {
      const raw = localStorage.getItem('tradingchart_current_layout');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.layoutId) {
        this.activeLayoutId = parsed.layoutId;
        if (parsed.name) this.activeLayoutName = parsed.name;
        this.activeSavedLayoutId = parsed.savedLayoutId || parsed.state?.savedLayoutId || null;
        if (parsed.sync) this.syncOpts = { ...this.syncOpts, ...parsed.sync };
        this.updateTopbarLabel();

        let attempts = 0;
        const pollAndRestore = () => {
          const ws = this.app?.chartManager?.workspace;
          const isReady = ws && ws.active && ws.active.chart && ws.active.chart.orchestrator;
          if (isReady) {
            this.setLayout(parsed.layoutId, parsed.name, {
              state: parsed.state,
              skipPersist: true,
              savedLayoutId: this.activeSavedLayoutId
            });
            this.applyAllSyncOptions();
            this.bindWorkspaceCellListeners();
          } else if (attempts++ < 60) {
            setTimeout(pollAndRestore, 100);
          }
        };
        setTimeout(pollAndRestore, 150);
      }
    } catch (e) {}
  }

  schedulePersist() {
    if (this._persistDebounceTimer) clearTimeout(this._persistDebounceTimer);
    this._persistDebounceTimer = setTimeout(() => {
      this.persistCurrentLayout();
    }, 600);
  }

  persistCurrentLayout() {
    if (!this.autoSaveEnabled) return false;
    try {
      const state = this.captureWorkspaceState();
      if (!state) return false;

      localStorage.setItem('tradingchart_current_layout', JSON.stringify({
        layoutId: this.activeLayoutId,
        name: this.activeLayoutName,
        savedLayoutId: this.activeSavedLayoutId,
        state,
        sync: { ...this.syncOpts },
        timestamp: Date.now()
      }));

      // If active layout corresponds to a saved layout item, update its state too
      let activeIdx = -1;
      if (this.activeSavedLayoutId) {
        activeIdx = this.savedLayouts.findIndex(l => l.id === this.activeSavedLayoutId);
      }
      if (activeIdx === -1) {
        activeIdx = this.savedLayouts.findIndex(l => l.layoutId === this.activeLayoutId && (l.name === this.activeLayoutName || l.nameFa === this.activeLayoutName));
      }
      if (activeIdx !== -1) {
        this.activeSavedLayoutId = this.savedLayouts[activeIdx].id;
        this.savedLayouts[activeIdx].state = state;
        this.savedLayouts[activeIdx].sync = { ...this.syncOpts };
        this.savedLayouts[activeIdx].date = new Date().toISOString().split('T')[0];
        this.saveSavedLayouts();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  captureWorkspaceState() {
    try {
      const ws = this.app?.chartManager?.workspace;
      if (!ws) return null;

      const cells = [];
      const orderedCells = (ws.order && ws.order.length > 0)
        ? ws.order.map(id => ws.cellsById.get(id)).filter(Boolean)
        : (ws.cellsById && ws.cellsById.size > 0 
          ? Array.from(ws.cellsById.values()) 
          : (ws.active ? [ws.active] : []));

      for (let i = 0; i < orderedCells.length; i++) {
        const cell = orderedCells[i];
        if (!cell) continue;
        const chart = cell.chart;
        const orch = chart?.orchestrator;
        const handlesList = Array.from(orch?.handles ? (orch.handles.values ? orch.handles.values() : Object.values(orch.handles)) : []);

        const indicators = handlesList.map(h => {
          const nativeType = h.nativeType || orch?.registry?.get?.(h.id)?.native?.type || (h.source ? null : h.id);
          const source = h.source || orch?.registry?.get?.(h.id)?.source || null;
          const inputs = orch?.inputValuesOf ? orch.inputValuesOf(h.id) : (h.inputValues ? h.inputValues() : {});
          const props = orch?.propValuesOf ? orch.propValuesOf(h.id) : (h.propValues ? h.propValues() : {});
          return {
            id: h.id,
            title: h.title,
            nativeType: nativeType || null,
            source: source || null,
            language: h.language || (source ? 'pine' : null),
            visible: h.visible !== false,
            inputs: inputs || {},
            props: props || {}
          };
        });

        let drawings = null;
        try {
          if (chart?.drawings?.toJSON) drawings = chart.drawings.toJSON();
        } catch (e) {}

        cells.push({
          id: cell.id || `c${i + 1}`,
          symbol: cell.symbol || 'universal:BTCUSDT',
          timeframe: cell.timeframe || '60',
          priceStyle: cell.priceStyle || 'candles',
          watermark: cell.watermarkOn !== false,
          drawings,
          indicators
        });
      }

      let velaState = null;
      try {
        if (typeof ws.getState === 'function') velaState = JSON.parse(JSON.stringify(ws.getState()));
      } catch (e) {}

      return {
        version: 2,
        layoutId: this.activeLayoutId,
        name: this.activeLayoutName,
        savedLayoutId: this.activeSavedLayoutId,
        activeCellId: ws.active?.id || (cells[0]?.id || 'c1'),
        sync: { ...this.syncOpts },
        cells,
        velaState,
        timestamp: Date.now()
      };
    } catch (e) {
      console.warn('[LayoutManager] captureWorkspaceState failed:', e);
      return null;
    }
  }

  async applyWorkspaceState(state) {
    if (!state) return false;
    const ws = this.app?.chartManager?.workspace;
    if (!ws) return false;

    try {
      // 1. Restore sync options
      if (state.sync) {
        this.syncOpts = { ...this.syncOpts, ...state.sync };
        this.applyAllSyncOptions();
      }

      if (state.savedLayoutId) {
        this.activeSavedLayoutId = state.savedLayoutId;
      }

      // 2. Legacy fallback if no cells array
      if (!Array.isArray(state.cells) || state.cells.length === 0) {
        if (typeof ws.applyState === 'function') {
          const s = state.velaState || state;
          ws.applyState(s);
          this.bindWorkspaceCellListeners();
          this.updateCellStrip();
          return true;
        }
        return false;
      }

      // 3. Rich state v2: Wait for expected cell count in workspace
      const expectedCellCount = state.cells.length;
      let attempts = 0;
      while ((!ws.cellsById || ws.cellsById.size < expectedCellCount) && attempts < 35) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      const liveCells = (ws.order && ws.order.length > 0)
        ? ws.order.map(id => ws.cellsById.get(id)).filter(Boolean)
        : (ws.cellsById ? Array.from(ws.cellsById.values()) : (ws.active ? [ws.active] : []));

      for (let i = 0; i < state.cells.length; i++) {
        const savedCell = state.cells[i];
        const cell = liveCells.find(c => c.id === savedCell.id) || liveCells[i];
        if (!cell) continue;

        // Apply symbol
        if (savedCell.symbol && typeof cell.setSymbol === 'function') {
          try { cell.setSymbol(savedCell.symbol); } catch (e) {}
        }

        // Apply timeframe
        if (savedCell.timeframe && typeof cell.setTimeframe === 'function') {
          try { cell.setTimeframe(savedCell.timeframe); } catch (e) {}
        }

        // Apply price style
        if (savedCell.priceStyle && typeof cell.setPriceStyle === 'function') {
          try { cell.setPriceStyle(savedCell.priceStyle); } catch (e) {}
        }

        // Apply watermark
        if (typeof savedCell.watermark === 'boolean' && typeof cell.setWatermarkVisible === 'function') {
          try { cell.setWatermarkVisible(savedCell.watermark); } catch (e) {}
        }

        // Synchronize topbar symbol and timeframe if active cell or primary cell
        if (cell === ws.active || i === 0) {
          if (savedCell.symbol) {
            const cleanSym = savedCell.symbol.replace(/^.*:/, '').toUpperCase();
            this.app.currentSymbol = cleanSym;
            if (this.app.chartManager) this.app.chartManager.activeSymbol = cleanSym;
            this.app.depthOfMarket?.setSymbol?.(cleanSym);
            this.app.watchlist?.setSymbol?.(cleanSym);
          }
          if (savedCell.timeframe) {
            this.app.currentTimeframe = String(savedCell.timeframe);
            if (this.app.chartManager) this.app.chartManager.activeTimeframe = String(savedCell.timeframe);
          }
        }

        // Apply drawings
        if (savedCell.drawings && cell.chart?.drawings?.fromJSON) {
          try { cell.chart.drawings.fromJSON(savedCell.drawings); } catch (e) {}
        }

        // Apply indicators
        const chart = cell.chart;
        const orch = chart?.orchestrator;
        if (orch && Array.isArray(savedCell.indicators)) {
          // Clear current handles to avoid duplicates/stale indicators
          const currentHandles = Array.from(orch.handles ? (orch.handles.values ? orch.handles.values() : Object.values(orch.handles)) : []);
          for (const ch of currentHandles) {
            try { orch.removeIndicator(ch.id); } catch (e) {}
          }

          // Restore saved indicators
          for (const ind of savedCell.indicators) {
            let handle = null;
            if (ind.nativeType) {
              if (ind.nativeType === 'volume') orch.volumeOptedOut = false;
              try {
                handle = chart.addNativeIndicator(ind.nativeType, {
                  inputs: ind.inputs || {}
                });
              } catch (e) {}
            } else if (ind.source) {
              const sanitizedSource = (ind.source || '').replace(/\bcolor\.cyan\b/g, 'color.rgb(0, 229, 255)');
              try {
                handle = chart.addIndicator(sanitizedSource, {
                  language: ind.language || 'pine',
                  title: ind.title,
                  inputs: ind.inputs || {},
                  props: ind.props || {}
                });
              } catch (e) {}
            }
            if (handle) {
              if (ind.inputs && Object.keys(ind.inputs).length > 0 && typeof orch.applyInputs === 'function') {
                try { orch.applyInputs(handle.id, ind.inputs); } catch (e) {}
              }
              if (ind.props && Object.keys(ind.props).length > 0 && typeof orch.applyProps === 'function') {
                try { orch.applyProps(handle.id, ind.props); } catch (e) {}
              }
              if (ind.visible === false && typeof orch.setVisible === 'function') {
                try { orch.setVisible(handle.id, false); } catch (e) {}
              }
            }
          }
        }
      }

      if (state.activeCellId && ws.setActiveCell) {
        try { ws.setActiveCell(state.activeCellId); } catch (e) {}
      }

      this.bindWorkspaceCellListeners();
      this.updateCellStrip();
      window.dispatchEvent(new Event('resize'));
      return true;
    } catch (err) {
      console.warn('[LayoutManager] applyWorkspaceState failed:', err);
      return false;
    }
  }

  renameLayout(id, newName) {
    const l = this.savedLayouts.find(x => x.id === id);
    if (!l) return false;
    l.name = newName;
    l.nameFa = newName;
    if (l.state) {
      l.state.name = newName;
    }
    this.saveSavedLayouts();
    if (this.activeSavedLayoutId === id || (this.activeLayoutId === l.layoutId && (this.activeLayoutName === l.name || this.activeLayoutName === l.nameFa))) {
      this.activeLayoutName = newName;
      this.activeSavedLayoutId = id;
      this.updateTopbarLabel();
      this.persistCurrentLayout();
    }
    return true;
  }

  getUserSavedLayoutsCount() {
    return this.savedLayouts.filter(l => l.id !== 'usr_default' && l.id !== 'usr_macro' && !l.isSystemTemplate).length;
  }

  duplicateLayout(id, opts = {}) {
    if (opts.enforcePlan && this.app?.auth && !this.app.auth.enforce('savedLayouts', this.getUserSavedLayoutsCount(), 'saved layouts', 'چیدمان‌های ذخیره‌شده')) return null;
    const l = this.savedLayouts.find(x => x.id === id);
    if (!l) return null;
    const copy = {
      ...l,
      id: 'usr_' + Date.now(),
      name: l.name + ' (Copy)',
      nameFa: (l.nameFa || l.name) + ' (کپی)',
      date: new Date().toISOString().split('T')[0]
    };
    if (l.state) copy.state = JSON.parse(JSON.stringify(l.state));
    this.savedLayouts.unshift(copy);
    this.saveSavedLayouts();
    return copy;
  }

  exportLayout(id) {
    const l = this.savedLayouts.find(x => x.id === id);
    if (!l) return null;
    return JSON.stringify({ __tradingchart_layout: true, ...l }, null, 2);
  }

  importLayout(json, opts = {}) {
    try {
      if (opts.enforcePlan && this.app?.auth && !this.app.auth.enforce('savedLayouts', this.getUserSavedLayoutsCount(), 'saved layouts', 'چیدمان‌های ذخیره‌شده')) return null;
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      if (!obj || obj.__tradingchart_layout !== true || !obj.layoutId) return null;
      const copy = { ...obj, id: 'usr_' + Date.now() };
      delete copy.__tradingchart_layout;
      this.savedLayouts.unshift(copy);
      this.saveSavedLayouts();
      return copy;
    } catch (e) { return null; }
  }

  loadSavedLayouts() {
    try {
      const data = localStorage.getItem('tradingchart_user_layouts');
      let layouts = data ? JSON.parse(data) : [
        {
          id: 'usr_default',
          name: 'Institutional SMC Master',
          nameFa: 'طرح تحلیلی نهادی اسمارت مانی',
          layoutId: '4',
          badge: '4 Charts',
          badgeFa: '۴ چارت',
          sync: { symbol: false, timeframe: false, crosshair: true, viewport: true, drawings: false, style: false },
          state: {
            version: 2,
            layoutId: '4',
            name: 'Institutional SMC Master',
            cells: [
              { id: 'c1', symbol: 'universal:BTCUSDT', timeframe: '60', priceStyle: 'candles', indicators: [{ nativeType: 'volume' }] },
              { id: 'c2', symbol: 'universal:ETHUSDT', timeframe: '60', priceStyle: 'candles', indicators: [{ nativeType: 'volume' }] },
              { id: 'c3', symbol: 'universal:SOLUSDT', timeframe: '60', priceStyle: 'candles', indicators: [{ nativeType: 'volume' }] },
              { id: 'c4', symbol: 'universal:XAUUSD', timeframe: '60', priceStyle: 'candles', indicators: [{ nativeType: 'volume' }] }
            ]
          },
          date: new Date().toISOString().split('T')[0]
        },
        {
          id: 'usr_macro',
          name: 'Macro Confluence (BTC+Gold)',
          nameFa: 'همگرایی کلان بیت‌کوین و اونس طلا',
          layoutId: '2h',
          badge: '2 Charts',
          badgeFa: '۲ چارت',
          sync: { symbol: false, timeframe: true, crosshair: true, viewport: true, drawings: false, style: false },
          state: {
            version: 2,
            layoutId: '2h',
            name: 'Macro Confluence (BTC+Gold)',
            cells: [
              { id: 'c1', symbol: 'universal:BTCUSDT', timeframe: '60', priceStyle: 'candles', indicators: [{ nativeType: 'volume' }] },
              { id: 'c2', symbol: 'universal:XAUUSD', timeframe: '60', priceStyle: 'candles', indicators: [{ nativeType: 'volume' }, { nativeType: 'rsi', inputs: { length: 14 } }] }
            ]
          },
          date: new Date().toISOString().split('T')[0]
        }
      ];

      const seen = new Set();
      layouts = layouts.filter(l => {
        const cleanName = (l.name || '').replace(/×/g, 'x').trim();
        if (seen.has(cleanName)) return false;
        seen.add(cleanName);
        l.name = cleanName;
        if (l.nameFa) l.nameFa = l.nameFa.replace(/×/g, 'x');
        if (l.badge === '1 Charts' || l.badge === '1 charts') l.badge = '1 Chart';
        return true;
      });
      return layouts;
    } catch (e) {
      return [];
    }
  }

  saveSavedLayouts() {
    try {
      localStorage.setItem('tradingchart_user_layouts', JSON.stringify(this.savedLayouts));
    } catch (e) {}
  }

  initDOM() {
    this.updateTopbarLabel();
    this.bindTopbarEvents();
  }

  updateTopbarLabel() {
    const labelEl = document.querySelector('#active-layout-name');
    if (!labelEl) return;
    const isFa = getLanguage() === 'fa';
    const preset = DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === this.activeLayoutId);
    const genericNames = new Set(['1', '1x1', '1x1 Single Chart', '2h', '2v', '4', 'g1x3', 'g3x1', 'g2x3', '8', preset?.nameEn, preset?.nameFa]);
    if (this.activeLayoutName && !genericNames.has(this.activeLayoutName)) {
      labelEl.innerText = this.activeLayoutName;
      return;
    }
    if (preset) {
      labelEl.innerText = isFa ? preset.nameFa : preset.nameEn;
    } else {
      labelEl.innerText = this.activeLayoutName || (isFa ? 'چیدمان' : 'Layout');
    }
  }

  bindTopbarEvents() {
    // Open Layout Studio Modal (Desktop topbar)
    document.querySelector('#btn-layout-manager')?.addEventListener('click', () => {
      this.openLayoutStudio();
    });

    // Mobile Topbar Layout Button
    document.querySelector('#btn-mobile-layout')?.addEventListener('click', () => {
      this.openLayoutStudio();
    });

    // Save Button
    document.querySelector('#btn-layout-save')?.addEventListener('click', () => {
      this.quickSaveLayout();
    });
  }

  executeAutoSave() {
    if (!this.autoSaveEnabled) return false;
    const ok = this.persistCurrentLayout();
    if (ok) this.flashAutoSaveStatus();
    return ok;
  }

  setupAutoSave() {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    if (!this.autoSaveEnabled) return;
    this.autoSaveTimer = setInterval(() => {
      this.executeAutoSave();
    }, 15000);
  }

  flashAutoSaveStatus() {
    const isFa = getLanguage() === 'fa';
    const label = document.querySelector('#layout-save-label');
    const saveBtn = document.querySelector('#btn-layout-save');
    if (label) {
      label.innerText = isFa ? 'ذخیره شد ✓' : 'Saved ✓';
      if (saveBtn) {
        saveBtn.style.color = 'var(--accent-green)';
        saveBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      }
      setTimeout(() => {
        if (label) label.innerText = isFa ? 'ذخیره' : 'Save';
        if (saveBtn) {
          saveBtn.style.color = '';
          saveBtn.style.borderColor = '';
        }
      }, 2500);
    }
  }

  quickSaveLayout() {
    const isFa = getLanguage() === 'fa';
    const saveBtn = document.querySelector('#btn-layout-save');
    const label = document.querySelector('#layout-save-label');
    if (label) label.innerText = isFa ? 'ذخیره شد ✓' : 'Saved ✓';
    if (saveBtn) {
      saveBtn.style.borderColor = 'var(--accent-green)';
      saveBtn.style.color = 'var(--accent-green)';
    }

    const preset = DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === this.activeLayoutId);
    const count = preset ? preset.cols * preset.rows : 1;
    const genericNames = new Set([
      '1', '1x1', '1x1 Single Chart', 'چارت تک‌پنجره‌ای (1x1)', 'تک‌چارت (1x1)',
      '2h', '2x1 Dual Horizontal', 'دو چارت افقی (2x1)',
      '2v', '1x2 Dual Vertical', 'دو چارت عمودی (1x2)',
      '4', '2x2 Quad Grid', 'چهار چارت مربعی (2x2)',
      'g1x3', '3x1 Triple Horizontal', 'سه چارت افقی (3x1)',
      'g3x1', '1x3 Triple Vertical', 'سه چارت عمودی (1x3)',
      'g2x3', '3x2 Six-Chart Matrix', 'شش چارت ماتریسی (3x2)',
      '8', '4x2 Institutional Matrix', 'هشت چارت نهادی (4x2)',
      preset?.nameEn, preset?.nameFa
    ]);

    let targetNameEn = this.activeLayoutName;
    let targetNameFa = this.activeLayoutName;

    // Only fallback to preset name if active layout name is empty or a generic preset default
    if (!this.activeLayoutName || genericNames.has(this.activeLayoutName)) {
      targetNameEn = preset ? preset.nameEn : (this.activeLayoutName || '1x1 Single Chart');
      targetNameFa = preset ? preset.nameFa : (this.activeLayoutName || 'تک‌چارت (1x1)');
    }

    const badgeText = count === 1 ? '1 Chart' : `${count} Charts`;
    const badgeFa = count === 1 ? '۱ چارت' : `${toPersianDigits(count)} چارت`;
    const state = this.captureWorkspaceState();

    // Check if we are updating an existing saved layout
    let targetIdx = -1;
    if (this.activeSavedLayoutId) {
      const existing = this.savedLayouts.find(l => l.id === this.activeSavedLayoutId);
      // Only treat as update if the saved layout has matching name or matching layoutId
      if (existing && (existing.name === targetNameEn || existing.nameFa === targetNameFa || existing.layoutId === this.activeLayoutId)) {
        targetIdx = this.savedLayouts.indexOf(existing);
      }
    }
    if (targetIdx === -1) {
      targetIdx = this.savedLayouts.findIndex(l => l.name === targetNameEn || l.nameFa === targetNameFa || l.name === targetNameFa);
    }

    if (targetIdx !== -1) {
      const existing = this.savedLayouts[targetIdx];
      existing.name = targetNameEn;
      existing.nameFa = targetNameFa;
      existing.layoutId = this.activeLayoutId;
      existing.badge = badgeText;
      existing.badgeFa = badgeFa;
      existing.sync = { ...this.syncOpts };
      existing.state = state;
      existing.date = new Date().toISOString().split('T')[0];
      this.activeSavedLayoutId = existing.id;
    } else {
      const newId = 'usr_' + Date.now();
      this.activeSavedLayoutId = newId;
      this.savedLayouts.unshift({
        id: newId,
        name: targetNameEn,
        nameFa: targetNameFa,
        layoutId: this.activeLayoutId,
        badge: badgeText,
        badgeFa: badgeFa,
        sync: { ...this.syncOpts },
        state,
        date: new Date().toISOString().split('T')[0]
      });
    }

    this.saveSavedLayouts();
    this.persistCurrentLayout();

    this.app?.showExecutionToast?.(isFa ? 'چیدمان' : 'LAYOUT', 1, this.activeLayoutName);

    setTimeout(() => {
      if (label) label.innerText = isFa ? 'ذخیره' : 'Save';
      if (saveBtn) {
        saveBtn.style.borderColor = '';
        saveBtn.style.color = '';
      }
    }, 2000);
  }

  setLayout(layoutId, layoutName, opts = {}) {
    const norm = String(layoutId || '1').toLowerCase();
    const resolvedLayoutId = norm === '2x2' ? '4' : (norm === '1x1' ? '1' : norm);
    layoutId = resolvedLayoutId;

    this.activeLayoutId = layoutId;
    if (layoutName) {
      this.activeLayoutName = layoutName;
    } else if (!this.activeLayoutName) {
      const preset = DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === layoutId);
      this.activeLayoutName = preset ? preset.nameEn : '1x1 Single Chart';
    }
    if (opts.savedLayoutId !== undefined) {
      this.activeSavedLayoutId = opts.savedLayoutId;
    } else {
      this.activeSavedLayoutId = null;
    }
    this.updateTopbarLabel();

    if (this.app?.chartManager) {
      this.app.chartManager.setLayout(layoutId);

      if (layoutId !== '1') {
        this.app?.minimizeQuickTrade?.();
      } else {
        this.app?.restoreQuickTrade?.();
      }

      if (opts.state) {
        const applyFull = async () => {
          const ok = await this.applyWorkspaceState(opts.state);
          if (ok && this.app?.showToast && opts.stateName) {
            const isFa = getLanguage() === 'fa';
            this.app.showToast(isFa ? `ستاپ «${opts.stateName}» با موفقیت بازیابی شد` : `Layout "${opts.stateName}" restored`, 'success');
          }
          if (!opts.skipPersist) {
            this.persistCurrentLayout();
          }
          this.bindWorkspaceCellListeners();
          this.updateCellStrip();
        };
        const expected = (DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === layoutId)?.cols || 1) *
                         (DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === layoutId)?.rows || 1);
        let tries = 0;
        const waitThenApply = () => {
          const count = this.app.chartManager.workspace?.cellsById?.size || 1;
          if (count >= expected || tries++ > 35) { applyFull(); return; }
          setTimeout(waitThenApply, 100);
        };
        setTimeout(waitThenApply, 200);
        window.dispatchEvent(new Event('resize'));
        return;
      }

      if (layoutId !== '1') {
        const expected = (DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === layoutId)?.cols || 1) *
                         (DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === layoutId)?.rows || 1);
        const assign = () => {
          const ws = this.app.chartManager.workspace;
          const cells = Array.from(ws?.cellsById?.values() || []);
          const defaultSymbols = ['universal:BTCUSDT', 'universal:ETHUSDT', 'universal:SOLUSDT', 'universal:BNBUSDT', 'universal:XAUUSD', 'universal:EURUSD'];
          cells.forEach((cell, idx) => {
            if (idx > 0 && defaultSymbols[idx] && cell.setSymbol) {
              cell.setSymbol(defaultSymbols[idx]);
            }
          });
          this.bindWorkspaceCellListeners();
          this.updateCellStrip();
          if (!opts.skipPersist) {
            setTimeout(() => this.persistCurrentLayout(), 400);
          }
        };
        let tries = 0;
        const waitForCells = () => {
          const count = this.app.chartManager.workspace?.cellsById?.size || 0;
          if (count >= expected || tries++ > 40) { assign(); return; }
          setTimeout(waitForCells, 100);
        };
        setTimeout(waitForCells, 200);
      } else {
        this.bindWorkspaceCellListeners();
        this.updateCellStrip();
        if (!opts.skipPersist) {
          setTimeout(() => this.persistCurrentLayout(), 300);
        }
      }
    }
    window.dispatchEvent(new Event('resize'));
  }

  toggleSync(kind, enabled) {
    this.syncOpts[kind] = enabled;
    localStorage.setItem('tradingchart_layout_sync', JSON.stringify(this.syncOpts));
    const ws = this.app?.chartManager?.workspace;
    if (ws?.sync) {
      ws.sync.set(kind, enabled);
    }
  }

  applyAllSyncOptions() {
    const ws = this.app?.chartManager?.workspace;
    if (!ws?.sync) return;
    for (const [kind, enabled] of Object.entries(this.syncOpts)) {
      try {
        ws.sync.set(kind, !!enabled);
      } catch (e) {}
    }
  }

  toggleMaximizeActiveCell() {
    const ws = this.app?.chartManager?.workspace;
    if (!ws) return;
    if (ws.maximizedId) {
      ws.clearMaximized();
      this.isMaximizedCell = false;
    } else {
      const targetId = ws.active?.id || (ws.cellsById && ws.cellsById.size > 0 ? ws.cellsById.keys().next().value : null);
      if (targetId) {
        ws.maximizeCell(targetId);
        this.isMaximizedCell = true;
      }
    }
    this.updateCellStrip();
  }

  setupCellStrip() {
    let strip = document.querySelector('#multi-chart-cell-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'multi-chart-cell-strip';
      const chartArea = document.querySelector('#chart-area');
      if (chartArea) {
        chartArea.appendChild(strip);
      }
    }
    this.updateCellStrip();
  }

  updateCellStrip() {
    const strip = document.querySelector('#multi-chart-cell-strip');
    if (!strip) return;

    if (this.activeLayoutId === '1') {
      strip.style.display = 'none';
      strip.innerHTML = '';
      return;
    }

    strip.style.display = 'flex';
    const isFa = getLanguage() === 'fa';
    const ws = this.app?.chartManager?.workspace;
    const cells = Array.from(ws?.cellsById?.values() || []);
    const isGridMaximized = !!ws?.maximizedId;

    strip.innerHTML = `
      <button class="cell-strip-pill overview-pill ${!isGridMaximized ? 'active' : ''}" id="btn-strip-overview" title="${isFa ? 'نمایش تمام چارت‌ها در گرید' : 'View all charts in grid'}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <span>${isFa ? 'گرید کامل' : 'All Grid'}</span>
      </button>
      ${cells.map((cell, idx) => {
        const isActive = ws?.active === cell;
        const isMaxed = ws?.maximizedId === cell.id;
        const sym = (cell.symbol || 'BTCUSDT').replace(/^.*:/, '');
        const tf = cell.timeframe || '15m';
        return `
          <button class="cell-strip-pill ${(isActive || isMaxed) ? 'active' : ''}" data-cell-id="${cell.id}" title="${isFa ? `فوکوس روی چارت ${idx + 1}` : `Focus Chart ${idx + 1}`}">
            <span style="font-weight: 800; color: var(--accent-cyan);">#${idx + 1}</span>
            <span style="font-weight: 700;">${sym}</span>
            <span style="font-size: 10px; opacity: 0.8;" class="num-ltr">${tf}</span>
          </button>
        `;
      }).join('')}
      <button class="cell-strip-pill action-pill ${isGridMaximized ? 'active' : ''}" id="btn-strip-toggle-max" title="${isFa ? 'بزرگنمایی چارت فعال (Alt+Enter)' : 'Maximize Active Chart (Alt+Enter)'}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        <span>${isGridMaximized ? (isFa ? 'خروج از زوم' : 'Restore') : (isFa ? 'تمام‌صفحه' : 'Maximize')}</span>
      </button>
    `;

    strip.querySelector('#btn-strip-overview')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ws?.clearMaximized?.();
      this.updateCellStrip();
    });

    strip.querySelector('#btn-strip-toggle-max')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximizeActiveCell();
    });

    strip.querySelectorAll('[data-cell-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cid = btn.getAttribute('data-cell-id');
        if (cid) {
          ws?.setActiveCell?.(cid);
          // On mobile, tap maximizes that cell for full touch control
          if (window.innerWidth <= 768) {
            ws?.maximizeCell?.(cid);
          }
          this.updateCellStrip();
        }
      });
    });
  }

  openLayoutStudio() {
    let modal = document.querySelector('#modal-layout-studio');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-layout-studio';
      modal.className = 'modal-overlay layout-manager-menu layout-dropdown';
      document.body.appendChild(modal);
    } else {
      modal.classList.add('layout-manager-menu', 'layout-dropdown');
    }

    const isFa = getLanguage() === 'fa';

    // Filter and Sort saved layouts
    let filteredLayouts = [...this.savedLayouts];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      filteredLayouts = filteredLayouts.filter(l => 
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.nameFa && l.nameFa.toLowerCase().includes(q)) ||
        (l.badge && l.badge.toLowerCase().includes(q))
      );
    }

    if (this.sortBy === 'name') {
      filteredLayouts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      filteredLayouts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    modal.innerHTML = `
      <div class="modal-box layout-studio-modal" style="max-width: 680px; width: 95vw; background: #0c1017; border: 1px solid #1f293d; border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.8); overflow: hidden; display: flex; flex-direction: column; ${isFa ? 'font-family: var(--font-vazirmatn), sans-serif;' : ''}">
        
        <!-- Modal Header with correct RTL/LTR symmetry -->
        <div class="modal-header" style="padding: 14px 18px; background: #080b11; border-bottom: 1px solid #1c263c; display: flex; justify-content: space-between; align-items: center; ${isFa ? 'direction: rtl;' : 'direction: ltr;'}">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #fff;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan);"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            <span>${isFa ? 'استودیو و مدیریت چیدمان چندچارته' : 'TradingView Multi-Chart Layout Studio'}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Auto-save toggle pill -->
            <button id="btn-toggle-autosave" style="background: ${this.autoSaveEnabled ? 'rgba(0, 242, 176, 0.12)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${this.autoSaveEnabled ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; color: ${this.autoSaveEnabled ? 'var(--accent-cyan)' : 'var(--text-dim)'}; border-radius: 20px; font-size: 10px; font-weight: 700; padding: 3px 8px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <span>⚡</span>
              <span>${isFa ? (this.autoSaveEnabled ? 'ذخیره خودکار: فعال' : 'ذخیره خودکار: غیرفعال') : (this.autoSaveEnabled ? 'Auto-save: ON' : 'Auto-save: OFF')}</span>
            </button>
            <button class="modal-close-btn" id="btn-close-layout-studio" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: var(--text-dim); cursor: pointer; width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Modal Body -->
        <div style="padding: 16px; overflow-y: auto; max-height: 75vh; display: flex; flex-direction: column; gap: 16px; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
          
          <!-- Section 1: Visual Grid Layout Presets -->
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span>${isFa ? 'انتخاب گرید چیدمان چندچارته' : 'Select Multi-Chart Grid Layout'}</span>
              <span style="font-size: 11px; color: var(--accent-cyan); font-weight: 600;">${isFa ? 'پشتیبانی تا ۸ چارت همزمان' : 'Up to 8 Charts'}</span>
            </div>

            <div class="layout-preset-grid-responsive">
              ${DEFAULT_LAYOUT_PRESETS.map(preset => {
                const isActive = preset.layoutId === this.activeLayoutId;
                // TradingView-parity plan gate: charts-per-tab entitlement.
                const cells = preset.cols * preset.rows;
                const gate = this.app?.auth?.check('chartsPerTab', 0);
                const maxCharts = gate ? gate.limit : cells;
                const locked = this.app?.auth && maxCharts !== -1 && cells > maxCharts;
                return `
                  <button class="layout-preset-card ${isActive ? 'active' : ''}" data-layout="${preset.layoutId}" data-name="${preset.nameEn}" ${locked ? `data-locked="1" title="${isFa ? 'نیازمند ارتقای پلن' : 'Requires plan upgrade'}"` : ''} style="background: ${isActive ? 'rgba(0, 242, 176, 0.08)' : 'var(--bg-card)'}; border: 1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; border-radius: 8px; padding: 10px; cursor: ${locked ? 'not-allowed' : 'pointer'}; text-align: ${isFa ? 'right' : 'left'}; display: flex; flex-direction: column; gap: 6px; transition: all 0.15s ease; ${locked ? 'opacity: 0.55; position: relative;' : ''}">
                    ${locked ? `<div style="position:absolute; top:6px; ${isFa ? 'left' : 'right'}:8px; font-size:9px; background:rgba(245,158,11,0.15); color:#f59e0b; padding:2px 7px; border-radius:10px; font-weight:700;">🔒 ${isFa ? 'ارتقا' : 'PRO'}</div>` : ''}
                    <!-- Grid Visual Matrix -->
                    <div style="display: grid; grid-template-columns: repeat(${preset.cols}, 1fr); grid-template-rows: repeat(${preset.rows}, 1fr); gap: 3px; height: 38px; width: 100%; background: #06090e; padding: 4px; border-radius: 4px; box-sizing: border-box; direction: ltr !important;">
                      ${Array.from({ length: preset.cols * preset.rows }).map(() => `
                        <div style="background: ${isActive ? 'rgba(0, 242, 176, 0.22)' : 'rgba(38, 51, 77, 0.45)'}; border: 1.5px dashed ${isActive ? 'var(--accent-cyan)' : '#334155'}; border-radius: 2px;"></div>
                      `).join('')}
                    </div>
                    <div>
                      <div style="font-weight: 700; font-size: 12px; color: ${isActive ? 'var(--accent-cyan)' : '#fff'};">${isFa ? preset.nameFa : preset.nameEn}</div>
                      <div style="font-size: 10px; color: #94a3b8; margin-top: 2px; line-height: 1.3;">${isFa ? preset.descFa : preset.descEn}</div>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 2: 6-Axis Multi-Chart Synchronization Switches -->
          <div style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 12px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span>${isFa ? 'همگام‌سازی جامع ۶ محوره چارت‌ها (Sync in Layout)' : '6-Axis Multi-Chart Synchronization Settings'}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-bottom: 12px;">
              ${isFa ? 'تعیین کنید چه ویژگی‌هایی میان پنجره‌های چارت همگام باشند (تغییر نماد، تایم‌فریم، ماوس، محدوده زوم، ابزارهای رسم و استایل):' : 'Configure which parameters mirror across all chart panes in the active multi-grid:'}
            </div>

            <div class="layout-sync-grid-responsive">
              ${[
                { key: 'symbol', labelEn: 'Symbol', labelFa: 'نماد دارایی' },
                { key: 'timeframe', labelEn: 'Interval', labelFa: 'تایم‌فریم' },
                { key: 'crosshair', labelEn: 'Crosshair', labelFa: 'کراس‌هیر ماوس' },
                { key: 'viewport', labelEn: 'Time & Zoom', labelFa: 'زمان و زوم' },
                { key: 'drawings', labelEn: 'Drawings', labelFa: 'ابزارهای ترسیمی' },
                { key: 'style', labelEn: 'Chart Style', labelFa: 'استایل کندل' }
              ].map(item => {
                const isOn = !!this.syncOpts[item.key];
                return `
                  <button class="sync-switch-btn ${isOn ? 'active' : ''}" data-sync="${item.key}" style="background: ${isOn ? 'rgba(0, 242, 176, 0.12)' : 'var(--bg-surface)'}; border: 1px solid ${isOn ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; border-radius: 6px; padding: 8px 10px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #fff;">
                    <span style="font-weight: 600;">${isFa ? item.labelFa : item.labelEn}</span>
                    <div class="sync-switch-track" style="width: 28px; height: 16px; border-radius: 8px; background: ${isOn ? 'var(--accent-cyan)' : '#26334d'}; position: relative; transition: all 0.2s ease; display: inline-flex; align-items: center; padding: 2px; box-sizing: border-box;">
                      <div class="sync-switch-thumb" style="width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: all 0.2s ease; transform: ${isOn ? (isFa ? 'translateX(-12px)' : 'translateX(12px)') : 'translateX(0)'};"></div>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 3: Saved Custom Layouts with Search & Sort -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="font-size: 12px; font-weight: 700; color: var(--text-muted);">
                <span>${isFa ? 'چیدمان‌های ذخیره‌شده کاربر' : 'Saved User Layouts'}</span>
                <span id="saved-layouts-count">(${filteredLayouts.length})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button id="btn-sort-date" class="btn-secondary" style="font-size: 10px; padding: 3px 8px; ${this.sortBy === 'date' ? 'color: var(--accent-cyan); border-color: var(--accent-cyan);' : ''}">${isFa ? 'تاریخ' : 'Date'}</button>
                <button id="btn-sort-name" class="btn-secondary" style="font-size: 10px; padding: 3px 8px; ${this.sortBy === 'name' ? 'color: var(--accent-cyan); border-color: var(--accent-cyan);' : ''}">${isFa ? 'نام' : 'Name'}</button>
              </div>
            </div>

            <!-- Search filter -->
            <div style="margin-bottom: 8px;">
              <input type="text" id="layout-search-input" value="${this.searchQuery}" placeholder="${isFa ? 'جستجو در نام و مشخصات چیدمان‌ها...' : 'Search layouts by name...'}" style="width: 100%; box-sizing: border-box; padding: 6px 12px; font-size: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff; outline: none;" />
            </div>

            <div class="layout-save-action-row">
              <input type="text" id="new-layout-name-input" value="${isFa ? (DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === this.activeLayoutId)?.nameFa || this.activeLayoutName) : (DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === this.activeLayoutId)?.nameEn || this.activeLayoutName)}" placeholder="${isFa ? 'نام چیدمان جدید...' : 'New Layout Name...'}" style="flex: 1; padding: 6px 12px; font-size: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;" />
              <div class="layout-save-btn-group">
                <button id="btn-save-as-new-layout" class="btn-primary" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 14px; font-size: 12px; white-space: nowrap; cursor: pointer;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  <span>${isFa ? 'ذخیره چیدمان جاری' : 'Save Current'}</span>
                </button>
                <button id="btn-import-layout" class="btn-secondary" title="${isFa ? 'ورود چیدمان از فایل JSON' : 'Import layout JSON'}" style="padding: 6px 10px; font-size: 12px; white-space: nowrap; cursor: pointer;">
                  ⤒ ${isFa ? 'ورود' : 'Import'}
                </button>
                <input type="file" id="import-layout-file" accept=".json,application/json" style="display:none;" />
              </div>
            </div>

            <div class="saved-layouts-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
              ${this.renderSavedLayoutsList(isFa)}
            </div>
          </div>

        </div>
      </div>
    `;

    modal.classList.add('open');

    // Bind Close
    const close = () => modal.classList.remove('open');
    modal.querySelector('#btn-close-layout-studio')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    // Bind Auto-Save Toggle (Updates button UI directly without closing modal)
    modal.querySelector('#btn-toggle-autosave')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.autoSaveEnabled = !this.autoSaveEnabled;
      localStorage.setItem('tradingchart_layout_autosave', String(this.autoSaveEnabled));
      if (this.autoSaveEnabled) {
        this.executeAutoSave();
        this.setupAutoSave();
      } else {
        if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
      }
      const btn = modal.querySelector('#btn-toggle-autosave');
      if (btn) {
        btn.style.background = this.autoSaveEnabled ? 'rgba(0, 242, 176, 0.12)' : 'rgba(255,255,255,0.05)';
        btn.style.borderColor = this.autoSaveEnabled ? 'var(--accent-cyan)' : 'var(--border-subtle)';
        btn.style.color = this.autoSaveEnabled ? 'var(--accent-cyan)' : 'var(--text-dim)';
        btn.innerHTML = `<span>⚡</span><span>${isFa ? (this.autoSaveEnabled ? 'ذخیره خودکار: فعال' : 'ذخیره خودکار: غیرفعال') : (this.autoSaveEnabled ? 'Auto-save: ON' : 'Auto-save: OFF')}</span>`;
      }
    });

    // Bind Search Input with TARGETED DOM FILTERING (Zero focus loss, Zero IME glitch)
    const searchInput = modal.querySelector('#layout-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      const list = modal.querySelector('.saved-layouts-list');
      if (list) {
        list.innerHTML = this.renderSavedLayoutsList(isFa);
        this.bindSavedLayoutRowEvents(modal, isFa);
        this.updateSavedLayoutsCount();
      }
    });

    // Bind Sort buttons (Targeted list re-render)
    modal.querySelector('#btn-sort-date')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sortBy = 'date';
      modal.querySelector('#btn-sort-date').style.color = 'var(--accent-cyan)';
      modal.querySelector('#btn-sort-date').style.borderColor = 'var(--accent-cyan)';
      modal.querySelector('#btn-sort-name').style.color = '';
      modal.querySelector('#btn-sort-name').style.borderColor = '';
      const list = modal.querySelector('.saved-layouts-list');
      if (list) {
        list.innerHTML = this.renderSavedLayoutsList(isFa);
        this.bindSavedLayoutRowEvents(modal, isFa);
      }
    });

    modal.querySelector('#btn-sort-name')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sortBy = 'name';
      modal.querySelector('#btn-sort-name').style.color = 'var(--accent-cyan)';
      modal.querySelector('#btn-sort-name').style.borderColor = 'var(--accent-cyan)';
      modal.querySelector('#btn-sort-date').style.color = '';
      modal.querySelector('#btn-sort-date').style.borderColor = '';
      const list = modal.querySelector('.saved-layouts-list');
      if (list) {
        list.innerHTML = this.renderSavedLayoutsList(isFa);
        this.bindSavedLayoutRowEvents(modal, isFa);
      }
    });

    // Bind Grid Preset Clicks
    modal.querySelectorAll('.layout-preset-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const layoutId = card.getAttribute('data-layout');
        const name = card.getAttribute('data-name');
        // TradingView-parity plan gate: locked grid presets upsell instead of switching.
        if (card.getAttribute('data-locked') === '1') {
          const preset = DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === layoutId);
          const cells = (preset?.cols || 1) * (preset?.rows || 1);
          this.app?.auth?.enforce('chartsPerTab', cells - 1, `${cells} charts per tab`, `${cells} چارت در هر تب`);
          this.app?.auth?.openPlansModal?.();
          return;
        }
        this.setLayout(layoutId, name);
        close();
      });
    });

    // Bind Sync Switches (Toggles button and workspace state cleanly)
    modal.querySelectorAll('.sync-switch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const syncType = btn.getAttribute('data-sync');
        const nextState = !this.syncOpts[syncType];
        this.toggleSync(syncType, nextState);
        btn.classList.toggle('active', nextState);
        btn.style.background = nextState ? 'rgba(0, 242, 176, 0.12)' : 'var(--bg-surface)';
        btn.style.borderColor = nextState ? 'var(--accent-cyan)' : 'var(--border-subtle)';
        btn.style.color = nextState ? '#fff' : 'var(--text-dim)';
        const track = btn.querySelector('.sync-switch-track');
        const thumb = btn.querySelector('.sync-switch-thumb');
        if (track) track.style.background = nextState ? 'var(--accent-cyan)' : '#26334d';
        if (thumb) thumb.style.transform = nextState ? (isFa ? 'translateX(-12px)' : 'translateX(12px)') : 'translateX(0)';
      });
    });

    // Bind Save New Layout
    modal.querySelector('#btn-save-as-new-layout')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isFaLang = getLanguage() === 'fa';
      const input = modal.querySelector('#new-layout-name-input');
      const name = (input?.value.trim() || `Layout ${this.activeLayoutId.toUpperCase()}`).replace(/×/g, 'x');
      const isNewName = !this.savedLayouts.some(l => l.name === name || l.nameFa === name);
      if (isNewName && this.app?.auth && !this.app.auth.enforce('savedLayouts', this.getUserSavedLayoutsCount(), 'saved layouts', 'چیدمان‌های ذخیره‌شده')) {
        return;
      }
      this.activeLayoutName = name;
      this.updateTopbarLabel();

      const preset = DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === this.activeLayoutId);
      const count = preset ? preset.cols * preset.rows : 1;
      const badgeText = count === 1 ? '1 Chart' : `${count} Charts`;
      const badgeFa = count === 1 ? '۱ چارت' : `${toPersianDigits(count)} چارت`;

      const newId = 'usr_' + Date.now();
      this.activeSavedLayoutId = newId;
      this.savedLayouts = this.savedLayouts.filter(l => l.name !== name && l.nameFa !== name);
      this.savedLayouts.unshift({
        id: newId,
        name,
        nameFa: name,
        layoutId: this.activeLayoutId,
        badge: badgeText,
        badgeFa: badgeFa,
        sync: { ...this.syncOpts },
        state: this.captureWorkspaceState(),
        date: new Date().toISOString().split('T')[0]
      });
      this.saveSavedLayouts();
      this.persistCurrentLayout();
      const list = modal.querySelector('.saved-layouts-list');
      if (list) {
        list.innerHTML = this.renderSavedLayoutsList(isFaLang);
        this.bindSavedLayoutRowEvents(modal, isFaLang);
        this.updateSavedLayoutsCount();
      }
      this.app?.showToast?.(isFaLang ? 'چیدمان با موفقیت ذخیره شد' : 'Layout saved', 'success');
    });

    // Import — read JSON file
    modal.querySelector('#btn-import-layout')?.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.querySelector('#import-layout-file')?.click();
    });

    modal.querySelector('#import-layout-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const imported = this.importLayout(String(reader.result || ''), { enforcePlan: true });
        if (imported) {
          this.app?.showToast?.(isFa ? 'چیدمان با موفقیت وارد شد' : 'Layout imported', 'success');
          const list = modal.querySelector('.saved-layouts-list');
          if (list) {
            list.innerHTML = this.renderSavedLayoutsList(isFa);
            this.bindSavedLayoutRowEvents(modal, isFa);
            this.updateSavedLayoutsCount();
          }
        } else {
          this.app?.showToast?.(isFa ? 'فایل چیدمان نامعتبر است' : 'Invalid layout file', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Bind saved layout rows
    this.bindSavedLayoutRowEvents(modal, isFa);
  }

  updateSavedLayoutsCount() {
    const el = document.querySelector('#saved-layouts-count');
    if (!el) return;
    let count = this.savedLayouts.length;
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      count = this.savedLayouts.filter(l => 
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.nameFa && l.nameFa.toLowerCase().includes(q)) ||
        (l.badge && l.badge.toLowerCase().includes(q))
      ).length;
    }
    el.innerText = `(${count})`;
  }

  renderSavedLayoutsList(isFa) {
    let filteredLayouts = [...this.savedLayouts];
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      filteredLayouts = filteredLayouts.filter(l => 
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.nameFa && l.nameFa.toLowerCase().includes(q)) ||
        (l.badge && l.badge.toLowerCase().includes(q))
      );
    }

    if (this.sortBy === 'name') {
      filteredLayouts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      filteredLayouts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    if (filteredLayouts.length === 0) {
      return `
        <div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 11px;">
          ${isFa ? 'هیچ چیدمانی با این عبارت یافت نشد.' : 'No matching layouts found.'}
        </div>
      `;
    }

    const escapeHtml = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return filteredLayouts.map(l => {
      const isCurrent = (this.activeSavedLayoutId && l.id === this.activeSavedLayoutId) ||
        (l.layoutId === this.activeLayoutId && (l.name === this.activeLayoutName || l.nameFa === this.activeLayoutName));
      const rawTitle = (isFa ? (l.nameFa || l.name) : l.name).replace(/×/g, 'x');
      const safeTitle = escapeHtml(rawTitle);
      return `
      <div class="saved-layout-card ${isCurrent ? 'active' : ''}">
        <div class="saved-layout-card-header">
          <span style="font-size: 10px; font-weight: 800; color: var(--accent-cyan); background: rgba(0,242,176,0.1); border: 1px solid rgba(0,242,176,0.2); padding: 2px 8px; border-radius: 4px; flex-shrink: 0;">
            ${isFa ? (l.badgeFa || l.badge || 'چارت') : (l.badge === '1 Charts' ? '1 Chart' : (l.badge || 'Grid'))}
          </span>
          <span style="font-weight: 700; font-size: 12px; color: ${isCurrent ? 'var(--accent-cyan)' : '#fff'}; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeTitle}</span>
          ${isCurrent ? `<span style="font-size: 9px; font-weight: 800; color: #000; background: var(--accent-cyan); padding: 1px 6px; border-radius: 10px; flex-shrink: 0;">${isFa ? 'فعال' : 'ACTIVE'}</span>` : ''}
          <span style="font-size: 10px; color: var(--text-dim); flex-shrink: 0;" class="num-ltr">${l.date}</span>
        </div>
        <div class="saved-layout-card-actions">
          <button class="btn-secondary btn-load-layout" data-id="${l.id}" data-layout="${l.layoutId}" data-name="${escapeHtml(l.name)}" style="padding: 4px 12px; font-size: 11px; font-weight: 600; ${isCurrent ? 'border-color: var(--accent-cyan); color: var(--accent-cyan);' : ''}">
            ${isFa ? 'بارگذاری' : 'Load'}
          </button>
          <button class="btn-secondary btn-rename-layout" data-id="${l.id}" data-name="${escapeHtml(rawTitle)}" title="${isFa ? 'تغییر نام' : 'Rename'}" style="padding: 4px 8px; font-size: 11px;">✏️</button>
          <button class="btn-secondary btn-dup-layout" data-id="${l.id}" title="${isFa ? 'تکثیر' : 'Duplicate'}" style="padding: 4px 8px; font-size: 11px;">⧉</button>
          <button class="btn-secondary btn-export-layout" data-id="${l.id}" title="${isFa ? 'خروجی JSON' : 'Export JSON'}" style="padding: 4px 8px; font-size: 11px;">⤓</button>
          <button class="btn-secondary btn-del-layout" data-id="${l.id}" data-name="${escapeHtml(rawTitle)}" title="${isFa ? 'حذف این چیدمان' : 'Delete Layout'}" style="padding: 4px 9px; font-size: 11px; color: #f87171; border-color: rgba(239,68,68,0.3);">
            ✕
          </button>
        </div>
      </div>
    `;
    }).join('');
  }

  bindSavedLayoutRowEvents(modal, isFa) {
    const close = () => modal.classList.remove('open');

    // Bind Load
    modal.querySelectorAll('.btn-load-layout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layoutId = btn.getAttribute('data-layout');
        const name = btn.getAttribute('data-name');
        const id = btn.getAttribute('data-id');
        const saved = this.savedLayouts.find(l => l.id === id);
        if (saved?.sync) {
          this.syncOpts = { ...this.syncOpts, ...saved.sync };
          try { localStorage.setItem('tradingchart_layout_sync', JSON.stringify(this.syncOpts)); } catch (err) {}
          this.applyAllSyncOptions();
        }
        this.activeSavedLayoutId = id;
        this.setLayout(layoutId, name, {
          state: saved?.state,
          stateName: name,
          savedLayoutId: id
        });
        close();
      });
    });

    // Rename — custom modal dialog (Zero window.prompt)
    modal.querySelectorAll('.btn-rename-layout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const cur = btn.getAttribute('data-name') || '';
        showPromptDialog({
          title: isFa ? 'تغییر نام چیدمان' : 'Rename Layout',
          message: isFa ? 'نام جدید چیدمان مورد نظر را وارد نمایید:' : 'Enter the new name for this layout setup:',
          defaultValue: cur,
          placeholder: isFa ? 'نام چیدمان...' : 'Layout name...',
          confirmText: isFa ? 'ذخیره نام' : 'Save Name',
          cancelText: isFa ? 'انصراف' : 'Cancel',
          onConfirm: (newName) => {
            if (newName && newName.trim()) {
              this.renameLayout(id, newName.trim());
              const list = modal.querySelector('.saved-layouts-list');
              if (list) {
                list.innerHTML = this.renderSavedLayoutsList(isFa);
                this.bindSavedLayoutRowEvents(modal, isFa);
                this.updateSavedLayoutsCount();
              }
            }
          }
        });
      });
    });

    // Duplicate
    modal.querySelectorAll('.btn-dup-layout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dup = this.duplicateLayout(btn.getAttribute('data-id'), { enforcePlan: true });
        if (!dup) return;
        const list = modal.querySelector('.saved-layouts-list');
        if (list) {
          list.innerHTML = this.renderSavedLayoutsList(isFa);
          this.bindSavedLayoutRowEvents(modal, isFa);
          this.updateSavedLayoutsCount();
        }
        this.app?.showToast?.(isFa ? 'چیدمان با موفقیت تکثیر گردید' : 'Layout duplicated', 'success');
      });
    });

    // Export — download JSON
    modal.querySelectorAll('.btn-export-layout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const json = this.exportLayout(btn.getAttribute('data-id'));
        if (!json) return;
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `tradingchart_layout_${btn.getAttribute('data-id')}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
    });

    // Delete with custom modal dialog (Zero window.confirm)
    modal.querySelectorAll('.btn-del-layout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name') || '';
        showConfirmDialog({
          title: isFa ? 'حذف چیدمان' : 'Delete Layout',
          message: isFa 
            ? `آیا از حذف دائمی چیدمان «${name}» اطمینان دارید؟ این عمل غیرقابل بازگشت است.`
            : `Are you sure you want to permanently delete layout "${name}"? This action cannot be undone.`,
          confirmText: isFa ? 'حذف چیدمان' : 'Delete Layout',
          cancelText: isFa ? 'انصراف' : 'Cancel',
          danger: true,
          onConfirm: () => {
            if (this.activeSavedLayoutId === id) {
              this.activeSavedLayoutId = null;
            }
            this.savedLayouts = this.savedLayouts.filter(l => l.id !== id);
            this.saveSavedLayouts();
            this.persistCurrentLayout();
            const list = modal.querySelector('.saved-layouts-list');
            if (list) {
              list.innerHTML = this.renderSavedLayoutsList(isFa);
              this.bindSavedLayoutRowEvents(modal, isFa);
              this.updateSavedLayoutsCount();
            }
            this.app?.showToast?.(isFa ? 'چیدمان حذف گردید' : 'Layout deleted', 'success');
          }
        });
      });
    });
  }
}
