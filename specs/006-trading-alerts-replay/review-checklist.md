# Review checklist — specs/006-trading-alerts-replay

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

## Behaviour beyond the tests
- [ ] Quick trade widget stepper decrements down to 0.01 minimum and increments by exactly 0.05 without floating-point representation bugs (`val.toFixed(2)`).
- [ ] Quick trade executes half-spread quote (`quote(side)`) at the exact displayed price, never at mid-market zero spread.
- [ ] Resting limit order fills only when market trades through its limit price; marketable limit order fills immediately at the market quote.
- [ ] Up-front margin validation occurs before resting order is queued in `this.orders`.
- [ ] Closing a paper position or replay position creates two separate executions (open and close) and writes both into Trade Journal.
- [ ] Replay execution timestamps use historical candle time (`barTime()`), never client wall-clock time, and carry `source: 'replay'`.
- [ ] Account reset requires a danger confirmation dialog and resets balance to starting capital ($100,000) while clearing open positions and orders.
- [ ] Deleted accounts and alerts write millisecond tombstones to prevent resurrection during union merges and cloud synchronization.
- [ ] Dynamic alert form toggles `#alert-channel-low-row` for channel conditions and relabels target price for percentage moves.
- [ ] Pinned off-scale badges render `▲` for prices above scale and `▼` for prices below scale in the right price-axis column with direct `✕` delete buttons.
- [ ] Trade-Relay executes orders sequentially with a minimum 1,000 ms spacing, rejects orders exceeding $50k notional, and trips circuit breaker at 5% daily drawdown.
- [ ] Inbound webhooks authenticate by token SHA-256 hash matching `user.webhookTokenHash` and reject malformed tokens with 404.
- [ ] Webhook rotation generates a 24-byte base64url token, stores only its SHA-256 hash and 4-character hint, and invalidates previous tokens immediately.
- [ ] Bar replay cuts series back to 70% depth (clamped by `barReplayMinuteDays`), steps 1 candle at a time, and restores full original series on exit.

## Architecture boundaries
- [ ] Paper trading portfolio management, order ticket, and DOM ladder are encapsulated in `client/src/paperTrading.js`.
- [ ] Alert condition evaluation and webhook management UI are encapsulated in `client/src/alertsManager.js`.
- [ ] Canvas alert lines and pinned off-scale badges are encapsulated in `client/src/chartAlertsOverlay.js`.
- [ ] Historical bar rewind, playback loop, and simulated replay trading are encapsulated in `client/src/barReplay.js`.
- [ ] Webhook REST endpoints, rate limiting, and token rotation are encapsulated in `server/tradeRelayApi.js`.
- [ ] In-memory execution simulation and safety rails are encapsulated in `server/tradeRelay.js`.
- [ ] Cloud state quota enforcement (`priceAlerts`, `paperAccounts`) is anchored in `server/accounts.js` and `server/featuresCatalog.js`.
- [ ] Chart canvas projections interact with `@luxalgo/vela` strictly via public renderer APIs; no files in `node_modules` are modified.

## Forbidden shortcuts
- [ ] No branches on test inputs, test environments, or user-agent sniffing in production trading logic.
- [ ] No plaintext storage of webhook tokens on server filesystem or database.
- [ ] No zero-spread or synthetic fills that fabricate fill prices better than current market quotes.
- [ ] No un-throttled or perpetual background timers running while tab is hidden.
- [ ] No deletion of paper accounts or alerts without recording deletion tombstones.

## Copy and UX (only items tests cannot see)
- [ ] Persian copy follows formal respectful register, strict ZWNJ usage, and Persian numerals in FA mode (`حساب‌های معاملاتی کاغذی`, `هشدار قیمت`, `سفارش لغو شد`, `بازنشانی حساب دمو`).
- [ ] System default account name (`pap_main`) dynamically re-localizes between `'Main Paper'` and `'حساب اصلی دمو'` on language switch without corrupting storage.
- [ ] Numbers, ticker symbols, prices, quantities, and webhook tokens maintain strict LTR orientation inside RTL layouts (`num-ltr`, `<bdi>`, `dir="ltr"`).
- [ ] Quick trade widget auto-minimizes to `#qt-collapsed-trigger` pill on viewports ≤ 768px without horizontal overflow.
- [ ] Single-line non-blocking toast notifications confirm order execution, order cancellation, and alert creation.