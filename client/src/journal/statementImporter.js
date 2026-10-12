// client/src/journal/statementImporter.js
// Universal Statement & CSV Importer for TradingChart Journal
// Supports 14 formats from @luxalgo/journal-importers with automatic format detection.

import { getLanguage } from '../i18n.js';
import { detectFormat, parseAuto } from './importers/index.ts';

export class StatementImporter {
  constructor(journalStore, app = null) {
    this.store = journalStore;
    this.app = app;
    this.parsedResult = null;
    this.detectedFormatName = null;
    this.selectedAccountId = 'tradingchart-paper-1';
    this.lastImportStatus = null;
  }

  render(container) {
    if (!container) return;
    const isFa = getLanguage() === 'fa';
    const accounts = this.store.getAccounts().filter(a => a.id !== 'all');

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
        <!-- Header Banner -->
        <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 12px 14px;">
          <div style="font-weight: 800; font-size: 13px; color: #38bdf8; display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>${isFa ? 'درون‌ریزی هوشمند صورت‌حساب معاملات بروکرها و پلتفرم‌ها' : 'Institutional Statement & Export Importer'}</span>
          </div>
          <div style="font-size: 11px; color: #94a3b8; line-height: 1.6;">
            ${isFa 
              ? 'پشتیبانی خودکار از ۱۴ فرمت بین‌المللی: تریدینگ‌ویو (TradingView Paper/Strategy)، متاتریدر ۴ و ۵ (MT4/MT5 HTML & Deals)، نینجاتریدر (NinjaTrader)، تینک‌اور‌سوییم (ThinkorSwim)، اینتراکتیو بروکرز (IBKR Flex & Activity)، تاپ‌استپ (TopstepX)، ترادوات (Tradovate)، وبول (Webull)، داس‌تریدر (DAS Trader) و مهاجرت با ۱ کلیک از TradeZella و Tradervue.'
              : 'Auto-detects 14 documented formats: TradingView (paper & strategy), MetaTrader 4 & 5 (HTML & Deals CSV), NinjaTrader, ThinkorSwim, IBKR (Activity & Flex), TopstepX, Tradovate, Webull, DAS Trader, plus 1-click migration from TradeZella and Tradervue.'}
          </div>
        </div>

        <!-- Account Target Selector -->
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <label style="font-size: 12px; font-weight: 700; color: #fff;">
            ${isFa ? 'ذخیره معاملات در حساب:' : 'Target Account:'}
          </label>
          <select id="import-account-target" style="padding: 6px 12px; background: #0c1017; border: 1px solid #1f293d; border-radius: 6px; color: #fff; font-size: 12px; min-width: 220px;">
            ${accounts.map(a => `
              <option value="${a.id}" ${a.id === this.selectedAccountId ? 'selected' : ''}>${(getLanguage() === 'fa' && a.nameFa) || a.name}</option>
            `).join('')}
          </select>
        </div>

        <!-- Dropzone -->
        <div id="import-dropzone" style="border: 2px dashed #253248; border-radius: 10px; padding: 28px 16px; text-align: center; background: rgba(255,255,255,0.01); cursor: pointer; transition: all 0.2s ease;">
          <input type="file" id="import-file-input" accept=".csv,.txt,.html,.htm" style="display: none;" />
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(0, 242, 176, 0.1); display: flex; align-items: center; justify-content: center; color: #00f2b0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #fff;">
              ${isFa ? 'فایل CSV یا HTML گزارش معاملات را اینجا بکشید یا کلیک کنید' : 'Drop your statement file here, or click to browse'}
            </div>
            <div style="font-size: 11px; color: #64748b;">
              ${isFa ? 'فرمت به طور خودکار شناسایی و اعتبارسنجی خواهد شد.' : 'Supported: .csv, .html, .txt (up to 20MB)'}
            </div>
          </div>
        </div>

        <!-- Paste Alternative -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: 600; color: #94a3b8;">${isFa ? 'یا متن محتوای CSV را مستقیماً پیست کنید:' : 'Or paste CSV raw text directly:'}</span>
            <button id="btn-parse-pasted" class="btn-primary" style="font-size: 11px; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
              ${isFa ? 'پردازش متن پیست‌شده' : 'Parse Pasted Text'}
            </button>
          </div>
          <textarea id="import-text-paste" placeholder="${isFa ? 'ستون‌های تاریخ، نماد، قیمت و حجم را اینجا الصاق کنید...' : 'Paste raw CSV rows here...'}" style="width: 100%; height: 80px; background: #080b11; border: 1px solid #1c263c; border-radius: 6px; padding: 8px 10px; color: #fff; font-family: monospace; font-size: 11px; resize: vertical; box-sizing: border-box;"></textarea>
        </div>

        <!-- Preview & Reconciliation Card (Hidden until parsed) -->
        <div id="import-preview-card" style="display: none; background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 14px; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; color: #94a3b8;">${isFa ? 'فرمت شناسایی‌شده:' : 'Detected Format:'}</span>
              <span id="detected-format-badge" style="font-size: 11px; font-weight: 800; background: rgba(0, 242, 176, 0.15); color: #00f2b0; padding: 2px 8px; border-radius: 4px;">—</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <span id="parsed-count-badge" style="font-size: 11px; font-weight: 700; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 8px; border-radius: 4px;">0 Executions</span>
            </div>
          </div>

          <!-- Preview Table -->
          <div style="max-height: 180px; overflow-y: auto; border: 1px solid #1c263c; border-radius: 6px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
              <thead>
                <tr style="background: #080b11; color: #94a3b8; border-bottom: 1px solid #1c263c;">
                  <th style="padding: 6px 10px;">Symbol</th>
                  <th style="padding: 6px 10px;">Side</th>
                  <th style="padding: 6px 10px;">Price</th>
                  <th style="padding: 6px 10px;">Qty</th>
                  <th style="padding: 6px 10px;">Executed At</th>
                  <th style="padding: 6px 10px;">Fee</th>
                </tr>
              </thead>
              <tbody id="import-preview-rows">
              </tbody>
            </table>
          </div>

          <!-- Commit Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span id="import-reconcile-msg" style="font-size: 11px; color: #94a3b8;"></span>
            <button id="btn-commit-import" class="btn-primary" style="font-size: 12px; font-weight: 800; padding: 8px 20px; border-radius: 6px; background: #00f2b0; color: #080b11; cursor: pointer; border: none; display: flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>${isFa ? 'تایید و افزودن به ژورنال' : 'Commit to Journal'}</span>
            </button>
          </div>
        </div>

        <!-- Success Toast -->
        <div id="import-success-toast" style="display: ${this.lastImportStatus ? 'flex' : 'none'}; background: rgba(0, 242, 176, 0.15); border: 1px solid #00f2b0; border-radius: 8px; padding: 12px 16px; color: #00f2b0; font-size: 12px; font-weight: 700; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span id="import-success-text">${this.lastImportStatus ? this.lastImportStatus.text : ''}</span>
        </div>
      </div>
    `;

    this.bindEvents(container);
  }

  bindEvents(container) {
    const isFa = getLanguage() === 'fa';
    const dropzone = container.querySelector('#import-dropzone');
    const fileInput = container.querySelector('#import-file-input');
    const pasteBtn = container.querySelector('#btn-parse-pasted');
    const pasteArea = container.querySelector('#import-text-paste');
    const targetSelect = container.querySelector('#import-account-target');
    const commitBtn = container.querySelector('#btn-commit-import');

    targetSelect?.addEventListener('change', (e) => {
      this.selectedAccountId = e.target.value;
    });

    dropzone?.addEventListener('click', () => {
      fileInput?.click();
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#00f2b0';
      dropzone.style.background = 'rgba(0, 242, 176, 0.05)';
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '#253248';
      dropzone.style.background = 'rgba(255,255,255,0.01)';
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#253248';
      dropzone.style.background = 'rgba(255,255,255,0.01)';
      const file = e.dataTransfer?.files?.[0];
      if (file) this.handleFile(file, container);
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.handleFile(file, container);
    });

    pasteBtn?.addEventListener('click', () => {
      const text = pasteArea?.value || '';
      if (!text.trim()) return;
      this.parseContent(text, container, 'Pasted Text');
    });

    commitBtn?.addEventListener('click', () => {
      if (!this.parsedResult || !this.parsedResult.executions) return;
      const toImport = this.parsedResult.executions;
      const totalExecs = toImport.length;
      
      this.lastImportStatus = {
        count: totalExecs,
        text: isFa
          ? `تعداد ${totalExecs} معامله با موفقیت به حساب انتخاب‌شده اضافه شد.`
          : `Successfully imported ${totalExecs} executions into selected account.`
      };
      this.parsedResult = null;

      this.store.addExecutions(toImport, this.selectedAccountId);
      this.render(container);
      setTimeout(() => {
        this.lastImportStatus = null;
        this.render(container);
      }, 5000);
    });
  }

  handleFile(file, container) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      this.parseContent(content, container, file.name);
    };
    reader.readAsText(file);
  }

  parseContent(content, container, sourceName = 'File') {
    const isFa = getLanguage() === 'fa';
    const detected = detectFormat(content);
    const parsed = parseAuto(content);

    const previewCard = container.querySelector('#import-preview-card');
    const formatBadge = container.querySelector('#detected-format-badge');
    const countBadge = container.querySelector('#parsed-count-badge');
    const rowsBody = container.querySelector('#import-preview-rows');
    const reconcileMsg = container.querySelector('#import-reconcile-msg');

    if (!parsed || !parsed.executions || parsed.executions.length === 0) {
      if (formatBadge) {
        formatBadge.textContent = isFa ? 'فرمت نامعتبر' : 'Unrecognized Format';
        formatBadge.style.color = '#ff4d5b';
        formatBadge.style.background = 'rgba(255, 77, 91, 0.15)';
      }
      if (reconcileMsg) {
        reconcileMsg.textContent = isFa 
          ? 'ستون‌های الزامی (Symbol, Side, Price, Qty) یافت نشد.' 
          : 'Required columns (Symbol, Side, Price, Qty) were not detected.';
        reconcileMsg.style.color = '#ff4d5b';
      }
      if (previewCard) previewCard.style.display = 'flex';
      return;
    }

    this.parsedResult = parsed;
    this.detectedFormatName = detected?.label || detected?.id || 'Auto-Detected Format';

    if (formatBadge) formatBadge.textContent = this.detectedFormatName;
    if (countBadge) countBadge.textContent = `${parsed.executions.length} Executions`;

    if (rowsBody) {
      const previewRows = parsed.executions.slice(0, 15);
      rowsBody.innerHTML = previewRows.map(e => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
          <td style="padding: 6px 10px; font-weight: 700; color: #fff;">${e.symbol}</td>
          <td style="padding: 6px 10px; color: ${e.side === 'buy' ? '#00f2b0' : '#ff4d5b'}; font-weight: 700;">${e.side.toUpperCase()}</td>
          <td style="padding: 6px 10px; color: #fff;">${Number(e.price).toFixed(2)}</td>
          <td style="padding: 6px 10px; color: #fff;">${e.quantity}</td>
          <td style="padding: 6px 10px; color: #94a3b8;">${e.executedAt ? new Date(e.executedAt).toLocaleString() : '—'}</td>
          <td style="padding: 6px 10px; color: #64748b;">${e.fee || 0}</td>
        </tr>
      `).join('');
    }

    if (reconcileMsg) {
      reconcileMsg.textContent = isFa
        ? `${parsed.executions.length} معامله آماده ذخیره‌سازی است (معاملات تکراری فیلتر می‌شوند).`
        : `${parsed.executions.length} executions ready to import (duplicates will be filtered).`;
    }

    if (previewCard) previewCard.style.display = 'flex';
  }
}
