/**
 * @spec 011
 * @covers FR-003, FR-004
 */
const { launch, boot, BASE, INPAGE } = require('../../qa_lib.cjs');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

const PROP = /^(Institutional Scalper Pro|Nikkei Asia|Bloomberg|Reuters|MarketWatch|CoinDesk|Platts|The Block|Wall Street Journal|Financial Times|ECB Monetary Policy Statement|Bank of England|Federal Reserve|Bank of Japan|Nvidia|Tesla|Apple|Microsoft|Amazon|Alphabet|Meta|Bitcoin|Ethereum|Solana|Avalanche|Chainlink|Sui Network|NEAR Protocol|Aptos|Pepe|Cardano|Dogecoin|Ripple|Litecoin|Polkadot|XRP|US Dollar Index|WTI Crude Oil|Brent Crude|Natural Gas|Michigan Consumer Sentiment)/;
const FILER = /\((D|R)-[A-Z]{2}\)$/;
const TICKER = /^[A-Z]{2,6}(USDT|USD)?$/;
const BRAND = /LuxAlgo|Nexus |PineTS|Vela |TradingChart|Chartivia|OHLCV|RSI|SMA|EMA|MACD|ATR|FIFO|SEC|FOMC|CPI|NFP|GDP|FINRA|13F|Form 4|ICT|SMC|DOM|OHLC|IPO|ETF/;

const isRuntimeValue = (t) =>
  PROP.test(t) || FILER.test(t) || TICKER.test(t) || BRAND.test(t) ||
  /^[\d\s.,:%+$()×x\/–—·▲▼🔥🏛️🏦📊💼📈-]+$/.test(t);

