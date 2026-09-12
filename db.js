const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL .env faylida o'rnatilmagan. Supabase loyihangizning Postgres " +
    "ulanish satrini (Connection string, tavsiyan 'Transaction pooler' varianti) qo'ying."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3, // serverless muhitida (Vercel) ulanishlar sonini kam ushlab turish muhim
});

module.exports = pool;
