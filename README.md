# TradingChart — Ultra-Complete Open-Source TradingView Alternative
### Powered by the LuxAlgo Open Ecosystem (Vela WebGL2, PineTS, Prop-Firm-Sim, Journal-Core, Broker-SDK, Market-Trackers)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![WebGL2 Ready](https://img.shields.io/badge/Renderer-Native%20WebGL2-cyan.svg)](https://luxalgo.com/vela)
[![Pine Script v5/v6](https://img.shields.io/badge/Scripting-Pine%20Script%20v5%2Fv6-gold.svg)](https://github.com/LuxAlgo/PineTS)
[![Zero Defect QA](https://img.shields.io/badge/QA%20Audit-Zero%20Defect%20Verified-brightgreen.svg)]()

> **TradingChart** is a full-featured, white-label, institutional-grade replacement for TradingView. It breaks proprietary charting monopolies by combining the complete open-source LuxAlgo infrastructure into a unified financial workstation. It features a native WebGL2 interactive charting canvas, full client-side Pine Script v5/v6 compilation and execution, Monte Carlo prop-firm challenge stress-testing, automated trade journaling with FIFO execution reconstruction, SEC EDGAR & US Government alternative data tracking, and a self-hosted trade execution relay with built-in safety rails.

---

## 🌟 Key Features & Architectural Matrix

| Feature Module | Underlying Technology | Capability & Value Proposition |
| :--- | :--- | :--- |
| **Interactive Charting** | `@luxalgo/vela` (WebGL2 / Canvas2D) | High-performance rendering of 50,000+ candlesticks at 60 FPS, multi-chart workspace (1x1, 2x1, 1x2, 2x2), 30+ drawing tools (Trendlines, Pitchforks, Gann Boxes, Elliott Waves, Order Blocks, Position tools). |
| **Pine Script v5/v6 IDE** | `pinets` & `@luxalgo/vela-pinets` | 1:1 syntax-compatible parser and time-series execution engine for TradingView Pine Script without cloud lock-in. Real-time compilation and on-chart plotting. |
| **Strategy Backtester** | Deterministic Event-Driven Engine | Real-time backtesting with equity curve visualization, Net Profit, Profit Factor, Win Rate, Max Drawdown %, and a full trade ledger. 1-click bootstrap into Monte Carlo simulators. |
| **Prop-Firm Challenge Sim** | `@luxalgo/prop-firm-sim-core` | 10,000-path Monte Carlo simulations against FTMO, Topstep, and custom prop rules. Computes true pass rates, risk of ruin, and optimal fractional risk sizing. |
| **Institutional Trade Journal** | `@luxalgo/journal-core` | Automated FIFO/LIFO round-trip reconstruction from raw execution streams. Features a monthly P&L calendar heatmap, Edge Score v2, and weekday performance attribution. |
| **Whale & Alternative Data** | US Gov / SEC EDGAR Data Lake | Direct tracking of Congressional stock disclosures, SEC Form 4 insider transactions, Wall Street hedge fund 13F holdings, and FINRA daily short-sale volume. |
| **Trade-Relay Webhook** | Self-Hosted Node.js / SQLite Engine | Fast webhook execution engine with internal safety rails (order size caps, daily drawdown lock, and rate limiters) to safely execute trades on connected brokers. |
| **Paper Trading Terminal** | Real-Time Mark-to-Market Engine | Built-in simulated broker with balance management, position sizing, margin leverage (1x-50x), unrealized P&L tracking, and instant trade closure. |
| **Universal Data Waterfall** | Binance Vision Direct / Fallback Pool | Live sub-second WebSocket streams and historical kline feeds across universal asset classes (Crypto, Gold/Metals, Commodities, Forex, and US Equities). |
| **Bilingual Localization** | Custom i18n + Vazirmatn Engine | English & formal Persian (فارسی استاندارد با رعایت نیم‌فاصله) support with strict BiDi numerical and code isolation. |

---

## 🏗️ Architectural Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TradingChart Client Workspace                      │
├──────────────────────────┬─────────────────────────┬────────────────────┤
│   Top Navigation Bar     │   Vela WebGL2 Canvas    │  Right Dock Rail   │
│  Symbol / TF / Layout    │  Candlesticks & Volumes │ Watchlist / Quotes │
│  Style / Replay / Tools  │  Drawings & Indicators  │ Paper / Alerts     │
├──────────────────────────┴─────────────────────────┴────────────────────┤
│           Bottom Dock: Pine Studio & Quant Analytics Suite              │
│  [Pine Editor] [Strategy Tester] [Prop-Sim] [Journal] [Market Trackers] │
└─────────────────────────────────────────────────────────────────────────┘
                                   ▲ │ REST / WebSocket
                                   │ ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 TradingChart Resilient Backend Server                   │
├──────────────────────────────┬─────────────────────────┬────────────────┤
│    Candle Waterfall Feed     │ Trade-Relay Safety Gate │ SEC Alternative│
│  Binance Vision / Synthetic  │ Risk Caps & Execution   │ Data Lake Hub  │
└──────────────────────────────┴─────────────────────────┴────────────────┘
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js >= 20.10.0 (Tested on Node.js v26.8.1)
- npm >= 10.0.0

### 1. Clone the Repository
```bash
git clone https://github.com/98H/TradingChart.git
cd TradingChart
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build Client Bundle
```bash
npm run build
```

### 4. Start Production Server
```bash
npm start
```
The application will launch on `http://localhost:8088` with active WebSocket streaming on `ws://localhost:8088/ws/live`.

---

## 🧪 Comprehensive QA Dogfooding Test Suite

TradingChart includes an automated, headless visual QA test suite powered by `puppeteer-core`. It systematically verifies:
1. Zero unhandled browser console errors.
2. Zero page runtime errors or hydration breaks.
3. Zero failed HTTP requests across all internal endpoints.
4. Clean visual layout across Desktop (1440x900) and Mobile Portrait (390x844).
5. Mathematical consistency between Pine backtesting, Prop-firm Monte Carlo simulations, and trade journal heatmaps.

To run the automated audit:
```bash
npm run test:qa
```

---

## 💻 Pine Script v5/v6 Integration

TradingChart allows traders to write, compile, and execute Pine Script directly inside their browser:

```pinescript
//@version=5
indicator("Nexus SMC Pro", overlay=true)

// Lookback & Swing Detection
lb = input.int(5, "Swing Lookback", minval=2)
pHigh = ta.pivothigh(high, lb, lb)
pLow  = ta.pivotlow(low, lb, lb)

// Structure Breaks (Body Close Invariant)
bool bosBull = ta.crossover(close, ta.valuewhen(not na(pHigh), pHigh, 0))
bool bosBear = ta.crossunder(close, ta.valuewhen(not na(pLow), pLow, 0))

plotshape(bosBull, title="BOS Bullish", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small, text="BOS")
plotshape(bosBear, title="BOS Bearish", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small, text="BOS")
```

---

## 🛡️ License & Legal Attribution

- **Application Core:** Licensed under the **Apache License, Version 2.0** (see `LICENSE`).
- **LuxAlgo Vela Engine:** Open-source WebGL2 charting library under Apache-2.0. Attribution requirements honored per Apache-2.0 §4(d).
- **PineTS Runtime:** Licensed under AGPL-3.0 by LuxAlgo. Executed client-side in the user's browser.
- **Data Trackers:** CC0-1.0 (Public Domain) US Government public filings.

---

## 👥 Contributors & Authors
- **Architecture & System Design:** Nexus (Hermes FinTech Lead Architect)
- **Engine Development:** Open-source LuxAlgo Ecosystem & FinTech Platform Engineering Team
