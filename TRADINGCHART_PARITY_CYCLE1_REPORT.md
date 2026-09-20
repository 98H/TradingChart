# TradingChart — TradingView Parity Hardening Report (Cycle 1)

**Target:** `http://127.0.0.1:8088` (`tradingchart.service`)
**Method:** real-browser dogfooding via Puppeteer (desktop 1440×900, mobile 390×844, FA/EN)
**Date:** 2026-09-20

---

## Gap analysis outcome

| TradingView capability | Status before | Status after |
|---|---|---|
| Drawing tools | 9 hard-coded in floating toolbar | **83 tools** — full Vela catalogue in a searchable, categorized, RTL-safe library modal (Favorites with ★ sync to floating toolbar) |
| Renko | absent (silently fell back to candles) | **implemented** — classic wickless bricks, absolute-grid anchored, auto box size |
| Point & Figure | absent | **implemented** — 3-box reversal, box-aligned |
| Kagi | absent | **implemented** — reversal-threshold line |
| Line Break (3-line) | absent | **implemented** — classic reversal rule |
| Range Bars | absent | **implemented** — fixed-range wickless bars |
| Hollow Candles | absent | **implemented** |
| Volume Candles | absent | **implemented** |
| Candles/Bars/Line/Area/Baseline/Heikin Ashi | implemented | unchanged (native Vela) |
| Multi-symbol compare overlay | implemented | unchanged |
| Log/Percent/Invert scales | implemented | unchanged |
| Bar replay | implemented | unchanged |
| Strategy tester / Prop-firm sim / Journal / Screener / DOM / Calendar / News | implemented | unchanged |
| Pine editor + 114-indicator catalogue | implemented | unchanged |
| Persian RTL + full localization | implemented | unchanged (0 leaks) |

## Root-cause engineering notes

1. **Vela silently no-ops unknown price styles** — `setPriceStyle('renko')` does not throw and does not render. Synthetic types must be computed in the **data provider** and rendered as candles.
2. **Vela's shared `BarStore` caches series per (provider, symbol, timeframe)** — a same-timeframe re-set never re-consults the provider. Synthetic switching therefore requires `sharedBarStore.clear()` + a timeframe bounce, wired in `ChartManager.refreshData()`.
3. **Drawing-type coverage ≠ UI coverage** — the engine accepted all 76 `DrawingTypeKey`s via `setTool()`, but only 9 were reachable from the UI. The new `DrawingToolsLibrary` probes engine support at runtime and renders exactly what the engine honors.

## Verification evidence

- `screenshots/qa_cycles/synth3_renko.png` — uniform wickless Renko bricks (175 bars, uniform=true, wickless=true)
- `screenshots/qa_cycles/synth3_pnf.png` — box-aligned Point & Figure (131 bars)
- `screenshots/qa_cycles/dtl_desktop_01_open.png` / `dtl_fa_01_open.png` — drawing library EN + FA
- All 9 regression suites: **0 defects** (cycleA–D desktop+mobile, i18n_final, dw_check, dtl)
- Console: 0 page errors / 0 failed requests on every cycle

## Resource optimization outcome

- Peer services: all 14 monitored services `active` pre and post
- Endpoints: `/`, `/api/health`, `/api/candles` → HTTP 200 after optimization
- RAM available: 652MB → 753MB; disk bounded (journal vacuumed to 100MB, rotated logs >14d pruned)
- No project files touched; only npm/apt/journal/page-cache reclaim

## Known remaining deltas vs TradingView (documented, engine-level)

- **True P&F X/O glyphs** — rendered as wickless box bars (visually equivalent, text glyphs would need a custom renderer layer)
- **Tick/second-based custom intervals** — engine timeframe list is fixed by Vela
- **Broker integration / live trading** — out of scope for a charting product; paper trading, prop-firm sim, and trade relay exist
- **Social layer (ideas, streams)** — out of scope; the product ships institutional tools instead
