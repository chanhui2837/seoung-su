const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const {
  connectDB,
  uuidv4,
  User,
  Event,
  Lost,
  FacilityOpening,
  Reservation,
  Mentoring,
  ClassGroupMessage,
  ClassPrivateMessage,
  ClassVote,
  ClassNotification,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'seongsu-high-secret-2026';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// === 급식 (매일 자동 업데이트) - 춘천 성수고 공식 사이트 기반 ===
const FALLBACK_MEALS = {
  "2026-08-14": { kcal: "", menu: ["닭칼국수 (1.2.5.6.12.13.15.16.18)", "미니밥", "고추장진미채볶음 (1.5.6.13.17)", "오징어김치전 (1.5.6.9.16.17)", "깐풍만두 (1.5.6.10.12.13.16.18)", "깍두기 (9)", "망고케이크 (1.2.5.6.10)"] },
  "2026-08-18": { kcal: "", menu: ["흑미밥", "소고기뭇국 (5.6.16)", "매콤어묵볶음 (1.5.6.13)", "아몬드잔멸치볶음 (5.13)", "김치피자탕수육 (1.5.6.9.10.11.12.13.18)", "배추김치 (9)", "청포도"] },
  "2026-08-19": { kcal: "", menu: ["로제분모자떡볶이 (2.5.6.10.12.13.15.16)", "치폴레핫도그 (1.2.5.6.10.16)", "미니밥", "수박화채 (11.13)", "배추김치 (9)", "단무지"] },
  "2026-08-20": { kcal: "", menu: ["새우필라프 (1.5.6.9.13.18)", "맑은콩나물국 (5)", "청경채느타리볶음 (5.6.13.18)", "녹두전 (1.5.6.10)", "깍두기 (9)", "초코칩트위스트 (1.2.5.6)"] },
  "2026-08-21": { kcal: "", menu: ["보리밥", "사골우거지국 (5.6.13.16)", "닭볶음탕 (5.6.13.15)", "애호박볶음 (5.9)", "마파두부 (5.6.10.12.13.18)", "깍두기 (9)", "떠먹는요구르트(플레인) (2)"] },
  "2026-08-24": { kcal: "", menu: ["기장밥", "두부고추장찌개 (5.6.10)", "채소달걀찜 (1.2)", "단호박돼지사태찜 (5.6.10.13)", "건새우마늘종볶음 (5.9.13)", "깍두기 (9)", "자두"] },
  "2026-08-25": { kcal: "", menu: ["차수수밥", "유부된장국 (5.6)", "감자조림 (5.6.13)", "동부묵김가루무침 (5.6.13)", "숯불바베큐치킨우동볶음 (5.6.12.13.15.18)", "배추김치 (9)", "초코우유 (2)"] },
  "2026-08-26": { kcal: "", menu: ["잔치국수 (1.5.6.7.9.18)", "미니밥", "주꾸미만두 (1.5.6.8.9.10.12.15.16.17.18)", "스모그햄볶음 (1.2.5.6.10.13.15.16)", "깍두기 (9)", "연유토마토 (2.12)"] },
  "2026-08-27": { kcal: "955.3 Kcal", menu: ["차조밥", "돼지고기김치찌개 (5.9.10)", "분모자찜닭 (5.6.13.15)", "콩나물무침 (5)", "타코야끼 (1.2.5.6.13)", "배추김치 (9)"] },
  "2026-08-28": { kcal: "", menu: ["치킨마크니커리밥 (2.5.6.10.12.13.15.16.18)", "미역두부된장국 (5.6)", "들기름막국수 (3.5.6.13)", "오이지무침 (13)", "츄러스고구마맛탕 (1.2.5.6.13)", "깍두기 (9)"] },
  "2026-08-31": { kcal: "", menu: ["제육덮밥 (5.6.10.13)", "도토리묵채국 (5.6.9.16)", "채소스틱/쌈장 (5.6)", "미트볼라따뚜이 (1.2.5.6.10.12.13.16)", "깍두기 (9)", "바나나"] },
};

let mealCache = { data: null, time: 0, date: null };

async function fetchMealLive(dateStr){
  if(FALLBACK_MEALS[dateStr]){
    return { date: dateStr, kcal: FALLBACK_MEALS[dateStr].kcal, menu: FALLBACK_MEALS[dateStr].menu, source: 'fallback-fast' };
  }
  try{
    const urls = [
      `https://seongsu.gwe.hs.kr/main.do?s=seongsu`,
      `https://seongsu.gwe.hs.kr/sFoodList.do?m=0905&s=seongsu`
    ];
    for(const url of urls){
      const controller = new AbortController();
      const t = setTimeout(()=> controller.abort(), 1500);
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://seongsu.gwe.hs.kr/' }, signal: controller.signal });
      clearTimeout(t);
      if(!res.ok) continue;
      const html = await res.text();
      if(url.includes('main.do')){
        const todayIdx = html.indexOf('오늘의 식단');
        if(todayIdx !== -1){
          const snippet = html.slice(todayIdx, todayIdx+5000);
          const kcalMatch = snippet.match(/(\d+\.?\d*\s*Kcal)/);
          const kcal = kcalMatch ? kcalMatch[1] : "";
          if(dateStr === new Date().toISOString().slice(0,10) && FALLBACK_MEALS[dateStr]){
            if(snippet.includes(FALLBACK_MEALS[dateStr].menu[0].split(' ')[0])){
              return { date: dateStr, kcal, menu: FALLBACK_MEALS[dateStr].menu, source: 'live-main' };
            }
          }
        }
      }
      if(FALLBACK_MEALS[dateStr] && html.includes(FALLBACK_MEALS[dateStr].menu[0].split('(')[0].trim())){
        const fb = FALLBACK_MEALS[dateStr];
        return { date: dateStr, kcal: fb.kcal, menu: fb.menu, source: 'live-fallback-match' };
      }
    }
  }catch(e){}
  return null;
}

app.get('/api/meals', async (req,res)=>{
  const dateStr = req.query.date || new Date().toISOString().slice(0,10);
  const todayStr = new Date().toISOString().slice(0,10);
  const now = Date.now();
  if(mealCache.date === dateStr && now - mealCache.time < 10*60*1000 && mealCache.data){
    return res.json(mealCache.data);
  }
  if(FALLBACK_MEALS[dateStr]){
    const fb = FALLBACK_MEALS[dateStr];
    const result = { date: dateStr, kcal: fb.kcal, menu: fb.menu, source: 'fallback', isToday: (dateStr === todayStr), dayOfWeek: new Date(dateStr).toLocaleDateString('ko-KR', { weekday: 'long' }), displayDate: new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) };
    mealCache = { data: result, time: now, date: dateStr };
    return res.json(result);
  }
  let live = await fetchMealLive(dateStr);
  let result;
  if(live){
    result = live;
  } else {
    const d = new Date(dateStr);
    const day = d.getDay();
    if(day===0 || day===6){
      result = { date: dateStr, kcal: "", menu: [], source: 'none', message: "주말은 급식이 없습니다." };
    } else {
      result = { date: dateStr, kcal: "", menu: [], source: 'none', message: "등록된 식단이 없습니다." };
    }
  }
  result.isToday = (dateStr === todayStr);
  result.dayOfWeek = new Date(dateStr).toLocaleDateString('ko-KR', { weekday: 'long' });
  result.displayDate = new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  mealCache = { data: result, time: now, date: dateStr };
  res.json(result);
});

