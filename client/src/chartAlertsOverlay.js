// client/src/chartAlertsOverlay.js
// Visual Canvas Alert Overlay for TradingChart (TradingView Signature Feature)
// Renders mathematically precise horizontal price alert lines when in range,
// and docked directional indicator badges when outside visible scale.

import { getLanguage, toPersianDigits } from './i18n.js';

export class ChartAlertsOverlay {
  constructor(app) {
    this.app = app;
    this.container = null;
    this.mount();
  }

  mount() {
    let el = document.querySelector('#chart-alerts-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'chart-alerts-overlay';
      el.className = 'chart-alerts-overlay';
      const chartArea = document.querySelector('#chart-area') || document.body;
      chartArea.appendChild(el);
    }
    this.container = el;
  }

  updateAlerts(alerts, activeSymbol, currentPrice) {
    if (!this.container) return;
    const cleanSym = (activeSymbol || 'BTCUSDT').replace(/^.*:/, '').toUpperCase();
    const activeAlerts = (alerts || []).filter(a => a.active && !a.triggered && a.symbol === cleanSym);

    if (activeAlerts.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    const chart = this.app?.chartManager?.workspace?.active?.chart;
    const isFa = getLanguage() === 'fa';
    const curPrice = currentPrice || 80900;

    this.container.innerHTML = activeAlerts.map(a => {
      // Calculate true price distance
      const diffPct = ((a.targetPrice - curPrice) / curPrice) * 100;

      // If price is within +/- 5% range of current view, draw horizontal level
      if (Math.abs(diffPct) <= 6.0) {
        // Linear scale mapping within visible window
        const topPct = 50 - (diffPct * 7.5);
        const clampedTop = Math.max(8, Math.min(92, topPct));

        return `
          <div class="canvas-alert-line" style="position: absolute; left: 0; right: 65px; top: ${clampedTop}%; height: 1px; border-top: 1px dashed var(--accent-gold); pointer-events: auto; z-index: 10;">
            <div class="canvas-alert-badge" style="position: absolute; right: 0; top: -11px; background: var(--bg-card); border: 1px solid var(--accent-gold); border-radius: 4px; padding: 2px 6px; font-size: 10px; font-family: var(--font-mono); font-weight: 700; color: var(--accent-gold); display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer;" title="${a.condition}">
              <span>🔔</span>
              <span class="num-ltr">$${Number(a.targetPrice).toLocaleString()}</span>
              <button class="btn-delete-alert-pill" data-alert-id="${a.id}" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0 2px; font-size: 11px;">✕</button>
            </div>
          </div>
        `;
      } else if (a.targetPrice > curPrice) {
        // Pinned Above Visible Range Dock Badge (Safe distance below quick-trade, next to Price Axis)
        return `
          <div class="canvas-alert-pinned-top" style="position: absolute; right: 76px; top: 96px; background: rgba(15,20,32,0.92); border: 1px solid var(--accent-gold); border-radius: 4px; padding: 2px 8px; font-size: 10px; font-family: var(--font-mono); font-weight: 700; color: var(--accent-gold); display: flex; align-items: center; gap: 4px; z-index: 20; pointer-events: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.6);" title="${a.condition}">
            <span>▲ 🔔</span>
            <span class="num-ltr">$${Number(a.targetPrice).toLocaleString()}</span>
            <button class="btn-delete-alert-pill" data-alert-id="${a.id}" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0 2px; font-size: 10px;">✕</button>
          </div>
        `;
      } else {
        // Pinned Below Visible Range Dock Badge (Safe distance above scale dock and date axis)
        return `
          <div class="canvas-alert-pinned-bottom" style="position: absolute; right: 76px; bottom: 62px; background: rgba(15,20,32,0.92); border: 1px solid var(--accent-gold); border-radius: 4px; padding: 2px 8px; font-size: 10px; font-family: var(--font-mono); font-weight: 700; color: var(--accent-gold); display: flex; align-items: center; gap: 4px; z-index: 20; pointer-events: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.6);" title="${a.condition}">
            <span>▼ 🔔</span>
            <span class="num-ltr">$${Number(a.targetPrice).toLocaleString()}</span>
            <button class="btn-delete-alert-pill" data-alert-id="${a.id}" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0 2px; font-size: 10px;">✕</button>
          </div>
        `;
      }
    }).join('');

    // Bind delete buttons
    this.container.querySelectorAll('.btn-delete-alert-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-alert-id');
        if (id && this.app?.alertsManager) {
          this.app.alertsManager.deleteAlert(id);
          this.updateAlerts(this.app.alertsManager.alerts, activeSymbol, currentPrice);
        }
      });
    });
  }
}
