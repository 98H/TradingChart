// server/tradeRelayApi.js
// Per-user Trade-Relay (paper execution) — replaces the former single global,
// unauthenticated relay that let anyone place orders into one shared book and
// read everyone's order log.
//
//  • POST /api/webhook                → signed-in user (in-app alerts), same-origin
//  • POST /api/webhook/:token         → external automation (TradingView-style),
//                                       authenticated by the user's secret token
//  • GET  /api/trade-relay/account    → caller's own relay book only
//  • GET  /api/user/webhook           → caller's webhook URL token (created lazily)
//  • POST /api/user/webhook/rotate    → new token, old one stops working
// Requires the plan entitlement `webhookAlerts`.

import crypto from 'crypto';
import { TradeRelay } from './tradeRelay.js';
import { cleanSymbol } from './security.js';

const relays = new Map(); // userId -> TradeRelay (LRU-capped)
const MAX_RELAYS = 2000;
function relayFor(userId) {
  let r = relays.get(userId);
  if (r) { relays.delete(userId); relays.set(userId, r); return r; }
  r = new TradeRelay();
  relays.set(userId, r);
  if (relays.size > MAX_RELAYS) relays.delete(relays.keys().next().value);
  return r;
}

function sanitizeSignal(body) {
  const b = body && typeof body === 'object' ? body : {};
  const action = String(b.action || '').toUpperCase();
  const symbol = cleanSymbol(b.symbol);
  const quantity = Number(b.quantity);
  const price = b.price === undefined || b.price === null || b.price === '' ? undefined : Number(b.price);
  const num = v => (v === undefined || v === null || v === '' ? undefined : (Number.isFinite(Number(v)) ? Number(v) : NaN));
  const sl = num(b.sl), tp = num(b.tp);
  if (!['BUY', 'SELL'].includes(action)) return { error: 'invalid_action' };
  if (!symbol) return { error: 'invalid_symbol' };
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9) return { error: 'invalid_quantity' };
  if (price !== undefined && (!Number.isFinite(price) || price <= 0)) return { error: 'invalid_price' };
  if (Number.isNaN(sl) || Number.isNaN(tp)) return { error: 'invalid_sl_tp' };
  const orderType = ['market', 'limit'].includes(String(b.orderType || 'market')) ? String(b.orderType || 'market') : 'market';
  return { signal: { action, symbol, quantity, price, orderType, sl, tp } };
}

export function mountTradeRelay(app, { users, flushNow, PLANS, rateGate, effectivePlanId }) {
  const planOf = u => (typeof effectivePlanId === 'function' ? effectivePlanId(u) : (u && u.plan) || 'basic');
  const entitled = u => !!(PLANS[planOf(u)] || PLANS.basic || {}).webhookAlerts;

  function execute(u, req, res) {
    if (!entitled(u)) return res.status(403).json({ ok: false, success: false, error: 'plan_feature_locked', feature: 'webhookAlerts' });
    const { signal, error } = sanitizeSignal(req.body);
    if (error) return res.status(400).json({ ok: false, success: false, error });
    const result = relayFor(u.id).processSignal(signal);
    res.status(result.success ? 200 : 400).json({ ok: result.success, ...result });
  }

  app.post('/api/webhook', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, success: false, error: 'unauthenticated' });
    execute(req.user, req, res);
  });

  app.post('/api/webhook/:token', (req, res) => {
    if (rateGate(req, res, 'webhook_token', 60, 60000)) return;
    const tok = String(req.params.token || '');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(tok)) return res.status(404).json({ ok: false, error: 'not_found' });
    const h = crypto.createHash('sha256').update(tok).digest('hex');
    const u = users().users.find(x => x.webhookTokenHash && x.webhookTokenHash === h);
    if (!u || u.suspended) return res.status(404).json({ ok: false, error: 'not_found' });
    execute(u, req, res);
  });

  app.get('/api/trade-relay/account', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    res.json(relayFor(req.user.id).getAccountState());
  });

  function issue(u) {
    const token = crypto.randomBytes(24).toString('base64url');
    u.webhookTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    u.webhookTokenHint = token.slice(-4);
    flushNow();
    return token;
  }

  // The raw token is shown once (on creation/rotation); afterwards only a hint.
  app.get('/api/user/webhook', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    res.json({ ok: true, enabled: entitled(req.user), hasToken: !!req.user.webhookTokenHash, hint: req.user.webhookTokenHint || null });
  });
  app.post('/api/user/webhook/rotate', (req, res) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    if (rateGate(req, res, 'webhook_rotate', 5, 60000)) return;
    if (!entitled(req.user)) return res.status(403).json({ ok: false, error: 'plan_feature_locked', feature: 'webhookAlerts' });
    const token = issue(req.user);
    res.json({ ok: true, token, hint: req.user.webhookTokenHint });
  });
}
