// client/src/commandPalette.js
// TradingView-parity Command Palette (Ctrl+K / Ctrl+/) — fuzzy quick-launch for
// every app surface: symbols, timeframes, chart styles, drawing tools, panels,
// layouts, actions. RTL-safe, FA/EN, keyboard navigable.

import { getLanguage } from './i18n.js';

export class CommandPalette {
  constructor(app) {
    this.app = app;
    this.el = null;
    this.items = [];
    this.filtered = [];
    this.selectedIdx = 0;
    this.mount();
  }

  mount() {
    let el = document.querySelector('#command-palette');
    if (!el) {
      el = document.createElement('div');
      el.id = 'command-palette';
      el.className = 'modal-overlay';
      document.body.appendChild(el);
    }
    this.el = el;
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() { return this.el.classList.contains('open'); }

  buildIndex() {
    const app = this.app;
    const items = [];
    const add = (cat, en, fa, action, icon = '⚡') => items.push({ cat, en, fa, action, icon, hay: (en + ' ' + fa).toLowerCase() });

    // Symbols
    for (const s of ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'XAUUSD', 'EURUSD', 'GBPUSD']) {
      add('symbol', `Symbol ${s}`, `نماد ${s}`, () => app.handleSymbolChange?.(s) || app.switchSymbol?.(s), '📈');
    }
    // Timeframes
    const tfs = [['1', '1m'], ['5', '5m'], ['15', '15m'], ['60', '1h'], ['240', '4h'], ['D', '1D'], ['W', '1W'], ['M', '1M']];
    for (const [tf, lbl] of tfs) {
      add('timeframe', `Timeframe ${lbl}`, `تایم‌فریم ${lbl}`, () => app.setTimeframe?.(tf), '⏱');
    }
    // Chart styles
    for (const [id, en, fa] of [['candles', 'Candles', 'کندل'], ['bars', 'Bars', 'میله‌ای'], ['heikinashi', 'Heikin Ashi', 'هیکن‌آشی'], ['line', 'Line', 'خطی'], ['area', 'Area', 'ناحیه‌ای'], ['renko', 'Renko', 'رنکو'], ['kagi', 'Kagi', 'کاگی'], ['pnf', 'Point & Figure', 'پوینت و فیگور'], ['linebreak', 'Line Break', 'لاین‌بریک']]) {
      add('style', `Chart ${en}`, `چارت ${fa}`, () => app.chartStylePicker?.setStyle(id), '📊');
    }
    // Drawing tools (frequent)
    for (const [id, en, fa] of [['trendline', 'Trend Line', 'خط روند'], ['fibretracement', 'Fib Retracement', 'فیبوناچی بازگشتی'], ['box', 'Rectangle', 'مستطیل'], ['position', 'Long/Short Position', 'پوزیشن'], ['pitchfork', 'Pitchfork', 'چنگال'], ['elliottimpulse', 'Elliott Impulse', 'موج الیوت']]) {
      add('drawing', `Draw ${en}`, `ترسیم ${fa}`, () => { app.chartManager?.armDrawingTool(id); app.floatingToolbar && (app.floatingToolbar.activeTool = id, app.floatingToolbar.render()); }, '✏️');
    }
    // Panels
    for (const [p, en, fa] of [['watchlist', 'Watchlist', 'واچ‌لیست'], ['alerts', 'Alerts', 'هشدارها'], ['paper', 'Paper Trading', 'معامله کاغذی'], ['screener', 'Screener', 'اسکرینر'], ['dom', 'Depth of Market', 'عمق بازار'], ['calendar', 'Economic Calendar', 'تقویم اقتصادی'], ['news', 'Market News', 'اخبار'], ['journal', 'Trade Journal', 'ژورنال معاملات'], ['pine', 'Pine Editor', 'ویرایشگر پاین']]) {
      add('panel', `Open ${en}`, `باز کردن ${fa}`, () => app.chartManager?.togglePanel?.(p, true), '🗂');
    }
    // Layouts
    for (const [lid, en, fa] of [['1', 'Single Chart', 'تک‌چارت'], ['2h', 'Dual Horizontal', 'دو چارت افقی'], ['2v', 'Dual Vertical', 'دو چارت عمودی'], ['4', 'Quad Grid', 'چهار چارت']]) {
      add('layout', `Layout ${en}`, `چیدمان ${fa}`, () => app.layoutManager?.setLayout(lid, en), '⊞');
    }
    // Actions
    add('action', 'Take Screenshot', 'تصویر چارت', () => app.screenshotModal?.open(), '📸');
    add('action', 'Export Data', 'خروجی داده', () => app.dataExportModal?.open(), '📤');
    add('action', 'Bar Replay', 'بازپخش کندل', () => app.layoutManager?.toggleReplay?.(), '⏪');
    add('action', 'Go to Date', 'برو به تاریخ', () => app.goToDateModal?.open(), '📅');
    add('action', 'Chart Settings', 'تنظیمات چارت', () => app.settingsModal?.open(), '⚙');
    add('action', 'Keyboard Shortcuts', 'میانبرهای صفحه‌کلید', () => app.shortcutsModal?.open(), '⌨');
    add('action', 'Compare Symbol', 'مقایسه نماد', () => app.compareModal?.open(), '➕');
    add('action', 'Toggle Log Scale', 'مقیاس لگاریتمی', () => document.querySelector('#btn-scale-log')?.click(), '📈');
    add('action', 'Toggle Language FA/EN', 'تغییر زبان فارسی/انگلیسی', () => app.switchLanguage?.(getLanguage() === 'fa' ? 'en' : 'fa'), '🌐');
    this.items = items;
  }

