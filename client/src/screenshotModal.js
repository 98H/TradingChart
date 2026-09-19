// client/src/screenshotModal.js
// Interactive Screenshot Preview & Export Modal for TradingChart (TradingView Parity)
// Features instant multi-layer canvas composition, download, link copying, and pre-formatted Analysis / Social Post copy

import { getLanguage, t } from './i18n.js';

export class ScreenshotModal {
  constructor(app) {
    this.app = app;
  }

  captureCompositeCanvas() {
    try {
      const chartMount = document.querySelector('#vela-workspace-mount') || document.querySelector('#chart-area');
      const canvases = Array.from(chartMount?.querySelectorAll('canvas') || []).filter(c => c.width > 0 && c.height > 0);
      if (canvases.length === 0) return null;

      const width = Math.max(...canvases.map(c => c.width));
      const height = Math.max(...canvases.map(c => c.height));

      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const ctx = out.getContext('2d');

      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, width, height);

      for (const c of canvases) {
        try {
          ctx.drawImage(c, 0, 0, width, height);
        } catch (e) {
          console.warn('[ScreenshotModal] Canvas drawImage error:', e);
        }
      }
      return out.toDataURL('image/png');
    } catch (err) {
      console.warn('[ScreenshotModal] Composite error:', err);
      return null;
    }
  }

  open(imageSrc) {
    if (!imageSrc) {
      imageSrc = this.captureCompositeCanvas();
    }

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
        <div style="padding: 14px 18px; background: #080b11; border-bottom: 1px solid #1c263c; display: flex; justify-content: space-between; align-items: center; ${isFa ? 'direction: rtl;' : ''}">
          <div style="font-weight: 700; font-size: 14px; color: #fff; display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan);"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>${isFa ? 'تصویر چارت و اشتراک‌گذاری ایده تحلیلی' : 'Chart Snapshot & Idea Sharing'}</span>
          </div>
          <button id="btn-close-screenshot" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 4px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div style="padding: 16px; display: flex; flex-direction: column; gap: 14px; ${isFa ? 'direction: rtl;' : ''}">
          <!-- Snapshot Preview Frame -->
          <div style="width: 100%; max-height: 340px; background: #06090e; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${imageSrc ? `<img id="screenshot-canvas-preview" src="${imageSrc}" style="width: 100%; height: auto; object-fit: contain;" alt="Chart Snapshot" />` : `
              <div style="padding: 40px; text-align: center; color: var(--text-dim); font-size: 12px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 8px; color: var(--accent-cyan);"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
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
            <button id="btn-dl-screenshot" class="btn-primary" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px; font-size: 11px; cursor: pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>${isFa ? 'دانلود تصویر (PNG)' : 'Download PNG'}</span>
            </button>
            <button id="btn-copy-screenshot-link" class="btn-secondary" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px; font-size: 11px; cursor: pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <span>${isFa ? 'کپی لینک اشتراک' : 'Copy Link'}</span>
            </button>
            <button id="btn-copy-social-text" class="btn-secondary" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px; font-size: 11px; cursor: pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>${isFa ? 'کپی متن تحلیل' : 'Copy Post Text'}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');

    const close = () => modal.classList.remove('open');
    modal.querySelector('#btn-close-screenshot')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    // 1. Download
    modal.querySelector('#btn-dl-screenshot')?.addEventListener('click', () => {
      const a = document.createElement('a');
      a.download = `TradingChart_${sym}_${Date.now()}.png`;
      a.href = imageSrc || this.captureCompositeCanvas();
      a.click();
      this.app?.showToast?.(isFa ? 'تصویر با موفقیت ذخیره شد' : 'Chart image downloaded successfully', 'success');
    });

    // 2. Copy Link
    modal.querySelector('#btn-copy-screenshot-link')?.addEventListener('click', async () => {
      const shareUrl = `${window.location.origin}/?symbol=${sym}&tf=${tf}&snap=true`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        this.app?.showToast?.(isFa ? 'لینک اشتراک‌گذاری کپی شد' : 'Share link copied to clipboard', 'success');
      } catch (err) {
        this.app?.showToast?.(isFa ? 'خطا در دسترسی به کلیپ‌بورد' : 'Clipboard access denied', 'error');
      }
    });

    // 3. Copy Social Text
    modal.querySelector('#btn-copy-social-text')?.addEventListener('click', async () => {
      const text = `📊 #TradingChart Analysis for #${sym}\nTimeframe: ${tf}m\nCurrent Price: $${lastPrice}\nAnalysis: LuxAlgo Signals & SMC Confluence active.\nShared via TradingChart Terminal 🚀`;
      try {
        await navigator.clipboard.writeText(text);
        this.app?.showToast?.(isFa ? 'متن تحلیل کپی شد' : 'Analysis post text copied to clipboard', 'success');
      } catch (err) {
        this.app?.showToast?.(isFa ? 'خطا در دسترسی به کلیپ‌بورد' : 'Clipboard access denied', 'error');
      }
    });
  }
}
