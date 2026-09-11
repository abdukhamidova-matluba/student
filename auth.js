const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error(
    'JWT_SECRET .env faylida o\'rnatilmagan yoki juda qisqa. ' +
    '.env.example faylidagi ko\'rsatmaga qarang.'
  );
}

const STUDENT_TOKEN_TTL = process.env.STUDENT_TOKEN_TTL || '2h';
const ADMIN_TOKEN_TTL = process.env.ADMIN_TOKEN_TTL || '4h';

function hashPin(pin) {
  return bcrypt.hashSync(pin, 10);
}
function verifyPin(pin, hash) {
  return bcrypt.compareSync(pin, hash);
}
function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}
function verifyPassword(pw, hash) {
  return bcrypt.compareSync(pw, hash);
}

function signStudentToken(studentId, phone) {
  return jwt.sign({ role: 'student', sid: studentId, phone }, JWT_SECRET, {
    expiresIn: STUDENT_TOKEN_TTL,
  });
}
function signAdminToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: ADMIN_TOKEN_TTL });
}

function getToken(req) {
  const h = req.headers.authorization || '';
  const parts = h.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') return parts[1];
  return null;
}

function requireStudent(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'student') throw new Error('wrong role');
    req.studentId = payload.sid;
    req.phone = payload.phone;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessiya tugagan yoki yaroqsiz. Qayta kiring.' });
  }
}

function requireAdmin(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Administrator sifatida kiring.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('wrong role');
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Administrator sessiyasi tugagan. Qayta kiring.' });
  }
}

module.exports = {
  hashPin,
  verifyPin,
  hashPassword,
  verifyPassword,
  signStudentToken,
  signAdminToken,
  requireStudent,
  requireAdmin,
};
