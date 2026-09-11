const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,

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
  student_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  storage_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
`);

module.exports = db;
