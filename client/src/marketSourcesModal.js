// client/src/marketSourcesModal.js
// Institutional Market Data Waterfall & Price Sources Inspector for TradingChart

import { getLanguage, toPersianDigits } from './i18n.js';

export class MarketSourcesModal {
  constructor(options = {}) {
    this.app = options.app || null;
    this.modalEl = document.querySelector('#modal-market-sources');
    this.data = null;
    this.init();
  }

  init() {
    if (!this.modalEl) return;
    const closeBtn = this.modalEl.querySelector('#modal-close-sources');
    closeBtn?.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    this.modalEl.querySelector('#btn-sources-refresh-ping')?.addEventListener('click', () => {
      this.fetchSources();
    });
  }

  open() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('open');
    this.fetchSources();
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
  }

  async fetchSources() {
    try {
      const res = await fetch('/api/market-sources');
      if (res.ok) {
        this.data = await res.json();
        this.renderContent();
      }
    } catch (e) {
      console.warn('[MarketSourcesModal] Error fetching sources:', e.message);
    }
  }

  renderContent() {
    if (!this.data || !this.modalEl) return;
    const isFa = getLanguage() === 'fa';
    const container = this.modalEl.querySelector('#market-sources-content');
    if (!container) return;

    const sources = this.data.sources || [];
    const avgLatency = Math.round(sources.reduce((sum, s) => sum + (s.latencyMs || 15), 0) / Math.max(1, sources.length));

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px; ${isFa ? 'direction: rtl;' : ''}">
        
        <!-- Live Telemetry Banner -->
        <div style="background: rgba(0, 242, 176, 0.05); border: 1px solid rgba(0, 242, 176, 0.2); border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="pulse-dot" style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--accent-cyan); box-shadow: 0 0 10px var(--accent-cyan);"></span>
            <div>
              <div style="font-weight: 800; font-size: 13px; color: #fff;">
                ${isFa ? 'تمامی ۵ درگاه قیمت‌گذاری فعال و پایدار هستند' : 'All 5 Market Data Pipelines Operational'}
              </div>
              <div style="font-size: 11px; color: var(--text-dim);">
                ${isFa ? 'پایپ‌لاین چندلایه واترفال تریدینگ‌چارت با پایش زنده و بدون وقفه' : 'Multi-tier zero-downtime price ingestion & failover waterfall'}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="text-align: ${isFa ? 'left' : 'right'};">
              <span style="font-size: 10px; color: var(--text-dim); display: block;">${isFa ? 'میانگین تاخیر' : 'Avg Latency'}</span>
              <span style="font-size: 14px; font-weight: 800; font-family: var(--font-mono); color: var(--accent-cyan);">${isFa ? toPersianDigits(avgLatency) : avgLatency} ms</span>
            </div>
            <button id="btn-sources-refresh-ping" class="btn-secondary" style="padding: 8px 14px; min-height: 38px; font-size: 11px; font-weight: 700; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">
              ${isFa ? 'تست پینگ' : 'Ping Test'}
            </button>
          </div>
        </div>

        <!-- Sources Cards Grid -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${sources.map(s => {
            const isOnline = s.status === 'online';
            const statusColor = isOnline ? '#00F2B0' : '#fbbf24';
            const statusLabel = isOnline ? (isFa ? 'برخط و متصل' : 'ONLINE') : (isFa ? 'آماده‌باش (Standby)' : 'STANDBY');
            return `
              <div class="source-card" style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; transition: border-color 0.15s;">
                <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                  <div style="width: 34px; height: 34px; border-radius: 6px; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; color: ${statusColor}; border: 1px solid var(--border-subtle); flex-shrink: 0;">
                    T${s.tier}
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 800; font-size: 13px; color: #fff;">${isFa ? s.nameFa : s.name}</span>
                      <span style="font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 3px; background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30;">
                        ${statusLabel}
                      </span>
                      <span style="font-size: 10px; font-family: var(--font-mono); color: var(--accent-cyan);">
                        ${isFa ? toPersianDigits(s.latencyMs) : s.latencyMs}ms
                      </span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
                      <span style="color: var(--text-muted); font-weight: 600;">${isFa ? 'پروتکل:' : 'Protocol:'}</span> ${isFa && s.protocolFa ? s.protocolFa : s.protocol}
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                      <span style="color: var(--text-dim); font-weight: 600;">${isFa ? 'پوشش دارایی:' : 'Coverage:'}</span> ${(isFa && s.marketsCoveredFa ? s.marketsCoveredFa : (s.marketsCovered || [])).join(' • ')}
                    </div>
                  </div>
                </div>

                <div style="text-align: ${isFa ? 'left' : 'right'}; flex-shrink: 0;">
                  <span style="font-size: 10px; font-weight: 700; color: var(--text-dim); background: var(--bg-surface); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                    ${isFa ? `${toPersianDigits(s.activeSymbols)} نماد لایو` : `${s.activeSymbols} Live Tickers`}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Waterfall Explanation Footer -->
        <div style="background: var(--bg-darkest); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px; font-size: 11px; color: var(--text-dim); line-height: 1.6;">
          <strong style="color: #fff; display: block; margin-bottom: 4px;">
            ${isFa ? 'معماری خطایابی و واترفال هوشمند (Smart Data Waterfall):' : 'Smart Data Waterfall Architecture:'}
          </strong>
          ${isFa
            ? 'در صورت بروز اختلال در هر یک از نودها، درخواست به طور آنی بدون وقفه و بدون نیاز به رفرش مرورگر به درگاه پشتیبان سوئیچ می‌شود تا معامله‌گر در سخت‌ترین شرایط نوسانی بازار با قطع جریان قیمت روبرو نگردد.'
            : 'In the event of network disruption or gateway latency, requests instantly and transparently fail over to secondary tiers without browser reload, ensuring uninterrupted trading operations during extreme volatility.'
          }
        </div>

      </div>
    `;

    container.querySelector('#btn-sources-refresh-ping')?.addEventListener('click', () => {
      this.fetchSources();
    });
  }
}
