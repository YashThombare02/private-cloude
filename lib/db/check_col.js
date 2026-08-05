import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

const { Pool } = pg;
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='files' ORDER BY ordinal_position");
console.log('DB columns:', r.rows.map(x => x.column_name).join(', '));

const r2 = await pool.query("SELECT id, original_filename, folder_name FROM files ORDER BY id DESC LIMIT 5");
console.log('Recent files:', r2.rows);

pool.end();
