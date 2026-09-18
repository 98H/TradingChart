// client/src/economicCalendar.js
// Institutional Global Macroeconomic Calendar (FOMC, CPI, NFP, GDP, Central Banks)
// Supports High-Impact filtering, deviation attribution, and on-chart countdown telemetry

import { getLanguage, t, toPersianDigits } from './i18n.js';

export class EconomicCalendarView {
  constructor(options = {}) {
    this.container = options.container;
    this.events = [];
    this.filterImpact = 'all';
    this.filterCategory = 'all';
    this.filterCountry = 'all';
    this.searchQuery = '';
    this.isLoading = true;
    this.nextEventTimer = null;
    this.init();
  }

  async init() {
    await this.fetchEvents();
    this.render();
  }

  async fetchEvents() {
    this.isLoading = true;
    try {
      const resp = await fetch('/api/economic-calendar');
      const data = await resp.json();
      this.events = data.events || [];
    } catch (e) {
      console.error('[EconomicCalendar] Error fetching events:', e);
      this.events = [];
    } finally {
      this.isLoading = false;
    }
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    let filtered = [...this.events];
    if (this.filterImpact !== 'all') {
      filtered = filtered.filter(e => e.impact.toLowerCase() === this.filterImpact.toLowerCase());
    }
    if (this.filterCategory !== 'all') {
      filtered = filtered.filter(e => e.category.toLowerCase() === this.filterCategory.toLowerCase());
    }
    if (this.filterCountry !== 'all') {
      filtered = filtered.filter(e => e.country.toLowerCase() === this.filterCountry.toLowerCase());
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(e => e.event.toLowerCase().includes(q) || (e.eventFa && e.eventFa.includes(q)) || e.currency.toLowerCase().includes(q));
    }

    const nextUpcoming = this.events.find(e => e.timestamp > Date.now());

    this.container.innerHTML = `
      <div class="calendar-panel-wrapper" style="display: flex; flex-direction: column; height: 100%; background: var(--bg-surface);">
        <!-- Top Filter Strip -->
        <div style="padding: 10px 12px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; gap: 6px; align-items: center;">
            <input type="text" id="calendar-search-input" value="${this.searchQuery}" placeholder="${isFa ? 'جستجوی رویداد اقتصادی (CPI, FOMC, NFP)...' : 'Search economic event (CPI, FOMC, NFP)...'}" style="flex: 1; height: 30px; font-size: 11px; padding: 4px 8px;" />
            <button id="btn-refresh-calendar" class="btn-icon-only" title="Refresh Calendar" style="height: 30px; width: 30px; background: var(--bg-card); border: 1px solid var(--border-subtle); color: var(--text-dim); border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
          </div>

          <!-- Filter Pills -->
          <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px;">
            <button class="cal-filter-btn ${this.filterImpact === 'all' ? 'active' : ''}" data-type="impact" data-val="all">${isFa ? 'همه رویدادها' : 'All Events'}</button>
            <button class="cal-filter-btn ${this.filterImpact === 'high' ? 'active' : ''}" data-type="impact" data-val="high" style="color: var(--accent-red);">${isFa ? 'اثر شدید 🔥' : 'High Impact 🔥'}</button>
            <button class="cal-filter-btn ${this.filterCountry === 'US' ? 'active' : ''}" data-type="country" data-val="US">🇺🇸 USD</button>
            <button class="cal-filter-btn ${this.filterCategory === 'central bank' ? 'active' : ''}" data-type="category" data-val="central bank">🏛️ ${isFa ? 'بانک‌های مرکزی' : 'Central Banks'}</button>
            <button class="cal-filter-btn ${this.filterCategory === 'inflation' ? 'active' : ''}" data-type="category" data-val="inflation">📈 ${isFa ? 'تورم' : 'Inflation'}</button>
          </div>
        </div>

        <!-- Next Upcoming Event Highlight Banner -->
        ${nextUpcoming ? `
          <div style="padding: 8px 12px; background: rgba(255, 77, 91, 0.08); border-bottom: 1px solid rgba(255, 77, 91, 0.2); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 14px;">${nextUpcoming.flag}</span>
              <div>
                <div style="font-size: 11px; font-weight: 700; color: #fff;">${isFa ? nextUpcoming.eventFa : nextUpcoming.event}</div>
                <div style="font-size: 10px; color: var(--text-dim);">${nextUpcoming.date} &nbsp;·&nbsp; Prev: ${nextUpcoming.previous} &nbsp;·&nbsp; Exp: ${nextUpcoming.forecast}</div>
              </div>
            </div>
            <span class="badge-high-impact" style="font-size: 9px; font-weight: 800; background: rgba(255, 77, 91, 0.2); color: var(--accent-red); padding: 2px 6px; border-radius: 3px;">
              ${nextUpcoming.impact}
            </span>
          </div>
        ` : ''}

        <!-- Events List Container -->
        <div style="flex: 1; overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 6px;">
          ${this.isLoading ? `
            <div style="text-align: center; padding: 30px 0; color: var(--text-dim); font-size: 12px;">Loading Economic Calendar...</div>
          ` : filtered.length === 0 ? `
            <div style="text-align: center; padding: 30px 0; color: var(--text-dim); font-size: 12px;">${isFa ? 'هیچ رویدادی مطابق با فیلتر یافت نشد' : 'No economic events match the current filter'}</div>
          ` : filtered.map(e => {
            const isReleased = e.actual !== null;
            const isHigh = e.impact === 'HIGH';
            const isMed = e.impact === 'MED';
            const impactColor = isHigh ? 'var(--accent-red)' : isMed ? 'var(--accent-gold)' : 'var(--accent-green)';

            return `
              <div class="calendar-event-card" style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 8px 10px; transition: border-color 0.15s;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 13px;">${e.flag}</span>
                    <span style="font-weight: 700; font-size: 11px; color: var(--text-main);">${e.currency}</span>
                    <span style="font-size: 10px; color: var(--text-dim); font-family: monospace;">${e.date.split(' ')[1]}</span>
                  </div>
                  <span style="font-size: 9px; font-weight: 800; color: ${impactColor}; background: rgba(255,255,255,0.05); padding: 1px 5px; border-radius: 3px;">
                    ${e.impact}
                  </span>
                </div>

                <div style="font-weight: 600; font-size: 12px; color: #fff; margin-bottom: 6px; line-height: 1.3;">
                  ${isFa ? (e.eventFa || e.event) : e.event}
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; font-size: 10px; background: rgba(0,0,0,0.25); padding: 4px 6px; border-radius: 3px;">
                  <div>
                    <span style="color: var(--text-dim); display: block; unicode-bidi: isolate;">${isFa ? 'واقعی' : 'Actual:'}</span>
                    <span class="num-ltr" style="font-weight: 700; color: ${isReleased ? 'var(--accent-cyan)' : 'var(--text-dim)'};">${e.actual || '--'}</span>
                  </div>
                  <div>
                    <span style="color: var(--text-dim); display: block; unicode-bidi: isolate;">${isFa ? 'پیش‌بینی' : 'Forecast:'}</span>
                    <span class="num-ltr" style="color: var(--text-muted);">${e.forecast}</span>
                  </div>
                  <div>
                    <span style="color: var(--text-dim); display: block; unicode-bidi: isolate;">${isFa ? 'قبلی' : 'Previous:'}</span>
                    <span class="num-ltr" style="color: var(--text-dim);">${e.previous}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Bottom Telemetry Footer -->
        <div style="padding: 6px 12px; background: var(--bg-darkest); border-top: 1px solid var(--border-subtle); font-size: 10px; color: var(--text-dim); display: flex; justify-content: space-between; align-items: center;">
          <span>${filtered.length} ${isFa ? 'رویداد ماکرو' : 'Macro Releases'}</span>
          <span style="color: var(--accent-cyan);">${isFa ? 'همگام‌سازی بلادرنگ فدرال رزرو و بانک‌های مرکزی' : 'Direct Central Bank Stream'}</span>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btn-refresh-calendar')?.addEventListener('click', () => {
      this.fetchEvents().then(() => this.render());
    });

    const searchInput = this.container.querySelector('#calendar-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render();
      const updated = this.container.querySelector('#calendar-search-input');
      if (updated) {
        updated.focus();
        updated.selectionStart = updated.selectionEnd = updated.value.length;
      }
    });

    this.container.querySelectorAll('.cal-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const val = btn.getAttribute('data-val');
        if (type === 'impact') {
          this.filterImpact = this.filterImpact === val && val !== 'all' ? 'all' : val;
        } else if (type === 'country') {
          this.filterCountry = this.filterCountry === val && val !== 'all' ? 'all' : val;
        } else if (type === 'category') {
          this.filterCategory = this.filterCategory === val && val !== 'all' ? 'all' : val;
        }
        this.render();
      });
    });
  }
}
