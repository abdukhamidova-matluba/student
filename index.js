// Bu fayl — Render, Railway, VPS yoki o'zingizning kompyuteringizda (localhost) ishga
// tushirish uchun ("npm start" / "npm run dev"). Vercel esa buni ishlatmaydi — u
// api/index.js orqali app.js'ni to'g'ridan-to'g'ri serverless funksiya sifatida chaqiradi.
const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});
