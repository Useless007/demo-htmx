export function validateTransactionForm(fd) {
    const deltaRaw = fd.get('delta');
    if (deltaRaw == null) return { ok: false, status: 400, msg: 'Missing delta' };
    const delta = Number(deltaRaw);
    if (Number.isNaN(delta)) return { ok: false, status: 400, msg: 'Invalid delta' };
    // optional note
    const note = fd.get('note') || null;
    return { ok: true, value: { delta, note } };
}

export function validateReserveForm(fd) {
    const qtyRaw = fd.get('qty_requested') || fd.get('qty');
    if (qtyRaw == null) return { ok: false, status: 400, msg: 'Missing qty' };
    const qty = Number(qtyRaw);
    if (!qty || qty <= 0) return { ok: false, status: 400, msg: 'Bad qty' };
    const note = fd.get('note') || null;
    return { ok: true, value: { qty, note } };
}

export function validateCreateProductForm(fd) {
    const name = fd.get('name');
    const sku = fd.get('sku');
    const qty = Number(fd.get('quantity') || 0);
    if (!name || !sku) return { ok: false, status: 400, msg: 'Missing name or sku' };
    if (Number.isNaN(qty)) return { ok: false, status: 400, msg: 'Invalid quantity' };
    return { ok: true, value: { name, sku, quantity: qty } };
}
