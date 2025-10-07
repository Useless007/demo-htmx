import { Database } from 'bun:sqlite';
import path from 'path';
import { applyMigrations } from './migrate.js';

const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(process.cwd(), 'data', 'app.db');
// Ensure migrations have been applied for this DB path before opening connection
try { applyMigrations(DB_PATH); } catch (e) { /* continue even if migrations fail here */ }
const db = new Database(DB_PATH);
try {
    // Improve concurrency behavior for tests: use WAL and a short busy timeout
    try { db.exec('PRAGMA journal_mode = WAL;'); } catch (e) { /* ignore if unsupported */ }
    try { db.exec('PRAGMA busy_timeout = 5000;'); } catch (e) { /* ignore */ }
} catch (e) { /* ignore */ }

function withTransaction(fn) {
    try {
        db.exec('BEGIN');
        const res = fn(db);
        db.exec('COMMIT');
        return res;
    } catch (err) {
        try { db.exec('ROLLBACK'); } catch (e) { }
        throw err;
    }
}

export { db, withTransaction, DB_PATH };
