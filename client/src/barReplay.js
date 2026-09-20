// client/src/barReplay.js
// Historical Market Replay & Bar-by-bar Rewind Engine with Interactive Simulated Trading
// Allows traders to execute paper trades directly in historical simulated time (TradingView Parity)

import { getLanguage, toPersianDigits } from './i18n.js';

export class BarReplay {
  constructor(options = {}) {
    this.container = options.container;
    this.app = options.app || null;
    this.onBarStep = options.onBarStep || (() => {});
    this.onExit = options.onExit || (() => {});
    this.isPlaying = false;
    this.speed = 1.0;
    this.timer = null;
    this.currentIndex = 0;
    this.totalBars = 0;
    this.currentPrice = 0;
    this.replayPosition = null; // { side: 'long'|'short', qty: 0.1, entryPrice: 0, pnl: 0 }
    this.render();
  }

  startReplay(totalBars, startIndex) {
    this.totalBars = totalBars;
    this.currentIndex = startIndex || Math.max(10, Math.floor(totalBars * 0.7));
    this.isPlaying = false;
    this.replayPosition = null;
    if (this.container) this.container.classList.add('visible');
    this.updateUI();
    this.onBarStep(this.currentIndex);
  }

  stopReplay() {
    this.pause();
    this.closePosition();
    if (this.container) this.container.classList.remove('visible');
    this.onExit();
  }

  play() {
    this.isPlaying = true;
    this.updateUI();
    this.tick();
  }

