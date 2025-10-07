import { test } from 'bun:test';
import { startTestServer, stopTestServer } from './test-server.js';
import { resetDb } from './_utils.js';
import { db } from '../src/db/db.js';

test('mixed concurrent inbound and outbound transactions maintain invariants', async () => {
    await resetDb();

    const app = await startTestServer(3041);
    try {
        // create product with qty 3
        const uniqueSku = `MIX-${Date.now()}-${process.pid}`;
        const createRes = await fetch('http://localhost:3041/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ name: 'Mix Gadget', sku: uniqueSku, quantity: '3' }),
        });
        if (!createRes.ok) {
            const badBody = await createRes.text();
            throw new Error(`failed to create product: ${createRes.status} ${badBody}`);
        }
        const createHtml = await createRes.text();
        const idMatch = createHtml.match(/data-id="(\d+)"/);
        if (!idMatch) throw new Error('product id not found in create response');
        const productId = idMatch[1];

        // prepare jobs: 10 outbound (-1) and 6 inbound (+1) interleaved
        const outbound = 10;
        const inbound = 6;
        const jobs = [];

        for (let i = 0; i < Math.max(outbound, inbound); i++) {
            if (i < outbound) {
                jobs.push(fetch(`http://localhost:3041/products/${productId}/transactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ delta: '-1', note: `out-${i}` }),
                }).then(r => r.text()));
            }
            if (i < inbound) {
                jobs.push(fetch(`http://localhost:3041/products/${productId}/transactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ delta: '1', note: `in-${i}` }),
                }).then(r => r.text()));
            }
        }

        // shuffle to increase concurrency randomness
        for (let i = jobs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [jobs[i], jobs[j]] = [jobs[j], jobs[i]];
        }

        const results = await Promise.all(jobs);
        if (results.length !== outbound + inbound) throw new Error('not all mixed requests completed');

        // Now assert invariants in DB
        const pid = Number(productId);
        const pRow = db.query(`SELECT quantity FROM products WHERE id = ${pid}`).get();
        const finalQty = Array.isArray(pRow) ? pRow[0] : pRow?.quantity;
        if (finalQty == null) throw new Error('product row missing in DB');
        if (Number(finalQty) < 0) throw new Error(`final quantity negative in DB: ${finalQty}`);

        // Compute expected applied transactions count: any outbound beyond current available at time may become reservations
        // We can't deterministically know the ordering, but invariants:
        // finalQty = initial(3) + inboundApplied - outboundApplied
        // totalApplied = outboundApplied + inboundApplied = number of rows in stock_transactions

        const txRow = db.query(`SELECT COUNT(*) as c, SUM(delta) as s FROM stock_transactions WHERE product_id = ${pid}`).get();
        const txCount = Array.isArray(txRow) ? txRow[0] : (txRow && (txRow.c || txRow['COUNT(*)'])) || 0;
        const txSum = Array.isArray(txRow) ? txRow[0]?.s : txRow?.s;

        // pending reservations
        const rRow = db.query(`SELECT COUNT(*) as c FROM stock_reservations WHERE product_id = ${pid} AND fulfilled = 0`).get();
        const pendingReservations = Array.isArray(rRow) ? rRow[0] : (rRow && (rRow.c || rRow['COUNT(*)'])) || 0;

        // Sanity checks: total rows + pending reservations should equal number of attempted outbounds + inbounds
        const totalAttempts = outbound + inbound;
        const appliedPlusPending = Number(txCount) + Number(pendingReservations);
        if (appliedPlusPending !== totalAttempts) {
            throw new Error(`applied+pending (${appliedPlusPending}) != attempts (${totalAttempts})`);
        }

        // finalQty should equal initial + sum(delta applied)
        const initial = 3;
        const numericSum = Number(txSum) || 0;
        if (Number(finalQty) !== initial + numericSum) {
            throw new Error(`finalQty mismatch: got ${finalQty}, want ${initial + numericSum} (sum deltas=${numericSum})`);
        }
    } finally {
        await stopTestServer(app);
    }
});
