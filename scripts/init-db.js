// Foydalanish: npm run init-db
// Bu skript Supabase (yoki istalgan Postgres) bazasida kerakli jadvallarni yaratadi.
// Faqat BIR MARTA, sozlashda ishga tushirilishi kifoya (qayta ishga tushirsangiz ham
// zarar yo'q — "IF NOT EXISTS" tufayli mavjud jadvallarga tegmaydi).
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error("Xato: .env faylida DATABASE_URL topilmadi.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until BIGINT NOT NULL DEFAULT 0,

  fullname TEXT DEFAULT '',
  birthdate TEXT DEFAULT '',
  group_name TEXT DEFAULT '',
  nationality TEXT DEFAULT '',
  languages TEXT DEFAULT '',
  school TEXT DEFAULT '',
  privilege TEXT DEFAULT '',
  email TEXT DEFAULT '',
  telegram TEXT DEFAULT '',
  permaddr TEXT DEFAULT '',
  current_type TEXT DEFAULT '',
  ijara_addr TEXT DEFAULT '',
  ijara_owner TEXT DEFAULT '',
  ijara_owner_phone TEXT DEFAULT '',
  ttj_room TEXT DEFAULT '',
  father_name TEXT DEFAULT '',
  father_job TEXT DEFAULT '',
  father_phone TEXT DEFAULT '',
  mother_name TEXT DEFAULT '',
  mother_job TEXT DEFAULT '',
  mother_phone TEXT DEFAULT '',
  siblings TEXT DEFAULT '',
  married TEXT DEFAULT '',
  children_count TEXT DEFAULT '',
  spouse_name TEXT DEFAULT '',
  spouse_phone TEXT DEFAULT '',
  spouse_job TEXT DEFAULT '',
  guardian_name TEXT DEFAULT '',
  guardian_phone TEXT DEFAULT '',
  social_status TEXT DEFAULT '',
  social_other_text TEXT DEFAULT '',
  disability TEXT DEFAULT '',
  parent_disability TEXT DEFAULT '',
  parent_deceased TEXT DEFAULT '',
  talent TEXT DEFAULT '',
  working TEXT DEFAULT '',
  work_place TEXT DEFAULT '',
  courses TEXT DEFAULT '',
  course_langs TEXT DEFAULT '',
  course_center TEXT DEFAULT '',
  cert_start TEXT DEFAULT '',
  cert_end TEXT DEFAULT '',
  cert_number TEXT DEFAULT '',
  extra TEXT DEFAULT '',

  photo_file_id TEXT DEFAULT '',
  cert_file_id TEXT DEFAULT '',

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_student_id ON files(student_id);
`;

(async () => {
  try {
    await pool.query(SCHEMA);
    console.log("✅ Jadvallar tayyor (students, files). Baza sozlashga tayyor.");
  } catch (err) {
    console.error("Xato yuz berdi:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
