const puppeteer = require('puppeteer-core');

async function explore() {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => consoleLogs.push({ type: 'pageerror', text: err.toString() }));

  await page.goto('http://127.0.0.1:8088', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  const domInfo = await page.evaluate(() => {
    const queryAll = (sel) => Array.from(document.querySelectorAll(sel)).map(el => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      text: el.innerText ? el.innerText.trim().slice(0, 50) : '',
      ariaLabel: el.getAttribute('aria-label') || ''
    }));

    return {
      velaMountChildren: Array.from(document.querySelector('#vela-workspace-mount')?.children || []).map(c => ({
        tag: c.tagName,
        id: c.id,
        className: c.className
      })),
      topbarButtons: queryAll('header button, .vela-topbar button, [class*="vela"] button'),
      railButtons: queryAll('#desktop-side-rail button'),
      bottomTabs: queryAll('.panel-tab'),
      quickTrade: {
        visible: !!document.querySelector('#chart-quick-trade'),
        buyBtn: !!document.querySelector('#quick-trade-buy-btn'),
        sellBtn: !!document.querySelector('#quick-trade-sell-btn'),
        spread: document.querySelector('#quick-trade-spread')?.innerText,
        buyPrice: document.querySelector('#quick-sell-price')?.innerText,
        sellPrice: document.querySelector('#quick-buy-price')?.innerText
      },
      drawingTools: queryAll('[class*="drawing"], [class*="tool"], [data-tool]'),
      modals: queryAll('.modal-overlay')
    };
  });

  console.log('--- DOM INFO ---');
  console.log('Vela mount children:', JSON.stringify(domInfo.velaMountChildren, null, 2));
  console.log('Quick trade info:', domInfo.quickTrade);
  console.log('Modal count:', domInfo.modals.length);
  console.log('Rail buttons:', domInfo.railButtons.map(b => b.className + ' [' + b.ariaLabel + ' / ' + b.id + ']').slice(0, 15));
  console.log('Topbar buttons count:', domInfo.topbarButtons.length);
  console.log('Sample topbar buttons:', domInfo.topbarButtons.slice(0, 10));
  console.log('Drawing tools count:', domInfo.drawingTools.length);

  const errors = consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror');
  console.log('Errors count:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:', errors);
  }

  await browser.close();
}

explore();
