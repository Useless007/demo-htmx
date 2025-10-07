import { applyMigrations } from '../src/db/migrate.js';
import fs from 'fs';
import path from 'path';

const TEST_DB_DIR = path.resolve(process.cwd(), 'data');
const TEST_DB_PATH = path.join(TEST_DB_DIR, `test-app-${process.pid}.db`);

export async function resetDb() {
    // ensure data dir
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    // set env DB path for migrations and db module
    process.env.DB_PATH = TEST_DB_PATH;
    // remove DB file if exists
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    // import and run migrations after DB_PATH is set
    const mod = await import('../src/db/migrate.js');
    mod.applyMigrations();
}
