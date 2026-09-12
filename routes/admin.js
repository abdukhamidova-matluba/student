const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { verifyPassword, hashPin, signAdminToken, requireAdmin } = require('../auth');
const { OFFICIAL_GROUPS, isValidPin, deleteFromStorage } = require('../helpers');

const router = express.Router();

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Juda ko'p urinish. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." },
});

router.post('/login', loginLimiter, (req, res) => {
  if (!ADMIN_PASSWORD_HASH) {
    return res.status(500).json({
      error:
        "Administrator paroli serverda sozlanmagan (ADMIN_PASSWORD_HASH .env faylida yo'q). " +
        'README.md ga qarang.',
    });
  }
  const pass = req.body.password || '';
  if (!verifyPassword(pass, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: "Parol noto'g'ri." });
  }
  res.json({ token: signAdminToken() });
});

const COLUMN_MAP = {
  fullname: 'fullname',
  birthdate: 'birthdate',
  group: 'group_name',
  nationality: 'nationality',
  languages: 'languages',
  school: 'school',
  privilege: 'privilege',
  phone: 'phone',
  email: 'email',
  telegram: 'telegram',
  permaddr: 'permaddr',
  currentType: 'current_type',
  ijaraAddr: 'ijara_addr',
  ijaraOwner: 'ijara_owner',
  ijaraOwnerPhone: 'ijara_owner_phone',
  ttjRoom: 'ttj_room',
  fatherName: 'father_name',
  fatherJob: 'father_job',
  fatherPhone: 'father_phone',
  motherName: 'mother_name',
  motherJob: 'mother_job',
  motherPhone: 'mother_phone',
  siblings: 'siblings',
  married: 'married',
  childrenCount: 'children_count',
  spouseName: 'spouse_name',
  spousePhone: 'spouse_phone',
  spouseJob: 'spouse_job',
  guardianName: 'guardian_name',
  guardianPhone: 'guardian_phone',
  socialStatus: 'social_status',
  socialOtherText: 'social_other_text',
  disability: 'disability',
  parentDisability: 'parent_disability',
  parentDeceased: 'parent_deceased',
  talent: 'talent',
  working: 'working',
  workPlace: 'work_place',
  courses: 'courses',
  courseLangs: 'course_langs',
  courseCenter: 'course_center',
  certStart: 'cert_start',
  certEnd: 'cert_end',
  certNumber: 'cert_number',
  extra: 'extra',
};

function toAdminRecord(row) {
  const out = { id: row.id };
  for (const [clientKey, col] of Object.entries(COLUMN_MAP)) {
    out[clientKey] = row[col] || '';
  }
  out.photoFileId = row.photo_file_id || '';
  out.certFileId = row.cert_file_id || '';
  return out;
}

router.get('/students', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM students ORDER BY group_name, fullname');
    res.json({ groups: OFFICIAL_GROUPS, students: rows.map(toAdminRecord) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi: ' + err.message });
  }
});

router.post('/students/:id/reset-pin', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const newPin = req.body.newPin;
    if (!isValidPin(newPin)) {
      return res.status(400).json({ error: "Parol aynan 4 ta raqamdan iborat bo'lishi kerak." });
    }
    const { rows } = await db.query('SELECT id FROM students WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Yozuv topilmadi.' });
    await db.query(
      'UPDATE students SET pin_hash = $1, failed_attempts = 0, locked_until = 0, updated_at = $2 WHERE id = $3',
      [hashPin(newPin), new Date().toISOString(), id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi: ' + err.message });
  }
});

router.delete('/students/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const filesRes = await db.query('SELECT storage_path FROM files WHERE student_id = $1', [id]);
    await db.query('DELETE FROM students WHERE id = $1', [id]); // files jadvali ON DELETE CASCADE bilan avtomatik tozalanadi
    for (const f of filesRes.rows) {
      deleteFromStorage(f.storage_path).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi: ' + err.message });
  }
});

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

router.get('/export.csv', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM students ORDER BY group_name, fullname');
    const cols = ['id', ...Object.keys(COLUMN_MAP)];
    const lines = [cols.join(',')];
    for (const row of rows) {
      const rec = toAdminRecord(row);
      lines.push(cols.map((c) => csvEscape(rec[c])).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="talabalar_anketasi.csv"');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi: ' + err.message });
  }
});

module.exports = router;
