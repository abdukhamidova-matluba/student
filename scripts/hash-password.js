// Foydalanish: npm run hash-password -- "sizning-parolingiz"
const bcrypt = require('bcryptjs');

const pw = process.argv[2];
if (!pw) {
  console.error('Xato: parolni argument sifatida bering.');
  console.error('Masalan: npm run hash-password -- "juda-kuchli-parol-2026"');
  process.exit(1);
}
if (pw.length < 8) {
  console.error("Ogohlantirish: parol juda qisqa. Kamida 8-10 belgidan iborat, taxmin qilib bo'lmaydigan parol tanlang.");
}

const hash = bcrypt.hashSync(pw, 10);
console.log('\nBu qatorni .env fayliga ADMIN_PASSWORD_HASH= dan keyin qo\'ying:\n');
console.log(hash);
console.log('');
