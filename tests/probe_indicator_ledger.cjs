// tests/probe_indicator_ledger.cjs — learn the live Vela indicator-count API (deep)
const { boot, launch, BASE, EVID } = require('./qa_lib.cjs');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const CHROME = '/root/.cache/puppeteer/chrome-headless-shell/linux-153.0.8010.36/chrome-headless-shell-linux64/chrome-headless-shell';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  const info = await page.evaluate(() => {
    const ws = window.__TRADING_APP__?.chartManager?.workspace;
    if (!ws) return { err: 'no workspace' };
    const out = {};
    try {
      const st = typeof ws.getState === 'function' ? ws.getState() : null;
      out.chartsType = Array.isArray(st?.charts) ? 'array' : typeof st?.charts;
      const charts = st?.charts;
      if (Array.isArray(charts) && charts[0]) out.chart0Keys = Object.keys(charts[0]);
      if (charts && !Array.isArray(charts)) out.chartsObjKeys = Object.keys(charts);
      if (Array.isArray(charts) && charts[0]) {
        out.chart0 = JSON.parse(JSON.stringify(charts[0], (k, v) => (k === 'drawings' ? undefined : v)));
      }
    } catch (e) { out.stateErr = e.message; }
    // probe live add count API on active chart
    try {
      const ch = ws.active?.chart;
      out.chartProto = Object.getOwnPropertyNames(Object.getPrototypeOf(ch || {})).slice(0, 40);
    } catch (e) { out.protoErr = e.message; }
    return out;
  });
  console.log(JSON.stringify(info, null, 1).slice(0, 3000));
  fs.writeFileSync(`${EVID || '/tmp'}/probe_ledger.json`, JSON.stringify(info, null, 1));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('PROBE_FAIL', e.message); process.exit(1); });
