// client/src/userProfileModal.js
// Institutional Trader Profile & Account Management Modal

import { getLanguage, t } from './i18n.js';

export class UserProfileModal {
  constructor(app) {
    this.app = app;
  }

  open() {
    let modal = document.querySelector('#modal-user-profile');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-user-profile';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const isFa = getLanguage() === 'fa';
    const equity = this.app?.paperTrading?.calculateEquity() || 100000;
    const netPnl = equity - 100000;
    const netPnlPct = (netPnl / 100000) * 100;
    const isProfit = netPnl >= 0;

    modal.innerHTML = `
      <div class="modal-box user-profile-box" style="max-width: 440px; width: 92vw; background: #0c1017; border: 1px solid #1f293d; border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.8); overflow: hidden; display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="padding: 16px 18px; background: #080b11; border-bottom: 1px solid #1c263c; display: flex; justify-content: space-between; align-items: center; ${isFa ? 'flex-direction: row; direction: rtl;' : 'direction: ltr;'}">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #1a2234; color: #fff; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid var(--accent-cyan); letter-spacing: 0.5px;">
              HM
            </div>
            <div>
              <div style="font-weight: 800; font-size: 15px; color: #fff;">${isFa ? 'حسین محمدی' : 'Hussein Mohammadi'}</div>
              <div style="margin-top: 3px;">
                <span style="font-size: 10px; font-weight: 800; color: var(--accent-cyan); background: rgba(0, 242, 176, 0.12); border: 1px solid rgba(0, 242, 176, 0.3); padding: 2px 8px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;">
                  👑 ${isFa ? 'معامله‌گر نهادی VIP' : 'INSTITUTIONAL PRO VIP'}
                </span>
              </div>
            </div>
          </div>
          <button id="btn-close-user-profile" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: var(--text-dim); cursor: pointer; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div style="padding: 16px; display: flex; flex-direction: column; gap: 14px; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
          <!-- Account Metrics Card -->
          <div style="background: var(--bg-card); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <div style="font-size: 11px; font-weight: 600; color: #cbd5e1;">${isFa ? 'ارزش جاری پورتفولیوی دمو' : 'Virtual Capital Equity'}</div>
              <div style="font-size: 22px; font-weight: 800; color: #fff; line-height: 1.2;" class="num-ltr">$${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="font-size: 12px; font-weight: 700; color: ${isProfit ? 'var(--accent-green)' : 'var(--accent-red)'}; margin-top: 2px; display: flex; align-items: center; gap: 4px;" class="num-ltr">
                <span>${isProfit ? '▲' : '▼'}</span>
                <span>${isProfit ? '+' : '-'}$${Math.abs(netPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${isProfit ? '+' : ''}${netPnlPct.toFixed(2)}%)</span>
              </div>
            </div>
            <button id="btn-profile-reset-paper" class="btn-secondary" style="font-size: 11px; font-weight: 600; padding: 6px 12px; display: flex; align-items: center; gap: 4px; border-color: rgba(239,68,68,0.3); color: #f87171;" title="${isFa ? 'بازنشانی موجودی و سابقه معاملات دمو' : 'Reset virtual capital and paper trading positions'}">
              <span>↺</span> ${isFa ? 'بازنشانی' : 'Reset'}
            </button>
          </div>

          <!-- Connection Protocol Telemetry -->
          <div style="background: var(--bg-surface); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #cbd5e1; font-weight: 600;">${isFa ? 'شناسه حساب:' : 'Account ID:'}</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="num-ltr" style="font-weight: 700; color: #fff; font-family: var(--font-mono);">TC-8942-INST</span>
                <button id="btn-copy-acc-id" style="background: transparent; border: none; color: #cbd5e1; cursor: pointer; padding: 2px;" title="Copy Account ID">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #cbd5e1; font-weight: 600;">${isFa ? 'دروازه فید داده:' : 'Market Feed Gateway:'}</span>
              <span style="font-weight: 700; color: var(--accent-cyan);">${isFa ? 'وب‌سوکت بایننس + متاتریدر ۵' : 'Binance WebSocket + MT5 Bridge'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #cbd5e1; font-weight: 600;">${isFa ? 'وضعیت لتنسی اتصال:' : 'Latency Telemetry:'}</span>
              <span style="font-weight: 700; color: var(--accent-green); display: flex; align-items: center; gap: 5px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green);"></span>
                ${isFa ? 'زنده (۱۲ میلی‌ثانیه)' : 'Live 12ms'}
              </span>
            </div>
          </div>

          <!-- Quick Switches -->
          <div style="display: flex; gap: 8px;">
            <button id="btn-profile-toggle-lang" class="btn-secondary" style="flex: 1; justify-content: center; font-size: 11px; padding: 8px;">
              🌐 ${isFa ? 'تغییر زبان به English (EN)' : 'Switch to فارسی (FA)'}
            </button>
            <button id="btn-profile-shortcuts" class="btn-secondary" style="flex: 1; justify-content: center; font-size: 11px; padding: 8px;">
              ⌨ ${isFa ? 'کلیدهای میانبر (?)' : 'Keyboard Shortcuts'}
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');

    modal.querySelector('#btn-close-user-profile')?.addEventListener('click', () => {
      modal.classList.remove('open');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    // Copy Account ID
    modal.querySelector('#btn-copy-acc-id')?.addEventListener('click', () => {
      navigator.clipboard.writeText('TC-8942-INST');
      this.app.showExecutionToast('COPY', 1, 'Account ID');
    });

    // Reset with confirmation
    modal.querySelector('#btn-profile-reset-paper')?.addEventListener('click', () => {
      const confirmed = confirm(isFa ? 'آیا از بازنشانی موجودی حساب دمو به ۱۰۰,۰۰۰ دلار اطمینان دارید؟' : 'Reset virtual capital back to $100,000.00?');
      if (confirmed && this.app?.paperTrading) {
        this.app.paperTrading.balance = 100000.0;
        this.app.paperTrading.positions = [];
        this.app.paperTrading.updatePositionsView();
        this.open();
        this.app.showExecutionToast('RESET', 100000, 'USD');
      }
    });

    modal.querySelector('#btn-profile-toggle-lang')?.addEventListener('click', () => {
      const next = getLanguage() === 'en' ? 'fa' : 'en';
      this.app?.switchLanguage(next);
      this.open();
    });

    modal.querySelector('#btn-profile-shortcuts')?.addEventListener('click', () => {
      modal.classList.remove('open');
      this.app?.shortcutsModal?.open();
    });
  }
}
