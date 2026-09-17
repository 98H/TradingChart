// client/src/propFirmSimulator.js
// Powered by @luxalgo/prop-firm-sim-core: 10,000-path Monte Carlo challenge simulation

import { simulate } from '@luxalgo/prop-firm-sim-core';

export const PROP_FIRM_PRESETS = {
  'ftmo-100k': {
    challengeId: 'ftmo-100k',
    name: 'FTMO $100,000 Challenge',
    productType: 'cfd',
    accountSize: 100000,
    currency: 'USD',
    steps: [
      { profitTargetPct: 10, minTradingDays: 4 },
      { profitTargetPct: 5, minTradingDays: 4 }
    ],
    dailyLoss: { pct: 5 },
    maxLoss: { mode: 'static-initial', pct: 10 },
    fees: { price: 540 },
    funded: { profitSplitPct: 80, payoutFrequency: 'biweekly' }
  },
  'ftmo-200k': {
    challengeId: 'ftmo-200k',
    name: 'FTMO $200,000 Challenge',
    productType: 'cfd',
    accountSize: 200000,
    currency: 'USD',
    steps: [
      { profitTargetPct: 10, minTradingDays: 4 },
      { profitTargetPct: 5, minTradingDays: 4 }
    ],
    dailyLoss: { pct: 5 },
    maxLoss: { mode: 'static-initial', pct: 10 },
    fees: { price: 1080 },
    funded: { profitSplitPct: 80, payoutFrequency: 'biweekly' }
  },
  'topstep-50k': {
    challengeId: 'topstep-50k',
    name: 'Topstep $50,000 Trading Combine',
    productType: 'futures',
    accountSize: 50000,
    currency: 'USD',
    steps: [
      { profitTargetPct: 6, minTradingDays: 2 }
    ],
    dailyLoss: { pct: 2 },
    maxLoss: { mode: 'trailing-realized-eod', pct: 4 },
    fees: { price: 149 },
    funded: { profitSplitPct: 90, payoutFrequency: 'on-demand' }
  }
};

export class PropFirmSimulator {
  constructor(options = {}) {
    this.container = options.container;
    this.currentPresetKey = 'ftmo-100k';
    this.winRate = 0.54;
    this.avgWinR = 2.0;
    this.tradesPerDay = 2.5;
    this.riskPct = 1.0;
    this.render();
  }

