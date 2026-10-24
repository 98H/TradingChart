/**
 * @spec 012
 * @covers FR-002, FR-003, FR-004, FR-005
 */
const http = require('http');

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
  console.log(`[012 Acceptance Suite 02] Running Request Guards & API Protection against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Same-Origin Write Barrier (FR-002)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  1. Verifying same-origin write barrier (FR-002)...');
    const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const evilOrigin = 'https://malicious-cross-origin.example.com';

    for (const method of methods) {
      const res = await httpRequest({
        path: '/api/user/profile',
        method,
        headers: {
          Origin: evilOrigin,
          'Content-Type': 'application/json'
        }
      }, { dummy: true });

      assert(res.statusCode === 403,
        `FR-002 cross-origin ${method} status 403`,
        `Expected 403, got ${res.statusCode}`);
      assert(res.json?.ok === false && res.json?.error === 'cross_origin_forbidden',
        `FR-002 cross-origin ${method} error payload`,
        `Expected error: cross_origin_forbidden, got: ${JSON.stringify(res.json)}`);
    }

    // Matching Origin proceeds through the write barrier
    const sameOrigin = `${parsedBase.protocol}//${parsedBase.host}`;
    const sameOriginRes = await httpRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        Origin: sameOrigin,
        'Content-Type': 'application/json'
      }
    }, { email: 'probe@example.com', password: 'probe' });

    assert(sameOriginRes.statusCode !== 403 || sameOriginRes.json?.error !== 'cross_origin_forbidden',
      'FR-002 matching origin allowed',
      'Matching origin was unexpectedly blocked with cross_origin_forbidden');

    // No-Origin request (curl, CLI) is not blocked by cross-origin check
    const noOriginRes = await httpRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, { email: 'probe@example.com', password: 'probe' });

    assert(noOriginRes.statusCode !== 403 || noOriginRes.json?.error !== 'cross_origin_forbidden',
      'FR-002 no-origin request allowed',
      'No-origin request was unexpectedly blocked with cross_origin_forbidden');

    // GET request from cross-origin is not subject to same-origin write barrier
    const getRes = await httpRequest({
      path: '/api/health',
      method: 'GET',
      headers: {
        Origin: evilOrigin
      }
    });
    assert(getRes.statusCode === 200,
      'FR-002 read-only GET ignores same-origin barrier',
      `Expected 200, got ${getRes.statusCode}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Global Per-IP API Rate Limiter (FR-003)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  2. Verifying global per-IP API rate limiter (FR-003)...');
    const testIp = `198.51.100.${Math.floor(Math.random() * 150) + 10}`;
    const isolateIp = `198.51.100.${Math.floor(Math.random() * 50) + 200}`;

    let hit429 = false;
    let retryAfterHeader = null;
    let errorPayload = null;

    // Issue rapid requests until rate limit window (900 req/min) trips
    for (let i = 0; i < 915; i++) {
      const res = await httpRequest({
        path: '/api/health',
        headers: { 'X-Forwarded-For': testIp }
      });
      if (res.statusCode === 429) {
        hit429 = true;
        retryAfterHeader = res.headers['retry-after'];
        errorPayload = res.json;
        break;
      }
    }

    assert(hit429,
      'FR-003 rate limiter triggered 429',
      'Rate limiter did not trigger HTTP 429 within request threshold');
    assert(errorPayload?.ok === false && errorPayload?.error === 'rate_limited',
      'FR-003 rate limited response body',
      `Expected error: rate_limited, got: ${JSON.stringify(errorPayload)}`);
    assert(retryAfterHeader && parseInt(retryAfterHeader, 10) > 0,
      'FR-003 Retry-After header present',
      `Expected valid positive Retry-After, got: ${retryAfterHeader}`);

    // Verify IP isolation: another IP is unaffected
    const isolateRes = await httpRequest({
      path: '/api/health',
      headers: { 'X-Forwarded-For': isolateIp }
    });
    assert(isolateRes.statusCode === 200,
      'FR-003 rate limit IP isolation',
      `Isolated IP ${isolateIp} was blocked: ${isolateRes.statusCode}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Payload Limits, Malformed JSON & Error Sanitation (FR-004)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  3. Verifying payload size limits and error sanitation (FR-004)...');

    // 3.1 Oversized body > 2.5 MB -> 413 payload_too_large
    const oversizedBody = JSON.stringify({ padding: 'x'.repeat(2.6 * 1024 * 1024) });
    const oversizeRes = await httpRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.5'
      }
    }, oversizedBody);

    assert(oversizeRes.statusCode === 413,
      'FR-004 payload > 2.5MB status 413',
      `Expected 413, got ${oversizeRes.statusCode}`);
    assert(oversizeRes.json?.ok === false && oversizeRes.json?.error === 'payload_too_large',
      'FR-004 payload_too_large error code',
      `Expected error: payload_too_large, got: ${JSON.stringify(oversizeRes.json)}`);

    // 3.2 Malformed JSON -> 400 invalid_json
    const malformedRes = await httpRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.6'
      }
    }, '{"unclosed_json: true');

    assert(malformedRes.statusCode === 400,
      'FR-004 malformed JSON status 400',
      `Expected 400, got ${malformedRes.statusCode}`);
    assert(malformedRes.json?.ok === false && malformedRes.json?.error === 'invalid_json',
      'FR-004 invalid_json error code',
      `Expected error: invalid_json, got: ${JSON.stringify(malformedRes.json)}`);
    assert(!malformedRes.rawText.includes('SyntaxError: Unexpected token') && !malformedRes.rawText.includes('at '),
      'FR-004 no stack trace leaked on malformed JSON',
      'Stack trace leaked in malformed JSON response');

    // 3.3 Unknown API route -> 404 not_found
    const unknownApiRes = await httpRequest({
      path: `/api/unmapped_test_route_${Date.now()}`
    });
    assert(unknownApiRes.statusCode === 404,
      'FR-004 unknown API route status 404',
      `Expected 404, got ${unknownApiRes.statusCode}`);
    assert(unknownApiRes.json?.ok === false && unknownApiRes.json?.error === 'not_found',
      'FR-004 not_found error code',
      `Expected error: not_found, got: ${JSON.stringify(unknownApiRes.json)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Sensitive & Private File Shielding (FR-005)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  4. Verifying sensitive and private file shielding (FR-005)...');
    const sensitivePaths = [
      '/server/data/admin_master.key',
      '/.env',
      '/package.json',
      '/server/accounts.js',
      '/.git/config'
    ];

    for (const p of sensitivePaths) {
      const res = await httpRequest({ path: p });
      assert(res.statusCode === 404,
        `FR-005 sensitive path ${p} status 404`,
        `Sensitive path ${p} returned HTTP ${res.statusCode} instead of 404`);

      // Verify contents do not leak server raw sources or credentials
      const body = res.rawText;
      assert(!body.includes('ghp_') && !body.includes('ADMIN_') && !body.includes('MASTER_KEY'),
        `FR-005 no secrets in ${p} response`,
        `Secret credentials found in ${p} response body`);
      assert(!body.includes('"dependencies"') && !body.includes('export const') && !body.includes('[core]'),
        `FR-005 no raw source code in ${p} response`,
        `Source code leaked in ${p} response body`);
      assert(body.includes('<!doctype html') || body.includes('۴۰۴'),
        `FR-005 ${p} falls back to generic 404 page`,
        `Did not receive generic 404 page for ${p}`);
    }
  }

  console.log('[012 Acceptance Suite 02] PASS: All request guards & API protection assertions passed.');
}

run().catch(err => {
  console.error(`❌ Suite 02 unexpected error: ${err.message}`);
  process.exit(1);
});
