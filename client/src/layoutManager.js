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
    nameFa: 'چارت تک‌پنجره‌ای (1x1)',
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
    this.isMaximizedCell = false;
    this.searchQuery = '';
    this.sortBy = 'date'; // 'date' | 'name'
    
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

    this.savedLayouts = this.loadSavedLayouts();
    this.restoreCurrentLayout();
    this.initDOM();
    this.setupAutoSave();
    this.setupCellStrip();
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
        if (parsed.sync) this.syncOpts = { ...this.syncOpts, ...parsed.sync };
        setTimeout(() => {
          this.setLayout(parsed.layoutId, parsed.name, {
            state: parsed.state,
            skipSave: true
          });
          this.applyAllSyncOptions();
        }, 600);
      }
    } catch (e) {}
  }

  captureWorkspaceState() {
    try {
      const ws = this.app?.chartManager?.workspace;
      if (!ws || typeof ws.getState !== 'function') return null;
      return JSON.parse(JSON.stringify(ws.getState()));
    } catch (e) { return null; }
  }

  applyWorkspaceState(state) {
    try {
      const ws = this.app?.chartManager?.workspace;
      if (!ws || typeof ws.applyState !== 'function' || !state) return false;
      ws.applyState(state);
      this.updateCellStrip();
      return true;
    } catch (e) {
      console.warn('[Layout] applyState failed, falling back to grid-only:', e.message);
      return false;
    }
  }

  renameLayout(id, newName) {
    const l = this.savedLayouts.find(x => x.id === id);
    if (!l) return false;
    l.name = newName;
    l.nameFa = newName;
    this.saveSavedLayouts();
    if (this.activeLayoutId === l.layoutId) {
      this.activeLayoutName = newName;
      this.updateTopbarLabel();
    }
    return true;
  }

  duplicateLayout(id) {
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

  importLayout(json) {
    try {
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
    if (preset) {
      labelEl.innerText = isFa ? preset.nameFa : preset.nameEn;
    } else {
      labelEl.innerText = this.activeLayoutName;
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
    const state = this.captureWorkspaceState();
    if (!state) return false;
    
    // 1. Always persist the active workspace state for seamless reload recovery
    try {
      localStorage.setItem('tradingchart_current_layout', JSON.stringify({
        layoutId: this.activeLayoutId,
        name: this.activeLayoutName,
        state,
        sync: { ...this.syncOpts },
        timestamp: Date.now()
      }));
    } catch (e) {}

    // 2. If the active layout corresponds to a saved layout item, update its state too
    const activeIdx = this.savedLayouts.findIndex(l => l.layoutId === this.activeLayoutId && (l.name === this.activeLayoutName || l.nameFa === this.activeLayoutName));
    if (activeIdx !== -1) {
      this.savedLayouts[activeIdx].state = state;
      this.savedLayouts[activeIdx].date = new Date().toISOString().split('T')[0];
      this.saveSavedLayouts();
    }

    // 3. Briefly show subtle saving -> saved indicator
    this.flashAutoSaveStatus();
    return true;
  }

  setupAutoSave() {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    if (!this.autoSaveEnabled) return;
    this.autoSaveTimer = setInterval(() => {
      this.executeAutoSave();
    }, 25000);
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
    const layoutNameEn = preset ? preset.nameEn : this.activeLayoutName;
    const layoutNameFa = preset ? preset.nameFa : this.activeLayoutName;
    const badgeText = count === 1 ? '1 Chart' : `${count} Charts`;
    const badgeFa = count === 1 ? '۱ چارت' : `${toPersianDigits(count)} چارت`;
    const state = this.captureWorkspaceState();

    this.savedLayouts = this.savedLayouts.filter(l => l.name !== layoutNameEn);
    this.savedLayouts.unshift({
      id: 'usr_' + Date.now(),
      name: layoutNameEn,
      nameFa: layoutNameFa,
      layoutId: this.activeLayoutId,
      badge: badgeText,
      badgeFa: badgeFa,
      sync: { ...this.syncOpts },
      state,
      date: new Date().toISOString().split('T')[0]
    });
    this.saveSavedLayouts();

    // Also persist into active current layout
    try {
      localStorage.setItem('tradingchart_current_layout', JSON.stringify({
        layoutId: this.activeLayoutId,
        name: layoutNameEn,
        state,
        sync: { ...this.syncOpts }
      }));
    } catch (e) {}

    this.app.showExecutionToast(isFa ? 'چیدمان' : 'LAYOUT', 1, this.activeLayoutName);

    setTimeout(() => {
      if (label) label.innerText = isFa ? 'ذخیره' : 'Save';
      if (saveBtn) {
        saveBtn.style.borderColor = '';
        saveBtn.style.color = '';
      }
    }, 2000);
  }

  setLayout(layoutId, layoutName, opts = {}) {
    this.activeLayoutId = layoutId;
    if (layoutName) this.activeLayoutName = layoutName;
    if (!opts.skipPersist) {
      try { localStorage.setItem('tradingchart_current_layout', JSON.stringify({ layoutId, name: this.activeLayoutName })); } catch (e) {}
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
        const applyFull = () => {
          const ok = this.applyWorkspaceState(opts.state);
          if (ok && this.app?.showToast) {
            const isFa = getLanguage() === 'fa';
            this.app.showToast(isFa ? `ستاپ «${opts.stateName || ''}» با موفقیت بازیابی شد` : 'Full layout setup restored', 'success');
          }
          this.updateCellStrip();
        };
        const expected = (DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === layoutId)?.cols || 1) *
                         (DEFAULT_LAYOUT_PRESETS.find(p => p.layoutId === layoutId)?.rows || 1);
        let tries = 0;
        const waitThenApply = () => {
          const count = this.app.chartManager.workspace?.cellsById?.size || 1;
          if (count >= expected || tries++ > 30) { applyFull(); return; }
          setTimeout(waitThenApply, 150);
        };
        setTimeout(waitThenApply, 300);
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
          this.updateCellStrip();
        };
        let tries = 0;
        const waitForCells = () => {
          const count = this.app.chartManager.workspace?.cellsById?.size || 0;
          if (count >= expected || tries++ > 40) { assign(); return; }
          setTimeout(waitForCells, 150);
        };
        setTimeout(waitForCells, 300);
      } else {
        this.updateCellStrip();
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
            <button class="modal-close-btn" id="btn-close-layout-studio" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: var(--text-dim); cursor: pointer; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;">
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
                return `
                  <button class="layout-preset-card ${isActive ? 'active' : ''}" data-layout="${preset.layoutId}" data-name="${preset.nameEn}" style="background: ${isActive ? 'rgba(0, 242, 176, 0.08)' : 'var(--bg-card)'}; border: 1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; border-radius: 8px; padding: 10px; cursor: pointer; text-align: ${isFa ? 'right' : 'left'}; display: flex; flex-direction: column; gap: 6px; transition: all 0.15s ease;">
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
      const input = modal.querySelector('#new-layout-name-input');
      const name = (input?.value.trim() || `Layout ${this.activeLayoutId.toUpperCase()}`).replace(/×/g, 'x');
      this.savedLayouts = this.savedLayouts.filter(l => l.name !== name);
      this.savedLayouts.unshift({
        id: 'usr_' + Date.now(),
        name,
        nameFa: name,
        layoutId: this.activeLayoutId,
        badge: `${this.activeLayoutId.toUpperCase()} Grid`,
        badgeFa: `${this.activeLayoutId.toUpperCase()} گرید`,
        sync: { ...this.syncOpts },
        state: this.captureWorkspaceState(),
        date: new Date().toISOString().split('T')[0]
      });
      this.saveSavedLayouts();
      const list = modal.querySelector('.saved-layouts-list');
      if (list) {
        list.innerHTML = this.renderSavedLayoutsList(isFa);
        this.bindSavedLayoutRowEvents(modal, isFa);
        this.updateSavedLayoutsCount();
      }
      this.app?.showToast?.(isFa ? 'چیدمان با موفقیت ذخیره شد' : 'Layout saved', 'success');
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
        const imported = this.importLayout(String(reader.result || ''));
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
      const isCurrent = l.layoutId === this.activeLayoutId && (l.name === this.activeLayoutName || l.nameFa === this.activeLayoutName);
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
        this.setLayout(layoutId, name, saved?.state ? { state: saved.state, stateName: name } : {});
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
        this.duplicateLayout(btn.getAttribute('data-id'));
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
            this.savedLayouts = this.savedLayouts.filter(l => l.id !== id);
            this.saveSavedLayouts();
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
