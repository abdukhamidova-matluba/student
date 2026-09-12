# Talabalar anketasi — xavfsiz versiya (Vercel + Supabase)

Is'hoqxon Ibrat nomidagi Namangan davlat chet tillari instituti uchun talaba ma'lumotnomasi anketasi.

Bu versiya **Vercel'da bepul joylashtirish** uchun maxsus qurilgan: server kodi Vercel'ning
"serverless funksiyasi" sifatida ishlaydi, ma'lumotlar esa **Supabase**'da (bepul, doimiy
Postgres baza + fayl xotira) saqlanadi. Vercel'ning o'zida doimiy disk yo'qligi sababli
ma'lumotlarni tashqi joyda saqlash shart — aks holda har safar qayta ishga tushganda hammasi
o'chib qolar edi.

## Arxitektura

```
Brauzer  →  Vercel (kod, bepul)  →  Supabase Postgres (ma'lumotlar)
                                  →  Supabase Storage (rasm/sertifikat fayllari)
```

- **Vercel** — faqat kodni ishga tushiradi, hech narsa saqlamaydi (statelesss).
- **Supabase** — haqiqiy, doimiy "ombor": bazangiz va fayllaringiz shu yerda, Vercel qayta
  ishga tushsa ham yo'qolmaydi. Bepul reja: 500 MB baza + 1 GB fayl xotira — bu miqyosdagi
  anketa uchun yetarlicha ortig'i bilan.

## Nima o'zgardi (asl versiyaga nisbatan)

| Muammo (asl versiyada) | Bu versiyada |
|---|---|
| `window.storage` faqat Claude ichida ishlaydi, GitHub'da ishlamaydi | Haqiqiy Node.js server + Supabase Postgres baza |
| Admin paroli kodda ochiq (`namangan2026`) | Parol serverda **bcrypt xesh** sifatida saqlanadi, hech qachon kodga yozilmaydi |
| Har kim brauzer konsolidan to'g'ridan-to'g'ri barcha talabalar ma'lumotini o'qiy olar edi | Har bir so'rov JWT token bilan tekshiriladi; talaba faqat o'zinikini, admin esa faqat parol bilan kirgandan keyin hammasini ko'radi |
| 4 xonali parolni cheksiz urinib topish mumkin edi | 5 marta xato urinishdan keyin 15 daqiqaga bloklanadi + IP darajasida so'rovlar cheklanadi |
| Rasm/sertifikat fayllari hammaga ochiq havola orqali ko'rinardi | Fayllar Supabase Storage'da **private** bucket'da, faqat egasi yoki admin token bilan ochiladi |
| Vercel'da fayllar/baza yo'qolib qolardi | Ma'lumotlar Supabase'da — Vercel qayta ishga tushishi ularga ta'sir qilmaydi |

## 1-qadam: Supabase loyihasini sozlash (5-10 daqiqa, bepul, kredit karta shart emas)

1. **supabase.com** ga kirib, bepul hisob oching (GitHub bilan kirish qulay).
2. **New Project** → nom bering (masalan `talaba-anketa`) → **Database Password**ni o'ylab
   toping va **saqlab qo'ying** (keyinroq kerak bo'ladi) → hudud sifatida yaqinroq mintaqani
   tanlang → **Create new project** (1-2 daqiqa tayyorlanadi).

3. **Bazaga ulanish satrini (connection string) oling:**
   - Chap menyudan **Project Settings → Database** ga o'ting.
   - **Connection string** bo'limida **"Transaction pooler"** variantini tanlang (bu
     serverless/Vercel muhiti uchun tavsiya etilgan — oddiy to'g'ridan-to'g'ri ulanish emas).
   - Ko'rsatilgan satrdagi `[YOUR-PASSWORD]` qismini yuqorida o'zingiz o'rnatgan parol bilan
     almashtiring. Natija shunga o'xshash bo'ladi:
     ```
     postgresql://postgres.xxxxxxxxxxxx:SIZNING-PAROLINGIZ@aws-0-xxxxx.pooler.supabase.com:6543/postgres
     ```
   - Shu to'liq satrni nusxa ko'chirib qo'ying — bu `DATABASE_URL` bo'ladi.

4. **API kalitlarini oling:**
   - **Project Settings → API** ga o'ting.
   - **Project URL** ni nusxa ko'chiring — bu `SUPABASE_URL`.
   - **service_role** kalitini nusxa ko'chiring (⚠️ bu **maxfiy** kalit, `anon` kalit emas!) —
     bu `SUPABASE_SERVICE_KEY`.

