const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'taskforge',
  password: process.env.PGPASSWORD || 'taskforge',
  database: process.env.PGDATABASE || 'taskforge',
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = { pool };
