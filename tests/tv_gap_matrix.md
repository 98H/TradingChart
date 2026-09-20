# TradingChart — TradingView Feature Gap Matrix
# status: missing | partial | implemented
# Updated each cycle.

## A. Charts & Data
- [implemented] chart_types_native — candles/bars/line/area/baseline/heikin-ashi (Vela native)
- [implemented] renko — client-side synthetic, wickless uniform bricks, grid-anchored
- [implemented] point_and_figure — 3-box reversal, box-aligned
- [implemented] kagi — reversal-threshold line
- [implemented] linebreak — classic 3-line reversal
- [implemented] range_bars — fixed-range wickless
- [implemented] hollow_candles
- [implemented] volume_candles
- [implemented] multi_symbol_compare_overlay
- [implemented] log_percent_invert_scales
- [implemented] countdown_to_bar_close
- [implemented] bar_replay
- [implemented] deep_history — 2000 bars default; daily back to 2021 (>3y), 1h ~3mo; server multi-page backfill + Vela `bars:2000` + `setMarket` depth re-apply
- [implemented] scroll_range_presets — Vela native 1D/7D/1M/3M/6M/YTD/1Y/5Y/ALL chips

## B. Drawing Tools
- [implemented] 83 drawing types exposed — full Vela catalogue in searchable DrawingToolsLibrary modal (RTL-safe, FA/EN), ★ favorites sync to floating toolbar
- [implemented] drawing right-click context menu — settings/duplicate/lock/bring-front/send-back/remove (facade: openSettings/duplicate/lock/bringToFront/sendToBack/remove)
- [implemented] magnet / lock-all / hide-all / clear-all on floating toolbar
- [implemented] undo/redo (Vela history)

## C. Panels & Modules
- [implemented] watchlist, alerts, paper trading, data window, object tree, pine editor, journal, screener, DOM, calendar, news (right rail)
- [implemented] strategy tester, prop-firm simulator (bottom)
- [implemented] compare modal (9 symbols), settings modal, screenshot/share, data export

## E. Alerts, Navigation & Scales (Cycle 4)
- [implemented] alert engine — 11 TradingView conditions (crossing, crossing_up/down, greater/less_than, enter/exit/inside/outside_channel, move_up/down_pct) with channel-low field + percent moves
- [implemented] alert channels — Sound+Popup, Webhook Relay (auto-order), combined
- [implemented] Go to Date (Alt+G) — datetime picker + quick chips (1h/1d/1w/1M/YTD), frames visible range via chart.setVisibleRange
- [implemented] price-scale right-click menu — Auto/Log/Percentage/Invert/Lock/Reset (native Vela Labels/Levels/More-settings also present)
- [implemented] drawing right-click menu; canvas right-click menu with alert/limit-orders/indicator/timeframe/compare/screenshot/goto-date/settings

## F. Command Palette (Cycle 5)
- [implemented] Command Palette (Ctrl+K) — fuzzy quick-launch: 10 symbols, 8 timeframes, 9 chart styles, 6 drawing tools, 9 panels, 4 layouts, 9 actions (55 indexed); keyboard nav (↑↓/↵/Esc), RTL/FA, footer hints, fade scroll affordance

## H. Layout Management & User Profiling — Pro (Cycle 7)
- [implemented] Layout persistence — active grid saved to localStorage and restored after reload (TradingView parity)
- [implemented] Layout rename / duplicate / export JSON / import JSON
- [implemented] Interactive sync switches (symbol/timeframe/crosshair/style) wired to Vela workspace.sync
- [implemented] User profile — editable display name (persisted), paper-equity card, account telemetry, reset-with-confirm
- [implemented] Full light/dark theme — day mode flips CSS tokens + every Vela cell's canvas theme (white chart bg, dark text) + all app chrome (topbar, both rails, bottom bar, floating toolbars, quick-trade panel)
- [implemented] Theme persists across reload (applyStoredTheme at init)

## J. FULL Trading-Setup Layouts (Cycle 9)
- [implemented] Every saved layout captures the COMPLETE workspace state via Vela getState: per-cell symbol, timeframe, price style, indicators (with input deltas), and drawings — not just the grid shape
- [implemented] One-click "Load" restores the whole trading setup: grid shape + each cell's symbol/TF/style/indicators/drawings
- [implemented] Multi-cell setup restore verified: 2x2 quad with BTC/ETH/SOL/BNB per cell round-trips correctly
- [implemented] Duplicate and Export carry the full state; Import restores it
- [implemented] Verified with real-browser: single-cell (ETH+EMA setup) and multi-cell (quad) both restore exactly

## I. Verified-Complete TradingView Parity (Cycle 8 audit)
- [implemented] Bar Replay — Play/Pause, Step, 0.5x–5.0x speed, progress counter, in-replay BUY/SELL, exit
- [implemented] Multi-symbol Compare/Overlay — 9 benchmarks, % and price modes, floating legend
- [implemented] Object Tree — list/manage all drawings (Vela panels + objectTree.js)
- [implemented] Undo/Redo (chart ops) + Command Palette (Ctrl+K) + 22 documented keyboard shortcuts
- [implemented] Indicators — 200+ indicators via Vela addNativeIndicator (Pine + native)
- [implemented] Screenshot/share, Print, Embed, Export CSV, Go to Date, price-scale menu, drawing context menu

## G. Sharing & Output (Cycle 6)
- [implemented] Screenshot/share modal — composite multi-canvas PNG snapshot with metadata strip (symbol/TF/price)
- [implemented] Download PNG
- [implemented] Print chart — clean print-window + OS print dialog
- [implemented] Embed code — responsive iframe snippet for exact symbol/timeframe
- [implemented] Copy share link (symbol+tf+snap URL)
- [implemented] Copy analysis/social post text

## Test-infra hardening (Cycle 6)
- QA harness (tests/qa_lib.cjs) now uses a unique userDataDir per launch + headless-shell binary — immune to snap ProcessSingleton lock & stale-profile collisions on resource-tight VPS.

## D. Remaining documented deltas (engine-level / out-of-scope)
- True P&F X/O glyphs (rendered as wickless box bars — visually equivalent)
- Custom tick/second intervals (Vela fixed timeframe list)
- Live broker trading (paper/prop-sim/relay present instead)
- Social layer (ideas/streams) — institutional tools shipped instead

