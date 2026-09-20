// client/src/drawingToolsLibrary.js
// Comprehensive Drawing Tools Library for TradingChart — TradingView signature
// left-rail drawing panel exposing ALL 76 Vela engine drawing types in a
// searchable, categorized, RTL/LTR-safe modal with favorites management.

import { getLanguage } from './i18n.js';

// Canonical catalogue: every Vela DrawingTypeKey grouped the TradingView way.
const CATALOG = [
  { group: { en: 'Trend Lines', fa: 'خطوط روند' }, tools: [
    ['trendline', 'Trend Line', 'خط روند', 'M4 20 L20 4'],
    ['ray', 'Ray', 'نیم‌خط', 'M4 20 L20 4 M20 4 l3 -3'],
    ['infoline', 'Info Line', 'خط اطلاعات', 'M4 20 L20 4 M3 3h6'],
    ['extendedline', 'Extended Line', 'خط توسعه‌یافته', 'M2 22 L22 2'],
    ['trendangle', 'Trend Angle', 'زاویه روند', 'M4 20 L20 20 M4 20 L16 6'],
    ['hline', 'Horizontal Line', 'خط افقی', 'M3 12 H21'],
    ['hray', 'Horizontal Ray', 'نیم‌خط افقی', 'M4 12 H21'],
    ['vline', 'Vertical Line', 'خط عمودی', 'M12 3 V21'],
    ['crossline', 'Cross Line', 'خط متقاطع', 'M12 3 V21 M3 12 H21'],
  ]},
  { group: { en: 'Channels & Pitchforks', fa: 'کانال‌ها و چنگال‌ها' }, tools: [
    ['parallelchannel', 'Parallel Channel', 'کانال موازی', 'M4 18 L18 6 M6 22 L20 10'],
    ['regressionchannel', 'Regression Trend', 'روند رگرسیون', 'M4 18 L20 6 M4 14 L20 2 M4 22 L20 10'],
    ['flattopbottom', 'Flat Top/Bottom', 'سقف/کف تخت', 'M4 8 H20 M4 16 H20 M6 8 V16 M18 8 V16'],
    ['disjointchannel', 'Disjoint Channel', 'کانال مجزا', 'M4 18 L12 6 M8 22 L16 10 M12 6 L20 18'],
    ['pitchfork', 'Pitchfork', 'چنگال اندروز', 'M4 20 L12 4 M12 4 L20 20 M4 20 L20 20 M12 4 L12 14'],
    ['schiffpitchfork', 'Schiff Pitchfork', 'چنگال شیف', 'M6 20 L13 4 M13 4 L19 20 M6 20 L19 20'],
    ['modifiedschiffpitchfork', 'Modified Schiff', 'شیف اصلاح‌شده', 'M8 20 L14 4 M14 4 L18 20 M8 20 L18 20'],
    ['insidepitchfork', 'Inside Pitchfork', 'چنگال درونی', 'M6 20 L14 4 M14 4 L20 16 M6 20 L20 16'],
  ]},
  { group: { en: 'Fibonacci', fa: 'فیبوناچی' }, tools: [
    ['fibretracement', 'Fib Retracement', 'بازگشت فیبوناچی', 'M4 6 H20 M4 12 H20 M4 18 H20'],
    ['fibextensiontrend', 'Trend-Based Fib Extension', 'اکستنشن روندی فیبو', 'M4 20 L12 12 L8 16 L20 4'],
    ['fibfan', 'Fib Speed Resistance Fan', 'بادبزن فیبوناچی', 'M4 20 L20 4 M4 20 L20 10 M4 20 L20 16'],
    ['fibtimezones', 'Fib Time Zones', 'زون‌های زمانی فیبو', 'M6 4 V20 M10 4 V20 M14 4 V20 M19 4 V20'],
    ['fibchannel', 'Fib Channel', 'کانال فیبوناچی', 'M4 18 L20 6 M4 12 L20 2 M4 24 L20 10'],
    ['fibspeedfan', 'Fib Speed Resistance Arcs', 'کمان مقاومتی فیبو', 'M4 20 A16 16 0 0 1 20 4 M4 20 A10 10 0 0 1 14 10'],
    ['trendfibtime', 'Trend-Based Fib Time', 'زمان فیبو روندی', 'M6 4 V20 M11 4 V20 M18 4 V20 M4 12 H20'],
    ['fibcircles', 'Fib Circles', 'دوایر فیبوناچی', 'M12 12 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M12 12 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0'],
    ['fibarcs', 'Fib Arcs', 'کمان‌های فیبوناچی', 'M4 20 A12 12 0 0 1 20 8 M4 20 A8 8 0 0 1 16 12'],
    ['fibwedge', 'Fib Wedge', 'گوه فیبوناچی', 'M4 4 L20 12 L4 20 Z'],
    ['fibspiral', 'Fib Spiral', 'مارپیچ فیبوناچی', 'M12 12 a2 2 0 0 1 2 2 a4 4 0 0 1 -4 4 a6 6 0 0 1 -6 -6'],
    ['fibextension', 'Fib Extension', 'اکستنشن فیبوناچی', 'M4 20 H20 M4 12 H20 M4 4 H20'],
  ]},
  { group: { en: 'Gann', fa: 'گان' }, tools: [
    ['gannfan', 'Gann Fan', 'بادبزن گان', 'M4 20 L20 4 M4 20 L20 8 M4 20 L20 12 M4 20 L12 4'],
    ['gannbox', 'Gann Box', 'باکس گان', 'M4 4 H20 V20 H4 Z M4 4 L20 20 M4 20 L20 4'],
    ['gannsquare', 'Gann Square', 'مربع گان', 'M4 4 H20 V20 H4 Z M4 12 H20 M12 4 V20'],
  ]},
  { group: { en: 'Geometric Shapes', fa: 'اشکال هندسی' }, tools: [
    ['box', 'Rectangle', 'مستطیل', 'M4 6 H20 V18 H4 Z'],
    ['rotatedrect', 'Rotated Rectangle', 'مستطیل چرخیده', 'M8 4 L20 10 L16 20 L4 14 Z'],
    ['path', 'Path', 'مسیر', 'M4 20 L10 6 L14 16 L20 4'],
    ['circle', 'Circle', 'دایره', 'M12 12 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0'],
    ['ellipse', 'Ellipse', 'بیضی', 'M12 12 m-9 0 a9 6 0 1 0 18 0 a9 6 0 1 0 -18 0'],
    ['triangle', 'Triangle', 'مثلث', 'M12 4 L20 20 L4 20 Z'],
    ['arc', 'Arc', 'کمان', 'M4 20 A10 10 0 0 1 20 20'],
    ['curve', 'Curve', 'منحنی', 'M4 20 Q12 4 20 20'],
    ['polyline', 'Polyline', 'چندخطی', 'M4 20 L8 10 L14 14 L20 4'],
  ]},
  { group: { en: 'Annotations & Text', fa: 'حاشیه‌نویسی و متن' }, tools: [
    ['text', 'Text', 'متن', 'M5 6 H19 M12 6 V19'],
    ['anchoredtext', 'Anchored Text', 'متن لنگردار', 'M5 6 H19 M12 6 V19 M12 19 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0'],
    ['note', 'Note', 'یادداشت', 'M6 4 H18 V20 H6 Z M9 8 H15 M9 12 H15'],
    ['anchorednote', 'Anchored Note', 'یادداشت لنگردار', 'M6 4 H18 V16 H6 Z M12 16 V21'],
    ['callout', 'Callout', 'حباب توضیح', 'M4 4 H20 V14 H10 L6 20 V14 H4 Z'],
    ['comment', 'Comment', 'اظهارنظر', 'M4 4 H20 V16 H4 Z M8 8 H16 M8 12 H13'],
    ['pricelabel', 'Price Label', 'برچسب قیمت', 'M4 8 H16 L20 12 L16 16 H4 Z'],
    ['pricenote', 'Price Note', 'یادداشت قیمت', 'M4 6 H14 L18 10 V18 H4 Z'],
    ['signpost', 'Signpost', 'تابلوی راهنما', 'M12 3 V8 M7 8 H17 L15 12 H7 Z M12 12 V21'],
    ['flagmark', 'Flag Mark', 'پرچم', 'M6 3 V21 M6 4 H18 L14 8 L18 12 H6'],
    ['arrowmarkup', 'Arrow Mark Up', 'پیکان بالا', 'M12 20 V6 M6 12 L12 4 L18 12'],
    ['arrowmarkdown', 'Arrow Mark Down', 'پیکان پایین', 'M12 4 V18 M6 12 L12 20 L18 12'],
    ['arrow', 'Arrow', 'فلش', 'M4 20 L18 6 M12 6 H18 V12'],
    ['iconstamp', 'Emoji / Sticker', 'استیکر', 'M12 12 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M9 10 h.01 M15 10 h.01 M8 15 q4 3 8 0'],
    ['highlighter', 'Highlighter', 'هایلایتر', 'M5 19 L14 6 L18 10 L9 19 Z M5 19 L3 21'],
  ]},
  { group: { en: 'Patterns', fa: 'الگوها' }, tools: [
    ['xabcd', 'XABCD Pattern', 'الگوی XABCD', 'M3 16 L7 6 L11 14 L15 4 L21 12'],
    ['cypher', 'Cypher', 'سایفر', 'M3 14 L7 8 L11 12 L15 5 L21 10'],
    ['abcd', 'ABCD Pattern', 'الگوی ABCD', 'M3 16 L8 6 L13 14 L20 5'],
    ['trianglepattern', 'Triangle Pattern', 'الگوی مثلث', 'M4 6 L12 12 L20 8 M4 18 L12 12 L20 16'],
    ['threedrives', 'Three Drives', 'سه موج محرک', 'M3 18 L6 10 L9 14 L12 6 L15 12 L21 4'],
    ['headshoulders', 'Head & Shoulders', 'سر و شانه', 'M3 16 L7 10 L10 14 L12 6 L14 14 L17 10 L21 16'],
    ['elliottimpulse', 'Elliott Impulse (12345)', 'موج ایمپالس الیوت', 'M3 19 L6 12 L9 15 L12 8 L15 11 L18 4 L21 7'],
    ['elliottcorrection', 'Elliott Correction (ABC)', 'موج اصلاحی الیوت', 'M3 8 L8 16 L13 6 L18 14 L21 10'],
    ['elliotttriangle', 'Elliott Triangle', 'مثلث الیوت', 'M3 6 L8 14 L13 9 L18 13 L21 11'],
    ['elliottdoublecombo', 'Elliott Double Combo', 'کامبوی دوتایی الیوت', 'M3 14 L6 8 L9 13 L12 7 L15 12 L21 10'],
    ['elliotttriplecombo', 'Elliott Triple Combo', 'کامبوی سه‌تایی الیوت', 'M3 14 L5 9 L8 13 L10 8 L13 12 L15 8 L21 11'],
    ['cycliclines', 'Cyclic Lines', 'خطوط چرخه‌ای', 'M5 4 V20 M10 4 V20 M15 4 V20 M20 4 V20'],
    ['timecycles', 'Time Cycles', 'چرخه‌های زمانی', 'M6 20 A6 6 0 0 1 18 20 M6 20 A6 6 0 0 0 18 20'],
    ['sine', 'Sine Line', 'خط سینوسی', 'M3 12 Q6 4 9 12 Q12 20 15 12 Q18 4 21 12'],
  ]},
  { group: { en: 'Forecast & Measurement', fa: 'پیش‌بینی و اندازه‌گیری' }, tools: [
    ['longposition', 'Long Position', 'پوزیشن خرید', 'M4 4 H20 V12 H4 Z M4 12 H20 V20 H4 Z M8 8 H14'],
    ['shortposition', 'Short Position', 'پوزیشن فروش', 'M4 4 H20 V12 H4 Z M4 12 H20 V20 H4 Z M8 16 H14'],
    ['forecast', 'Forecast', 'پیش‌بینی', 'M4 18 L12 8 M12 8 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0'],
    ['projection', 'Projection', 'پروجکشن', 'M4 18 L10 10 L16 14 M16 14 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0'],
    ['datepricerange', 'Date & Price Range', 'محدوده تاریخ و قیمت', 'M4 6 H20 V18 H4 Z M4 6 V18 M8 10 l4 4 4-4'],
    ['daterange', 'Date Range', 'محدوده تاریخ', 'M4 8 H20 M6 8 V18 M18 8 V18'],
    ['pricerange', 'Price Range', 'محدوده قیمت', 'M8 4 V20 M8 6 H18 M8 18 H18'],
    ['ghostfeed', 'Ghost Feed', 'فید شبح', 'M6 18 L10 10 L14 14 L18 6 M18 6 l2 -2 M20 4 h-4 v4'],
    ['bars', 'Bars Pattern', 'الگوی کندل‌ها', 'M6 10 V18 M6 12 H9 M12 6 V16 M12 8 H15 M18 12 V20'],
    ['measure', 'Measure', 'اندازه‌گیری', 'M4 20 L20 4 M4 20 h3 M20 4 h-3 M7 20 v-3 M20 7 v3'],
    ['magnifier', 'Zoom / Magnifier', 'بزرگ‌نمایی', 'M10 10 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M15 15 L21 21'],
  ]},
  { group: { en: 'Volume Profile & VWAP', fa: 'پروفایل حجم و VWAP' }, tools: [
    ['anchoredvwap', 'Anchored VWAP', 'VWAP لنگردار', 'M3 16 Q8 6 12 12 Q16 18 21 8 M12 12 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0'],
    ['fixedrangevp', 'Fixed Range Volume Profile', 'پروفایل حجم بازه ثابت', 'M4 4 V20 M4 8 H12 M4 12 H16 M4 16 H10'],
  ]},
];

