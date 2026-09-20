# TradingChart — Zero-Defect QA Final Report (Cycle Wave-3)

**Target:** `http://127.0.0.1:8088` (`tradingchart.service`)
**Method:** real-browser dogfooding — Puppeteer-core driving headless Chrome 153 via
`tests/qa_lib.cjs`; desktop **1440×900**, mobile **390×844**, tablet **768×1024**,
small-phone **320×844**, plus responsive sweep at **800 / 1024 / 1100 / 1280 / 1920**.
**Language surfaces:** English **and** Persian (RTL), including full round-trips.

---

## Final pass — frozen build, full re-run after the last code change

| Suite | Desktop | Mobile |
|---|---|---|
| Cycle A — feature sweep | 12/12 | 6/6 |
| Cycle B — deep interactions | 12/12 | 4/4 |
| Cycle C — data / persistence / resilience | 10/10 | 4/4 |
| Cycle D — surfaces / a11y / stress / input | 10/10 | 10/10 |
| Cycle E — exploratory free-roam (wave-3 final) | **13/13** | included |
| Cycle 2 — context menu + data depth | zero defects | — |
| Cycle 3 — layout manager | zero defects | — |
| Cycle 4 — alerts engine + UI | zero defects | — |
| Cycle 4b — go-to-date | zero defects | — |
| Cycle 5 — command palette (Ctrl+K) | zero defects | — |
| Cycle 7 — layout pro + profile | zero defects | — |
| Cycle DTL — drawing tools library (83 tools) | zero defects | zero defects |
| i18n final — full-surface FA/EN round-trip | **0 leaks / 0 regressions** | **0 leaks** |
| Data-window localisation round-trip | 0 leaks / 0 regressions | — |

**Total genuine defects remaining: 0.**
Every suite above was re-run on the frozen build *after* the final code change; a green
run before the last edit proves nothing, so the last run is the one that counts.

---

## Defects found and fixed in this session

### 1. Header suite clips its last buttons at 769–1100px *(layout — medium)*
At 800×900 the `.top-nav-layout-suite` (chart style / compare / layout / save / replay /
export / undo / redo / magnet / fullscreen) was squeezed by the left nav zone; its
buttons are `flex-shrink:0`, so the last two (**magnet**, **fullscreen**) painted
half-clipped and bled 10px into the right-hand zone, with the sound toggle hit-testing
on top of the fullscreen button.
**Fix:** inside the existing `769–1100px` media query the suite now hides the two
least-critical buttons (`#btn-magnet`, `#btn-fullscreen`) instead of painting them
clipped; `.top-nav-left` gets `overflow:hidden`. Fullscreen remains reachable via the
**F11** keyboard shortcut, so no functionality is lost at that width.
**Verified:** `E07_responsive_widths` (800/1024/1100/1280/1920) passes with zero
`inner-clip` defects; at 1100px+ all buttons return.

### 2. DOM ladder order-size input inner-clip *(layout — medium)*
`#dom-order-qty` (Depth-of-Market panel) reported `scrollWidth 67 > clientWidth 58` —
a 9px phantom from the number input's default UA padding/spinner reservation.
**Fix:** `padding: 0 2px; appearance: textfield` on the input plus a
`::-webkit-inner/outer-spin-button { -webkit-appearance: none }` reset in `main.css`
(the stepper buttons beside the input already provide increment/decrement).
**Verified:** `E03_roam_left_right_rails` passes; the input's text (28px) fits
comfortably inside its 58px box in both EN and FA.

---

## System resource optimisation (verified safe — no harm to peer projects)

`scripts/optimize_resources.sh` ran with its built-in pre/post health contract across
all peer services (`tradingchart, 9router, backend, frontend, telegram-bot,
hermes-gateway, hermes-serve, nexus-agent-graph, nexus-quant-os, nexus-cloudflared,
nexus-chrome-cdp, hysteria-server, tailscaled, warp-svc, fail2ban`).

Actions taken:
- npm + apt caches cleaned
- systemd journal vacuumed to 100MB
- reclaimable page cache dropped (never anonymous memory of running processes)
- system logs rotated (logrotate config healthy — the earlier `su root syslog` fix
  still holds); rotated logs older than 14 days pruned
- stale QA temp logs in /tmp pruned

**Result:**
- RAM available: 543MB → **757MB**
- All 14 reachable services `active` before **and** after (`nexus-chrome-cdp` was
  `activating` both times — its own restart cycle, unrelated).
- Every product endpoint still HTTP 200: `/`, `/api/health`,
  `/api/candles?symbol=BTCUSDT&timeframe=15&limit=5`, and the `:8095` surface.
- Disk: 1.4–1.5G free (96% used) — bounded and unchanged by QA artifacts.

---

## Git

- `c17dbc7` — wave-3 fixes (header suite clip, DOM qty input)
- `1e0c675` — final wave evidence + optimisation verification

Working tree clean; every fix is on the frozen, fully-green build.

## Evidence

- Per-test JSON + screenshots: `screenshots/qa_cycles/`
- Harness: `tests/qa_lib.cjs`; suites `tests/qa_cycle{A..E}*.cjs`, `tests/qa_i18n_final.cjs`
- Build/deploy: `scripts/build_and_restart.sh`; safe optimisation: `scripts/optimize_resources.sh`
