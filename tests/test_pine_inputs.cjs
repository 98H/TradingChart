const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/usr/bin/chromium-browser');
const BASE = 'http://127.0.0.1:8088';

async function test() {
  const headlessBase = fs.existsSync('/root/snap/chromium/common') ? '/root/snap/chromium/common/chromium-headless' : '/tmp';
  fs.mkdirSync(headlessBase, { recursive: true });
  const profileDir = path.join(headlessBase, `qa_profile_${process.pid}_${Math.random().toString(36).slice(2, 7)}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2500));

  const res = await page.evaluate(async () => {
    const chart = window.__TRADING_APP__.chartManager.workspace.active.chart;
    const orch = chart.orchestrator;
    const pineCode = `//@version=5
indicator("Test Pine", overlay=true)
len = input.int(10, "Length")
plot(ta.sma(close, len))
`;
    // Pass inputs directly in options
    const handle = chart.addIndicator(pineCode, {
      language: 'pine',
      title: 'Test Pine',
      inputs: { len: 99 }
    });
    const nativeHandle = chart.addNativeIndicator('rsi', {
      inputs: { length: 44 }
    });
    const inputsImmediately = orch.inputValuesOf(handle.id);
    const nativeInputsImmediately = orch.inputValuesOf(nativeHandle.id);
    await new Promise(r => setTimeout(r, 1000));
    const inputsAfterCompile = orch.inputValuesOf(handle.id);
    const nativeInputsAfterCompile = orch.inputValuesOf(nativeHandle.id);
    return { inputsImmediately, inputsAfterCompile, nativeInputsImmediately, nativeInputsAfterCompile };
  });

  console.log('Result passing inputs in options:', JSON.stringify(res, null, 2));
  await browser.close();
}

test().catch(console.error);
