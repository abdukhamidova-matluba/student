const OFFICIAL_GROUPS = ["XTA-AU-26","XTA-KU-25","XTA-JU-25","RUS-AR-25","RUA-AR-24","XTA-AU-23"];

let studentToken = sessionStorage.getItem('studentToken') || '';
let adminToken = sessionStorage.getItem('adminToken') || '';
let photoFile = null; // yangi tanlangan fayl (hali yuklanmagan)
let certFile = null;
let adminActiveGroup = 'ALL';
let adminRecords = [];

function switchTab(tab){
  document.getElementById('panel-student').classList.toggle('active', tab==='student');
  document.getElementById('panel-admin').classList.toggle('active', tab==='admin');
  document.getElementById('tabBtnStudent').classList.toggle('active', tab==='student');
  document.getElementById('tabBtnAdmin').classList.toggle('active', tab==='admin');
}

function toggleCurrentType(){
  const v = document.getElementById('f_currentType').value;
  document.getElementById('cond-ijara').classList.toggle('show', v==='ijara xonadonidan');
  document.getElementById('cond-ttj').classList.toggle('show', v==='Talabalar turar joyi');
}
function toggleSocialOther(){
  document.getElementById('cond-socialOther').classList.toggle('show', document.getElementById('f_socialStatus').value==='Boshqa');
}
function toggleWorking(){
  const v = document.querySelector('input[name=f_working]:checked');
  document.getElementById('cond-working').classList.toggle('show', v && v.value==='Ha');
}
function toggleCourses(){
  const v = document.querySelector('input[name=f_courses]:checked');
  document.getElementById('cond-courses').classList.toggle('show', v && v.value==='Ha');
}
function toggleMarried(){
  const v = document.querySelector('input[name=f_married]:checked');
  document.getElementById('cond-married').classList.toggle('show', v && v.value==='Ha');
}

function setDropError(dropId, msg){
  const el = document.getElementById(dropId);
  el.classList.remove('has-file');
  el.firstChild.textContent = "⚠ " + msg + " (qayta tanlash uchun bosing)";
}

