import { Database } from 'bun:sqlite';
import path from 'path';
import { applyMigrations } from './migrate.js';

// Keep track of opened DB per resolved path so tests can change process.env.DB_PATH
let _currentPath = null;
let _currentDb = null;

function resolveDbPath() {
    return process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(process.cwd(), 'data', 'app.db');
}

function openDbForPath(p) {
    // Ensure migrations applied for this path before opening
    try { applyMigrations(p); } catch (e) { /* ignore */ }
    const d = new Database(p);
    try { d.exec('PRAGMA journal_mode = WAL;'); } catch (e) { }
    try { d.exec('PRAGMA busy_timeout = 5000;'); } catch (e) { }
    return d;
}

function ensureDb() {
    const p = resolveDbPath();
    if (_currentPath !== p || !_currentDb) {
        try { if (_currentDb) _currentDb.close(); } catch (e) { }
        _currentDb = openDbForPath(p);
        _currentPath = p;
    }
    return _currentDb;
}

// Export a proxy that forwards operations to the current DB instance so existing
// imports using `db.run` etc continue to work even if the DB_PATH changes later.
const db = new Proxy({}, {
    get(_, prop) {
        const d = ensureDb();
        const val = d[prop];
        if (typeof val === 'function') return val.bind(d);
        return val;
    }
});

function withTransaction(fn) {
    const d = ensureDb();
    try {
        d.exec('BEGIN');
        const res = fn(d);
        d.exec('COMMIT');
        return res;
    } catch (err) {
        try { d.exec('ROLLBACK'); } catch (e) { }
        throw err;
    }
}

const DB_PATH = resolveDbPath();

export { db, withTransaction, DB_PATH };
