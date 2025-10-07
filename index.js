import { serve } from "bun";
import fs from "fs";
import path from "path";
import Database from "bun:sqlite";
import { applyMigrations } from './src/db/migrate.js';
import { createProduct, listProducts, getProductById } from './src/models/product.js';
import { validateTransactionForm, validateReserveForm, validateCreateProductForm } from './src/validators/inputs.js';
import { validateCreateProductPayload, checkSkuUnique } from './src/validators/productValidator.js';
import { createReservation } from './src/models/stockReservation.js';
import { changeQuantityAtomic } from './src/models/product.js';
import { allocateReservationsForProduct } from './src/services/reservationAllocator.js';

const __dirname = new URL('.', import.meta.url).pathname;
// Use the shared DB (from src/db/db.js) so tests and server operate on the same file
import { db as sharedDb, DB_PATH } from './src/db/db.js';
const db = sharedDb;
// Ensure todos table exists (migrations may have created DB without this demo table)
try { db.exec(`CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);`); } catch (e) { /* ignore */ }

// Ensure migrations applied for products schema when server starts
try { applyMigrations(); } catch (e) { console.warn('Migration error', e); }

// --- Lightweight demo hardening: rate-limiter and optional basic auth for debug endpoints
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 300); // requests per window per client
const _rateMap = new Map(); // clientKey -> { count, resetAt }

function clientKeyForRequest(req) {
    // Prefer x-user-id when present (used in tests), otherwise fallback to IP-ish header or "anon"
    return req.headers.get('x-user-id') || req.headers.get('x-forwarded-for') || 'anon';
}

function checkRateLimit(req) {
    const key = clientKeyForRequest(req);
    const now = Date.now();
    const s = _rateMap.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    if (now > s.resetAt) { s.count = 0; s.resetAt = now + RATE_LIMIT_WINDOW_MS; }
    s.count += 1;
    _rateMap.set(key, s);
    return s.count <= RATE_LIMIT_MAX;
}

function checkBasicAuth(req) {
    const user = process.env.BASIC_AUTH_USERNAME;
    const pass = process.env.BASIC_AUTH_PASSWORD;
    if (!user || !pass) return true; // not enabled
    const auth = req.headers.get('authorization');
    if (!auth) return false;
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Basic') return false;
    try {
        const decoded = atob(parts[1]);
        const [u, p] = decoded.split(':');
        return u === user && p === pass;
    } catch (e) { return false; }
}

function renderListItems() {
    let rows = [];
    try {
        rows = db.query("SELECT id, title, done FROM todos ORDER BY id DESC").all();
    } catch (e) {
        // table may not exist yet in a fresh/test DB; return empty list gracefully
        rows = [];
    }
    return rows.map(r => {
        const id = Array.isArray(r) ? r[0] : r?.id;
        const title = Array.isArray(r) ? r[1] : r?.title;
        const done = Array.isArray(r) ? r[2] : r?.done;
        return `\n    <li hx-swap-oob=\"true\" data-id=\"${id}\" class=\"todo-item\">\n      <input type=\"checkbox\" hx-post=\"/toggle/${id}\" hx-swap=\"outerHTML\" ${done ? 'checked' : ''}/>\n      <span class=\"${done ? 'done' : ''}\">${escapeHtml(title)}</span>\n      <button hx-delete=\"/delete/${id}\" hx-target=\"closest li\" hx-swap=\"outerHTML\">Delete</button>\n    </li>`;
    }).join('');
}

