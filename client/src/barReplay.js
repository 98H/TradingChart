// client/src/barReplay.js
// Historical Market Replay & Bar-by-bar Rewind Engine

export class BarReplay {
  constructor(options = {}) {
    this.container = options.container;
    this.onBarStep = options.onBarStep || (() => {});
    this.onExit = options.onExit || (() => {});
    this.isPlaying = false;
    this.speed = 1.0;
    this.timer = null;
    this.currentIndex = 0;
    this.totalBars = 0;
    this.render();
  }

  startReplay(totalBars, startIndex) {
    this.totalBars = totalBars;
    this.currentIndex = startIndex || Math.max(10, Math.floor(totalBars * 0.7));
    this.isPlaying = false;
    if (this.container) this.container.classList.add('visible');
    this.updateUI();
    this.onBarStep(this.currentIndex);
  }

  stopReplay() {
    this.pause();
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

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; font-size: 12px;">
        <span style="font-weight: 800; color: var(--accent-cyan); display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          REPLAY
        </span>

        <button id="btn-replay-playpause" class="btn-primary" style="padding: 4px 10px; font-size: 11px;">
          Play
        </button>

        <button id="btn-replay-step" class="btn-secondary" style="padding: 4px 10px; font-size: 11px;">
          Step →
        </button>

        <select id="sel-replay-speed" style="padding: 3px 6px; font-size: 11px;">
          <option value="0.5">0.5x</option>
          <option value="1.0" selected>1.0x</option>
          <option value="2.0">2.0x</option>
          <option value="5.0">5.0x</option>
          <option value="10.0">10.0x</option>
        </select>

        <span id="replay-progress-text" style="font-size: 11px; color: var(--text-dim);" class="num-ltr">
          0 / 0
        </span>

        <button id="btn-replay-exit" class="btn-secondary" style="padding: 4px 8px; font-size: 11px; color: var(--accent-red); border-color: rgba(246,70,93,0.3);">
          ✕ Exit
        </button>
      </div>
    `;

    const btnPlayPause = this.container.querySelector('#btn-replay-playpause');
    const btnStep = this.container.querySelector('#btn-replay-step');
    const selSpeed = this.container.querySelector('#sel-replay-speed');
    const btnExit = this.container.querySelector('#btn-replay-exit');

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

    btnExit.addEventListener('click', () => {
      this.stopReplay();
    });
  }

  updateUI() {
    const btnPlayPause = this.container?.querySelector('#btn-replay-playpause');
    const progress = this.container?.querySelector('#replay-progress-text');
    if (btnPlayPause) btnPlayPause.innerText = this.isPlaying ? 'Pause' : 'Play';
    if (progress) progress.innerText = `${this.currentIndex + 1} / ${this.totalBars}`;
  }
}
