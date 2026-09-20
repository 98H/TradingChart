// tests/deep_functionality_inspector.cjs
const puppeteer = require('puppeteer-core');

async function testDeep() {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const logs = [];
  page.on('console', m => logs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.toString() }));

  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const results = {};

  // 1. Test Canvas Right Click Context Menu
  console.log('--- Checking Context Menu ---');
  results.contextMenu = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas' };
    const rect = canvas.getBoundingClientRect();
    const evt = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 300,
      clientY: rect.top + 200
    });
    canvas.dispatchEvent(evt);
    const menu = document.querySelector('.canvas-context-menu, #canvas-context-menu, .context-menu');
    return {
      menuFound: !!menu,
      display: menu ? window.getComputedStyle(menu).display : null,
      items: menu ? Array.from(menu.querySelectorAll('.context-menu-item, li, button')).map(i => i.innerText.trim()) : []
    };
  });

  // 2. Test Compare Modal Functionality
  console.log('--- Checking Compare Modal ---');
  results.compareModal = await page.evaluate(async () => {
    const app = window.__TRADING_APP__;
    app.compareModal?.open();
    const modal = document.querySelector('#compareModal, .compare-modal');
    const input = modal?.querySelector('input');
    return {
      modalFound: !!modal,
      display: modal ? window.getComputedStyle(modal).display : null,
      hasInput: !!input,
      hasBenchmarks: !!modal?.querySelector('.benchmarks-grid, .benchmark-btn, .compare-item')
    };
  });

  // 3. Test Trade Journal Modal Functionality
  console.log('--- Checking Trade Journal Modal ---');
  results.journalModal = await page.evaluate(() => {
    const app = window.__TRADING_APP__;
    app.tradeJournalModal?.open();
    const modal = document.querySelector('#tradeJournalModal, .trade-journal-modal');
    const symInput = modal?.querySelector('#journal-symbol, [name="symbol"]');
    const entryInput = modal?.querySelector('#journal-entry, [name="entryPrice"]');
    const submitBtn = modal?.querySelector('#btn-journal-submit, button[type="submit"]');
    return {
      modalFound: !!modal,
      display: modal ? window.getComputedStyle(modal).display : null,
      hasSymInput: !!symInput,
      hasEntryInput: !!entryInput,
      hasSubmitBtn: !!submitBtn
    };
  });

  // 4. Test Paper Trading Execution & State
  console.log('--- Checking Paper Trading Engine ---');
  results.paperTrading = await page.evaluate(() => {
    const app = window.__TRADING_APP__;
    const pt = app.paperTrading;
    if (!pt) return { error: 'No paper trading instance' };
    const initialBalance = pt.balance;
    // Open Long position
    pt.openPosition('long', 0.5, 10);
    const posCount = pt.positions?.length || 0;
    const lastPos = posCount > 0 ? pt.positions[posCount - 1] : null;
    // Close Position
    if (lastPos) {
      pt.closePosition(lastPos.id);
    }
    const historyCount = pt.history?.length || 0;
    return {
      initialBalance,
      posCountAfterOpen: posCount,
      historyCountAfterClose: historyCount
    };
  });

  // 5. Test Scale Controls (Auto, Invert, Log, Countdown)
  console.log('--- Checking Scale Controls ---');
  results.scaleControls = await page.evaluate(() => {
    const sc = document.querySelector('.scale-controls-widget, #scale-controls');
    return {
      widgetFound: !!sc,
      countdownText: document.querySelector('#scale-countdown-timer')?.innerText,
      autoActive: document.querySelector('#btn-scale-auto')?.classList.contains('active'),
      logActive: document.querySelector('#btn-scale-log')?.classList.contains('active')
    };
  });

  // 6. Test Watchlist Add / Remove / Select
  console.log('--- Checking Watchlist Operations ---');
  results.watchlist = await page.evaluate(() => {
    const app = window.__TRADING_APP__;
    const wl = app.watchlist;
    if (!wl) return { error: 'No watchlist instance' };
    const initialSymbols = [...(wl.symbols || [])];
    wl.addSymbol('ADAUSDT');
    const hasADA = wl.symbols?.includes('ADAUSDT');
    wl.removeSymbol('ADAUSDT');
    const removedADA = !wl.symbols?.includes('ADAUSDT');
    return {
      initialCount: initialSymbols.length,
      addSuccess: hasADA,
      removeSuccess: removedADA
    };
  });

  console.log('RESULTS:', JSON.stringify(results, null, 2));

  const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror');
  console.log('Errors caught during deep check:', errors);

  await browser.close();
}

testDeep();
