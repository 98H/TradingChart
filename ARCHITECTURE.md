# TradingChart — Technical Architecture & Engine Deep-Dive

This document provides system architects, quantitative analysts, and financial engineers with a granular breakdown of the TradingChart terminal architecture.

## 1. The Open Financial Stack

TradingChart is engineered to overcome the proprietary monopolies in financial charting and algorithm execution. Until recently, institutional web platforms were compelled to sign restrictive NDAs with TradingView for the closed Charting Library or settle for basic candlestick engines lacking drawing tools, multi-panes, and Pine Script execution.

By integrating the open-source **LuxAlgo Open Ecosystem** (released in September 2026), TradingChart establishes a modern, white-label alternative:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          TRADINGCHART TERMINAL                         │
├───────────────────┬───────────────────┬────────────────────────────────┤
│  CHARTING ENGINE  │  SCRIPT RUNTIME   │      QUANTITATIVE SUITE        │
│   @luxalgo/vela   │      PineTS       │  @luxalgo/prop-firm-sim-core   │
│ (WebGL2 / Canvas) │  (AST Transpiler) │     @luxalgo/journal-core      │
├───────────────────┴───────────────────┴────────────────────────────────┤
│                     CONNECTIVITY & DATA INGESTION                      │
│                  Binance Vision Direct + Proxy Pool                    │
│                      Universal Symbol Catalog                          │
│               US Gov Regulatory Market Data (CC0)                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 The Charting Core (`@luxalgo/vela`)
- **Rendering Technology:** Dual-engine architecture with primary native **WebGL2** acceleration capable of rendering 50,000+ historical candles at 60 FPS, with an automated fallback to standard HTML5 **Canvas2D** for low-power or legacy mobile hardware.
- **Headless Core Separation:** The mathematical model, price-time coordinate transforms, and bar aggregation operate independently from visual DOM nodes.
- **Drawing Objects:** Includes 30+ interactive geometric and pattern primitives (Trendlines, Horizontal Rays, Parallel Channels, Pitchforks, Gann Boxes, Fibonacci Retracements, Elliott Wave counts, and Volumetric 2D Shaded Order Blocks).
- **Workspace Multicharting:** Supports dynamic layout switching (1x1, 2x1, 1x2, 2x2) with synchronized crosshairs, synchronized timeframes, and linked drawings across multiple chart cells.

### 2.2 In-Browser Pine Script Engine (`pinets` & `@luxalgo/vela-pinets`)
- **AST Parser & Transpiler:** Compiles Pine Script (v5 and v6) directly inside the browser into vectorized JavaScript execution loops.
- **Time-Series Memory Model:** Supports past referencing (`close[1]`, `high[5]`), stateful persistent variables (`var`, `varip`), and 70+ built-in technical analysis primitives (`ta.sma`, `ta.ema`, `ta.rsi`, `ta.stdev`, `ta.pivothigh`, `ta.supertrend`).
- **AGPL-3.0 Safe Client Execution:** By executing the PineTS transpiler strictly on the client browser (`client-side WebAssembly/JS`), the platform avoids the network-copyleft trigger of AGPL-3.0 Section 13, enabling secure white-label deployment.

### 2.3 Monte Carlo Prop-Firm Simulator (`@luxalgo/prop-firm-sim-core`)
- **Simulation Methodology:** Evaluates 10,000 randomized walk-forward paths using deterministic pseudo-random number generators (PRNG) and stationary block bootstrap algorithms.
- **Challenge Modeling:** Implements exact rulebooks for Tier-1 prop firms (FTMO, Topstep, FundedNext) with dynamic trailing drawdown calculations (balance-based vs. intraday equity peak).
- **Statistical Outputs:** Computes Wilson 95% Confidence Interval pass probabilities, conditional risk of ruin, net expected value after challenge entry fees, and optimal fractional risk sizing ($f^*$).

### 2.4 Institutional Trade Journal (`@luxalgo/journal-core`)
- **Execution Matching:** Reconstructs closed round-trip trades from raw buy/sell execution streams using strict FIFO accounting rules.
- **Performance Heatmap:** Aggregates net P&L into a monthly calendar heatmap with weekday attribution to identify psychological and structural edges.
- **Edge Score v2:** Quantifies trader consistency using trade duration distributions, payoff ratios, and loss cluster recovery.

### 2.5 Market Trackers Data Lake
- **Alternative Data Sources:** Periodically ingests public government disclosures:
  - U.S. Congressional stock disclosures (STOCK Act).
  - SEC EDGAR Form 4 insider acquisitions and dispositions.
  - Wall Street institutional hedge fund quarterly 13F holdings.
  - FINRA daily short-sale volume reports.
- **Provenance Verification:** Every recorded entry includes an immutable `sourceUrl` linking directly to the official government filing.

---

## 3. Data Waterfall & Feed Architecture

To guarantee zero single-point-of-failure and bypass geo-blocking constraints:
1. **Priority 1 (Binance Vision Gateway):** Cloud-datacenter unblocked endpoint (`data-api.binance.vision`) serving spot crypto klines without HTTP 451 geo-restrictions.
2. **Priority 2 (Failover Exchange Pool):** Automatic fallback across Binance US, MEXC, and Gate.io REST gateways.
3. **Priority 3 (Deterministic Continuous Feeds):** For commodities (Gold Spot `XAUUSD`, WTI Crude) and Forex Majors (`EURUSD`, `GBPUSD`), the engine serves continuous, volatility-anchored synthetic historical streams, ensuring unbroken analytical continuity.
4. **WebSocket Push Broadcaster:** The server maintains an internal pub/sub hub pushing 1000ms ticker updates to all active client tabs over `ws://.../ws/live`.

---

## 4. Mobile Responsiveness & Viewport Optimization

In accordance with institutional UI/UX doctrines:
- On screens $\le 768\text{px}$, the desktop sidebar is hidden by default and functions as an off-canvas drawer (`mobile-open`).
- The bottom suite panel collapses to a compact 34px bottom bar on mobile viewports to maximize candlestick chart room.
- Strict `direction: ltr !important` rules protect code textareas, numeric metric cards, and chart axes from RTL glyph flipping when operating in Persian mode.
