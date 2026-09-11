const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { uploadsDir } = require('../helpers');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Token brauzerda <img src> / <a href> orqali ham yuborilishi mumkin bo'lgani uchun
// bu yerda query parametri ?token= ni ham qabul qilamiz (Authorization header bilan bir qatorda).
function getAuth(req) {
  const h = req.headers.authorization || '';
  const parts = h.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') return parts[1];
  if (req.query.token) return req.query.token;
  return null;
}

router.get('/:id', (req, res) => {
  const token = getAuth(req);
  if (!token) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Sessiya yaroqsiz.' });
  }

  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'Fayl topilmadi.' });

  const isOwner = payload.role === 'student' && payload.sid === file.student_id;
  const isAdmin = payload.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "Sizga bu faylni ko'rishga ruxsat yo'q." });
  }

  const filePath = path.join(uploadsDir, file.storage_name);
  res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
  if (file.kind === 'cert') {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name || file.storage_name)}"`);
  }
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Fayl topilmadi.' });
  });
});

module.exports = router;
