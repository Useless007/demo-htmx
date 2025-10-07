import { test } from 'bun:test';
import { startTestServer, stopTestServer } from './test-server.js';
import { resetDb } from './_utils.js';
import { db } from '../src/db/db.js';

// Concurrency test: start server, create a product, then fire many concurrent outbound
// transactions to exercise allocator and reservations. Assert final invariants.

test('concurrent outbound transactions create reservations but do not double-decrement', async () => {
    await resetDb();

    const app = await startTestServer(3035);
    try {
        // create product with qty 5
        const uniqueSku = `CG-${Date.now()}-${process.pid}`;
        const createRes = await fetch('http://localhost:3035/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ name: 'Concurrent Gadget', sku: uniqueSku, quantity: '5' }),
        });
        if (!createRes.ok) {
            const badBody = await createRes.text();
            throw new Error(`failed to create product: ${createRes.status} ${badBody}`);
        }
        const createHtml = await createRes.text();
        // extract product id from the products list by finding data-id attr on li
        const idMatch = createHtml.match(/data-id="(\d+)"/);
        if (!idMatch) throw new Error('product id not found in create response');
        const productId = idMatch[1];

        const attempts = 20;
        // fire many concurrent outbound transactions (delta = -1)
        const jobs = [];
        for (let i = 0; i < attempts; i++) {
            jobs.push(
                fetch(`http://localhost:3035/products/${productId}/transactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ delta: '-1', note: `bulk-${i}` }),
                }).then(res => res.text())
            );
        }

        const results = await Promise.all(jobs);
        // ensure we got HTML fragments back for each
        if (results.length !== attempts) throw new Error('not all requests completed');

        // count how many responses reported reservations (supplemental)
        const reservationResponses = results.filter(r => r.includes('Reservation created') || r.includes('Reservation created for')).length;

        // expected reserved is max(0, attempts - initialQty)
        const expectedReserved = Math.max(0, attempts - 5);
        if (reservationResponses !== expectedReserved) {
            throw new Error(`reservation response mismatch: got ${reservationResponses}, want ${expectedReserved}`);
        }

        // Now assert DB state directly (more robust than parsing HTML)
        const pid = Number(productId);
        // product quantity
        const pRow = db.query(`SELECT quantity FROM products WHERE id = ${pid}`).get();
        const finalQty = Array.isArray(pRow) ? pRow[0] : pRow?.quantity;
        if (finalQty == null) throw new Error('product row missing in DB');
        if (Number(finalQty) < 0) throw new Error(`final quantity negative in DB: ${finalQty}`);

        // pending reservations (fulfilled = 0 means pending)
        const rRow = db.query(`SELECT COUNT(*) as c FROM stock_reservations WHERE product_id = ${pid} AND fulfilled = 0`).get();
        const pendingReservations = Array.isArray(rRow) ? rRow[0] : (rRow && (rRow.c || rRow['COUNT(*)'])) || 0;
        if (Number(pendingReservations) !== expectedReserved) {
            throw new Error(`pending reservations mismatch in DB: got ${pendingReservations}, want ${expectedReserved}`);
        }

        // transactions applied (only applied transactions create rows in stock_transactions)
        const tRow = db.query(`SELECT COUNT(*) as c FROM stock_transactions WHERE product_id = ${pid}`).get();
        const txCount = Array.isArray(tRow) ? tRow[0] : (tRow && (tRow.c || tRow['COUNT(*)'])) || 0;
        const expectedTx = attempts - expectedReserved;
        if (Number(txCount) !== expectedTx) {
            throw new Error(`transactions count mismatch in DB: got ${txCount}, want ${expectedTx}`);
        }
    } finally {
        await stopTestServer(app);
    }
});
