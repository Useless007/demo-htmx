import { db, DB_PATH, withTransaction } from '../db/db.js';

/**
 * Create a stock reservation for a product.
 *
 * Returns an object with the following shape:
 * {
 *   id: number,             // newly created reservation id (last_insert_rowid)
 *   productId: number,      // product id the reservation belongs to
 *   qty_requested: number,  // quantity requested
 *   user: string,           // user who created the reservation
 *   fulfilled: 0,           // 0 if pending
 *   requires_approval: 0|1  // whether manual approval is required
 * }
 */
function createReservation(productId, qty_requested, user, note = null, requires_approval = undefined) {
    // If caller didn't specify requires_approval, compute it based on AUTO_FULFILL_THRESHOLD
    if (requires_approval === undefined) {
        const envThreshold = Number(process.env.AUTO_FULFILL_THRESHOLD || 5);
        requires_approval = qty_requested > envThreshold ? 1 : 0;
    }
    // Use a transaction so the insert and any subsequent reads use the same
    // connection and are immediately visible to other queries on that
    // connection. This also ensures the insert is committed before returning.
    const out = withTransaction((tx) => {
        const r = tx.run('INSERT INTO stock_reservations (product_id, qty_requested, timestamp, user, fulfilled, note, requires_approval) VALUES (?, ?, ?, ?, 0, ?, ?)', [productId, qty_requested, Date.now(), user, note, requires_approval]);
        const lidRow = tx.query('SELECT last_insert_rowid() as id').get();
        const lid = Array.isArray(lidRow) ? lidRow[0] : lidRow?.id;
        return { id: lid, productId, qty_requested, user, fulfilled: 0, requires_approval };
    });
    return out;
}

function listPendingReservations(productId = null) {
    if (productId) return db.query('SELECT * FROM stock_reservations WHERE product_id = ? AND fulfilled = 0 ORDER BY id', [productId]).all();
    return db.query('SELECT * FROM stock_reservations WHERE fulfilled = 0 ORDER BY id').all();
}

function markFulfilled(reservationId) {
    db.run('UPDATE stock_reservations SET fulfilled = 1, fulfilled_at = ? WHERE id = ?', [Date.now(), reservationId]);
    return db.query('SELECT * FROM stock_reservations WHERE id = ?', [reservationId]).get();
}

export { createReservation, listPendingReservations, markFulfilled };
