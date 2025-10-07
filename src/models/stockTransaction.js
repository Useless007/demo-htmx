import { db } from '../db/db.js';

function recordTransaction(productId, delta, user, note = null) {
    const res = db.run('INSERT INTO stock_transactions (product_id, delta, timestamp, user, note) VALUES (?, ?, ?, ?, ?)', [productId, delta, Date.now(), user, note]);
    return { id: res.lastInsertRowid, productId, delta, user, note };
}

export { recordTransaction };
