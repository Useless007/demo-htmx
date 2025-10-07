import { db } from '../db/db.js';

function createReservation(productId, qty_requested, user, note = null, requires_approval = 0) {
    const res = db.run('INSERT INTO stock_reservations (product_id, qty_requested, timestamp, user, fulfilled, note, requires_approval) VALUES (?, ?, ?, ?, 0, ?, ?)', [productId, qty_requested, Date.now(), user, note, requires_approval]);
    return { id: res.lastInsertRowid, productId, qty_requested, user, fulfilled: 0 };
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
