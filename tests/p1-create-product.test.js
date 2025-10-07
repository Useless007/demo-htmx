import { resetDb } from './_utils.js';

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(2); } }

async function run() {
    await resetDb();
    const mod = await import('../src/models/product.js');
    const { createProduct, listProducts } = mod;
    const p = createProduct({ name: 'S1', sku: 'SKU1', quantity: 10 });
    const all = listProducts({ limit: 10 });
    const found = all.find(x => x.sku === 'SKU1');
    assert(found, 'Created product must appear in list');
    assert(found.quantity === 10, 'Quantity should be 10');
    console.log('P1 acceptance test passed');
}

if (import.meta.main) await run();
