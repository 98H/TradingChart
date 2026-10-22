// server/security.js
// Production security layer (zero dependencies):
//  • security headers + Content-Security-Policy on every response
//  • same-origin enforcement for state-changing API calls (CSRF defence in depth;
//    session cookies are already SameSite)
//  • global per-IP API rate limit (protects upstream market-data quotas)
//  • strict input validators shared by the market-data endpoints
//  • generic 5xx bodies (no internal error text leaks to clients)

const CSP = [
  "default-src 'self'",
  // PineTS compiles user scripts at runtime (new Function) → 'unsafe-eval' is
  // required for the Pine editor; no inline <script> is ever allowed.
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join('; ');

export function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', res.getHeader('Cache-Control') || 'no-store');
  next();
}

// Reject cross-site writes: a browser always sends Origin on cross-origin
// POST/PUT/PATCH/DELETE. Requests without Origin (curl, server-to-server
// automation using X-Master-Key) are judged by the endpoint's own auth.
export function sameOriginWrites(req, res, next) {
  if (!req.path.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  let host = '';
  try { host = new URL(origin).host; } catch (e) { host = ''; }
  const fwdHost = req.headers['x-forwarded-host'];
  if (host && (host === req.headers.host || (fwdHost && host === fwdHost))) return next();
  return res.status(403).json({ ok: false, error: 'cross_origin_forbidden' });
}

// Global API budget per IP (sliding 60s window). Generous for a real user
// (the UI polls a handful of endpoints) yet caps scripted floods that would
// otherwise be amplified into upstream exchange requests.
const API_MAX_PER_MIN = Number(process.env.TC_API_RATE_PER_MIN || 900);
const hits = new Map(); // ip -> {start, n}
export function apiRateLimit(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  const ip = req.ip || 'unknown';
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now - h.start > 60000) { h = { start: now, n: 0 }; hits.set(ip, h); }
  h.n++;
  if (h.n > API_MAX_PER_MIN) {
    res.setHeader('Retry-After', String(Math.ceil((h.start + 60000 - now) / 1000)));
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }
  next();
}
const gc = setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (now - h.start > 60000) hits.delete(ip);
}, 120000);
if (gc.unref) gc.unref();

// ── Validators ────────────────────────────────────────────────────────────
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9_.\-]{0,23}$/;
export function cleanSymbol(raw, fallback = null) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const s = String(raw).replace(/^[A-Za-z0-9_]{1,16}:/, '').trim().toUpperCase();
  return SYMBOL_RE.test(s) ? s : null;
}
export function clampInt(raw, def, min, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
export function optTimestamp(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 8.64e15) return undefined; // invalid marker
  return n;
}

export function serverError(res, where, error) {
  console.error(`[API ${where}]`, error?.message || error);
  if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
}