5. **Fayllar uchun bucket yarating:**
   - Chap menyudan **Storage** ga o'ting → **New bucket**.
   - Nomi: `talaba-fayllar` (yoki boshqa nom — keyin `.env`da ko'rsatasiz).
   - **Public bucket** ni **YOQMANG** — Private qoldiring (fayllarga faqat server orqali,
     token tekshirilgandan keyin kirish kerak).
   - **Create bucket**.

## 2-qadam: Mahalliy kompyuterda sozlash va sinash

```bash
npm install
cp .env.example .env
```

`.env` faylini oching (`notepad .env` — Windows'da) va to'ldiring:

- `DATABASE_URL` — yuqorida 3-qadamda olgan satr
- `SUPABASE_URL` — 4-qadamda olgan Project URL
- `SUPABASE_SERVICE_KEY` — 4-qadamda olgan service_role kalit
- `SUPABASE_BUCKET` — `talaba-fayllar` (yoki siz tanlagan nom)
- `JWT_SECRET` — tasodifiy uzun satr:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `ADMIN_PASSWORD_HASH` — kuchli parol o'ylab, xeshini oling:
  ```bash
  npm run hash-password -- "sizning-kuchli-parolingiz"
  ```

**Baza jadvallarini bir marta yarating:**

```bash
npm run init-db
```

`✅ Jadvallar tayyor` deb chiqishi kerak. (Supabase Dashboard → Table Editor bo'limida
`students` va `files` jadvallarini ko'rasiz.)

**Serverni ishga tushiring:**

```bash
npm start
```

`http://localhost:3000` ni oching va anketani (rasm yuklash bilan birga) to'liq sinab ko'ring —
Supabase Dashboard'da Table Editor va Storage bo'limlarida ma'lumot chiqib turganini tekshiring.

## 3-qadam: Vercel'ga joylashtirish

1. **Kodni GitHub'ga yuklang:**
   ```bash
   git init
   git add .
   git commit -m "talaba anketasi - Vercel + Supabase versiyasi"
   ```
   GitHub'da yangi (**private** tavsiya etiladi) repozitoriy yarating va push qiling.

2. **vercel.com** ga GitHub hisobingiz bilan kiring → **Add New → Project** → repongizni
   tanlang → **Import**.

3. **Environment Variables** bo'limida (Deploy tugmasini bosishdan oldin!) yuqoridagi
   `.env` faylingizdagi hamma qiymatlarni bittalab qo'shing: `DATABASE_URL`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`, `JWT_SECRET`, `ADMIN_PASSWORD_HASH`,
   `STUDENT_TOKEN_TTL`, `ADMIN_TOKEN_TTL`. (`PORT` kerak emas — Vercel buni o'zi boshqaradi.)

4. **Deploy** tugmasini bosing. Bir necha daqiqadan so'ng
   `https://sizning-loyihangiz.vercel.app` havolasi tayyor bo'ladi.

5. Havolani oching, anketani sinab ko'ring, Administrator tabidan kirib tekshiring.

> Keyinchalik `.env`dagi biror qiymatni o'zgartirsangiz, Vercel Dashboard'dagi Environment
> Variables'ni ham yangilashni va loyihani qayta deploy qilishni unutmang.

## Muhim xavfsizlik eslatmalari

- **Admin parolini kuchli tanlang** va uni faqat ishonchli xodimlarga bering.
- `SUPABASE_SERVICE_KEY` — bu eng maxfiy kalitingiz, u orqali bazangizga to'liq kirish mumkin.
  Uni hech qachon GitHub'ga, jamoat kanaliga yoki suhbatlarga yubormang — faqat `.env` va
  Vercel Environment Variables ichida saqlang.
- `.env` faylini hech qachon hech kimga yubormang va GitHub'ga qo'ymang (`.gitignore`da bor).
- Vaqti-vaqti bilan Supabase Dashboard → Database → Backups bo'limidan zaxira nusxa olib turing.

## Loyihaning tuzilishi

```
app.js                — Express ilovasi (marshrutlar, xavfsizlik sozlamalari)
index.js               — lokal/Render uchun kirish nuqtasi (app.listen)
api/index.js            — Vercel uchun kirish nuqtasi (serverless funksiya)
vercel.json              — Vercel marshrutlash sozlamasi
db.js                    — Postgres (Supabase) ulanish puli
auth.js                  — JWT va parol xeshlash funksiyalari
helpers.js               — telefon formatlash, Supabase Storage yuklash/o'qish funksiyalari
routes/student.js         — talaba API: kirish, anketani ko'rish/saqlash
routes/admin.js            — admin API: ro'yxat, parolni tiklash, CSV eksport
routes/files.js             — rasm/sertifikat fayllarini Supabase Storage'dan xavfsiz uzatish
public/                     — frontend (HTML, CSS, JS)
scripts/hash-password.js     — admin paroli uchun bcrypt xesh generatori
scripts/init-db.js            — Supabase bazasida jadvallarni bir martalik yaratish
```

## Sinov holati

Ushbu sandbox muhitida haqiqiy Postgres (mahalliy) ustida to'liq sinovdan o'tkazildi:
- `npm run init-db` — jadvallar to'g'ri yaratildi ✅
- Talaba ro'yxatdan o'tishi, kirishi, anketa matn maydonlarini saqlashi/qayta o'qishi ✅
- Admin login (to'g'ri/noto'g'ri parol), barcha talabalar ro'yxati ✅
- Fayl yuklash: Supabase'ga haqiqiy tarmoq ulanishi ushbu sandbox'da mavjud emasligi sababli
  **soxta kalitlar bilan** sinaldi — kutilganidek, server qulamasdan, foydalanuvchiga aniq
  xato xabari qaytardi. **Haqiqiy Supabase hisobingiz bilan fayl yuklashni albatta o'zingiz
  bir marta sinab ko'ring** (yuqoridagi 2-qadam).

`node_modules/`, `.env` ushbu paketdan tozalab olib tashlandi — ular "O'rnatish" bo'limidagi
qadamlar orqali qaytadan (haqiqiy sirlar bilan) yaratiladi.
