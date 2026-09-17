// server/tradeRelay.js
// Inspired by LuxAlgo Trade-Relay: webhook execution engine with internal safety rails

export class TradeRelay {
  constructor(options = {}) {
    this.maxOrderSize = options.maxOrderSize || 50000; // $50k max order notional
    this.maxDailyDrawdownPct = options.maxDailyDrawdownPct || 5.0; // 5% max daily DD
    this.rateLimitMs = options.rateLimitMs || 1000; // 1s between orders
    this.lastOrderTs = 0;
    this.orderLogs = []; // Flight recorder
    this.activePositions = new Map();
    this.accountBalance = 100000; // $100k starting equity
    this.initialBalance = 100000;
  }

  processSignal(payload) {
    const now = Date.now();
    const logEntry = {
      id: 'ord-' + Math.random().toString(36).slice(2, 9),
      receivedAt: new Date(now).toISOString(),
      payload,
      status: 'pending',
      rejectionReason: null,
      executionPrice: null,
      pnl: 0
    };

    // 1. Rate Limiting Safety Rail
    if (now - this.lastOrderTs < this.rateLimitMs) {
      logEntry.status = 'rejected';
      logEntry.rejectionReason = 'Rate limit exceeded: too many orders per second';
      this.orderLogs.unshift(logEntry);
      return { success: false, error: logEntry.rejectionReason, log: logEntry };
    }

    // 2. Validate essential fields
    const { action, symbol, quantity, price, orderType = 'market', sl, tp } = payload;
    if (!action || !symbol || !quantity) {
      logEntry.status = 'rejected';
      logEntry.rejectionReason = 'Missing mandatory fields: action, symbol, quantity';
      this.orderLogs.unshift(logEntry);
      return { success: false, error: logEntry.rejectionReason, log: logEntry };
    }

    const notional = (price || 1) * quantity;

    // 3. Max Order Size Safety Rail
    if (notional > this.maxOrderSize) {
      logEntry.status = 'rejected';
      logEntry.rejectionReason = `Order notional $${notional.toFixed(2)} exceeds safety cap of $${this.maxOrderSize}`;
      this.orderLogs.unshift(logEntry);
      return { success: false, error: logEntry.rejectionReason, log: logEntry };
    }

    // 4. Daily Drawdown Safety Rail
    const currentDrawdown = ((this.initialBalance - this.accountBalance) / this.initialBalance) * 100;
    if (currentDrawdown >= this.maxDailyDrawdownPct) {
      logEntry.status = 'rejected';
      logEntry.rejectionReason = `Circuit Breaker: Daily drawdown ${currentDrawdown.toFixed(2)}% breached limit ${this.maxDailyDrawdownPct}%`;
      this.orderLogs.unshift(logEntry);
      return { success: false, error: logEntry.rejectionReason, log: logEntry };
    }

    // 5. Execute Order (Paper / Simulated)
    this.lastOrderTs = now;
    logEntry.status = 'filled';
    logEntry.executionPrice = price || 100;
    logEntry.filledQuantity = quantity;

    const normSymbol = symbol.toUpperCase();
    if (action.toUpperCase() === 'BUY') {
      const existing = this.activePositions.get(normSymbol) || { qty: 0, avgPrice: 0 };
      const newQty = existing.qty + quantity;
      const newAvg = ((existing.qty * existing.avgPrice) + (quantity * logEntry.executionPrice)) / newQty;
      this.activePositions.set(normSymbol, { qty: newQty, avgPrice: newAvg, side: 'long', sl, tp });
    } else if (action.toUpperCase() === 'SELL') {
      const existing = this.activePositions.get(normSymbol);
      if (existing && existing.qty > 0) {
        const closedQty = Math.min(existing.qty, quantity);
        const realizedPnl = (logEntry.executionPrice - existing.avgPrice) * closedQty;
        this.accountBalance += realizedPnl;
        logEntry.pnl = Number(realizedPnl.toFixed(2));
        existing.qty -= closedQty;
        if (existing.qty <= 0) {
          this.activePositions.delete(normSymbol);
        } else {
          this.activePositions.set(normSymbol, existing);
        }
      } else {
        // Open short position
        this.activePositions.set(normSymbol, { qty: quantity, avgPrice: logEntry.executionPrice, side: 'short', sl, tp });
      }
    }

    this.orderLogs.unshift(logEntry);
    if (this.orderLogs.length > 500) this.orderLogs.pop();

    return {
      success: true,
      log: logEntry,
      account: {
        balance: Number(this.accountBalance.toFixed(2)),
        equity: Number(this.accountBalance.toFixed(2)),
        openPositions: Array.from(this.activePositions.entries()).map(([k, v]) => ({ symbol: k, ...v }))
      }
    };
  }

  getLogs() {
    return this.orderLogs;
  }

  getAccountState() {
    return {
      balance: Number(this.accountBalance.toFixed(2)),
      initialBalance: this.initialBalance,
      positions: Array.from(this.activePositions.entries()).map(([k, v]) => ({ symbol: k, ...v })),
      recentLogs: this.orderLogs.slice(0, 50)
    };
  }
}

export const globalRelay = new TradeRelay();