function resizeImageToBlob(file, maxW, quality){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject("Faylni o'qib bo'lmadi. Boshqa fayl tanlab ko'ring.");
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject("Bu rasm formatini o'qib bo'lmadi. Iltimos JPG yoki PNG tanlang.");
      img.onload = () => {
        try{
          const scale = Math.min(1, maxW/img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width*scale));
          canvas.height = Math.max(1, Math.round(img.height*scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          canvas.toBlob(blob => {
            if(!blob){ reject("Rasmni qayta ishlashda xatolik yuz berdi."); return; }
            resolve(blob);
          }, 'image/jpeg', quality);
        } catch(err){
          reject("Rasmni qayta ishlashda xatolik yuz berdi.");
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhoto(e){
  const file = e.target.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){
    setDropError('photoDrop', "Iltimos rasm fayl tanlang (JPG, PNG)."); return;
  }
  if(file.size > 15*1024*1024){
    setDropError('photoDrop', "Rasm hajmi juda katta (15MB dan oshmasligi kerak)."); return;
  }
  document.getElementById('photoDrop').firstChild.textContent = "Yuklanmoqda...";
  try{
    const blob = await resizeImageToBlob(file, 500, 0.8);
    photoFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    document.getElementById('photoDrop').classList.add('has-file');
    document.getElementById('photoDrop').firstChild.textContent = "Rasm tayyor: " + file.name + " (qayta tanlash uchun bosing)";
  } catch(msg){
    setDropError('photoDrop', msg);
  }
}

async function handleCert(e){
  const file = e.target.files[0];
  if(!file) return;
  const isPdf = file.type === 'application/pdf';
  const isImg = file.type.startsWith('image/');
  if(!isPdf && !isImg){
    setDropError('certDrop', "Faqat rasm (JPG/PNG) yoki PDF fayl yuklash mumkin."); return;
  }
  if(file.size > 20*1024*1024){
    setDropError('certDrop', "Fayl hajmi juda katta (20MB dan oshmasligi kerak)."); return;
  }
  document.getElementById('certDrop').firstChild.textContent = "Yuklanmoqda...";
  if(isPdf){
    if(file.size > 10*1024*1024){
      setDropError('certDrop', "PDF fayl juda katta. Iltimos 10MB dan kichikroq PDF tanlang yoki rasm (skanerlangan sahifa) sifatida yuklang."); return;
    }
    certFile = file;
    document.getElementById('certDrop').classList.add('has-file');
    document.getElementById('certDrop').firstChild.textContent = "Fayl tayyor: " + file.name + " (qayta tanlash uchun bosing)";
  } else {
    try{
      const blob = await resizeImageToBlob(file, 1200, 0.82);
      certFile = new File([blob], 'cert.jpg', { type: 'image/jpeg' });
      document.getElementById('certDrop').classList.add('has-file');
      document.getElementById('certDrop').firstChild.textContent = "Fayl tayyor: " + file.name + " (qayta tanlash uchun bosing)";
    } catch(msg){
      setDropError('certDrop', msg);
    }
  }
}

async function enterForm(){
  const phone = document.getElementById('gatePhone').value.trim();
  const pin = document.getElementById('gatePin').value.trim();
  const msgEl = document.getElementById('gateMsg');
  const btn = document.getElementById('gateSubmitBtn');
  msgEl.innerHTML = "";
  if(!phone || phone.length < 7){
    msgEl.innerHTML = '<div class="msg err">Telefon raqamni to\'liq kiriting.</div>'; return;
  }
  if(!/^[0-9]{4}$/.test(pin)){
    msgEl.innerHTML = '<div class="msg err">Parol 4 ta raqamdan iborat bo\'lishi kerak.</div>'; return;
  }
  btn.disabled = true;
  try{
    const res = await fetch('/api/student/enter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin })
    });
    const body = await res.json();
    if(!res.ok){
      msgEl.innerHTML = '<div class="msg err">' + escapeHtml(body.error || 'Xatolik yuz berdi.') + '</div>';
      return;
    }
    studentToken = body.token;
    sessionStorage.setItem('studentToken', studentToken);
    if(body.data){ fillForm(body.data); }
    document.getElementById('f_phone_display').value = phone;
    document.getElementById('gateBox').style.display = 'none';
    document.getElementById('studentForm').style.display = 'block';
  } catch(err){
    msgEl.innerHTML = '<div class="msg err">Serverga ulanib bo\'lmadi. Internet aloqangizni tekshiring.</div>';
  } finally {
    btn.disabled = false;
  }
}

function fillForm(rec){
  document.getElementById('f_fullname').value = rec.fullname||'';
  document.getElementById('f_birthdate').value = rec.birthdate||'';
  document.getElementById('f_group').value = rec.group||'';
  document.getElementById('f_nationality').value = rec.nationality||'';
  document.getElementById('f_languages').value = rec.languages||'';
  document.getElementById('f_school').value = rec.school||'';
  document.getElementById('f_email').value = rec.email||'';
  document.getElementById('f_telegram').value = rec.telegram||'';
  document.getElementById('f_siblings').value = rec.siblings||'';
  document.getElementById('f_childrenCount').value = rec.childrenCount||'';
  document.getElementById('f_spouseName').value = rec.spouseName||'';
  document.getElementById('f_spousePhone').value = rec.spousePhone||'';
  document.getElementById('f_spouseJob').value = rec.spouseJob||'';
  document.getElementById('f_guardianName').value = rec.guardianName||'';
  document.getElementById('f_guardianPhone').value = rec.guardianPhone||'';
  document.getElementById('f_permaddr').value = rec.permaddr||'';
  document.getElementById('f_currentType').value = rec.currentType||'';
  toggleCurrentType();
  document.getElementById('f_ijaraAddr').value = rec.ijaraAddr||'';
  document.getElementById('f_ijaraOwner').value = rec.ijaraOwner||'';
  document.getElementById('f_ijaraOwnerPhone').value = rec.ijaraOwnerPhone||'';
  document.getElementById('f_ttjRoom').value = rec.ttjRoom||'';
  document.getElementById('f_fatherName').value = rec.fatherName||'';
  document.getElementById('f_fatherJob').value = rec.fatherJob||'';
  document.getElementById('f_fatherPhone').value = rec.fatherPhone||'';
  document.getElementById('f_motherName').value = rec.motherName||'';
  document.getElementById('f_motherJob').value = rec.motherJob||'';
  document.getElementById('f_motherPhone').value = rec.motherPhone||'';
  document.getElementById('f_socialStatus').value = rec.socialStatus||'';
  toggleSocialOther();
  document.getElementById('f_socialOtherText').value = rec.socialOtherText||'';
  document.getElementById('f_talent').value = rec.talent||'';
  document.getElementById('f_workPlace').value = rec.workPlace||'';
  document.getElementById('f_courseLangs').value = rec.courseLangs||'';
  document.getElementById('f_courseCenter').value = rec.courseCenter||'';
  document.getElementById('f_certStart').value = rec.certStart||'';
  document.getElementById('f_certEnd').value = rec.certEnd||'';
  document.getElementById('f_certNumber').value = rec.certNumber||'';
  document.getElementById('f_extra').value = rec.extra||'';
  if(rec.privilege){ const el = document.querySelector('input[name=f_privilege][value="'+rec.privilege+'"]'); if(el) el.checked = true; }
  if(rec.disability){ const el = document.querySelector('input[name=f_disability][value="'+rec.disability+'"]'); if(el) el.checked = true; }
  if(rec.parentDisability){ const el = document.querySelector('input[name=f_parentDisability][value="'+rec.parentDisability+'"]'); if(el) el.checked = true; }
  if(rec.parentDeceased){ const el = document.querySelector('input[name=f_parentDeceased][value="'+rec.parentDeceased+'"]'); if(el) el.checked = true; }
  if(rec.working){ const el = document.querySelector('input[name=f_working][value="'+rec.working+'"]'); if(el) el.checked = true; toggleWorking(); }
  if(rec.courses){ const el = document.querySelector('input[name=f_courses][value="'+rec.courses+'"]'); if(el) el.checked = true; toggleCourses(); }
  if(rec.married){ const el = document.querySelector('input[name=f_married][value="'+rec.married+'"]'); if(el) el.checked = true; toggleMarried(); }
  if(rec.photoFileId){ document.getElementById('photoDrop').classList.add('has-file'); document.getElementById('photoDrop').firstChild.textContent = "Rasm mavjud (o'zgartirish uchun qayta tanlang)"; }
  if(rec.certFileId){ document.getElementById('certDrop').classList.add('has-file'); document.getElementById('certDrop').firstChild.textContent = "Fayl mavjud (o'zgartirish uchun qayta tanlang)"; }
}

async function submitForm(){
  const msgEl = document.getElementById('formMsg');
  const btn = document.getElementById('submitBtn');
  msgEl.innerHTML = "";
  const required = ['f_fullname','f_group','f_phone_display','f_fatherPhone','f_currentType','f_socialStatus'];
  for(const id of required){
    const el = document.getElementById(id);
    if(!el.value){
      msgEl.innerHTML = '<div class="msg err">Iltimos, barcha majburiy (*) maydonlarni to\'ldiring.</div>';
      el.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }
  }
  const radioGroups = ['f_privilege','f_disability','f_parentDisability','f_parentDeceased','f_working','f_married'];
  for(const g of radioGroups){
    if(!document.querySelector('input[name='+g+']:checked')){
      msgEl.innerHTML = '<div class="msg err">Iltimos, barcha majburiy (*) savollarga javob bering.</div>';
      return;
    }
  }

  const fd = new FormData();
  fd.append('fullname', document.getElementById('f_fullname').value);
  fd.append('birthdate', document.getElementById('f_birthdate').value);
  fd.append('group', document.getElementById('f_group').value);
  fd.append('nationality', document.getElementById('f_nationality').value);
  fd.append('languages', document.getElementById('f_languages').value);
  fd.append('school', document.getElementById('f_school').value);
  fd.append('privilege', (document.querySelector('input[name=f_privilege]:checked')||{}).value||'');
  fd.append('email', document.getElementById('f_email').value);
  fd.append('telegram', document.getElementById('f_telegram').value);
  fd.append('permaddr', document.getElementById('f_permaddr').value);
  fd.append('currentType', document.getElementById('f_currentType').value);
  fd.append('ijaraAddr', document.getElementById('f_ijaraAddr').value);
  fd.append('ijaraOwner', document.getElementById('f_ijaraOwner').value);
  fd.append('ijaraOwnerPhone', document.getElementById('f_ijaraOwnerPhone').value);
  fd.append('ttjRoom', document.getElementById('f_ttjRoom').value);
  fd.append('fatherName', document.getElementById('f_fatherName').value);
  fd.append('fatherJob', document.getElementById('f_fatherJob').value);
  fd.append('fatherPhone', document.getElementById('f_fatherPhone').value);
  fd.append('motherName', document.getElementById('f_motherName').value);
  fd.append('motherJob', document.getElementById('f_motherJob').value);
  fd.append('motherPhone', document.getElementById('f_motherPhone').value);
  fd.append('siblings', document.getElementById('f_siblings').value);
  fd.append('married', (document.querySelector('input[name=f_married]:checked')||{}).value||'');
  fd.append('childrenCount', document.getElementById('f_childrenCount').value);
  fd.append('spouseName', document.getElementById('f_spouseName').value);
  fd.append('spousePhone', document.getElementById('f_spousePhone').value);
  fd.append('spouseJob', document.getElementById('f_spouseJob').value);
  fd.append('guardianName', document.getElementById('f_guardianName').value);
  fd.append('guardianPhone', document.getElementById('f_guardianPhone').value);
  fd.append('socialStatus', document.getElementById('f_socialStatus').value);
  fd.append('socialOtherText', document.getElementById('f_socialOtherText').value);
  fd.append('disability', (document.querySelector('input[name=f_disability]:checked')||{}).value||'');
  fd.append('parentDisability', (document.querySelector('input[name=f_parentDisability]:checked')||{}).value||'');
  fd.append('parentDeceased', (document.querySelector('input[name=f_parentDeceased]:checked')||{}).value||'');
  fd.append('talent', document.getElementById('f_talent').value);
  fd.append('working', (document.querySelector('input[name=f_working]:checked')||{}).value||'');
  fd.append('workPlace', document.getElementById('f_workPlace').value);
  fd.append('courses', (document.querySelector('input[name=f_courses]:checked')||{}).value||'');
  fd.append('courseLangs', document.getElementById('f_courseLangs').value);
  fd.append('courseCenter', document.getElementById('f_courseCenter').value);
  fd.append('certStart', document.getElementById('f_certStart').value);
  fd.append('certEnd', document.getElementById('f_certEnd').value);
  fd.append('certNumber', document.getElementById('f_certNumber').value);
  fd.append('extra', document.getElementById('f_extra').value);
  if(photoFile) fd.append('photo', photoFile);
  if(certFile) fd.append('cert', certFile);

  btn.disabled = true;
  btn.textContent = 'Saqlanmoqda...';
  try{
    const res = await fetch('/api/student/me', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + studentToken },
      body: fd
    });
    const body = await res.json();
    if(!res.ok){
      msgEl.innerHTML = '<div class="msg err">' + escapeHtml(body.error || 'Saqlashda xatolik yuz berdi.') + '</div>';
      return;
    }
    document.getElementById('studentForm').style.display = 'none';
    document.getElementById('successBox').style.display = 'block';
  } catch(err){
    msgEl.innerHTML = '<div class="msg err">Serverga ulanib bo\'lmadi. Internet aloqangizni tekshiring va qayta urinib ko\'ring.</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Saqlash';
  }
}

