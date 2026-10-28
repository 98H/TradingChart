# Data model — 015

## CatalogEntry (`/api/symbols`, `/api/symbol-info`)
| Field | Type | Notes |
|---|---|---|
| symbol | string | canonical id `EXCHANGE:SYMBOL` / `BINANCE:PAIR` / `IR:NAME` / `TSE:TICKER` |
| name, nameFa | string | nameFa curated or = name |
| exchange | string | e.g. OANDA, NASDAQ, Binance, TGJU |
| type | string | forex, stock, index, commodity, crypto, fund, bond, gold, coin, currency |
| category | string | crypto, forex, metals, energy, indices, stocks, etf, bonds, iran_gold, iran_fx, iran_tse |
| currency | string | USD, USDT, TMN … |
| source | `binance`\|`tradingview`\|`tgju`\|`brsapi`\|`tsetmc_proxy` | |
| dataStatus | `live`\|`delayed`\|`eod` | |
| delaySec | number | 0 when live |
| timeframes | string[] | allowed canonical ids (TGJU: D, W, M + multiples) |
| precision, minTick | number | from pricescale/minmov or exchangeInfo filters |

## Alias table
`legacyId → canonical id` (server/symbolCatalog.js), applied on every route and in the client for saved state.

## TradingView series cache
key `symbol|resolution` → bars (LRU cost = bars), live-updated by `du`; last-good kept 24 h.

## TGJU slug map
`IR:USD_FREE→price_dollar_rl`, `IR:COIN_EMAMI→sekee`, `IR:GOLD_18K→geram18`, `IR:GOLD_MESGHAL→mesghal`, … (verified by test).
