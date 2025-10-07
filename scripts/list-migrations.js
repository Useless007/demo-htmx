import { Database } from 'bun:sqlite';
const db = new Database('data/app.db');
console.log([...db.query('SELECT name, applied_at FROM migrations')]);