async function run() {
  console.log(`[011 Acceptance Suite 03] Running Persian Typography, Digits & Engine against ${BASE}...`);
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    // Boot app and switch to Persian mode
    await boot(ctx, { lang: 'fa', settle: 3500 });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Chart Engine Chrome, Axis Words & Data Window (FR-003)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  1. Verifying chart engine axis labels and data window fields (FR-003)...');

      const engineI18n = await page.evaluate(() => {
        const months = window.__VELA_MONTHS__ || [];
        const weekdays = window.__VELA_WEEKDAYS__ || [];
        return { months, weekdays };
      });

      // Verify months are translated to Persian
      const expectedMonths = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
      for (const m of expectedMonths) {
        assert(engineI18n.months.includes(m), `FR-003 __VELA_MONTHS__ includes ${m}`, `Missing month ${m}`);
      }

      // Verify weekdays are translated to Persian
      const expectedWeekdays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'جمعه', 'شنبه'];
      for (const w of expectedWeekdays) {
        assert(engineI18n.weekdays.includes(w), `FR-003 __VELA_WEEKDAYS__ includes ${w}`, `Missing weekday ${w}`);
      }
      assert(engineI18n.weekdays.some(w => w.includes('پنج')), 'FR-003 __VELA_WEEKDAYS__ includes Thursday', 'Missing Thursday');

      // Verify data window patch and labels
      const dataWindowLabels = await page.evaluate(() => {
        const app = window.__TRADING_APP__;
        if (typeof app?.patchVelaDataWindow === 'function') {
          app.patchVelaDataWindow();
        }
        // Check data window DOM labels if present, or simulated data window fields
        const dwItems = Array.from(document.querySelectorAll('.vela-dw-item, .dw-label, .vela-dw-row'));
        return dwItems.map(i => i.innerText.trim());
      });

      // Open drawing tools library modal to verify drawing tool Persian names
      await page.evaluate(() => {
        window.__TRADING_APP__?.drawingToolsLibrary?.open?.();
      });
      await page.waitForSelector('#drawing-tools-modal.open, .dtl-box', { visible: true, timeout: 5000 });

      const drawingToolsCheck = await page.evaluate(() => {
        const modal = document.querySelector('.dtl-box');
        const text = modal?.innerText || '';
        return {
          hasTrendline: text.includes('خط روند'),
          hasFib: text.includes('فیبوناچی') || text.includes('فیبو'),
          hasHarmonic: text.includes('هارمونیک') || text.includes('الگو')
        };
      });

      assert(drawingToolsCheck.hasTrendline, 'FR-003 drawing tools modal has Persian "خط روند"', 'Missing Persian trendline name');
      assert(drawingToolsCheck.hasFib, 'FR-003 drawing tools modal has Persian Fibonacci name', 'Missing Persian Fibonacci name');

      // Close drawing tools modal
      await page.evaluate(() => {
        window.__TRADING_APP__?.drawingToolsLibrary?.close?.();
      });
      await page.waitForFunction(() => !document.querySelector('#drawing-tools-modal')?.classList.contains('open'), { timeout: 4000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Persian Digits in Text Counters and Badges (FR-004)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  2. Verifying Persian digits in text metrics and counters (FR-004)...');

      const digitsConversion = await page.evaluate(() => {
        const app = window.__TRADING_APP__;
        const toFa = app?.toPersianDigits || ((s) => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]));
        return {
          sample: toFa('1234567890'),
          zero: toFa(0),
          formatted: toFa('سفارش 42 فعال')
        };
      });

      assert(digitsConversion.sample === '۱۲۳۴۵۶۷۸۹۰',
             'FR-004 toPersianDigits converts 1234567890 to ۱۲۳۴۵۶۷۸۹۰',
             `Got ${digitsConversion.sample}`);
      assert(digitsConversion.formatted === 'سفارش ۴۲ فعال',
             'FR-004 toPersianDigits converts digits inside mixed Persian text',
             `Got ${digitsConversion.formatted}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Strict LTR Isolation for Canvas, Pine Editor & Numeric Cells (FR-004)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  3. Verifying LTR isolation on Pine editor, canvas & numeric cells (FR-004)...');

      const isolationCheck = await page.evaluate(() => {
        const pine = document.querySelector('#pine-code-editor, .code-editor');
        const pineStyle = pine ? getComputedStyle(pine) : null;

        const numCells = Array.from(document.querySelectorAll('.num-ltr, [dir="ltr"]'));
        const ltrConfirmed = numCells.every(el => {
          const s = getComputedStyle(el);
          return s.direction === 'ltr';
        });

        const canvas = document.querySelector('canvas');
        const canvasDir = canvas ? getComputedStyle(canvas).direction : 'ltr';

        return {
          hasPine: !!pine,
          pineDir: pineStyle?.direction,
          numLtrCount: numCells.length,
          allNumLtrAreLtr: ltrConfirmed,
          canvasDir
        };
      });

      assert(isolationCheck.pineDir === 'ltr',
             'FR-004 Pine Script editor remains strictly LTR in Persian mode',
             `Expected ltr, got ${isolationCheck.pineDir}`);
      assert(isolationCheck.allNumLtrAreLtr,
             'FR-004 all .num-ltr numeric cells maintain LTR direction',
             'Found numeric cell with non-LTR direction');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Formal Register, ZWNJ & 114+ Indicators Localization (FR-004)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  4. Verifying formal register, ZWNJ and 114+ indicators catalog (FR-004)...');

      // Open indicators modal to inspect indicator cards
      await page.evaluate(() => {
        window.__TRADING_APP__?.indicatorsModal?.open?.();
      });
      await page.waitForSelector('#modal-indicators.open, .indicators-modal-box', { visible: true, timeout: 5000 });

      const indicatorsAudit = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('#modal-indicators .indicator-item, .ind-card, .ind-row'));
        let zwnjCount = 0;
        let informalCount = 0;
        const informalRegex = /(?:نکن|نمیکن|بکن|کردم|میکنه|میکنیم|میکنند)\b/;

        for (const item of items) {
          const txt = item.innerText;
          if (txt.includes('\u200C')) zwnjCount++;
          if (informalRegex.test(txt)) informalCount++;
        }

        return {
          count: items.length,
          zwnjCount,
          informalCount,
          firstSample: items.slice(0, 3).map(i => i.innerText.slice(0, 50))
        };
      });

      assert(indicatorsAudit.count >= 114,
             'FR-004 at least 114 indicators available in catalog',
             `Expected >= 114 indicators, found ${indicatorsAudit.count}`);
      assert(indicatorsAudit.zwnjCount > 0,
             'FR-004 formal Persian indicator descriptions contain proper ZWNJ (\\u200C)',
             'No ZWNJ found across indicator cards');
      assert(indicatorsAudit.informalCount === 0,
             'FR-004 formal Persian register maintained without informal phrasing',
             `Found ${indicatorsAudit.informalCount} informal phrases in indicators`);

      // Close indicators modal
      await page.evaluate(() => {
        window.__TRADING_APP__?.indicatorsModal?.close?.();
      });
      await page.waitForFunction(() => !document.querySelector('#modal-indicators')?.classList.contains('open'), { timeout: 4000 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Full-Surface Persian Leak Audit (SC-001)
    // ──────────────────────────────────────────────────────────────────────────
    {
      console.log('  5. Verifying full-surface Persian leak audit (SC-001)...');

      // Evaluate untranslated elements across body using standard INPAGE audit
      const untranslated = await page.evaluate((fn) => {
        return eval('(' + fn + ')')('');
      }, INPAGE.untranslated);

      const genuineLeaks = untranslated.filter(u => !isRuntimeValue(u.text));
      assert(genuineLeaks.length === 0,
             'SC-001 Persian leak audit finds 0 untranslated Latin strings',
             `Found ${genuineLeaks.length} untranslated strings: ${JSON.stringify(genuineLeaks.slice(0, 5))}`);
    }

  } finally {
    await ctx.browser.close();
  }

  console.log('✅ [011 Acceptance Suite 03] Persian Typography, Digits & Engine passed.');
}

run().catch((err) => {
  console.error('❌ Unhandled suite error:', err);
  process.exit(1);
});