app.get('/api/meals/today', async (req,res)=>{
  const dateStr = new Date().toISOString().slice(0,10);
  if(FALLBACK_MEALS[dateStr]){
    const fb = FALLBACK_MEALS[dateStr];
    const result = { date: dateStr, kcal: fb.kcal, menu: fb.menu, source: 'fallback', isToday: true, dayOfWeek: new Date(dateStr).toLocaleDateString('ko-KR', { weekday: 'long' }), displayDate: new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) };
    return res.json(result);
  }
  let live = await fetchMealLive(dateStr);
  let result;
  if(live){
    result = live;
  } else {
    const d = new Date(dateStr);
    const day = d.getDay();
    if(day===0 || day===6){
      result = { date: dateStr, kcal: "", menu: [], source: 'none', message: "주말은 급식이 없습니다." };
    } else {
      result = { date: dateStr, kcal: "", menu: [], source: 'none', message: "등록된 식단이 없습니다." };
    }
  }
  result.isToday = true;
  result.dayOfWeek = new Date(dateStr).toLocaleDateString('ko-KR', { weekday: 'long' });
  result.displayDate = new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  res.json(result);
});

// --- Multer (메모리 저장 → MongoDB에 base64 저장) ---
const uploadProfile = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadLost = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function toDataURL(buffer, mimetype) {
  return `data:${mimetype || 'image/jpeg'};base64,${buffer.toString('base64')}`;
}

// --- Auth middleware ---
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const token = h.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: '토큰이 만료되었습니다.' });
  }
}

function signToken(u) {
  return jwt.sign({ id: u.id, name: u.name, role: u.role, studentId: u.studentId, subject: u.subject, classId: u.classId, className: u.className, notifyEnabled: u.notifyEnabled }, JWT_SECRET, { expiresIn: '7d' });
}

