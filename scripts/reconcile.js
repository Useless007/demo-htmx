#!/usr/bin/env node
import Database from 'bun:sqlite';
import fs from 'fs';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;
const DB_FILE = path.join(__dirname, '..', 'data', 'app.db');
const db = new Database(DB_FILE);

function computeBalances() {
    const prods = [...db.query('SELECT id, sku, name, quantity FROM products')].map(r => ({ id: r[0], sku: r[1], name: r[2], quantity: r[3] }));
    const txs = [...db.query('SELECT product_id, delta FROM stock_transactions ORDER BY id ASC')].map(r => ({ pid: r[0], delta: r[1] }));
    const byProd = Object.fromEntries(prods.map(p => [p.id, { expected: p.quantity, computed: 0, sku: p.sku, name: p.name }]));
    for (const t of txs) {
        if (!byProd[t.pid]) byProd[t.pid] = { expected: 0, computed: 0 };
        byProd[t.pid].computed += t.delta;
    }
    return byProd;
}

function main() {
    if (!fs.existsSync(DB_FILE)) {
        console.error('DB not found at', DB_FILE);
        process.exit(2);
    }
    const res = computeBalances();
    let ok = true;
    for (const [id, info] of Object.entries(res)) {
        if (info.expected !== info.computed) {
            console.log(`MISMATCH product=${id} sku=${info.sku} name=${info.name} expected=${info.expected} computed=${info.computed}`);
            ok = false;
        } else {
            console.log(`OK product=${id} sku=${info.sku} name=${info.name} qty=${info.expected}`);
        }
    }
    process.exit(ok ? 0 : 3);
}

main();
