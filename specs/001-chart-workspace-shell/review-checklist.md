# Review checklist — specs/001-chart-workspace-shell

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

## Behaviour beyond the tests
- [ ] Symbol switching executes a candle pre-flight check (`fetchCandlesFor`) and falls back to `seriesCache` on failure instead of blanking the WebGL2 canvas.
- [ ] Right-click context menu price calculation uses exact inverse projection (`R.coords.yToPrice`) respecting active log and inverted scale modes, snapped to the instrument tick.
- [ ] Synthetic chart types (Renko, Kagi, Range, PnF, Hollow) compute from real OHLCV data using canonical TA formulas with a 2,000-step guard; no mocked or placeholder bars.
- [ ] Bar-close countdown timer pauses when `document.hidden` is true to avoid background CPU churn.
- [ ] Screenshot composite captures all chart `<canvas>` layers onto an offscreen `#0b0e14` canvas in natural stacking order so drawings and volume are preserved.
- [ ] Error and empty states in symbol search, export, and timeframes match spec.md wording in both Persian and English.

## Architecture boundaries
- [ ] Shell components live strictly in `client/src/` as dedicated ES module classes coordinated via `TradingChartApp` (`main.js`).
- [ ] Plan entitlements are defined canonically in `server/featuresCatalog.js` and `server/data/accounts/plans.json`; client calls (`auth.enforce`, `auth.feature`) mirror server keys.
- [ ] Historical bar depth `histBars` is enforced server-side in `server/index.js:93-96` with `X-History-Limit` header; client cannot bypass the candle cap.
- [ ] No direct mutations or edits inside `node_modules/@luxalgo/vela`; all customization is mediated through public methods, options, or build plugins.

## Forbidden shortcuts
- [ ] No branches on test inputs, user-agent sniffing, or test environment detection in production code.
- [ ] No placeholder, fabricated, or decorative metrics shown for live markets; modelled demo markets carry visible route badges ("DEMO" / "مدل‌سازی").
- [ ] Sound feedback in `SoundEngine` relies exclusively on native Web Audio API oscillators; no external audio asset files or network audio requests.
- [ ] Platform announcement banner text is inserted strictly via `textContent`; no `innerHTML` injection of administrator copy.

## Copy and UX (only items tests cannot see)
- [ ] Persian copy follows formal respectful register (no informal imperatives like "کن"), strict ZWNJ usage, and Persian numerals in FA mode.
- [ ] Prices, timestamps, tickers, and currency codes remain LTR inside RTL layout using `num-ltr` and `<bdi dir="ltr">`.
- [ ] Language toggle updates `document.body.dir` (`rtl` vs `ltr`), sets Vazirmatn typography, and re-renders all open surfaces in place without a page reload.
- [ ] Viewports ≤ 768 px open the side dock as an off-canvas drawer with no horizontal scroll overflow at 390 px; touch targets maintain min 44 px.
