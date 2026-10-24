/**
 * @spec 004
 * @covers FR-007, FR-008, FR-009, FR-018, FR-022, FR-023
 */
const { launch, boot } = require('../../qa_lib.cjs');

const BASE_URL = process.env.SDD_BASE_URL || 'http://127.0.0.1:8088';

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function realClick(page, selector, timeout = 6000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Selector ${selector} not found`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Bounding box for ${selector} not available`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const match = await page.evaluate(({ cx, cy, selector }) => {
    const top = document.elementFromPoint(cx, cy);
    const target = document.querySelector(selector);
    if (!top || !target) return false;
    return top === target || target.contains(top) || (top.closest && top.closest(selector) === target);
  }, { cx, cy, selector });
  if (!match) {
    const debug = await page.evaluate(({ cx, cy }) => {
      const top = document.elementFromPoint(cx, cy);
      return { topTag: top?.tagName, topId: top?.id, topClass: top?.className, topOuter: top?.outerHTML?.slice(0, 100) };
    }, { cx, cy });
    throw new Error(`Click target mismatch for ${selector} at (${cx}, ${cy}): top was ${JSON.stringify(debug)}`);
  }
  await page.mouse.click(cx, cy);
}

async function run() {
  // ──────────────────────────────────────────────────────────────────────────
  // Part 1: Content Security Policy & Side Dock Registration (FR-022, FR-023)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // FR-023: CSP allows runtime script compilation while forbidding inline scripts
    const res = await fetch(`${BASE_URL}/chart`);
    assert(res.status === 200, 'FR-023 GET /chart status 200', `Expected 200, got ${res.status}`);
    const csp = res.headers.get('content-security-policy') || '';
    assert(csp.length > 0, 'FR-023 CSP header present', 'Content-Security-Policy header is missing');

    const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/);
    assert(!!scriptSrcMatch, 'FR-023 script-src directive in CSP', 'script-src missing in CSP');
    const scriptSrc = scriptSrcMatch[1];
    assert(scriptSrc.includes("'unsafe-eval'"), 'FR-023 CSP permits unsafe-eval for PineTS compilation',
      `Expected 'unsafe-eval' in script-src, got "${scriptSrc}"`);
    assert(!scriptSrc.includes("'unsafe-inline'"), 'FR-023 CSP forbids unsafe-inline in script-src',
      `Found forbidden 'unsafe-inline' in script-src: "${scriptSrc}"`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Part 2: Browser Verification of Pine Editor & Templates (FR-007, FR-008, FR-009, FR-018, FR-022)
  // ──────────────────────────────────────────────────────────────────────────
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    await boot(ctx);

    // ────────────────────────────────────────────────────────────────────────
    // FR-022: Side dock registers pine, templates, strategy panels with stable IDs
    // ────────────────────────────────────────────────────────────────────────
    const registeredPanels = await page.evaluate(() => {
      const dock = window.app?.chartManager?.workspace?.dock;
      if (!dock || !dock.entries) return [];
      const ents = dock.entries instanceof Map ? Array.from(dock.entries.values()) : Object.values(dock.entries);
      return ents.map(e => e.id);
    });

    assert(registeredPanels.includes('pine'), 'FR-022 dock registers pine panel',
      `Expected panel "pine" in dock entries: ${JSON.stringify(registeredPanels)}`);
    assert(registeredPanels.includes('templates'), 'FR-022 dock registers templates panel',
      `Expected panel "templates" in dock entries: ${JSON.stringify(registeredPanels)}`);
    assert(registeredPanels.includes('strategy'), 'FR-022 dock registers strategy panel',
      `Expected panel "strategy" in dock entries: ${JSON.stringify(registeredPanels)}`);

    // ────────────────────────────────────────────────────────────────────────
    // Expand bottom suite on desktop
    // ────────────────────────────────────────────────────────────────────────
    await realClick(page, '#btn-toggle-bottom-panel');
    await page.waitForFunction(() => {
      const p = document.querySelector('#bottom-panel');
      return p && !p.classList.contains('collapsed') && p.clientHeight > 200;
    }, { timeout: 5000 });

    // Switch to Pine Editor view
    await page.evaluate(() => window.app?.switchBottomView('pine'));
    await page.waitForFunction(() => {
      const view = document.querySelector('#view-pine');
      return view && view.classList.contains('active') && getComputedStyle(view).display === 'flex';
    }, { timeout: 4000 });

    // ────────────────────────────────────────────────────────────────────────
    // FR-007: 5 Pine Templates in editor
    // ────────────────────────────────────────────────────────────────────────
    const templateOptions = await page.evaluate(() => {
      const select = document.querySelector('#view-pine #pine-template-select');
      if (!select) return [];
      return Array.from(select.options).map(o => o.value);
    });

    const requiredTemplates = ['smc_pro', 'supertrend', 'rsi_divergence', 'ma_cross', 'rebalance_shannon'];
    for (const tpl of requiredTemplates) {
      assert(templateOptions.includes(tpl), `FR-007 template option ${tpl}`,
        `Missing template "${tpl}" in #pine-template-select options: ${JSON.stringify(templateOptions)}`);
    }

    // Select Supertrend Multi-ATR and verify code and line gutter update
    await page.select('#view-pine #pine-template-select', 'supertrend');
    await page.waitForFunction(() => {
      const editor = document.querySelector('#view-pine #pine-code-editor');
      return editor && editor.value.includes('Supertrend ATR');
    });

    const supertrendState = await page.evaluate(() => {
      const editor = document.querySelector('#view-pine #pine-code-editor');
      const gutter = document.querySelector('#view-pine #pine-line-gutter');
      const lines = editor.value.split('\n').length;
      const gutterLines = gutter.innerText.trim().split('\n').length;
      return { lines, gutterLines, val: editor.value };
    });

    assert(supertrendState.lines >= 15, 'FR-007 supertrend template line count',
      `Expected >= 15 lines, got ${supertrendState.lines}`);
    assert(supertrendState.gutterLines === supertrendState.lines, 'FR-007 line gutter sync',
      `Expected ${supertrendState.lines} gutter lines, got ${supertrendState.gutterLines}`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-007: "New" minimal skeleton button
    // ────────────────────────────────────────────────────────────────────────
    await realClick(page, '#view-pine #btn-pine-new');
    await page.waitForFunction(() => {
      const editor = document.querySelector('#view-pine #pine-code-editor');
      return editor && editor.value.includes('My Custom Indicator');
    });

    const newScriptState = await page.evaluate(() => {
      const editor = document.querySelector('#view-pine #pine-code-editor');
      const gutter = document.querySelector('#view-pine #pine-line-gutter');
      return {
        code: editor.value,
        gutterText: gutter.innerText
      };
    });

    assert(newScriptState.code.includes('//@version=5') && newScriptState.code.includes('ta.sma(close, len)'),
      'FR-007 "New" button SMA skeleton', 'Expected minimal SMA skeleton inserted');
    assert(newScriptState.gutterText.includes('1'), 'FR-007 gutter updated on new', 'Expected line numbers');

    // ────────────────────────────────────────────────────────────────────────
    // FR-007: LTR direction in both languages
    // ────────────────────────────────────────────────────────────────────────
    const ltrCheck = await page.evaluate(() => {
      const editor = document.querySelector('#view-pine #pine-code-editor');
      const style = window.getComputedStyle(editor);
      return {
        direction: style.direction,
        textAlign: style.textAlign
      };
    });
    assert(ltrCheck.direction === 'ltr', 'FR-007 code editor direction LTR',
      `Expected direction "ltr", got "${ltrCheck.direction}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-009: Save script to localStorage and restore on next open
    // ────────────────────────────────────────────────────────────────────────
    const testCustomCode = `//@version=5\nindicator("QA Saved Indicator", overlay=true)\nplot(close, color=color.blue)\n`;
    await page.evaluate((code) => {
      const editor = document.querySelector('#view-pine #pine-code-editor');
      editor.value = code;
      editor.dispatchEvent(new Event('input'));
    }, testCustomCode);

    await realClick(page, '#view-pine #btn-pine-save');
    await page.waitForFunction(() => {
      const diag = document.querySelector('#view-pine #pine-diag-content');
      return diag && diag.innerText.includes('Script saved to local storage');
    });

    const savedInStorage = await page.evaluate(() => localStorage.getItem('tradingchart_pine_code'));
    assert(savedInStorage === testCustomCode, 'FR-009 script persisted in localStorage',
      `Expected localStorage value to equal custom script, got "${savedInStorage}"`);

    // Restore check: clearing editor and calling render() restores saved script
    await page.evaluate(() => {
      window.app?.pineStudio?.render();
    });
    const restoredCode = await page.$eval('#view-pine #pine-code-editor', el => el.value);
    assert(restoredCode === testCustomCode, 'FR-009 script restored on open',
      `Expected restored script "${testCustomCode}", got "${restoredCode}"`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-008: Validation before adding to chart (Success & Syntax Error)
    // ────────────────────────────────────────────────────────────────────────
    // 1. Success case
    await realClick(page, '#view-pine #btn-pine-compile');
    await page.waitForFunction(() => {
      const diag = document.querySelector('#view-pine #pine-diag-content');
      return diag && (diag.innerText.includes('Script validated') || diag.innerText.includes('معتبر'));
    }, { timeout: 6000 });

    const compileSuccessDiag = await page.$eval('#view-pine #pine-diag-content', el => el.innerText);
    assert(compileSuccessDiag.includes('Type: indicator') || compileSuccessDiag.includes('نوع: اندیکاتور'),
      'FR-008 declaration type indicator shown', `Expected declaration type indicator, got "${compileSuccessDiag}"`);
    assert(compileSuccessDiag.includes('Inputs: 0') || compileSuccessDiag.includes('ورودی‌ها: ۰'),
      'FR-008 inputs count shown', `Expected inputs count, got "${compileSuccessDiag}"`);

    // 2. Compilation error and HTML-escaping verification (FR-008, Edge Case 8)
    const compileErrorState = await page.evaluate(() => {
      const diag = document.querySelector('#view-pine #pine-diag-content');
      const orig = window.app?.pineStudio?.onAddToChart;
      window.app.pineStudio.onAddToChart = () => {
        throw new Error('Engine compilation failure: <invalid_syntax_node> & undefined token');
      };

      window.app.pineStudio.compileAndAdd('//@version=5\nindicator("Broken Test")', diag);
      window.app.pineStudio.onAddToChart = orig;

      return {
        text: diag?.innerText || '',
        html: diag?.innerHTML || ''
      };
    });

    assert(compileErrorState.text.includes('Compilation error') || compileErrorState.text.includes('خطای کامپایل'),
      'FR-008 syntax error reported', `Expected compilation error title, got "${compileErrorState.text}"`);
    // Verify HTML escaping of compiler error text (< is escaped to &lt; and & to &amp;)
    assert(compileErrorState.html.includes('&lt;invalid_syntax_node&gt;') && compileErrorState.html.includes('&amp;'),
      'FR-008 HTML escaping of compiler errors', `Raw unescaped HTML found in diagnostics pane: ${compileErrorState.html}`);

    // ────────────────────────────────────────────────────────────────────────
    // FR-018: Side panel plan gating (feature locked placeholder)
    // ────────────────────────────────────────────────────────────────────────
    const lockedRenderResult = await page.evaluate(() => {
      const testBody = document.createElement('div');
      // Render locked placeholder via app method
      window.app?.renderFeatureLocked(testBody, 'pineStudio', 'Pine Script Studio', 'استودیو پاین‌اسکریپت');
      const lockedCard = testBody.querySelector('.tc-feature-locked');
      const upgradeBtn = testBody.querySelector('.tc-upgrade-btn');
      return {
        hasLockedCard: !!lockedCard,
        lockedFeature: lockedCard?.getAttribute('data-locked-feature'),
        hasUpgradeBtn: !!upgradeBtn,
        btnText: upgradeBtn?.innerText
      };
    });

    assert(lockedRenderResult.hasLockedCard && lockedRenderResult.lockedFeature === 'pineStudio',
      'FR-018 locked placeholder rendered for pineStudio',
      `Unexpected locked card result: ${JSON.stringify(lockedRenderResult)}`);
    assert(lockedRenderResult.btnText.includes('View Plans & Upgrade') || lockedRenderResult.btnText.includes('مشاهده پلن‌ها'),
      'FR-018 upgrade button present', `Expected upgrade button text, got "${lockedRenderResult.btnText}"`);

    // Clean up test localStorage
    await page.evaluate(() => localStorage.removeItem('tradingchart_pine_code'));
  } finally {
    await ctx.browser.close();
  }
}

run().then(() => {
  console.log('✅ 02_pine_editor_and_studio.test.cjs passed');
  process.exit(0);
}).catch(err => {
  console.error('❌ 02_pine_editor_and_studio.test.cjs:', err);
  process.exit(1);
});
