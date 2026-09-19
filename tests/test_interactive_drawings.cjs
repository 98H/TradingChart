// tests/test_interactive_drawings.cjs
// Interactive QA Test: Drawing Tools on Canvas and Global Keyboard Shortcuts
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const DRAW_DIR = path.resolve(__dirname, '../dogfood_drawings');
if (!fs.existsSync(DRAW_DIR)) fs.mkdirSync(DRAW_DIR, { recursive: true });

async function testDrawings() {
  console.log('================================================================');
  console.log('🎨 INTERACTIVE CANVAS DRAWING & KEYBOARD SHORTCUTS TEST');
  console.log('================================================================\n');

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console', text: msg.text() });
      console.log('  [Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push({ type: 'page', text: err.message });
    console.log('  [Page Error]', err.message);
  });

  async function snap(name) {
    const p = path.join(DRAW_DIR, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`  📸 Saved: ${name}.png`);
    return p;
  }

  try {
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await snap('01_draw_init');

    // ── 1. TEST TRENDLINE DRAWING VIA FLOATING TOOLBAR ───────────────
    console.log('\n--- 1. Testing Trendline Tool Drawing ---');
    const trendlineBtn = await page.$('.fav-tool-btn[data-tool="trendline"]');
    if (trendlineBtn) {
      await trendlineBtn.click();
      await new Promise(r => setTimeout(r, 400));
      console.log('Trendline tool armed');

      // Drag on canvas
      const canvas = await page.$('#chart-area');
      const box = await canvas.boundingBox();
      const startX = box.x + box.width * 0.3;
      const startY = box.y + box.height * 0.6;
      const endX = box.x + box.width * 0.6;
      const endY = box.y + box.height * 0.4;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 10 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 600));
      await snap('02_trendline_drawn');
    }

    // ── 2. TEST HORIZONTAL LINE TOOL ─────────────────────────────────
    console.log('\n--- 2. Testing Horizontal Line Tool ---');
    const hlineBtn = await page.$('.fav-tool-btn[data-tool="hline"]');
    if (hlineBtn) {
      await hlineBtn.click();
      await new Promise(r => setTimeout(r, 400));
      console.log('Horizontal Line tool armed');

      const canvas = await page.$('#chart-area');
      const box = await canvas.boundingBox();
      await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
      await new Promise(r => setTimeout(r, 600));
      await snap('03_hline_drawn');
    }

    // ── 3. TEST RECTANGLE / ORDER BLOCK TOOL ─────────────────────────
    console.log('\n--- 3. Testing Rectangle / Order Block Tool ---');
    const boxBtn = await page.$('.fav-tool-btn[data-tool="box"]');
    if (boxBtn) {
      await boxBtn.click();
      await new Promise(r => setTimeout(r, 400));
      console.log('Rectangle / Order Block tool armed');

      const canvas = await page.$('#chart-area');
      const box = await canvas.boundingBox();
      const startX = box.x + box.width * 0.35;
      const startY = box.y + box.height * 0.45;
      const endX = box.x + box.width * 0.55;
      const endY = box.y + box.height * 0.55;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 10 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 600));
      await snap('04_rectangle_drawn');
    }

    // ── 4. TEST CLEAR ALL DRAWINGS ───────────────────────────────────
    console.log('\n--- 4. Testing Clear All Drawings Trash Bin ---');
    const trashBtn = await page.$('#fav-btn-trash');
    if (trashBtn) {
      await trashBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await snap('05_drawings_cleared');
    }

    // ── 5. TEST GLOBAL KEYBOARD SHORTCUTS ────────────────────────────
    console.log('\n--- 5. Testing Keyboard Shortcuts Engine ---');

    // 5.1 Slash (/) for Indicators Modal
    await page.keyboard.press('/');
    await new Promise(r => setTimeout(r, 600));
    const indModalOpen = await page.evaluate(() => document.querySelector('#modal-indicators')?.classList.contains('open'));
    console.log('Shortcut "/" (Indicators):', indModalOpen);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // 5.2 Question mark (?) for Shortcuts Modal
    await page.keyboard.type('?');
    await new Promise(r => setTimeout(r, 600));
    const shortcutsModalOpen = await page.evaluate(() => document.querySelector('#modal-shortcuts')?.classList.contains('open'));
    console.log('Shortcut "?" (Help):', shortcutsModalOpen);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // 5.3 Alt+A for Add Alert
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Alt');
    await new Promise(r => setTimeout(r, 600));
    const alertModalOrSide = await page.evaluate(() => {
      const modal = document.querySelector('#modal-create-alert, #modal-alerts');
      const sideActive = document.querySelector('.vela-panel-alerts');
      return { modal: modal ? modal.classList.contains('open') : false, sideActive: !!sideActive };
    });
    console.log('Shortcut Alt+A (Alerts):', alertModalOrSide);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // 5.4 Alt+C for Compare Symbol
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyC');
    await page.keyboard.up('Alt');
    await new Promise(r => setTimeout(r, 600));
    const compareOpen = await page.evaluate(() => document.querySelector('#modal-compare')?.classList.contains('open'));
    console.log('Shortcut Alt+C (Compare):', compareOpen);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // 5.5 Alt+E for Export Data
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyE');
    await page.keyboard.up('Alt');
    await new Promise(r => setTimeout(r, 600));
    const exportOpen = await page.evaluate(() => document.querySelector('#modal-data-export')?.classList.contains('open'));
    console.log('Shortcut Alt+E (Export):', exportOpen);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // 5.6 Alt+S for Screenshot Studio
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyS');
    await page.keyboard.up('Alt');
    await new Promise(r => setTimeout(r, 600));
    const snapOpen = await page.evaluate(() => document.querySelector('#modal-screenshot-preview')?.classList.contains('open'));
    console.log('Shortcut Alt+S (Screenshot):', snapOpen);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ── 6. TEST DATA WINDOW & OBJECT TREE LAYERS ─────────────────────
    console.log('\n--- 6. Testing Data Window & Object Tree ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.chartManager?.togglePanel('dataWindow', true);
    });
    await new Promise(r => setTimeout(r, 800));
    await snap('06_data_window_open');

    await page.evaluate(() => {
      window.__TRADING_APP__?.chartManager?.togglePanel('objects', true);
    });
    await new Promise(r => setTimeout(r, 800));
    await snap('07_object_tree_open');

  } catch (err) {
    console.error('Interactive drawing test failed:', err);
    errors.push({ type: 'fatal', text: err.message });
  } finally {
    console.log('\n========================================');
    console.log('DRAWINGS & SHORTCUTS TEST SUMMARY');
    console.log('Total Errors Encountered:', errors.length);
    console.log('========================================');

    fs.writeFileSync(
      path.join(DRAW_DIR, 'draw_test_results.json'),
      JSON.stringify({ errors, timestamp: new Date().toISOString() }, null, 2)
    );

    await page.close();
    await browser.disconnect();
  }
}

testDrawings().catch(e => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
