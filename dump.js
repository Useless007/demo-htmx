import Database from 'bun:sqlite';
const db = new Database('data/app.db');
for (const row of db.query('SELECT id, title, done FROM todos')) {
  console.log(row);
}
