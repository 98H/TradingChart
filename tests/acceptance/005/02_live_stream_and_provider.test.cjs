/**
 * @spec 005
 * @covers FR-008, FR-009
 */
const WebSocket = require('ws');

const BASE_URL = process.env.SDD_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:8088');
const url = new URL(BASE_URL);
const WS_URL = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws/live`;

function assert(condition, scenario, reason) {
  if (!condition) {
    console.error(`❌ ${scenario}: ${reason}`);
    process.exit(1);
  }
}

async function run() {
  console.log(`[005 Stream & Provider Test] Connecting to ${WS_URL}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. WebSocket Live Stream: Auto-subscribe, Sub/Unsub, & Ticks (FR-008, SC-004)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Verify auto-subscription to BTCUSDT on initial connection and tick payload schema
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket timed out waiting for initial BTCUSDT tick'));
      }, 5000);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'tick' && msg.symbol === 'BTCUSDT') {
            assert(typeof msg.price === 'number' && msg.price > 0, 'FR-008 tick price numeric', 'Invalid tick price');
            assert(typeof msg.change === 'number', 'FR-008 tick change numeric', 'Invalid tick change');
            assert(typeof msg.changePct === 'number', 'FR-008 tick changePct numeric', 'Invalid tick changePct');
            assert(typeof msg.high === 'number' && msg.high >= msg.price, 'FR-008 tick high numeric', 'Invalid tick high');
            assert(typeof msg.low === 'number' && msg.low <= msg.price, 'FR-008 tick low numeric', 'Invalid tick low');
            assert(typeof msg.volume === 'number' && msg.volume >= 0, 'FR-008 tick volume numeric', 'Invalid tick volume');
            assert(typeof msg.time === 'number' && msg.time > 0, 'FR-008 tick timestamp numeric', 'Invalid tick time');

            clearTimeout(timer);
            ws.close();
            resolve();
          }
        } catch (e) {
          clearTimeout(timer);
          ws.terminate();
          reject(e);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    }).catch(err => {
      assert(false, 'FR-008 initial auto-subscription BTCUSDT tick', err.message);
    });

    // Verify subscribe to ETHUSDT and unsubscribe from BTCUSDT
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket timed out waiting for ETHUSDT tick'));
      }, 5000);

      let btcTicksAfterUnsub = 0;
      let ethTicksReceived = 0;

      ws.on('open', () => {
        // Unsubscribe from default BTCUSDT and subscribe to ETHUSDT
        ws.send(JSON.stringify({ action: 'unsubscribe', symbol: 'BTCUSDT' }));
        ws.send(JSON.stringify({ action: 'subscribe', symbol: 'ETHUSDT' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'tick') {
            if (msg.symbol === 'BTCUSDT') {
              btcTicksAfterUnsub++;
            }
            if (msg.symbol === 'ETHUSDT') {
              ethTicksReceived++;
              if (ethTicksReceived >= 2) {
                clearTimeout(timer);
                ws.close();
                assert(btcTicksAfterUnsub === 0, 'FR-008 unsubscribe stops symbol ticks',
                  `Received ${btcTicksAfterUnsub} BTCUSDT ticks after unsubscribe`);
                resolve();
              }
            }
          }
        } catch (e) {
          clearTimeout(timer);
          ws.terminate();
          reject(e);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    }).catch(err => {
      assert(false, 'FR-008 subscribe/unsubscribe handling', err.message);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. WebSocket Edge Cases: Frame Size Limit & Subscription Cap (FR-008)
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Edge case: Frames larger than 4096 bytes are rejected (close code 1009)
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket did not close on oversized frame'));
      }, 5000);

      ws.on('open', () => {
        // 5000-byte frame exceeding 4096 bytes cap
        const oversized = JSON.stringify({ action: 'subscribe', symbol: 'BTCUSDT', padding: 'A'.repeat(5000) });
        ws.send(oversized);
      });

      ws.on('close', (code, reason) => {
        clearTimeout(timer);
        // Code 1009 = Message Too Big
        assert(code === 1009, 'FR-008 frame > 4096 bytes rejected with 1009', `Expected close code 1009, got ${code}`);
        resolve();
      });

      ws.on('error', () => {
        // Error before close is permissible
      });
    }).catch(err => {
      assert(false, 'FR-008 oversized frame rejection edge case', err.message);
    });

    // Edge case: More than 50 subscriptions on one socket (extra subscriptions beyond 50 are ignored)
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket timed out on 50 subscriptions cap test'));
      }, 6000);

      ws.on('open', () => {
        // #1 is BTCUSDT (auto-subscribed)
        // #2 is ETHUSDT (within cap)
        ws.send(JSON.stringify({ action: 'subscribe', symbol: 'ETHUSDT' }));
        // Fill up to the 50 cap (#3..#50)
        for (let i = 1; i <= 48; i++) {
          ws.send(JSON.stringify({ action: 'subscribe', symbol: `DUMMY_${i}` }));
        }
        // #51 is SOLUSDT -> must be ignored because socket cap of 50 is reached
        ws.send(JSON.stringify({ action: 'subscribe', symbol: 'SOLUSDT' }));
      });

      let ethTicks = 0;
      let solTicks = 0;

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'tick') {
            if (msg.symbol === 'ETHUSDT') ethTicks++;
            if (msg.symbol === 'SOLUSDT') solTicks++;
            if (ethTicks >= 2) {
              clearTimeout(timer);
              ws.close();
              assert(solTicks === 0, 'FR-008 51st subscription ignored',
                `Expected 0 SOLUSDT ticks (ignored after 50 cap), received ${solTicks}`);
              resolve();
            }
          }
        } catch (e) {
          clearTimeout(timer);
          ws.terminate();
          reject(e);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    }).catch(err => {
      assert(false, 'FR-008 50 subscriptions cap edge case', err.message);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Client Data Provider: UniversalMarketProvider (FR-009, SC-005)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const { UniversalMarketProvider } = await import('../../../client/src/universalProvider.js');
    const provider = new UniversalMarketProvider('universal', 'Chartivia Multi-Asset');

    // Provider Info Contract
    const info = provider.info();
    assert(info && info.name === 'universal', 'FR-009 provider name', 'Expected "universal"');
    assert(info.displayName === 'Chartivia Multi-Asset', 'FR-009 provider displayName', 'Expected "Chartivia Multi-Asset"');
    assert(Array.isArray(info.supportedTimeframes) && info.supportedTimeframes.includes('60'),
      'FR-009 supported timeframes', 'Expected timeframe list containing 60');
    assert(info.capabilities && info.capabilities.stream === true, 'FR-009 stream capability', 'Expected stream=true');

    // Edge case: Error fallback produces neutral seed bar or cached series (SC-005)
    const seedBars = await provider.getBars('UNKNOWN_DEAD_SYM', '60', { limit: 10 });
    assert(Array.isArray(seedBars) && seedBars.length === 1, 'FR-009 fallback seed bar array', 'Expected single seed bar');
    const seed = seedBars[0];
    assert(seed.open === 100 && seed.high === 100 && seed.low === 100 && seed.close === 100 && seed.volume === 0,
      'FR-009 neutral seed bar values', `Unexpected seed bar: ${JSON.stringify(seed)}`);
    assert(typeof seed.time === 'number' && typeof seed.openTime === 'number',
      'FR-009 seed bar timestamps', 'Missing time or openTime on seed bar');

    // Coalescing: subscribe() throttles callbacks to at most once per 250 ms
    let onBarCalls = 0;
    const timestamps = [];
    const unsubscribe = provider.subscribe('BTCUSDT', '60', (bar) => {
      onBarCalls++;
      timestamps.push(Date.now());
    });

    // Simulate 10 rapid tick arrivals within 100 ms
    const baseTime = Date.now();
    for (let i = 0; i < 10; i++) {
      if (provider.handleTick) {
        provider.handleTick({ symbol: 'BTCUSDT', price: 68000 + i, time: baseTime + i * 10 });
      }
    }

    await new Promise(r => setTimeout(r, 600));
    unsubscribe();

    if (timestamps.length >= 2) {
      for (let i = 1; i < timestamps.length; i++) {
        const delta = timestamps[i] - timestamps[i - 1];
        assert(delta >= 240, 'FR-009 tick coalescing rate <= 250ms', `Updates fired too quickly (${delta}ms apart)`);
      }
    }

    // Resilience: Socket reconnection timer check
    assert(typeof provider.initWebSocket === 'function', 'FR-009 initWebSocket method', 'Missing initWebSocket');
    if (provider.ws) {
      provider.ws.close();
    }
  }

  console.log('PASS: 005 [Live Stream & Provider]');
}

run().catch(err => {
  console.error(`❌ Unexpected error in 02_live_stream_and_provider: ${err.message}`);
  process.exit(1);
});
