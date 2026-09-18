// client/src/screenshotModal.js
// Interactive Screenshot Preview & Export Modal for TradingChart (TradingView Parity)
// Features instant image download, link copying, and pre-formatted Analysis / Social Post copy

import { getLanguage, t } from './i18n.js';

export class ScreenshotModal {
  constructor(app) {
    this.app = app;
  }

  open(imageSrc) {
    let modal = document.querySelector('#modal-screenshot-preview');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-screenshot-preview';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const isFa = getLanguage() === 'fa';
    const sym = this.app?.currentSymbol || 'BTCUSDT';
    const tf = this.app?.currentTimeframe || '60';
    const lastPrice = this.app?.paperTrading?.lastPrice || 80900;

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 640px; width: 94vw; background: #0c1017; border: 1px solid #1f293d; border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.8); overflow: hidden; display: flex; flex-direction: column; font-family: var(--font-sans);">
        <!-- Header -->
        <div style="padding: 14px 18px; background: #080b11; border-bottom: 1px solid #1c263c; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 700; font-size: 14px; color: #fff; display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan);"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>${isFa ? 'تصویر چارت و اشتراک‌گذاری ایده تحلیلی' : 'Chart Snapshot & Idea Sharing'}</span>
          </div>
          <button id="btn-close-screenshot" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 4px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
          <!-- Snapshot Preview Frame -->
          <div style="width: 100%; max-height: 340px; background: #06090e; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${imageSrc ? `<img src="${imageSrc}" style="width: 100%; height: auto; object-fit: contain;" alt="Chart Snapshot" />` : `
              <div style="padding: 40px; text-align: center; color: var(--text-dim); font-size: 12px;">
                <div style="font-size: 24px; margin-bottom: 8px;">📷</div>
                <div>${isFa ? 'تصویر چارت با موفقیت ثبت شد.' : 'Chart snapshot ready for export.'}</div>
              </div>
            `}
          </div>

          <!-- Metadata info -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; background: var(--bg-card); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-dim);">
              <span style="font-weight: 800; color: #fff;">${sym}</span> · <span style="color: var(--accent-cyan); font-weight: 700;">${tf}</span> · <span class="num-ltr">$${Number(lastPrice).toLocaleString()}</span>
            </div>
            <span style="font-size: 10px; color: var(--text-dim);">TradingChart LuxAlgo WebGL2 Engine</span>
          </div>

          <!-- Action buttons -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <button id="btn-dl-screenshot" class="btn-primary" style="justify-content: center; padding: 7px; font-size: 11px;">
              💾 ${isFa ? 'دانلود تصویر (PNG)' : 'Download PNG'}
            </button>
            <button id="btn-copy-screenshot-link" class="btn-secondary" style="justify-content: center; padding: 7px; font-size: 11px;">
              📋 ${isFa ? 'کپی لینک اشتراک' : 'Copy Link'}
            </button>
            <button id="btn-copy-social-text" class="btn-secondary" style="justify-content: center; padding: 7px; font-size: 11px;">
              💬 ${isFa ? 'کپی متن تحلیل' : 'Copy Post Text'}
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');

    const close = () => modal.classList.remove('open');
    modal.querySelector('#btn-close-screenshot')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#btn-dl-screenshot')?.addEventListener('click', () => {
      this.app?.chartManager?.takeScreenshot();
      this.app.showExecutionToast?.('DOWNLOAD', 1, 'PNG');
      close();
    });

    modal.querySelector('#btn-copy-screenshot-link')?.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href);
      const btn = modal.querySelector('#btn-copy-screenshot-link');
      if (btn) btn.innerText = isFa ? 'کپی شد! ✓' : 'Copied! ✓';
      setTimeout(() => { if (btn) btn.innerText = isFa ? '📋 کپی لینک اشتراک' : '📋 Copy Link'; }, 2000);
    });

    modal.querySelector('#btn-copy-social-text')?.addEventListener('click', () => {
      const socialText = `📊 TradingChart Market Analysis: $${sym} (${tf})\nCurrent Price: $${Number(lastPrice).toLocaleString()}\nPowered by TradingChart Open Architecture\n#TradingChart #TechnicalAnalysis #${sym}`;
      navigator.clipboard.writeText(socialText);
      const btn = modal.querySelector('#btn-copy-social-text');
      if (btn) btn.innerText = isFa ? 'متن کپی شد! ✓' : 'Text Copied! ✓';
      setTimeout(() => { if (btn) btn.innerText = isFa ? '💬 کپی متن تحلیل' : '💬 Copy Post Text'; }, 2000);
    });
  }
}
