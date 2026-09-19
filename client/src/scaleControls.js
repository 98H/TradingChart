// client/src/scaleControls.js
// TradingView-Grade Floating Price Scale & Coordinate Controls Bar
// Auto, Log, % (Percent), Inv (Invert), Live Bar Countdown Timer & Timezone

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class ScaleControls {
  constructor(app) {
    this.app = app;
    this.container = null;
    this.countdownTimer = null;
    this.activeTimezone = 'UTC';
    this.timezones = ['UTC', 'America/New_York', 'Asia/Tehran', 'Europe/London', 'Asia/Tokyo'];
    this.init();
  }

  init() {
    let el = document.querySelector('#scale-controls-bar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'scale-controls-bar';
      el.className = 'scale-controls-dock';
      const chartArea = document.querySelector('#chart-area');
      if (chartArea) {
        chartArea.appendChild(el);
      }
    }
    this.container = el;
    this.render();
    this.startCountdownLoop();

    // Ensure standard non-inverted price scale on startup
    setTimeout(() => {
      if (this.renderer) {
        if (this.renderer.get('invertScale')) {
          this.renderer.set('invertScale', false);
        }
        if (this.renderer.get('scaleMode') === 'percent') {
          this.renderer.set('scaleMode', 'price');
        }
      }
      this.syncActiveStates();
    }, 200);
  }

  get renderer() {
    return this.app.chartManager?.workspace?.active?.chart?.renderer;
  }

  get activeCell() {
    return this.app.chartManager?.workspace?.active;
  }

  render() {
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div class="scale-dock-inner">
        <!-- Scale Mode: Auto Scale / Reset View -->
        <button id="btn-scale-auto" class="scale-dock-btn active" title="${isFa ? 'مقیاس خودکار قیمت (Auto Scale / Alt+R)' : 'Auto Scale / Fit Data (Alt+R)'}">
          <span>Auto</span>
        </button>

        <!-- Scale Mode: Logarithmic -->
        <button id="btn-scale-log" class="scale-dock-btn" title="${isFa ? 'مقیاس لگاریتمی (Logarithmic Scale)' : 'Logarithmic Scale (Log)'}">
          <span>Log</span>
        </button>

        <!-- Scale Mode: Percentage -->
        <button id="btn-scale-percent" class="scale-dock-btn" title="${isFa ? 'مقیاس درصدی قیمت (%)' : 'Percentage Scale (%)'}">
          <span>%</span>
        </button>

        <!-- Scale Mode: Invert Price Scale -->
        <button id="btn-scale-invert" class="scale-dock-btn" title="${isFa ? 'معکوس‌سازی عمودی چارت (Invert Scale / Alt+I)' : 'Invert Price Scale (Alt+I)'}">
          <span>Inv</span>
        </button>

        <!-- Timezone Selector Pill -->
        <button id="btn-scale-timezone" class="scale-dock-btn tz-pill" title="${isFa ? 'منطقه زمانی چارت' : 'Chart Timezone'}">
          <span id="scale-tz-label">${this.activeTimezone === 'Asia/Tehran' ? 'THR' : this.activeTimezone.replace('America/', '').replace('Europe/', '').replace('Asia/', '')}</span>
        </button>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // 1. Auto Scale / Reset View
    this.container.querySelector('#btn-scale-auto')?.addEventListener('click', () => {
      if (this.activeCell) {
        this.activeCell.resetView();
      }
      if (this.renderer) {
        this.renderer.set('autoScale', true);
      }
      this.syncActiveStates();
      this.showToast(getLanguage() === 'fa' ? 'مقیاس خودکار بازنشانی شد' : 'Auto scale reset');
    });

    // 2. Log Scale Toggle
    this.container.querySelector('#btn-scale-log')?.addEventListener('click', () => {
      if (this.renderer) {
        const current = !!this.renderer.get('logScale');
        this.renderer.set('logScale', !current);
        this.syncActiveStates();
        this.showToast(getLanguage() === 'fa' ? `مقیاس لگاریتمی: ${!current ? 'روشن' : 'خاموش'}` : `Log scale: ${!current ? 'ON' : 'OFF'}`);
      }
    });

    // 3. Percent Scale Toggle
    this.container.querySelector('#btn-scale-percent')?.addEventListener('click', () => {
      if (this.renderer) {
        const currentMode = this.renderer.get('scaleMode');
        const nextMode = currentMode === 'percent' ? 'price' : 'percent';
        this.renderer.set('scaleMode', nextMode);
        this.syncActiveStates();
        this.showToast(getLanguage() === 'fa' ? `مقیاس درصدی: ${nextMode === 'percent' ? 'روشن' : 'خاموش'}` : `Percent scale: ${nextMode === 'percent' ? 'ON' : 'OFF'}`);
      }
    });

    // 4. Invert Scale Toggle
    this.container.querySelector('#btn-scale-invert')?.addEventListener('click', () => {
      if (this.renderer) {
        const current = !!this.renderer.get('invertScale');
        this.renderer.set('invertScale', !current);
        this.syncActiveStates();
        this.showToast(getLanguage() === 'fa' ? `معکوس‌سازی چارت: ${!current ? 'روشن' : 'خاموش'}` : `Invert scale: ${!current ? 'ON' : 'OFF'}`);
      }
    });

    // 5. Timezone Cycle
    this.container.querySelector('#btn-scale-timezone')?.addEventListener('click', () => {
      const idx = this.timezones.indexOf(this.activeTimezone);
      const nextIdx = (idx + 1) % this.timezones.length;
      this.activeTimezone = this.timezones[nextIdx];
      this.app.chartManager?.applySettings({ timezone: this.activeTimezone });
      this.render();
      this.showToast(`Timezone: ${this.activeTimezone}`);
    });
  }

  syncActiveStates() {
    if (!this.renderer || !this.container) return;

    const btnAuto = this.container.querySelector('#btn-scale-auto');
    const btnLog = this.container.querySelector('#btn-scale-log');
    const btnPercent = this.container.querySelector('#btn-scale-percent');
    const btnInv = this.container.querySelector('#btn-scale-invert');

    if (btnLog) {
      btnLog.classList.toggle('active', !!this.renderer.get('logScale'));
    }
    if (btnPercent) {
      btnPercent.classList.toggle('active', this.renderer.get('scaleMode') === 'percent');
    }
    if (btnInv) {
      btnInv.classList.toggle('active', !!this.renderer.get('invertScale'));
    }
    if (btnAuto) {
      btnAuto.classList.toggle('active', !!this.renderer.get('autoScale'));
    }
  }

  startCountdownLoop() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);

    this.countdownTimer = setInterval(() => {
      this.updateCountdownDisplay();
    }, 1000);
    this.updateCountdownDisplay();
  }

  updateCountdownDisplay() {
    const label = this.container?.querySelector('#countdown-timer-val');
    if (!label) return;

    const tf = this.app.currentTimeframe || '60';
    const intervalSec = this.timeframeToSeconds(tf);
    const nowSec = Math.floor(Date.now() / 1000);

    let remaining = intervalSec - (nowSec % intervalSec);

    // If activeBars has last bar, align with the active bar open time
    const bars = this.app?.activeBars;
    if (bars && bars.length > 0) {
      const lastBar = bars[bars.length - 1];
      let barTimeSec = lastBar.time;
      if (barTimeSec > 1e11) barTimeSec = Math.floor(barTimeSec / 1000);
      const closeTimeSec = barTimeSec + intervalSec;
      if (closeTimeSec > nowSec) {
        remaining = closeTimeSec - nowSec;
      }
    }

    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const h = Math.floor(m / 60);
    const mm = m % 60;

    let text = '';
    if (h > 0) {
      text = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
      text = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    label.innerText = text;
  }

  timeframeToSeconds(tf) {
    const s = String(tf).toUpperCase();
    if (s === '1S') return 1;
    if (s === '1') return 60;
    if (s === '3') return 180;
    if (s === '5') return 300;
    if (s === '15') return 900;
    if (s === '30') return 1800;
    if (s === '45') return 2700;
    if (s === '60' || s === '1H') return 3600;
    if (s === '120' || s === '2H') return 7200;
    if (s === '180' || s === '3H') return 10800;
    if (s === '240' || s === '4H') return 14400;
    if (s === 'D' || s === '1D') return 86400;
    if (s === 'W' || s === '1W') return 604800;
    if (s === 'M' || s === '1M') return 2592000;
    const num = parseInt(s, 10);
    return isNaN(num) ? 3600 : num * 60;
  }

  showToast(msg) {
    let toast = document.querySelector('#tradingchart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tradingchart-toast';
      toast.className = 'app-floating-toast';
      document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2200);
  }

  destroy() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.container) {
      this.container.remove();
    }
  }
}
