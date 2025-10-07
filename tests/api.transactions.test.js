import { describe, it, expect, beforeEach } from 'bun:test';
import { resetDb } from './_utils.js';
import { startTestServer, stopTestServer } from './test-server.js';

describe('api transactions', () => {
    beforeEach(async () => {
        await resetDb();
    });

    it('creates reservation when outbound exceeds stock (via API)', async () => {
        const PORT = 3021;
        process.env.PORT = String(PORT);
        const app = await startTestServer(PORT);
        try {
            const base = `http://localhost:${PORT}`;
            const sku = `TX-${Date.now()}-${process.pid}`;
            const create = await fetch(`${base}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ name: 'TxProd', sku, quantity: '2' })
            });
            expect(create.ok).toBe(true);
            const html = await create.text();
            const idMatch = html.match(/data-id="(\d+)"/);
            expect(idMatch).toBeTruthy();
            const pid = idMatch[1];

            const tx = await fetch(`${base}/products/${pid}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ delta: '-5', note: 'api test' })
            });
            const txt = await tx.text();
            expect(tx.ok).toBe(true);
            expect(txt.includes('Reservation created')).toBe(true);
        } finally {
            await stopTestServer(app);
        }
    });
});

