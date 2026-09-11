require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

// --- Xavfsizlik sarlavhalari ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        // Eslatma: frontend hozircha onclick/onchange kabi inline handlerlardan foydalanadi,
        // shuning uchun 'unsafe-inline' kerak. Barcha admin jadvalidagi matnlar HTML-escape
        // qilingani uchun bu yerdagi xavf cheklangan, lekin kelajakda addEventListener'ga
        // o'tkazib, bu ruxsatni olib tashlash tavsiya etiladi.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        connectSrc: ["'self'"],
      },
    },
  })
);

// --- CORS: agar frontend shu server bilan bir domenda bo'lsa, kerak emas ---
const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (allowedOrigin) {
  app.use(cors({ origin: allowedOrigin }));
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/student', require('./routes/student'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/files', require('./routes/files'));

// --- Statik frontend ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Xatoliklarni yagona joyda ushlash (masalan multer fayl hajmi xatosi) ---
app.use((err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Serverda kutilmagan xatolik yuz berdi.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});