// Tools that the current Vela build actually exposes (verified via setTool probe).
// Anything not in this list is hidden from the UI automatically.
let supportedCache = null;

export class DrawingToolsLibrary {
  constructor(app) {
    this.app = app;
    this.activeTool = null;
    this.favorites = this.loadFavorites();
    this.el = null;
    this.onToolSelected = null; // callback(toolKey|null)
    this.mount();
  }

  loadFavorites() {
    try {
      const f = JSON.parse(localStorage.getItem('tradingchart_drawing_favorites') || 'null');
      if (Array.isArray(f) && f.length) return f;
    } catch (e) {}
    // TradingView default favorites
    return ['trendline', 'ray', 'fibretracement', 'box', 'text', 'longposition', 'datepricerange', 'hline'];
  }

  saveFavorites() {
    localStorage.setItem('tradingchart_drawing_favorites', JSON.stringify(this.favorites));
  }

  supportedTypes() {
    if (supportedCache) return supportedCache;
    const d = this.app?.chartManager?.workspace?.active?.chart?.drawings;
    const ok = new Set();
    if (d) {
      for (const g of CATALOG) for (const [key] of g.tools) {
        try { d.setTool(key); if (d.getTool() === key) ok.add(key); } catch (e) {}
      }
      try { d.setTool(null); } catch (e) {}
    } else {
      CATALOG.forEach(g => g.tools.forEach(([k]) => ok.add(k)));
    }
    supportedCache = ok;
    return ok;
  }

