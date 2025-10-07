export function validateTransaction(fd) {
    const deltaRaw = fd.get('delta');
    if (deltaRaw == null) return { ok: false, status: 400, msg: 'Missing delta' };
    const delta = Number(deltaRaw);
    if (Number.isNaN(delta)) return { ok: false, status: 400, msg: 'Invalid delta' };
    const note = fd.get('note') || null;
    return { ok: true, value: { delta, note } };
}

export function validateReserve(fd) {
    const qtyRaw = fd.get('qty_requested') || fd.get('qty');
    if (qtyRaw == null) return { ok: false, status: 400, msg: 'Missing qty' };
    const qty = Number(qtyRaw);
    if (!qty || qty <= 0) return { ok: false, status: 400, msg: 'Bad qty' };
    const note = fd.get('note') || null;
    return { ok: true, value: { qty, note } };
}
