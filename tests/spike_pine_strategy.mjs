// Spike: can PineTS run a user strategy() and return its real closed trades?
import { PineTS, Indicator } from 'pinets';
import fs from 'fs';
const bars = JSON.parse(fs.readFileSync('/root/.hermes/cache/scratch/bars.json', 'utf8')).candles;
const src = `//@version=5
strategy("Shannon Rebalance Strategy", overlay=true, initial_capital=100000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)
length = input.int(20, "Lookback Period")
mult = input.float(2.0, "Multiplier")
basis = ta.sma(close, length)
dev = mult * ta.stdev(close, length)
upper = basis + dev
lower = basis - dev
if (close < lower)
    strategy.entry("LongRebalance", strategy.long)
if (close > upper)
    strategy.close("LongRebalance")
`;
const md = bars.map(b => ({ openTime: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume, closeTime: b.closeTime }));
const provider = { getMarketData: async () => md, getSymbolInfo: async () => ({ ticker: 'BTCUSDT', tickerid: 'BTCUSDT', type: 'crypto', currency: 'USD', timezone: 'UTC', session: '24x7', mintick: 0.01, pricescale: 100, pointvalue: 1, minmove: 1 }) };
const t0 = Date.now();
const p = new PineTS(provider, 'BTCUSDT', '60', md.length);
await p.ready();
const ctx = await p.run(Indicator.from ? new Indicator(src) : src);
const s = ctx.fullContext?.strategy ?? ctx.strategy;
console.log('ms', Date.now() - t0, 'keys', s && Object.keys(s).slice(0, 40).join(','));
console.log('closed', s?.closedtrades?.length, 'open', s?.opentrades?.length, 'net', s?.netprofit, 'wins', s?.wintrades, 'losses', s?.losstrades, 'eq', s?.equity, 'cap', s?.initial_capital);
console.log(JSON.stringify((s?.closedtrades || []).slice(0, 2)));