  mount() {
    let el = document.querySelector('#drawing-tools-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'drawing-tools-modal';
      el.className = 'modal-overlay';
      document.body.appendChild(el);
    }
    this.el = el;
    this.render();
    this.bindGlobal();
  }

  icon(path) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  }

  render(filter = '') {
    const isFa = getLanguage() === 'fa';
    const supported = this.supportedTypes();
    const q = filter.trim().toLowerCase();

    let sections = '';
    for (const g of CATALOG) {
      const tools = g.tools.filter(([key, en, fa]) => {
        if (!supported.has(key)) return false;
        if (!q) return true;
        return en.toLowerCase().includes(q) || fa.includes(filter.trim());
      });
      if (!tools.length) continue;
      sections += `
        <div class="dtl-group">
          <div class="dtl-group-title">${isFa ? g.group.fa : g.group.en}</div>
          <div class="dtl-grid">
            ${tools.map(([key, en, fa, path]) => `
              <button class="dtl-tool ${this.activeTool === key ? 'active' : ''}" data-dtool="${key}" title="${isFa ? fa : en}">
                <span class="dtl-icon">${this.icon(path)}</span>
                <span class="dtl-label">${isFa ? fa : en}</span>
                <span class="dtl-star ${this.favorites.includes(key) ? 'fav' : ''}" data-star="${key}" title="${isFa ? 'علاقه‌مندی' : 'Favorite'}">★</span>
              </button>`).join('')}
          </div>
        </div>`;
    }

    this.el.innerHTML = `
      <div class="modal-box dtl-box" dir="${isFa ? 'rtl' : 'ltr'}">
        <div class="modal-header">
          <div class="dtl-header-title">${isFa ? 'ابزارهای ترسیم' : 'Drawing Tools'}</div>
          <input id="dtl-search" class="dtl-search" type="text" placeholder="${isFa ? 'جستجوی ابزار…' : 'Search tools…'}" value="${filter.replace(/"/g, '&quot;')}">
          <button class="modal-close-btn" id="dtl-close" aria-label="Close">✕</button>
        </div>
        <div class="dtl-body">${sections || `<div class="dtl-empty">${isFa ? 'ابزاری یافت نشد' : 'No tools found'}</div>`}</div>
        <div class="dtl-footer">${isFa ? 'کلیک روی ★ ابزار را به نوار شناور اضافه می‌کند' : 'Click ★ to pin a tool to the floating toolbar'}</div>
      </div>`;
    this.bindEvents();
  }

  bindEvents() {
    this.el.querySelector('#dtl-close')?.addEventListener('click', () => this.close());
    this.el.querySelector('#dtl-search')?.addEventListener('input', (e) => {
      const pos = e.target.selectionStart;
      this.render(e.target.value);
      const inp = this.el.querySelector('#dtl-search');
      inp?.focus();
      try { inp?.setSelectionRange(pos, pos); } catch (err) {}
    });
    this.el.addEventListener('mousedown', (e) => { if (e.target === this.el) this.close(); });

    this.el.querySelectorAll('[data-dtool]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('[data-star]')) return; // star click handled separately
        const tool = btn.getAttribute('data-dtool');
        this.selectTool(tool);
      });
    });
    this.el.querySelectorAll('[data-star]').forEach(star => {
      star.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = star.getAttribute('data-star');
        if (this.favorites.includes(key)) {
          this.favorites = this.favorites.filter(f => f !== key);
        } else {
          this.favorites.push(key);
        }
        this.saveFavorites();
        this.app?.floatingToolbar?.refreshFavorites?.(this.favorites);
        const inp = this.el.querySelector('#dtl-search');
        this.render(inp ? inp.value : '');
      });
    });
  }

  bindGlobal() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.el.classList.contains('open')) this.close();
    });
  }

  selectTool(tool) {
    this.activeTool = tool;
    this.app?.chartManager?.armDrawingTool(tool);
    this.onToolSelected?.(tool);
    this.close();
  }

  clearTool() {
    this.activeTool = null;
    this.app?.chartManager?.clearDrawingTool();
    this.onToolSelected?.(null);
  }

  open() {
    supportedCache = null; // re-probe in case chart cell changed
    this.render();
    this.el.classList.add('open');
    setTimeout(() => this.el.querySelector('#dtl-search')?.focus(), 50);
  }

  close() { this.el.classList.remove('open'); }
  get isOpen() { return this.el.classList.contains('open'); }
}

export { CATALOG as DRAWING_TOOLS_CATALOG };