// ---------- ADMIN ----------
async function adminLogin(){
  const pass = document.getElementById('adminPass').value;
  const msgEl = document.getElementById('adminMsg');
  const btn = document.getElementById('adminLoginBtn');
  btn.disabled = true;
  try{
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    const body = await res.json();
    if(!res.ok){
      msgEl.innerHTML = '<div class="msg err">' + escapeHtml(body.error || "Parol noto'g'ri.") + '</div>';
      return;
    }
    adminToken = body.token;
    sessionStorage.setItem('adminToken', adminToken);
    document.getElementById('adminGate').style.display = 'none';
    document.getElementById('adminDash').style.display = 'block';
    await loadAdminData();
  } catch(err){
    msgEl.innerHTML = '<div class="msg err">Serverga ulanib bo\'lmadi.</div>';
  } finally {
    btn.disabled = false;
  }
}

async function loadAdminData(){
  try{
    const res = await fetch('/api/admin/students', { headers: { 'Authorization': 'Bearer ' + adminToken } });
    const body = await res.json();
    if(!res.ok){
      document.getElementById('adminMsg').innerHTML = '<div class="msg err">' + escapeHtml(body.error||'Xatolik') + '</div>';
      document.getElementById('adminDash').style.display = 'none';
      document.getElementById('adminGate').style.display = 'block';
      return;
    }
    adminRecords = body.students;
    document.getElementById('exportBtn').href = '/api/admin/export.csv?token=' + encodeURIComponent(adminToken);
    renderStats();
    renderGroupPills();
    renderAdminTable();
  } catch(err){
    document.getElementById('adminMsg').innerHTML = '<div class="msg err">Serverga ulanib bo\'lmadi.</div>';
  }
}

