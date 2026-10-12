// client/src/tradeJournalModal.js
// Modal for recording and logging executed trades into the Trade Journal
// Features 1-click direction switch, live P&L preview, SL/TP risk & R-multiple calculation,
// strategy playbooks, psychology tags, voice dictation for notes, and multi-account attribution.

import { getLanguage, t } from './i18n.js';

export class TradeJournalModal {
  constructor(app) {
    this.app = app;
    this.selectedSide = 'buy';
    this.modalEl = null;
    this.isListening = false;
    this.recognition = null;
  }

  getModalEl() {
    let modal = document.querySelector('#modal-log-trade');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-log-trade';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    this.modalEl = modal;
    return modal;
  }

  open() {
    if (this.app?.auth && !this.app.auth.enforce('tradeJournal', 0, 'Trade Journal', 'ژورنال معاملاتی')) {
      return;
    }
    const modal = this.getModalEl();
    this.selectedSide = 'buy';
    this.render();
    modal.classList.add('open');
  }

  close() {
    this.stopVoice();
    const modal = document.querySelector('#modal-log-trade');
    if (modal) modal.classList.remove('open');
  }

  stopVoice() {
    this.isListening = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
      this.recognition = null;
    }
  }

  render() {
    const modal = document.querySelector('#modal-log-trade');
    if (!modal) return;
    this.modalEl = modal;

    const isFa = getLanguage() === 'fa';
    const curSymbol = this.app?.currentSymbol || 'BTCUSDT';
    const curPrice = this.app?.paperTrading?.currentPrice || 80000;
    const baseAsset = this.app?.getBaseAsset ? this.app.getBaseAsset(curSymbol) : (curSymbol.endsWith('USDT') ? curSymbol.replace('USDT', '') : 'BTC');

    const accounts = this.app?.tradeJournal?.store?.getAccounts?.() || [
      { id: 'tradingchart-paper-1', name: 'Paper Trading / حساب آزمایشی' },
      { id: 'prop-ftmo-100k', name: 'FTMO $100K Challenge' }
    ];

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 520px; width: 94vw; max-height: 90vh; background: #0c1017; border: 1px solid #1f293d; border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.8); overflow: hidden; display: flex; flex-direction: column; font-family: ${isFa ? 'var(--font-vazirmatn), sans-serif' : 'var(--font-sans), sans-serif'};">
        <!-- Header -->
        <div style="padding: 14px 18px; background: #080b11; border-bottom: 1px solid #1c263c; display: flex; justify-content: space-between; align-items: center; ${isFa ? 'flex-direction: row; direction: rtl;' : 'direction: ltr;'}">
          <div style="font-weight: 700; font-size: 14px; color: #fff; display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan);"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>${isFa ? 'ثبت معامله جدید در ژورنال' : 'Log New Trade Execution'}</span>
          </div>
          <button id="btn-close-log-trade" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: var(--text-dim); cursor: pointer; width: 34px; height: 34px; border-radius: 6px; display: flex; align-items: center; justify-content: center;" title="${isFa ? 'بستن پنجره' : 'Close modal'}" aria-label="${isFa ? 'بستن' : 'Close'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
          
          <!-- Direction Segmented Pill Switch (1-click) -->
          <div>
            <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 6px;">
              ${isFa ? 'جهت موقعیت معاملاتی' : 'Position Direction'}
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: var(--bg-surface); padding: 4px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <button id="side-pill-buy" type="button" class="side-pill-btn ${this.selectedSide === 'buy' ? 'active' : ''}" style="padding: 8px; font-size: 12px; font-weight: 700; border-radius: 6px; border: 1px solid ${this.selectedSide === 'buy' ? 'var(--accent-green)' : 'transparent'}; background: ${this.selectedSide === 'buy' ? 'rgba(0, 242, 176, 0.15)' : 'transparent'}; color: ${this.selectedSide === 'buy' ? 'var(--accent-green)' : 'var(--text-dim)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s ease;">
                <span>▲</span> ${isFa ? 'خرید (BUY / LONG)' : 'BUY / LONG'}
              </button>
              <button id="side-pill-sell" type="button" class="side-pill-btn ${this.selectedSide === 'sell' ? 'active' : ''}" style="padding: 8px; font-size: 12px; font-weight: 700; border-radius: 6px; border: 1px solid ${this.selectedSide === 'sell' ? 'var(--accent-red)' : 'transparent'}; background: ${this.selectedSide === 'sell' ? 'rgba(255, 77, 91, 0.15)' : 'transparent'}; color: ${this.selectedSide === 'sell' ? 'var(--accent-red)' : 'var(--text-dim)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s ease;">
                <span>▼</span> ${isFa ? 'فروش (SELL / SHORT)' : 'SELL / SHORT'}
              </button>
            </div>
          </div>

          <!-- Account & Symbol -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'حساب معاملاتی' : 'Account'}</label>
              <select id="log-trade-account" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;">
                ${accounts.filter(a => a.id !== 'all').map(a => `
                  <option value="${a.id}">${(getLanguage() === 'fa' && a.nameFa) || a.name}</option>
                `).join('')}
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'نماد دارایی' : 'Symbol'}</label>
              <input type="text" id="log-trade-symbol" value="${curSymbol}" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; font-weight: 700; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff; direction: ltr !important;" />
            </div>
          </div>

          <!-- Entry & Exit Prices -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'قیمت ورود ($)' : 'Entry Price ($)'}</label>
              <input type="number" id="log-trade-entry" value="${curPrice.toFixed(2)}" step="any" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; font-weight: 700; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;" class="num-ltr" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'قیمت خروج ($)' : 'Exit Price ($)'}</label>
              <input type="number" id="log-trade-exit" value="${(curPrice * 1.015).toFixed(2)}" step="any" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; font-weight: 700; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;" class="num-ltr" />
            </div>
          </div>

          <!-- Quantity & Stop-Loss (Risk Calculation) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'حجم پوزیشن' : 'Quantity / Size'}</label>
              <div style="display: flex; align-items: center; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0 8px;">
                <input type="number" id="log-trade-qty" value="0.5" step="0.1" min="0.01" style="width: 100%; border: none; background: transparent; padding: 7px 0; font-size: 12px; font-weight: 700; color: #fff; outline: none;" class="num-ltr" />
                <span id="log-unit-label" style="font-size: 10px; font-weight: 700; color: var(--accent-cyan);">${baseAsset}</span>
              </div>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'حد ضرر / استاپ لاس ($)' : 'Stop Loss ($)'}</label>
              <input type="number" id="log-trade-sl" value="${(curPrice * 0.99).toFixed(2)}" step="any" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; font-weight: 700; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;" class="num-ltr" />
            </div>
          </div>

          <!-- Live Real-Time P&L & R-Multiple Box -->
          <div id="live-pnl-preview-box" style="background: rgba(0, 242, 176, 0.06); border: 1px solid rgba(0, 242, 176, 0.25); border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
            <div>
              <div style="font-size: 10px; color: var(--text-dim);">${isFa ? 'پیش‌نمایش سود/زیان و ضریب ریسک:' : 'Estimated Net P&L & R-Multiple:'}</div>
              <div id="log-r-preview" style="font-size: 11px; font-weight: 700; color: #38bdf8;">R: 1 : 2.50</div>
            </div>
            <div id="log-pnl-preview" class="live-pnl-val num-ltr" style="font-size: 14px; font-weight: 800; color: var(--accent-green);">+$600.00 (+1.50%)</div>
          </div>

          <!-- Strategy Playbook & Psychological Discipline -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'ستاپ استراتژی' : 'Playbook Setup'}</label>
              <select id="log-trade-strat" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 11px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;">
                <option value="smc-order-block">${isFa ? 'اردربلاک اسمارت مانی (SMC OB)' : 'SMC Order Block'}</option>
                <option value="fvg-retest">${isFa ? 'گپ ارزش منصفانه (FVG)' : 'Fair Value Gap (FVG)'}</option>
                <option value="break-and-retest">${isFa ? 'شکست و پولبک تثبیتی' : 'Breakout & Retest'}</option>
                <option value="trend-pullback">${isFa ? 'پولبک در جهت روند' : 'Trend Pullback'}</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim); display: block; margin-bottom: 4px;">${isFa ? 'خطای روانشناسی / تگ' : 'Psychology Tag'}</label>
              <select id="log-trade-mistake" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 11px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff;">
                <option value="None">${isFa ? '✓ پایبندی کامل به پلن' : '✓ Followed Plan'}</option>
                <option value="FOMO">${isFa ? '⚠️ طمع و ترس از دست دادن (FOMO)' : '⚠️ FOMO Entry'}</option>
                <option value="Moved Stop">${isFa ? '⚠️ جابجایی حد ضرر' : '⚠️ Moved Stop Loss'}</option>
                <option value="Exited Early">${isFa ? '⚠️ خروج زودهنگام از ترس' : '⚠️ Exited Early'}</option>
                <option value="Overleveraged">${isFa ? '⚠️ حجم بیش از حد مجاز' : '⚠️ Overleveraged'}</option>
              </select>
            </div>
          </div>

          <!-- Notes with Voice Dictation Button -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label style="font-size: 11px; font-weight: 600; color: var(--text-dim);">
                ${isFa ? 'یادداشت معاملاتی و دلایل ورود:' : 'Trade Notes & Review:'}
              </label>
              <button type="button" id="btn-modal-voice-dictate" style="background: rgba(0, 242, 176, 0.12); border: 1px solid #00f2b0; color: #00f2b0; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                <span id="modal-voice-label">${isFa ? 'ضبط صوتی' : 'Voice Dictate'}</span>
              </button>
            </div>
            <textarea id="log-trade-notes" rows="2" placeholder="${isFa ? 'توضیحات تکمیلی ورود، احساسات و دلایل خروج...' : 'Entry triggers, market context, psychology...'}" style="width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 12px; line-height: 1.5; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; color: #fff; resize: vertical; font-family: ${isFa ? 'var(--font-vazirmatn), sans-serif' : 'var(--font-sans), sans-serif'};"></textarea>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button id="btn-cancel-log-trade" class="btn-secondary" style="padding: 7px 14px; font-size: 12px; cursor: pointer;">
              ${isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button id="btn-save-log-trade" class="btn-primary" style="padding: 7px 20px; font-size: 12px; font-weight: 700; cursor: pointer;">
              ${isFa ? '✓ ثبت در ژورنال' : '✓ Save to Journal'}
            </button>
          </div>

        </div>
      </div>
    `;

    // Direction switcher
    const buyPill = modal.querySelector('#side-pill-buy');
    const sellPill = modal.querySelector('#side-pill-sell');

    const updateSide = (side) => {
      this.selectedSide = side;
      if (side === 'buy') {
        buyPill.classList.add('active');
        sellPill.classList.remove('active');
        buyPill.style.background = 'rgba(0, 242, 176, 0.15)';
        buyPill.style.borderColor = 'var(--accent-green)';
        buyPill.style.color = 'var(--accent-green)';
        sellPill.style.background = 'transparent';
        sellPill.style.borderColor = 'transparent';
        sellPill.style.color = 'var(--text-dim)';
      } else {
        sellPill.classList.add('active');
        buyPill.classList.remove('active');
        sellPill.style.background = 'rgba(255, 77, 91, 0.15)';
        sellPill.style.borderColor = 'var(--accent-red)';
        sellPill.style.color = 'var(--accent-red)';
        buyPill.style.background = 'transparent';
        buyPill.style.borderColor = 'transparent';
        buyPill.style.color = 'var(--text-dim)';
      }
      calcLivePnl();
    };

    buyPill?.addEventListener('click', () => updateSide('buy'));
    sellPill?.addEventListener('click', () => updateSide('sell'));

    // Live P&L and Risk-Reward (R) Calculation
    const entryInput = modal.querySelector('#log-trade-entry');
    const exitInput = modal.querySelector('#log-trade-exit');
    const slInput = modal.querySelector('#log-trade-sl');
    const qtyInput = modal.querySelector('#log-trade-qty');
    const pnlBox = modal.querySelector('#live-pnl-preview-box');
    const pnlVal = modal.querySelector('#log-pnl-preview, #live-pnl-val');
    const rVal = modal.querySelector('#log-r-preview');

    const calcLivePnl = () => {
      const entry = parseFloat(entryInput?.value) || 1;
      const exit = parseFloat(exitInput?.value) || 1;
      const sl = parseFloat(slInput?.value) || (this.selectedSide === 'buy' ? entry * 0.99 : entry * 1.01);
      const qty = parseFloat(qtyInput?.value) || 0.1;

      const pnl = (this.selectedSide === 'buy' ? (exit - entry) : (entry - exit)) * qty;
      const pct = (this.selectedSide === 'buy' ? ((exit - entry) / entry) : ((entry - exit) / entry)) * 100;
      const isWin = pnl >= 0;

      const riskPerUnit = Math.abs(entry - sl) || 1;
      const rewardPerUnit = (this.selectedSide === 'buy' ? (exit - entry) : (entry - exit));
      const rMultiple = rewardPerUnit / riskPerUnit;

      if (pnlVal) {
        pnlVal.innerText = `${isWin ? '+' : ''}$${pnl.toFixed(2)} (${isWin ? '+' : ''}${pct.toFixed(2)}%)`;
        pnlVal.style.color = isWin ? 'var(--accent-green)' : 'var(--accent-red)';
      }
      if (rVal) {
        rVal.innerText = `R: 1 : ${rMultiple.toFixed(2)}`;
        rVal.style.color = rMultiple >= 2.0 ? '#00f2b0' : (rMultiple >= 1.0 ? '#38bdf8' : '#facc15');
      }
      if (pnlBox) {
        pnlBox.style.background = isWin ? 'rgba(0, 242, 176, 0.06)' : 'rgba(255, 77, 91, 0.06)';
        pnlBox.style.borderColor = isWin ? 'rgba(0, 242, 176, 0.25)' : 'rgba(255, 77, 91, 0.25)';
      }
    };

    const symInput = modal.querySelector('#log-trade-symbol');
    const unitLabel = modal.querySelector('#log-unit-label');
    symInput?.addEventListener('input', () => {
      const s = symInput.value.trim().toUpperCase();
      const u = this.app?.getBaseAsset ? this.app.getBaseAsset(s) : (s.endsWith('USDT') ? s.replace('USDT', '') : s);
      if (unitLabel && u) unitLabel.innerText = u;
    });

    entryInput?.addEventListener('input', calcLivePnl);
    exitInput?.addEventListener('input', calcLivePnl);
    slInput?.addEventListener('input', calcLivePnl);
    qtyInput?.addEventListener('input', calcLivePnl);
    calcLivePnl();

    // Voice Dictation for Notes
    const voiceBtn = modal.querySelector('#btn-modal-voice-dictate');
    const notesTextarea = modal.querySelector('#log-trade-notes');
    const voiceLabel = modal.querySelector('#modal-voice-label');

    voiceBtn?.addEventListener('click', () => {
      if (this.isListening) {
        this.stopVoice();
        if (voiceLabel) voiceLabel.textContent = isFa ? 'ضبط صوتی' : 'Voice Dictate';
        voiceBtn.style.background = 'rgba(0, 242, 176, 0.12)';
        voiceBtn.style.borderColor = '#00f2b0';
        return;
      }

      const SpeechConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechConstructor) {
        alert(isFa ? 'مرورگر از ضبط صوتی پشتیبانی نمی‌کند.' : 'Speech recognition not supported in this browser.');
        return;
      }

      try {
        this.recognition = new SpeechConstructor();
        this.recognition.lang = isFa ? 'fa-IR' : 'en-US';
        this.recognition.onstart = () => {
          this.isListening = true;
          if (voiceLabel) voiceLabel.textContent = isFa ? 'در حال شنیدن...' : 'Listening…';
          voiceBtn.style.background = '#ff4d5b';
          voiceBtn.style.borderColor = '#ff4d5b';
          voiceBtn.style.color = '#fff';
        };
        this.recognition.onresult = (event) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          if (notesTextarea) {
            notesTextarea.value = (notesTextarea.value ? notesTextarea.value + ' ' : '') + text;
          }
        };
        this.recognition.onend = () => {
          this.stopVoice();
          if (voiceLabel) voiceLabel.textContent = isFa ? 'ضبط صوتی' : 'Voice Dictate';
          voiceBtn.style.background = 'rgba(0, 242, 176, 0.12)';
          voiceBtn.style.borderColor = '#00f2b0';
          voiceBtn.style.color = '#00f2b0';
        };
        this.recognition.start();
      } catch (e) {
        this.stopVoice();
      }
    });

    const close = () => {
      this.stopVoice();
      modal.classList.remove('open');
    };
    modal.querySelector('#btn-close-log-trade')?.addEventListener('click', close);
    modal.querySelector('#btn-cancel-log-trade')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#btn-save-log-trade')?.addEventListener('click', () => {
      const sym = modal.querySelector('#log-trade-symbol')?.value.trim().toUpperCase() || 'BTCUSDT';
      const side = this.selectedSide;
      const accountId = modal.querySelector('#log-trade-account')?.value || 'tradingchart-paper-1';
      const playbook = modal.querySelector('#log-trade-strat')?.value || 'smc-order-block';
      const mistake = modal.querySelector('#log-trade-mistake')?.value || 'None';
      const notes = modal.querySelector('#log-trade-notes')?.value || '';
      const entry = parseFloat(entryInput?.value) || curPrice;
      const exit = parseFloat(exitInput?.value) || (curPrice * 1.01);
      const sl = parseFloat(slInput?.value) || (side === 'buy' ? entry * 0.99 : entry * 1.01);
      const qty = parseFloat(qtyInput?.value) || 0.5;

      const now = new Date();
      const openTime = new Date(now.getTime() - 3600000).toISOString();
      const closeTime = now.toISOString();

      const newExec1 = {
        id: `exec-open-${Date.now()}`,
        accountId,
        symbol: sym,
        side,
        quantity: qty,
        price: entry,
        executedAt: openTime,
        fee: 1.5,
        source: 'manual',
        assetClass: sym.endsWith('USDT') ? 'crypto' : (sym === 'XAUUSD' ? 'other' : 'forex')
      };

      const newExec2 = {
        id: `exec-close-${Date.now()}`,
        accountId,
        symbol: sym,
        side: side === 'buy' ? 'sell' : 'buy',
        quantity: qty,
        price: exit,
        executedAt: closeTime,
        fee: 1.5,
        source: 'manual',
        assetClass: sym.endsWith('USDT') ? 'crypto' : (sym === 'XAUUSD' ? 'other' : 'forex')
      };

      const tradeKey = `${accountId}|${sym}|${side === 'buy' ? 'long' : 'short'}|${openTime}`;
      const ann = {
        playbook,
        tags: [playbook],
        mistakes: mistake !== 'None' ? [mistake] : [],
        notes,
        stopLoss: sl,
        rating: 5
      };

      // Store in JournalStore
      if (this.app?.tradeJournal?.store) {
        this.app.tradeJournal.store.addExecutions([newExec2, newExec1], accountId);
        this.app.tradeJournal.store.setAnnotation(tradeKey, ann);
      } else if (this.app?.tradeJournal?.sampleExecutions) {
        this.app.tradeJournal.sampleExecutions.unshift(newExec2, newExec1);
        this.app.tradeJournal.saveExecutions?.();
        this.app.tradeJournal.render?.();
      }

      if (this.app?.fullPageJournal?.sampleExecutions) {
        this.app.fullPageJournal.render?.();
      }

      const pnl = (side === 'buy' ? (exit - entry) : (entry - exit)) * qty;
      const formattedPnl = `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`;
      this.app?.showExecutionToast?.(side.toUpperCase(), qty, `${sym} (${formattedPnl})`);
      close();
    });
  }
}
