const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const OFFICIAL_GROUPS = ['XTA-AU-26', 'XTA-KU-25', 'XTA-JU-25', 'RUS-AR-25', 'RUA-AR-24', 'XTA-AU-23'];

function normPhone(p) {
  return String(p || '').replace(/[^0-9]/g, '');
}

function isValidPin(pin) {
  return /^[0-9]{4}$/.test(String(pin || ''));
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = file.mimetype === 'application/pdf' ? '.pdf' : (path.extname(file.originalname) || '.jpg');
    cb(null, uuidv4() + ext.toLowerCase());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Faqat JPG, PNG, WEBP rasm yoki PDF fayl qabul qilinadi.'));
    }
    cb(null, true);
  },
});

module.exports = { OFFICIAL_GROUPS, normPhone, isValidPin, upload, uploadsDir };
