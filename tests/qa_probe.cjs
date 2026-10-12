const { launch } = require('./qa_lib.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const vpName = process.argv[2] || 'mobile';
const lang = process.argv[3] || 'fa';
const code = require('fs').readFileSync(process.argv[4], 'utf8');
(async () => {
  const ctx = await launch(vpName);
  const { page } = ctx;
  await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__TRADING_APP__ && !!document.querySelector('canvas'), { timeout: 30000 }).catch(() => {});
  await sleep(4500);
  await page.evaluate(l => window.__TRADING_APP__.switchLanguage(l), lang);
  await sleep(1200);
  ctx.logs.length = 0;
  const fn = new Function('ctx', 'sleep', 'return (async()=>{' + code + '})()');
  try { const r = await fn(ctx, sleep); console.log(JSON.stringify(r, null, 1)); } catch (e) { console.log('ERR', e.message); }
  console.log('LOGS', JSON.stringify(ctx.logs.filter(l => l.type !== 'log' && l.type !== 'info' && l.type!=='debug').slice(0, 12)));
  await ctx.browser.close(); process.exit(0);
})();
