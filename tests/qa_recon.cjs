// tests/qa_recon.cjs — Feature surface reconnaissance
const puppeteer = require('puppeteer-core');
const CHROME = '/root/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome';
const URL = 'http://127.0.0.1:8088';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const logs = [];
  page.on('console', m => logs.push({ t: m.type(), text: m.text() }));
  page.on('pageerror', e => logs.push({ t: 'pageerror', text: e.toString() }));
  page.on('requestfailed', r => logs.push({ t: 'reqfail', text: r.url() + ' ' + (r.failure()||{}).errorText }));

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));

  const out = await page.evaluate(() => {
    const vis = el => {
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const label = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || '').trim().replace(/\s+/g,' ').slice(0, 60);
    const btn = sel => Array.from(document.querySelectorAll(sel)).map(el => ({
      id: el.id || null, cls: (el.className||'').toString().slice(0,60), label: label(el), visible: vis(el)
    }));
    const app = window.__TRADING_APP__ || {};
    return {
      appKeys: Object.keys(app),
      appProto: app.constructor ? Object.getOwnPropertyNames(Object.getPrototypeOf(app)) : [],
      headerButtons: btn('#top-app-header button'),
      sideRail: btn('#desktop-side-rail button'),
      panelTabs: btn('.panel-tab, [class*="panel-tab"]'),
      modalIds: Array.from(document.querySelectorAll('[id*="modal"],[id*="Modal"]')).map(e => e.id).slice(0,80),
      canvases: Array.from(document.querySelectorAll('canvas')).map(c => ({id:c.id, cls:(c.className||'').toString().slice(0,40), w:c.width, h:c.height, visible: vis(c)})),
      bodyChildren: Array.from(document.body.children).map(c => c.id || c.tagName + '.' + (c.className||'').toString().slice(0,40)),
      rootVars: Object.keys(getComputedStyle(document.documentElement)).filter(k=>false).length,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir || getComputedStyle(document.body).direction,
      title: document.title
    };
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('=== CONSOLE ISSUES ===');
  const issues = logs.filter(l => ['error','pageerror','reqfail','warning'].includes(l.t));
  console.log(JSON.stringify(issues.slice(0, 60), null, 1));
  console.log('total logs:', logs.length, 'issues:', issues.length);
  await browser.close();
})();