function renderStats(){
  const total = adminRecords.length;
  const statRow = document.getElementById('statRow');
  let html = '<div class="stat"><b>'+total+'</b>Jami anketalar</div>';
  OFFICIAL_GROUPS.forEach(g=>{
    const c = adminRecords.filter(r=>r.group===g).length;
    html += '<div class="stat"><b>'+c+'</b>'+g+'</div>';
  });
  statRow.innerHTML = html;
}

function renderGroupPills(){
  const el = document.getElementById('groupPills');
  let html = '<span class="group-pill '+(adminActiveGroup==='ALL'?'active':'')+'" onclick="setGroup(\'ALL\')">Barchasi</span>';
  OFFICIAL_GROUPS.forEach(g=>{
    html += '<span class="group-pill '+(adminActiveGroup===g?'active':'')+'" onclick="setGroup(\''+g+'\')">'+g+'</span>';
  });
  el.innerHTML = html;
}
function setGroup(g){ adminActiveGroup = g; renderGroupPills(); renderAdminTable(); }

const COLS = [
  ['photo','Rasm'],['fullname',"Ism Sharifi"],['birthdate',"Tug'ilgan kun"],['group','Guruh'],
  ['nationality','Millati'],['languages','Chet tillari'],['school','Tamomlagan maktabi'],
  ['privilege','Imtiyoz'],['phone','Telefon'],['email','Email'],['telegram','Telegram'],
  ['permaddr','Doimiy manzil'],['currentType','Turar joyi turi'],
  ['ijaraAddr','Ijara manzili'],['ijaraOwner','Ijara egasi'],['ijaraOwnerPhone','Ijara egasi tel.'],
  ['ttjRoom','TTJ qavat/xona'],['fatherName','Otasi F.I.Sh'],['fatherJob','Otasi ish joyi'],['fatherPhone','Otasi tel.'],
  ['motherName','Onasi F.I.Sh'],['motherJob','Onasi ish joyi'],['motherPhone','Onasi tel.'],
  ['siblings','Aka-uka/opa-singil'],
  ['married','Turmush qurganmi'],['childrenCount','Farzandlar soni'],['spouseName','Turmush o\'rtog\'i'],
  ['spousePhone','Turmush o\'rtog\'i tel.'],['spouseJob','Turmush o\'rtog\'i ish joyi'],
  ['guardianName','Vasiy/mas\'ul shaxs'],['guardianPhone','Vasiy tel.'],
  ['socialStatus','Ijtimoiy holat'],['disability','Nogironlik'],['parentDisability','Ota-onada nogironlik'],
  ['parentDeceased','Ota-ona vafoti'],['talent','Qobiliyat'],['working','Ishlaydimi'],['workPlace','Ish joyi'],
  ['courses','Til kursi'],['courseLangs','Kurs tili'],['courseCenter','O\'quv markaz'],
  ['certStart','Sert. sanasi'],['certEnd','Sert. tugash'],['certNumber','Sert. raqami'],['cert','Sertifikat fayli'],
  ['extra','Qo\'shimcha']
];

