/**
 * @spec 014
 * @covers FR-010
 * Architect amendment (post-merge production audit, 2026-10-28): the full SC-001 sweep crashed a 256 MB server
 * (heap OOM at NATGAS 240) because demo-path caches were unbounded. This file runs the complete sweep against an
 * isolated server with the production heap limit.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const PORT = 18400 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const TFS = ['1s', '5s', '1', '3', '5', '7', '15', '30', '45', '60', '120', '240', 'D', '3D', 'W', '2W', 'M'];

function fail(scenario, reason) { console.error(`❌ ${scenario}: ${reason}`); process.exitCode = 1; }
function get(p) {
  return new Promise((resolve) => {
    const req = http.get(BASE + p, { timeout: 120000 }, (res) => {
      let body = ''; res.on('data', (c) => { body += c; });
      res.on('end', () => { let j = null; try { j = JSON.parse(body); } catch (e) {} resolve({ status: res.statusCode, body: j }); });
    });
    req.on('error', (e) => resolve({ status: -1, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: -1, error: 'timeout' }); });
  });
}

(async () => {
  const srv = spawn(process.execPath, ['--max-old-space-size=256', 'server/index.js'], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: ['ignore', 'ignore', 'pipe']
  });
  let exited = null; let stderr = '';
  srv.on('exit', (code, sig) => { exited = { code, sig }; });
  srv.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await new Promise(r => setTimeout(r, 500)); up = (await get('/api/symbols')).status === 200; }
    if (!up) { fail('FR-010 isolated server boot', 'server did not start'); return; }

    const syms = (await get('/api/symbols')).body.map(s => s.symbol);
    const jobs = []; for (const s of syms) for (const tf of TFS) jobs.push([s, tf]);
    const bad = []; let idx = 0;
    const worker = async () => {
      while (idx < jobs.length && !exited) {
        const [s, tf] = jobs[idx++];
        const r = await get(`/api/candles?symbol=${s}&timeframe=${tf}&limit=1500`);
        if (r.status !== 200) bad.push(`${s} ${tf} -> ${r.status} ${r.error || (r.body && r.body.error) || ''}`);
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    if (exited) fail('FR-010 server survives full sweep (256 MB heap)', `server exited ${JSON.stringify(exited)}; stderr tail: ${stderr.slice(-400)}`);
    if (bad.length) fail('FR-010 / SC-001 every sweep response is 200', `${bad.length} of ${jobs.length} failed, e.g. ${bad.slice(0, 5).join('; ')}`);
    // Second pass: memory must stay bounded on a repeated sweep (caches evict, never grow without limit)
    idx = 0; const before = bad.length;
    await Promise.all(Array.from({ length: 8 }, worker));
    if (exited) fail('FR-010 server survives a repeated full sweep', `server exited ${JSON.stringify(exited)}`);
    if (bad.length > before) fail('FR-010 repeated sweep all 200', `${bad.length - before} failures on second pass`);
    if (!process.exitCode) console.log(`[014 Acceptance Suite 05] PASS: full sweep ${jobs.length} requests ×2 on a 256 MB heap, all 200, server alive.`);
  } finally {
    try { srv.kill('SIGKILL'); } catch (e) {}
  }
})();
