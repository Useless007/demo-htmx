import { startServer, stopServer } from '../index.js';

async function run() {
    startServer(3020);
    // give server a moment
    await new Promise(r => setTimeout(r, 100));
    const res = await fetch('http://localhost:3020/products', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'DBG', sku: 'DBG-1', quantity: '1' }) });
    console.log('status', res.status);
    const txt = await res.text();
    console.log('body:', txt.slice(0, 400));
    stopServer();
}

if (import.meta.main) run();
