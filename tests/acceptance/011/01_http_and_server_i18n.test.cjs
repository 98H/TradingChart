/**
 * @spec 011
 * @covers FR-001, FR-006, FR-012
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:8088');

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

function getMasterKey() {
  if (process.env.TRADINGCHART_MASTER_KEY) return process.env.TRADINGCHART_MASTER_KEY.trim();
  const candidates = [
    path.resolve(__dirname, '../../../server/data/admin_master.key'),
    path.resolve(process.cwd(), 'server/data/admin_master.key')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8').trim();
    }
  }
  return '';
}

let ipSubnet = Math.floor(Math.random() * 200) + 10;
let ipHost = 1;
function nextIp() {
  ipHost++;
  if (ipHost > 250) { ipSubnet++; ipHost = 1; }
  return `10.95.${ipSubnet}.${ipHost}`;
}

async function request(endpoint, options = {}, clientIp = null) {
  const reqUrl = `${BASE_URL}${endpoint}`;
  const ip = clientIp || nextIp();
  const headers = {
    'X-Forwarded-For': ip,
    ...(options.headers || {})
  };
  const res = await fetch(reqUrl, { ...options, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, body: json, rawText: text };
}

async function run() {
  console.log(`[011 Acceptance Suite 01] Running HTTP & Server I18n against ${BASE_URL}...`);
  const ts = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Unknown Route Persian RTL 404 Error Page (FR-012, Edge Case 3)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  1. Verifying Persian RTL 404 error page (FR-012)...');
    const randomRoute = `/nonexistent-route-${ts}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await request(randomRoute);

    assert(res.status === 404, 'FR-012 unknown route status 404', `Expected 404, got ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    assert(contentType.includes('text/html'), 'FR-012 unknown route returns text/html', `Expected text/html, got ${contentType}`);

    const cacheControl = res.headers.get('cache-control') || '';
    assert(cacheControl.includes('no-cache'), 'FR-012 unknown route cache-control no-cache', `Expected no-cache, got ${cacheControl}`);

    // Verify HTML structure, language, direction, title and contents
    const html = res.rawText;
    assert(/<html[^>]*lang=["']fa["'][^>]*dir=["']rtl["']/i.test(html) ||
           /<html[^>]*dir=["']rtl["'][^>]*lang=["']fa["']/i.test(html),
           'FR-012 unknown route HTML has lang="fa" dir="rtl"',
           `Missing lang="fa" dir="rtl" in 404 page`);

    assert(html.includes('<title>صفحه پیدا نشد · Chartivia</title>'),
           'FR-012 unknown route title is localized',
           'Missing localized title in 404 page');

    assert(html.includes('۴۰۴'),
           'FR-012 unknown route displays Persian numerals for 404',
           'Missing Persian numerals ۴۰۴ in 404 page');

    assert(html.includes('صفحه‌ای که دنبال آن هستید پیدا نشد.'),
           'FR-012 unknown route includes Persian error explanation',
           'Missing Persian error message');

    assert(/href=["']\/["']/.test(html) && html.includes('صفحه اصلی'),
           'FR-012 unknown route includes home link',
           'Missing localized link to home');

    assert(/href=["']\/chart["']/.test(html) && html.includes('نمودار'),
           'FR-012 unknown route includes chart link',
           'Missing localized link to chart');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Self-Hosted Fonts & Offline Font Stack (FR-006)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  2. Verifying self-hosted font assets (FR-006)...');
    const fontsCssPath = path.resolve(__dirname, '../../../client/styles/fonts.css');
    assert(fs.existsSync(fontsCssPath), 'FR-006 fonts.css file exists', `File not found at ${fontsCssPath}`);

    const fontsCss = fs.readFileSync(fontsCssPath, 'utf8');

    // Verify no external font CDN links are present
    const cdnRegex = /https?:\/\/[^\s'")]+(?:googleapis\.com|gstatic\.com|jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com)[^\s'")]*/i;
    const cdnMatch = fontsCss.match(cdnRegex);
    assert(!cdnMatch, 'FR-006 no external font CDN in fonts.css', `Found external CDN link: ${cdnMatch?.[0]}`);

    // Verify required font families are declared locally via @fontsource
    assert(fontsCss.includes('vazirmatn') || fontsCss.includes('Vazirmatn'),
           'FR-006 Vazirmatn font declared in fonts.css', 'Missing Vazirmatn declaration');
    assert(fontsCss.includes('inter') || fontsCss.includes('Inter'),
           'FR-006 Inter font declared in fonts.css', 'Missing Inter declaration');
    assert(fontsCss.includes('jetbrains-mono') || fontsCss.includes('JetBrains Mono'),
           'FR-006 JetBrains Mono font declared in fonts.css', 'Missing JetBrains Mono declaration');

    // Verify HTML entry points do not load external fonts via CDN
    const htmlEntries = [
      path.resolve(__dirname, '../../../client/index.html'),
      path.resolve(__dirname, '../../../client/chart/index.html'),
      path.resolve(__dirname, '../../../client/admin/index.html')
    ];

    for (const entryPath of htmlEntries) {
      if (fs.existsSync(entryPath)) {
        const entryContent = fs.readFileSync(entryPath, 'utf8');
        const entryCdnMatch = entryContent.match(cdnRegex);
        assert(!entryCdnMatch, `FR-006 no external font CDN in ${path.basename(entryPath)}`, `Found CDN link: ${entryCdnMatch?.[0]}`);
      }
    }

    // Verify font packages are installed locally in node_modules
    const nodeModulesPath = path.resolve(__dirname, '../../../node_modules/@fontsource');
    assert(fs.existsSync(path.join(nodeModulesPath, 'vazirmatn')), 'FR-006 @fontsource/vazirmatn package installed', 'Missing @fontsource/vazirmatn');
    assert(fs.existsSync(path.join(nodeModulesPath, 'inter')), 'FR-006 @fontsource/inter package installed', 'Missing @fontsource/inter');
    assert(fs.existsSync(path.join(nodeModulesPath, 'jetbrains-mono')), 'FR-006 @fontsource/jetbrains-mono package installed', 'Missing @fontsource/jetbrains-mono');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. User Cloud State Language Persistence & Sync (FR-001)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  3. Verifying user cloud state language persistence (FR-001)...');
    const masterKey = getMasterKey();
    let adminCookie = '';

    if (masterKey) {
      const authRes = await request('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey })
      });
      if (authRes.status === 200) {
        adminCookie = authRes.headers.get('set-cookie') || '';
      }
    }

    const testUser = {
      email: `i18n_user_${ts}@acceptance.test`,
      username: `u_i18n_${ts}`.slice(0, 24),
      password: 'StrongPassword123!',
      displayName: `I18n Test User ${ts}`
    };

    const regRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    assert(regRes.status === 200, 'FR-001 setup: register test user', `Expected 200, got ${regRes.status}: ${regRes.rawText}`);

    const userCookie = regRes.headers.get('set-cookie');
    assert(!!userCookie, 'FR-001 setup: test user session cookie', 'Missing user session cookie');
    const userId = regRes.body?.user?.id;

    try {
      // Step A: Retrieve initial state
      const initialGet = await request('/api/user/state', {
        headers: { Cookie: userCookie }
      });
      assert(initialGet.status === 200, 'FR-001 GET /api/user/state status 200', `Expected 200, got ${initialGet.status}`);
      assert(initialGet.body?.ok === true, 'FR-001 initial state ok: true', 'Expected ok: true');
      const baseUpdatedAt = initialGet.body?.updatedAt || 0;

      // Step B: Update user language to 'fa' via PUT /api/user/state
      const updateFaRes = await request('/api/user/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: userCookie },
        body: JSON.stringify({
          state: {
            tradingchart_user_settings: {
              language: 'fa',
              theme: 'dark'
            }
          },
          baseUpdatedAt
        })
      });
      assert(updateFaRes.status === 200, 'FR-001 PUT /api/user/state with language fa status 200', `Expected 200, got ${updateFaRes.status}: ${updateFaRes.rawText}`);
      assert(updateFaRes.body?.ok === true, 'FR-001 PUT language fa ok: true', 'Expected ok: true');

      // Step C: Verify persisted language is 'fa'
      const verifyFaRes = await request('/api/user/state', {
        headers: { Cookie: userCookie }
      });
      assert(verifyFaRes.status === 200, 'FR-001 GET updated state status 200', `Expected 200, got ${verifyFaRes.status}`);
      const savedLang = verifyFaRes.body?.state?.tradingchart_user_settings?.language;
      assert(savedLang === 'fa', 'FR-001 persisted language is fa', `Expected "fa", got "${savedLang}"`);

      // Step D: Update user language to 'en' via PUT /api/user/state
      const updateEnRes = await request('/api/user/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: userCookie },
        body: JSON.stringify({
          state: {
            tradingchart_user_settings: {
              language: 'en',
              theme: 'dark'
            }
          },
          baseUpdatedAt: verifyFaRes.body?.updatedAt || 0
        })
      });
      assert(updateEnRes.status === 200, 'FR-001 PUT /api/user/state with language en status 200', `Expected 200, got ${updateEnRes.status}`);

      // Step E: Verify persisted language switched to 'en'
      const verifyEnRes = await request('/api/user/state', {
        headers: { Cookie: userCookie }
      });
      assert(verifyEnRes.body?.state?.tradingchart_user_settings?.language === 'en',
             'FR-001 persisted language is en',
             `Expected "en", got "${verifyEnRes.body?.state?.tradingchart_user_settings?.language}"`);
    } finally {
      // Cleanup: delete test user via admin API if available
      if (adminCookie && userId) {
        await request(`/api/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
          body: JSON.stringify({ confirm: testUser.username })
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Public Platform Announcement Bilingual Structure (Edge Case 2, Contract 1)
  // ──────────────────────────────────────────────────────────────────────────
  {
    console.log('  4. Verifying public platform announcement bilingual contract...');
    const platRes = await request('/api/platform');
    assert(platRes.status === 200, 'Contract 1 GET /api/platform status 200', `Expected 200, got ${platRes.status}`);
    assert(platRes.body?.ok === true, 'Contract 1 GET /api/platform ok: true', 'Expected ok: true');
    assert(typeof platRes.body?.registrationOpen === 'boolean', 'Contract 1 registrationOpen boolean', 'Missing registrationOpen');

    // When an announcement is active, it must carry bilingual fa and en texts
    if (platRes.body?.announcement) {
      const a = platRes.body.announcement;
      assert(['info', 'warning', 'success'].includes(a.level), 'Contract 1 announcement valid level', `Unexpected level: ${a.level}`);
      assert(typeof a.fa === 'string', 'Contract 1 announcement has fa text', 'Missing announcement fa text');
      assert(typeof a.en === 'string', 'Contract 1 announcement has en text', 'Missing announcement en text');
      assert(typeof a.updatedAt === 'number', 'Contract 1 announcement has numeric updatedAt', 'Missing updatedAt');
    }
  }

  console.log('✅ [011 Acceptance Suite 01] HTTP & Server I18n passed.');
}

run().catch((err) => {
  console.error('❌ Unhandled suite error:', err);
  process.exit(1);
});
