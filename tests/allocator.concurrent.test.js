import { test } from 'bun:test';
import { resetDb } from './_utils.js';

// This test runs under Bun's concurrent mode to exercise potential DB visibility/race conditions.
// It mirrors the single-threaded allocator test but is intended to be run together with other tests.

test('concurrent: allocator auto-fulfill small reservations on inbound', async () => {
    process.env.AUTO_FULFILL_THRESHOLD = '2';
    await resetDb();
    const { createProduct, changeQuantityAtomic } = await import('../src/models/product.js');
    const { createReservation, listPendingReservations } = await import('../src/models/stockReservation.js');
    const { allocateReservationsForProduct } = await import('../src/services/reservationAllocator.js');
    const { db, DB_PATH } = await import('../src/db/db.js');

    const sku = `CONCURRENT-${Date.now()}-${process.pid}`;
    const p = createProduct({ name: 'Concurrent Product', sku, quantity: 1 });
    const pid = p.id;

    const r1 = createReservation(pid, 1, 'test', 'small-backorder');
    const r2 = createReservation(pid, 10, 'test', 'large-backorder');

    // debug: list pending reservations now
    console.log('[debug:concurrent-test] pid value/type:', pid, typeof pid);
    console.log('[debug:concurrent-test] pending before restock (model):', listPendingReservations(pid));
    try { console.log('[debug:concurrent-test] stock_reservations table:', db.query('SELECT * FROM stock_reservations').all()); } catch (e) { console.log('db query error', e); }
    try { console.log('[debug:concurrent-test] products table:', db.query('SELECT * FROM products').all()); } catch (e) { console.log('db query error', e); }
    console.log('[debug:concurrent-test] DB_PATH=', DB_PATH);

    try { const cnt = db.query('SELECT COUNT(*) as c FROM stock_reservations WHERE product_id = ?', [pid]).get(); console.log('[debug:concurrent-test] count by param:', cnt); } catch (e) { console.log('count query error', e); }
    try { const rows = db.query('SELECT product_id FROM stock_reservations').all(); console.log('[debug:concurrent-test] all product_id values:', rows); } catch (e) { console.log('rows query error', e); }

    await changeQuantityAtomic(pid, 5, 'test', 'restock');

    // debug: list pending reservations after restock
    console.log('[debug:concurrent-test] pending after restock (model):', listPendingReservations(pid));
    try { console.log('[debug:concurrent-test] stock_reservations table after restock:', db.query('SELECT * FROM stock_reservations').all()); } catch (e) { console.log('db query error', e); }
    try { const cnt2 = db.query('SELECT COUNT(*) as c FROM stock_reservations WHERE product_id = ?', [pid]).get(); console.log('[debug:concurrent-test] count by param after restock:', cnt2); } catch (e) { console.log('count2 query error', e); }

    const allocations = await allocateReservationsForProduct(pid, 5, 'concurrent-allocator');
    console.log('[debug:concurrent-test] allocations:', allocations);

    if (!Array.isArray(allocations)) throw new Error('allocator did not return allocations');
    const allocatedIds = allocations.map(a => a.reservationId || a.id);
    if (!allocatedIds.includes(r1.id)) throw new Error('small reservation was not allocated');
    if (allocatedIds.includes(r2.id)) throw new Error('large reservation should not be auto-allocated');

    delete process.env.AUTO_FULFILL_THRESHOLD;
});
