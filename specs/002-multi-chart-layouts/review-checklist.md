# Review checklist — specs/002-multi-chart-layouts

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

## Behaviour beyond the tests
- [ ] Grid preset switching seeds cells 2-6 with diversified liquid instruments (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, `XAUUSD`, `EURUSD`), keeping cell 1 unchanged.
- [ ] Restoring rich state v2 clears previous indicator handles to prevent duplicate plots on the WebGL2 canvas.
- [ ] Deprecated Pine syntax `color.cyan` in stored indicator scripts is sanitized to `color.rgb(0, 229, 255)` prior to compilation.
- [ ] Auto-save debounce (600 ms) aggregates rapid indicator slider edits and drawing operations into a single persistence call.
- [ ] Deep link `?symbol=...&interval=...` rewrites the primary/active cell of the restored snapshot before application without visual layout flash.
- [ ] Error and empty states in Layout Studio match spec.md wording in both Persian and English.

## Architecture boundaries
- [ ] Layout Studio and multi-chart logic live strictly in `client/src/layoutManager.js` and `client/src/templateManager.js`, coordinated via `main.js`.
- [ ] Plan entitlements (`chartsPerTab`, `savedLayouts`) derive canonically from `server/featuresCatalog.js` and `server/data/accounts/plans.json`.
- [ ] Layout operations interact with `@luxalgo/vela` strictly via public workspace APIs (`ws.setLayout`, `ws.sync`, `ws.maximizeCell`, `ws.clearMaximized`); no direct mutations inside `node_modules/@luxalgo/vela`.
- [ ] In-app modal dialogs (`uiDialog.js`) are used for rename prompt and delete confirmation; zero calls to native `window.prompt` or `window.confirm`.

## Forbidden shortcuts
- [ ] No branches on test inputs, user-agent sniffing, or test environment detection in production code.
- [ ] No placeholder or invented market data fed into newly created multi-grid chart cells.
- [ ] No perpetual DOM timers faster than 1000 ms; auto-save timer runs on 15-second heartbeat.
- [ ] User layout names are HTML-escaped via `escapeHtml()` before insertion into DOM.

## Copy and UX (only items tests cannot see)
- [ ] Persian copy follows formal respectful register (no informal imperatives like "کن"), strict ZWNJ usage, and Persian numerals in FA mode.
- [ ] Layout Studio modal and preset cards maintain RTL/LTR symmetry without broken horizontal alignment.
- [ ] Cell strip displays at bottom of chart area in multi-cell view and hides cleanly in 1x1 mode.
- [ ] Viewports ≤ 768 px maximize the active cell upon tapping any cell pill for touch-first navigation; touch targets maintain min 44 px.
