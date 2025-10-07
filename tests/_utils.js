import { applyMigrations } from '../src/db/migrate.js';
import fs from 'fs';
import path from 'path';

const TEST_DB_DIR = path.resolve(process.cwd(), 'data');
// Use a unique DB filename per reset to avoid collisions when tests run in parallel
function makeTestDbPath() {
    return path.join(TEST_DB_DIR, `test-app-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

export async function resetDb() {
    // ensure data dir
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    // set env DB path for migrations and db module (unique per invocation)
    process.env.DB_PATH = makeTestDbPath();
    // remove DB file if exists
    if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);
    // import and run migrations after DB_PATH is set
    const mod = await import('../src/db/migrate.js');
    mod.applyMigrations();
}
