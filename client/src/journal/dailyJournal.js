// client/src/journal/dailyJournal.js
// Daily Journal, Routine Checklists, and Voice Dictation via Web Speech API

import { getLanguage } from '../i18n.js';

export class DailyJournal {
  constructor(journalStore, app = null) {
    this.store = journalStore;
    this.app = app;
    this.currentDate = new Date().toISOString().slice(0, 10);
    this.isListening = false;
    this.recognition = null;
  }

  render(container) {
    if (!container) return;
    const isFa = getLanguage() === 'fa';
    const note = this.store.getDailyNote(this.currentDate);
    const trips = this.store.getRoundTrips();

    // Day trades
    const dayTrades = trips.filter(t => {
      const d = t.closedAt ? t.closedAt.slice(0, 10) : (t.openedAt ? t.openedAt.slice(0, 10) : '');
      return d === this.currentDate;
    });

    const dayPnl = dayTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const dayWins = dayTrades.filter(t => t.netPnl > 0).length;
    const dayWinRate = dayTrades.length > 0 ? (dayWins / dayTrades.length) * 100 : 0;
    const privacy = this.store.settings.privacyMode;

    const emotions = [
      { id: 'Calm', labelFa: 'آرام و مسلط', labelEn: 'Calm & In Control', icon: '🧘' },
      { id: 'Focused', labelFa: 'متمرکز و دقیق', labelEn: 'Laser Focused', icon: '🎯' },
      { id: 'Anxious', labelFa: 'مضطرب / نگران', labelEn: 'Anxious', icon: '⚡' },
      { id: 'FOMO', labelFa: 'طمع / ترس از دست دادن', labelEn: 'Greed / FOMO', icon: '🔥' },
      { id: 'Frustrated', labelFa: 'سرخورده / خسته', labelEn: 'Frustrated', icon: '🌧️' }
    ];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box; ${isFa ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}">
        <!-- Date Bar & Navigation -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 10px 14px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-day-prev" style="background: rgba(255,255,255,0.06); border: 1px solid #253248; color: #fff; width: 32px; height: 32px; border-radius: 6px; cursor: pointer;">‹</button>
            <input type="date" id="daily-journal-date" value="${this.currentDate}" style="background: #080b11; border: 1px solid #1c263c; color: #fff; padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 700;" />
            <button id="btn-day-next" style="background: rgba(255,255,255,0.06); border: 1px solid #253248; color: #fff; width: 32px; height: 32px; border-radius: 6px; cursor: pointer;">›</button>
            <button id="btn-day-today" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">${isFa ? 'امروز' : 'Today'}</button>
          </div>

          <!-- Day Stats Pill -->
          <div style="display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 12px; color: #94a3b8;">${dayTrades.length} ${isFa ? 'معامله' : 'trades'}</span>
            <span style="font-size: 13px; font-weight: 800; color: ${dayPnl >= 0 ? '#00f2b0' : '#ff4d5b'};" class="num-ltr">
              ${privacy ? '$***.**' : `${dayPnl >= 0 ? '+' : ''}$${dayPnl.toFixed(2)}`}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.15); padding: 2px 6px; border-radius: 4px;">
              ${dayWinRate.toFixed(0)}% Win
            </span>
          </div>
        </div>

