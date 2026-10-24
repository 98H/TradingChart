/**
 * @spec 012
 * @covers FR-001, FR-006, FR-007, FR-008, FR-009
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:8088');
const parsedBase = new URL(BASE_URL);

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const headers = { ...(options.headers || {}) };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const reqOptions = {
      hostname: parsedBase.hostname,
      port: parsedBase.port || 80,
      path: options.path || '/',
      method: options.method || 'GET',
      headers
    };
    const req = http.request(reqOptions, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          rawText: data,
          json
        });
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function run() {
  console.log(`[012 Acceptance Suite 01] Running Security Headers & Routing against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Global Security Headers & Directives (FR-001)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  1. Verifying global security headers (FR-001)...');
    const res = await httpRequest({ path: '/' });
    assert(res.statusCode === 200, 'FR-001 root status 200', `Expected 200, got ${res.statusCode}`);

    const csp = res.headers['content-security-policy'] || '';
    assert(csp.includes("default-src 'self'"), 'FR-001 CSP default-src', `Missing default-src: ${csp}`);
    assert(csp.includes("script-src 'self' 'unsafe-eval'"), 'FR-001 CSP script-src unsafe-eval', `Missing script-src: ${csp}`);
    assert(csp.includes("style-src 'self' 'unsafe-inline'"), 'FR-001 CSP style-src unsafe-inline', `Missing style-src: ${csp}`);
    assert(csp.includes("img-src 'self' data: blob:"), 'FR-001 CSP img-src', `Missing img-src: ${csp}`);
    assert(csp.includes("font-src 'self' data:"), 'FR-001 CSP font-src', `Missing font-src: ${csp}`);
    assert(csp.includes("connect-src 'self' ws: wss:"), 'FR-001 CSP connect-src', `Missing connect-src: ${csp}`);
    assert(csp.includes("media-src 'self' data: blob:"), 'FR-001 CSP media-src', `Missing media-src: ${csp}`);
    assert(csp.includes("worker-src 'self' blob:"), 'FR-001 CSP worker-src', `Missing worker-src: ${csp}`);
    assert(csp.includes("object-src 'none'"), 'FR-001 CSP object-src', `Missing object-src: ${csp}`);
    assert(csp.includes("base-uri 'self'"), 'FR-001 CSP base-uri', `Missing base-uri: ${csp}`);
    assert(csp.includes("form-action 'self'"), 'FR-001 CSP form-action', `Missing form-action: ${csp}`);
    assert(csp.includes("frame-ancestors 'self'"), 'FR-001 CSP frame-ancestors', `Missing frame-ancestors: ${csp}`);

    assert(res.headers['x-content-type-options'] === 'nosniff',
      'FR-001 X-Content-Type-Options nosniff', `Expected nosniff, got ${res.headers['x-content-type-options']}`);
    assert(res.headers['x-frame-options'] === 'SAMEORIGIN',
      'FR-001 X-Frame-Options SAMEORIGIN', `Expected SAMEORIGIN, got ${res.headers['x-frame-options']}`);
    assert(res.headers['referrer-policy'] === 'strict-origin-when-cross-origin',
      'FR-001 Referrer-Policy strict-origin-when-cross-origin', `Expected strict-origin-when-cross-origin, got ${res.headers['referrer-policy']}`);
    assert(res.headers['permissions-policy'] === 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'FR-001 Permissions-Policy restricted', `Unexpected Permissions-Policy: ${res.headers['permissions-policy']}`);
    assert(res.headers['cross-origin-opener-policy'] === 'same-origin-allow-popups',
      'FR-001 COOP same-origin-allow-popups', `Unexpected COOP: ${res.headers['cross-origin-opener-policy']}`);
    assert(res.headers['cross-origin-resource-policy'] === 'same-origin',
      'FR-001 CORP same-origin', `Unexpected CORP: ${res.headers['cross-origin-resource-policy']}`);

    assert(!res.headers['x-powered-by'],
      'FR-001 X-Powered-By absent', `X-Powered-By should not be exposed: ${res.headers['x-powered-by']}`);

    // HSTS behavior: absent on plain HTTP, present when X-Forwarded-Proto: https
    assert(!res.headers['strict-transport-security'],
      'FR-001 HSTS absent on insecure HTTP', `HSTS should not be sent on plain HTTP`);

    const secureRes = await httpRequest({
      path: '/',
      headers: { 'X-Forwarded-Proto': 'https' }
    });
    assert(secureRes.headers['strict-transport-security'] === 'max-age=31536000; includeSubDomains',
      'FR-001 HSTS present on secure HTTPS', `Unexpected HSTS header: ${secureRes.headers['strict-transport-security']}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Public Market-Data CORS Allow-List (FR-006, Edge Cases)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  2. Verifying public market-data CORS allow-list (FR-006)...');
    const whitelistedEndpoints = [
      '/api/candles?symbol=BINANCE:BTCUSDT',
      '/api/tickers',
      '/api/symbols',
      '/api/symbol-info?symbol=BINANCE:BTCUSDT',
      '/api/news',
      '/api/economic-calendar',
      '/api/screener',
      '/api/depth?symbol=BINANCE:BTCUSDT'
    ];

    for (const ep of whitelistedEndpoints) {
      const res = await httpRequest({
        path: ep,
        method: 'GET',
        headers: { Origin: 'https://thirdparty.example.com' }
      });
      assert(res.headers['access-control-allow-origin'] === '*',
        `FR-006 CORS enabled on ${ep}`, `Expected '*', got ${res.headers['access-control-allow-origin']}`);
      assert(!res.headers['access-control-allow-credentials'],
        `FR-006 no credentials on ${ep}`, `Credentials must not be allowed for public CORS`);
    }

    // Verify non-market-data endpoints omit CORS headers
    const nonCorsEndpoints = ['/', '/api/health', '/api/plans'];
    for (const ep of nonCorsEndpoints) {
      const res = await httpRequest({
        path: ep,
        method: 'GET',
        headers: { Origin: 'https://thirdparty.example.com' }
      });
      assert(!res.headers['access-control-allow-origin'],
        `FR-006 CORS absent on non-market endpoint ${ep}`,
        `Expected no CORS header, got ${res.headers['access-control-allow-origin']}`);
    }

    // Verify mutations on whitelisted endpoints do NOT allow CORS
    const mutRes = await httpRequest({
      path: '/api/candles',
      method: 'POST',
      headers: {
        Origin: 'https://thirdparty.example.com',
        'Content-Type': 'application/json'
      }
    }, { data: 'test' });
    assert(!mutRes.headers['access-control-allow-origin'],
      'FR-006 CORS forbidden on mutations',
      `Mutations must not have CORS headers, got: ${mutRes.headers['access-control-allow-origin']}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Host Canonicalization 301 Redirects (FR-007)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  3. Verifying host canonicalization 301 redirects (FR-007)...');
    const redirectHosts = [
      'www.chartivia.com',
      'chartivia.ir',
      'www.chartivia.ir',
      'trade.chartivia.ir',
      'api.chartivia.ir'
    ];

    const testPath = `/chart?symbol=BINANCE:ETHUSDT&interval=60`;
    for (const host of redirectHosts) {
      const res = await httpRequest({
        path: testPath,
        method: 'GET',
        headers: { Host: host }
      });
      assert(res.statusCode === 301,
        `FR-007 host redirect 301 for ${host}`, `Expected 301, got ${res.statusCode}`);
      const expectedLocation = `https://chartivia.com${testPath}`;
      assert(res.headers.location === expectedLocation,
        `FR-007 host redirect Location for ${host}`,
        `Expected Location ${expectedLocation}, got ${res.headers.location}`);
    }

    // Canonical host does not 301 redirect
    const canonicalRes = await httpRequest({
      path: '/chart',
      method: 'GET',
      headers: { Host: 'chartivia.com' }
    });
    assert(canonicalRes.statusCode === 200,
      'FR-007 canonical host 200 OK', `Expected 200, got ${canonicalRes.statusCode}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Core Routes & Static Asset Caching (FR-008)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  4. Verifying core routes and caching policies (FR-008)...');

    // GET / (Landing page)
    const landingRes = await httpRequest({ path: '/' });
    assert(landingRes.statusCode === 200, 'FR-008 landing page status 200', `Got ${landingRes.statusCode}`);
    assert((landingRes.headers['content-type'] || '').includes('text/html'),
      'FR-008 landing content-type text/html', `Got ${landingRes.headers['content-type']}`);
    assert((landingRes.headers['cache-control'] || '').includes('no-cache'),
      'FR-008 landing Cache-Control no-cache', `Got ${landingRes.headers['cache-control']}`);

    // GET /chart (Trading application shell)
    const chartRes = await httpRequest({ path: '/chart' });
    assert(chartRes.statusCode === 200, 'FR-008 chart app status 200', `Got ${chartRes.statusCode}`);
    assert((chartRes.headers['content-type'] || '').includes('text/html'),
      'FR-008 chart content-type text/html', `Got ${chartRes.headers['content-type']}`);
    assert((chartRes.headers['cache-control'] || '').includes('no-cache'),
      'FR-008 chart Cache-Control no-cache', `Got ${chartRes.headers['cache-control']}`);

    // GET /admin (Admin console protective headers)
    const adminRes = await httpRequest({ path: '/admin' });
    assert(adminRes.statusCode === 200, 'FR-008 admin status 200', `Got ${adminRes.statusCode}`);
    assert(adminRes.headers['cache-control'] === 'no-store',
      'FR-008 admin Cache-Control no-store', `Got ${adminRes.headers['cache-control']}`);
    assert(adminRes.headers['x-frame-options'] === 'DENY',
      'FR-008 admin X-Frame-Options DENY', `Got ${adminRes.headers['x-frame-options']}`);
    assert(adminRes.headers['referrer-policy'] === 'no-referrer',
      'FR-008 admin Referrer-Policy no-referrer', `Got ${adminRes.headers['referrer-policy']}`);
    assert(adminRes.headers['x-robots-tag'] === 'noindex, nofollow',
      'FR-008 admin X-Robots-Tag noindex, nofollow', `Got ${adminRes.headers['x-robots-tag']}`);

    // GET /assets/* (Hashed assets cached 30 days immutable)
    const assetsDir = path.resolve(__dirname, '../../../dist/assets');
    const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
    if (assetFiles.length > 0) {
      const sampleAsset = assetFiles[0];
      const assetRes = await httpRequest({ path: `/assets/${sampleAsset}` });
      assert(assetRes.statusCode === 200, 'FR-008 asset status 200', `Got ${assetRes.statusCode}`);
      const assetCc = assetRes.headers['cache-control'] || '';
      assert(assetCc.includes('public') && assetCc.includes('max-age=2592000') && assetCc.includes('immutable'),
        'FR-008 asset Cache-Control 30 days immutable', `Got ${assetCc}`);
    }

    // Unmapped page (Bilingual 404 page)
    const unknownRes = await httpRequest({ path: `/non-existent-page-${Date.now()}` });
    assert(unknownRes.statusCode === 404, 'FR-008 unknown route status 404', `Got ${unknownRes.statusCode}`);
    assert((unknownRes.headers['content-type'] || '').includes('text/html'),
      'FR-008 404 content-type text/html', `Got ${unknownRes.headers['content-type']}`);
    assert(unknownRes.rawText.includes('۴۰۴'),
      'FR-008 404 body contains Persian ۴۰۴', 'Missing ۴۰۴ in 404 page body');
    assert(unknownRes.rawText.includes('href="/"') || unknownRes.rawText.includes('href=\'/\''),
      'FR-008 404 body contains home link', 'Missing link to /');
    assert(unknownRes.rawText.includes('href="/chart"') || unknownRes.rawText.includes('href=\'/chart\''),
      'FR-008 404 body contains chart link', 'Missing link to /chart');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. GET /api/health Liveness Endpoint (FR-009)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  5. Verifying health check endpoint (FR-009)...');
    const healthRes = await httpRequest({ path: '/api/health' });
    assert(healthRes.statusCode === 200, 'FR-009 health status 200', `Got ${healthRes.statusCode}`);
    assert(healthRes.headers['cache-control'] === 'no-store',
      'FR-009 health Cache-Control no-store', `Got ${healthRes.headers['cache-control']}`);

    const body = healthRes.json;
    assert(body && body.status === 'online',
      'FR-009 health status online', `Expected online, got ${body?.status}`);
    assert(body && body.product === 'Chartivia',
      'FR-009 health product Chartivia', `Expected Chartivia, got ${body?.product}`);
    assert(body && typeof body.timestamp === 'string' && !isNaN(Date.parse(body.timestamp)),
      'FR-009 health valid ISO timestamp', `Invalid timestamp: ${body?.timestamp}`);

    // Verify no internal metrics (memory, uptime, load) leak
    assert(!('memory' in body), 'FR-009 health leaks memory', 'Memory metrics exposed');
    assert(!('uptime' in body), 'FR-009 health leaks uptime', 'Uptime metrics exposed');
    assert(!('pid' in body), 'FR-009 health leaks pid', 'PID exposed');
  }

  console.log('[012 Acceptance Suite 01] PASS: All security headers and routing assertions passed.');
}

run().catch(err => {
  console.error(`❌ Suite 01 unexpected error: ${err.message}`);
  process.exit(1);
});