function safeUser(u) {
  const o = typeof u.toObject === 'function' ? u.toObject() : u;
  delete o.passwordHash;
  return o;
}

// --- API: Register ---
app.post('/api/register', async (req, res) => {
  const { name, role, studentId, subject, password, email } = req.body;
  if (!name || !password) return res.status(400).json({ error: '이름과 비밀번호는 필수입니다.' });
  if (role === 'teacher') {
    if (!subject) return res.status(400).json({ error: '담당과목을 선택해주세요.' });
  } else {
    if (!studentId) return res.status(400).json({ error: '학번을 입력해주세요.' });
  }
  let normEmail = null;
  if (email) {
    normEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) return res.status(400).json({ error: '올바른 이메일 형식을 입력해주세요.' });
  }
  const users = await User.find();
  const exists = users.find(u => {
    if (role === 'teacher') return u.role === 'teacher' && u.name === name && u.subject === subject;
    return u.role !== 'teacher' && u.studentId === String(studentId);
  });
  if (exists) return res.status(400).json({ error: '이미 가입된 정보입니다.' });
  if (normEmail) {
    const emailDup = users.find(u => u.email && String(u.email).toLowerCase() === normEmail);
    if (emailDup) return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const newUser = await User.create({
    id: uuidv4(),
    name: name.trim(),
    role: role === 'teacher' ? 'teacher' : 'student',
    studentId: role === 'teacher' ? null : String(studentId),
    subject: role === 'teacher' ? subject : null,
    passwordHash: hash,
    profileImage: null,
    createdAt: new Date().toISOString(),
    email: normEmail,
    notifyEnabled: true
  });
  const token = signToken(newUser);
  res.json({ token, user: safeUser(newUser) });
});

// --- API: Login ---
app.post('/api/login', async (req, res) => {
  const { name, role, studentId, subject, password } = req.body;
  if (!password) return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
  const users = await User.find();
  let user = null;
  if (role === 'teacher') {
    user = users.find(u => u.role === 'teacher' && u.name === name && u.subject === subject);
  } else {
    user = users.find(u => u.role !== 'teacher' && u.studentId === String(studentId));
    if (user && user.name !== name) return res.status(400).json({ error: '이름과 학번이 일치하지 않습니다.' });
  }
  if (!user) return res.status(400).json({ error: '가입된 사용자를 찾을 수 없습니다.' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: '비밀번호가 틀렸습니다.' });
  const token = signToken(user);
  res.json({ token, user: safeUser(user) });
});

// --- API: Me ---
app.get('/api/me', auth, async (req, res) => {
  const u = await User.findOne({ id: req.user.id });
  if (!u) return res.status(404).json({ error: '사용자 없음' });
  res.json(safeUser(u));
});

// --- API: Update profile image ---
app.post('/api/profile/image', auth, uploadProfile.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '이미지를 선택해주세요.' });
  const u = await User.findOne({ id: req.user.id });
  if (!u) return res.status(404).json({ error: '사용자 없음' });
  u.profileImage = toDataURL(req.file.buffer, req.file.mimetype);
  await u.save();
  const newToken = signToken(u);
  res.json({ user: safeUser(u), token: newToken });
});

// --- API: Remove profile image ---
app.delete('/api/profile/image', auth, async (req, res) => {
  const u = await User.findOne({ id: req.user.id });
  if (!u) return res.status(404).json({ error: '사용자 없음' });
  u.profileImage = null;
  await u.save();
  const newToken = signToken(u);
  res.json({ user: safeUser(u), token: newToken });
});

// --- API: Update profile (이름, 학번/과목, 이메일) ---
app.put('/api/profile', auth, async (req, res) => {
  const { name, studentId, subject, email } = req.body;
  const me = await User.findOne({ id: req.user.id });
  if (!me) return res.status(404).json({ error: '사용자 없음' });

  const newName = name !== undefined ? String(name).trim() : me.name;
  if (!newName) return res.status(400).json({ error: '이름을 입력해주세요.' });
  if (newName.length > 20) return res.status(400).json({ error: '이름은 20자 이내여야 합니다.' });

  let newEmail = me.email;
  if (email !== undefined) {
    const raw = String(email).trim();
    if (raw === '') {
      newEmail = null;
    } else {
      const norm = raw.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
      const dup = await User.findOne({ email: norm, id: { $ne: me.id } });
      if (dup) return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
      newEmail = norm;
    }
  }

  if (me.role === 'teacher') {
    const newSubject = subject !== undefined ? String(subject).trim() : me.subject;
    if (!newSubject) return res.status(400).json({ error: '담당과목을 선택해주세요.' });
    // 중복 체크: 같은 이름+과목 선생님 존재 여부
    const dupTeacher = await User.findOne({ role: 'teacher', name: newName, subject: newSubject, id: { $ne: me.id } });
    if (dupTeacher) return res.status(400).json({ error: '이미 같은 이름과 과목의 선생님 계정이 존재합니다.' });
    me.name = newName;
    me.subject = newSubject;
    me.email = newEmail;
  } else {
    const newSid = studentId !== undefined ? String(studentId).trim() : me.studentId;
    if (!newSid) return res.status(400).json({ error: '학번을 입력해주세요.' });
    if (!/^\d{5}$/.test(newSid)) return res.status(400).json({ error: '학번은 5자리 숫자여야 합니다. (예: 30101)' });
    const dupStudent = await User.findOne({ role: { $ne: 'teacher' }, studentId: newSid, id: { $ne: me.id } });
    if (dupStudent) return res.status(400).json({ error: '이미 사용 중인 학번입니다.' });
    me.name = newName;
    me.studentId = newSid;
    me.email = newEmail;
  }

  await me.save();
  const newToken = signToken(me);
  res.json({ user: safeUser(me), token: newToken });
});

