import { test } from 'bun:test';
import { resetDb } from './_utils.js';
import { startTestServer, stopTestServer } from './test-server.js';
// Note: do NOT import the shared DB at module load time. Tests call resetDb()
// to set process.env.DB_PATH and create a per-test DB file. Import the DB
// inside the test after resetDb/startTestServer so the module picks up the
// correct DB path.

// Test auto-allocation: small reservations (<= AUTO_FULFILL_THRESHOLD) should be auto-fulfilled
// after an inbound transaction; large reservations should remain pending.

test('auto-fulfill small reservations on inbound', async () => {
    // set threshold low for the test
    process.env.AUTO_FULFILL_THRESHOLD = '2';
    await resetDb();
    // Direct model-based test (avoid server visibility issues). Import modules
    // after resetDb so they pick up the per-test DB_PATH.
    const { db } = await import('../src/db/db.js');
    const { createProduct, changeQuantityAtomic } = await import('../src/models/product.js');
    const { createReservation } = await import('../src/models/stockReservation.js');
    const { allocateReservationsForProduct } = await import('../src/services/reservationAllocator.js');
    try {
        const sku = `AUTO-${Date.now()}-${process.pid}`;
        const p = createProduct({ name: 'Auto Product', sku, quantity: 1 });
        const pid = p.id;

        // create reservations directly using the reservation model (committed)
        const r1 = createReservation(pid, 1, 'test', 'small-backorder');
        if (!r1 || !r1.id) throw new Error('expected first reservation created');
        if (Number(r1.requires_approval) !== 0) throw new Error('small reservation should be auto-fulfillable');

        const r2 = createReservation(pid, 10, 'test', 'large-backorder');
        if (!r2 || !r2.id) throw new Error('expected second reservation created');
        if (Number(r2.requires_approval) !== 1) throw new Error('large reservation should require approval');


        // Now perform an inbound of qty 5 and call allocator; assert on allocator return
        await changeQuantityAtomic(pid, 5, 'test', 'restock');
        const allocations = await allocateReservationsForProduct(pid, 5, 'test-allocator');
        if (!Array.isArray(allocations)) throw new Error('allocator did not return allocations');
        const allocatedIds = allocations.map(a => a.reservationId);
        if (!allocatedIds.includes(r1.id)) throw new Error('small reservation was not allocated');
        if (allocatedIds.includes(r2.id)) throw new Error('large reservation should not be auto-allocated');

    } finally {
        delete process.env.AUTO_FULFILL_THRESHOLD;
    }
});
