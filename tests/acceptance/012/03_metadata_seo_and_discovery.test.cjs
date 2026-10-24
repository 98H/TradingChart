/**
 * @spec 012
 * @covers FR-010
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
  console.log(`[012 Acceptance Suite 03] Running Metadata, SEO & Discovery against ${BASE_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Robots Exclusion Standard (FR-010)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  1. Verifying /robots.txt directives (FR-010)...');
    const res = await httpRequest({ path: '/robots.txt' });
    assert(res.statusCode === 200, 'FR-010 robots.txt status 200', `Got ${res.statusCode}`);
    assert((res.headers['content-type'] || '').includes('text/plain'),
      'FR-010 robots.txt content-type text/plain', `Got ${res.headers['content-type']}`);

    const body = res.rawText;
    assert(body.includes('Allow: /'), 'FR-010 robots.txt allows /', 'Missing Allow: /');
    assert(body.includes('Disallow: /admin'), 'FR-010 robots.txt disallows /admin', 'Missing Disallow: /admin');
    assert(body.includes('Disallow: /api/'), 'FR-010 robots.txt disallows /api/', 'Missing Disallow: /api/');
    assert(body.includes('Sitemap: https://chartivia.com/sitemap.xml'),
      'FR-010 robots.txt references canonical sitemap', 'Missing sitemap reference');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Canonical Sitemap (FR-010)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  2. Verifying /sitemap.xml (FR-010)...');
    const res = await httpRequest({ path: '/sitemap.xml' });
    assert(res.statusCode === 200, 'FR-010 sitemap.xml status 200', `Got ${res.statusCode}`);
    assert((res.headers['content-type'] || '').includes('xml'),
      'FR-010 sitemap.xml content-type XML', `Got ${res.headers['content-type']}`);

    const xml = res.rawText;
    assert(xml.includes('<urlset') && xml.includes('</urlset>'),
      'FR-010 sitemap.xml valid urlset structure', 'Missing <urlset> tags');
    assert(xml.includes('<loc>https://chartivia.com/</loc>'),
      'FR-010 sitemap.xml contains root canonical URL', 'Missing canonical https://chartivia.com/');
    assert(xml.includes('<loc>https://chartivia.com/chart</loc>'),
      'FR-010 sitemap.xml contains chart canonical URL', 'Missing canonical https://chartivia.com/chart');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Web App Manifest (FR-010)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  3. Verifying /manifest.webmanifest (FR-010)...');
    const res = await httpRequest({ path: '/manifest.webmanifest' });
    assert(res.statusCode === 200, 'FR-010 manifest.webmanifest status 200', `Got ${res.statusCode}`);

    const m = res.json;
    assert(m && m.name === 'Chartivia',
      'FR-010 manifest name is Chartivia', `Expected Chartivia, got ${m?.name}`);
    assert(m && m.start_url === '/chart',
      'FR-010 manifest start_url is /chart', `Expected /chart, got ${m?.start_url}`);
    assert(m && m.display === 'standalone',
      'FR-010 manifest display is standalone', `Expected standalone, got ${m?.display}`);
    assert(Array.isArray(m?.icons) && m.icons.length > 0,
      'FR-010 manifest declares application icons', 'Missing or empty icons array');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Security Contact Declaration (FR-010)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  4. Verifying /.well-known/security.txt (FR-010)...');
    const res = await httpRequest({ path: '/.well-known/security.txt' });
    assert(res.statusCode === 200, 'FR-010 security.txt status 200', `Got ${res.statusCode}`);
    assert((res.headers['content-type'] || '').includes('text/plain'),
      'FR-010 security.txt content-type text/plain', `Got ${res.headers['content-type']}`);

    const sec = res.rawText;
    assert(sec.includes('Contact: mailto:security@chartivia.com'),
      'FR-010 security.txt specifies contact mailto', 'Missing contact declaration');
    assert(sec.includes('Preferred-Languages:'),
      'FR-010 security.txt specifies preferred languages', 'Missing preferred languages');
    assert(sec.includes('Canonical: https://chartivia.com/.well-known/security.txt'),
      'FR-010 security.txt specifies canonical URI', 'Missing canonical URI');
    assert(sec.includes('Expires:'),
      'FR-010 security.txt specifies expiration timestamp', 'Missing expiration');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Landing Page SEO, Open Graph & Hreflang Tags (FR-010)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  5. Verifying landing page HTML head metadata (FR-010)...');
    const res = await httpRequest({ path: '/' });
    assert(res.statusCode === 200, 'FR-010 landing page status 200', `Got ${res.statusCode}`);

    const html = res.rawText;
    assert(/<meta\s+name=["']description["']/i.test(html),
      'FR-010 meta description tag present', 'Missing meta description');
    assert(/<link\s+rel=["']canonical["']\s+href=["']https:\/\/chartivia\.com\/["']/i.test(html),
      'FR-010 canonical link tag present', 'Missing canonical link');
    assert(/<link\s+rel=["']alternate["']\s+hreflang=["']fa["']/i.test(html),
      'FR-010 hreflang alternate for Persian present', 'Missing hreflang fa');
    assert(/<link\s+rel=["']alternate["']\s+hreflang=["']en["']/i.test(html),
      'FR-010 hreflang alternate for English present', 'Missing hreflang en');
    assert(/<meta\s+property=["']og:title["']/i.test(html),
      'FR-010 og:title present', 'Missing og:title');
    assert(/<meta\s+property=["']og:description["']/i.test(html),
      'FR-010 og:description present', 'Missing og:description');
    assert(/<meta\s+property=["']og:type["']/i.test(html),
      'FR-010 og:type present', 'Missing og:type');
    assert(/<meta\s+property=["']og:url["']/i.test(html),
      'FR-010 og:url present', 'Missing og:url');
    assert(/<meta\s+name=["']twitter:card["']/i.test(html),
      'FR-010 twitter:card present', 'Missing twitter:card');
    assert(/<link\s+rel=["']manifest["']\s+href=["']\/manifest\.webmanifest["']/i.test(html),
      'FR-010 link to manifest.webmanifest present', 'Missing manifest link');
  }

  console.log('[012 Acceptance Suite 03] PASS: All metadata, SEO & discovery assertions passed.');
}

run().catch(err => {
  console.error(`❌ Suite 03 unexpected error: ${err.message}`);
  process.exit(1);
});
