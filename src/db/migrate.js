import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src', 'db', 'migrations');

function ensureDataDir(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadMigrations() {
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort()
        .map(f => ({ name: f, path: path.join(MIGRATIONS_DIR, f), sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8') }));
}

function applyMigrations(dbPath = (process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(process.cwd(), 'data', 'app.db'))) {
    ensureDataDir(dbPath);
    const db = new Database(dbPath);
    const migrations = loadMigrations();

    db.exec('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at INTEGER NOT NULL)');

    for (const m of migrations) {
        const row = db.query('SELECT name FROM migrations WHERE name = ?', [m.name]).get();
        if (!row) {
            console.log('Applying migration', m.name);
            db.exec(m.sql);
            // use INSERT OR IGNORE to avoid unique constraint failures under concurrent runs
            db.run('INSERT OR IGNORE INTO migrations (name, applied_at) VALUES (?, ?)', [m.name, Date.now()]);
        } else {
            console.log('Skipping already applied migration', m.name);
        }
    }

    db.close();
}

if (import.meta.main) {
    applyMigrations();
}

export { applyMigrations };