        <!-- Emotion & Mindset Selector -->
        <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">
            ${isFa ? 'وضعیت روانی و احساسی روز معامله‌گری:' : 'Trader Psychology & Mindset State:'}
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${emotions.map(em => `
              <button class="btn-emotion ${note.emotion === em.id ? 'active' : ''}" data-emotion="${em.id}" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid ${note.emotion === em.id ? '#00f2b0' : '#253248'}; background: ${note.emotion === em.id ? 'rgba(0, 242, 176, 0.15)' : 'rgba(255,255,255,0.03)'}; color: ${note.emotion === em.id ? '#00f2b0' : '#cbd5e1'}; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.15s ease;">
                <span>${em.icon}</span> <span>${isFa ? em.labelFa : em.labelEn}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Voice Dictation & Text Editor Card -->
        <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="font-size: 13px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span>${isFa ? 'یادداشت‌های تحلیلی و بازنگری روزانه' : 'Daily Analytical Review & Notes'}</span>
            </div>

            <!-- Voice Dictation Button -->
            <button id="btn-voice-dictate" style="background: ${this.isListening ? '#ff4d5b' : 'rgba(0, 242, 176, 0.15)'}; border: 1px solid ${this.isListening ? '#ff4d5b' : '#00f2b0'}; color: ${this.isListening ? '#fff' : '#00f2b0'}; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              <span id="voice-dictate-label">${this.isListening ? (isFa ? 'درحال شنیدن... (کلیک برای توقف)' : 'Listening… Click to Stop') : (isFa ? 'ضبط صوتی یادداشت (Dictate)' : 'Voice Dictate')}</span>
            </button>
          </div>

          <!-- Textarea for Notes -->
          <textarea id="daily-journal-textarea" placeholder="${isFa ? 'دیدگاه بازار، اتفاقات روز، مدیریت ریسک و درس‌های آموخته‌شده را اینجا بنویسید یا با صدای خود دیکته کنید...' : 'Write daily session reflections, execution analysis, psychological state or dictate by voice...'}" style="width: 100%; min-height: 140px; background: #080b11; border: 1px solid #1c263c; border-radius: 8px; padding: 12px; color: #fff; font-size: 12px; line-height: 1.6; resize: vertical; box-sizing: border-box; font-family: ${isFa ? 'var(--font-vazirmatn), sans-serif' : 'var(--font-sans), sans-serif'};">${note.text || ''}</textarea>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span id="journal-save-indicator" style="font-size: 10px; color: #64748b;">
              ${note.updatedAt ? `${isFa ? 'آخرین ذخیره:' : 'Last saved:'} ${new Date(note.updatedAt).toLocaleTimeString()}` : ''}
            </span>
            <button id="btn-save-daily-note" class="btn-primary" style="font-size: 11px; padding: 6px 18px; border-radius: 6px; font-weight: 700; cursor: pointer;">
              ${isFa ? 'ذخیره یادداشت' : 'Save Note'}
            </button>
          </div>
        </div>

        <!-- Today Executions List -->
        <div style="background: #0c1017; border: 1px solid #1f293d; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">
            ${isFa ? `معاملات ثبت‌شده در تاریخ ${this.currentDate}:` : `Trades Executed on ${this.currentDate}:`}
          </div>
          ${dayTrades.length === 0 ? `
            <div style="color: #64748b; font-size: 11px; padding: 8px 0;">${isFa ? 'هیچ معامله‌ای در این تاریخ ثبت نشده است.' : 'No closed trades recorded on this date.'}</div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${dayTrades.map(t => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 6px 10px; border-radius: 4px; font-size: 11px;">
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-weight: 700; color: #fff;">${t.symbol}</span>
                    <span style="font-size: 9px; padding: 1px 6px; border-radius: 3px; background: ${t.direction === 'long' ? 'rgba(0,242,176,0.15)' : 'rgba(255,77,91,0.15)'}; color: ${t.direction === 'long' ? '#00f2b0' : '#ff4d5b'}; font-weight: 700;">${t.direction.toUpperCase()}</span>
                  </div>
                  <span style="font-weight: 800; color: ${t.netPnl >= 0 ? '#00f2b0' : '#ff4d5b'};" class="num-ltr">
                    ${privacy ? '$***.**' : `${t.netPnl >= 0 ? '+' : ''}$${t.netPnl.toFixed(2)}`}
                  </span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    this.bindEvents(container);
  }

  bindEvents(container) {
    const isFa = getLanguage() === 'fa';
    const dateInput = container.querySelector('#daily-journal-date');
    const prevBtn = container.querySelector('#btn-day-prev');
    const nextBtn = container.querySelector('#btn-day-next');
    const todayBtn = container.querySelector('#btn-day-today');
    const textarea = container.querySelector('#daily-journal-textarea');
    const saveBtn = container.querySelector('#btn-save-daily-note');
    const voiceBtn = container.querySelector('#btn-voice-dictate');
    const indicator = container.querySelector('#journal-save-indicator');

    const changeDate = (newDateStr) => {
      this.currentDate = newDateStr;
      this.render(container);
    };

    dateInput?.addEventListener('change', (e) => changeDate(e.target.value));

    prevBtn?.addEventListener('click', () => {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() - 1);
      changeDate(d.toISOString().slice(0, 10));
    });

    nextBtn?.addEventListener('click', () => {
      const d = new Date(this.currentDate);
      d.setDate(d.getDate() + 1);
      changeDate(d.toISOString().slice(0, 10));
    });

    todayBtn?.addEventListener('click', () => {
      changeDate(new Date().toISOString().slice(0, 10));
    });

    // Emotion buttons
    container.querySelectorAll('.btn-emotion').forEach(btn => {
      btn.addEventListener('click', () => {
        const emotion = btn.dataset.emotion;
        this.store.saveDailyNote(this.currentDate, { emotion });
        this.render(container);
      });
    });

    // Save note
    const saveNote = () => {
      const text = textarea?.value || '';
      this.store.saveDailyNote(this.currentDate, { text });
      if (indicator) {
        indicator.textContent = isFa ? 'ذخیره شد ✓' : 'Saved ✓';
        indicator.style.color = '#00f2b0';
      }
    };

    saveBtn?.addEventListener('click', saveNote);
    textarea?.addEventListener('input', () => {
      if (indicator) indicator.textContent = isFa ? 'تغییرات ذخیره‌نشده...' : 'Unsaved changes…';
    });

    // Web Speech API Voice Dictation
    voiceBtn?.addEventListener('click', () => {
      if (this.isListening) {
        this.stopVoice();
        this.render(container);
        return;
      }

      const speechWindow = window;
      const SpeechConstructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

      if (!SpeechConstructor) {
        alert(isFa 
          ? 'مرورگر شما از قابلیت ضبط صوتی Web Speech پشتیبانی نمی‌کند. لطفاً در مرورگر کروم باز کنید.'
          : 'Your browser does not support Web Speech Recognition. Please use Chrome.');
        return;
      }

      try {
        this.recognition = new SpeechConstructor();
        this.recognition.lang = isFa ? 'fa-IR' : 'en-US';
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        this.recognition.onstart = () => {
          this.isListening = true;
          this.render(container);
        };

        this.recognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (textarea) {
            textarea.value = (textarea.value ? textarea.value + ' ' : '') + transcript;
            textarea.dispatchEvent(new Event('input'));
          }
        };

        this.recognition.onerror = (event) => {
          console.warn('[DailyJournal] Speech error:', event.error);
          this.stopVoice();
          this.render(container);
        };

        this.recognition.onend = () => {
          this.stopVoice();
          this.render(container);
        };

        this.recognition.start();
      } catch (err) {
        console.error('[DailyJournal] Speech start error:', err);
        this.stopVoice();
      }
    });
  }

  stopVoice() {
    this.isListening = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
      this.recognition = null;
    }
  }
}
