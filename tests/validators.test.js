import { validateTransactionForm, validateReserveForm, validateCreateProductForm } from '../src/validators/inputs.js';

function fdFrom(obj) {
    const map = new Map(Object.entries(obj));
    return { get: (k) => map.has(k) ? map.get(k) : null };
}

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(2); } }

function runUnitTests() {
    // transaction
    let v = validateTransactionForm(fdFrom({ delta: '5', note: 'ok' }));
    assert(v.ok && v.value.delta === 5, 'transaction parse 5');
    v = validateTransactionForm(fdFrom({ delta: 'x' }));
    assert(!v.ok, 'transaction invalid delta');

    // reserve
    v = validateReserveForm(fdFrom({ qty_requested: '3' }));
    assert(v.ok && v.value.qty === 3, 'reserve parse 3');
    v = validateReserveForm(fdFrom({}));
    assert(!v.ok, 'reserve missing qty');

    // create product
    v = validateCreateProductForm(fdFrom({ name: 'P', sku: 'S', quantity: '2' }));
    assert(v.ok && v.value.quantity === 2, 'create product parse');
    v = validateCreateProductForm(fdFrom({ sku: 'S' }));
    assert(!v.ok, 'create product missing name');

    console.log('Validator unit tests passed');
}

if (import.meta.main) runUnitTests();
