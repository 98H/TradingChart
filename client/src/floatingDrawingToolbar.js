// client/src/floatingDrawingToolbar.js
// Floating Favorite Drawing Tools Toolbar for TradingChart (TradingView Signature UX)
// Draggable, sleek glassmorphism dock providing 1-click access to canonical drawing tools,
// Magnet snapping, Lock drawings, Hide drawings, and Clear canvas tools.

import { getLanguage } from './i18n.js';

// Icons and labels for every favorite-renderable tool (key → svg path + i18n label)
const FAV_ICON_MAP = {
  trendline: { p: '<line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="1.5" fill="currentColor"/><circle cx="20" cy="4" r="1.5" fill="currentColor"/>', en: 'Trend Line (Alt+T)', fa: 'خط روند (Alt+T)' },
  hline: { p: '<line x1="3" y1="12" x2="21" y2="12"/>', en: 'Horizontal Line (Alt+H)', fa: 'خط افقی (Alt+H)' },
  ray: { p: '<line x1="3" y1="20" x2="21" y2="6"/><circle cx="3" cy="20" r="1.6" fill="currentColor"/>', en: 'Ray Line', fa: 'نیم‌خط (Ray)' },
  fibretracement: { p: '<line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="19" x2="21" y2="19"/>', en: 'Fib Retracement (Alt+F)', fa: 'فیبوناچی بازگشتی (Alt+F)' },
  box: { p: '<rect x="4" y="6" width="16" height="12" rx="1"/>', en: 'Rectangle / Order Block', fa: 'مستطیل / اردربلاک' },
  position: { p: '<rect x="4.5" y="4.5" width="15" height="7.5" rx="1" fill="currentColor" fill-opacity="0.25"/><rect x="4.5" y="12" width="15" height="7.5" rx="1"/>', en: 'Long/Short Position (Alt+P)', fa: 'ابزار پوزیشن خرید/فروش (Alt+P)' },
  longposition: { p: '<rect x="4" y="4" width="16" height="8" rx="1"/><rect x="4" y="12" width="16" height="8" rx="1" fill="currentColor" fill-opacity="0.25"/>', en: 'Long Position', fa: 'پوزیشن خرید' },
  shortposition: { p: '<rect x="4" y="4" width="16" height="8" rx="1" fill="currentColor" fill-opacity="0.25"/><rect x="4" y="12" width="16" height="8" rx="1"/>', en: 'Short Position', fa: 'پوزیشن فروش' },
  datepricerange: { p: '<rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 18 20 6" stroke-dasharray="2 2"/>', en: 'Measure / Date & Price Range', fa: 'خط‌کش و محدوده درصد و زمان' },
  freehand: { p: '<path d="M9.5 12 17 4.5a2.12 2.12 0 0 1 3 3L12.5 15"/><path d="M7 14a3 3 0 0 0-3 3c0 1.3-1.2 1.5-1.5 2 .8.9 2 1.5 3.5 1.5a3.5 3.5 0 0 0 3.5-3.5 3 3 0 0 0-2.5-3Z"/>', en: 'Brush / Freehand', fa: 'قلم‌مو و ترسیم آزاد' },
  text: { p: '<path d="M5 6h14M12 6v13"/>', en: 'Text Annotation', fa: 'یادداشت متنی' },
  pitchfork: { p: '<path d="M4 20 L12 4 M12 4 L20 20 M4 20 L20 20 M12 4 L12 14"/>', en: 'Pitchfork', fa: 'چنگال اندروز' },
  gannfan: { p: '<path d="M4 20 L20 4 M4 20 L20 10 M4 20 L20 16"/>', en: 'Gann Fan', fa: 'بادبزن گان' },
  ellipse: { p: '<ellipse cx="12" cy="12" rx="9" ry="6"/>', en: 'Ellipse', fa: 'بیضی' },
  triangle: { p: '<path d="M12 4 L20 20 L4 20 Z"/>', en: 'Triangle', fa: 'مثلث' },
  arrow: { p: '<path d="M4 20 L18 6 M12 6 H18 V12"/>', en: 'Arrow', fa: 'فلش' },
  callout: { p: '<path d="M4 4 H20 V14 H10 L6 20 V14 H4 Z"/>', en: 'Callout', fa: 'حباب توضیح' },
  xabcd: { p: '<path d="M3 16 L7 6 L11 14 L15 4 L21 12"/>', en: 'XABCD Pattern', fa: 'الگوی XABCD' },
  elliottimpulse: { p: '<path d="M3 19 L6 12 L9 15 L12 8 L15 11 L18 4 L21 7"/>', en: 'Elliott Impulse', fa: 'موج ایمپالس الیوت' },
  anchoredvwap: { p: '<path d="M3 16 Q8 6 12 12 Q16 18 21 8"/><circle cx="12" cy="12" r="2"/>', en: 'Anchored VWAP', fa: 'VWAP لنگردار' },
  parallelchannel: { p: '<path d="M4 18 L18 6 M6 22 L20 10"/>', en: 'Parallel Channel', fa: 'کانال موازی' },
  vline: { p: '<line x1="12" y1="3" x2="12" y2="21"/>', en: 'Vertical Line', fa: 'خط عمودی' },
  crossline: { p: '<path d="M12 3 V21 M3 12 H21"/>', en: 'Cross Line', fa: 'خط متقاطع' },
  pricelabel: { p: '<path d="M4 8 H16 L20 12 L16 16 H4 Z"/>', en: 'Price Label', fa: 'برچسب قیمت' },
  note: { p: '<path d="M6 4 H18 V20 H6 Z M9 8 H15 M9 12 H15"/>', en: 'Note', fa: 'یادداشت' },
  circle: { p: '<circle cx="12" cy="12" r="8"/>', en: 'Circle', fa: 'دایره' },
  path: { p: '<path d="M4 20 L10 6 L14 16 L20 4"/>', en: 'Path', fa: 'مسیر' },
  fibextension: { p: '<path d="M4 20 H20 M4 12 H20 M4 4 H20"/>', en: 'Fib Extension', fa: 'اکستنشن فیبوناچی' },
  headshoulders: { p: '<path d="M3 16 L7 10 L10 14 L12 6 L14 14 L17 10 L21 16"/>', en: 'Head & Shoulders', fa: 'سر و شانه' },
  abcd: { p: '<path d="M3 16 L8 6 L13 14 L20 5"/>', en: 'ABCD Pattern', fa: 'الگوی ABCD' },
  regressionchannel: { p: '<path d="M4 18 L20 6 M4 14 L20 2 M4 22 L20 10"/>', en: 'Regression Trend', fa: 'روند رگرسیون' },
  fixedrangevp: { p: '<path d="M4 4 V20 M4 8 H12 M4 12 H16 M4 16 H10"/>', en: 'Fixed Range Volume Profile', fa: 'پروفایل حجم بازه ثابت' },
  gannbox: { p: '<path d="M4 4 H20 V20 H4 Z M4 4 L20 20 M4 20 L20 4"/>', en: 'Gann Box', fa: 'باکس گان' },
  gannsquare: { p: '<path d="M4 4 H20 V20 H4 Z M4 12 H20 M12 4 V20"/>', en: 'Gann Square', fa: 'مربع گان' },
  extendedline: { p: '<path d="M2 22 L22 2"/>', en: 'Extended Line', fa: 'خط توسعه‌یافته' },
  infoline: { p: '<path d="M4 20 L20 4 M3 3h6"/>', en: 'Info Line', fa: 'خط اطلاعات' },
  trendangle: { p: '<path d="M4 20 L20 20 M4 20 L16 6"/>', en: 'Trend Angle', fa: 'زاویه روند' },
  hray: { p: '<path d="M4 12 H21"/>', en: 'Horizontal Ray', fa: 'نیم‌خط افقی' },
  disjointchannel: { p: '<path d="M4 18 L12 6 M8 22 L16 10 M12 6 L20 18"/>', en: 'Disjoint Channel', fa: 'کانال مجزا' },
  flattopbottom: { p: '<path d="M4 8 H20 M4 16 H20 M6 8 V16 M18 8 V16"/>', en: 'Flat Top/Bottom', fa: 'سقف/کف تخت' },
  schiffpitchfork: { p: '<path d="M6 20 L13 4 M13 4 L19 20 M6 20 L19 20"/>', en: 'Schiff Pitchfork', fa: 'چنگال شیف' },
  modifiedschiffpitchfork: { p: '<path d="M8 20 L14 4 M14 4 L18 20 M8 20 L18 20"/>', en: 'Modified Schiff', fa: 'شیف اصلاح‌شده' },
  insidepitchfork: { p: '<path d="M6 20 L14 4 M14 4 L20 16 M6 20 L20 16"/>', en: 'Inside Pitchfork', fa: 'چنگال درونی' },
  fibfan: { p: '<path d="M4 20 L20 4 M4 20 L20 10 M4 20 L20 16"/>', en: 'Fib Fan', fa: 'بادبزن فیبوناچی' },
  fibtimezones: { p: '<path d="M6 4 V20 M10 4 V20 M14 4 V20 M19 4 V20"/>', en: 'Fib Time Zones', fa: 'زون‌های زمانی فیبو' },
  fibchannel: { p: '<path d="M4 18 L20 6 M4 12 L20 2 M4 24 L20 10"/>', en: 'Fib Channel', fa: 'کانال فیبوناچی' },
  fibcircles: { p: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>', en: 'Fib Circles', fa: 'دوایر فیبوناچی' },
  fibarcs: { p: '<path d="M4 20 A12 12 0 0 1 20 8 M4 20 A8 8 0 0 1 16 12"/>', en: 'Fib Arcs', fa: 'کمان‌های فیبوناچی' },
  fibwedge: { p: '<path d="M4 4 L20 12 L4 20 Z"/>', en: 'Fib Wedge', fa: 'گوه فیبوناچی' },
  fibspiral: { p: '<path d="M12 12 a2 2 0 0 1 2 2 a4 4 0 0 1 -4 4 a6 6 0 0 1 -6 -6"/>', en: 'Fib Spiral', fa: 'مارپیچ فیبوناچی' },
  fibextensiontrend: { p: '<path d="M4 20 L12 12 L8 16 L20 4"/>', en: 'Trend-Based Fib Extension', fa: 'اکستنشن روندی فیبو' },
  fibspeedfan: { p: '<path d="M4 20 A16 16 0 0 1 20 4 M4 20 A10 10 0 0 1 14 10"/>', en: 'Fib Speed Fan', fa: 'کمان مقاومتی فیبو' },
  trendfibtime: { p: '<path d="M6 4 V20 M11 4 V20 M18 4 V20 M4 12 H20"/>', en: 'Trend-Based Fib Time', fa: 'زمان فیبو روندی' },
  rotatedrect: { p: '<path d="M8 4 L20 10 L16 20 L4 14 Z"/>', en: 'Rotated Rectangle', fa: 'مستطیل چرخیده' },
  arc: { p: '<path d="M4 20 A10 10 0 0 1 20 20"/>', en: 'Arc', fa: 'کمان' },
  curve: { p: '<path d="M4 20 Q12 4 20 20"/>', en: 'Curve', fa: 'منحنی' },
  polyline: { p: '<path d="M4 20 L8 10 L14 14 L20 4"/>', en: 'Polyline', fa: 'چندخطی' },
  highlighter: { p: '<path d="M5 19 L14 6 L18 10 L9 19 Z M5 19 L3 21"/>', en: 'Highlighter', fa: 'هایلایتر' },
  comment: { p: '<path d="M4 4 H20 V16 H4 Z M8 8 H16 M8 12 H13"/>', en: 'Comment', fa: 'اظهارنظر' },
  pricenote: { p: '<path d="M4 6 H14 L18 10 V18 H4 Z"/>', en: 'Price Note', fa: 'یادداشت قیمت' },
  signpost: { p: '<path d="M12 3 V8 M7 8 H17 L15 12 H7 Z M12 12 V21"/>', en: 'Signpost', fa: 'تابلوی راهنما' },
  flagmark: { p: '<path d="M6 3 V21 M6 4 H18 L14 8 L18 12 H6"/>', en: 'Flag Mark', fa: 'پرچم' },
  arrowmarkup: { p: '<path d="M12 20 V6 M6 12 L12 4 L18 12"/>', en: 'Arrow Up', fa: 'پیکان بالا' },
  arrowmarkdown: { p: '<path d="M12 4 V18 M6 12 L12 20 L18 12"/>', en: 'Arrow Down', fa: 'پیکان پایین' },
  iconstamp: { p: '<circle cx="12" cy="12" r="8"/><path d="M9 10 h.01 M15 10 h.01 M8 15 q4 3 8 0"/>', en: 'Emoji / Sticker', fa: 'استیکر' },
  cypher: { p: '<path d="M3 14 L7 8 L11 12 L15 5 L21 10"/>', en: 'Cypher', fa: 'سایفر' },
  elliottcorrection: { p: '<path d="M3 8 L8 16 L13 6 L18 14 L21 10"/>', en: 'Elliott Correction', fa: 'موج اصلاحی الیوت' },
  forecast: { p: '<path d="M4 18 L12 8"/><circle cx="12" cy="8" r="6"/>', en: 'Forecast', fa: 'پیش‌بینی' },
  magnifier: { p: '<circle cx="10" cy="10" r="6"/><path d="M15 15 L21 21"/>', en: 'Zoom / Magnifier', fa: 'بزرگ‌نمایی' },
  measure: { p: '<path d="M4 20 L20 4 M4 20 h3 M20 4 h-3"/>', en: 'Measure', fa: 'اندازه‌گیری' },
  daterange: { p: '<path d="M4 8 H20 M6 8 V18 M18 8 V18"/>', en: 'Date Range', fa: 'محدوده تاریخ' },
  pricerange: { p: '<path d="M8 4 V20 M8 6 H18 M8 18 H18"/>', en: 'Price Range', fa: 'محدوده قیمت' },
};

const DEFAULT_FAVORITES = ['trendline', 'hline', 'ray', 'fibretracement', 'box', 'position', 'datepricerange', 'freehand', 'text'];

export class FloatingDrawingToolbar {
  constructor(app) {
    this.app = app;
    this.activeTool = null;
    this.magnetMode = false;
    this.isLocked = false;
    this.isHidden = false;
    this.isMinimized = false;
    this.favorites = this.loadFavorites();
    let savedPos = null;
    try {
      savedPos = JSON.parse(localStorage.getItem('tradingchart_fav_toolbar_pos') || 'null');
    } catch (e) {
      savedPos = null;
    }
    // Default position: bottom-left thumb & drawing zone (TradingView canonical placement)
    if (!savedPos || (savedPos.top !== undefined && (savedPos.top < 60 || savedPos.top > 600))) {
      savedPos = { bottom: 44, left: 16 };
    }
    this.pos = savedPos;

    this.mount();
  }

  loadFavorites() {
    try {
      const f = JSON.parse(localStorage.getItem('tradingchart_drawing_favorites') || 'null');
      if (Array.isArray(f) && f.length) return f.filter(k => FAV_ICON_MAP[k]);
    } catch (e) {}
    return [...DEFAULT_FAVORITES];
  }

  refreshFavorites(favs) {
    this.favorites = (favs || []).filter(k => FAV_ICON_MAP[k]);
    this.render();
  }

  renderFavoriteButtons(isFa) {
    return this.favorites.map(key => {
      const meta = FAV_ICON_MAP[key];
      if (!meta) return '';
      return `<button class="fav-tool-btn" data-tool="${key}" title="${isFa ? meta.fa : meta.en}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${meta.p}</svg>
      </button>`;
    }).join('\n          ');
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
    if (this.pos.bottom !== undefined) {
      this.el.style.top = 'auto';
      this.el.style.bottom = `${this.pos.bottom}px`;
      this.el.style.left = `${this.pos.left}px`;
    } else {
      this.el.style.bottom = 'auto';
      this.el.style.top = `${this.pos.top}px`;
      this.el.style.left = `${this.pos.left}px`;
    }

    this.el.innerHTML = `
      <div class="fav-toolbar-inner ${this.isMinimized ? 'minimized' : ''}">
        <!-- Drag Handle -->
        <div class="fav-tool-drag-handle" title="${isFa ? 'جابجایی نوار ابزار' : 'Drag to reposition'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
        </div>

        <div class="fav-tools-list" style="${this.isMinimized ? 'display: none;' : 'display: flex; align-items: center; gap: 2px;'}">
          ${this.renderFavoriteButtons(isFa)}

          <!-- All Drawing Tools Library -->
          <button id="fav-btn-all-tools" class="fav-tool-btn" title="${isFa ? 'همه ابزارهای ترسیم (۷۰+ ابزار)' : 'All Drawing Tools (70+)'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="5" r="1.6"/><circle cx="12" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="12" cy="19" r="1.6"/><circle cx="19" cy="19" r="1.6"/></svg>
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
    // All-tools library button
    this.el.querySelector('#fav-btn-all-tools')?.addEventListener('click', () => {
      this.app?.drawingToolsLibrary?.open();
    });

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
