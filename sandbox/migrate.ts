// TEMPORARY: applies sandbox/yao-schema.sql. Usage: npm run db:migrate
import { readFileSync } from 'node:fs';
import { pool } from './db.js';

const sql = readFileSync(new URL('./yao-schema.sql', import.meta.url), 'utf8');
const client = await pool.connect();
client.on('notice', (n) => console.log('notice:', n.message));
try {
  await client.query(sql);
  console.log('schema applied');
} finally {
  client.release();
  await pool.end();
}
