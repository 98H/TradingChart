const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/usr/bin/chromium-browser');
const BASE = 'http://127.0.0.1:8088';

const settle = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const headlessBase = fs.existsSync('/root/snap/chromium/common') ? '/root/snap/chromium/common/chromium-headless' : '/tmp';
  fs.mkdirSync(headlessBase, { recursive: true });
  const profileDir = path.join(headlessBase, `qa_profile_${process.pid}_${Math.random().toString(36).slice(2, 7)}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('--- Step 1: Initial Load ---');
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
    await settle(3000);

    console.log('--- Step 2: Configure Layout "Alpha Strategy" with Custom Indicators and Inputs ---');
    const step2 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const cm = app.chartManager;
      const lm = app.layoutManager;

      lm.setLayout('1', 'Alpha Strategy');
      await new Promise(r => setTimeout(r, 500));
      cm.setSymbol('SOLUSDT');
      cm.setTimeframe('15');

      // Clear existing handles first
      const orch = cm.workspace.active.chart.orchestrator;
      const handles = Array.from(orch.handles.values ? orch.handles.values() : Object.values(orch.handles));
      for (const h of handles) {
        orch.removeIndicator(h.id);
      }

      // Add RSI with custom input length = 28
      const rsiHandle = cm.workspace.active.chart.addNativeIndicator('rsi');
      await new Promise(r => setTimeout(r, 400));
      orch.applyInputs(rsiHandle.id, { length: 28 });

      // Add Pine Indicator with custom inputs
      const pineCode = `//@version=5
indicator("My Custom Pine", overlay=true)
length = input.int(35, "Length")
mult = input.float(2.5, "Multiplier")
plot(ta.sma(close, length), "SMA", color=color.blue)
`;
      const pineHandle = cm.workspace.active.chart.addIndicator(pineCode, {
        language: 'pine',
        title: 'My Custom Pine',
        inputs: { length: 42, mult: 3.5 }
      });
      await new Promise(r => setTimeout(r, 600));

      // Save via quickSaveLayout
      lm.activeLayoutName = 'Alpha Strategy';
      lm.quickSaveLayout();

      const inds = cm.getIndicators();
      return {
        topbarText: document.querySelector('#active-layout-name')?.innerText.trim(),
        activeLayoutName: lm.activeLayoutName,
        inds: inds.map(i => ({ title: i.title, nativeType: i.nativeType, inputs: i.inputs }))
      };
    });
    console.log('Step 2 result:', JSON.stringify(step2, null, 2));

    console.log('--- Step 3: Switch to "Beta Scalp" (layout 2h) ---');
    const step3 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const cm = app.chartManager;
      const lm = app.layoutManager;

      lm.setLayout('2h', 'Beta Scalp');
      await new Promise(r => setTimeout(r, 1200));

      const ws = cm.workspace;
      const cells = Array.from(ws.cellsById.values());
      cells[0].setSymbol('universal:BTCUSDT');
      cells[0].setTimeframe('5');
      cells[1].setSymbol('universal:ETHUSDT');
      cells[1].setTimeframe('15');

      lm.activeLayoutName = 'Beta Scalp';
      lm.quickSaveLayout();

      return {
        topbarText: document.querySelector('#active-layout-name')?.innerText.trim(),
        activeLayoutName: lm.activeLayoutName,
        cellCount: cells.length
      };
    });
    console.log('Step 3 result:', JSON.stringify(step3, null, 2));

    console.log('--- Step 4: Open Layout Studio and Load back "Alpha Strategy" ---');
    const step4 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const lm = app.layoutManager;
      const cm = app.chartManager;

      // Find saved layout "Alpha Strategy"
      const saved = lm.savedLayouts.find(l => l.name === 'Alpha Strategy' || l.nameFa === 'Alpha Strategy');
      if (!saved) {
        return { error: 'Alpha Strategy not found in savedLayouts! List: ' + lm.savedLayouts.map(l => l.name).join(', ') };
      }

      lm.setLayout(saved.layoutId, saved.name, { state: saved.state, stateName: saved.name });
      // Wait for restore
      await new Promise(r => setTimeout(r, 1500));

      const inds = cm.getIndicators();
      return {
        topbarText: document.querySelector('#active-layout-name')?.innerText.trim(),
        activeLayoutName: lm.activeLayoutName,
        cellSymbol: cm.workspace?.active?.symbol,
        inds: inds.map(i => ({ title: i.title, nativeType: i.nativeType, inputs: i.inputs }))
      };
    });
    console.log('Step 4 result:', JSON.stringify(step4, null, 2));

    console.log('--- Step 5: Reload Page to Test Session Restart ---');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 20000 }).catch(() => {});
    await settle(3000);

    const step5 = await page.evaluate(async () => {
      const app = window.__TRADING_APP__;
      const lm = app.layoutManager;
      const cm = app.chartManager;

      const inds = cm.getIndicators();
      return {
        topbarText: document.querySelector('#active-layout-name')?.innerText.trim(),
        activeLayoutName: lm.activeLayoutName,
        activeLayoutId: lm.activeLayoutId,
        cellSymbol: cm.workspace?.active?.symbol,
        inds: inds.map(i => ({ title: i.title, nativeType: i.nativeType, inputs: i.inputs }))
      };
    });
    console.log('Step 5 result (After Reload):', JSON.stringify(step5, null, 2));

  } finally {
    await browser.close();
  }
}

run().catch(console.error);
