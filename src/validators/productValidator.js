import { db } from '../db/db.js';

export function validateCreateProductPayload(fd) {
    const name = fd.get('name');
    const sku = fd.get('sku');
    const qty = Number(fd.get('quantity') || 0);
    if (!name || !sku) return { ok: false, status: 400, msg: 'Missing name or sku' };
    if (Number.isNaN(qty)) return { ok: false, status: 400, msg: 'Invalid quantity' };
    return { ok: true, value: { name, sku, quantity: qty } };
}

export function checkSkuUnique(sku) {
    const row = db.query('SELECT id FROM products WHERE sku = ?', [sku]).get();
    return !row;
}
