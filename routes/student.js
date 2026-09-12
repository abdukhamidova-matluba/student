const express = require('express');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { hashPin, verifyPin, signStudentToken, requireStudent } = require('../auth');
const { OFFICIAL_GROUPS, normPhone, isValidPin, upload, uploadToStorage, deleteFromStorage } = require('../helpers');

const router = express.Router();

const LOCK_THRESHOLD = 5; // shu qadar noto'g'ri urinishdan keyin bloklanadi
const LOCK_MS = 15 * 60 * 1000; // 15 daqiqa

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
router.post('/enter', enterLimiter, async (req, res) => {
  try {
    const phoneRaw = req.body.phone;
    const pin = req.body.pin;
    const phone = normPhone(phoneRaw);

    if (!phone || phone.length < 7) {
      return res.status(400).json({ error: "Telefon raqamni to'liq kiriting." });
    }
    if (!isValidPin(pin)) {
      return res.status(400).json({ error: "Parol 4 ta raqamdan iborat bo'lishi kerak." });
    }

    const { rows } = await db.query('SELECT * FROM students WHERE phone = $1', [phone]);
    const existing = rows[0];
    const now = new Date().toISOString();

    if (!existing) {
      const pinHash = hashPin(pin);
      const insertRes = await db.query(
        'INSERT INTO students (phone, pin_hash, created_at, updated_at) VALUES ($1,$2,$3,$4) RETURNING id',
        [phone, pinHash, now, now]
      );
      const token = signStudentToken(insertRes.rows[0].id, phone);
      return res.json({ token, isNew: true, data: null });
    }

    if (existing.locked_until && Number(existing.locked_until) > Date.now()) {
      const minutesLeft = Math.ceil((Number(existing.locked_until) - Date.now()) / 60000);
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
      await db.query('UPDATE students SET failed_attempts = $1, locked_until = $2 WHERE id = $3', [
        attempts,
        lockedUntil,
        existing.id,
      ]);
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

    await db.query('UPDATE students SET failed_attempts = 0, locked_until = 0 WHERE id = $1', [existing.id]);
    const token = signStudentToken(existing.id, phone);
    res.json({ token, isNew: false, data: toClientRecord(existing) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi: ' + err.message });
  }
});

// GET /api/student/me
router.get('/me', requireStudent, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM students WHERE id = $1', [req.studentId]);
    if (!rows[0]) return res.status(404).json({ error: 'Anketa topilmadi.' });
    res.json({ data: toClientRecord(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi: ' + err.message });
  }
});

// PUT /api/student/me  (multipart/form-data: matn maydonlari + ixtiyoriy photo/cert fayllari)
router.put('/me', requireStudent, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'cert', maxCount: 1 }]), async (req, res) => {
  try {
    const body = req.body || {};

    const required = ['fullname', 'group', 'currentType', 'socialStatus', 'fatherPhone'];
    for (const key of required) {
      if (!body[key] || !String(body[key]).trim()) {
        return res.status(400).json({ error: "Iltimos, barcha majburiy (*) maydonlarni to'ldiring." });
      }
    }
    const requiredChoice = ['privilege', 'disability', 'parentDisability', 'parentDeceased', 'working', 'married'];
    for (const key of requiredChoice) {
      if (body[key] !== 'Ha' && body[key] !== "Yo'q") {
        return res.status(400).json({ error: "Iltimos, barcha majburiy (*) savollarga javob bering." });
      }
    }
    if (!OFFICIAL_GROUPS.includes(body.group)) {
      return res.status(400).json({ error: "Guruh noto'g'ri tanlangan." });
    }

    const { rows } = await db.query('SELECT * FROM students WHERE id = $1', [req.studentId]);
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Anketa topilmadi.' });
    }

    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const [clientKey, col] of Object.entries(FIELD_MAP)) {
      if (Object.prototype.hasOwnProperty.call(body, clientKey)) {
        setClauses.push(`${col} = $${idx++}`);
        values.push(String(body[clientKey] ?? ''));
      }
    }

    async function saveFile(fieldName, kind, oldFileId) {
      const f = req.files && req.files[fieldName] && req.files[fieldName][0];
      if (!f) return null;
      const id = uuidv4();
      const ext = f.mimetype === 'application/pdf' ? '.pdf' : (f.originalname.match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0];
      const storagePath = `${row.id}/${id}${ext.toLowerCase()}`;
      await uploadToStorage(storagePath, f.buffer, f.mimetype);
      await db.query(
        'INSERT INTO files (id, student_id, kind, original_name, mime_type, storage_path, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, row.id, kind, f.originalname, f.mimetype, storagePath, new Date().toISOString()]
      );
      if (oldFileId) {
        const oldRes = await db.query('SELECT * FROM files WHERE id = $1', [oldFileId]);
        const oldFile = oldRes.rows[0];
        await db.query('DELETE FROM files WHERE id = $1', [oldFileId]);
        if (oldFile) {
          deleteFromStorage(oldFile.storage_path).catch(() => {});
        }
      }
      return id;
    }

    const newPhotoId = await saveFile('photo', 'photo', row.photo_file_id);
    if (newPhotoId) {
      setClauses.push(`photo_file_id = $${idx++}`);
      values.push(newPhotoId);
    }
    const newCertId = await saveFile('cert', 'cert', row.cert_file_id);
    if (newCertId) {
      setClauses.push(`cert_file_id = $${idx++}`);
      values.push(newCertId);
    }

    setClauses.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(row.id);

    await db.query(`UPDATE students SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);

    const updatedRes = await db.query('SELECT * FROM students WHERE id = $1', [row.id]);
    res.json({ ok: true, data: toClientRecord(updatedRes.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Saqlashda xatolik yuz berdi.' });
  }
});

module.exports = router;
