# Talabalar anketasi — xavfsiz versiya

Is'hoqxon Ibrat nomidagi Namangan davlat chet tillari instituti uchun talaba ma'lumotnomasi anketasi.

Bu versiya asl HTML fayldan farqli o'laroq **haqiqiy backend server** (Node.js + Express + SQLite) bilan ishlaydi, chunki asl fayl faqat Claude.ai artifact muhitida ishlaydigan `window.storage` funksiyasiga tayangan va mustaqil saytda umuman ishlamas edi.

## Nima o'zgardi (asl versiyaga nisbatan)

| Muammo (asl versiyada) | Bu versiyada |
|---|---|
| `window.storage` faqat Claude ichida ishlaydi, GitHub'da ishlamaydi | Haqiqiy Node.js server + SQLite baza |
| Admin paroli kodda ochiq (`namangan2026`) | Parol serverda **bcrypt xesh** sifatida `.env` faylida, hech qachon kodga yozilmaydi |
| Har kim brauzer konsolidan to'g'ridan-to'g'ri barcha talabalar ma'lumotini o'qiy olar edi | Har bir so'rov JWT token bilan tekshiriladi; talaba faqat o'zinikini, admin esa faqat parol bilan kirgandan keyin hammasini ko'radi |
| 4 xonali parolni cheksiz urinib topish mumkin edi | 5 marta xato urinishdan keyin 15 daqiqaga bloklanadi + IP darajasida so'rovlar cheklanadi |
| Rasm/sertifikat fayllari hammaga ochiq havola orqali ko'rinardi | Fayllar faqat egasi yoki admin token bilan ochiladi |

## Talab qilinadigan narsalar

- Node.js 18 yoki undan yuqori versiyasi
- npm

## O'rnatish (lokal kompyuterda sinash uchun)

```bash
npm install
cp .env.example .env
```

`.env` faylini oching va:

1. `JWT_SECRET` ga tasodifiy uzun satr qo'ying:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Chiqqan qiymatni `JWT_SECRET=` ga yozing.

2. Administrator parolini o'ylab toping (kuchli, taxmin qilib bo'lmaydigan parol) va xeshini oling:
   ```bash
   npm run hash-password -- "sizning-kuchli-parolingiz"
   ```
   Chiqqan xeshni `ADMIN_PASSWORD_HASH=` ga yozing.

So'ngra serverni ishga tushiring:

```bash
npm start
```

Brauzerda `http://localhost:3000` manzilini oching.

## GitHub'ga qo'yish

GitHub'ning o'zi (repozitoriy sifatida) kodni saqlash uchun to'liq mos keladi — `git init`, `git add .`, `git commit`, so'ng GitHub'da repo yaratib push qiling. **`.env` fayli va `data/`, `uploads/` papkalari `.gitignore` tufayli avtomatik chiqarib tashlanadi — bu to'g'ri, ular hech qachon repoga tushmasligi kerak.**

⚠️ **Muhim:** oddiy **GitHub Pages** faqat statik HTML saytlarni ko'rsatadi, u Node.js serverni ishga tushira olmaydi. Sayt haqiqatan ishlashi uchun kodni Node.js'ni qo'llab-quvvatlaydigan xizmatga joylashtirish kerak, masalan:

- **Render.com** (bepul reja bor, eng oson yo'l)
- **Railway.app**
- **Fly.io**
- yoki o'zingizning VPS serveringiz (masalan DigitalOcean, Timeweb)

Har birida qilinadigan ish deyarli bir xil: repo'ni ulaysiz, `npm install && npm start` buyrug'ini ko'rsatasiz, va `.env` dagi o'zgaruvchilarni (`JWT_SECRET`, `ADMIN_PASSWORD_HASH` va h.k.) o'sha xizmatning "Environment Variables" bo'limiga qo'lda kiritasiz (fayl sifatida emas — bu joyga sizning haqiqiy maxfiy qiymatlaringiz yoziladi va GitHub'ga hech qachon tushmaydi).

Ma'lumotlar bazasi (`data/data.db`) va yuklangan fayllar (`uploads/`) server diskida saqlanadi — shuning uchun tanlagan xizmatingizda **doimiy disk (persistent disk/volume)** yoqilganiga ishonch hosil qiling, aks holda server qayta ishga tushganda ma'lumotlar yo'qolishi mumkin (bu — Render, Railway va Fly.io'da alohida sozlanadigan oddiy funksiya).

## Muhim xavfsizlik eslatmalari

- **Admin parolini kuchli tanlang** va uni faqat ishonchli xodimlarga bering. 4 xonali talaba PIN'lari tabiatan zaif (10 000 kombinatsiya) — shuning uchun bloklash tizimi ishlatilgan, lekin bu mutlaq himoya emas.
- Ishlab chiqarishga (production) qo'yishdan oldin sayt albatta **HTTPS** orqali ishlashi kerak (Render/Railway/Fly.io buni avtomatik beradi).
- `.env` faylini hech qachon hech kimga yubormang va GitHub'ga qo'ymang.
- Vaqti-vaqti bilan `data/data.db` faylining zaxira nusxasini (backup) oling.

## Loyihaning tuzilishi

```
index.js              — asosiy server (Express, xavfsizlik sozlamalari)
db.js                 — SQLite baza sxemasi
auth.js               — JWT va parol xeshlash funksiyalari
helpers.js            — telefon raqam formatlash, fayl yuklash sozlamalari
routes/student.js      — talaba API: kirish, anketani ko'rish/saqlash
routes/admin.js         — admin API: ro'yxat, parolni tiklash, CSV eksport
routes/files.js          — rasm/sertifikat fayllarini xavfsiz uzatish
public/                — frontend (HTML, CSS, JS)
scripts/hash-password.js — admin paroli uchun bcrypt xesh generatori
```

## Sinov holati (muhim)

Bu kodni yozgan muhitda internetga chiqish imkoni yo'q edi, shuning uchun `npm install` va serverni jonli (end-to-end) ishga tushirib sinash **shu yerda bajarilmadi**. Quyidagilar bajarildi:
- Barcha JavaScript fayllar sintaksis xatoliklariga tekshirildi (`node --check`) — xatosiz.
- Barcha API yo'llari, autentifikatsiya oqimi va ma'lumotlar sxemasi qo'lda diqqat bilan ko'rib chiqildi.

**Iltimos, GitHub'ga qo'yishdan va talabalarga tarqatishdan oldin yuqoridagi "O'rnatish" bo'limi bo'yicha o'zingizning kompyuteringizda bir marta to'liq sinab ko'ring** (anketa to'ldirish, rasm/sertifikat yuklash, admin panelga kirish, parolni tiklash). Agar biror joyda xatolik chiqsa, menga xabar bering — birga tuzataman.
