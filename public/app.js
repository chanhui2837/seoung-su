const API = '';
let token = localStorage.getItem('seongsu_token');
let me = null;

// utils
function headers(){ return token? {Authorization:'Bearer '+token, 'Content-Type':'application/json'} : {'Content-Type':'application/json'}; }
function fmtDate(s){ try{return new Date(s).toLocaleDateString('ko-KR')}catch{return s} }
function daysLeft(dateStr){
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  const diff = Math.ceil((target - today)/86400000);
  if(diff===0) return 'D-Day';
  if(diff>0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

// init
document.addEventListener('DOMContentLoaded', async ()=>{
  const today = new Date();
  document.getElementById('todayDate').textContent = today.toLocaleDateString('ko-KR', {month:'long', day:'numeric', weekday:'short'});
  document.getElementById('resDate').valueAsDate = new Date();
  document.getElementById('evDate').valueAsDate = new Date(Date.now()+86400000);
  document.getElementById('lostDate').valueAsDate = new Date();
  document.getElementById('rvDate').valueAsDate = new Date();
  if(document.getElementById('opDate')) document.getElementById('opDate').valueAsDate = new Date();
  if(token){
    try{
      const r = await fetch('/api/me', {headers: headers()});
      if(r.ok){ me = await r.json(); afterLogin(); }
      else { localStorage.removeItem('seongsu_token'); token=null; showGuest(); }
    }catch{ showGuest(); }
  } else showGuest();
  // load public data even as guest? but show guest view still
  loadCalendar();
  loadLost();
  loadReservations();
  loadMentoring();
  loadFacilities();
  loadMeal(); // 오늘 급식 매일 자동 업데이트
  loadEmoticons(); // 성수고 이모티콘
  // 매일 자정에 급식 갱신 (간단 폴링)
  setInterval(loadMeal, 60*60*1000);
});

function showGuest(){
  document.getElementById('guestView').classList.remove('hidden');
  document.getElementById('appView').classList.add('hidden');
  document.getElementById('headerGuest').classList.remove('hidden');
  document.getElementById('headerGuest').classList.add('flex');
  document.getElementById('headerUser').classList.add('hidden');
  document.getElementById('headerUser').classList.remove('flex');
}
function afterLogin(){
  document.getElementById('guestView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.getElementById('headerGuest').classList.add('hidden');
  document.getElementById('headerGuest').classList.remove('flex');
  document.getElementById('headerUser').classList.remove('hidden');
  document.getElementById('headerUser').classList.add('flex');
  // header
  document.getElementById('hdrName').textContent = me.name;
  document.getElementById('hdrSub').textContent = me.role==='teacher' ? `${me.subject} 선생님` : `${me.studentId}`;
  document.getElementById('welcomeName').textContent = me.name;
  document.getElementById('welcomeSub').textContent = me.role==='teacher' ? `${me.subject} 선생님으로 로그인됨` : `학번 ${me.studentId} · 성수고 학생`;
  // avatar
  const img = document.getElementById('hdrAvatar');
  const fb = document.getElementById('hdrFallback');
  if(me.profileImage){ img.src = me.profileImage; img.classList.remove('hidden'); fb.classList.add('hidden'); }
  else { img.classList.add('hidden'); fb.classList.remove('hidden'); fb.textContent = me.name[0]; }
  // profile modal also
  document.getElementById('profName').textContent = me.name;
  document.getElementById('profSub').textContent = me.role==='teacher' ? `${me.subject} / 선생님` : `학번 ${me.studentId}`;
  const pImg = document.getElementById('profImg');
  const pFb = document.getElementById('profFallback');
  if(me.profileImage){ pImg.src = me.profileImage; pImg.classList.remove('hidden'); pFb.classList.add('hidden'); }
  else { pImg.classList.add('hidden'); pFb.classList.remove('hidden'); pFb.textContent = me.name[0]; }
  const emailDisplay = me.email ? me.email : '<span class="text-slate-400">미등록</span>';
  document.getElementById('profDetail').innerHTML = me.role==='teacher'
    ? `이름: <b>${me.name}</b><br>담당과목: <b>${me.subject}</b><br>이메일: <b>${emailDisplay}</b><br>가입일: ${fmtDate(me.createdAt)}`
    : `이름: <b>${me.name}</b><br>학번: <b>${me.studentId}</b><br>이메일: <b>${emailDisplay}</b><br>가입일: ${fmtDate(me.createdAt)}`;
  // fill profile edit form
  const editName = document.getElementById('profEditName');
  const editSid = document.getElementById('profEditStudentId');
  const editSubWrap = document.getElementById('profEditSubjectWrap');
  const editSub = document.getElementById('profEditSubject');
  const editEmail = document.getElementById('profEditEmail');
  if(editName) editName.value = me.name || '';
  if(editEmail) editEmail.value = me.email || '';
  if(me.role==='teacher'){
    if(editSid) editSid.classList.add('hidden');
    if(editSubWrap) editSubWrap.classList.remove('hidden');
    if(editSub) editSub.value = me.subject || '';
  } else {
    if(editSid) { editSid.classList.remove('hidden'); editSid.value = me.studentId || ''; }
    if(editSubWrap) editSubWrap.classList.add('hidden');
  }
  const editMsg = document.getElementById('profEditMsg');
  if(editMsg) editMsg.textContent='';
  // refresh data with auth
  loadCalendar(); loadLost(); loadReservations(); loadMentoring();
  updateRoleUI();
}
function updateRoleUI(){
  const isTeacher = me && me.role==='teacher';
  const calTeacher = document.getElementById('calTeacherOnly');
  const calStudent = document.getElementById('calStudentNotice');
  if(calTeacher && calStudent){
    calTeacher.classList.toggle('hidden', !isTeacher);
    calStudent.classList.toggle('hidden', isTeacher);
  }
  const facTeacher = document.getElementById('facilityTeacherBox');
  if(facTeacher) facTeacher.classList.toggle('hidden', !isTeacher);
}

function logout(){
  localStorage.removeItem('seongsu_token'); token=null; me=null;
  location.reload();
}

// auth tabs
function switchAuth(which){
  const isLogin = which==='login';
  document.getElementById('formLogin').classList.toggle('hidden', !isLogin);
  document.getElementById('formReg').classList.toggle('hidden', isLogin);
  document.getElementById('tabLogin').className = isLogin? 'px-5 py-2 rounded-full font-bold text-sm bg-slate-900 text-white' : 'px-5 py-2 rounded-full font-bold text-sm text-slate-600';
  document.getElementById('tabReg').className = !isLogin? 'px-5 py-2 rounded-full font-bold text-sm bg-slate-900 text-white' : 'px-5 py-2 rounded-full font-bold text-sm text-slate-600';
  // modal tabs also
  if(document.getElementById('mTabLogin')){
    document.getElementById('mTabLogin').className = isLogin? 'px-4 py-1.5 rounded-full font-bold text-sm bg-slate-900 text-white' : 'px-4 py-1.5 rounded-full font-bold text-sm';
    document.getElementById('mTabReg').className = !isLogin? 'px-4 py-1.5 rounded-full font-bold text-sm bg-slate-900 text-white' : 'px-4 py-1.5 rounded-full font-bold text-sm';
  }
}
function toggleLoginFields(){
  const role = document.querySelector('input[name="loginRole"]:checked').value;
  document.getElementById('loginStudentId').classList.toggle('hidden', role==='teacher');
  document.getElementById('loginSubjectWrap').classList.toggle('hidden', role!=='teacher');
  if(role==='teacher') document.getElementById('loginStudentId').removeAttribute('required');
  else document.getElementById('loginStudentId').setAttribute('required','');
}
function toggleRegFields(){
  const role = document.querySelector('input[name="regRole"]:checked').value;
  document.getElementById('regStudentId').classList.toggle('hidden', role==='teacher');
  document.getElementById('regSubjectWrap').classList.toggle('hidden', role!=='teacher');
  if(role==='teacher'){ document.getElementById('regStudentId').removeAttribute('required'); document.getElementById('regSubject').setAttribute('required',''); }
  else { document.getElementById('regStudentId').setAttribute('required',''); document.getElementById('regSubject').removeAttribute('required'); }
}
function openAuth(which){
  // if desktop guestView already visible, just switch tab and scroll
  if(window.innerWidth>=1024 && !token){
    switchAuth(which);
    document.getElementById('guestView').scrollIntoView({behavior:'smooth'});
    return;
  }
  document.getElementById('authModal').classList.remove('hidden');
  // clone forms into modal container for mobile
  const container = document.getElementById('modalAuthContainer');
  // create simple duplicate forms functionality by reusing same handlers but with modal inputs
  // Instead, just show the same guest card inside modal by moving? Simpler: create inline modal forms
  container.innerHTML = `
    <form onsubmit="handleLogin(event, true)" class="space-y-3 ${which!=='login'?'hidden':''}" id="mFormLogin">
      <div class="flex gap-2">
        <label class="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 rounded-full border text-sm cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:text-white"><input type="radio" name="mLoginRole" value="student" checked class="hidden" onchange="toggleMLogin()"> 학생</label>
        <label class="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 rounded-full border text-sm cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:text-white"><input type="radio" name="mLoginRole" value="teacher" class="hidden" onchange="toggleMLogin()"> 선생님</label>
      </div>
      <input id="mLoginName" placeholder="이름" required class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl">
      <input id="mLoginSid" placeholder="학번" class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl">
      <div id="mLoginSubWrap" class="hidden"><select id="mLoginSub" class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl"><option value="">담당과목 선택</option><option>국어</option><option>수학</option><option>영어</option><option>과학</option><option>사회</option><option>체육</option><option>음악</option><option>미술</option><option>정보</option><option>기타</option></select></div>
      <input id="mLoginPw" type="password" placeholder="비밀번호" required class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl">
      <button class="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black">로그인하기 →</button>
      <button type="button" onclick="openAccountFind()" class="w-full text-xs text-slate-500 underline">계정을 잊으셨나요? 계정 찾기 →</button>
      <div id="mLoginMsg" class="text-sm text-red-600 text-center"></div>
    </form>
    <form onsubmit="handleRegister(event, true)" class="space-y-3 ${which!=='register'?'hidden':''}" id="mFormReg">
      <div class="flex gap-2">
        <label class="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 rounded-full border text-sm cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:text-white"><input type="radio" name="mRegRole" value="student" checked class="hidden" onchange="toggleMReg()"> 학생</label>
        <label class="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 rounded-full border text-sm cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:text-white"><input type="radio" name="mRegRole" value="teacher" class="hidden" onchange="toggleMReg()"> 선생님</label>
      </div>
      <input id="mRegName" placeholder="이름" required class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl">
      <input id="mRegSid" placeholder="학번 5자리" class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl">
      <div id="mRegSubWrap" class="hidden"><select id="mRegSub" class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl"><option value="">담당과목 선택</option><option>국어</option><option>수학</option><option>영어</option><option>과학</option><option>사회</option><option>체육</option><option>음악</option><option>미술</option><option>정보</option><option>기타</option></select></div>
      <input id="mRegEmail" type="email" placeholder="이메일 (계정 찾기용)" class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl">
      <input id="mRegPw" type="password" placeholder="비밀번호" required class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl">
      <input id="mRegPw2" type="password" placeholder="비밀번호 확인" required class="w-full px-4 py-3.5 bg-slate-50 border rounded-2xl">
      <button class="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black">가입하고 시작하기</button>
      <div id="mRegMsg" class="text-sm text-red-600 text-center"></div>
    </form>
  `;
  // switch visibility
  document.getElementById('mFormLogin').classList.toggle('hidden', which!=='login');
  document.getElementById('mFormReg').classList.toggle('hidden', which!=='register');
  switchAuth(which);
}
function closeAuth(){ document.getElementById('authModal').classList.add('hidden'); }
function toggleMLogin(){
  const role = document.querySelector('input[name="mLoginRole"]:checked').value;
  document.getElementById('mLoginSid').classList.toggle('hidden', role==='teacher');
  document.getElementById('mLoginSubWrap').classList.toggle('hidden', role!=='teacher');
}
function toggleMReg(){
  const role = document.querySelector('input[name="mRegRole"]:checked').value;
  document.getElementById('mRegSid').classList.toggle('hidden', role==='teacher');
  document.getElementById('mRegSubWrap').classList.toggle('hidden', role!=='teacher');
}
// intercept switchAuth to also handle modal forms
const origSwitchAuth = switchAuth;
switchAuth = function(which){
  origSwitchAuth(which);
  const ml = document.getElementById('mFormLogin');
  const mr = document.getElementById('mFormReg');
  if(ml && mr){
    ml.classList.toggle('hidden', which!=='login');
    mr.classList.toggle('hidden', which!=='register');
    document.getElementById('mTabLogin').className = which==='login'? 'px-4 py-1.5 rounded-full font-bold text-sm bg-slate-900 text-white' : 'px-4 py-1.5 rounded-full font-bold text-sm';
    document.getElementById('mTabReg').className = which==='register'? 'px-4 py-1.5 rounded-full font-bold text-sm bg-slate-900 text-white' : 'px-4 py-1.5 rounded-full font-bold text-sm';
  }
}

async function handleLogin(e, isModal=false){
  e.preventDefault();
  const get = (id)=> document.getElementById(id).value.trim();
  let name, role, studentId, subject, pw;
  if(isModal){
    name = get('mLoginName'); role = document.querySelector('input[name="mLoginRole"]:checked').value;
    studentId = get('mLoginSid'); subject = document.getElementById('mLoginSub').value; pw = get('mLoginPw');
  } else {
    name = get('loginName'); role = document.querySelector('input[name="loginRole"]:checked').value;
    studentId = get('loginStudentId'); subject = document.getElementById('loginSubject').value; pw = get('loginPw');
  }
  const msgEl = document.getElementById(isModal?'mLoginMsg':'loginMsg');
  msgEl.textContent = '로그인 중...';
  try{
    const r = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, role, studentId, subject, password: pw})});
    const j = await r.json();
    if(!r.ok) throw new Error(j.error||'실패');
    token = j.token; localStorage.setItem('seongsu_token', token); me = j.user;
    msgEl.textContent = '';
    closeAuth();
    afterLogin();
  }catch(err){ msgEl.textContent = err.message; }
}
async function handleRegister(e, isModal=false){
  e.preventDefault();
  const get = (id)=> document.getElementById(id).value.trim();
  let name, role, studentId, subject, pw, pw2, email;
  if(isModal){
    name = get('mRegName'); role = document.querySelector('input[name="mRegRole"]:checked').value;
    studentId = get('mRegSid'); subject = document.getElementById('mRegSub').value; pw = get('mRegPw'); pw2 = get('mRegPw2'); email = get('mRegEmail');
  } else {
    name = get('regName'); role = document.querySelector('input[name="regRole"]:checked').value;
    studentId = get('regStudentId'); subject = document.getElementById('regSubject').value; pw = get('regPw'); pw2 = get('regPw2'); email = document.getElementById('regEmail') ? get('regEmail') : '';
  }
  const msgEl = document.getElementById(isModal?'mRegMsg':'regMsg');
  if(pw!==pw2) { msgEl.textContent='비밀번호가 일치하지 않습니다.'; return; }
  msgEl.textContent='가입 중...';
  try{
    const r = await fetch('/api/register', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, role, studentId, subject, password: pw, email})});
    const j = await r.json();
    if(!r.ok) throw new Error(j.error||'실패');
    token = j.token; localStorage.setItem('seongsu_token', token); me = j.user;
    msgEl.textContent=''; closeAuth(); afterLogin();
  }catch(err){ msgEl.textContent = err.message; }
}