// --- API: Account find by email ---
app.post('/api/account/find', async (req, res) => {
  const { email } = req.body;
  if (!email || !String(email).trim()) return res.status(400).json({ error: '이메일을 입력해주세요.' });
  const norm = String(email).trim().toLowerCase();
  const users = await User.find({ email: norm });
  if (!users || users.length === 0) return res.status(404).json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' });
  // 비밀번호는 bcrypt로 복원 불가하므로 아이디 정보만 반환
  const result = users.map(u => ({
    name: u.name,
    role: u.role,
    studentId: u.studentId || null,
    subject: u.subject || null,
    email: u.email,
    createdAt: u.createdAt,
    id: u.id
  }));
  res.json({ users: result });
});

// --- API: Reset password via email ---
app.post('/api/account/reset-password', async (req, res) => {
  const { email, name, studentId, subject, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: '이메일과 새 비밀번호는 필수입니다.' });
  if (String(newPassword).length < 4) return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
  const norm = String(email).trim().toLowerCase();
  let candidates = await User.find({ email: norm });
  if (!candidates || candidates.length === 0) return res.status(404).json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' });

  // 이메일이 중복될 수 있으므로 추가 식별자로 정확히 찾기 (이름+학번/과목)
  let target = null;
  if (candidates.length === 1) {
    target = candidates[0];
    if (!name || target.name !== String(name).trim()) {
      return res.status(400).json({ error: '이름이 일치하지 않습니다. 찾은 계정의 이름과 정확히 입력해주세요.' });
    }
    if (target.role === 'teacher') {
      if (subject && target.subject !== subject) return res.status(400).json({ error: '담당과목이 일치하지 않습니다.' });
      if (!subject) return res.status(400).json({ error: '선생님 계정은 담당과목을 선택해야 합니다.' });
    } else {
      if (String(target.studentId) !== String(studentId)) return res.status(400).json({ error: '학번이 일치하지 않습니다.' });
    }
  } else {
    // 여러 계정이 같은 이메일 쓰면 식별자 필요
    if (!name) return res.status(400).json({ error: '같은 이메일에 여러 계정이 있습니다. 이름과 학번/과목을 함께 입력해주세요.', needSelector: true, users: candidates.map(u=>({ name: u.name, role: u.role, studentId: u.studentId, subject: u.subject })) });
    target = candidates.find(u => {
      if (u.name !== String(name).trim()) return false;
      if (u.role === 'teacher') return u.subject === subject;
      return u.studentId === String(studentId);
    });
    if (!target) return res.status(400).json({ error: '입력한 정보와 일치하는 계정을 찾을 수 없습니다.' });
  }

  target.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await target.save();
  res.json({ ok: true, message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.', user: { name: target.name, role: target.role, studentId: target.studentId, subject: target.subject } });
});

// === Feature 1: Calendar (선생님 전용 작성) ===
app.get('/api/events', async (req, res) => {
  res.json(await Event.find());
});
app.post('/api/events', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '캘린더는 선생님만 작성할 수 있습니다.' });
  const { title, date, category } = req.body;
  if (!title || !date) return res.status(400).json({ error: '제목과 날짜 필수' });
  const ev = await Event.create({ id: uuidv4(), title, date, category: category || '개인', author: req.user.name, authorId: req.user.id, color: category==='시험'?'red':category==='수행'?'orange':category==='과제'?'green':'blue' });
  res.json(ev);
});
app.delete('/api/events/:id', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '캘린더 삭제는 선생님만 가능합니다.' });
  const ev = await Event.findOne({ id: req.params.id });
  if (!ev) return res.status(404).json({error:'없음'});
  await Event.deleteOne({ id: req.params.id });
  res.json({ok:true});
});