function renderProductsList() {
    const rows = listProducts({ limit: 100 });
    return rows.map(r => `\n    <li data-id="${r.id}" class="product-row">\n      <strong>${escapeHtml(r.name)}</strong> <small>(${escapeHtml(r.sku)})</small> — qty: ${r.quantity}\n      <form hx-post="/products/${r.id}/transactions" hx-target="#products-list" hx-swap="outerHTML" hx-indicator="#spinner-tx-${r.id}" hx-disabled-elt="this">\n        <input name="delta" placeholder="+/- qty" size="4" />\n        <input name="note" placeholder="note" size="12" />\n        <button type="submit" class="btn">Apply <span id="spinner-tx-${r.id}" class="btn-spinner" aria-hidden="true"></span></button>\n      </form>\n      <form hx-post="/products/${r.id}/reserve" hx-target="#products-list" hx-swap="outerHTML" hx-indicator="#spinner-res-${r.id}" hx-disabled-elt="this">\n        <input name="qty_requested" placeholder="reserve" size="4" />\n        <input name="note" placeholder="note" size="12" />\n        <button type="submit" class="btn">Reserve <span id="spinner-res-${r.id}" class="btn-spinner" aria-hidden="true"></span></button>\n      </form>\n      <div class="item-message" id="msg-${r.id}" aria-live="polite"></div>\n    </li>`).join('');
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[c]); }

let _serverInstance = null;

