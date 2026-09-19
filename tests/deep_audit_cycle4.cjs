// tests/deep_audit_cycle4.cjs
// Cycle 4: Deep audit of Alerts, Trade Journal Logging Modal, Indicator Settings Modal,
// Template Manager, Timeframe Builder, and Canvas Context Menu Action Handlers.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CYCLE4_DIR = path.resolve(__dirname, '../dogfood_cycle4');
if (!fs.existsSync(CYCLE4_DIR)) fs.mkdirSync(CYCLE4_DIR, { recursive: true });

async function runCycle4() {
  console.log('================================================================');
  console.log('🔍 CYCLE 4: SECONDARY SURFACES, MODALS, & CANVAS INTERACTIONS');
  console.log('================================================================\n');

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const issues = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
      console.log('  [Console Error]', msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.log('  [Page Error]', err.message);
  });

  async function snap(name) {
    const p = path.join(CYCLE4_DIR, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`  📸 Saved: ${name}.png`);
    return p;
  }

  try {
    await page.goto('http://127.0.0.1:8088', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await snap('01_cycle4_init');

    // ── 1. TEST INDICATOR SETTINGS MODAL ─────────────────────────────
    console.log('\n--- 1. Testing Indicator Settings Modal ---');
    const indSettingsResult = await page.evaluate(() => {
      // Simulate clicking indicator settings cog
      if (window.__TRADING_APP__?.indicatorSettingsModal) {
        window.__TRADING_APP__.indicatorSettingsModal.open({
          id: 'ind_supertrend',
          name: 'Supertrend Multi-ATR',
          inputs: [
            { id: 'length', name: 'ATR Length', type: 'number', value: 10, min: 1, max: 100 },
            { id: 'factor', name: 'ATR Multiplier', type: 'number', value: 3.0, min: 0.5, max: 10, step: 0.1 },
            { id: 'source', name: 'Source', type: 'select', value: 'close', options: ['open', 'high', 'low', 'close', 'hl2', 'hlc3'] }
          ]
        });
        return { success: true };
      }
      return { success: false };
    });
    console.log('Indicator settings modal open:', indSettingsResult);
    await new Promise(r => setTimeout(r, 600));
    await snap('02_indicator_settings_modal');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ── 2. TEST LOG NEW TRADE MODAL (TRADE JOURNAL MODAL) ────────────
    console.log('\n--- 2. Testing Trade Journal Log Modal ---');
    const journalModalResult = await page.evaluate(() => {
      if (window.__TRADING_APP__?.tradeJournalModal) {
        window.__TRADING_APP__.tradeJournalModal.open();
        return { success: true };
      }
      return { success: false };
    });
    console.log('Trade journal log modal open:', journalModalResult);
    await new Promise(r => setTimeout(r, 600));
    await snap('03_trade_journal_modal');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ── 3. TEST INDICATOR TEMPLATE MANAGER DRAWER ────────────────────
    console.log('\n--- 3. Testing Indicator Templates Panel ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.chartManager?.togglePanel('templates', true);
    });
    await new Promise(r => setTimeout(r, 800));
    await snap('04_templates_panel');

    const templateItems = await page.evaluate(() => {
      const items = document.querySelectorAll('.template-card, .template-item, .preset-template-btn');
      return Array.from(items).map(i => i.innerText.trim().replace(/\n+/g, ' '));
    });
    console.log('Indicator templates available:', templateItems);

    // ── 4. TEST CUSTOM TIMEFRAME BUILDER ─────────────────────────────
    console.log('\n--- 4. Testing Custom Timeframe Builder ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.timeframeManager?.openCustomBuilder?.();
    });
    await new Promise(r => setTimeout(r, 600));
    await snap('05_custom_timeframe_modal');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ── 5. TEST CONTEXT MENU ACTIONS (ADD ALERT AT PRICE) ────────────
    console.log('\n--- 5. Testing Context Menu Add Alert Action ---');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true,
          clientX: r.left + r.width * 0.5,
          clientY: r.top + r.height * 0.3
        }));
      }
    });
    await new Promise(r => setTimeout(r, 500));
    await snap('06_context_menu_for_alert');

    // Click "Add Alert" item from context menu
    const alertItemClicked = await page.evaluate(() => {
      const menu = document.querySelector('.canvas-context-menu');
      if (!menu) return { found: false };
      const items = Array.from(menu.querySelectorAll('.context-menu-item'));
      const alertItem = items.find(i => i.innerText.includes('Add Alert') || i.innerText.includes('هشدار'));
      if (alertItem) {
        alertItem.click();
        return { found: true, text: alertItem.innerText.trim().replace(/\n+/g, ' ') };
      }
      return { found: false };
    });
    console.log('Context menu Add Alert clicked:', alertItemClicked);
    await new Promise(r => setTimeout(r, 600));
    await snap('07_after_context_alert_click');

    // ── 6. TEST ALERTS MANAGER PANEL & CREATED ALERTS ────────────────
    console.log('\n--- 6. Testing Alerts Manager Panel ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.chartManager?.togglePanel('alerts', true);
    });
    await new Promise(r => setTimeout(r, 800));
    await snap('08_alerts_manager_panel');

    const alertsList = await page.evaluate(() => {
      const rows = document.querySelectorAll('.alert-item, .alert-row');
      return Array.from(rows).map(r => r.innerText.trim().replace(/\n+/g, ' '));
    });
    console.log('Active alerts listed in panel:', alertsList);

    // ── 7. TEST SOUND ENGINE AUDIO FEEDBACK TRIGGERS ─────────────────
    console.log('\n--- 7. Testing Sound Engine Triggers ---');
    const soundResult = await page.evaluate(() => {
      const s = window.__TRADING_APP__?.soundEngine;
      if (!s) return { hasSound: false };
      try {
        s.playOrder();
        s.playAlert();
        s.playClick();
        return { hasSound: true, enabled: s.enabled };
      } catch (e) {
        return { hasSound: true, error: e.message };
      }
    });
    console.log('Sound Engine test result:', soundResult);

    // ── 8. TEST USER PROFILE MODAL WITH STATS & METRICS ──────────────
    console.log('\n--- 8. Testing User Profile Modal Content ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.userProfileModal?.open?.();
    });
    await new Promise(r => setTimeout(r, 600));
    await snap('09_user_profile_modal_open');

    const profileData = await page.evaluate(() => {
      const m = document.querySelector('#modal-user-profile');
      if (!m) return null;
      return {
        title: m.querySelector('h3, .modal-title')?.innerText.trim(),
        text: m.innerText.replace(/\n+/g, ' ').slice(0, 180)
      };
    });
    console.log('User Profile Data:', profileData);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // ── 9. TEST DATA EXPORT DOWNLOAD FILE CREATION ───────────────────
    console.log('\n--- 9. Testing Data Export Generation ---');
    await page.evaluate(() => {
      window.__TRADING_APP__?.dataExportModal?.open?.();
    });
    await new Promise(r => setTimeout(r, 600));
    await snap('10_data_export_modal_open');

    const exportReady = await page.evaluate(() => {
      const modal = document.querySelector('#modal-data-export');
      const csvBtn = document.querySelector('#btn-download-csv, #btn-export-csv');
      return {
        isOpen: modal ? modal.classList.contains('open') : false,
        hasCsvBtn: !!csvBtn,
        csvBtnText: csvBtn ? csvBtn.innerText.trim() : null
      };
    });
    console.log('Export Modal Ready:', exportReady);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

  } catch (err) {
    console.error('Cycle 4 error:', err);
    issues.push(`Cycle 4 Error: ${err.message}`);
  } finally {
    console.log('\n========================================');
    console.log('CYCLE 4 AUDIT SUMMARY');
    console.log('Issues found:', issues.length);
    console.log('Console errors:', consoleErrors.length);
    console.log('Page errors:', pageErrors.length);
    console.log('========================================');

    fs.writeFileSync(
      path.join(CYCLE4_DIR, 'cycle4_results.json'),
      JSON.stringify({ issues, consoleErrors, pageErrors, timestamp: new Date().toISOString() }, null, 2)
    );

    await page.close();
    await browser.disconnect();
  }
}

runCycle4().catch(e => {
  console.error('Cycle 4 failed:', e);
  process.exit(1);
});
