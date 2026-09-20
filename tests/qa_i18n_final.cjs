// tests/qa_i18n_final.cjs — Deterministic full-surface FA leak audit.
// Boots in English, lets every dynamic panel populate, then switches to Persian
// (so all caches are warm and no new dynamic content is generated afterwards),
// and finally filters out proper nouns / instrument names / SEC filer names.
const { launch, boot } = require('./qa_lib.cjs');
const H = require('./qa_lib.cjs').INPAGE;

const PROP = /^(Institutional Scalper Pro|Nikkei Asia|Bloomberg|Reuters|MarketWatch|CoinDesk|Platts|The Block|Wall Street Journal|Financial Times|ECB Monetary Policy Statement|Bank of England|Federal Reserve|Bank of Japan|Nvidia|Tesla|Apple|Microsoft|Amazon|Alphabet|Meta|Bitcoin|Ethereum|Solana|Avalanche|Chainlink|Sui Network|NEAR Protocol|Aptos|Pepe|Cardano|Dogecoin|Ripple|Litecoin|Polkadot|XRP|US Dollar Index|WTI Crude Oil|Brent Crude|Natural Gas|Michigan Consumer Sentiment)/;
const FILER = /\((D|R)-[A-Z]{2}\)$/;
const TICKER = /^[A-Z]{2,6}(USDT|USD)?$/;
const BRAND = /LuxAlgo|Nexus |PineTS|Vela |TradingChart|OHLCV|RSI|SMA|EMA|MACD|ATR|FIFO|SEC|FOMC|CPI|NFP|GDP|FINRA|13F|Form 4|ICT|SMC|DOM|OHLC|IPO|ETF/;

const isRuntimeValue = (t) =>
  PROP.test(t) || FILER.test(t) || TICKER.test(t) || BRAND.test(t) ||
  /^[\d\s.,:%+$()×x\/–—·▲▼🔥🏛️🏦📊💼📈-]+$/.test(t);   // pure numbers/symbols

(async () => {
  const results = {};
  for (const vpName of ['desktop', 'mobile']) {
    const ctx = await launch(vpName);
    const { page } = ctx;
    await boot(ctx);
    // Warm every surface in English (dynamic content is generated deterministically)
    const views = await page.evaluate(() => Array.from(document.querySelectorAll('.panel-tab')).map(t => t.getAttribute('data-view')).filter(Boolean));
    if (vpName === 'desktop') {
      for (const v of views) {
        await page.evaluate((x) => document.querySelector(`.panel-tab[data-view="${x}"]`)?.click(), v);
        await new Promise(r => setTimeout(r, 1200));
      }
    } else {
      await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
      await new Promise(r => setTimeout(r, 700));
      const panels = await page.evaluate(() => Array.from(document.querySelectorAll('#modal-panels-menu .panel-menu-item')).map(i => i.getAttribute('data-panel')));
      for (const p of panels) {
        await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')));
        await page.evaluate(() => document.querySelector('#nav-btn-panels')?.click());
        await new Promise(r => setTimeout(r, 400));
        await page.evaluate((x) => document.querySelector(`.panel-menu-item[data-panel="${x}"]`)?.click(), p);
        await new Promise(r => setTimeout(r, 1500));
      }
      await page.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')); document.querySelector('.vela-drawer-backdrop')?.click(); });
      await page.evaluate(() => { const t = document.querySelector('.panel-tab[data-view="screener"]'); t?.click(); });
      await new Promise(r => setTimeout(r, 1500));
    }
    await page.evaluate(() => window.__TRADING_APP__.switchLanguage('fa'));
    await new Promise(r => setTimeout(r, 2500));
    const unt = await page.evaluate((fn) => eval('(' + fn + ')')(''), H.untranslated);
    const real = unt.filter(u => !isRuntimeValue(u.text));
    results[vpName] = { total: unt.length, real };
    console.log(`\n=== ${vpName}: ${unt.length} latin strings visible, ${real.length} untranslated ===`);
    real.forEach(u => console.log('   ', JSON.stringify(u)));
    await ctx.browser.close();
  }
  const totalReal = Object.values(results).reduce((a, r) => a + r.real.length, 0);
  console.log(`\nTOTAL genuine untranslated strings: ${totalReal}`);
})();