// === Feature 2: Lost & Found ===
app.get('/api/lost', async (req, res) => {
  res.json(await Lost.find());
});
app.post('/api/lost', auth, uploadLost.single('image'), async (req, res) => {
  const { title, location, date, description, type } = req.body;
  if (!title) return res.status(400).json({ error: '제목을 입력해주세요.' });
  const item = await Lost.create({
    id: uuidv4(),
    title, location: location||'', date: date|| new Date().toISOString().slice(0,10),
    description: description||'',
    type: type || '분실물',
    image: req.file ? toDataURL(req.file.buffer, req.file.mimetype) : null,
    author: req.user.name,
    authorId: req.user.id,
    status: '보관중',
    createdAt: new Date().toISOString(),
    comments: []
  });
  res.json(item);
});
app.post('/api/lost/:id/comment', auth, async (req,res)=>{
  const { text } = req.body;
  const item = await Lost.findOne({ id: req.params.id });
  if(!item) return res.status(404).json({error:'없음'});
  item.comments.push({ id: uuidv4(), author: req.user.name, text, at: new Date().toISOString() });
  await item.save();
  res.json(item);
});
app.patch('/api/lost/:id/status', auth, async (req,res)=>{
  const item = await Lost.findOne({ id: req.params.id });
  if(!item) return res.status(404).json({error:'없음'});
  if(item.authorId !== req.user.id) return res.status(403).json({error:'작성자만 변경 가능'});
  item.status = item.status==='보관중' ? '주인찾음' : '보관중';
  await item.save();
  res.json(item);
});

// === Feature 3: Facility Reservation ===
const FACILITIES = [
  { id: 'gym', name: '체육관', icon: '🏀', slots: ['08:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00'] },
  { id: 'music', name: '음악실', icon: '🎵', slots: ['08:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00'] },
  { id: 'club', name: '동아리실', icon: '🎨', slots: ['08:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00'] },
  { id: 'study', name: '스터디룸', icon: '📚', slots: ['08:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00'] },
];
app.get('/api/facilities', (req,res)=> res.json(FACILITIES));

app.get('/api/facility-openings', async (req,res)=>{
  const { date, facility } = req.query;
  let list = await FacilityOpening.find();
  if(date) list = list.filter(r=>r.date===date);
  if(facility) list = list.filter(r=>r.facility===facility);
  list.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  res.json(list);
});
app.post('/api/facility-openings', auth, async (req,res)=>{
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '시설 개방은 선생님만 가능합니다.' });
  const { facility, date, slot, note } = req.body;
  if(!facility || !date || !slot) return res.status(400).json({error:'시설, 날짜, 시간 필수'});
  const fac = FACILITIES.find(f=>f.id===facility);
  if(!fac) return res.status(400).json({error:'존재하지 않는 시설'});
  if(!fac.slots.includes(slot)) return res.status(400).json({error:'올바르지 않은 시간대'});
  const list = await FacilityOpening.find();
  const dup = list.find(r=>r.facility===facility && r.date===date && r.slot===slot);
  if(dup) return res.status(400).json({error:'이미 개방된 시간입니다.'});
  const opening = await FacilityOpening.create({ id: uuidv4(), facility, date, slot, note: note||'', author: req.user.name, authorId: req.user.id, subject: req.user.subject||'', createdAt: new Date().toISOString() });
  res.json(opening);
});
app.delete('/api/facility-openings/:id', auth, async (req,res)=>{
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '선생님만 가능합니다.' });
  const op = await FacilityOpening.findOne({ id: req.params.id });
  if(!op) return res.status(404).json({error:'없음'});
  if(op.authorId !== req.user.id) return res.status(403).json({error:'개방한 선생님만 삭제 가능'});
  const reservations = await Reservation.find();
  const hasRes = reservations.find(r=>r.facility===op.facility && r.date===op.date && r.slot===op.slot);
  if(hasRes) return res.status(400).json({error:'이미 예약이 있어 삭제할 수 없습니다. 예약을 먼저 취소하세요.'});
  await FacilityOpening.deleteOne({ id: req.params.id });
  res.json({ok:true});
});

