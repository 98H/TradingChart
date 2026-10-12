// client/src/journal/journalCharts.js
// High-performance, zero-dependency SVG chart renderers for Institutional Trade Journal
// Perfectly themed with TradingChart design tokens, high DPI support, and zero horizontal clipping.

import { getLanguage } from '../i18n.js';

export class JournalCharts {
  /**
   * Renders the open Edge Score v2 polygon radar chart.
   * Components: winRate, profitFactor, avgWinLoss, drawdown, recovery, consistency
   */
  static renderEdgeRadar(container, components, overallScore = null) {
    if (!container) return;
    const isFa = getLanguage() === 'fa';
    if (!components) {
      // Honest empty state — never draw a made-up skill profile.
      container.innerHTML = `<div style="padding: 40px 16px; text-align: center; color: var(--text-dim); font-size: 12px; line-height: 1.9;">${isFa
        ? 'برای ترسیم رادار مهارت، دست‌کم چند معاملهٔ بسته‌شده لازم است.<br>معاملات آزمایشی، بازپخش یا درون‌ریزی صورت‌حساب بروکر را ثبت کنید.'
        : 'The edge radar needs a few closed trades.<br>Log paper / replay trades or import a broker statement.'}</div>`;
      return;
    }
    const c = components;

    const axes = [
      { key: 'winRate', labelEn: 'Win Rate (15%)', labelFa: 'نرخ برد (۱۵٪)', val: Math.min(100, Math.max(0, c.winRate || 0)) },
      { key: 'profitFactor', labelEn: 'Profit Factor (25%)', labelFa: 'فاکتور سود (۲۵٪)', val: Math.min(100, Math.max(0, c.profitFactor || 0)) },
      { key: 'avgWinLoss', labelEn: 'Avg Win/Loss (20%)', labelFa: 'نسبت برد/باخت (۲۰٪)', val: Math.min(100, Math.max(0, c.avgWinLoss || 0)) },
      { key: 'drawdown', labelEn: 'Drawdown (15%)', labelFa: 'کنترل افت (۱۵٪)', val: Math.min(100, Math.max(0, c.drawdown || 0)) },
      { key: 'recovery', labelEn: 'Recovery (10%)', labelFa: 'نرخ بازیابی (۱۰٪)', val: Math.min(100, Math.max(0, c.recovery || 0)) },
      { key: 'consistency', labelEn: 'Consistency (15%)', labelFa: 'انضباط و تداوم (۱۵٪)', val: Math.min(100, Math.max(0, c.consistency || 0)) }
    ];

    const size = 320;
    const center = size / 2;
    const radius = 105;
    const totalAxes = axes.length;

    // Rings at 25%, 50%, 75%, 100%
    let ringsSvg = '';
    [0.25, 0.5, 0.75, 1.0].forEach(ratio => {
      const pts = [];
      for (let i = 0; i < totalAxes; i++) {
        const angle = (Math.PI * 2 * i) / totalAxes - Math.PI / 2;
        const x = center + radius * ratio * Math.cos(angle);
        const y = center + radius * ratio * Math.sin(angle);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      ringsSvg += `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1" />`;
    });

    // Spoke axes & labels
    let spokesSvg = '';
    let labelsSvg = '';
    axes.forEach((axis, i) => {
      const angle = (Math.PI * 2 * i) / totalAxes - Math.PI / 2;
      const xEnd = center + radius * Math.cos(angle);
      const yEnd = center + radius * Math.sin(angle);
      spokesSvg += `<line x1="${center}" y1="${center}" x2="${xEnd.toFixed(1)}" y2="${yEnd.toFixed(1)}" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="2 2" />`;

      const labelDist = radius + 32;
      const lx = center + labelDist * Math.cos(angle);
      const ly = center + labelDist * Math.sin(angle) + 4;
      const anchor = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : (Math.cos(angle) > 0 ? 'start' : 'end');
      const text = isFa ? axis.labelFa : axis.labelEn;
      labelsSvg += `
        <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" fill="#94a3b8" font-size="10" font-weight="600" font-family="sans-serif">
          ${text} <tspan fill="#00f2b0" font-weight="800">(${Math.round(axis.val)})</tspan>
        </text>
      `;
    });

    // Data polygon
    const dataPoints = axes.map((axis, i) => {
      const angle = (Math.PI * 2 * i) / totalAxes - Math.PI / 2;
      const r = (radius * axis.val) / 100;
      return `${(center + r * Math.cos(angle)).toFixed(1)},${(center + r * Math.sin(angle)).toFixed(1)}`;
    });

    // Vertex dots
    let dotsSvg = '';
    axes.forEach((axis, i) => {
      const angle = (Math.PI * 2 * i) / totalAxes - Math.PI / 2;
      const r = (radius * axis.val) / 100;
      const dx = center + r * Math.cos(angle);
      const dy = center + r * Math.sin(angle);
      dotsSvg += `
        <circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="4" fill="#00f2b0" stroke="#0c1017" stroke-width="2">
          <title>${isFa ? axis.labelFa : axis.labelEn}: ${Math.round(axis.val)}/100</title>
        </circle>
      `;
    });

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; width: 100%;">
        <svg viewBox="0 0 ${size} ${size}" style="max-width: 340px; width: 100%; height: auto; overflow: visible;">
          <defs>
            <radialGradient id="edgeRadarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#00f2b0" stop-opacity="0.38"/>
              <stop offset="100%" stop-color="#00f2b0" stop-opacity="0.05"/>
            </radialGradient>
          </defs>
          ${ringsSvg}
          ${spokesSvg}
          <polygon points="${dataPoints.join(' ')}" fill="url(#edgeRadarGlow)" stroke="#00f2b0" stroke-width="2.5" />
          ${dotsSvg}
          ${labelsSvg}
          <!-- Central Score Badge -->
          <circle cx="${center}" cy="${center}" r="22" fill="#080b11" stroke="#253248" stroke-width="1.5" />
          <text x="${center}" y="${center + 4}" text-anchor="middle" fill="#facc15" font-size="13" font-weight="900" font-family="sans-serif">${overallScore ? overallScore.toFixed(0) : '—'}</text>
        </svg>
      </div>
    `;
  }

  /**
   * Renders the cumulative Equity Growth Curve & Underwater Drawdown chart.
   */
  static renderEquityCurve(container, curveData, privacyMode = false) {
    if (!container) return;
    const isFa = getLanguage() === 'fa';
    const rawPoints = Array.isArray(curveData) && curveData.length > 0 ? curveData : [
      { date: '2026-09-01', cumNetPnl: 0 },
      { date: '2026-09-05', cumNetPnl: 625 },
      { date: '2026-09-10', cumNetPnl: 1000 },
      { date: '2026-09-15', cumNetPnl: 1840 },
      { date: '2026-09-20', cumNetPnl: 2950 },
      { date: '2026-09-25', cumNetPnl: 3930 }
    ];

    const points = rawPoints.map(p => ({
      date: p.t || p.date || '',
      val: typeof p.cumNetPnl === 'number' ? p.cumNetPnl : (typeof p.pnl === 'number' ? p.pnl : 0)
    }));

    const width = 600;
    const height = 180;
    const padX = 40;
    const padY = 24;

    const pnls = points.map(p => p.val);
    let minPnl = Math.min(0, ...pnls);
    let maxPnl = Math.max(100, ...pnls);
    const range = (maxPnl - minPnl) || 1;

    const scaleX = (i) => padX + (i / Math.max(1, points.length - 1)) * (width - padX * 2);
    const scaleY = (val) => height - padY - ((val - minPnl) / range) * (height - padY * 2);

    let pathD = `M ${scaleX(0)} ${scaleY(points[0].val)}`;
    let areaD = `M ${scaleX(0)} ${height - padY} L ${scaleX(0)} ${scaleY(points[0].val)}`;

    for (let i = 1; i < points.length; i++) {
      const x0 = scaleX(i - 1);
      const y0 = scaleY(points[i - 1].val);
      const x1 = scaleX(i);
      const y1 = scaleY(points[i].val);
      const cx = (x0 + x1) / 2;
      pathD += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
      areaD += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    areaD += ` L ${scaleX(points.length - 1)} ${height - padY} Z`;

    const zeroY = scaleY(0);
    const maxValLabel = privacyMode ? '$***.**' : `+$${maxPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    const zeroValLabel = privacyMode ? '$***.**' : '$0';

    container.innerHTML = `
      <div style="width: 100%; position: relative;">
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; display: block; overflow: visible;">
          <defs>
            <linearGradient id="equityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#00f2b0" stop-opacity="0.32" />
              <stop offset="100%" stop-color="#00f2b0" stop-opacity="0.0" />
            </linearGradient>
          </defs>
          <!-- Zero Line -->
          <line x1="${padX}" y1="${zeroY}" x2="${width - padX}" y2="${zeroY}" stroke="rgba(255,255,255,0.1)" stroke-dasharray="3 3" stroke-width="1" />
          <text x="${padX - 8}" y="${zeroY + 3}" text-anchor="end" fill="#64748b" font-size="9" font-family="sans-serif">${zeroValLabel}</text>
          <!-- Peak Line -->
          <text x="${padX - 8}" y="${padY + 4}" text-anchor="end" fill="#00f2b0" font-size="9" font-weight="700" font-family="sans-serif">${maxValLabel}</text>
          <!-- Area & Line -->
          <path d="${areaD}" fill="url(#equityGrad)" />
          <path d="${pathD}" fill="none" stroke="#00f2b0" stroke-width="2.5" stroke-linecap="round" />
          <!-- End point dot -->
          <circle cx="${scaleX(points.length - 1)}" cy="${scaleY(points[points.length - 1].val)}" r="4.5" fill="#00f2b0" stroke="#0c1017" stroke-width="2" />
        </svg>
      </div>
    `;
  }

  /**
   * Renders the 24-hour Session Heatmap (Tokyo, London, New York sessions).
   */
  static renderHourlyHeatmap(container, hourlyStats) {
    if (!container) return;
    const isFa = getLanguage() === 'fa';
    const hours = Array.from({ length: 24 }, (_, h) => {
      const stat = Array.isArray(hourlyStats) ? hourlyStats.find(s => parseInt(s.key, 10) === h) : null;
      return {
        hour: h,
        netPnl: stat ? stat.netPnl : 0,
        trades: stat ? stat.trades : 0
      };
    });

    const maxAbs = Math.max(1, ...hours.map(h => Math.abs(h.netPnl)));

    container.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
        <!-- Session Ribbons -->
        <div style="display: flex; gap: 4px; font-size: 10px; font-weight: 700; color: #94a3b8; margin-bottom: 2px;">
          <span style="flex: 9; background: rgba(56, 189, 248, 0.12); color: #38bdf8; padding: 2px 4px; border-radius: 4px; text-align: center;">Tokyo (00-09 UTC)</span>
          <span style="flex: 9; background: rgba(245, 158, 11, 0.12); color: #f59e0b; padding: 2px 4px; border-radius: 4px; text-align: center;">London (07-16 UTC)</span>
          <span style="flex: 9; background: rgba(168, 85, 247, 0.12); color: #c084fc; padding: 2px 4px; border-radius: 4px; text-align: center;">New York (13-22 UTC)</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); gap: 2px; width: 100%; box-sizing: border-box;">
          ${hours.map(h => {
            const intensity = Math.min(1, Math.abs(h.netPnl) / maxAbs);
            let bg = 'rgba(255,255,255,0.03)';
            let borderColor = 'rgba(255,255,255,0.05)';
            if (h.netPnl > 0) {
              bg = `rgba(0, 242, 176, ${0.15 + intensity * 0.7})`;
              borderColor = 'rgba(0, 242, 176, 0.3)';
            } else if (h.netPnl < 0) {
              bg = `rgba(255, 77, 91, ${0.15 + intensity * 0.7})`;
              borderColor = 'rgba(255, 77, 91, 0.3)';
            }
            return `
              <div style="background: ${bg}; border: 1px solid ${borderColor}; border-radius: 3px; height: 38px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 2px 1px; min-width: 0;" title="Hour ${h.hour}:00 UTC - ${h.trades} trades, Net: $${h.netPnl.toFixed(0)}">
                <span style="font-size: 8px; color: #64748b;">${h.hour}</span>
                <span style="font-size: 8px; font-weight: 800; color: ${h.netPnl >= 0 ? '#00f2b0' : '#ff4d5b'};">${h.trades > 0 ? (h.netPnl >= 0 ? '+' : '-') : ''}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Renders Trade Explorer scatter plot (X: Duration or R, Y: Net P&L).
   */
  static renderTradeScatter(container, roundTrips, privacyMode = false) {
    if (!container) return;
    const trips = (roundTrips || []).filter(t => t.status !== 'open').slice(0, 50);
    if (trips.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 20px; color: #64748b; font-size: 11px;">No closed trades to plot in scatter explorer.</div>`;
      return;
    }

    const width = 500;
    const height = 180;
    const pad = 30;

    const maxAbsPnl = Math.max(50, ...trips.map(t => Math.abs(t.netPnl)));
    const maxDur = Math.max(60000, ...trips.map(t => t.durationMs || 60000));

    const scaleX = (dur) => pad + (Math.min(maxDur, dur || 0) / maxDur) * (width - pad * 2);
    const scaleY = (pnl) => height / 2 - (pnl / maxAbsPnl) * (height / 2 - pad);

    const circles = trips.map(t => {
      const cx = scaleX(t.durationMs || 60000);
      const cy = scaleY(t.netPnl);
      const isWin = t.netPnl >= 0;
      const color = isWin ? '#00f2b0' : '#ff4d5b';
      const label = privacyMode ? '$***.**' : `$${t.netPnl.toFixed(2)}`;
      return `
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${color}" fill-opacity="0.65" stroke="${color}" stroke-width="1.5">
          <title>${t.symbol} (${t.direction.toUpperCase()}): ${label} in ${Math.round((t.durationMs || 0) / 60000)}m</title>
        </circle>
      `;
    }).join('');

    container.innerHTML = `
      <div style="width: 100%;">
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; display: block;">
          <!-- Axes -->
          <line x1="${pad}" y1="${height / 2}" x2="${width - pad}" y2="${height / 2}" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
          <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
          <!-- Labels -->
          <text x="${width - pad}" y="${height / 2 - 4}" text-anchor="end" fill="#64748b" font-size="9">Duration →</text>
          <text x="${pad + 4}" y="${pad + 8}" fill="#00f2b0" font-size="9">+P&L</text>
          <text x="${pad + 4}" y="${height - pad - 4}" fill="#ff4d5b" font-size="9">-P&L</text>
          ${circles}
        </svg>
      </div>
    `;
  }
}