function renderAdminTable(){
  const headRow = document.getElementById('adminHeadRow');
  headRow.innerHTML = COLS.map(c=>'<th>'+c[1]+'</th>').join('') + '<th>Amallar</th>';
  const search = (document.getElementById('adminSearch').value||'').toLowerCase();
  let rows = adminRecords;
  if(adminActiveGroup !== 'ALL') rows = rows.filter(r=>r.group===adminActiveGroup);
  if(search) rows = rows.filter(r=>(r.fullname||'').toLowerCase().includes(search));
  const body = document.getElementById('adminBody');
  if(rows.length===0){
    body.innerHTML = '<tr><td colspan="'+(COLS.length+1)+'" style="text-align:center;color:var(--ink-soft);padding:20px;">Ma\'lumot topilmadi</td></tr>';
    return;
  }
  const tokenQ = encodeURIComponent(adminToken);
  body.innerHTML = rows.map(r=>{
    return '<tr>' + COLS.map(c=>{
      const key = c[0];
      if(key==='photo'){
        return '<td>' + (r.photoFileId ? '<img class="thumb" src="/api/files/'+r.photoFileId+'?token='+tokenQ+'">' : '—') + '</td>';
      }
      if(key==='cert'){
        return '<td>' + (r.certFileId ? '<a href="/api/files/'+r.certFileId+'?token='+tokenQ+'" target="_blank">Yuklab olish</a>' : '—') + '</td>';
      }
      const val = r[key];
      return '<td>' + (val ? escapeHtml(String(val)) : '') + '</td>';
    }).join('') + '<td><button class="btn small" data-reset-id="'+r.id+'" data-reset-name="'+escapeHtml(r.fullname||'')+'">Parolni tiklash</button></td></tr>';
  }).join('');
}