app.get('/api/reservations', async (req,res)=>{
  const { date, facility } = req.query;
  let list = await Reservation.find();
  if(date) list = list.filter(r=>r.date===date);
  if(facility) list = list.filter(r=>r.facility===facility);
  res.json(list);
});
app.post('/api/reservations', auth, async (req,res)=>{
  const { facility, date, slot, purpose } = req.body;
  if(!facility || !date || !slot) return res.status(400).json({error:'시설, 날짜, 시간 필수'});
  const openings = await FacilityOpening.find();
  const opening = openings.find(r=>r.facility===facility && r.date===date && r.slot===slot);
  if(!opening) return res.status(400).json({error:'아직 개방되지 않은 시설입니다. 담당 선생님이 개방해야 예약할 수 있습니다.'});
  const list = await Reservation.find();
  const dup = list.find(r=>r.facility===facility && r.date===date && r.slot===slot);
  if(dup) return res.status(400).json({error:'이미 예약된 시간입니다.'});
  const rv = await Reservation.create({ id: uuidv4(), facility, date, slot, purpose: purpose||'', author: req.user.name, authorId: req.user.id, createdAt: new Date().toISOString() });
  res.json(rv);
});
app.delete('/api/reservations/:id', auth, async (req,res)=>{
  const rv = await Reservation.findOne({ id: req.params.id });
  if(!rv) return res.status(404).json({error:'없음'});
  if(rv.authorId !== req.user.id) return res.status(403).json({error:'본인 예약만 취소 가능'});
  await Reservation.deleteOne({ id: req.params.id });
  res.json({ok:true});
});

// === Feature 4: Mentoring / Talent Market ===
app.get('/api/mentoring', async (req,res)=> res.json(await Mentoring.find()));
app.post('/api/mentoring', auth, async (req,res)=>{
  const { title, subject, desc, type } = req.body;
  if(!title || !subject) return res.status(400).json({error:'제목, 과목 필수'});
  const item = await Mentoring.create({ id: uuidv4(), title, subject, desc: desc||'', type: type||'멘토링',
    author: req.user.name, authorId: req.user.id, role: req.user.role,
    createdAt: new Date().toISOString(), applicants: [] });
  res.json(item);
});
app.post('/api/mentoring/:id/apply', auth, async (req,res)=>{
  const item = await Mentoring.findOne({ id: req.params.id });
  if(!item) return res.status(404).json({error:'없음'});
  if(item.authorId===req.user.id) return res.status(400).json({error:'본인 글에는 신청 불가'});
  if(item.applicants.find(a=>a.id===req.user.id)) return res.status(400).json({error:'이미 신청했습니다'});
  item.applicants.push({ id: req.user.id, name: req.user.name, at: new Date().toISOString() });
  await item.save();
  res.json(item);
});
app.delete('/api/mentoring/:id', auth, async (req,res)=>{
  const item = await Mentoring.findOne({ id: req.params.id });
  if(!item) return res.status(404).json({error:'없음'});
  if(item.authorId!==req.user.id) return res.status(403).json({error:'작성자만 삭제 가능'});
  await Mentoring.deleteOne({ id: req.params.id });
  res.json({ok:true});
});

// === Feature 5: 내 반 (클래스) ===
const CLASS_IDS = [];
for(let g=1; g<=3; g++) for(let b=1; b<=8; b++) CLASS_IDS.push(`${g}-${b}`);

app.post('/api/class/select', auth, async (req,res)=>{
  const { classId } = req.body;
  if(!classId || !CLASS_IDS.includes(classId)) return res.status(400).json({ error: '올바른 반을 선택해주세요. (예: 3-1)' });
  const me = await User.findOne({ id: req.user.id });
  if(!me) return res.status(404).json({ error: '사용자 없음' });
  if(me.role==='teacher'){
    const existing = await User.findOne({ role: 'teacher', classId, id: { $ne: req.user.id } });
    if(existing) return res.status(400).json({ error: `이미 ${classId.replace('-','학년 ')}반 담임은 ${existing.name} 선생님입니다. 다른 반을 선택해주세요.` });
  }
  me.classId = classId;
  me.className = classId.replace('-','학년 ') + '반';
  if(me.notifyEnabled===undefined) me.notifyEnabled = true;
  await me.save();
  res.json({ user: safeUser(me), token: signToken(me) });
});

app.get('/api/class/members', auth, async (req,res)=>{
  const me = await User.findOne({ id: req.user.id });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  const users = await User.find({ classId: me.classId });
  const members = users.map(u=> safeUser(u));
  members.sort((a,b)=> (a.role==='teacher'? -1 : b.role==='teacher'? 1 : a.name.localeCompare(b.name)));
  res.json({ classId: me.classId, className: me.className, members });
});

app.get('/api/class/group-messages', auth, async (req,res)=>{
  const me = await User.findOne({ id: req.user.id });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  let list = await ClassGroupMessage.find({ classId: me.classId });
  list.sort((a,b)=> new Date(a.createdAt)-new Date(b.createdAt));
  if(list.length>100) list = list.slice(-100);
  res.json(list);
});

