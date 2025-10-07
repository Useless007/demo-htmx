import { withTransaction } from '../db/db.js';

/**
 * Allocate availableQty to pending reservations for productId (FIFO).
 * Skips reservations where requires_approval = 1.
 * Creates outbound stock_transactions (negative delta) and marks reservations fulfilled.
 * All operations run inside a single DB transaction for consistency.
 * Returns an array of allocations: { reservationId, allocated }
 */
function allocateReservationsForProduct(productId, availableQty, actor = 'system-allocator') {
    return withTransaction((tx) => {
        const allocations = [];
        if (!availableQty || availableQty <= 0) return allocations;

        // fetch pending reservations FIFO
        const rows = tx.query('SELECT id, qty_requested, requires_approval FROM stock_reservations WHERE product_id = ? AND fulfilled = 0 ORDER BY id', [productId]).all();
        let remaining = Number(availableQty);
        for (const r of rows) {
            const res = Array.isArray(r) ? { id: r[0], qty_requested: r[1], requires_approval: r[2] } : r;
            if (res.requires_approval) continue; // skip reservations that need manual approval
            if (remaining <= 0) break;
            const toAlloc = Math.min(res.qty_requested, remaining);

            // create outbound transaction (negative delta) to represent allocation
            tx.run('INSERT INTO stock_transactions (product_id, delta, timestamp, user, note) VALUES (?, ?, ?, ?, ?)', [productId, -toAlloc, Date.now(), actor, `auto-allocated reservation ${res.id}`]);

            // mark reservation fulfilled
            tx.run('UPDATE stock_reservations SET fulfilled = 1, fulfilled_at = ? WHERE id = ?', [Date.now(), res.id]);

            // decrement on-hand quantity to reflect allocation (note: inbound already increased before allocator runs)
            tx.run('UPDATE products SET quantity = quantity - ? WHERE id = ?', [toAlloc, productId]);

            allocations.push({ reservationId: res.id, allocated: toAlloc });
            remaining -= toAlloc;
        }

        return allocations;
    });
}

export { allocateReservationsForProduct };
export default { allocateReservationsForProduct };