  pause() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.updateUI();
  }

  step() {
    if (this.currentIndex < this.totalBars - 1) {
      this.currentIndex++;
      this.onBarStep(this.currentIndex);
      this.updateUI();
    } else {
      this.pause();
    }
  }

  tick() {
    if (!this.isPlaying) return;
    this.step();
    const delay = Math.round(1000 / this.speed);
    this.timer = setTimeout(() => this.tick(), delay);
  }

  executeReplayTrade(side) {
    if (this.currentPrice <= 0) return;
    const qty = 0.1;
    this.replayPosition = {
      side,
      qty,
      entryPrice: this.currentPrice,
      pnl: 0
    };
    this.updatePositionUI();
  }

  closePosition() {
    if (!this.replayPosition) return;
    const pnl = this.replayPosition.pnl;
    if (this.app?.tradeJournal?.addTrade) {
      this.app.tradeJournal.addTrade({
        symbol: this.app.currentSymbol || 'BTCUSDT',
        side: this.replayPosition.side.toUpperCase(),
        entryPrice: this.replayPosition.entryPrice,
        exitPrice: this.currentPrice,
        size: this.replayPosition.qty,
        pnl: Number(pnl.toFixed(2)),
        status: 'CLOSED',
        strategy: 'Bar Replay Simulation',
        time: new Date().toISOString()
      });
    }
    this.replayPosition = null;
    this.updatePositionUI();
  }

  setPrice(price) {
    this.currentPrice = price;
    if (this.replayPosition) {
      const diff = this.replayPosition.side === 'long'
        ? (this.currentPrice - this.replayPosition.entryPrice)
        : (this.replayPosition.entryPrice - this.currentPrice);
      this.replayPosition.pnl = diff * this.replayPosition.qty;
      this.updatePositionUI();
    }
  }

  render() {
    if (!this.container) return;
    const isFa = getLanguage() === 'fa';

    this.container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; flex-wrap: wrap;">
        <span style="font-weight: 800; color: var(--accent-cyan); display: flex; align-items: center; gap: 4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${isFa ? 'بازپخش کندل' : 'REPLAY'}
        </span>

        <button id="btn-replay-playpause" class="btn-primary" style="padding: 4px 10px; font-size: 11px; min-height: 26px; border-radius: 4px;" aria-label="Play or Pause Replay">
          ${this.isPlaying ? (isFa ? 'توقف' : 'Pause') : (isFa ? 'پخش' : 'Play')}
        </button>

        <button id="btn-replay-step" class="btn-secondary" style="padding: 4px 10px; font-size: 11px; min-height: 26px; border-radius: 4px;" aria-label="Step Forward">
          ${isFa ? 'گام بعدی →' : 'Step →'}
        </button>

        <select id="sel-replay-speed" style="padding: 2px 6px; font-size: 11px; min-height: 26px; background: var(--bg-card); border: 1px solid var(--border-subtle); color: #fff; border-radius: 4px;" aria-label="Replay Speed">
          <option value="0.5">0.5x</option>
          <option value="1.0" selected>1.0x</option>
          <option value="2.0">2.0x</option>
          <option value="5.0">5.0x</option>
          <option value="10.0">10.0x</option>
        </select>

        <span id="replay-progress-text" style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);" class="num-ltr">
          0 / 0
        </span>

        <div style="width: 1px; height: 16px; background: var(--border-subtle); margin: 0 2px;"></div>

        <!-- Simulated Trading Execution in Replay -->
        <div style="display: flex; align-items: center; gap: 6px;">
          <button id="btn-replay-buy" style="background: var(--accent-green); border: none; color: #fff; padding: 4px 10px; font-size: 11px; min-height: 26px; font-weight: 800; border-radius: 4px; cursor: pointer;" title="${isFa ? 'خرید شبیه‌سازی‌شده' : 'Simulated Buy'}" aria-label="Simulated Buy">
            BUY
          </button>
          <button id="btn-replay-sell" style="background: var(--accent-red); border: none; color: #fff; padding: 4px 10px; font-size: 11px; min-height: 26px; font-weight: 800; border-radius: 4px; cursor: pointer;" title="${isFa ? 'فروش شبیه‌سازی‌شده' : 'Simulated Sell'}" aria-label="Simulated Sell">
            SELL
          </button>
        </div>

        <div id="replay-pos-wrap" style="display: none; align-items: center; gap: 6px;"></div>

        <button id="btn-replay-exit" class="btn-secondary" style="padding: 4px 10px; font-size: 11px; min-height: 26px; border-radius: 4px; color: var(--accent-red); border-color: rgba(246,70,93,0.3); margin-left: auto;" title="${isFa ? 'خروج از حالت بازپخش' : 'Exit Replay'}" aria-label="Exit Replay">
          ✕ ${isFa ? 'خروج' : 'Exit'}
        </button>
      </div>
    `;

    const btnPlayPause = this.container.querySelector('#btn-replay-playpause');
    const btnStep = this.container.querySelector('#btn-replay-step');
    const selSpeed = this.container.querySelector('#sel-replay-speed');
    const btnExit = this.container.querySelector('#btn-replay-exit');
    const btnBuy = this.container.querySelector('#btn-replay-buy');
    const btnSell = this.container.querySelector('#btn-replay-sell');

    btnPlayPause.addEventListener('click', () => {
      if (this.isPlaying) this.pause();
      else this.play();
    });

    btnStep.addEventListener('click', () => {
      this.pause();
      this.step();
    });

    selSpeed.addEventListener('change', (e) => {
      this.speed = parseFloat(e.target.value) || 1.0;
    });

    btnBuy.addEventListener('click', () => {
      this.executeReplayTrade('long');
    });

    btnSell.addEventListener('click', () => {
      this.executeReplayTrade('short');
    });

    btnExit.addEventListener('click', () => {
      this.stopReplay();
    });
  }

  updatePositionUI() {
    const wrap = this.container?.querySelector('#replay-pos-wrap');
    if (!wrap) return;

    if (!this.replayPosition) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      return;
    }

    const isLong = this.replayPosition.side === 'long';
    const sideColor = isLong ? 'var(--accent-green)' : 'var(--accent-red)';
    const pnlPositive = this.replayPosition.pnl >= 0;
    const pnlColor = pnlPositive ? 'var(--accent-green)' : 'var(--accent-red)';
    const pnlSign = pnlPositive ? '+' : '';

    wrap.style.display = 'flex';
    wrap.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 6px; font-size: 10px; font-family: var(--font-mono);">
        <span style="font-weight: 800; color: ${sideColor}; text-transform: uppercase;">${this.replayPosition.side} 0.1</span>
        <span style="color: ${pnlColor}; font-weight: 700;" class="num-ltr">${pnlSign}$${this.replayPosition.pnl.toFixed(2)}</span>
        <button id="btn-replay-close-pos" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0 2px; font-weight: 800;" title="Close Position">✕</button>
      </div>
    `;

    wrap.querySelector('#btn-replay-close-pos')?.addEventListener('click', () => {
      this.closePosition();
    });
  }

  updateUI() {
    const isFa = getLanguage() === 'fa';
    const btnPlayPause = this.container?.querySelector('#btn-replay-playpause');
    const progress = this.container?.querySelector('#replay-progress-text');
    if (btnPlayPause) {
      btnPlayPause.innerText = this.isPlaying ? (isFa ? 'توقف' : 'Pause') : (isFa ? 'پخش' : 'Play');
    }
    if (progress) progress.innerText = `${this.currentIndex + 1} / ${this.totalBars}`;
  }
}