const EMOTICONS = ["hi","fighting","study","sleepy","hungry","love","faith","hope","sunflower","yew","exam","seongsu"];

app.post('/api/class/group-messages', auth, async (req,res)=>{
  const me = await User.findOne({ id: req.user.id });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  const { text, type, emoticonId } = req.body;
  if(type==='emoticon'){
    if(!emoticonId || !EMOTICONS.includes(emoticonId)) return res.status(400).json({ error: '올바른 이모티콘을 선택해주세요.' });
  } else {
    if(!text || !text.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
  }
  const msg = await ClassGroupMessage.create({
    id: uuidv4(),
    classId: me.classId,
    author: me.name,
    authorId: me.id,
    role: me.role,
    text: (text||'').trim(),
    type: type || 'text',
    emoticonId: emoticonId || null,
    createdAt: new Date().toISOString()
  });
  res.json(msg);
});

app.post('/api/class/schedule-notify', auth, async (req,res)=>{
  const me = await User.findOne({ id: req.user.id });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  if(me.role!=='teacher') return res.status(403).json({ error: '담임선생님만 일정 알림을 보낼 수 있습니다.' });
  const { title, date, category } = req.body;
  if(!title || !date) return res.status(400).json({ error: '제목과 날짜 필수' });
  const ev = { id: uuidv4(), title, date, category: category||'학사', author: me.name, authorId: me.id, classId: me.classId, color: category==='시험'?'red':category==='수행'?'orange':category==='과제'?'green':'blue' };
  const scheduleMsg = await ClassGroupMessage.create({
    id: uuidv4(),
    classId: me.classId,
    author: me.name,
    authorId: me.id,
    role: me.role,
    text: `📅 일정 알림: ${title} (${date} ${category||''})`,
    type: 'schedule',
    schedule: ev,
    createdAt: new Date().toISOString()
  });
  const members = await User.find({ classId: me.classId, id: { $ne: me.id } });
  const toNotify = members.filter(m=>m.notifyEnabled!==false);
  for (const m of toNotify) {
    await ClassNotification.create({
      id: uuidv4(),
      classId: me.classId,
      forUserId: m.id,
      title: `새 일정: ${title}`,
      date,
      category: category||'학사',
      author: me.name,
      scheduleId: ev.id,
      createdAt: new Date().toISOString(),
      read: false
    });
  }
  res.json({ event: ev, message: scheduleMsg, notified: toNotify.length });
});

app.get('/api/class/notifications', auth, async (req,res)=>{
  const me = await User.findOne({ id: req.user.id });
  if(!me) return res.status(404).json({ error: '사용자 없음' });
  if(me.notifyEnabled===false) return res.json([]);
  let list = await ClassNotification.find({ forUserId: me.id, read: false });
  list.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  list = list.slice(0,10);
  res.json(list);
});

app.post('/api/class/notifications/read', auth, async (req,res)=>{
  const { ids } = req.body;
  const idArr = Array.isArray(ids) ? ids : [ids].filter(Boolean);
  let changed = 0;
  if(idArr.length===0){
    const r = await ClassNotification.updateMany({ forUserId: req.user.id }, { read: true });
    changed = r.modifiedCount;
  } else {
    for (const id of idArr) {
      const n = await ClassNotification.findOne({ id, forUserId: req.user.id, read: false });
      if (n) { n.read = true; await n.save(); changed++; }
    }
  }
  res.json({ ok: true, changed });
});

app.put('/api/settings/notify', auth, async (req,res)=>{
  const { enabled } = req.body;
  const me = await User.findOne({ id: req.user.id });
  if(!me) return res.status(404).json({ error: '사용자 없음' });
  me.notifyEnabled = !!enabled;
  await me.save();
  res.json({ user: safeUser(me), token: signToken(me), enabled: !!enabled });
});

app.get('/api/class/private-messages', auth, async (req,res)=>{
  const { withUserId } = req.query;
  if(!withUserId) return res.status(400).json({ error: '대화 상대 필요' });
  const me = await User.findOne({ id: req.user.id });
  const other = await User.findOne({ id: withUserId });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  if(!other || other.classId!==me.classId) return res.status(400).json({ error: '같은 반이 아닙니다.' });
  let list = await ClassPrivateMessage.find({ $or: [
    { fromId: me.id, toId: withUserId },
    { fromId: withUserId, toId: me.id }
  ] });
  list.sort((a,b)=> new Date(a.createdAt)-new Date(b.createdAt));
  if(list.length>100) list = list.slice(-100);
  res.json(list);
});

app.post('/api/class/private-messages', auth, async (req,res)=>{
  const { toUserId, text, type, emoticonId } = req.body;
  if(!toUserId) return res.status(400).json({ error: '상대 필요' });
  if(type==='emoticon'){
    if(!emoticonId || !EMOTICONS.includes(emoticonId)) return res.status(400).json({ error: '올바른 이모티콘을 선택해주세요.' });
  } else {
    if(!text || !text.trim()) return res.status(400).json({ error: '내용 필요' });
  }
  const me = await User.findOne({ id: req.user.id });
  const other = await User.findOne({ id: toUserId });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  if(!other || other.classId!==me.classId) return res.status(400).json({ error: '같은 반이 아닙니다.' });
  const msg = await ClassPrivateMessage.create({
    id: uuidv4(),
    classId: me.classId,
    fromId: me.id,
    fromName: me.name,
    toId: toUserId,
    toName: other.name,
    text: (text||'').trim(),
    type: type || 'text',
    emoticonId: emoticonId || null,
    createdAt: new Date().toISOString()
  });
  res.json(msg);
});

app.get('/api/class/private-inbox', auth, async (req,res)=>{
  const me = await User.findOne({ id: req.user.id });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  let list = await ClassPrivateMessage.find({ $or: [{ toId: me.id }, { fromId: me.id }] });
  list.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  list = list.slice(0,50);
  res.json(list);
});

app.post('/api/class/votes', auth, async (req,res)=>{
  const me = await User.findOne({ id: req.user.id });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  const { title, options } = req.body;
  if(!title || !Array.isArray(options) || options.length<2) return res.status(400).json({ error: '제목과 2개 이상 선택지를 입력해주세요.' });
  const cleanOpts = options.map(o=> String(o).trim()).filter(Boolean).slice(0,6);
  if(cleanOpts.length<2) return res.status(400).json({ error: '선택지 2개 이상 필요' });
  const vote = await ClassVote.create({
    id: uuidv4(),
    classId: me.classId,
    author: me.name,
    authorId: me.id,
    title: title.trim(),
    options: cleanOpts.map((txt,i)=> ({ id: `opt${i}`, text: txt, votes: [] })),
    createdAt: new Date().toISOString(),
    status: 'open'
  });
  await ClassGroupMessage.create({
    id: uuidv4(),
    classId: me.classId,
    author: me.name,
    authorId: me.id,
    role: me.role,
    text: `📊 투표: ${title}`,
    type: 'vote',
    voteId: vote.id,
    createdAt: new Date().toISOString()
  });
  res.json(vote);
});

app.get('/api/class/votes', auth, async (req,res)=>{
  const me = await User.findOne({ id: req.user.id });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  let list = await ClassVote.find({ classId: me.classId });
  list.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  res.json(list);
});

app.post('/api/class/votes/:id/vote', auth, async (req,res)=>{
  const { optionId } = req.body;
  if(!optionId) return res.status(400).json({ error: '선택지 필요' });
  const me = await User.findOne({ id: req.user.id });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  const vote = await ClassVote.findOne({ id: req.params.id, classId: me.classId });
  if(!vote) return res.status(404).json({ error: '투표 없음' });
  if(vote.status!=='open') return res.status(400).json({ error: '종료된 투표' });
  vote.options.forEach(opt=>{ opt.votes = opt.votes.filter(uid=> uid!==me.id); });
  const opt = vote.options.find(o=> o.id===optionId);
  if(!opt) return res.status(400).json({ error: '선택지 없음' });
  opt.votes.push(me.id);
  await vote.save();
  res.json(vote);
});

app.post('/api/class/votes/:id/close', auth, async (req,res)=>{
  const me = await User.findOne({ id: req.user.id });
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  const vote = await ClassVote.findOne({ id: req.params.id, classId: me.classId });
  if(!vote) return res.status(404).json({ error: '투표 없음' });
  if(vote.authorId!==me.id && me.role!=='teacher') return res.status(403).json({ error: '작성자나 선생님만 종료 가능' });
  vote.status = 'closed';
  await vote.save();
  res.json(vote);
});

// catch all to index.html
app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});

async function start() {
  await connectDB();
  const server = app.listen(PORT, ()=> {
    console.log(`✅ 성수고등학교 서버 실행중: http://localhost:${PORT}`);
  });
  server.on('error', (err)=>{
    if(err.code === 'EADDRINUSE'){
      console.error(`\n❌ 포트 ${PORT}가 이미 사용 중입니다!`);
      console.error(`   해결: stop.bat 실행 또는 명령 프롬프트에서 아래 실행:`);
      console.error(`   netstat -ano | findstr :${PORT}`);
      console.error(`   taskkill /F /PID <번호>\n`);
      process.exit(1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

start().catch(err => {
  console.error('❌ 서버 시작 실패:', err.message);
  process.exit(1);
});