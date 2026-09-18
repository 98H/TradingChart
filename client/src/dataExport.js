// client/src/dataExport.js
// Institutional Historical OHLCV Data Export Engine
// Exports chart data to standard CSV or JSON for Excel, Python Pandas, QuantConnect & Tax reporting

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class DataExportModal {
  constructor(app) {
    this.app = app;
    this.modalEl = null;
    this.exportFormat = 'csv'; // 'csv' or 'json'
    this.includeIndicators = true;
    this.createModal();
  }

  createModal() {
    let el = document.querySelector('#modal-data-export');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-data-export';
      el.className = 'modal-overlay';
      document.body.appendChild(el);
    }
    this.modalEl = el;
    this.render();
  }

  open() {
    if (this.modalEl) {
      this.render();
      this.modalEl.classList.add('open');
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }

  render() {
    const isFa = getLanguage() === 'fa';
    const symbol = this.app?.currentSymbol || 'BTCUSDT';
    const tf = this.app?.currentTimeframe || '60';
    const barsCount = this.app?.activeBars?.length || 0;

    this.modalEl.innerHTML = `
      <div class="modal-box" style="width: 520px; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span id="export-modal-title">${isFa ? 'خروجی داده‌های کندلی چارت (Export Chart Data)' : 'Export Historical Chart Data'}</span>
          </h3>
          <button class="modal-close-btn" id="modal-close-export">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-content" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;">
          <!-- Dataset Info Card -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;">
            <div>
              <span style="font-size: 11px; color: var(--text-dim); display: block;">${isFa ? 'نماد دارایی' : 'Symbol'}</span>
              <span style="font-size: 14px; font-weight: 700; color: #fff;">${symbol}</span>
            </div>
            <div>
              <span style="font-size: 11px; color: var(--text-dim); display: block;">${isFa ? 'تایم‌فریم' : 'Timeframe'}</span>
              <span style="font-size: 14px; font-weight: 700; color: var(--accent-cyan);">${tf}m</span>
            </div>
            <div>
              <span style="font-size: 11px; color: var(--text-dim); display: block;">${isFa ? 'تعداد کندل‌ها' : 'Total Bars'}</span>
              <span class="num-ltr" style="font-size: 14px; font-weight: 700; color: var(--accent-green);">${barsCount.toLocaleString()}</span>
            </div>
          </div>

          <!-- Format Selection -->
          <div>
            <label style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px; display: block;">
              ${isFa ? 'قالب پرونده خروجی:' : 'Export Format:'}
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button class="btn-export-format ${this.exportFormat === 'csv' ? 'active' : ''}" data-format="csv" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: 4px; border: 1px solid ${this.exportFormat === 'csv' ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; background: ${this.exportFormat === 'csv' ? 'rgba(0, 242, 176, 0.08)' : 'var(--bg-card)'}; cursor: pointer; color: #fff; font-weight: 700;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>CSV (Excel / Pandas)</span>
              </button>
              <button class="btn-export-format ${this.exportFormat === 'json' ? 'active' : ''}" data-format="json" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: 4px; border: 1px solid ${this.exportFormat === 'json' ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; background: ${this.exportFormat === 'json' ? 'rgba(0, 242, 176, 0.08)' : 'var(--bg-card)'}; cursor: pointer; color: #fff; font-weight: 700;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                <span>JSON (Raw Series)</span>
              </button>
            </div>
          </div>

          <!-- Included Columns Schema Notice -->
          <div style="font-size: 11px; color: var(--text-dim); background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 4px; line-height: 1.5;">
            <strong style="color: var(--text-muted);">${isFa ? 'ستون‌های خروجی:' : 'Output Schema:'}</strong>
            <code>Date (ISO UTC), Timestamp (ms), Open, High, Low, Close, Volume</code>
          </div>

          <!-- Action Button -->
          <button id="btn-trigger-download" class="btn-primary" style="width: 100%; justify-content: center; padding: 10px; font-size: 13px; font-weight: 700; margin-top: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>${isFa ? 'دریافت پرونده خروجی (Download Dataset)' : 'Download Dataset'}</span>
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.modalEl.querySelector('#modal-close-export')?.addEventListener('click', () => this.close());

    this.modalEl.querySelectorAll('.btn-export-format').forEach(btn => {
      btn.addEventListener('click', () => {
        this.exportFormat = btn.getAttribute('data-format');
        this.render();
      });
    });

    this.modalEl.querySelector('#btn-trigger-download')?.addEventListener('click', () => {
      this.executeExport();
    });
  }

  executeExport() {
    const bars = this.app?.activeBars || [];
    if (bars.length === 0) {
      alert('No candlestick data loaded to export.');
      return;
    }

    const symbol = this.app?.currentSymbol || 'BTCUSDT';
    const tf = this.app?.currentTimeframe || '60';
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `TradingChart_${symbol}_${tf}m_${dateStr}.${this.exportFormat}`;

    let blob;
    if (this.exportFormat === 'csv') {
      let csv = 'Date_UTC,Timestamp,Open,High,Low,Close,Volume\n';
      for (const b of bars) {
        const iso = new Date(b.time).toISOString();
        csv += `${iso},${b.time},${b.open},${b.high},${b.low},${b.close},${b.volume || 0}\n`;
      }
      blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    } else {
      const json = JSON.stringify({
        symbol,
        timeframe: tf,
        count: bars.length,
        exportedAt: new Date().toISOString(),
        candles: bars
      }, null, 2);
      blob = new Blob([json], { type: 'application/json' });
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    this.close();
  }
}
