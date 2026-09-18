// client/src/alertsManager.js
// Institutional Price Alerts & Trade-Relay Webhook Manager with Full Bilingual Support

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class AlertsManager {
  constructor(options = {}) {
    this.container = options.container;
    this.currentSymbol = 'BTCUSDT';
    this.currentPrice = 78000.0;
    this.isCreating = false;
    this.alerts = [
      {
        id: 'alt-1',
        symbol: 'BTCUSDT',
        condition: 'Resistance Target Crossing Above $95,000',
        conditionFa: 'تقاطع به بالای مقاومت کلیدی ۹۵,۰۰۰ دلار',
        targetPrice: 95000,
        direction: 'above',
        channel: 'Sound & Popup',
        channelFa: 'صوتی و اعلان تصویری',
        active: true,
        triggered: false,
        createdAt: '2026-09-18 10:00'
      },
      {
        id: 'alt-2',
        symbol: 'BTCUSDT',
        condition: 'Demand Zone Bounce Crossing Below $72,000',
        conditionFa: 'برخورد به زون تقاضای ۷۲,۰۰۰ دلار',
        targetPrice: 72000,
        direction: 'below',
        channel: 'Sound & Webhook',
        channelFa: 'صوتی و وب‌هوک',
        active: true,
        triggered: false,
        createdAt: '2026-09-18 10:30'
      },
      {
        id: 'alt-3',
        symbol: 'XAUUSD',
        condition: 'Price Crossing Above $2,750 (All-Time High)',
        conditionFa: 'شکست سقف تاریخی ۲,۷۵۰ دلار طلا',
        targetPrice: 2750,
        direction: 'above',
        channel: 'Webhook Relay (Auto-Order)',
        channelFa: 'رله وب‌هوک (سفارش خودکار)',
        active: true,
        triggered: false,
        createdAt: '2026-09-18 11:00'
      }
    ];
    this.render();
  }

  setMarket(symbol, price) {
    this.currentSymbol = symbol.replace(/^.*:/, '').toUpperCase();
    if (price && !isNaN(price)) {
      this.currentPrice = price;
      this.checkPrice(this.currentSymbol, price);
    }
  }

  openCreateAlert(price = null) {
    this.isCreating = true;
    if (price !== null && !isNaN(price)) {
      this.currentPrice = Number(price);
    }
    this.render();
  }

  checkPrice(symbol, price) {
    for (const a of this.alerts) {
      if (!a.active || a.triggered || a.symbol !== symbol) continue;

      let fired = false;
      if (a.direction === 'above' && price >= a.targetPrice) fired = true;
      if (a.direction === 'below' && price <= a.targetPrice) fired = true;

      if (fired) {
        a.triggered = true;
        this.playBeep();
        this.showToast(`🚨 Alert: ${a.symbol} reached $${price.toLocaleString()} (${a.condition})`);
        this.render();

        if (a.channel.includes('Webhook')) {
          fetch('/api/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: a.direction === 'above' ? 'buy' : 'sell',
              symbol: a.symbol,
              price,
              quantity: 0.1,
              source: 'tradingchart_alert_relay'
            })
          }).catch(() => {});
        }
      }
    }
  }

  playBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // Audio blocked until user interaction
    }
  }

  showToast(msg) {
    let toast = document.querySelector('#tradingchart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tradingchart-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: var(--bg-card);
        border: 1px solid var(--accent-cyan);
        color: #fff;
        padding: 12px 18px;
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        font-size: 13px;
        font-weight: 700;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 4000);
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow-y: auto; padding: 12px; gap: 14px;">
        <!-- Header Strip -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 13px; font-weight: 700; color: #fff;">
            ${isFa ? 'سیستم هشدارها و وب‌هوک' : 'Alerts & Webhooks'}
          </div>
          <button id="btn-create-alert-toggle" class="btn-primary" style="padding: 4px 10px; font-size: 11px;">
            ${this.isCreating ? (isFa ? 'انصراف' : 'Cancel') : (isFa ? '+ هشدار جدید' : '+ New Alert')}
          </button>
        </div>

        <!-- Inline Alert Creation Form -->
        ${this.isCreating ? `
          <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--accent-cyan); display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 12px; font-weight: 700; color: var(--accent-cyan);">
              ${isFa ? `ساخت هشدار قیمت برای ${this.currentSymbol}` : `Create Price Alert for ${this.currentSymbol}`}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div>
                <label style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;">
                  ${isFa ? 'شرط تریگر' : 'Condition'}
                </label>
                <select id="new-alert-cond" style="width: 100%; padding: 4px; font-size: 11px;">
                  <option value="above">${isFa ? 'تقاطع به بالا (Crossing Above)' : 'Crossing Above'}</option>
                  <option value="below">${isFa ? 'تقاطع به پایین (Crossing Below)' : 'Crossing Below'}</option>
                </select>
              </div>
              <div>
                <label style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;">
                  ${isFa ? 'قیمت هدف ($)' : 'Target Price ($)'}
                </label>
                <input type="number" id="new-alert-price" value="${this.currentPrice}" step="any" style="width: 100%; padding: 4px 8px; font-size: 11px;" />
              </div>
            </div>
            <div>
              <label style="font-size: 10px; color: var(--text-dim); display: block; margin-bottom: 2px;">
                ${isFa ? 'کانال اطلاع‌رسانی' : 'Notification Channel'}
              </label>
              <select id="new-alert-channel" style="width: 100%; padding: 4px; font-size: 11px;">
                <option value="Sound & Popup">${isFa ? 'هشدار صوتی و پنجره پاپ‌آپ' : 'Sound & Visual Popup'}</option>
                <option value="Webhook Relay (Auto-Order)">${isFa ? 'رله وب‌هوک (اردر خودکار)' : 'Webhook Relay (Auto-Order)'}</option>
                <option value="Sound & Webhook Relay">${isFa ? 'ترکیبی: صوتی + وب‌هوک' : 'Sound & Webhook Relay'}</option>
              </select>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
              <button id="btn-new-alert-cancel" class="btn-secondary" style="padding: 4px 10px; font-size: 11px;">
                ${isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button id="btn-new-alert-save" class="btn-primary" style="padding: 4px 14px; font-size: 11px;">
                ${isFa ? 'ثبت هشدار' : 'Create Alert'}
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Webhook Relay Info -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 11px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px;">
            ${isFa ? 'آدرس وب‌هوک رله معاملات (Trade-Relay)' : 'Trade-Relay Webhook URL'}
          </div>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="webhook-endpoint-input" readonly value="${window.location.origin}/api/webhook" style="flex: 1; min-width: 0; padding: 6px 10px; font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); text-overflow: ellipsis; direction: ltr !important; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px;" />
            <button id="btn-copy-webhook" class="btn-secondary" style="padding: 6px 14px; font-size: 11px; font-weight: 600; min-height: 32px;">
              ${isFa ? 'کپی' : 'Copy'}
            </button>
          </div>
          <!-- Safety Rails Chips -->
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
            <span style="font-size: 10px; font-weight: 600; background: rgba(0, 242, 176, 0.1); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 176, 0.2); padding: 2px 8px; border-radius: 4px;">
              ${isFa ? '🛡️ سقف ۵۰ هزار دلار' : '🛡️ Max $50k/order'}
            </span>
            <span style="font-size: 10px; font-weight: 600; background: rgba(245, 158, 11, 0.1); color: var(--accent-gold); border: 1px solid rgba(245, 158, 11, 0.2); padding: 2px 8px; border-radius: 4px;">
              ${isFa ? '🔒 قفل افت ۵٪ روزانه' : '🔒 5% Daily Drawdown Lock'}
            </span>
            <span style="font-size: 10px; font-weight: 600; background: rgba(59, 130, 246, 0.1); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.2); padding: 2px 8px; border-radius: 4px;">
              ${isFa ? '⚡ ضد سفارش تکراری' : '⚡ Deduplication'}
            </span>
          </div>
        </div>

        <!-- Alerts List -->
        <div style="background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">
            ${isFa ? `هشدارهای فعال (${toPersianDigits(this.alerts.length)})` : `Active Alerts (${this.alerts.length})`}
          </div>
          <div id="alerts-list-wrap">
            ${this.alerts.length === 0 ? `<div style="font-size: 11px; color: var(--text-muted); padding: 16px 0; text-align: center;">${isFa ? 'هیچ هشدار فعالی ثبت نشده است.' : 'No active price alerts.'}</div>` : ''}
            ${this.alerts.map(a => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-surface); margin-bottom: 6px; border-radius: 6px; gap: 8px; ${(!a.active || a.triggered) ? 'opacity: 0.6;' : ''}">
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 700; font-size: 12px; color: #fff; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span class="num-ltr" style="font-weight: 800;">${a.symbol}</span>
                    <span style="font-weight: 500; color: #cbd5e1;">${isFa ? (a.conditionFa || a.condition) : a.condition}</span>
                    ${a.triggered ? `<span style="font-size: 9px; background: rgba(246,70,93,0.2); color: var(--accent-red); padding: 1px 4px; border-radius: 3px;">${isFa ? 'اجرا شد' : 'TRIGGERED'}</span>` : ''}
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    ${isFa ? 'کانال:' : 'Channel:'} ${isFa ? (a.channelFa || a.channel) : a.channel} · <span class="num-ltr">${a.createdAt}</span>
                  </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                  <button class="btn-secondary toggle-alert-btn" data-id="${a.id}" style="padding: 4px 10px; font-size: 11px; font-weight: 600; min-height: 28px; border-radius: 4px; color: ${a.active ? 'var(--accent-cyan)' : 'var(--text-dim)'}; border-color: ${a.active ? 'rgba(0, 242, 176, 0.4)' : 'var(--border-subtle)'}; background: ${a.active ? 'rgba(0, 242, 176, 0.08)' : 'transparent'};">
                    ${a.active ? (isFa ? '🟢 فعال' : '🟢 Active') : (isFa ? '⏸️ متوقف' : '⏸️ Paused')}
                  </button>
                  <button class="btn-secondary delete-alert-btn" data-id="${a.id}" title="${isFa ? 'حذف این هشدار' : 'Delete Alert'}" style="padding: 4px 8px; font-size: 10px; min-height: 28px; border-radius: 4px; color: #f87171; border-color: rgba(239, 68, 68, 0.3);">
                    ${isFa ? 'حذف' : 'Delete'}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const btnToggle = this.container.querySelector('#btn-create-alert-toggle');
    btnToggle?.addEventListener('click', () => {
      this.isCreating = !this.isCreating;
      this.render();
    });

    const btnCancel = this.container.querySelector('#btn-new-alert-cancel');
    btnCancel?.addEventListener('click', () => {
      this.isCreating = false;
      this.render();
    });

    const btnSave = this.container.querySelector('#btn-new-alert-save');
    btnSave?.addEventListener('click', () => {
      const cond = this.container.querySelector('#new-alert-cond')?.value || 'above';
      const priceVal = parseFloat(this.container.querySelector('#new-alert-price')?.value);
      const channelVal = this.container.querySelector('#new-alert-channel')?.value || 'Sound & Popup';

      if (!isNaN(priceVal) && priceVal > 0) {
        const isFa = getLanguage() === 'fa';
        this.alerts.unshift({
          id: 'alt-' + Date.now(),
          symbol: this.currentSymbol,
          condition: `Price Crossing ${cond === 'above' ? 'Above' : 'Below'} $${priceVal.toLocaleString()}`,
          conditionFa: cond === 'above' ? `تقاطع قیمت به بالای $${priceVal.toLocaleString()}` : `تقاطع قیمت به زیر $${priceVal.toLocaleString()}`,
          targetPrice: priceVal,
          direction: cond,
          channel: channelVal,
          channelFa: channelVal.includes('Webhook') ? 'رله وب‌هوک خودکار' : 'هشدار صوتی و تصویری',
          active: true,
          triggered: false,
          createdAt: new Date().toLocaleTimeString()
        });
        this.isCreating = false;
        this.render();
      }
    });

    const btnCopy = this.container.querySelector('#btn-copy-webhook');
    btnCopy?.addEventListener('click', () => {
      const input = this.container.querySelector('#webhook-endpoint-input');
      navigator.clipboard.writeText(input.value);
      const isFa = getLanguage() === 'fa';
      btnCopy.innerText = isFa ? 'کپی شد!' : 'Copied!';
      setTimeout(() => { btnCopy.innerText = isFa ? 'کپی' : 'Copy'; }, 2000);
    });

    this.container.querySelectorAll('.toggle-alert-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const alertItem = this.alerts.find(a => a.id === id);
        if (alertItem) {
          alertItem.active = !alertItem.active;
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.delete-alert-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        this.alerts = this.alerts.filter(a => a.id !== id);
        this.render();
      });
    });
  }
}
