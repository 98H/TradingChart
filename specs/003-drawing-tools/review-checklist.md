# Review checklist — specs/003-drawing-tools

Written by the architect. Applied by the reviewer to the phase diff after all machine gates pass.
Each item must be checkable by reading the diff.

## Behaviour beyond the tests
- [ ] Favorite tool button click toggles active state: first click arms tool on active chart cell and adds `.active` class; second click disarms tool and removes `.active` class.
- [ ] Keyboard shortcuts `Alt+T`, `Alt+H`, `Alt+F`, `Alt+B`, `Alt+P`, `Alt+V` arm their corresponding tools directly through `chartManager.armDrawingTool`.
- [ ] Topbar `#btn-magnet` cycles snap mode `off` → `weak` → `strong` → `off` and flashes bilingual toast (`Magnet: off|weak|strong` / `مگنت: خاموش|ضعیف|قوی`).
- [ ] Symbol change in `chartManager.setSymbol` stashes active cell drawings into `localStorage['tc_drawings_by_symbol']` and restores drawings previously saved for the new symbol.
- [ ] Canvas right-click identifies the newest unlocked drawing as the target object and opens `#canvas-context-menu` with settings, duplicate, lock, z-order, and remove actions.
- [ ] Empty search state in library modal matches spec wording: `"No tools found"` / `"ابزاری یافت نشد"`.
- [ ] Floating toolbar drag handle clamps placement inside `#chart-area` bounds (`SAFE_LEFT = 52`, `SAFE_BOTTOM = 68`, top min 46, right margin 70) and persists position in `tradingchart_fav_toolbar_pos`.

## Architecture boundaries
- [ ] Drawing catalog modal logic is encapsulated in `client/src/drawingToolsLibrary.js`.
- [ ] Floating dock management is encapsulated in `client/src/floatingDrawingToolbar.js`.
- [ ] Canvas right-click context menu logic is encapsulated in `client/src/canvasContextMenu.js`.
- [ ] Drawing interactions interact with `@luxalgo/vela` strictly via public `chart.drawings` facade methods (`setTool`, `setMagnet`, `setSnapMode`, `clear`, `undo`, `redo`, `all`, `duplicate`, `remove`, `toJSON`, `fromJSON`); no mutations inside `node_modules/@luxalgo/vela`.
- [ ] Entitlement flag `drawingTools` is defined canonically in `server/featuresCatalog.js` and `server/accounts.js`.
- [ ] User favorite tools are synced via `authManager`'s `SYNC_MAP` (`drawing_favorites` → `drawingFavorites`) to `/api/user/state`.

## Forbidden shortcuts
- [ ] No branches on test inputs, user-agent sniffing, or test environment detection in production drawing code.
- [ ] No placeholder, fake, or synthetic coordinates fed into drawings; all anchor points use real price ticks and candle timestamps.
- [ ] No perpetual DOM timers faster than 1000 ms; toolbar dragging utilizes standard `mousemove` and `mouseup` document listeners cleaned up on release.
- [ ] No hardcoded third-party analytics or external network dependencies for drawing rendering.

## Copy and UX (only items tests cannot see)
- [ ] Persian copy follows formal respectful register, strict ZWNJ usage, and Persian numerals in FA mode (`ابزارهای ترسیم`, `خط روند (Alt+T)`, `بازگشت فیبوناچی`, `قفل کردن تمام ترسیم‌ها`, `واگرد ترسیم (Ctrl+Z)`).
- [ ] Floating toolbar `#floating-drawing-toolbar` is completely hidden on viewports ≤ 768 px via `display: none !important;` in `client/styles/main.css`.
- [ ] Library modal `#drawing-tools-modal` applies `dir="rtl"` in Persian mode and expands to `100vw` width and `92vh` height on mobile screens.
- [ ] Canvas context menu displays in RTL direction with proper right alignment when in Persian mode.
