/**
 * @spec 001
 * @covers FR-023
 * @converge
 */
const { launch } = require('../../qa_lib.cjs');

const BASE_URL = process.env.SDD_BASE_URL || 'http://127.0.0.1:18088';

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function run() {
  const ctx = await launch('desktop');
  const { page } = ctx;

  try {
    // Prime domain origin and inject corrupt settings JSON
    await page.goto(`${BASE_URL}/chart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('tradingchart_user_settings', '{corrupt_settings_json: invalid syntax');
    });

    // Reload with corrupt settings in storage
    await page.goto(`${BASE_URL}/chart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));

    // FR-023: Corrupt localStorage settings MUST NOT prevent app from starting; defaults MUST be used
    const check = await page.evaluate(() => {
      const app = window.__TRADING_APP__;
      return {
        hasApp: !!app,
        hasSettingsModal: !!app?.settingsModal,
        hasChartManager: !!app?.chartManager,
        theme: app?.settingsModal?.settings?.theme
      };
    });

    assert(check.hasApp, 'FR-023 corrupt settings app start', 'TradingChartApp did not instantiate with corrupt settings');
    assert(check.hasSettingsModal, 'FR-023 corrupt settings modal init', 'SettingsModal crashed during JSON.parse of corrupt tradingchart_user_settings');
    assert(check.theme === 'dark', 'FR-023 corrupt settings fallback defaults', `Expected default theme "dark", got "${check.theme}"`);

    console.log('PASS: 001 [Converge Corrupt Settings Resilience]');
  } finally {
    // Clean up storage
    try {
      await page.evaluate(() => localStorage.removeItem('tradingchart_user_settings'));
    } catch (e) {}
    await ctx.browser.close();
  }
}

run().catch(err => {
  console.error(`❌ FR-023 converge runner: ${err.message}`);
  process.exit(1);
});