// profile
function openProfile(){
  // refresh edit fields from current me before showing
  if(me){
    const editName = document.getElementById('profEditName');
    const editSid = document.getElementById('profEditStudentId');
    const editSubWrap = document.getElementById('profEditSubjectWrap');
    const editSub = document.getElementById('profEditSubject');
    const editEmail = document.getElementById('profEditEmail');
    if(editName) editName.value = me.name || '';
    if(editEmail) editEmail.value = me.email || '';
    if(me.role==='teacher'){
      if(editSid) editSid.classList.add('hidden');
      if(editSubWrap) editSubWrap.classList.remove('hidden');
      if(editSub) editSub.value = me.subject || '';
    } else {
      if(editSid) { editSid.classList.remove('hidden'); editSid.value = me.studentId || ''; }
      if(editSubWrap) editSubWrap.classList.add('hidden');
    }
    const msg = document.getElementById('profEditMsg');
    if(msg) msg.textContent='';
  }
  document.getElementById('profileModal').classList.remove('hidden');
}
function closeProfile(){ document.getElementById('profileModal').classList.add('hidden'); }
async function saveProfile(e){
  e.preventDefault();
  const msgEl = document.getElementById('profEditMsg');
  const name = document.getElementById('profEditName').value.trim();
  const email = document.getElementById('profEditEmail').value.trim();
  let studentId = null, subject = null;
  if(me.role==='teacher'){
    subject = document.getElementById('profEditSubject').value;
  } else {
    studentId = document.getElementById('profEditStudentId').value.trim();
  }
  msgEl.textContent='저장 중...';
  msgEl.className='text-sm text-center text-slate-500';
  try{
    const body = { name, email };
    if(me.role==='teacher') body.subject = subject;
    else body.studentId = studentId;
    const r = await fetch('/api/profile', {method:'PUT', headers: headers(), body: JSON.stringify(body)});
    const j = await r.json();
    if(!r.ok) throw new Error(j.error || '저장 실패');
    me = j.user; token = j.token; localStorage.setItem('seongsu_token', token);
    msgEl.textContent='저장되었습니다!';
    msgEl.className='text-sm text-center text-green-600';
    afterLogin();
    setTimeout(()=> msgEl.textContent='',1500);
  }catch(err){
    msgEl.textContent=err.message;
    msgEl.className='text-sm text-center text-red-600';
  }
}
// Account find / reset
function openAccountFind(){
  closeAuth();
  document.getElementById('accountFindModal').classList.remove('hidden');
  document.getElementById('findMsg').textContent='';
  document.getElementById('findResult').classList.add('hidden');
  document.getElementById('findResult').innerHTML='';
  document.getElementById('resetArea').classList.add('hidden');
  document.getElementById('resetMsg').textContent='';
}
function closeAccountFind(){ document.getElementById('accountFindModal').classList.add('hidden'); }
let _foundEmail = '';
let _resetRole = 'student';
function toggleResetRole(role){
  _resetRole = role;
  document.getElementById('resetRoleStudent').className = role==='student' ? 'flex-1 py-2 bg-slate-900 text-white rounded-full text-xs font-bold' : 'flex-1 py-2 bg-white border rounded-full text-xs font-bold';
  document.getElementById('resetRoleTeacher').className = role==='teacher' ? 'flex-1 py-2 bg-slate-900 text-white rounded-full text-xs font-bold' : 'flex-1 py-2 bg-white border rounded-full text-xs font-bold';
  const sid = document.getElementById('resetStudentId');
  const sub = document.getElementById('resetSubject');
  if(role==='teacher'){ sid.classList.add('hidden'); sub.classList.remove('hidden'); }
  else { sid.classList.remove('hidden'); sub.classList.add('hidden'); }
}
async function findAccount(){
  const email = document.getElementById('findEmail').value.trim();
  const msgEl = document.getElementById('findMsg');
  const resultEl = document.getElementById('findResult');
  const resetArea = document.getElementById('resetArea');
  if(!email){ msgEl.textContent='이메일을 입력해주세요.'; msgEl.className='text-sm text-center text-red-600'; return; }
  msgEl.textContent='조회 중...'; msgEl.className='text-sm text-center text-slate-500';
  resultEl.classList.add('hidden'); resetArea.classList.add('hidden');
  try{
    const r = await fetch('/api/account/find', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email})});
    const j = await r.json();
    if(!r.ok) throw new Error(j.error || '조회 실패');
    _foundEmail = email;
    msgEl.textContent=''; msgEl.className='text-sm text-center';
    resultEl.classList.remove('hidden');
    // show users found (아이디 정보)
    resultEl.innerHTML = '<div class="bg-slate-50 border rounded-2xl p-4 space-y-2"><div class="font-bold text-sm">찾은 계정 ('+j.users.length+'개)</div>' + j.users.map(u=>{
      const isTeacher = u.role==='teacher';
      const idLine = isTeacher ? '이름: <b>'+u.name+'</b> / 과목: <b>'+u.subject+'</b> (선생님)' : '이름: <b>'+u.name+'</b> / 학번: <b>'+u.studentId+'</b> (학생)';
      const emailLine = '이메일: '+u.email;
      const created = '가입일: '+fmtDate(u.createdAt);
      return '<div class="bg-white border rounded-xl p-3 text-sm">'+idLine+'<br><span class="text-xs text-slate-500">'+emailLine+' · '+created+'</span></div>';
    }).join('') + '<p class="text-xs text-amber-600 mt-2">⚠️ 비밀번호는 암호화되어 표시할 수 없습니다. 아래에서 새 비밀번호로 재설정하세요.</p></div>';
    // prefill reset form with first found user's info
    if(j.users.length>0){
      const first = j.users[0];
      document.getElementById('resetName').value = first.name || '';
      if(first.role==='teacher'){
        toggleResetRole('teacher');
        document.getElementById('resetSubject').value = first.subject || '';
      } else {
        toggleResetRole('student');
        document.getElementById('resetStudentId').value = first.studentId || '';
      }
    }
    resetArea.classList.remove('hidden');
  }catch(err){
    msgEl.textContent=err.message; msgEl.className='text-sm text-center text-red-600';
  }
}
async function resetPassword(){
  const email = _foundEmail || document.getElementById('findEmail').value.trim();
  const name = document.getElementById('resetName').value.trim();
  const pw = document.getElementById('resetPw').value;
  const pw2 = document.getElementById('resetPw2').value;
  const msgEl = document.getElementById('resetMsg');
  if(!email || !name || !pw){ msgEl.textContent='이메일, 이름, 새 비밀번호를 모두 입력해주세요.'; msgEl.className='text-sm text-center text-red-600'; return; }
  if(pw!==pw2){ msgEl.textContent='비밀번호가 일치하지 않습니다.'; msgEl.className='text-sm text-center text-red-600'; return; }
  if(pw.length<4){ msgEl.textContent='비밀번호는 4자 이상이어야 합니다.'; msgEl.className='text-sm text-center text-red-600'; return; }
  let studentId = document.getElementById('resetStudentId').value.trim();
  let subject = document.getElementById('resetSubject').value;
  msgEl.textContent='변경 중...'; msgEl.className='text-sm text-center text-slate-500';
  try{
    const body = { email, name, newPassword: pw };
    if(_resetRole==='teacher') body.subject = subject;
    else body.studentId = studentId;
    const r = await fetch('/api/account/reset-password', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const j = await r.json();
    if(!r.ok) throw new Error(j.error || '변경 실패');
    msgEl.textContent='✅ '+j.message;
    msgEl.className='text-sm text-center text-green-600';
    setTimeout(()=>{ closeAccountFind(); alert('비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.'); }, 800);
  }catch(err){ msgEl.textContent=err.message; msgEl.className='text-sm text-center text-red-600'; }
}
async function uploadProfileImg(){
  const file = document.getElementById('profFile').files[0];
  if(!file) return;
  const fd = new FormData(); fd.append('image', file);
  document.getElementById('profMsg').textContent='업로드 중...';
  try{
    const r = await fetch('/api/profile/image', {method:'POST', headers:{Authorization:'Bearer '+token}, body: fd});
    const j = await r.json();
    if(!r.ok) throw new Error(j.error);
    me = j.user; token = j.token; localStorage.setItem('seongsu_token', token);
    document.getElementById('profMsg').textContent='프로필 사진이 변경되었습니다!';
    afterLogin();
    setTimeout(()=>document.getElementById('profMsg').textContent='',2000);
  }catch(e){ document.getElementById('profMsg').textContent=e.message; }
}
async function removeProfileImg(){
  document.getElementById('profMsg').textContent='처리 중...';
  const r = await fetch('/api/profile/image', {method:'DELETE', headers: headers()});
  const j = await r.json();
  if(r.ok){ me=j.user; token=j.token; localStorage.setItem('seongsu_token', token); afterLogin(); document.getElementById('profMsg').textContent='기본 이미지로 변경됨'; setTimeout(()=>document.getElementById('profMsg').textContent='',1500); }
  else document.getElementById('profMsg').textContent=j.error;
}

// tabs
function switchTab(name){
  document.querySelectorAll('.tabBtn').forEach(b=>{
    const is = b.dataset.tab===name;
    b.className = is? 'tabBtn whitespace-nowrap px-5 py-2.5 rounded-full font-bold bg-slate-900 text-white' : 'tabBtn whitespace-nowrap px-5 py-2.5 rounded-full font-bold bg-white border';
  });
  document.querySelectorAll('.tabPane').forEach(p=> p.classList.add('hidden'));
  document.getElementById('tab-'+name).classList.remove('hidden');
}

// Calendar (선생님만 작성)
async function loadCalendar(){
  const r = await fetch('/api/events');
  const list = await r.json();
  list.sort((a,b)=> new Date(a.date)-new Date(b.date));
  const nextExam = list.find(e=> e.category==='시험' && new Date(e.date)>= new Date().setHours(0,0,0,0));
  document.getElementById('dDayText').textContent = nextExam? daysLeft(nextExam.date) : 'D-?';
  const c = document.getElementById('calendarList');
  if(list.length===0){ c.innerHTML='<div class="text-sm text-slate-500 text-center py-8">등록된 일정이 없습니다. 선생님이 일정을 등록하면 여기에 표시됩니다.</div>'; return; }
  c.innerHTML = list.map(ev=>{
    const d = daysLeft(ev.date);
    const color = ev.color==='red'?'bg-red-50 border-red-200 text-red-700' : ev.color==='orange'?'bg-orange-50 border-orange-200 text-orange-700' : ev.color==='green'?'bg-green-50 border-green-200 text-green-700':'bg-blue-50 border-blue-200 text-blue-700';
    const badge = `<span class="px-2 py-1 rounded-full text-xs font-bold border ${color}">${ev.category}</span>`;
    const canDelete = me && me.role==='teacher';
    return `<div class="flex items-center gap-3 p-4 border rounded-2xl hover:bg-slate-50">
      <div class="w-14 h-14 rounded-2xl bg-slate-900 text-white grid place-items-center text-center leading-none">
        <div class="text-[11px] opacity-70">${ev.date.slice(5,7)}월</div><div class="font-black text-lg">${ev.date.slice(8,10)}</div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-bold truncate">${ev.title}</div>
        <div class="text-xs text-slate-500">${ev.date} · ${ev.author} ${badge}</div>
      </div>
      <div class="text-right">
        <div class="font-black text-sm ${d.includes('D-Day')?'text-red-600': d.startsWith('D-')?'text-blue-600':'text-slate-400'}">${d}</div>
        ${canDelete ? `<button onclick="deleteEvent('${ev.id}')" class="text-[11px] text-slate-400 hover:text-red-600">삭제</button>`:''}
      </div>
    </div>`;
  }).join('');
}
async function addEvent(e){
  e.preventDefault();
  if(!token) return alert('로그인 후 등록 가능합니다.');
  if(me && me.role!=='teacher') return alert('캘린더는 선생님만 작성할 수 있습니다.');
  const title = document.getElementById('evTitle').value.trim();
  const date = document.getElementById('evDate').value;
  const category = document.getElementById('evCat').value;
  const msgEl = document.getElementById('calMsg');
  if(msgEl) msgEl.textContent='등록 중...';
  const r = await fetch('/api/events', {method:'POST', headers: headers(), body: JSON.stringify({title, date, category})});
  const j = await r.json();
  if(r.ok){ 
    document.getElementById('evTitle').value=''; 
    if(msgEl) { msgEl.textContent='등록 완료'; msgEl.className='text-sm text-green-600 text-center'; setTimeout(()=>msgEl.textContent='',1500); }
    loadCalendar(); 
  } else {
    if(msgEl) { msgEl.textContent=j.error; msgEl.className='text-sm text-red-600 text-center'; }
    else alert(j.error);
  }
}
async function deleteEvent(id){
  if(!confirm('삭제할까요?')) return;
  const r = await fetch('/api/events/'+id, {method:'DELETE', headers: headers()});
  const j = await r.json().catch(()=>null);
  if(r.ok) loadCalendar(); else alert(j && j.error ? j.error : '삭제 실패');
}

// Lost
let lostCache=[];
async function loadLost(){
  const r = await fetch('/api/lost'); lostCache = await r.json(); renderLost();
}
function renderLost(){
  const f = document.getElementById('lostFilter').value;
  let list = lostCache;
  if(f) list = list.filter(x=> x.type===f);
  const c = document.getElementById('lostList');
  if(list.length===0){ c.innerHTML='<div class="col-span-2 text-center py-10 text-slate-500 text-sm">등록된 분실물이 없습니다. 첫 글을 올려보세요!</div>'; return; }
  c.innerHTML = list.map(item=>`
    <div class="border rounded-3xl overflow-hidden bg-white card-hover">
      ${item.image? `<img src="${item.image}" class="w-full h-44 object-cover">` : `<div class="w-full h-44 bg-slate-100 grid place-items-center text-3xl">📦</div>`}
      <div class="p-4">
        <div class="flex items-center gap-2">
          <span class="px-2 py-1 rounded-full text-xs font-bold ${item.type==='습득물'?'bg-blue-600 text-white':'bg-amber-400 text-slate-900'}">${item.type}</span>
          <span class="px-2 py-1 rounded-full text-xs font-bold ${item.status==='보관중'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-slate-900 text-white'}">${item.status}</span>
          <span class="ml-auto text-xs text-slate-500">${item.date} · ${item.location||'위치미상'}</span>
        </div>
        <div class="font-black mt-2">${item.title}</div>
        <div class="text-sm text-slate-600 mt-1 line-clamp-2">${item.description||''}</div>
        <div class="text-xs text-slate-500 mt-2">올린 사람: ${item.author}</div>
        ${item.comments.length? `<div class="mt-3 bg-slate-50 rounded-xl p-3 space-y-1">${item.comments.map(cm=>`<div class="text-xs"><b>${cm.author}:</b> ${cm.text}</div>`).join('')}</div>`:''}
        <div class="mt-3 flex gap-2">
          ${me? `<input id="cm-${item.id}" placeholder="댓글" class="flex-1 px-3 py-2 bg-slate-50 border rounded-full text-sm"><button onclick="commentLost('${item.id}')" class="px-3 py-2 bg-slate-900 text-white rounded-full text-xs font-bold">등록</button>`:''}
          ${me && me.id===item.authorId? `<button onclick="toggleLostStatus('${item.id}')" class="px-3 py-2 bg-white border rounded-full text-xs font-bold">상태변경</button>`:''}
        </div>
      </div>
    </div>
  `).join('');
}
async function addLost(e){
  e.preventDefault();
  if(!token) return alert('로그인 필요');
  const fd = new FormData();
  fd.append('title', document.getElementById('lostTitle').value);
  fd.append('location', document.getElementById('lostLoc').value);
  fd.append('date', document.getElementById('lostDate').value);
  fd.append('description', document.getElementById('lostDesc').value);
  fd.append('type', document.getElementById('lostType').value);
  const f = document.getElementById('lostImg').files[0];
  if(f) fd.append('image', f);
  const r = await fetch('/api/lost', {method:'POST', headers:{Authorization:'Bearer '+token}, body: fd});
  const j = await r.json();
  if(r.ok){ e.target.reset(); document.getElementById('lostDate').valueAsDate = new Date(); loadLost(); } else alert(j.error);
}
async function commentLost(id){
  const inp = document.getElementById('cm-'+id);
  const text = inp.value.trim(); if(!text) return;
  const r = await fetch('/api/lost/'+id+'/comment', {method:'POST', headers: headers(), body: JSON.stringify({text})});
  if(r.ok) loadLost(); else alert('실패');
}
async function toggleLostStatus(id){
  const r = await fetch('/api/lost/'+id+'/status', {method:'PATCH', headers: headers()});
  if(r.ok) loadLost(); else { const j=await r.json(); alert(j.error); }
}

// Facilities (선생님 개방 → 학생 예약)
let facs=[];
async function loadFacilities(){
  const r = await fetch('/api/facilities'); facs = await r.json();
  loadReservations();
}
async function loadReservations(){
  const date = document.getElementById('resDate').value;
  const fac = document.getElementById('resFacFilter').value;
  // openings
  let urlOpen = '/api/facility-openings?';
  if(date) urlOpen+=`date=${date}&`;
  if(fac) urlOpen+=`facility=${fac}`;
  const rOpen = await fetch(urlOpen);
  const openings = await rOpen.json();
  // reservations
  let urlRes = '/api/reservations?';
  if(date) urlRes+=`date=${date}&`;
  if(fac) urlRes+=`facility=${fac}`;
  const rRes = await fetch(urlRes);
  const list = await rRes.json();

  // facility grid: show only opened slots
  const grid = document.getElementById('facilityGrid');
  if(openings.length===0){
    grid.innerHTML = `<div class="col-span-2 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
      <div class="text-3xl">🏫</div>
      <div class="font-bold mt-2">아직 개방된 시설이 없습니다</div>
      <div class="text-xs text-slate-500 mt-1">시설 담당 선생님이 개방하면<br>학생들이 예약할 수 있습니다.</div>
      ${me && me.role==='teacher' ? `<div class="mt-3 text-xs text-blue-600 font-bold">오른쪽에서 시설을 개방해보세요 →</div>` : ``}
    </div>`;
  } else {
    // group by facility
    const grouped = {};
    openings.forEach(o=>{ if(!grouped[o.facility]) grouped[o.facility]=[]; grouped[o.facility].push(o); });
    grid.innerHTML = Object.keys(grouped).map(fid=>{
      const f = facs.find(x=>x.id===fid) || {name:fid, icon:'🏫'};
      const slots = grouped[fid];
      return `<div class="border rounded-2xl p-4">
        <div class="font-black flex items-center gap-2"><span class="text-xl">${f.icon}</span> ${f.name}</div>
        <div class="mt-2 grid grid-cols-2 gap-2">
          ${slots.map(o=>{
            const isReserved = list.some(r=> r.facility===o.facility && r.date===o.date && r.slot===o.slot);
            const rv = list.find(r=> r.facility===o.facility && r.date===o.date && r.slot===o.slot);
            return `<div class="px-2 py-2 rounded-xl text-xs font-bold text-center border ${isReserved?'bg-red-50 border-red-200 text-red-700':'bg-emerald-50 border-emerald-200 text-emerald-700'}">
              ${o.slot}<br>${isReserved? `<span class="text-[11px]">${rv.author} 예약됨</span>`:'<span class="text-emerald-700">예약가능</span>'}
              <div class="text-[10px] font-normal text-slate-500">${o.author} 개방</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  }

  // openings list (teacher can delete)
  const openListEl = document.getElementById('openingsList');
  if(openings.length===0){
    openListEl.innerHTML = '';
  } else {
    openListEl.innerHTML = `<div class="mt-4"><div class="text-sm font-bold mb-2">개방된 시설 (${openings.length})</div>` + openings.map(o=>{
      const f = facs.find(x=>x.id===o.facility) || {name:o.facility, icon:'🏫'};
      const isReserved = list.some(r=> r.facility===o.facility && r.date===o.date && r.slot===o.slot);
      return `<div class="flex items-center gap-2 p-2 border rounded-xl text-sm">
        <span>${f.icon} ${f.name} ${o.date} ${o.slot}</span>
        <span class="text-xs text-slate-500">${o.author} ${o.subject||''}</span>
        ${isReserved? `<span class="ml-auto px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">예약됨</span>`: `<span class="ml-auto px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">개방중</span>`}
        ${me && me.role==='teacher' && me.id===o.authorId && !isReserved ? `<button onclick="deleteOpening('${o.id}')" class="px-2 py-1 bg-white border rounded-full text-xs">삭제</button>`:``}
      </div>`;
    }).join('') + `</div>`;
  }

  // reservation list
  const c = document.getElementById('reserveList');
  if(list.length===0) c.innerHTML = '<div class="text-sm text-slate-500 text-center py-4">선택한 날짜에 예약이 없습니다.</div>';
  else c.innerHTML = list.map(rv=>{
    const facName = facs.find(f=>f.id===rv.facility)?.name || rv.facility;
    return `<div class="flex items-center gap-3 p-3 border rounded-2xl">
      <div class="w-10 h-10 rounded-full bg-violet-100 grid place-items-center">${facs.find(f=>f.id===rv.facility)?.icon||'🏫'}</div>
      <div class="flex-1"><div class="font-bold text-sm">${facName} · ${rv.slot}</div><div class="text-xs text-slate-500">${rv.date} · ${rv.author} ${rv.purpose? '· '+rv.purpose:''}</div></div>
      ${me && me.id===rv.authorId? `<button onclick="cancelReserve('${rv.id}')" class="px-3 py-1.5 bg-white border rounded-full text-xs font-bold">취소</button>`:''}
    </div>`;
  }).join('');
}
async function addOpening(e){
  e.preventDefault();
  if(!token) return alert('로그인 필요');
  if(me && me.role!=='teacher') return alert('시설 개방은 선생님만 가능합니다.');
  const body = {
    facility: document.getElementById('opFac').value,
    date: document.getElementById('opDate').value,
    slot: document.getElementById('opSlot').value,
    note: document.getElementById('opNote').value
  };
  const msg = document.getElementById('opMsg');
  msg.textContent='개방 중...';
  const r = await fetch('/api/facility-openings', {method:'POST', headers: headers(), body: JSON.stringify(body)});
  const j = await r.json();
  if(r.ok){ msg.textContent='개방 완료!'; msg.className='text-sm text-green-600 text-center'; loadReservations(); e.target.reset(); document.getElementById('opDate').valueAsDate = new Date(); setTimeout(()=>msg.textContent='',2000); }
  else { msg.textContent=j.error; msg.className='text-sm text-red-600 text-center'; }
}
async function deleteOpening(id){
  if(!confirm('개방을 취소할까요?')) return;
  const r = await fetch('/api/facility-openings/'+id, {method:'DELETE', headers: headers()});
  const j = await r.json().catch(()=>({}));
  if(r.ok) loadReservations(); else alert(j.error||'삭제 실패');
}
async function addReservation(e){
  e.preventDefault();
  if(!token) return alert('로그인 필요');
  const body = {
    facility: document.getElementById('rvFac').value,
    date: document.getElementById('rvDate').value,
    slot: document.getElementById('rvSlot').value,
    purpose: document.getElementById('rvPurpose').value
  };
  const msg = document.getElementById('rvMsg');
  msg.textContent='예약 중...';
  const r = await fetch('/api/reservations', {method:'POST', headers: headers(), body: JSON.stringify(body)});
  const j = await r.json();
  if(r.ok){ msg.textContent='예약 완료!'; msg.className='text-sm text-green-600 text-center'; loadReservations(); e.target.reset(); document.getElementById('rvDate').valueAsDate = new Date(); setTimeout(()=>msg.textContent='',2000); }
  else { msg.textContent=j.error; msg.className='text-sm text-red-600 text-center'; }
}
async function cancelReserve(id){
  if(!confirm('예약을 취소할까요?')) return;
  const r = await fetch('/api/reservations/'+id, {method:'DELETE', headers: headers()});
  if(r.ok) loadReservations(); else { const j=await r.json(); alert(j.error); }
}

// Mentoring
let mentorCache=[];
async function loadMentoring(){
  const r = await fetch('/api/mentoring'); mentorCache = await r.json(); renderMentoring();
}
function renderMentoring(){
  const f = document.getElementById('mentorFilter').value;
  let list = mentorCache;
  if(f) list = list.filter(x=> x.subject===f);
  const c = document.getElementById('mentorList');
  if(list.length===0){ c.innerHTML='<div class="text-center py-10 text-slate-500 text-sm">등록된 멘토링이 없습니다.</div>'; return; }
  c.innerHTML = list.map(m=>`
    <div class="border rounded-2xl p-4">
      <div class="flex gap-2 items-center">
        <span class="px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-bold">${m.type}</span>
        <span class="px-2 py-1 bg-slate-100 rounded-full text-xs font-bold">${m.subject}</span>
        <span class="ml-auto text-xs text-slate-500">${fmtDate(m.createdAt)} · ${m.author} ${m.role==='teacher'?'👨‍🏫':''}</span>
      </div>
      <div class="font-black mt-2">${m.title}</div>
      <div class="text-sm text-slate-600 mt-1">${m.desc||''}</div>
      <div class="mt-3 flex items-center gap-2">
        <div class="text-xs text-slate-500">신청 ${m.applicants.length}명 ${m.applicants.map(a=>a.name).join(', ')}</div>
        <div class="ml-auto flex gap-2">
          ${me && me.id!==m.authorId? `<button onclick="applyMentor('${m.id}')" class="px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold">신청하기</button>`:''}
          ${me && me.id===m.authorId? `<button onclick="deleteMentor('${m.id}')" class="px-3 py-1.5 bg-white border rounded-full text-xs font-bold">삭제</button>`:''}
        </div>
      </div>
    </div>
  `).join('');
}
async function addMentoring(e){
  e.preventDefault();
  if(!token) return alert('로그인 필요');
  const body = {
    title: document.getElementById('mtTitle').value,
    subject: document.getElementById('mtSubject').value,
    desc: document.getElementById('mtDesc').value,
    type: document.getElementById('mtType').value
  };
  const r = await fetch('/api/mentoring', {method:'POST', headers: headers(), body: JSON.stringify(body)});
  const j = await r.json();
  if(r.ok){ e.target.reset(); loadMentoring(); } else alert(j.error);
}
async function applyMentor(id){
  const r = await fetch('/api/mentoring/'+id+'/apply', {method:'POST', headers: headers()});
  const j = await r.json();
  if(r.ok) loadMentoring(); else alert(j.error);
}
async function deleteMentor(id){
  if(!confirm('삭제할까요?')) return;
  const r = await fetch('/api/mentoring/'+id, {method:'DELETE', headers: headers()});
  if(r.ok) loadMentoring(); else {const j=await r.json(); alert(j.error);}
}

// Meals - 매일 자동 업데이트
let currentMealDate = new Date().toISOString().slice(0,10);
async function loadMeal(dateStr){
  const d = dateStr || new Date().toISOString().slice(0,10);
  currentMealDate = d;
  try{
    const r = await fetch('/api/meals?date='+d);
    const data = await r.json();
    // Update hero preview (truncated to 3 items, full in modal)
    const previewEl = document.getElementById('mealPreview');
    const dateLabel = document.getElementById('mealDateLabel');
    const boxDate = document.getElementById('mealBoxDate');
    const boxContent = document.getElementById('mealBoxContent');
    const boxKcal = document.getElementById('mealBoxKcal');
    const modalDate = document.getElementById('mealModalDate');
    const modalKcal = document.getElementById('mealModalKcal');
    const modalContent = document.getElementById('mealModalContent');
    const modalEmpty = document.getElementById('mealModalEmpty');
    const modalEmptyText = document.getElementById('mealModalEmptyText');
    const picker = document.getElementById('mealDatePicker');
    if(picker) picker.value = d;

    const displayDate = data.displayDate || d;
    if(dateLabel) dateLabel.textContent = data.isToday ? `오늘 급식 · ${data.dayOfWeek}` : `${displayDate}`;
    if(boxDate) boxDate.textContent = `📌 ${data.isToday ? '오늘 급식' : displayDate} ${data.dayOfWeek ? '· '+data.dayOfWeek : ''}`;

    if(data.menu && data.menu.length>0){
      // hero preview: first 3 items
      const shortMenu = data.menu.slice(0,3).map(m=>m.split('(')[0].trim()).join('·');
      if(previewEl) previewEl.textContent = shortMenu + (data.menu.length>3 ? ` 외 ${data.menu.length-3}개` : '');
      // box content: show all but with "급식 보기" if overflow
      if(boxContent){
        // Show full menu but with line breaks, if more than 4 items, show first 4 and button will show modal
        const fullText = data.menu.join(' · ');
        // If space limited (more than 4), the user requested "급식 보기" button handles overflow, so we show truncated in box
        if(data.menu.length>4){
          const truncated = data.menu.slice(0,4).map(m=>m.split('(')[0].trim()).join(' · ') + ` 외 ${data.menu.length-4}개`;
          boxContent.innerHTML = truncated + ` <button onclick="openMealModal()" class="ml-1 px-2 py-0.5 bg-amber-100 border border-amber-200 rounded-full text-[11px] font-bold">전체보기</button>`;
        } else {
          boxContent.textContent = data.menu.join(' · ');
        }
      }
      if(boxKcal) boxKcal.textContent = (data.kcal ? data.kcal + ' · ' : '') + `총 ${data.menu.length}개 메뉴 · 출처: 성수고 급식실`;
      // modal
      if(modalDate) modalDate.textContent = `${data.displayDate} · ${data.dayOfWeek}`;
      if(modalKcal) modalKcal.textContent = data.kcal || '급식';
      if(modalContent && modalEmpty){
        modalContent.classList.remove('hidden');
        modalEmpty.classList.add('hidden');
        modalContent.innerHTML = data.menu.map(item=>{
          const name = item.split('(')[0].trim();
          const allerg = item.match(/\(([^)]+)\)/);
          const allergText = allerg ? allerg[1] : '';
          return `<div class="flex items-center gap-3 p-3 bg-slate-50 border rounded-xl">
            <div class="w-8 h-8 rounded-full bg-white border grid place-items-center text-sm">🍱</div>
            <div class="flex-1">
              <div class="font-bold text-sm">${name}</div>
              ${allergText ? `<div class="text-xs text-slate-500">알레르기: ${allergText}</div>` : ''}
            </div>
            <div class="text-xs text-slate-400">${item.includes('(') ? item : ''}</div>
          </div>`;
        }).join('') + (data.kcal ? `<div class="mt-3 text-center text-sm font-bold text-slate-700">${data.kcal}</div>` : '');
      }
    } else {
      // empty (weekend or no data)
      if(previewEl) previewEl.textContent = data.message || '급식 없음';
      if(boxContent) boxContent.innerHTML = `<span class="text-slate-500">${data.message || '등록된 식단이 없습니다.'}</span>`;
      if(boxKcal) boxKcal.textContent = data.displayDate || '';
      if(modalDate) modalDate.textContent = `${data.displayDate} · ${data.dayOfWeek}`;
      if(modalKcal) modalKcal.textContent = '휴식';
      if(modalContent && modalEmpty){
        modalContent.classList.add('hidden');
        modalEmpty.classList.remove('hidden');
        if(modalEmptyText) modalEmptyText.textContent = data.message || '등록된 식단이 없습니다.';
      }
    }
  }catch(e){
    console.error('meal load fail', e);
  }
}
function openMealModal(){
  document.getElementById('mealModal').classList.remove('hidden');
  // ensure current date's meal is loaded in modal
  loadMeal(currentMealDate);
}
function closeMealModal(){ document.getElementById('mealModal').classList.add('hidden'); }
function fetchMealForPicker(){
  const v = document.getElementById('mealDatePicker').value;
  if(v) loadMeal(v);
}
function fetchMealForToday(){
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('mealDatePicker').value = today;
  loadMeal(today);
}

// === 내 반 ===
let classPollInterval = null;
let lastNotifiedIds = new Set();

function checkClassSelection(){
  if(!me) return;
  const notSel = document.getElementById('classNotSelected');
  const sel = document.getElementById('classSelected');
  if(!me.classId){
    if(notSel) notSel.classList.remove('hidden');
    if(sel) sel.classList.add('hidden');
  } else {
    if(notSel) notSel.classList.add('hidden');
    if(sel) sel.classList.remove('hidden');
    document.getElementById('classBadge').textContent = me.classId;
    document.getElementById('className').textContent = me.className || me.classId.replace('-','학년 ')+'반';
    document.getElementById('notifyToggle').checked = me.notifyEnabled!==false;
    document.getElementById('scheduleNotifyBtn').classList.toggle('hidden', me.role!=='teacher');
    document.getElementById('groupChatTitle').textContent = (me.className||'단톡방') + ' 단톡방';
    loadClassMembers();
    loadGroupMessages();
    loadVotes();
    loadPrivateTargets();
    startClassPolling();
  }
}
function openClassSelect(){ document.getElementById('classSelectModal').classList.remove('hidden'); }
function closeClassSelect(){ document.getElementById('classSelectModal').classList.add('hidden'); document.getElementById('classSelectMsg').textContent=''; }
async function confirmClassSelect(){
  const g = document.getElementById('selGrade').value;
  const b = document.getElementById('selBan').value;
  const classId = `${g}-${b}`;
  const msgEl = document.getElementById('classSelectMsg');
  msgEl.textContent='처리 중...';
  msgEl.className='mt-3 text-sm text-center text-slate-500';
  const r = await fetch('/api/class/select', {method:'POST', headers: headers(), body: JSON.stringify({classId})});
  const j = await r.json();
  if(r.ok){
    token = j.token; localStorage.setItem('seongsu_token', token); me = j.user;
    msgEl.textContent='입장 완료!';
    closeClassSelect();
    // update header
    document.getElementById('hdrSub').textContent = me.role==='teacher' ? `${me.subject} 선생님 · ${me.className}` : `${me.studentId} · ${me.className}`;
    document.getElementById('welcomeSub').textContent = me.className + ' · ' + (me.role==='teacher' ? '담임' : '학생');
    checkClassSelection();
    // also update afterLogin UI
    if(typeof updateRoleUI==='function') updateRoleUI();
  } else {
    msgEl.textContent=j.error;
    msgEl.className='mt-3 text-sm text-center text-red-600';
  }
}
async function loadClassMembers(){
  const r = await fetch('/api/class/members', {headers: headers()});
  const j = await r.json();
  if(!r.ok){ document.getElementById('classMemberList').innerHTML=`<div class="text-xs text-red-500">${j.error}</div>`; return; }
  document.getElementById('classCount').textContent = j.members.length + '명';
  document.getElementById('classMemberList').innerHTML = j.members.map(m=>{
    const isMe = m.id===me.id;
    const roleBadge = m.role==='teacher' ? '<span class="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full">담임</span>' : '';
    return `<div class="flex items-center gap-2 p-2 rounded-xl ${isMe?'bg-blue-50 border border-blue-200':''} hover:bg-slate-50 cursor-pointer" onclick="selectPrivateTarget('${m.id}','${m.name}')">
      <div class="w-8 h-8 rounded-full bg-slate-200 grid place-items-center text-xs font-bold">${m.name[0]}</div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-bold truncate">${m.name} ${roleBadge} ${isMe?'<span class="text-xs text-blue-600">(나)</span>':''}</div>
        <div class="text-xs text-slate-500">${m.role==='teacher'? m.subject : m.studentId}</div>
      </div>
      <button class="text-xs text-slate-400">💬</button>
    </div>`;
  }).join('');
  // also update private target select
  const sel = document.getElementById('privateTarget');
  if(sel){
    const current = sel.value;
    sel.innerHTML = '<option value="">상대 선택</option>' + j.members.filter(m=>m.id!==me.id).map(m=>`<option value="${m.id}">${m.name} (${m.role==='teacher'?m.subject:m.studentId})</option>`).join('');
    if(current) sel.value = current;
  }
}
async function loadGroupMessages(){
  const r = await fetch('/api/class/group-messages', {headers: headers()});
  const list = await r.json();
  if(!Array.isArray(list)) return;
  const c = document.getElementById('groupMessages');
  if(list.length===0){
    c.innerHTML = '<div class="text-xs text-slate-500 text-center py-10">아직 메시지가 없습니다. 첫 메시지를 남겨보세요!</div>';
    return;
  }
  c.innerHTML = list.map(m=>{
    const isMe = m.authorId===me.id;
    const time = new Date(m.createdAt).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
    if(m.type==='schedule'){
      return `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3">
        <div class="text-xs font-bold text-amber-800">📅 일정 알림 · ${m.author}</div>
        <div class="font-bold text-sm mt-1">${m.text}</div>
        <div class="text-xs text-slate-500 mt-1">${time} · 캘린더에도 자동 등록됨</div>
      </div>`;
    }
    if(m.type==='vote'){
      return `<div class="bg-violet-50 border border-violet-200 rounded-2xl p-3 cursor-pointer" onclick="switchTab('class'); setTimeout(()=>document.getElementById('voteList').scrollIntoView({behavior:'smooth'}),100)">
        <div class="text-xs font-bold text-violet-800">📊 투표 · ${m.author}</div>
        <div class="font-bold text-sm mt-1">${m.text}</div>
        <div class="text-xs text-slate-500 mt-1">${time} · 투표 탭에서 참여</div>
      </div>`;
    }
    return `<div class="flex gap-2 ${isMe?'justify-end':''}">
      <div class="${isMe?'bg-blue-600 text-white':'bg-white border'} rounded-2xl px-4 py-2 max-w-[75%]">
        <div class="text-xs ${isMe?'text-blue-100':'text-slate-500'}">${m.author} ${m.role==='teacher'?'👩‍🏫':''} · ${time}</div>
        <div class="text-sm font-medium mt-0.5">${m.text}</div>
      </div>
    </div>`;
  }).join('');
  c.scrollTop = c.scrollHeight;
}
async function sendGroupMessage(e){
  e.preventDefault();
  const inp = document.getElementById('groupInput');
  const text = inp.value.trim();
  if(!text) return;
  const r = await fetch('/api/class/group-messages', {method:'POST', headers: headers(), body: JSON.stringify({text})});
  const j = await r.json();
  if(r.ok){ inp.value=''; loadGroupMessages(); }
  else alert(j.error);
}
// Private
async function loadPrivateTargets(){ /* already in loadClassMembers */ }
function selectPrivateTarget(id, name){
  document.getElementById('privateTarget').value = id;
  loadPrivateMessages();
}
async function loadPrivateMessages(){
  const withId = document.getElementById('privateTarget').value;
  const c = document.getElementById('privateMessages');
  if(!withId){ c.innerHTML='<div class="text-xs text-slate-500 text-center py-8">상대를 선택하면 대화가 표시됩니다.</div>'; return; }
  const r = await fetch('/api/class/private-messages?withUserId='+withId, {headers: headers()});
  const list = await r.json();
  if(!r.ok){ c.innerHTML=`<div class="text-xs text-red-500">${list.error}</div>`; return; }
  if(list.length===0){ c.innerHTML='<div class="text-xs text-slate-500 text-center py-4">아직 대화가 없습니다.</div>'; return; }
  c.innerHTML = list.map(m=>{
    const isMe = m.fromId===me.id;
    const time = new Date(m.createdAt).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
    return `<div class="flex ${isMe?'justify-end':''}"><div class="${isMe?'bg-slate-900 text-white':'bg-white border'} rounded-2xl px-3 py-2 max-w-[80%]"><div class="text-xs ${isMe?'text-slate-300':'text-slate-500'}">${isMe?'나':m.fromName} · ${time}</div><div class="text-sm">${m.text}</div></div></div>`;
  }).join('');
  c.scrollTop = c.scrollHeight;
}
async function sendPrivateMessage(e){
  e.preventDefault();
  const toId = document.getElementById('privateTarget').value;
  if(!toId) return alert('상대를 선택해주세요.');
  const text = document.getElementById('privateInput').value.trim();
  if(!text) return;
  const r = await fetch('/api/class/private-messages', {method:'POST', headers: headers(), body: JSON.stringify({toUserId: toId, text})});
  const j = await r.json();
  if(r.ok){ document.getElementById('privateInput').value=''; loadPrivateMessages(); }
  else alert(j.error);
}
// Votes
async function loadVotes(){
  const r = await fetch('/api/class/votes', {headers: headers()});
  const list = await r.json();
  const c = document.getElementById('voteList');
  if(!Array.isArray(list) || list.length===0){ c.innerHTML='<div class="text-xs text-slate-500 text-center py-4">진행 중인 투표가 없습니다.</div>'; return; }
  c.innerHTML = list.map(v=>{
    const total = v.options.reduce((s,o)=> s+o.votes.length, 0);
    const isVoted = v.options.some(o=> o.votes.includes(me.id));
    const isClosed = v.status==='closed';
    return `<div class="border rounded-2xl p-3">
      <div class="font-bold text-sm">${v.title} ${isClosed?'<span class="ml-1 px-1.5 py-0.5 bg-slate-900 text-white text-[10px] rounded-full">종료</span>':''}</div>
      <div class="text-xs text-slate-500">${v.author} · ${new Date(v.createdAt).toLocaleDateString()}</div>
      <div class="mt-2 space-y-1">
        ${v.options.map(o=>{
          const cnt = o.votes.length;
          const pct = total? Math.round(cnt/total*100):0;
          const selected = o.votes.includes(me.id);
          return `<button ${isClosed?'disabled':''} onclick="doVote('${v.id}','${o.id}')" class="w-full text-left p-2 rounded-xl border ${selected?'bg-blue-600 text-white border-blue-600':'bg-slate-50 hover:bg-white'} flex items-center gap-2">
            <div class="flex-1 text-sm font-medium">${o.text}</div>
            <div class="text-xs ${selected?'text-blue-100':'text-slate-500'}">${cnt}표 ${pct}% ${selected?'✓':''}</div>
          </button>`;
        }).join('')}
      </div>
      <div class="mt-2 text-xs text-slate-500">총 ${total}표 · ${isVoted?'투표함':''}</div>
      ${ (v.authorId===me.id || me.role==='teacher') && !isClosed ? `<button onclick="closeVote('${v.id}')" class="mt-2 w-full py-1.5 bg-white border rounded-full text-xs">투표 종료</button>`:''}
    </div>`;
  }).join('');
}
function openVoteModal(){ document.getElementById('voteModal').classList.remove('hidden'); }
function closeVoteModal(){ document.getElementById('voteModal').classList.add('hidden'); }
async function createVote(e){
  e.preventDefault();
  const title = document.getElementById('voteTitle').value.trim();
  const opts = [1,2,3,4].map(i=> document.getElementById('voteOpt'+i).value.trim()).filter(Boolean);
  const msgEl = document.getElementById('voteMsg');
  msgEl.textContent='생성 중...';
  const r = await fetch('/api/class/votes', {method:'POST', headers: headers(), body: JSON.stringify({title, options: opts})});
  const j = await r.json();
  if(r.ok){ msgEl.textContent='생성 완료!'; e.target.reset(); closeVoteModal(); loadVotes(); loadGroupMessages(); setTimeout(()=>msgEl.textContent='',1500); }
  else { msgEl.textContent=j.error; msgEl.className='text-sm text-red-600 text-center'; }
}
async function doVote(voteId, optId){
  const r = await fetch('/api/class/votes/'+voteId+'/vote', {method:'POST', headers: headers(), body: JSON.stringify({optionId: optId})});
  const j = await r.json();
  if(r.ok) loadVotes(); else alert(j.error);
}
async function closeVote(id){
  if(!confirm('투표를 종료할까요?')) return;
  const r = await fetch('/api/class/votes/'+id+'/close', {method:'POST', headers: headers()});
  if(r.ok) loadVotes(); else alert((await r.json()).error);
}
// Schedule notify (teacher)
function openScheduleNotify(){
  if(me.role!=='teacher') return alert('담임만 가능합니다.');
  document.getElementById('scheduleNotifyModal').classList.remove('hidden');
  document.getElementById('schedDate').valueAsDate = new Date(Date.now()+86400000);
}
function closeScheduleNotify(){ document.getElementById('scheduleNotifyModal').classList.add('hidden'); }
async function sendScheduleNotify(e){
  e.preventDefault();
  const title = document.getElementById('schedTitle').value.trim();
  const date = document.getElementById('schedDate').value;
  const category = document.getElementById('schedCat').value;
  const msgEl = document.getElementById('schedMsg');
  msgEl.textContent='전송 중...';
  const r = await fetch('/api/class/schedule-notify', {method:'POST', headers: headers(), body: JSON.stringify({title, date, category})});
  const j = await r.json();
  if(r.ok){ msgEl.textContent=`전송 완료! ${j.notified}명에게 알림 (전체 캘린더에는 미등록)`; closeScheduleNotify(); loadGroupMessages(); e.target.reset(); setTimeout(()=>msgEl.textContent='',2000); }
  else { msgEl.textContent=j.error; msgEl.className='text-sm text-red-600 text-center'; }
}
// Notifications (alarm like)
async function loadNotifications(){
  if(!me || me.notifyEnabled===false) return;
  const r = await fetch('/api/class/notifications', {headers: headers()});
  const list = await r.json();
  if(!Array.isArray(list) || list.length===0) return;
  // show toast for each new
  list.forEach(n=>{
    if(lastNotifiedIds.has(n.id)) return;
    lastNotifiedIds.add(n.id);
    showScheduleToast(n);
  });
  // mark as read after 5s
  setTimeout(async ()=>{
    const ids = list.map(n=>n.id);
    await fetch('/api/class/notifications/read', {method:'POST', headers: headers(), body: JSON.stringify({ids})});
  }, 5000);
}
function showScheduleToast(n){
  // create toast element
  let container = document.getElementById('toastContainer');
  if(!container){
    container = document.createElement('div');
    container.id='toastContainer';
    container.className='fixed top-20 right-4 z-50 space-y-2';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className='bg-slate-900 text-white rounded-2xl p-4 shadow-xl w-80 border border-slate-700 animate-bounce';
  el.innerHTML = `<div class="flex items-start gap-3">
    <div class="w-10 h-10 rounded-full bg-amber-500 grid place-items-center text-lg">📅</div>
    <div class="flex-1">
      <div class="font-black text-sm">일정 알림</div>
      <div class="text-sm font-bold mt-1">${n.title}</div>
      <div class="text-xs text-slate-300">${n.date} · ${n.category} · ${n.author}</div>
      <button onclick="this.closest('.bg-slate-900').remove()" class="mt-2 px-3 py-1 bg-white text-slate-900 rounded-full text-xs font-bold">확인</button>
    </div>
    <button onclick="this.parentElement.parentElement.remove()" class="text-slate-400">✕</button>
  </div>
  <div class="mt-2 text-xs text-amber-300">🔔 알림을 켜 두어 바로 표시됨 (핸드폰 알람처럼)</div>`;
  container.appendChild(el);
  // auto remove after 10s
  setTimeout(()=> el.remove(), 10000);
  // also ring sound if possible (vibrate)
  if(navigator.vibrate) navigator.vibrate(200);
}
async function toggleNotify(){
  const enabled = document.getElementById('notifyToggle').checked;
  const r = await fetch('/api/settings/notify', {method:'PUT', headers: headers(), body: JSON.stringify({enabled})});
  const j = await r.json();
  if(r.ok){
    me.notifyEnabled = j.enabled;
    token = j.token; localStorage.setItem('seongsu_token', token);
    if(enabled){
      // test toast
      showScheduleToast({title:'알림이 켜졌습니다', date: new Date().toISOString().slice(0,10), category:'테스트', author:'시스템'});
    }
  }
}
let lastPrivateIds = new Set();
async function checkPrivateInbox(){
  if(!me || !me.classId) return;
  try{
    const r = await fetch('/api/class/private-inbox', {headers: headers()});
    const list = await r.json();
    if(!Array.isArray(list)) return;
    // find new messages where toId === me.id
    const news = list.filter(m=> m.toId===me.id && !lastPrivateIds.has(m.id));
    // update set
    list.forEach(m=> lastPrivateIds.add(m.id));
    // keep only last 50
    if(lastPrivateIds.size>50){
      const arr = Array.from(lastPrivateIds).slice(-50);
      lastPrivateIds = new Set(arr);
    }
    if(news.length===0) return;
    // if currently viewing private chat with that sender, reload
    const currentWith = document.getElementById('privateTarget')?.value;
    let needReload = false;
    news.forEach(m=>{
      if(currentWith && (m.fromId===currentWith || m.toId===currentWith)) needReload = true;
      // show toast
      const sender = m.fromName;
      showPrivateToast(m, sender);
    });
    if(needReload) loadPrivateMessages();
  }catch(e){}
}
function showPrivateToast(m, sender){
  let container = document.getElementById('toastContainer');
  if(!container){
    container = document.createElement('div');
    container.id='toastContainer';
    container.className='fixed top-20 right-4 z-50 space-y-2';
    document.body.appendChild(container);
  }
  const isEmo = m.type==='emoticon' && m.emoticonId;
  const emo = isEmo ? emoticons.find(e=>e.id===m.emoticonId) : null;
  const preview = isEmo ? `이모티콘: ${emo?emo.name:m.emoticonId}` : (m.text.length>20? m.text.slice(0,20)+'...': m.text);
  const el = document.createElement('div');
  el.className='bg-violet-600 text-white rounded-2xl p-4 shadow-xl w-80 cursor-pointer';
  el.onclick = ()=>{ el.remove(); switchTab('class'); setTimeout(()=>{ selectPrivateTarget(m.fromId, sender); }, 300); };
  el.innerHTML = `<div class="flex items-start gap-3">
    <div class="w-8 h-8 rounded-full bg-white text-violet-600 grid place-items-center text-sm">💬</div>
    <div class="flex-1">
      <div class="font-bold text-sm">${sender}님의 개인 메시지</div>
      <div class="text-xs text-violet-100 mt-1">${isEmo ? `<img src="/emoticons/${emo.file}" class="w-8 h-8 inline-block"> ` : ''}${preview}</div>
      <div class="text-xs text-violet-200 mt-1">클릭하면 대화로 이동</div>
    </div>
    <button onclick="event.stopPropagation(); this.closest('.bg-violet-600').remove()" class="text-violet-200">✕</button>
  </div>`;
  container.appendChild(el);
  setTimeout(()=> el.remove(), 8000);
  if(navigator.vibrate) navigator.vibrate(150);
}
function startClassPolling(){
  if(classPollInterval) clearInterval(classPollInterval);
  // poll group, votes, notifications, private every 3s
  classPollInterval = setInterval(()=>{
    if(!me || !me.classId) return;
    const activeTab = document.querySelector('.tabBtn.bg-slate-900');
    const isClassTab = activeTab && activeTab.dataset.tab==='class';
    if(isClassTab){
      loadGroupMessages();
      loadVotes();
      // if private target selected, also poll private messages
      const withId = document.getElementById('privateTarget')?.value;
      if(withId) loadPrivateMessages();
    }
    loadNotifications();
    checkPrivateInbox();
  }, 3000);
  // immediate
  loadNotifications();
  checkPrivateInbox();
  // init private ids
  (async()=>{
    try{
      const r = await fetch('/api/class/private-inbox', {headers: headers()});
      const list = await r.json();
      if(Array.isArray(list)) list.forEach(m=> lastPrivateIds.add(m.id));
    }catch{}
  })();
}
// hook into afterLogin and switchTab
const _afterLoginOrig = afterLogin;
afterLogin = function(){
  _afterLoginOrig();
  checkClassSelection();
  // also update private target
  setTimeout(()=>{ if(me && me.classId) loadClassMembers(); }, 500);
};
const _switchTabOrig = switchTab;
switchTab = function(name){
  _switchTabOrig(name);
  if(name==='class' && me && me.classId){
    loadGroupMessages();
    loadVotes();
    loadPrivateTargets();
  }
};

// === 성수고 이모티콘 ===
let emoticons = [];
async function loadEmoticons(){
  try{
    const r = await fetch('/emoticons/list.json');
    emoticons = await r.json();
    const grids = ['emoticonGridGroup','emoticonGridPrivate'];
    grids.forEach(gid=>{
      const grid = document.getElementById(gid);
      if(!grid) return;
      const target = gid.includes('Group') ? 'group' : 'private';
      grid.innerHTML = emoticons.map(e=>`
        <button onclick="sendEmoticon('${e.id}','${target}')" class="p-1 bg-white border rounded-xl hover:bg-amber-50 hover:border-amber-300 flex flex-col items-center gap-1" title="${e.name}">
          <img src="/emoticons/${e.file}" class="w-10 h-10 object-contain" alt="${e.name}">
          <span class="text-[10px] font-bold text-slate-600">${e.name}</span>
        </button>
      `).join('');
    });
  }catch(e){ console.error('emoticon load fail', e); }
}
function toggleEmoticonPicker(target){
  const id = target==='group' ? 'emoticonPickerGroup' : 'emoticonPickerPrivate';
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.toggle('hidden');
  // close other
  const otherId = target==='group' ? 'emoticonPickerPrivate' : 'emoticonPickerGroup';
  const other = document.getElementById(otherId);
  if(other) other.classList.add('hidden');
}
async function sendEmoticon(emoticonId, target){
  if(!me || !me.classId) return alert('반을 먼저 선택해주세요.');
  // hide picker
  toggleEmoticonPicker(target);
  if(target==='group'){
    const r = await fetch('/api/class/group-messages', {method:'POST', headers: headers(), body: JSON.stringify({type:'emoticon', emoticonId})});
    const j = await r.json();
    if(r.ok) loadGroupMessages(); else alert(j.error);
  } else {
    const toId = document.getElementById('privateTarget').value;
    if(!toId) return alert('상대를 선택해주세요.');
    const r = await fetch('/api/class/private-messages', {method:'POST', headers: headers(), body: JSON.stringify({toUserId: toId, type:'emoticon', emoticonId})});
    const j = await r.json();
    if(r.ok) loadPrivateMessages(); else alert(j.error);
  }
}
// Patch loadGroupMessages to render emoticons
const _loadGroupMessagesOrig = loadGroupMessages;
loadGroupMessages = async function(){
  const r = await fetch('/api/class/group-messages', {headers: headers()});
  const list = await r.json();
  if(!Array.isArray(list)) return;
  const c = document.getElementById('groupMessages');
  if(list.length===0){
    c.innerHTML = '<div class="text-xs text-slate-500 text-center py-10">아직 메시지가 없습니다. 첫 메시지를 남겨보세요!</div>';
    return;
  }
  c.innerHTML = list.map(m=>{
    const isMe = m.authorId===me.id;
    const time = new Date(m.createdAt).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
    if(m.type==='emoticon' && m.emoticonId){
      const emo = emoticons.find(e=>e.id===m.emoticonId);
      const src = emo ? `/emoticons/${emo.file}` : `/emoticons/hi.svg`;
      const name = emo ? emo.name : m.emoticonId;
      return `<div class="flex gap-2 ${isMe?'justify-end':''}">
        <div class="${isMe?'bg-blue-600 text-white':'bg-white border'} rounded-2xl px-3 py-2 max-w-[75%]">
          <div class="text-xs ${isMe?'text-blue-100':'text-slate-500'}">${m.author} ${m.role==='teacher'?'👩‍🏫':''} · ${time}</div>
          <div class="mt-1 flex flex-col items-center">
            <img src="${src}" class="w-16 h-16 object-contain" alt="${name}">
            <span class="text-xs font-bold mt-1 ${isMe?'text-white':'text-slate-700'}">${name}</span>
          </div>
        </div>
      </div>`;
    }
    if(m.type==='schedule'){
      return `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3">
        <div class="text-xs font-bold text-amber-800">📅 일정 알림 · ${m.author}</div>
        <div class="font-bold text-sm mt-1">${m.text}</div>
        <div class="text-xs text-slate-500 mt-1">${time} · 캘린더에도 자동 등록됨</div>
      </div>`;
    }
    if(m.type==='vote'){
      return `<div class="bg-violet-50 border border-violet-200 rounded-2xl p-3 cursor-pointer" onclick="switchTab('class'); setTimeout(()=>document.getElementById('voteList').scrollIntoView({behavior:'smooth'}),100)">
        <div class="text-xs font-bold text-violet-800">📊 투표 · ${m.author}</div>
        <div class="font-bold text-sm mt-1">${m.text}</div>
        <div class="text-xs text-slate-500 mt-1">${time} · 투표 탭에서 참여</div>
      </div>`;
    }
    return `<div class="flex gap-2 ${isMe?'justify-end':''}">
      <div class="${isMe?'bg-blue-600 text-white':'bg-white border'} rounded-2xl px-4 py-2 max-w-[75%]">
        <div class="text-xs ${isMe?'text-blue-100':'text-slate-500'}">${m.author} ${m.role==='teacher'?'👩‍🏫':''} · ${time}</div>
        <div class="text-sm font-medium mt-0.5">${m.text}</div>
      </div>
    </div>`;
  }).join('');
  c.scrollTop = c.scrollHeight;
};
// Patch private
const _loadPrivateMessagesOrig = loadPrivateMessages;
loadPrivateMessages = async function(){
  const withId = document.getElementById('privateTarget').value;
  const c = document.getElementById('privateMessages');
  if(!withId){ c.innerHTML='<div class="text-xs text-slate-500 text-center py-8">상대를 선택하면 대화가 표시됩니다.</div>'; return; }
  const r = await fetch('/api/class/private-messages?withUserId='+withId, {headers: headers()});
  const list = await r.json();
  if(!r.ok){ c.innerHTML=`<div class="text-xs text-red-500">${list.error}</div>`; return; }
  if(list.length===0){ c.innerHTML='<div class="text-xs text-slate-500 text-center py-4">아직 대화가 없습니다.</div>'; return; }
  c.innerHTML = list.map(m=>{
    const isMe = m.fromId===me.id;
    const time = new Date(m.createdAt).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
    if(m.type==='emoticon' && m.emoticonId){
      const emo = emoticons.find(e=>e.id===m.emoticonId);
      const src = emo ? `/emoticons/${emo.file}` : `/emoticons/hi.svg`;
      const name = emo ? emo.name : m.emoticonId;
      return `<div class="flex ${isMe?'justify-end':''}"><div class="${isMe?'bg-slate-900 text-white':'bg-white border'} rounded-2xl px-3 py-2 max-w-[80%]"><div class="text-xs ${isMe?'text-slate-300':'text-slate-500'}">${isMe?'나':m.fromName} · ${time}</div><div class="mt-1 flex flex-col items-center"><img src="${src}" class="w-12 h-12 object-contain" alt="${name}"><span class="text-xs font-bold mt-1">${name}</span></div></div></div>`;
    }
    return `<div class="flex ${isMe?'justify-end':''}"><div class="${isMe?'bg-slate-900 text-white':'bg-white border'} rounded-2xl px-3 py-2 max-w-[80%]"><div class="text-xs ${isMe?'text-slate-300':'text-slate-500'}">${isMe?'나':m.fromName} · ${time}</div><div class="text-sm">${m.text}</div></div></div>`;
  }).join('');
  c.scrollTop = c.scrollHeight;
};
