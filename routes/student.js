const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { hashPin, verifyPin, signStudentToken, requireStudent } = require('../auth');
const { OFFICIAL_GROUPS, normPhone, isValidPin, upload, uploadsDir } = require('../helpers');

const router = express.Router();

const LOCK_THRESHOLD = 5; // shu qadar noto'g'ri urinishdan keyin bloklanadi
const LOCK_MS = 15 * 60 * 1000; // 15 daqiqa

// IP darajasida qo'shimcha himoya (parolni katta hajmda "brute-force" qilishga qarshi)
const enterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Juda ko'p urinish. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." },
});

const FIELD_MAP = {
  fullname: 'fullname',
  birthdate: 'birthdate',
  group: 'group_name',
  nationality: 'nationality',
  languages: 'languages',
  school: 'school',
  privilege: 'privilege',
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

function toClientRecord(row) {
  if (!row) return null;
  const out = { phone: row.phone };
  for (const [clientKey, col] of Object.entries(FIELD_MAP)) {
    out[clientKey] = row[col] || '';
  }
  out.photoFileId = row.photo_file_id || '';
  out.certFileId = row.cert_file_id || '';
  return out;
}

// POST /api/student/enter  { phone, pin }
router.post('/enter', enterLimiter, (req, res) => {
  const phoneRaw = req.body.phone;
  const pin = req.body.pin;
  const phone = normPhone(phoneRaw);

  if (!phone || phone.length < 7) {
    return res.status(400).json({ error: "Telefon raqamni to'liq kiriting." });
  }
  if (!isValidPin(pin)) {
    return res.status(400).json({ error: "Parol 4 ta raqamdan iborat bo'lishi kerak." });
  }

  const existing = db.prepare('SELECT * FROM students WHERE phone = ?').get(phone);
  const now = new Date().toISOString();

  if (!existing) {
    const pinHash = hashPin(pin);
    const info = db
      .prepare('INSERT INTO students (phone, pin_hash, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(phone, pinHash, now, now);
    const token = signStudentToken(info.lastInsertRowid, phone);
    return res.json({ token, isNew: true, data: null });
  }

  // Bloklanganmi tekshirish
  if (existing.locked_until && existing.locked_until > Date.now()) {
    const minutesLeft = Math.ceil((existing.locked_until - Date.now()) / 60000);
    return res.status(429).json({
      error:
        `Ko'p marta noto'g'ri parol kiritildi. ${minutesLeft} daqiqadan so'ng qayta urinib ko'ring, ` +
        `yoki guruh rahbari (tyutor)/administratorga murojaat qiling.`,
    });
  }

  if (!verifyPin(pin, existing.pin_hash)) {
    const attempts = existing.failed_attempts + 1;
    let lockedUntil = 0;
    if (attempts >= LOCK_THRESHOLD) {
      lockedUntil = Date.now() + LOCK_MS;
    }
    db.prepare('UPDATE students SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
      attempts,
      lockedUntil,
      existing.id
    );
    if (lockedUntil) {
      return res.status(429).json({
        error:
          "Ko'p marta noto'g'ri parol kiritildi. Xavfsizlik uchun 15 daqiqaga bloklandi. " +
          'Agar parolingizni unutgan bo\'lsangiz, guruh rahbari (tyutor)/administratorga murojaat qiling.',
      });
    }
    return res.status(401).json({
      error:
        "Parol noto'g'ri. Agar parolingizni unutgan bo'lsangiz, o'zingiz tiklay olmaysiz — " +
        'guruh rahbari (tyutor)/administratorga murojaat qiling, u sizning parolingizni yangilaydi.',
    });
  }

  // Muvaffaqiyatli kirish - urinishlar hisobini tozalash
  db.prepare('UPDATE students SET failed_attempts = 0, locked_until = 0 WHERE id = ?').run(existing.id);
  const token = signStudentToken(existing.id, phone);
  res.json({ token, isNew: false, data: toClientRecord(existing) });
});

// GET /api/student/me
router.get('/me', requireStudent, (req, res) => {
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(req.studentId);
  if (!row) return res.status(404).json({ error: 'Anketa topilmadi.' });
  res.json({ data: toClientRecord(row) });
});

// PUT /api/student/me  (multipart/form-data: matn maydonlari + ixtiyoriy photo/cert fayllari)
router.put('/me', requireStudent, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'cert', maxCount: 1 }]), (req, res) => {
  const cleanupUploaded = () => {
    for (const key of ['photo', 'cert']) {
      const f = req.files && req.files[key] && req.files[key][0];
      if (f) fs.unlink(f.path, () => {});
    }
  };

  const body = req.body || {};

  const required = ['fullname', 'group', 'currentType', 'socialStatus', 'fatherPhone'];
  for (const key of required) {
    if (!body[key] || !String(body[key]).trim()) {
      cleanupUploaded();
      return res.status(400).json({ error: "Iltimos, barcha majburiy (*) maydonlarni to'ldiring." });
    }
  }
  const requiredChoice = ['privilege', 'disability', 'parentDisability', 'parentDeceased', 'working', 'married'];
  for (const key of requiredChoice) {
    if (body[key] !== 'Ha' && body[key] !== "Yo'q") {
      cleanupUploaded();
      return res.status(400).json({ error: "Iltimos, barcha majburiy (*) savollarga javob bering." });
    }
  }
  if (!OFFICIAL_GROUPS.includes(body.group)) {
    cleanupUploaded();
    return res.status(400).json({ error: "Guruh noto'g'ri tanlangan." });
  }

  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(req.studentId);
  if (!row) {
    cleanupUploaded();
    return res.status(404).json({ error: 'Anketa topilmadi.' });
  }

  const sets = [];
  const values = [];
  for (const [clientKey, col] of Object.entries(FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(body, clientKey)) {
      sets.push(`${col} = ?`);
      values.push(String(body[clientKey] ?? ''));
    }
  }

  function saveFile(fieldName, kind, oldFileId) {
    const f = req.files && req.files[fieldName] && req.files[fieldName][0];
    if (!f) return null;
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    db.prepare(
      'INSERT INTO files (id, student_id, kind, original_name, mime_type, storage_name, created_at) VALUES (?,?,?,?,?,?,?)'
    ).run(id, row.id, kind, f.originalname, f.mimetype, path.basename(f.path), new Date().toISOString());
    if (oldFileId) {
      const oldFile = db.prepare('SELECT * FROM files WHERE id = ?').get(oldFileId);
      db.prepare('DELETE FROM files WHERE id = ?').run(oldFileId);
      if (oldFile) {
        const p = path.join(uploadsDir, oldFile.storage_name);
        fs.unlink(p, () => {});
      }
    }
    return id;
  }

  const newPhotoId = saveFile('photo', 'photo', row.photo_file_id);
  if (newPhotoId) {
    sets.push('photo_file_id = ?');
    values.push(newPhotoId);
  }
  const newCertId = saveFile('cert', 'cert', row.cert_file_id);
  if (newCertId) {
    sets.push('cert_file_id = ?');
    values.push(newCertId);
  }

  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(row.id);

  db.prepare(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(row.id);
  res.json({ ok: true, data: toClientRecord(updated) });
});

module.exports = router;
