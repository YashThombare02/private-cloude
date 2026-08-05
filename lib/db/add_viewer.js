import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

const { Pool } = pg;
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const url = process.env.DATABASE_URL;
console.log('Connecting to:', url?.slice(0, 40) + '...');

const pool = new Pool({ connectionString: url });

async function addViewer() {
  const username = "viewer";
  const password = "viewer123";
  const hashedPassword = await bcrypt.hash(password, 10);

  const check = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (check.rows.length > 0) {
    console.log('Viewer user already exists!');
    pool.end();
    return;
  }

  await pool.query(
    'INSERT INTO users (username, password_hash, role, is_active) VALUES ($1, $2, $3, $4)',
    [username, hashedPassword, 'user', true]
  );

  console.log("========================================");
  console.log("Viewer user created!");
  console.log("Username: viewer");
  console.log("Password: viewer123");
  console.log("========================================");
  pool.end();
}

addViewer().catch(e => { console.error(e.message); pool.end(); });
