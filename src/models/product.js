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
        const newQty = curQty + delta;
        tx.run('INSERT INTO stock_transactions (product_id, delta, timestamp, user, note) VALUES (?, ?, ?, ?, ?)', [productId, delta, Date.now(), user, note]);
        tx.run('UPDATE products SET quantity = ? WHERE id = ?', [newQty, productId]);
        return { productId, newQty };
    });
}

export { createProduct, getProductById, listProducts, updateProduct, changeQuantityAtomic };
