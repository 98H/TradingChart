// client/src/indicatorsModal.js
// Complete 84+ Technical Indicators & Smart Money library modal for TradingChart

import { INDICATORS_LIBRARY } from './indicatorsData.js';
import { getLanguage, t, toPersianDigits } from './i18n.js';

export { INDICATORS_LIBRARY };

const CATEGORY_BADGES = {
  smc: { label: 'SMC / ICT', bg: 'rgba(0, 229, 255, 0.15)', color: '#00e5ff' },
  trend: { label: 'TREND', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  oscillators: { label: 'OSCILLATOR', bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' },
  volatility: { label: 'VOLATILITY', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
  volume: { label: 'VOLUME', bg: 'rgba(14, 203, 129, 0.15)', color: '#34d399' }
};

export class IndicatorsModal {
  constructor(options = {}) {
    this.modalEl = options.modalEl;
    this.onAddIndicator = options.onAddIndicator || (() => {});
    this.activeCategory = 'all';
    this.searchQuery = '';
    this.render();
  }

  open() {
    if (this.modalEl) {
      this.modalEl.classList.add('open');
      const input = this.modalEl.querySelector('#ind-search-input');
      if (input) {
        input.value = '';
        this.searchQuery = '';
        input.focus();
        this.populateList();
      }
    }
  }

  close() {
    if (this.modalEl) this.modalEl.classList.remove('open');
  }

  render() {
    if (!this.modalEl) return;
    const isFa = getLanguage() === 'fa';

    this.modalEl.innerHTML = `
      <div class="modal-box" dir="${isFa ? 'rtl' : 'ltr'}" style="width: 720px; max-height: 85vh; display: flex; flex-direction: column; ${isFa ? 'direction: rtl; text-align: right; font-family: var(--font-vazirmatn), var(--font-sans);' : 'direction: ltr; text-align: left;'}">
        <!-- Header -->
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; ${isFa ? 'direction: rtl;' : 'direction: ltr;'}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan);"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #fff;">
              <span id="ind-modal-title">${isFa ? `دایره‌المعارف اندیکاتورها و استراتژی‌ها (${toPersianDigits(INDICATORS_LIBRARY.length)}+ ابزار)` : `Indicators, Metrics & Strategies (${INDICATORS_LIBRARY.length}+)`}</span>
            </h3>
          </div>
          <button class="modal-close-btn" id="modal-close-ind" style="${isFa ? 'order: -1;' : ''}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Search Bar & Category Filter -->
        <div style="padding: 12px 20px; background: var(--bg-darkest); border-bottom: 1px solid var(--border-subtle); display: flex; gap: 10px; align-items: center;">
          <div style="flex: 1; position: relative; display: flex; align-items: center;">
            <input type="text" id="ind-search-input" placeholder="${isFa ? 'جستجو در بین ۱۱۴ اندیکاتور (RSI, SMC, Supertrend, EMA, MACD, ICT)...' : 'Search 114+ indicators (RSI, SMC, Supertrend, EMA, MACD, ICT)...'}" style="width: 100%; height: 36px; padding: 6px 32px 6px 12px; font-size: 13px; text-align: ${isFa ? 'right' : 'left'};" />
            <button id="ind-clear-search" style="position: absolute; ${isFa ? 'left: 8px;' : 'right: 8px;'} background: transparent; border: none; color: var(--text-dim); cursor: pointer; display: none; font-size: 14px;">✕</button>
          </div>
          <select id="ind-cat-select" style="height: 36px; font-size: 12px; padding: 6px 10px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px;">
            <option value="all">${isFa ? `همه دسته‌بندی‌ها (${toPersianDigits(INDICATORS_LIBRARY.length)})` : `All Categories (${INDICATORS_LIBRARY.length})`}</option>
            <option value="smc">${isFa ? 'اسمارت مانی و ICT' : 'Smart Money & ICT'}</option>
            <option value="trend">${isFa ? 'دنبال‌کننده روند' : 'Trend Following'}</option>
            <option value="oscillators">${isFa ? 'اسیلاتورها' : 'Oscillators'}</option>
            <option value="volatility">${isFa ? 'نوسان‌پذیری' : 'Volatility'}</option>
            <option value="volume">${isFa ? 'حجم و پروفایل' : 'Volume & Profile'}</option>
          </select>
        </div>

        <!-- Result count bar -->
        <div style="padding: 6px 20px; font-size: 11px; color: var(--text-dim); background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between;">
          <span id="ind-count-label">${isFa ? `نمایش ${toPersianDigits(INDICATORS_LIBRARY.length)} از ${toPersianDigits(INDICATORS_LIBRARY.length)} اندیکاتور` : `Showing ${INDICATORS_LIBRARY.length} indicators`}</span>
          <span>${isFa ? 'برای رسم روی چارت فعال روی ردیف یا «+ افزودن» کلیک کنید' : 'Click row or \'+ Add\' to plot onto active chart'}</span>
        </div>

        <!-- Scrollable List Container -->
        <div class="modal-content" id="ind-items-container" style="flex: 1; overflow-y: auto; padding: 14px 20px 24px 20px;">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    const closeBtn = this.modalEl.querySelector('#modal-close-ind');
    const input = this.modalEl.querySelector('#ind-search-input');
    const clearBtn = this.modalEl.querySelector('#ind-clear-search');
    const catSelect = this.modalEl.querySelector('#ind-cat-select');

    closeBtn.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    const updateFilter = () => {
      this.searchQuery = input.value.trim().toLowerCase();
      this.activeCategory = catSelect.value;
      clearBtn.style.display = this.searchQuery ? 'block' : 'none';
      this.populateList();
    };

    input.addEventListener('input', updateFilter);
    catSelect.addEventListener('change', updateFilter);

    clearBtn.addEventListener('click', () => {
      input.value = '';
      updateFilter();
      input.focus();
    });

    this.populateList();
  }

  populateList() {
    const cont = this.modalEl.querySelector('#ind-items-container');
    const countLabel = this.modalEl.querySelector('#ind-count-label');
    if (!cont) return;
    const isFa = getLanguage() === 'fa';

    const filtered = INDICATORS_LIBRARY.filter(i => {
      const matchCat = this.activeCategory === 'all' || i.category === this.activeCategory;
      const matchQ = !this.searchQuery ||
        i.name.toLowerCase().includes(this.searchQuery) ||
        i.description.toLowerCase().includes(this.searchQuery) ||
        (i.id && i.id.toLowerCase().includes(this.searchQuery)) ||
        (i.category && i.category.toLowerCase().includes(this.searchQuery)) ||
        (this.searchQuery === 'smc' && (i.category === 'smc' || i.name.toLowerCase().includes('smart money')));
      return matchCat && matchQ;
    });

    if (countLabel) {
      countLabel.innerText = isFa
        ? `نمایش ${toPersianDigits(filtered.length)} از ${toPersianDigits(INDICATORS_LIBRARY.length)} اندیکاتور تحلیلی`
        : `Showing ${filtered.length} of ${INDICATORS_LIBRARY.length} indicators`;
    }

    if (filtered.length === 0) {
      cont.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 48px 0; font-size: 13px;">${isFa ? 'هیچ اندیکاتوری مطابق با جستجوی شما یافت نشد.' : 'No matching indicators found. Try another query or category.'}</div>`;
      return;
    }

    cont.innerHTML = filtered.map(item => {
      const badge = CATEGORY_BADGES[item.category] || { label: item.category.toUpperCase(), bg: 'rgba(255,255,255,0.1)', color: '#fff' };
      return `
        <div class="ind-card-row indicator-item ind-card ind-item-row" data-id="${item.id}" data-name="${item.name}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 8px; background: var(--bg-card); cursor: pointer; transition: all 0.15s ease;">
          <div style="flex: 1; padding-${isFa ? 'left' : 'right'}: 14px;">
            <div style="font-weight: 700; font-size: 13px; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
              ${item.name}
              <span style="font-size: 9px; background: ${badge.bg}; color: ${badge.color}; padding: 1px 6px; border-radius: 3px; font-weight: 800; letter-spacing: 0.5px;">${badge.label}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 3px; line-height: 1.4;">${item.description}</div>
          </div>
          <button class="btn-secondary add-ind-btn" data-id="${item.id}" style="padding: 5px 12px; font-size: 11px; white-space: nowrap; flex-shrink: 0; min-width: 68px; text-align: center; font-weight: 700;">
            ${isFa ? '+ افزودن' : '+ Add'}
          </button>
        </div>
      `;
    }).join('');

    const handleAdd = (btn, item) => {
      const res = this.onAddIndicator(item);
      btn.innerText = isFa ? '✓ افزوده شد' : '✓ Added';
      btn.style.borderColor = 'var(--accent-green)';
      btn.style.color = 'var(--accent-green)';
      setTimeout(() => {
        btn.innerText = isFa ? '+ افزودن' : '+ Add';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 1500);
    };

    cont.querySelectorAll('.add-ind-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = INDICATORS_LIBRARY.find(x => x.id === id);
        if (item) handleAdd(btn, item);
      });
    });

    cont.querySelectorAll('.ind-card-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        const item = INDICATORS_LIBRARY.find(x => x.id === id);
        const btn = row.querySelector('.add-ind-btn');
        if (item && btn) handleAdd(btn, item);
      });
      row.addEventListener('mouseenter', () => { row.style.borderColor = 'var(--accent-cyan)'; row.style.background = 'var(--bg-card-hover)'; });
      row.addEventListener('mouseleave', () => { row.style.borderColor = 'var(--border-subtle)'; row.style.background = 'var(--bg-card)'; });
    });
  }
}
