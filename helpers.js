const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const OFFICIAL_GROUPS = ['XTA-AU-26', 'XTA-KU-25', 'XTA-JU-25', 'RUS-AR-25', 'RUA-AR-24', 'XTA-AU-23'];

function normPhone(p) {
  return String(p || '').replace(/[^0-9]/g, '');
}

function isValidPin(pin) {
  return /^[0-9]{4}$/.test(String(pin || ''));
}

// --- Supabase Storage (fayllar uchun) ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_URL yoki SUPABASE_SERVICE_KEY .env faylida yo'q. " +
    ".env.example faylidagi ko'rsatmaga qarang (Supabase loyihangiz Settings > API bo'limidan oling)."
  );
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET = process.env.SUPABASE_BUCKET || 'talaba-fayllar';

async function uploadToStorage(storagePath, buffer, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error('Supabase Storage yuklashda xatolik: ' + error.message);
}

async function downloadFromStorage(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error('Supabase Storage o\'qishda xatolik: ' + error.message);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function deleteFromStorage(storagePath) {
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

// --- Multer: diskka emas, xotiraga (memory) yozadi, keyin Supabase Storage'ga yuboriladi ---
// (Vercel'ning serverless muhitida doimiy disk yo'q, shuning uchun diskStorage ishlatib bo'lmaydi)
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Faqat JPG, PNG, WEBP rasm yoki PDF fayl qabul qilinadi.'));
    }
    cb(null, true);
  },
});

module.exports = {
  OFFICIAL_GROUPS,
  normPhone,
  isValidPin,
  upload,
  uploadToStorage,
  downloadFromStorage,
  deleteFromStorage,
};
