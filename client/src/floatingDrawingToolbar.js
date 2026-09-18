// client/src/floatingDrawingToolbar.js
// Floating Favorite Drawing Tools Toolbar for TradingChart (TradingView Signature UX)
// Draggable, sleek glassmorphism dock providing 1-click access to canonical drawing tools,
// Magnet snapping, Lock drawings, Hide drawings, and Clear canvas tools.

import { getLanguage } from './i18n.js';

export class FloatingDrawingToolbar {
  constructor(app) {
    this.app = app;
    this.activeTool = null;
    this.magnetMode = false;
    this.isLocked = false;
    this.isHidden = false;
    this.isMinimized = false;
    this.pos = JSON.parse(localStorage.getItem('tradingchart_fav_toolbar_pos') || '{"top": 460, "left": 60}');

    this.mount();
  }

  mount() {
    let el = document.querySelector('#floating-drawing-toolbar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'floating-drawing-toolbar';
      el.className = 'floating-drawing-toolbar';
      const chartArea = document.querySelector('#chart-area') || document.body;
      chartArea.appendChild(el);
    }
    this.el = el;
    this.render();
    this.setupDraggable();
  }

  render() {
    const isFa = getLanguage() === 'fa';
    this.el.style.top = `${this.pos.top}px`;
    this.el.style.left = `${this.pos.left}px`;

    this.el.innerHTML = `
      <div class="fav-toolbar-inner ${this.isMinimized ? 'minimized' : ''}">
        <!-- Drag Handle -->
        <div class="fav-tool-drag-handle" title="${isFa ? 'جابجایی نوار ابزار' : 'Drag to reposition'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
        </div>

        <div class="fav-tools-list" style="${this.isMinimized ? 'display: none;' : 'display: flex; align-items: center; gap: 2px;'}">
          <!-- 1. Trendline -->
          <button class="fav-tool-btn" data-tool="trendline" title="${isFa ? 'خط روند (Alt+T)' : 'Trend Line (Alt+T)'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="1.5" fill="currentColor"/><circle cx="20" cy="4" r="1.5" fill="currentColor"/></svg>
          </button>

          <!-- 2. Horizontal Line -->
          <button class="fav-tool-btn" data-tool="hline" title="${isFa ? 'خط افقی (Alt+H)' : 'Horizontal Line (Alt+H)'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>
          </button>

          <!-- 3. Ray -->
          <button class="fav-tool-btn" data-tool="ray" title="${isFa ? 'نیم‌خط (Ray)' : 'Ray Line'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="20" x2="21" y2="6"/><circle cx="3" cy="20" r="1.6" fill="currentColor"/></svg>
          </button>

          <!-- 4. Fib Retracement -->
          <button class="fav-tool-btn" data-tool="fibretracement" title="${isFa ? 'فیبوناچی بازگشتی (Alt+F)' : 'Fib Retracement (Alt+F)'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="19" x2="21" y2="19"/></svg>
          </button>

          <!-- 5. Rectangle Box -->
          <button class="fav-tool-btn" data-tool="box" title="${isFa ? 'مستطیل / اردربلاک (Box)' : 'Rectangle / Order Block'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>
          </button>

          <!-- 6. Long/Short Position -->
          <button class="fav-tool-btn" data-tool="position" title="${isFa ? 'ابزار پوزیشن خرید/فروش (Alt+P)' : 'Long/Short Position (Alt+P)'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4.5" y="4.5" width="15" height="7.5" rx="1" fill="currentColor" fill-opacity="0.25"/><rect x="4.5" y="12" width="15" height="7.5" rx="1"/></svg>
          </button>

          <!-- 7. Measure / Ruler -->
          <button class="fav-tool-btn" data-tool="datepricerange" title="${isFa ? 'خط‌کش و محدوده درصد و زمان' : 'Measure / Date & Price Range'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 18 20 6" stroke-dasharray="2 2"/></svg>
          </button>

          <!-- 8. Brush -->
          <button class="fav-tool-btn" data-tool="freehand" title="${isFa ? 'قلم‌مو و ترسیم آزاد (Brush)' : 'Brush / Freehand'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.5 12 17 4.5a2.12 2.12 0 0 1 3 3L12.5 15"/><path d="M7 14a3 3 0 0 0-3 3c0 1.3-1.2 1.5-1.5 2 .8.9 2 1.5 3.5 1.5a3.5 3.5 0 0 0 3.5-3.5 3 3 0 0 0-2.5-3Z"/></svg>
          </button>

          <!-- 9. Text Annotation -->
          <button class="fav-tool-btn" data-tool="text" title="${isFa ? 'یادداشت متنی (Text)' : 'Text Annotation'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 6h14M12 6v13"/></svg>
          </button>

          <div class="fav-divider"></div>

          <!-- Magnet Mode Toggle -->
          <button id="fav-btn-magnet" class="fav-tool-btn ${this.magnetMode ? 'active' : ''}" title="${isFa ? 'حالت آهنربا (چسبیدن به اوپن/کلوز کندل)' : 'Magnet Mode (Snaps to OHLC)'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.35-6.35a2.9 2.9 0 0 0-4.1-4.1L5 14"/></svg>
          </button>

          <!-- Lock Drawings Toggle -->
          <button id="fav-btn-lock" class="fav-tool-btn ${this.isLocked ? 'active' : ''}" title="${isFa ? 'قفل کردن تمام ترسیم‌ها' : 'Lock All Drawings'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${this.isLocked ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' : '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'}</svg>
          </button>

          <!-- Hide / Show Drawings Toggle -->
          <button id="fav-btn-hide" class="fav-tool-btn ${this.isHidden ? 'active' : ''}" title="${isFa ? 'پنهان‌سازی تمام ترسیم‌ها' : 'Hide / Show All Drawings'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${this.isHidden ? '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>' : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'}</svg>
          </button>

          <!-- Clear All Drawings Trash Bin -->
          <button id="fav-btn-trash" class="fav-tool-btn trash" title="${isFa ? 'پاک کردن ترسیم‌های چارت' : 'Clear All Drawings'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>

        <!-- Minimize / Restore Toggle -->
        <button id="fav-btn-minimize" class="fav-minimize-btn" title="${this.isMinimized ? (isFa ? 'باز کردن نوار ابزار' : 'Expand Toolbar') : (isFa ? 'کوچک‌سازی نوار ابزار' : 'Minimize Toolbar')}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${this.isMinimized ? '<polyline points="15 18 9 12 15 6"/>' : '<polyline points="9 18 15 12 9 6"/>'}</svg>
        </button>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Tool buttons
    this.el.querySelectorAll('.fav-tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        if (this.activeTool === tool) {
          this.activeTool = null;
          btn.classList.remove('active');
          this.app?.chartManager?.clearDrawingTool();
        } else {
          this.el.querySelectorAll('.fav-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeTool = tool;
          this.app?.chartManager?.armDrawingTool(tool);
        }
      });
    });

    // Magnet mode
    const magnetBtn = this.el.querySelector('#fav-btn-magnet');
    magnetBtn?.addEventListener('click', () => {
      this.magnetMode = !this.magnetMode;
      magnetBtn.classList.toggle('active', this.magnetMode);
      const chart = this.app?.chartManager?.workspace?.active?.chart;
      if (chart?.drawings?.setMagnet) {
        chart.drawings.setMagnet(this.magnetMode);
      }
    });

    // Lock drawings
    const lockBtn = this.el.querySelector('#fav-btn-lock');
    lockBtn?.addEventListener('click', () => {
      this.isLocked = !this.isLocked;
      lockBtn.classList.toggle('active', this.isLocked);
      const chart = this.app?.chartManager?.workspace?.active?.chart;
      if (chart?.drawings?.setLocked) {
        chart.drawings.setLocked(this.isLocked);
      }
      this.render();
    });

    // Hide/Show drawings
    const hideBtn = this.el.querySelector('#fav-btn-hide');
    hideBtn?.addEventListener('click', () => {
      this.isHidden = !this.isHidden;
      hideBtn.classList.toggle('active', this.isHidden);
      const chart = this.app?.chartManager?.workspace?.active?.chart;
      if (chart?.drawings?.setVisible) {
        chart.drawings.setVisible(!this.isHidden);
      }
      this.render();
    });

    // Trash clear drawings
    const trashBtn = this.el.querySelector('#fav-btn-trash');
    trashBtn?.addEventListener('click', () => {
      const chart = this.app?.chartManager?.workspace?.active?.chart;
      if (chart?.drawings?.clear) {
        chart.drawings.clear();
      } else if (chart?.orchestrator?.drawings?.clear) {
        chart.orchestrator.drawings.clear();
      }
      this.activeTool = null;
      this.el.querySelectorAll('.fav-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      this.app?.chartManager?.clearDrawingTool();
    });

    // Minimize toggle
    const minBtn = this.el.querySelector('#fav-btn-minimize');
    minBtn?.addEventListener('click', () => {
      this.isMinimized = !this.isMinimized;
      this.render();
    });
  }

  setupDraggable() {
    const handle = this.el.querySelector('.fav-tool-drag-handle');
    if (!handle) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = this.el.offsetLeft;
      startTop = this.el.offsetTop;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(10, Math.min(window.innerWidth - 100, startLeft + dx));
      const newTop = Math.max(50, Math.min(window.innerHeight - 80, startTop + dy));

      this.el.style.left = `${newLeft}px`;
      this.el.style.top = `${newTop}px`;
      this.pos = { top: newTop, left: newLeft };
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        localStorage.setItem('tradingchart_fav_toolbar_pos', JSON.stringify(this.pos));
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
    };

    handle.addEventListener('mousedown', onMouseDown);
  }
}
