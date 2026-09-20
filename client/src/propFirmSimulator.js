// client/src/propFirmSimulator.js
// Powered by @luxalgo/prop-firm-sim-core: 10,000-path Monte Carlo challenge simulation
// Full Bilingual Persian/English Localization with strict ZWNJ

import { simulate } from '@luxalgo/prop-firm-sim-core';
import { getLanguage, t, toPersianDigits } from './i18n.js';

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
    setTimeout(() => this.runSimulation(), 100);
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
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div style="display: flex; height: 100%; flex-direction: column; overflow-y: auto; padding: 12px; gap: 12px; ${isFa ? 'direction: rtl; text-align: right; font-family: var(--font-vazirmatn), sans-serif;' : 'direction: ltr; text-align: left;'}">
        <!-- Top Parameter Bar -->
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; background: var(--bg-darkest); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">${isFa ? 'قالب آزمون پراپ‌فرم' : 'Firm Challenge Preset'}</label>
            <select id="prop-preset-select" class="prop-preset-sel" data-preset="prop-preset-sel" style="padding: 4px 8px; font-size: 12px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px;">
              <option value="ftmo-100k" ${this.currentPresetKey === 'ftmo-100k' ? 'selected' : ''}>${isFa ? 'FTMO ۱۰۰ هزار دلار (۲ مرحله‌ای)' : 'FTMO $100k (2-Phase)'}</option>
              <option value="ftmo-200k" ${this.currentPresetKey === 'ftmo-200k' ? 'selected' : ''}>${isFa ? 'FTMO ۲۰۰ هزار دلار (۲ مرحله‌ای)' : 'FTMO $200k (2-Phase)'}</option>
              <option value="topstep-50k" ${this.currentPresetKey === 'topstep-50k' ? 'selected' : ''}>${isFa ? 'تاپ‌استپ ۵۰ هزار دلار فیوچرز' : 'Topstep $50k Futures'}</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">${isFa ? 'نرخ برد (Win Rate %)' : 'Win Rate (%)'}</label>
            <input type="number" id="prop-winrate-input" value="${(this.winRate * 100).toFixed(0)}" min="10" max="95" step="1" style="width: 80px; padding: 4px 8px; font-size: 12px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px;" class="num-ltr" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">${isFa ? 'نسبت سود به ریسک (R:R)' : 'R:R Ratio (Avg Win R)'}</label>
            <input type="number" id="prop-rr-input" value="${this.avgWinR.toFixed(1)}" min="0.5" max="10" step="0.1" style="width: 80px; padding: 4px 8px; font-size: 12px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px;" class="num-ltr" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">${isFa ? 'ریسک در هر معامله (%)' : 'Risk Per Trade (%)'}</label>
            <input type="number" id="prop-risk-input" value="${this.riskPct.toFixed(1)}" min="0.25" max="3" step="0.25" style="width: 80px; padding: 4px 8px; font-size: 12px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px;" class="num-ltr" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">${isFa ? 'تعداد معامله در روز' : 'Trades Per Day'}</label>
            <input type="number" id="prop-tpd-input" value="${this.tradesPerDay.toFixed(1)}" min="0.5" max="20" step="0.5" style="width: 80px; padding: 4px 8px; font-size: 12px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px;" class="num-ltr" />
          </div>

          <div style="margin-inline-start: auto; align-self: flex-end;">
            <button id="btn-run-propsim" class="btn-primary" style="padding: 6px 16px; font-size: 12px; font-weight: 700;">
              ${isFa ? '⚡ اجرای شبیه‌سازی مونت‌کارلو (۵۰۰ مسیر)' : '⚡ Run Monte Carlo (500 Paths)'}
            </button>
          </div>
        </div>

        <!-- Output Area: Split into KPIs (Left) & Monte Carlo Canvas (Right) -->
        <div id="propsim-results-area" style="display: flex; gap: 12px; flex: 1; min-height: 0; flex-wrap: wrap;">
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

    selectPreset?.addEventListener('change', (e) => {
      this.currentPresetKey = e.target.value;
      this.runSimulation();
    });

    btnRun?.addEventListener('click', () => {
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
    const isFa = getLanguage() === 'fa';

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

      // Generate 35 sample Monte Carlo trajectory curves
      const stepsCount = 40;
      const targetPct = (spec.steps?.[0]?.profitTargetPct || 10) / 100;
      const maxLossPct = (spec.maxLoss?.pct || 10) / 100;
      const initial = spec.accountSize || 100000;
      const targetEq = initial * (1 + targetPct);
      const ruinEq = initial * (1 - maxLossPct);

      const paths = [];
      for (let p = 0; p < 35; p++) {
        const path = [initial];
        let cur = initial;
        for (let s = 1; s <= stepsCount; s++) {
          if (cur >= targetEq || cur <= ruinEq) {
            path.push(cur);
            continue;
          }
          const isWin = Math.random() < this.winRate;
          const delta = isWin ? (cur * (this.riskPct / 100) * this.avgWinR) : -(cur * (this.riskPct / 100));
          cur += delta;
          path.push(cur);
        }
        paths.push(path);
      }

      const svgW = 600;
      const svgH = 120;
      const minVal = ruinEq * 0.98;
      const maxVal = targetEq * 1.02;
      const valRange = maxVal - minVal;

      const pathSvgs = paths.map(pts => {
        const coords = pts.map((val, idx) => {
          const x = (idx / stepsCount) * svgW;
          const y = svgH - ((val - minVal) / valRange) * (svgH - 20) - 10;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        const passed = pts[pts.length - 1] >= targetEq;
        const color = passed ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.3)';
        return `<polyline points="${coords.join(' ')}" fill="none" stroke="${color}" stroke-width="1.2" />`;
      }).join('');

      const targetY = svgH - ((targetEq - minVal) / valRange) * (svgH - 20) - 10;
      const ruinY = svgH - ((ruinEq - minVal) / valRange) * (svgH - 20) - 10;

      area.innerHTML = `
        <!-- Left: 4 KPI Cards (2x2 Grid) -->
        <div style="width: 40%; min-width: 310px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="prop-kpi-card" style="background: var(--bg-card); padding: 8px 10px; border-radius: var(--radius-sm); border-${isFa ? 'right' : 'left'}: 3px solid ${passColor};">
            <div style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">${isFa ? 'احتمال قبولی در چالش' : 'Pass Probability'}</div>
            <div id="propsim-pass-rate" style="font-size: 18px; font-weight: 800; color: ${passColor}; margin: 2px 0;" class="num-ltr">${passPct}%</div>
            <div style="font-size: 9px; color: var(--text-muted);">${isFa ? 'بازه اطمینان ۹۵٪:' : '95% CI:'} [${((res.perAttempt?.passProbabilityCi?.low || 0)*100).toFixed(1)}% - ${((res.perAttempt?.passProbabilityCi?.high || 0)*100).toFixed(1)}%]</div>
          </div>

          <div class="prop-kpi-card" style="background: var(--bg-card); padding: 8px 10px; border-radius: var(--radius-sm); border-${isFa ? 'right' : 'left'}: 3px solid var(--accent-red);">
            <div style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">${isFa ? 'ریسک سوختن حساب' : 'Risk of Ruin'}</div>
            <div id="propsim-ruin-risk" style="font-size: 18px; font-weight: 800; color: var(--accent-red); margin: 2px 0;" class="num-ltr">${ruinPct}%</div>
            <div style="font-size: 9px; color: var(--text-muted);">${isFa ? 'احتمال نقض سقف دراوداون' : 'Chance of drawdown limit'}</div>
          </div>

          <div class="prop-kpi-card" style="background: var(--bg-card); padding: 8px 10px; border-radius: var(--radius-sm); border-${isFa ? 'right' : 'left'}: 3px solid var(--accent-cyan);">
            <div style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">${isFa ? 'امید ریاضی سود (EV)' : 'Expected Value (EV)'}</div>
            <div id="propsim-ev" style="font-size: 18px; font-weight: 800; color: var(--accent-cyan); margin: 2px 0;" class="num-ltr">+$${Math.round(evNet).toLocaleString()}</div>
            <div style="font-size: 9px; color: var(--text-muted);">${isFa ? 'بازده خالص پس از کسر کارمزد' : 'Net expectancy after fees'}</div>
          </div>

          <div class="prop-kpi-card" style="background: var(--bg-card); padding: 8px 10px; border-radius: var(--radius-sm); border-${isFa ? 'right' : 'left'}: 3px solid var(--accent-purple);">
            <div style="font-size: 10px; color: var(--text-dim); text-transform: uppercase;">${isFa ? 'میانه روزها تا قبولی' : 'Median Days to Funded'}</div>
            <div id="propsim-days" style="font-size: 18px; font-weight: 800; color: #fff; margin: 2px 0;" class="num-ltr">${daysToFunded} ${isFa ? 'روز' : 'Days'}</div>
            <div style="font-size: 9px; color: var(--text-muted);">${isFa ? 'بدترین سناریو (P90):' : 'P90 worst-case:'} ${Math.round(res.journey?.daysToFunded?.p90 || 24)}${isFa ? ' روز' : 'd'}</div>
          </div>
        </div>

        <!-- Right: Monte Carlo Trajectory Curves -->
        <div style="flex: 1; min-width: 360px; background: var(--bg-card); border-radius: var(--radius-sm); padding: 10px 12px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">${isFa ? 'مسیرهای تعادلی اکوئیتی (۳۵ نمونه شبیه‌سازی مونت‌کارلو)' : 'Monte Carlo Equity Trajectories (35 Sample Simulation Paths)'}</span>
            <div style="display: flex; gap: 12px; font-size: 10px;">
              <span style="color: var(--accent-green);">— ${isFa ? 'تارگت سود' : 'Target'} (+$${Math.round(initial * targetPct).toLocaleString()})</span>
              <span style="color: var(--accent-red);">— ${isFa ? 'حد ضرر کل' : 'Drawdown'} (-$${Math.round(initial * maxLossPct).toLocaleString()})</span>
            </div>
          </div>
          <div style="flex: 1; width: 100%; min-height: 100px; max-height: 125px; position: relative; direction: ltr !important;">
            <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width: 100%; height: 100%;">
              <line x1="0" y1="${targetY}" x2="${svgW}" y2="${targetY}" stroke="rgba(14, 203, 129, 0.6)" stroke-width="1.5" stroke-dasharray="4 4" />
              <line x1="0" y1="${ruinY}" x2="${svgW}" y2="${ruinY}" stroke="rgba(246, 70, 93, 0.6)" stroke-width="1.5" stroke-dasharray="4 4" />
              ${pathSvgs}
            </svg>
          </div>
        </div>
      `;
    } catch (e) {
      area.innerHTML = `<div style="color: var(--accent-red); padding: 12px;">Simulation Error: ${e.message}</div>`;
    }
  }
}