  open() {
    this.buildIndex();
    this.selectedIdx = 0;
    const isFa = getLanguage() === 'fa';
    this.el.innerHTML = `
      <div class="modal-box cp-box" dir="${isFa ? 'rtl' : 'ltr'}" style="width: 560px; max-width: 94vw; margin-top: -18vh;">
        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 10px;">
          <span style="color: var(--accent-cyan);">⌘</span>
          <input id="cp-input" type="text" placeholder="${isFa ? 'جستجوی دستور، نماد، ابزار…' : 'Search commands, symbols, tools…'}" style="flex: 1; background: transparent; border: none; outline: none; color: #fff; font-size: 15px; font-family: inherit;" autocomplete="off"/>
        </div>
        <div id="cp-list" style="max-height: 52vh; overflow-y: auto; padding: 6px 6px 14px; position: relative; -webkit-mask-image: linear-gradient(to bottom, black 88%, transparent 100%); mask-image: linear-gradient(to bottom, black 88%, transparent 100%);"></div>
        <div style="padding: 8px 14px; border-top: 1px solid var(--border-subtle); display: flex; gap: 14px; align-items: center; font-size: 10px; color: var(--text-dim);">
          <span><kbd style="background: var(--bg-surface); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--border-subtle);">↑↓</kbd> ${isFa ? 'حرکت' : 'navigate'}</span>
          <span><kbd style="background: var(--bg-surface); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--border-subtle);">↵</kbd> ${isFa ? 'انتخاب' : 'select'}</span>
          <span><kbd style="background: var(--bg-surface); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--border-subtle);">Esc</kbd> ${isFa ? 'بستن' : 'close'}</span>
          <span style="margin-inline-start: auto; font-size: 10px; color: var(--accent-cyan);">⌘K</span>
        </div>
      </div>`;
    this.el.classList.add('open');
    this.el.addEventListener('mousedown', (e) => { if (e.target === this.el) this.close(); });
    const input = this.el.querySelector('#cp-input');
    input?.focus();
    input?.addEventListener('input', () => { this.selectedIdx = 0; this.renderList(input.value); });
    input?.addEventListener('keydown', (e) => this.onKey(e));
    this.renderList('');
  }

  renderList(q) {
    const isFa = getLanguage() === 'fa';
    const query = q.trim().toLowerCase();
    this.filtered = query
      ? this.items.filter(it => it.hay.includes(query))
      : this.items.slice(0, 40);
    this.filtered = this.filtered.slice(0, 50);
    const list = this.el.querySelector('#cp-list');
    if (!list) return;
    const catLabel = { symbol: isFa ? 'نمادها' : 'Symbols', timeframe: isFa ? 'تایم‌فریم' : 'Timeframes', style: isFa ? 'نوع چارت' : 'Chart Style', drawing: isFa ? 'ابزار ترسیم' : 'Drawing', panel: isFa ? 'پنل‌ها' : 'Panels', layout: isFa ? 'چیدمان' : 'Layouts', action: isFa ? 'اقدامات' : 'Actions' };
    list.innerHTML = this.filtered.length === 0
      ? `<div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">${isFa ? 'نتیجه‌ای یافت نشد' : 'No results'}</div>`
      : this.filtered.map((it, i) => `
        <button class="cp-item ${i === this.selectedIdx ? 'selected' : ''}" data-idx="${i}" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: none; border-radius: 6px; background: ${i === this.selectedIdx ? 'rgba(0,242,176,0.12)' : 'transparent'}; color: #fff; cursor: pointer; text-align: ${isFa ? 'right' : 'left'}; font-size: 13px;">
          <span style="flex: 0 0 auto;">${it.icon}</span>
          <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${isFa ? it.fa : it.en}</span>
          <span style="flex: 0 0 auto; font-size: 10px; color: var(--text-dim);">${catLabel[it.cat] || it.cat}</span>
        </button>`).join('');
    list.querySelectorAll('.cp-item').forEach(btn => {
      btn.addEventListener('click', () => { this.run(Number(btn.dataset.idx)); });
      btn.addEventListener('mouseenter', () => { this.selectedIdx = Number(btn.dataset.idx); this.renderList(this.el.querySelector('#cp-input').value); });
    });
  }

  onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.selectedIdx = Math.min(this.selectedIdx + 1, this.filtered.length - 1); this.renderList(e.target.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.selectedIdx = Math.max(this.selectedIdx - 1, 0); this.renderList(e.target.value); }
    else if (e.key === 'Enter') { e.preventDefault(); this.run(this.selectedIdx); }
  }

  run(idx) {
    const it = this.filtered[idx];
    if (!it) return;
    this.close();
    try { it.action(); } catch (e) { console.warn('[CommandPalette]', e.message); }
  }

  toggle() { this.isOpen ? this.close() : this.open(); }
  close() { this.el.classList.remove('open'); }
}
