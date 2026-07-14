// Creates (or promotes) an admin account.
// Run against whatever database DATABASE_URL points at:
//   node scripts/create-admin.js you@example.com "a-strong-password"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <password>');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  const hash = await bcrypt.hash(password, 10);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    await pool.query('UPDATE users SET password_hash = $1, is_admin = true WHERE email = $2', [hash, email]);
    console.log(`Promoted existing user ${email} to admin and reset their password.`);
  } else {
    await pool.query(
      'INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, true)',
      [email, hash]
    );
    console.log(`Created admin account: ${email}`);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
