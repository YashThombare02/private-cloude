import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const username = "admin";
  const password = "password123";
  const hashedPassword = await bcrypt.hash(password, 10);
  const storageLimit = 10 * 1024 * 1024 * 1024;

  try {
    const check = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (check.rows.length > 0) {
      console.log('Admin user already exists!');
      process.exit(0);
    }

    await pool.query(
      'INSERT INTO users (username, password, "isAdmin", "storageLimit") VALUES ($1, $2, $3, $4)',
      [username, hashedPassword, true, storageLimit]
    );

    console.log("========================================");
    console.log("Admin user successfully created!");
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log("========================================");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

seed();
