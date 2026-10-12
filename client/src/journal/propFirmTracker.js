// client/src/journal/propFirmTracker.js
// Institutional Prop Firm Challenge & Cash Flow Management Suite
// Seamlessly syncs with TradingChart Prop-Firm Simulator

import { getLanguage } from '../i18n.js';

export class PropFirmTracker {
  constructor(journalStore, app = null) {
    this.store = journalStore;
    this.app = app;
  }

  render(container) {
    if (!container) return;
    const isFa = getLanguage() === 'fa';
    const firms = this.store.getPropFirms();

    const totalInvested = firms.reduce((sum, f) => sum + (f.evalFee || 0) + (f.resetFees || 0), 0);
    const totalPayouts = firms.reduce((sum, f) => sum + (f.payoutsReceived || 0), 0);
    const netRoi = totalInvested > 0 ? ((totalPayouts - totalInvested) / totalInvested) * 100 : 0;
    const privacy = this.store.settings.privacyMode;

    const fmtMoney = (val) => privacy ? '$***.**' : `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
        <!-- Top Cash Flow KPI Ribbon -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
          <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'کل سرمایه‌گذاری (هزینه چالش‌ها)' : 'Total Evaluation Fees'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #fff; margin-top: 4px;" class="num-ltr">${fmtMoney(totalInvested)}</div>
          </div>
          <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'کل دریافتی از پراپ (برداشت سود)' : 'Total Payouts Received'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #00f2b0; margin-top: 4px;" class="num-ltr">${fmtMoney(totalPayouts)}</div>
          </div>
          <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'بازدهی خالص سرمایه (Cash ROI)' : 'Net Cash ROI'}</div>
            <div style="font-size: 18px; font-weight: 800; color: ${netRoi >= 0 ? '#00f2b0' : '#ff4d5b'}; margin-top: 4px;" class="num-ltr">
              ${netRoi >= 0 ? '+' : ''}${netRoi.toFixed(1)}%
            </div>
          </div>
          <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'چالش‌های فعال' : 'Active Challenges'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #38bdf8; margin-top: 4px;" class="num-ltr">${firms.filter(f => f.status === 'active').length}</div>
          </div>
        </div>

        <!-- Section Header with Actions -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 13px; font-weight: 700; color: #fff;">
            ${isFa ? 'مدیریت و پایش حساب‌های پراپ فرم' : 'Prop Firm Accounts & Evaluations'}
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-add-prop-challenge" class="btn-primary" style="font-size: 11px; font-weight: 700; padding: 6px 14px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <span>+</span> <span>${isFa ? 'افزودن حساب پراپ جدید' : 'Add Prop Challenge'}</span>
            </button>
            <button id="btn-open-prop-sim" style="font-size: 11px; font-weight: 700; padding: 6px 14px; border-radius: 6px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/><path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-6 6h0a6 6 0 0 1-6-6V6a2 2 0 0 1 2-2Z"/></svg>
              <span>${isFa ? 'شبیه‌ساز پیشرفته پراپ (Simulator)' : 'Prop-Firm Simulator'}</span>
            </button>
          </div>
        </div>

        <!-- Prop Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
          ${firms.map(f => {
            const profit = f.currentBalance - f.initialBalance;
            const progressPct = Math.min(100, Math.max(0, (profit / f.targetProfit) * 100));
            const drawdownBuffer = (f.currentBalance - (f.initialBalance - f.maxLossLimit));
            const isNearBreach = drawdownBuffer < (f.maxLossLimit * 0.25);
            return `
              <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <div style="font-size: 14px; font-weight: 800; color: #fff;">${f.firmName} - ${fmtMoney(f.initialBalance)}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${f.accountNumber || f.id} · ${f.phase}</div>
                  </div>
                  <span style="font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: rgba(0, 242, 176, 0.15); color: #00f2b0;">
                    ${f.status.toUpperCase()}
                  </span>
                </div>

                <!-- Balance & Profit -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(255,255,255,0.02); padding: 8px 10px; border-radius: 6px;">
                  <div>
                    <div style="font-size: 10px; color: #94a3b8;">${isFa ? 'موجودی فعلی' : 'Current Balance'}</div>
                    <div style="font-size: 14px; font-weight: 800; color: #fff;" class="num-ltr">${fmtMoney(f.currentBalance)}</div>
                  </div>
                  <div>
                    <div style="font-size: 10px; color: #94a3b8;">${isFa ? 'سود محقق‌شده' : 'Realized Profit'}</div>
                    <div style="font-size: 14px; font-weight: 800; color: ${profit >= 0 ? '#00f2b0' : '#ff4d5b'};" class="num-ltr">
                      ${profit >= 0 ? '+' : ''}${fmtMoney(profit)}
                    </div>
                  </div>
                </div>

                <!-- Target Progress Bar -->
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
                    <span style="color: #94a3b8;">${isFa ? 'پیشرفت به سوی تارگت سود' : 'Profit Target Progress'} (${fmtMoney(f.targetProfit)})</span>
                    <span style="color: #00f2b0; font-weight: 700;">${progressPct.toFixed(1)}%</span>
                  </div>
                  <div style="height: 6px; background: #1c263c; border-radius: 3px; overflow: hidden;">
                    <div style="width: ${progressPct}%; height: 100%; background: #00f2b0; border-radius: 3px; transition: width 0.3s ease;"></div>
                  </div>
                </div>

                <!-- Drawdown Buffer Alert -->
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 6px 8px; border-radius: 6px; background: ${isNearBreach ? 'rgba(255, 77, 91, 0.12)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isNearBreach ? 'rgba(255, 77, 91, 0.3)' : 'transparent'};">
                  <span style="color: ${isNearBreach ? '#ff4d5b' : '#94a3b8'};">${isFa ? 'حاشیه امن افت سرمایه (Drawdown Buffer):' : 'Drawdown Buffer:'}</span>
                  <span style="font-weight: 800; color: ${isNearBreach ? '#ff4d5b' : '#38bdf8'};" class="num-ltr">${fmtMoney(drawdownBuffer)}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.bindEvents(container);
  }

  bindEvents(container) {
    const isFa = getLanguage() === 'fa';
    const addBtn = container.querySelector('#btn-add-prop-challenge');
    const simBtn = container.querySelector('#btn-open-prop-sim');

    addBtn?.addEventListener('click', () => {
      const firmName = prompt(isFa ? 'نام شرکت پراپ فرم (مثلاً FTMO, Topstep, FundedNext):' : 'Prop Firm Name:', 'Topstep');
      if (!firmName) return;
      const sizeStr = prompt(isFa ? 'حجم حساب (دلار، مثلاً 50000):' : 'Account Size in USD:', '50000');
      const size = Number(sizeStr) || 50000;
      
      const newFirm = {
        id: `prop-${Date.now()}`,
        firmName,
        accountId: `prop-${firmName.toLowerCase()}-${size / 1000}k`,
        accountNumber: `${firmName.toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`,
        initialBalance: size,
        currentBalance: size,
        targetProfit: size * 0.1,
        maxLossLimit: size * 0.1,
        dailyLossLimit: size * 0.05,
        phase: 'Phase 1',
        status: 'active',
        evalFee: size * 0.005,
        resetFees: 0,
        payoutsRequested: 0,
        payoutsReceived: 0,
        startDate: new Date().toISOString().slice(0, 10),
        notes: 'Created via TradingChart Journal.'
      };

      const existing = this.store.getPropFirms();
      existing.unshift(newFirm);
      this.store.savePropFirms(existing);
      this.render(container);
    });

    simBtn?.addEventListener('click', () => {
      if (this.app?.switchBottomTab) {
        this.app.switchBottomTab('propsim');
      } else {
        const bottomPanel = document.querySelector('#bottom-panel');
        bottomPanel?.classList.remove('collapsed');
        document.querySelector('.panel-tab[data-view="propsim"]')?.click();
      }
    });
  }
}
