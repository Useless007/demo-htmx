import { resetDb } from './_utils.js';
import { startTestServer, stopTestServer } from './test-server.js';

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(2); } }

const PORT = 3011;
process.env.PORT = String(PORT);

async function waitForServer(url, attempts = 40, delayMs = 50) {
    for (let i = 0; i < attempts; i++) {
        try {
            const r = await fetch(url, { method: 'GET' });
            if (r.ok) return true;
        } catch (e) {
            // ignore
        }
        await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
}

async function run() {
    await resetDb();
    // start the server programmatically via helper
    const app = await startTestServer(PORT);
    const base = `http://localhost:${PORT}`;
    const up = await waitForServer(base + '/');
    assert(up, 'server did not start in time');

    // Create a product via the server so the DB is written by the server process
    const uniqueSku = `INT-${Date.now()}-${process.pid}`;
    const createResp = await fetch(`${base}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ name: 'IT-INT', sku: uniqueSku, quantity: '1' })
    });
    if (!createResp.ok) {
        const b = await createResp.text();
        assert(false, `product creation failed: ${createResp.status} ${b}`);
    }

    // Fetch products list and pick the first product id
    const listResp = await fetch(`${base}/products`, { method: 'GET' });
    const listTxt = await listResp.text();
    const m = listTxt.match(/<li[^>]*data-id="(\d+)"/);
    assert(m && m[1], 'could not find created product id in list');
    const pid = Number(m[1]);

    // Post an outbound transaction that exceeds on-hand to force reservation path
    const txResp = await fetch(`${base}/products/${pid}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ delta: '-5', note: 'integration test' })
    });

    const txt = await txResp.text();
    assert(txResp.ok, 'transaction POST failed');
    assert(txt.includes('data-message'), 'response fragment missing data-message');
    assert(txt.includes(`data-message-id="${pid}"`), 'response fragment missing correct data-message-id');
    console.log('Integration fragment test passed');

    // stop the server cleanly
    await stopTestServer(app);
}

if (import.meta.main) await run();