export function startServer(port = Number(process.env.PORT || 3000)) {
    if (_serverInstance) return _serverInstance;
    _serverInstance = serve({
        port,
        async fetch(req) {
            const url = new URL(req.url);
            // lightweight request logging for debug
            try { console.log('[req]', req.method, url.pathname); } catch (e) { }
            // Temporary debug endpoint to inspect what the server sees for a request.
            if (url.pathname === '/__inspect') {
                const headers = {};
                for (const [k, v] of req.headers) { if (['host', 'content-type', 'user-agent', 'x-user-id'].includes(k)) headers[k] = v; }
                const body = JSON.stringify({ method: req.method, pathname: url.pathname, href: url.href, headers }, null, 2);
                return new Response(body, { headers: { 'Content-Type': 'application/json' } });
            }
            if (url.pathname === '/') {
                let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
                const listHtml = `<ul id=\"todos\">${renderListItems()}</ul>`;
                html = html.replace('<!-- TODOS_MARKER -->', listHtml);
                const productsHtml = `<ul id=\"products-list\">${renderProductsList()}</ul>`;
                html = html.replace('<!-- PRODUCTS_MARKER -->', productsHtml);
                return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }

            if (url.pathname === '/style.css') {
                const css = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8');
                return new Response(css, { headers: { 'Content-Type': 'text/css' } });
            }
            if (url.pathname === '/app.js') {
                try {
                    const js = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
                    return new Response(js, { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
                } catch (e) {
                    return new Response('Not Found', { status: 404 });
                }
            }

            if (url.pathname === '/debug') {
                const rows = [...db.query('SELECT id, title, done FROM todos')];
                return new Response(JSON.stringify(rows, null, 2), { headers: { 'Content-Type': 'application/json' } });
            }

            if (url.pathname === '/__dbinfo') {
                try {
                    const mod = await import('./src/db/db.js');
                    const info = { cwd: process.cwd(), dbPath: mod.DB_PATH ? mod.DB_PATH : 'unknown', sampleProducts: [] };
                    try {
                        const ps = mod.db.query('SELECT id, name, sku, quantity FROM products ORDER BY id').all();
                        info.sampleProducts = ps;
                    } catch (e) { info.sampleProducts = `error: ${String(e.message)}` }
                    return new Response(JSON.stringify(info, null, 2), { headers: { 'Content-Type': 'application/json' } });
                } catch (e) {
                    return new Response(JSON.stringify({ error: String(e.message) }, null, 2), { headers: { 'Content-Type': 'application/json' } });
                }
            }

            // Diagnostic helper: test route regexes against a supplied path query param
            if (url.pathname === '/__diag') {
                const q = url.searchParams.get('path') || url.searchParams.get('p') || '';
                const tests = {
                    path: q,
                    txMatch: !!q.match(/^\/products\/([^/]+)\/transactions\/?$/),
                    resMatch: !!q.match(/^\/products\/(\d+)\/reserve$/),
                    prodDebugMatch: !!q.match(/^\/products\/([^/]+)\/debug\/?$/)
                };
                return new Response(JSON.stringify(tests, null, 2), { headers: { 'Content-Type': 'application/json' } });
            }

            if (req.method === 'POST' && url.pathname === '/add') {
                return req.formData().then(fd => {
                    const title = fd.get('title');
                    if (!title) return new Response('Missing', { status: 400 });
                    db.run('INSERT INTO todos (title) VALUES (?)', title);
                    // Force a full page refresh so the main page reflects updated todos
                    return new Response('', { status: 204, headers: { 'HX-Refresh': 'true' } });
                });
            }

            if (req.method === 'GET' && url.pathname === '/products') {
                const body = `<ul id=\"products-list\">${renderProductsList()}</ul>`;
                return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }

            if (req.method === 'POST' && url.pathname === '/products') {
                return req.formData().then(fd => {
                    // Use new validator that returns parsed payload
                    const v = validateCreateProductPayload(fd);
                    if (!v.ok) return new Response(JSON.stringify({ error: v.msg }), { status: v.status, headers: { 'Content-Type': 'application/json' } });
                    // Check SKU uniqueness and return 409 if duplicate
                    if (!checkSkuUnique(v.value.sku)) {
                        return new Response(JSON.stringify({ error: 'SKU already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
                    }
                    try {
                        createProduct(v.value);
                    } catch (e) {
                        return new Response(JSON.stringify({ error: String(e.message) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                    }
                    const body = `<ul id="products-list" data-message="Product created">${renderProductsList()}</ul>`;
                    return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
                });
            }

            // debug: return product row for inspection
            const prodDebugMatch = url.pathname.match(/^\/products\/([^/]+)\/debug\/?$/);
            if (req.method === 'GET' && prodDebugMatch) {
                const id = Number(prodDebugMatch[1]);
                try {
                    const p = getProductById(id);
                    return new Response(JSON.stringify({ id: id, product: p }, null, 2), { headers: { 'Content-Type': 'application/json' } });
                } catch (e) {
                    return new Response(String(e.message), { status: 500 });
                }
            }

            // debug: list reservations for a product (JSON) - used by tests
            const resListMatch = url.pathname.match(/^\/products\/(\d+)\/reservations\/?$/);
            if (req.method === 'GET' && resListMatch) {
                const id = Number(resListMatch[1]);
                try {
                    const rows = db.query('SELECT id, qty_requested, fulfilled, requires_approval FROM stock_reservations WHERE product_id = ? ORDER BY id', [id]).all();
                    return new Response(JSON.stringify({ productId: id, reservations: rows }, null, 2), { headers: { 'Content-Type': 'application/json' } });
                } catch (e) {
                    return new Response(JSON.stringify({ error: String(e) }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
            }

            // transactions route: allow numeric or string ids and optional trailing slash
            const txMatch = url.pathname.match(/^\/products\/([^/]+)\/transactions\/?$/);
            if (req.method === 'POST' && txMatch) {
                try { console.log('[route] transactions hit, path=', url.pathname, 'id=', txMatch[1]); } catch (e) { }
                const id = Number(txMatch[1]);
                try {
                    const fd = await req.formData();
                    const v = validateTransactionForm(fd);
                    if (!v.ok) return new Response(JSON.stringify({ error: v.msg }), { status: v.status, headers: { 'Content-Type': 'application/json' } });
                    const { delta, note } = v.value;
                    const user = req.headers.get('x-user-id') || 'demo-user';
                    // Delegate quantity changes to the product model which will
                    // create reservations when outbound exceeds stock (inside a
                    // transaction) and will update quantities atomically.
                    const result = await changeQuantityAtomic(id, delta, user, note);
                    // If a reservation was created, inform the client via fragment
                    if (result && result.action === 'reservation_created') {
                        const body = `<ul id=\"products-list\" data-message=\"Reservation created for ${result.qty_requested}\" data-message-id=\"${id}\">${renderProductsList()}</ul>`;
                        return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
                    }
                    // after inbound (delta>0), attempt auto-allocation for pending reservations
                    if (delta > 0) {
                        try { await allocateReservationsForProduct(id, delta, user); } catch (e) { console.warn('Allocator error', e); }
                    }
                    const body = `<ul id=\"products-list\" data-message=\"Transaction applied (${delta})\" data-message-id=\"${id}\">${renderProductsList()}</ul>`;
                    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
                } catch (e) {
                    console.error('transaction error', e);
                    return new Response(String(e.message), { status: 500 });
                }
            }

            const resMatch = url.pathname.match(/^\/products\/(\d+)\/reserve$/);
            if (req.method === 'POST' && resMatch) {
                try { console.log('reserve route hit, id=', resMatch[1]); } catch (e) { }
                const id = Number(resMatch[1]);
                try {
                    const fd = await req.formData();
                    const v = validateReserveForm(fd);
                    if (!v.ok) return new Response(JSON.stringify({ error: v.msg }), { status: v.status, headers: { 'Content-Type': 'application/json' } });
                    const { qty, note } = v.value;
                    const user = req.headers.get('x-user-id') || 'demo-user';
                    // delegate requires_approval decision to model (threshold-based)
                    createReservation(id, qty, user, note);
                    const body = `<ul id=\"products-list\" data-message=\"Reservation created (${qty})\" data-message-id=\"${id}\">${renderProductsList()}</ul>`;
                    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
                } catch (e) {
                    return new Response(JSON.stringify({ error: String(e.message) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
            }

            const toggleMatch = url.pathname.match(/^\/toggle\/(\d+)$/);
            if (req.method === 'POST' && toggleMatch) {
                const id = Number(toggleMatch[1]);
                console.log('TOGGLE request for id=', id);
                const cur = db.query('SELECT done FROM todos WHERE id = ?', id).get();
                console.log('TOGGLE cur=', cur);
                if (!cur) return new Response('Not found', { status: 404 });
                const newv = cur[0] ? 0 : 1;
                db.run('UPDATE todos SET done = ? WHERE id = ?', newv, id);
                const row = db.query('SELECT id, title, done FROM todos WHERE id = ?', id).get();
                const rid = Array.isArray(row) ? row[0] : row?.id;
                const rtitle = Array.isArray(row) ? row[1] : row?.title;
                const rdone = Array.isArray(row) ? row[2] : row?.done;
                const li = `\n    <li data-id=\"${rid}\" class=\"todo-item\">\n      <input type=\"checkbox\" hx-post=\"/toggle/${rid}\" hx-swap=\"outerHTML\" ${rdone ? 'checked' : ''}/>\n      <span class=\"${rdone ? 'done' : ''}\">${escapeHtml(rtitle)}</span>\n      <button hx-delete=\"/delete/${rid}\" hx-target=\"closest li\" hx-swap=\"outerHTML\">Delete</button>\n    </li>`;
                return new Response(li, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }

            const deleteMatch = url.pathname.match(/^\/delete\/(\d+)$/);
            if (req.method === 'DELETE' && deleteMatch) {
                const id = Number(deleteMatch[1]);
                db.run('DELETE FROM todos WHERE id = ?', id);
                // Trigger full page refresh so the main list reflects deletion
                return new Response('', { status: 204, headers: { 'HX-Refresh': 'true' } });
            }

            return new Response('Not Found', { status: 404 });
        }
    });
    console.log(`Server running on http://localhost:${port}`);
    return _serverInstance;
}

export function stopServer() {
    try {
        if (_serverInstance && typeof _serverInstance.stop === 'function') {
            _serverInstance.stop();
            _serverInstance = null;
            return true;
        }
    } catch (e) { console.warn('stopServer error', e); }
    return false;
}

// If index.js is run directly, start the server using the env PORT.
if (import.meta.main) {
    startServer();
}