// Talaba ismi ichida tirnoq kabi belgilar bo'lsa ham xavfsiz ishlashi uchun
// reset tugmalari inline onclick o'rniga hodisa delegatsiyasi orqali ishlaydi.
document.getElementById('adminBody').addEventListener('click', function(e){
  const btn = e.target.closest('[data-reset-id]');
  if(!btn) return;
  resetPin(Number(btn.getAttribute('data-reset-id')), btn.getAttribute('data-reset-name'));
});

async function resetPin(id, name){
  const newPin = prompt('"' + name + '" uchun yangi 4 xonali parol kiriting:');
  if(newPin === null) return;
  if(!/^[0-9]{4}$/.test(newPin)){
    alert('Parol aynan 4 ta raqamdan iborat bo\'lishi kerak.');
    return;
  }
  try{
    const res = await fetch('/api/admin/students/'+id+'/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ newPin })
    });
    const body = await res.json();
    if(!res.ok){ alert(body.error || 'Xatolik yuz berdi.'); return; }
    alert('Yangi parol o\'rnatildi: ' + newPin + '\nBuni talabaga shaxsan (telefon/Telegram orqali) yetkazing.');
  } catch(err){
    alert('Xatolik yuz berdi: server bilan aloqa yo\'q.');
  }
}

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// Agar sahifa qayta ochilganda saqlangan admin tokeni bo'lsa, avtomatik ravishda ulanib ko'rish
(function initAdminIfTokenPresent(){
  if(adminToken){
    document.getElementById('adminGate').style.display = 'none';
    document.getElementById('adminDash').style.display = 'block';
    loadAdminData();
  }
})();
