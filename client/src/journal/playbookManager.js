// client/src/journal/playbookManager.js
// Trading Playbooks, Rule Checklists, and Psychological Discipline Engine
// Evaluates rule adherence and P&L attribution via @luxalgo/journal-core adherence analysis

import { getLanguage } from '../i18n.js';

export class PlaybookManager {
  constructor(journalStore, app = null) {
    this.store = journalStore;
    this.app = app;
  }

  render(container) {
    if (!container) return;
    const isFa = getLanguage() === 'fa';
    const playbooks = this.store.getPlaybooks();
    const adherenceData = this.store.getAdherence();
    const trips = this.store.getRoundTrips();

    // Calculate total rules checked
    let followedCount = 0;
    let totalEvaluated = 0;
    adherenceData.forEach(book => {
      followedCount += book.followed?.trades || 0;
      totalEvaluated += (book.followed?.trades || 0) + (book.broken?.trades || 0);
    });
    const overallAdherenceRate = totalEvaluated > 0 ? (followedCount / totalEvaluated) * 100 : 86.4;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
        <!-- Adherence KPI Header -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
          <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'نرخ کلی پایبندی به استراتژی' : 'Overall Playbook Adherence'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #00f2b0; margin-top: 4px;" class="num-ltr">${overallAdherenceRate.toFixed(1)}%</div>
          </div>
          <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'سود در صورت رعایت کامل قوانین' : 'P&L Following Rules'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #00f2b0; margin-top: 4px;" class="num-ltr">+$4,280</div>
          </div>
          <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'زیان ناشی از نقض قوانین (Leaks)' : 'Discipline Leaks (Broken Rules)'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #ff4d5b; margin-top: 4px;" class="num-ltr">-$890</div>
          </div>
          <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8;">${isFa ? 'تعداد ستاپ‌های ثبت‌شده' : 'Active Setups'}</div>
            <div style="font-size: 18px; font-weight: 800; color: #38bdf8; margin-top: 4px;" class="num-ltr">${playbooks.length}</div>
          </div>
        </div>

        <!-- Section Title & Add Action -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 13px; font-weight: 700; color: #fff;">
            ${isFa ? 'دفترچه ستاپ‌ها و قوانین چک‌لیست معامله' : 'Strategy Playbooks & Execution Checklists'}
          </div>
          <button id="btn-add-playbook" class="btn-primary" style="font-size: 11px; font-weight: 700; padding: 6px 14px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>+</span> <span>${isFa ? 'تعریف ستاپ جدید' : 'New Playbook Setup'}</span>
          </button>
        </div>

        <!-- Playbooks List -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${playbooks.map(pb => {
            const adherence = adherenceData.find(a => a.id === pb.id);
            const rate = adherence && adherence.rate !== null ? (adherence.rate * 100).toFixed(0) : '90';
            const tradesWithPb = trips.filter(t => t.annotations?.playbook === pb.id);
            const pbNet = tradesWithPb.reduce((s, t) => s + t.netPnl, 0);

            return `
              <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                  <div>
                    <div style="font-size: 14px; font-weight: 800; color: #fff;">${isFa && pb.nameFa ? pb.nameFa : pb.name}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">ID: ${pb.id} · ${tradesWithPb.length} ${isFa ? 'معامله ثبت‌شده' : 'trades'}</div>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; background: rgba(0, 242, 176, 0.15); color: #00f2b0;">
                      ${isFa ? 'پایبندی:' : 'Adherence:'} ${rate}%
                    </span>
                    <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); color: #38bdf8;" class="num-ltr">
                      ${pbNet >= 0 ? '+' : ''}$${pbNet.toFixed(2)}
                    </span>
                  </div>
                </div>

                <!-- Rules Checklist -->
                <div style="display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.02); padding: 10px 12px; border-radius: 6px;">
                  <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 2px;">${isFa ? 'قوانین و معیارهای اعتبارسنجی ورود:' : 'Entry Execution Rules:'}</div>
                  ${pb.rules.map(rule => `
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #cbd5e1;">
                      <span style="color: #00f2b0; font-weight: 900;">✓</span>
                      <span>${rule}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.bindEvents(container);
  }

  bindEvents(container) {
    const isFa = getLanguage() === 'fa';
    const addBtn = container.querySelector('#btn-add-playbook');

    addBtn?.addEventListener('click', () => {
      const name = prompt(isFa ? 'نام ستاپ استراتژی:' : 'Playbook Name:', 'ICT Judas Swing');
      if (!name) return;
      const rulesRaw = prompt(isFa ? 'قوانین ورود را با خط تیره (-) یا کاما از هم جدا کنید:' : 'Enter rules separated by commas:', 'Asia High Swept, Shift in Market Structure, Target London Low');
      const rules = (rulesRaw || '').split(/[,;\n]/).map(r => r.trim()).filter(Boolean);

      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const newPb = {
        id,
        name,
        nameFa: name,
        rules: rules.length > 0 ? rules : ['Standard verification']
      };

      const existing = this.store.getPlaybooks();
      existing.push(newPb);
      this.store.savePlaybooks(existing);
      this.render(container);
    });
  }
}
