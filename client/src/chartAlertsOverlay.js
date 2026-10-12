// client/src/chartAlertsOverlay.js
// Visual Canvas Alert Overlay for TradingChart (TradingView Signature Feature)
// Draws price-alert lines at the EXACT pixel the engine maps the price to
// (projected through Vela's own coordinate system — never an approximation),
// and docks directional badges inside the price-axis column when the alert
// level lies outside the visible price range.

import { getLanguage } from './i18n.js';

export class ChartAlertsOverlay {
  constructor(app) {
    this.app = app;
    this.container = null;
    this._last = { alerts: [], symbol: 'BTCUSDT', price: 0 };
    this._raf = 0;
    this._sig = '';
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

    // Lines must follow the chart on pan / zoom / autoscale. Re-project on user
    // interaction (rAF-coalesced) plus a slow 1 s catch-up for autoscale on
    // live ticks; both are no-ops while no alert exists or the tab is hidden.
    const area = document.querySelector('#chart-area');
    const kick = () => this.scheduleReproject();
    if (area) {
      ['wheel', 'pointermove', 'pointerup', 'touchmove', 'touchend', 'keyup'].forEach(ev =>
        area.addEventListener(ev, kick, { passive: true }));
    }
    window.addEventListener('resize', kick, { passive: true });
    this._timer = setInterval(() => {
      if (!document.hidden && this._last.alerts.length) this.reproject();
    }, 1000);
  }

  addAlert(targetPrice, condition = null) {
    if (this.app?.alertsManager) {
      return this.app.alertsManager.addAlert(targetPrice, condition);
    }
    return null;
  }

  /** Projection helpers from the active cell's inner Vela renderer (null until mounted). */
  projection() {
    try {
      const active = this.app?.chartManager?.workspace?.active;
      const R = active?.chart?.renderer?.renderer;
      const pane = R?.scene?.panes?.get?.('price');
      const cell = active?.host;
      if (!R || !pane || !pane.scale || !cell || !this.container) return null;
      if (!(pane.bounds?.height > 0)) return null;
      const cr = cell.getBoundingClientRect();
      const or = this.container.getBoundingClientRect();
      if (cr.width < 10 || cr.height < 10) return null;
      const dy = cr.top - or.top;
      return {
        y: (price) => R.coords.priceToY(price, pane.scale, pane.bounds) + dy,
        paneTop: pane.bounds.top + dy,
        paneBottom: pane.bounds.top + pane.bounds.height + dy,
        left: cr.left - or.left,
        plotRight: (cr.right - or.left) - (R.rightAxisW || 64),
        rightInset: Math.max(0, or.right - cr.right) + 2,
        min: pane.scale.min, max: pane.scale.max, invert: !!pane.scale.invert
      };
    } catch (e) {
      return null;
    }
  }

  scheduleReproject() {
    if (this._raf || !this._last.alerts.length) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.reproject(); });
  }

  updateAlerts(alerts, activeSymbol, currentPrice) {
    if (!this.container) return;
    const cleanSym = (activeSymbol || 'BTCUSDT').replace(/^.*:/, '').toUpperCase();
    const activeAlerts = (alerts || []).filter(a => a.active && !a.triggered && a.symbol === cleanSym && Number.isFinite(Number(a.targetPrice)));
    this._last = { alerts: activeAlerts, symbol: cleanSym, price: currentPrice };
    this._sig = '';
    this.reproject();
  }

  reproject() {
    if (!this.container) return;
    const { alerts } = this._last;
    if (!alerts.length) { if (this.container.innerHTML) this.container.innerHTML = ''; this._sig = ''; return; }
    const P = this.projection();
    if (!P) return; // engine not ready — the 1 s catch-up retries

    const isFa = getLanguage() === 'fa';
    const fmt = (v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 8 });
    const items = alerts.map(a => {
      const price = Number(a.targetPrice);
      const y = P.y(price);
      if (y >= P.paneTop + 2 && y <= P.paneBottom - 2) return { a, price, kind: 'line', y: Math.round(y) };
      const aboveRange = price > P.max;
      const atTop = P.invert ? !aboveRange : aboveRange;
      return { a, price, kind: atTop ? 'top' : 'bottom', up: aboveRange };
    });

    const sig = JSON.stringify(items.map(i => [i.a.id, i.kind, i.y])) + '|' + Math.round(P.plotRight) + '|' + Math.round(P.rightInset) + '|' +
      Math.round(P.paneTop) + '|' + Math.round(P.paneBottom) + '|' + (isFa ? 'fa' : 'en');
    if (sig === this._sig) return;
    this._sig = sig;

    let topStack = 0, botStack = 0;
    const delTitle = isFa ? 'حذف هشدار' : 'Delete alert';
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    this.container.innerHTML = items.map(({ a, price, kind, y, up }) => {
      const del = `<button class="btn-delete-alert-pill" data-alert-id="${esc(a.id)}" title="${delTitle}" aria-label="${delTitle}">✕</button>`;
      if (kind === 'line') {
        return `<div class="canvas-alert-line" style="top:${y}px; left:${Math.round(P.left)}px; width:${Math.max(0, Math.round(P.plotRight - P.left))}px;"></div>` +
          `<div class="canvas-alert-badge" style="top:${y - 10}px; right:${Math.max(0, Math.round(this.container.clientWidth - P.plotRight) + 2)}px;" title="${esc((isFa && a.conditionFa) || a.condition)}">` +
          `<span aria-hidden="true">🔔</span><span class="num-ltr">${fmt(price)}</span>${del}</div>`;
      }
      const top = kind === 'top'
        ? Math.round(P.paneTop + 6 + (topStack++) * 24)
        : Math.round(P.paneBottom - 26 - (botStack++) * 24);
      return `<div class="canvas-alert-pinned canvas-alert-pinned-${kind}" style="top:${top}px; right:${Math.round(P.rightInset)}px;" title="${esc((isFa && a.conditionFa) || a.condition)}">` +
        `<span aria-hidden="true" class="cap-arrow">${up ? '▲' : '▼'}</span><span class="num-ltr">${fmt(price)}</span>${del}</div>`;
    }).join('');

    this.container.querySelectorAll('.btn-delete-alert-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-alert-id');
        if (id && this.app?.alertsManager) this.app.alertsManager.deleteAlert(id);
      });
    });
  }
}