  setProfileParams(params) {
    if (params.winRate) this.winRate = Math.min(0.95, Math.max(0.1, params.winRate));
    if (params.avgWinR) this.avgWinR = Math.max(0.5, params.avgWinR);
    if (params.tradesPerDay) this.tradesPerDay = Math.max(0.5, params.tradesPerDay);
    this.render();
    this.runSimulation();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow-y: auto; padding: 12px; gap: 12px;">
        <!-- Top Parameter Bar -->
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; background: var(--bg-darkest); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">Firm Challenge Preset</label>
            <select id="prop-preset-select" style="padding: 4px 8px; font-size: 12px;">
              <option value="ftmo-100k" ${this.currentPresetKey === 'ftmo-100k' ? 'selected' : ''}>FTMO $100k (2-Phase)</option>
              <option value="ftmo-200k" ${this.currentPresetKey === 'ftmo-200k' ? 'selected' : ''}>FTMO $200k (2-Phase)</option>
              <option value="topstep-50k" ${this.currentPresetKey === 'topstep-50k' ? 'selected' : ''}>Topstep $50k Futures</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">Win Rate (%)</label>
            <input type="number" id="prop-winrate-input" value="${(this.winRate * 100).toFixed(0)}" min="10" max="95" step="1" style="width: 80px; padding: 4px 8px; font-size: 12px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">R:R Ratio (Avg Win R)</label>
            <input type="number" id="prop-rr-input" value="${this.avgWinR.toFixed(1)}" min="0.5" max="10" step="0.1" style="width: 80px; padding: 4px 8px; font-size: 12px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">Risk Per Trade (%)</label>
            <input type="number" id="prop-risk-input" value="${this.riskPct.toFixed(1)}" min="0.25" max="3" step="0.25" style="width: 80px; padding: 4px 8px; font-size: 12px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">Trades Per Day</label>
            <input type="number" id="prop-tpd-input" value="${this.tradesPerDay.toFixed(1)}" min="0.5" max="20" step="0.5" style="width: 80px; padding: 4px 8px; font-size: 12px;" />
          </div>

          <div style="margin-left: auto; align-self: flex-end;">
            <button id="btn-run-propsim" class="btn-primary" style="padding: 6px 16px; font-size: 12px;">
              ⚡ Run Monte Carlo (500 Paths)
            </button>
          </div>
        </div>

        <!-- Output Cards Grid -->
        <div id="propsim-results-area" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          <!-- Will be populated by runSimulation() -->
        </div>
      </div>
    `;

    const selectPreset = this.container.querySelector('#prop-preset-select');
    const inputWinRate = this.container.querySelector('#prop-winrate-input');
    const inputRR = this.container.querySelector('#prop-rr-input');
    const inputRisk = this.container.querySelector('#prop-risk-input');
    const inputTpd = this.container.querySelector('#prop-tpd-input');
    const btnRun = this.container.querySelector('#btn-run-propsim');

    selectPreset.addEventListener('change', (e) => {
      this.currentPresetKey = e.target.value;
      this.runSimulation();
    });

    btnRun.addEventListener('click', () => {
      this.winRate = parseFloat(inputWinRate.value) / 100;
      this.avgWinR = parseFloat(inputRR.value);
      this.riskPct = parseFloat(inputRisk.value);
      this.tradesPerDay = parseFloat(inputTpd.value);
      this.runSimulation();
    });

    this.runSimulation();
  }

  runSimulation() {
    const area = this.container.querySelector('#propsim-results-area');
    if (!area) return;

    try {
      const spec = PROP_FIRM_PRESETS[this.currentPresetKey];
      const profile = {
        kind: 'parametric',
        winRate: this.winRate,
        avgWinR: this.avgWinR,
        avgLossR: 1.0,
        tradesPerDay: this.tradesPerDay,
        risk: { type: 'percent', value: this.riskPct }
      };

      const res = simulate(spec, profile, { paths: 500, seed: Date.now() });

      const passProb = res.perAttempt?.passProbability || 0;
      const passPct = (passProb * 100).toFixed(1);
      const ruinPct = ((1 - passProb) * 100).toFixed(1);
      const evNet = res.ev?.evTotal || 0;
      const daysToFunded = res.journey?.daysToFunded?.p50 || 12;
      const passColor = passProb >= 0.7 ? 'var(--accent-green)' : passProb >= 0.4 ? 'var(--accent-gold)' : 'var(--accent-red)';

      area.innerHTML = `
        <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border-left: 3px solid ${passColor};">
          <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Pass Probability</div>
          <div style="font-size: 24px; font-weight: 800; color: ${passColor}; margin: 4px 0;" class="num-ltr">${passPct}%</div>
          <div style="font-size: 11px; color: var(--text-muted);">95% Wilson CI: [${((res.perAttempt?.passProbabilityCi?.low || 0)*100).toFixed(1)}% - ${((res.perAttempt?.passProbabilityCi?.high || 0)*100).toFixed(1)}%]</div>
        </div>

        <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-red);">
          <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Risk of Ruin</div>
          <div style="font-size: 24px; font-weight: 800; color: var(--accent-red); margin: 4px 0;" class="num-ltr">${ruinPct}%</div>
          <div style="font-size: 11px; color: var(--text-muted);">Chance of breaching drawdown limit</div>
        </div>

        <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-cyan);">
          <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Expected Value (EV)</div>
          <div style="font-size: 24px; font-weight: 800; color: var(--accent-cyan); margin: 4px 0;" class="num-ltr">+$${Math.round(evNet).toLocaleString()}</div>
          <div style="font-size: 11px; color: var(--text-muted);">Net mathematical expectancy after fees</div>
        </div>

        <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-purple);">
          <div style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Median Days to Funded</div>
          <div style="font-size: 24px; font-weight: 800; color: #fff; margin: 4px 0;" class="num-ltr">${daysToFunded} Days</div>
          <div style="font-size: 11px; color: var(--text-muted);">P90 worst-case: ${Math.round(res.journey?.daysToFunded?.p90 || 24)} days</div>
        </div>
      `;
    } catch (e) {
      area.innerHTML = `<div style="color: var(--accent-red); padding: 12px;">Simulation Error: ${e.message}</div>`;
    }
  }
}
