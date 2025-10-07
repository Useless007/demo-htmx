import { db, withTransaction } from '../db/db.js';
import { applyMigrations } from '../db/migrate.js';

// ensure schema exists (safety for test workers that may import modules before
// an explicit migration step runs)
try { applyMigrations(); } catch (e) { /* ignore */ }

function createProduct({ name, sku, quantity = 0, location = null, low_stock_threshold = 5 }) {
    // safety: ensure migrations applied for this DB path
    try { applyMigrations(); } catch (e) { /* ignore */ }
    const now = Date.now();
    const res = db.run('INSERT INTO products (name, sku, quantity, location, low_stock_threshold) VALUES (?, ?, ?, ?, ?)', [name, sku, quantity, location, low_stock_threshold]);
    return { id: res.lastInsertRowid, name, sku, quantity, location, low_stock_threshold };
}

function getProductById(id) {
    // Some bun:sqlite bindings in this environment don't accept bound params the same way.
    // Safely interpolate numeric id after coercion to ensure the query returns rows.
    const nid = Number(id) || 0;
    return db.query(`SELECT * FROM products WHERE id = ${nid}`).get();
}

function listProducts({ q = null, limit = 50, offset = 0 } = {}) {
    if (q) {
        const like = `%${q.toLowerCase()}%`;
        // sqlite bindings may not accept LIMIT/OFFSET as bound params in all drivers; interpolate safely
        limit = Number(limit) || 50; offset = Number(offset) || 0;
        return db.query(`SELECT * FROM products WHERE lower(name) LIKE ? OR lower(sku) LIKE ? ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`, [like, like]).all();
    }
    limit = Number(limit) || 50; offset = Number(offset) || 0;
    return db.query(`SELECT * FROM products ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`).all();
}

function updateProduct(id, fields) {
    const sets = [];
    const vals = [];
    for (const k of ['name', 'sku', 'location', 'low_stock_threshold']) {
        if (k in fields) { sets.push(`${k} = ?`); vals.push(fields[k]); }
    }
    if (sets.length === 0) return getProductById(id);
    vals.push(id);
    db.run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, vals);
    return getProductById(id);
}

function changeQuantityAtomic(productId, delta, user, note = null) {
    // safety: ensure migrations applied for this DB path before transaction
    try { applyMigrations(); } catch (e) { /* ignore */ }
    return withTransaction((tx) => {
        const pid = Number(productId) || 0;
        const prodRow = tx.query(`SELECT quantity FROM products WHERE id = ${pid}`).get();
        if (!prodRow) throw new Error('NotFound');
        const curQty = Array.isArray(prodRow) ? prodRow[0] : prodRow.quantity;
        // Outbound (negative delta) exceeding current stock -> create reservation
        if (delta < 0 && (curQty + delta) < 0) {
            const shortfall = Math.abs(curQty + delta); // amount that would go below zero
            // Determine whether this reservation requires manual approval using AUTO_FULFILL_THRESHOLD
            const envThreshold = Number(process.env.AUTO_FULFILL_THRESHOLD || 5);
            const requiresApproval = shortfall > envThreshold ? 1 : 0;
            // Create a reservation for the shortfall and do not change on-hand quantity
            tx.run('INSERT INTO stock_reservations (product_id, qty_requested, timestamp, user, fulfilled, note, requires_approval) VALUES (?, ?, ?, ?, 0, ?, ?)', [productId, shortfall, Date.now(), user, note, requiresApproval]);
            const resRow = tx.query('SELECT last_insert_rowid() as id').get();
            const resId = Array.isArray(resRow) ? resRow[0] : resRow.id;
            try { console.log('[debug:changeQuantityAtomic] inserted reservation id=', resId, 'requiresApproval=', requiresApproval); } catch (e) { }
            try {
                const rows = tx.query('SELECT id, qty_requested, requires_approval FROM stock_reservations WHERE product_id = ? ORDER BY id', [productId]).all();
                try { console.log('[debug:changeQuantityAtomic] rows in tx =>', rows); } catch (e) { }
            } catch (e) { }
            return { productId, action: 'reservation_created', reservationId: resId, qty_requested: shortfall, requires_approval: requiresApproval };
        }

        // Otherwise safe to record transaction and update quantity
        const newQty = curQty + delta;
        tx.run('INSERT INTO stock_transactions (product_id, delta, timestamp, user, note) VALUES (?, ?, ?, ?, ?)', [productId, delta, Date.now(), user, note]);
        tx.run('UPDATE products SET quantity = ? WHERE id = ?', [newQty, productId]);
        return { productId, newQty };
    });
}

export { createProduct, getProductById, listProducts, updateProduct, changeQuantityAtomic };
