// client/src/alertsManager.js
// Price Alerts & Trade-Relay Webhook Manager

export class AlertsManager {
  constructor(options = {}) {
    this.container = options.container;
    this.alerts = [
      {
        id: 'alt-1',
        symbol: 'BTCUSDT',
        condition: 'Price Crossing $65,000',
        targetPrice: 65000,
        direction: 'above',
        channel: 'Sound & Popup',
        active: true,
        createdAt: '2026-09-17 12:00'
      },
      {
        id: 'alt-2',
        symbol: 'XAUUSD',
        condition: 'Price Crossing $2,720 (Gold Resistance)',
        targetPrice: 2720,
        direction: 'above',
        channel: 'Webhook Relay (Auto-Order)',
        active: true,
        createdAt: '2026-09-17 13:15'
      }
    ];
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow-y: auto; padding: 12px; gap: 14px;">
        <!-- Header Strip -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 13px; font-weight: 700; color: #fff;">Alerts & Webhooks</div>
          <button id="btn-create-alert" class="btn-primary" style="padding: 4px 10px; font-size: 11px;">
            + New Alert
          </button>
        </div>

        <!-- Webhook Relay Info -->
        <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 11px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 4px;">Trade-Relay Webhook URL</div>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="webhook-endpoint-input" readonly value="${window.location.origin}/api/webhook" style="flex: 1; padding: 4px 8px; font-size: 11px; font-family: var(--font-mono); color: var(--text-dim);" />
            <button id="btn-copy-webhook" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">Copy</button>
          </div>
          <div style="font-size: 10px; color: var(--text-dim); margin-top: 6px;">
            Safety Rails Active: Max $50k/order · 5% Daily Drawdown Lock · Duplicate Prevention
          </div>
        </div>

        <!-- Alerts List -->
        <div style="background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">Active Alerts (${this.alerts.length})</div>
          <div id="alerts-list-wrap">
            ${this.alerts.map(a => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-surface); margin-bottom: 6px; border-radius: 4px;">
                <div>
                  <div style="font-weight: 700; font-size: 12px; color: #fff;">${a.symbol}: <span style="font-weight: 500; color: var(--text-muted);">${a.condition}</span></div>
                  <div style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">Channel: ${a.channel} · ${a.createdAt}</div>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button class="btn-secondary delete-alert-btn" data-id="${a.id}" style="padding: 2px 6px; font-size: 10px; color: var(--accent-red);">Delete</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const btnCopy = this.container.querySelector('#btn-copy-webhook');
    btnCopy.addEventListener('click', () => {
      const input = this.container.querySelector('#webhook-endpoint-input');
      navigator.clipboard.writeText(input.value);
      btnCopy.innerText = 'Copied!';
      setTimeout(() => { btnCopy.innerText = 'Copy'; }, 2000);
    });

    const btnCreate = this.container.querySelector('#btn-create-alert');
    btnCreate.addEventListener('click', () => {
      const target = prompt('Enter price trigger level for active symbol (e.g. 66000):');
      if (target && !isNaN(target)) {
        this.alerts.unshift({
          id: 'alt-' + Date.now(),
          symbol: 'BTCUSDT',
          condition: `Price Crossing $${Number(target).toLocaleString()}`,
          targetPrice: Number(target),
          direction: 'above',
          channel: 'Sound & Webhook Relay',
          active: true,
          createdAt: new Date().toLocaleTimeString()
        });
        this.render();
      }
    });

    this.container.querySelectorAll('.delete-alert-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        this.alerts = this.alerts.filter(a => a.id !== id);
        this.render();
      });
    });
  }
}
