#!/usr/bin/env node
/**
 * tools/accuracy_audit.mjs
 * 
 * Stratified accuracy audit comparing Chartivia /api/candles with upstream providers
 * (Binance klines, TGJU tables, TradingView) for >= 200 symbols across all categories.
 * 
 * @spec 015
 * @covers FR-010, FR-012
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tvClient } from '../server/tradingviewClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:18088');
const REPORT_PATH = path.join(ROOT, '.sdd/out/accuracy.json');

const TGJU_SLUGS = {
  'IR:USD_FREE': 'price_dollar_rl',
  'IR:USDT_FREE': 'crypto-tether-irr',
  'IR:EUR_FREE': 'price_eur',
  'IR:AED_FREE': 'price_aed',
  'IR:COIN_EMAMI': 'sekee',
  'IR:COIN_BAHAR': 'sekeb',
  'IR:COIN_NIM': 'nim',
  'IR:COIN_ROB': 'rob',
  'IR:COIN_GERMI': 'gerami',
  'IR:GOLD_18K': 'geram18',
  'IR:GOLD_24K': 'geram24',
  'IR:GOLD_MESGHAL': 'mesghal'
};

const CANONICAL_GLOBAL_SYMBOLS = new Set([
  'OANDA:EURUSD', 'OANDA:GBPUSD', 'OANDA:USDJPY', 'OANDA:AUDUSD', 'OANDA:USDCAD',
  'OANDA:USDCHF', 'OANDA:NZDUSD', 'OANDA:EURGBP', 'OANDA:EURJPY', 'OANDA:GBPJPY',
  'OANDA:XAUUSD', 'OANDA:XAGUSD', 'TVC:PLATINUM', 'TVC:PALLADIUM',
  'TVC:USOIL', 'TVC:UKOIL', 'SP:SPX', 'NASDAQ:NDX',
  'DJ:DJI', 'TVC:VIX', 'TVC:DAX', 'TVC:UKX', 'TVC:NI225', 'TVC:DXY',
  'NASDAQ:AAPL', 'NASDAQ:NVDA', 'NASDAQ:TSLA', 'NASDAQ:MSFT', 'NASDAQ:AMZN',
  'NASDAQ:GOOGL', 'NASDAQ:META', 'AMEX:SPY', 'NASDAQ:QQQ', 'NASDAQ:TLT', 'TVC:US10Y'
]);

async function fetchJson(url, options = {}) {
  const timeoutMs = options.timeout || 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  console.log(`[Accuracy Audit] Starting provider accuracy audit against ${BASE_URL}...`);

  // 1. Fetch full catalogue (fail closed with exit 1 if unreachable)
  let catalogue = [];
  try {
    catalogue = await fetchJson(`${BASE_URL}/api/symbols?limit=3000`);
    if (!Array.isArray(catalogue) || catalogue.length === 0) {
      throw new Error(`Catalogue empty or invalid from ${BASE_URL}`);
    }
  } catch (e) {
    console.error(`[Accuracy Audit] Failed to fetch symbols from ${BASE_URL}: ${e.message}`);
    process.exit(1);
  }

  // 2. Stratified sampling (>= 200 symbols across all categories)
  const byCategory = new Map();
  for (const item of catalogue) {
    const cat = item.category || 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(item);
  }

  const sample = [];
  const targetTotal = 210; // Guarantee >= 200 symbols sampled

  // (a) Global Canonical Instruments (forex, metals, energy, indices, stocks, etf)
  for (const sym of CANONICAL_GLOBAL_SYMBOLS) {
    const found = catalogue.find(c => c.symbol === sym);
    if (found) sample.push(found);
  }

  // (b) Tehran gold & currencies
  const iranGold = byCategory.get('iran_gold') || [];
  for (const item of iranGold) {
    if (!sample.some(s => s.symbol === item.symbol)) sample.push(item);
  }
  const iranFx = byCategory.get('iran_fx') || [];
  for (const item of iranFx) {
    if (!sample.some(s => s.symbol === item.symbol)) sample.push(item);
  }

  // (c) Stratified Crypto Spot from Binance (fill up to target >= 200)
  const cryptoList = byCategory.get('crypto') || [];
  const neededCrypto = targetTotal - sample.length;
  if (cryptoList.length > 0) {
    const step = Math.max(1, Math.floor(cryptoList.length / neededCrypto));
    for (let i = 0; i < cryptoList.length && sample.length < targetTotal; i += step) {
      const item = cryptoList[i];
      if (!sample.some(s => s.symbol === item.symbol)) {
        sample.push(item);
      }
    }
    for (let i = 0; i < cryptoList.length && sample.length < targetTotal; i++) {
      const item = cryptoList[i];
      if (!sample.some(s => s.symbol === item.symbol)) {
        sample.push(item);
      }
    }
  }

  console.log(`[Accuracy Audit] Sampled ${sample.length} symbols across categories.`);

  // 3. Verification & comparison
  const mismatches = [];
  let checked = 0;
  const categoryCounts = {};

  const concurrency = 6;
  for (let i = 0; i < sample.length; i += concurrency) {
    const batch = sample.slice(i, i + concurrency);
    await Promise.all(batch.map(async (item) => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      const tf = (item.timeframes && item.timeframes.includes('60')) ? '60' : (item.timeframes?.[0] || 'D');
      const minTick = item.minTick || 0.01;

      try {
        const ourRes = await fetchJson(`${BASE_URL}/api/candles?symbol=${encodeURIComponent(item.symbol)}&timeframe=${tf}&limit=5`);
        const candles = ourRes?.candles || [];
        if (!candles.length) {
          mismatches.push({
            symbol: item.symbol,
            category: item.category,
            error: 'no_candles_returned'
          });
          return;
        }

        const ourLast = candles[candles.length - 1];
        if (!ourLast || typeof ourLast.close !== 'number' || !Number.isFinite(ourLast.close)) {
          mismatches.push({
            symbol: item.symbol,
            category: item.category,
            error: 'invalid_candle_data'
          });
          return;
        }

        // Direct provider comparison (FR-012: exact within 1 minTick, last closed bar)
        if (item.source === 'tradingview') {
          const tvRes = await tvClient.getBars(item.symbol, tf, { limit: 5 });
          const tvCandles = tvRes?.candles || [];
          if (!tvCandles.length) {
            mismatches.push({
              symbol: item.symbol,
              provider: 'tradingview',
              error: 'no_tv_candles'
            });
            return;
          }
          const ourClosed = candles.length >= 2 ? candles[candles.length - 2] : candles[candles.length - 1];
          const tvMatch = tvCandles.find(b => b.time === ourClosed.time) || (tvCandles.length >= 2 ? tvCandles[tvCandles.length - 2] : tvCandles[tvCandles.length - 1]);
          if (!tvMatch) {
            mismatches.push({
              symbol: item.symbol,
              provider: 'tradingview',
              error: 'no_matching_bar'
            });
            return;
          }
          const diff = Math.abs(ourClosed.close - tvMatch.close);
          const maxAllowed = minTick;
          if (diff > maxAllowed) {
            mismatches.push({
              symbol: item.symbol,
              provider: 'tradingview',
              ourClose: ourClosed.close,
              providerClose: tvMatch.close,
              diff,
              maxAllowed
            });
          }
        } else if (item.source === 'binance') {
          const rawPair = item.symbol.replace(/^BINANCE:/, '');
          const binanceInterval = tf === '60' ? '1h' : '1d';
          const bData = await fetchJson(`https://data-api.binance.vision/api/v3/klines?symbol=${rawPair}&interval=${binanceInterval}&limit=5`, { timeout: 5000 });
          if (!Array.isArray(bData) || bData.length === 0) {
            mismatches.push({
              symbol: item.symbol,
              provider: 'binance',
              error: 'no_binance_klines'
            });
            return;
          }
          const now = Date.now();
          const closedKlines = bData.filter(b => Number(b[6]) <= now);
          const bClosed = closedKlines.length > 0 ? closedKlines[closedKlines.length - 1] : bData[Math.max(0, bData.length - 2)];
          const bOpenTime = Number(bClosed[0]);
          const bClose = parseFloat(bClosed[4]);

          const ourMatch = candles.find(c => c.time === bOpenTime) || (candles.length >= 2 ? candles[candles.length - 2] : candles[candles.length - 1]);
          const diff = Math.abs(ourMatch.close - bClose);
          const maxAllowed = minTick;
          if (diff > maxAllowed) {
            mismatches.push({
              symbol: item.symbol,
              provider: 'binance',
              ourClose: ourMatch.close,
              providerClose: bClose,
              diff,
              maxAllowed
            });
          }
        } else if (item.source === 'tgju' && TGJU_SLUGS[item.symbol]) {
          const slug = TGJU_SLUGS[item.symbol];
          const tgjuData = await fetchJson(`https://api.tgju.org/v1/market/indicator/summary-table-data/${slug}`, { timeout: 5000 });
          const rows = tgjuData?.data || [];
          if (!Array.isArray(rows) || rows.length === 0) {
            mismatches.push({
              symbol: item.symbol,
              provider: 'tgju',
              error: 'no_tgju_rows'
            });
            return;
          }
          const firstRow = rows[0];
          const providerClose = Math.round(parseFloat(String(firstRow[3] || firstRow.close || firstRow.p || firstRow.t).replace(/,/g, '')) / 10);
          const ourLastBar = candles[candles.length - 1];
          const diff = Math.abs(ourLastBar.close - providerClose);
          const maxAllowed = minTick;
          if (diff > maxAllowed) {
            mismatches.push({
              symbol: item.symbol,
              provider: 'tgju',
              ourClose: ourLastBar.close,
              providerClose,
              diff,
              maxAllowed
            });
          }
        }

        checked++;
      } catch (err) {
        mismatches.push({
          symbol: item.symbol,
          category: item.category,
          error: err.message
        });
      }
    }));
  }

  // 4. Output JSON report
  const report = {
    timestamp: new Date().toISOString(),
    checked,
    mismatches,
    categories: categoryCounts
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`[Accuracy Audit] Done. Checked ${checked} symbols. Mismatches: ${mismatches.length}`);
  console.log(`[Accuracy Audit] Report saved to ${REPORT_PATH}`);

  if (mismatches.length > 0) {
    console.error(`❌ [Accuracy Audit] Failed with ${mismatches.length} mismatches!`);
    console.error(JSON.stringify(mismatches.slice(0, 5), null, 2));
    process.exit(1);
  }

  console.log('✅ [Accuracy Audit] All verified symbols match provider feeds within tolerance.');
  process.exit(0);
}

run().catch(err => {
  console.error(`❌ [Accuracy Audit] Unhandled error: ${err.message}`);
  process.exit(1);
});