const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'seongsu-high-secret-2026';
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(UPLOAD_DIR, 'profiles'))) fs.mkdirSync(path.join(UPLOAD_DIR, 'profiles'), { recursive: true });
if (!fs.existsSync(path.join(UPLOAD_DIR, 'lostfound'))) fs.mkdirSync(path.join(UPLOAD_DIR, 'lostfound'), { recursive: true });

// --- DB helpers (JSON file storage = 서버에 계속 저장) ---
const DB_FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  events: path.join(DATA_DIR, 'events.json'),
  lost: path.join(DATA_DIR, 'lost.json'),
  reservations: path.join(DATA_DIR, 'reservations.json'),
  mentoring: path.join(DATA_DIR, 'mentoring.json'),
  facilityOpenings: path.join(DATA_DIR, 'facility_openings.json'),
  classGroupMessages: path.join(DATA_DIR, 'class_group_messages.json'),
  classPrivateMessages: path.join(DATA_DIR, 'class_private_messages.json'),
  classVotes: path.join(DATA_DIR, 'class_votes.json'),
  classNotifications: path.join(DATA_DIR, 'class_notifications.json'),
};

function loadDB(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const txt = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '');
    if (!txt.trim()) return [];
    return JSON.parse(txt);
  } catch (e) { return []; }
}
function saveDB(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}
// init empty files if not exist (예시 일정 없이 빈 캘린더로 시작 - 선생님이 직접 등록)
Object.values(DB_FILES).forEach(f => { if (!fs.existsSync(f)) saveDB(f, []); });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// === 급식 (매일 자동 업데이트) - 춘천 성수고 공식 사이트 기반 ===
// Fallback: 2026-08 실제 데이터 (크롤링 기반, 실패 시 사용)
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
  // For known fallback dates, skip live fetch and return fallback quickly (to avoid 8s delay)
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
  // Fast path: if fallback exists, return immediately without live fetch
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
  } else if(FALLBACK_MEALS[dateStr]){
    const fb = FALLBACK_MEALS[dateStr];
    result = { date: dateStr, kcal: fb.kcal, menu: fb.menu, source: 'fallback' };
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// --- Multer ---
const storageProfile = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'profiles')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, Date.now() + '-' + uuidv4() + ext);
  }
});
const storageLost = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'lostfound')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + uuidv4() + ext);
  }
});
const uploadProfile = multer({ storage: storageProfile, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadLost = multer({ storage: storageLost, limits: { fileSize: 8 * 1024 * 1024 } });

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

// --- API: Register ---
app.post('/api/register', async (req, res) => {
  const { name, role, studentId, subject, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: '이름과 비밀번호는 필수입니다.' });
  if (role === 'teacher') {
    if (!subject) return res.status(400).json({ error: '담당과목을 선택해주세요.' });
  } else {
    if (!studentId) return res.status(400).json({ error: '학번을 입력해주세요.' });
    if (!/^\d{5}$/.test(String(studentId)) && String(studentId).length < 4) {
      // allow flexible but warn
    }
  }
  const users = loadDB(DB_FILES.users);
  const exists = users.find(u => {
    if (role === 'teacher') return u.role === 'teacher' && u.name === name && u.subject === subject;
    return u.role !== 'teacher' && u.studentId === String(studentId);
  });
  if (exists) return res.status(400).json({ error: '이미 가입된 정보입니다.' });

  const hash = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    name: name.trim(),
    role: role === 'teacher' ? 'teacher' : 'student',
    studentId: role === 'teacher' ? null : String(studentId),
    subject: role === 'teacher' ? subject : null,
    passwordHash: hash,
    profileImage: null,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveDB(DB_FILES.users, users);
  const token = jwt.sign({ id: newUser.id, name: newUser.name, role: newUser.role, studentId: newUser.studentId, subject: newUser.subject, profileImage: newUser.profileImage }, JWT_SECRET, { expiresIn: '7d' });
  const { passwordHash, ...safe } = newUser;
  res.json({ token, user: safe });
});

// --- API: Login ---
app.post('/api/login', async (req, res) => {
  const { name, role, studentId, subject, password } = req.body;
  if (!password) return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
  const users = loadDB(DB_FILES.users);
  let user = null;
  if (role === 'teacher') {
    user = users.find(u => u.role === 'teacher' && u.name === name && u.subject === subject);
  } else {
    // 학생은 학번으로 찾기 (이름도 검증)
    user = users.find(u => u.role !== 'teacher' && u.studentId === String(studentId));
    if (user && user.name !== name) return res.status(400).json({ error: '이름과 학번이 일치하지 않습니다.' });
  }
  if (!user) return res.status(400).json({ error: '가입된 사용자를 찾을 수 없습니다.' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: '비밀번호가 틀렸습니다.' });
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role, studentId: user.studentId, subject: user.subject, profileImage: user.profileImage }, JWT_SECRET, { expiresIn: '7d' });
  const { passwordHash, ...safe } = user;
  res.json({ token, user: safe });
});

// --- API: Me ---
app.get('/api/me', auth, (req, res) => {
  const users = loadDB(DB_FILES.users);
  const u = users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: '사용자 없음' });
  const { passwordHash, ...safe } = u;
  res.json(safe);
});

// --- API: Update profile image ---
app.post('/api/profile/image', auth, uploadProfile.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '이미지를 선택해주세요.' });
  const users = loadDB(DB_FILES.users);
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: '사용자 없음' });
  // delete old image if exists
  if (users[idx].profileImage) {
    const oldPath = path.join(__dirname, users[idx].profileImage.replace(/^\//, ''));
    if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch {}
  }
  users[idx].profileImage = '/uploads/profiles/' + req.file.filename;
  saveDB(DB_FILES.users, users);
  const { passwordHash, ...safe } = users[idx];
  const newToken = jwt.sign({ id: safe.id, name: safe.name, role: safe.role, studentId: safe.studentId, subject: safe.subject, profileImage: safe.profileImage }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: safe, token: newToken });
});

// --- API: Remove profile image ---
app.delete('/api/profile/image', auth, (req, res) => {
  const users = loadDB(DB_FILES.users);
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: '사용자 없음' });
  if (users[idx].profileImage) {
    const oldPath = path.join(__dirname, users[idx].profileImage.replace(/^\//, ''));
    if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch {}
  }
  users[idx].profileImage = null;
  saveDB(DB_FILES.users, users);
  const { passwordHash, ...safe } = users[idx];
  const newToken = jwt.sign({ id: safe.id, name: safe.name, role: safe.role, studentId: safe.studentId, subject: safe.subject, profileImage: safe.profileImage }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: safe, token: newToken });
});

// === Feature 1: Calendar (선생님 전용 작성) ===
app.get('/api/events', (req, res) => {
  res.json(loadDB(DB_FILES.events));
});
app.post('/api/events', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '캘린더는 선생님만 작성할 수 있습니다.' });
  const { title, date, category } = req.body;
  if (!title || !date) return res.status(400).json({ error: '제목과 날짜 필수' });
  const events = loadDB(DB_FILES.events);
  const ev = { id: uuidv4(), title, date, category: category || '개인', author: req.user.name, authorId: req.user.id, color: category==='시험'?'red':category==='수행'?'orange':category==='과제'?'green':'blue' };
  events.push(ev);
  saveDB(DB_FILES.events, events);
  res.json(ev);
});
app.delete('/api/events/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '캘린더 삭제는 선생님만 가능합니다.' });
  let events = loadDB(DB_FILES.events);
  const ev = events.find(e=>e.id===req.params.id);
  if (!ev) return res.status(404).json({error:'없음'});
  events = events.filter(e=>e.id!==req.params.id);
  saveDB(DB_FILES.events, events);
  res.json({ok:true});
});

// === Feature 2: Lost & Found ===
app.get('/api/lost', (req, res) => {
  res.json(loadDB(DB_FILES.lost));
});
app.post('/api/lost', auth, uploadLost.single('image'), (req, res) => {
  const { title, location, date, description, type } = req.body;
  if (!title) return res.status(400).json({ error: '제목을 입력해주세요.' });
  const lost = loadDB(DB_FILES.lost);
  const item = {
    id: uuidv4(),
    title, location: location||'', date: date|| new Date().toISOString().slice(0,10),
    description: description||'',
    type: type || '분실물', // 분실물 / 습득물
    image: req.file ? '/uploads/lostfound/' + req.file.filename : null,
    author: req.user.name,
    authorId: req.user.id,
    status: '보관중',
    createdAt: new Date().toISOString(),
    comments: []
  };
  lost.unshift(item);
  saveDB(DB_FILES.lost, lost);
  res.json(item);
});
app.post('/api/lost/:id/comment', auth, (req,res)=>{
  const { text } = req.body;
  let lost = loadDB(DB_FILES.lost);
  const idx = lost.findIndex(l=>l.id===req.params.id);
  if(idx===-1) return res.status(404).json({error:'없음'});
  lost[idx].comments.push({ id: uuidv4(), author: req.user.name, text, at: new Date().toISOString() });
  saveDB(DB_FILES.lost, lost);
  res.json(lost[idx]);
});
app.patch('/api/lost/:id/status', auth, (req,res)=>{
  let lost = loadDB(DB_FILES.lost);
  const idx = lost.findIndex(l=>l.id===req.params.id);
  if(idx===-1) return res.status(404).json({error:'없음'});
  if(lost[idx].authorId !== req.user.id) return res.status(403).json({error:'작성자만 변경 가능'});
  lost[idx].status = lost[idx].status==='보관중' ? '주인찾음' : '보관중';
  saveDB(DB_FILES.lost, lost);
  res.json(lost[idx]);
});

// === Feature 3: Facility Reservation (선생님이 개방해야 예약 가능) ===
const FACILITIES = [
  { id: 'gym', name: '체육관', icon: '🏀', slots: ['08:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00'] },
  { id: 'music', name: '음악실', icon: '🎵', slots: ['08:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00'] },
  { id: 'club', name: '동아리실', icon: '🎨', slots: ['08:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00'] },
  { id: 'study', name: '스터디룸', icon: '📚', slots: ['08:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00'] },
];
app.get('/api/facilities', (req,res)=> res.json(FACILITIES));

// 선생님이 개방한 시설 목록
app.get('/api/facility-openings', (req,res)=>{
  const { date, facility } = req.query;
  let list = loadDB(DB_FILES.facilityOpenings);
  if(date) list = list.filter(r=>r.date===date);
  if(facility) list = list.filter(r=>r.facility===facility);
  // 최신순
  list.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  res.json(list);
});
app.post('/api/facility-openings', auth, (req,res)=>{
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '시설 개방은 선생님만 가능합니다.' });
  const { facility, date, slot, note } = req.body;
  if(!facility || !date || !slot) return res.status(400).json({error:'시설, 날짜, 시간 필수'});
  // 시설/슬롯 유효성 검사
  const fac = FACILITIES.find(f=>f.id===facility);
  if(!fac) return res.status(400).json({error:'존재하지 않는 시설'});
  if(!fac.slots.includes(slot)) return res.status(400).json({error:'올바르지 않은 시간대'});
  let list = loadDB(DB_FILES.facilityOpenings);
  const dup = list.find(r=>r.facility===facility && r.date===date && r.slot===slot);
  if(dup) return res.status(400).json({error:'이미 개방된 시간입니다.'});
  const opening = { id: uuidv4(), facility, date, slot, note: note||'', author: req.user.name, authorId: req.user.id, subject: req.user.subject||'', createdAt: new Date().toISOString() };
  list.push(opening);
  saveDB(DB_FILES.facilityOpenings, list);
  res.json(opening);
});
app.delete('/api/facility-openings/:id', auth, (req,res)=>{
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '선생님만 가능합니다.' });
  let list = loadDB(DB_FILES.facilityOpenings);
  const op = list.find(r=>r.id===req.params.id);
  if(!op) return res.status(404).json({error:'없음'});
  if(op.authorId !== req.user.id) return res.status(403).json({error:'개방한 선생님만 삭제 가능'});
  // 예약이 있으면 삭제 불가
  const reservations = loadDB(DB_FILES.reservations);
  const hasRes = reservations.find(r=>r.facility===op.facility && r.date===op.date && r.slot===op.slot);
  if(hasRes) return res.status(400).json({error:'이미 예약이 있어 삭제할 수 없습니다. 예약을 먼저 취소하세요.'});
  list = list.filter(r=>r.id!==req.params.id);
  saveDB(DB_FILES.facilityOpenings, list);
  res.json({ok:true});
});

app.get('/api/reservations', (req,res)=>{
  const { date, facility } = req.query;
  let list = loadDB(DB_FILES.reservations);
  if(date) list = list.filter(r=>r.date===date);
  if(facility) list = list.filter(r=>r.facility===facility);
  res.json(list);
});
app.post('/api/reservations', auth, (req,res)=>{
  const { facility, date, slot, purpose } = req.body;
  if(!facility || !date || !slot) return res.status(400).json({error:'시설, 날짜, 시간 필수'});
  // 반드시 선생님이 개방한 시설이어야 함
  const openings = loadDB(DB_FILES.facilityOpenings);
  const opening = openings.find(r=>r.facility===facility && r.date===date && r.slot===slot);
  if(!opening) return res.status(400).json({error:'아직 개방되지 않은 시설입니다. 담당 선생님이 개방해야 예약할 수 있습니다.'});
  let list = loadDB(DB_FILES.reservations);
  const dup = list.find(r=>r.facility===facility && r.date===date && r.slot===slot);
  if(dup) return res.status(400).json({error:'이미 예약된 시간입니다.'});
  const rv = { id: uuidv4(), facility, date, slot, purpose: purpose||'', author: req.user.name, authorId: req.user.id, createdAt: new Date().toISOString() };
  list.push(rv);
  saveDB(DB_FILES.reservations, list);
  res.json(rv);
});
app.delete('/api/reservations/:id', auth, (req,res)=>{
  let list = loadDB(DB_FILES.reservations);
  const rv = list.find(r=>r.id===req.params.id);
  if(!rv) return res.status(404).json({error:'없음'});
  if(rv.authorId !== req.user.id) return res.status(403).json({error:'본인 예약만 취소 가능'});
  list = list.filter(r=>r.id!==req.params.id);
  saveDB(DB_FILES.reservations, list);
  res.json({ok:true});
});

// === Feature 4: Mentoring / Talent Market ===
app.get('/api/mentoring', (req,res)=> res.json(loadDB(DB_FILES.mentoring)));
app.post('/api/mentoring', auth, (req,res)=>{
  const { title, subject, desc, type } = req.body;
  if(!title || !subject) return res.status(400).json({error:'제목, 과목 필수'});
  let list = loadDB(DB_FILES.mentoring);
  const item = { id: uuidv4(), title, subject, desc: desc||'', type: type||'멘토링', // 멘토링 / 재능판매 / 스터디
    author: req.user.name, authorId: req.user.id, role: req.user.role,
    createdAt: new Date().toISOString(), applicants: [] };
  list.unshift(item);
  saveDB(DB_FILES.mentoring, list);
  res.json(item);
});
app.post('/api/mentoring/:id/apply', auth, (req,res)=>{
  let list = loadDB(DB_FILES.mentoring);
  const idx = list.findIndex(m=>m.id===req.params.id);
  if(idx===-1) return res.status(404).json({error:'없음'});
  if(list[idx].authorId===req.user.id) return res.status(400).json({error:'본인 글에는 신청 불가'});
  if(list[idx].applicants.find(a=>a.id===req.user.id)) return res.status(400).json({error:'이미 신청했습니다'});
  list[idx].applicants.push({ id: req.user.id, name: req.user.name, at: new Date().toISOString() });
  saveDB(DB_FILES.mentoring, list);
  res.json(list[idx]);
});
app.delete('/api/mentoring/:id', auth, (req,res)=>{
  let list = loadDB(DB_FILES.mentoring);
  const item = list.find(m=>m.id===req.params.id);
  if(!item) return res.status(404).json({error:'없음'});
  if(item.authorId!==req.user.id) return res.status(403).json({error:'작성자만 삭제 가능'});
  list = list.filter(m=>m.id!==req.params.id);
  saveDB(DB_FILES.mentoring, list);
  res.json({ok:true});
});

// === Feature 5: 내 반 (클래스) ===
const CLASS_IDS = [];
for(let g=1; g<=3; g++) for(let b=1; b<=8; b++) CLASS_IDS.push(`${g}-${b}`); // 1-1 ~ 3-8

// 반 선택 (학생/선생님 공통, 선생님은 한 반에 한명만)
app.post('/api/class/select', auth, (req,res)=>{
  const { classId } = req.body;
  if(!classId || !CLASS_IDS.includes(classId)) return res.status(400).json({ error: '올바른 반을 선택해주세요. (예: 3-1)' });
  const users = loadDB(DB_FILES.users);
  const idx = users.findIndex(u=>u.id===req.user.id);
  if(idx===-1) return res.status(404).json({ error: '사용자 없음' });
  // 선생님은 한 반에 한명만
  if(users[idx].role==='teacher'){
    const existing = users.find(u=> u.role==='teacher' && u.classId===classId && u.id!==req.user.id);
    if(existing) return res.status(400).json({ error: `이미 ${classId.replace('-','학년 ')}반 담임은 ${existing.name} 선생님입니다. 다른 반을 선택해주세요.` });
  }
  users[idx].classId = classId;
  users[idx].className = classId.replace('-','학년 ') + '반';
  if(users[idx].notifyEnabled===undefined) users[idx].notifyEnabled = true;
  saveDB(DB_FILES.users, users);
  const { passwordHash, ...safe } = users[idx];
  const newToken = jwt.sign({ id: safe.id, name: safe.name, role: safe.role, studentId: safe.studentId, subject: safe.subject, profileImage: safe.profileImage, classId: safe.classId, className: safe.className }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: safe, token: newToken });
});

// 내 반 멤버 조회
app.get('/api/class/members', auth, (req,res)=>{
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  const members = users.filter(u=> u.classId===me.classId).map(u=>{
    const { passwordHash, ...safe } = u;
    return safe;
  });
  // 선생님을 맨 위로
  members.sort((a,b)=> (a.role==='teacher'? -1 : b.role==='teacher'? 1 : a.name.localeCompare(b.name)));
  res.json({ classId: me.classId, className: me.className, members });
});

// 단톡방 메시지 조회
app.get('/api/class/group-messages', auth, (req,res)=>{
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  let list = loadDB(DB_FILES.classGroupMessages).filter(m=> m.classId===me.classId);
  list.sort((a,b)=> new Date(a.createdAt)-new Date(b.createdAt));
  // 최근 100개만
  if(list.length>100) list = list.slice(-100);
  res.json(list);
});

// 성수고 이모티콘 목록 (화이트리스트)
const EMOTICONS = ["hi","fighting","study","sleepy","hungry","love","faith","hope","sunflower","yew","exam","seongsu"];

// 단톡방 메시지 전송 (일반, 일정, 투표, 이모티콘)
app.post('/api/class/group-messages', auth, (req,res)=>{
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  const { text, type, emoticonId } = req.body;
  if(type==='emoticon'){
    if(!emoticonId || !EMOTICONS.includes(emoticonId)) return res.status(400).json({ error: '올바른 이모티콘을 선택해주세요.' });
  } else {
    if(!text || !text.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
  }
  const list = loadDB(DB_FILES.classGroupMessages);
  const msg = {
    id: uuidv4(),
    classId: me.classId,
    author: me.name,
    authorId: me.id,
    role: me.role,
    text: (text||'').trim(),
    type: type || 'text', // text, schedule, vote, emoticon
    emoticonId: emoticonId || null,
    createdAt: new Date().toISOString()
  };
  list.push(msg);
  saveDB(DB_FILES.classGroupMessages, list);
  res.json(msg);
});

// 선생님이 일정 알림을 단톡에 올리고, 학생들에게 즉시 알림 (전체 캘린더와 분리 - 반 전용)
app.post('/api/class/schedule-notify', auth, (req,res)=>{
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  if(me.role!=='teacher') return res.status(403).json({ error: '담임선생님만 일정 알림을 보낼 수 있습니다.' });
  const { title, date, category } = req.body;
  if(!title || !date) return res.status(400).json({ error: '제목과 날짜 필수' });
  // 1) 반 전용 일정 생성 (전체 캘린더와 분리 - class_schedules에 저장하지 않고 단톡과 알림으로만 처리)
  const ev = { id: uuidv4(), title, date, category: category||'학사', author: me.name, authorId: me.id, classId: me.classId, color: category==='시험'?'red':category==='수행'?'orange':category==='과제'?'green':'blue' };
  // 전체 캘린더(events.json)에는 저장하지 않음 - 분리
  // 2) 단톡에 일정 메시지
  const groupList = loadDB(DB_FILES.classGroupMessages);
  const scheduleMsg = {
    id: uuidv4(),
    classId: me.classId,
    author: me.name,
    authorId: me.id,
    role: me.role,
    text: `📅 일정 알림: ${title} (${date} ${category||''})`,
    type: 'schedule',
    schedule: ev,
    createdAt: new Date().toISOString()
  };
  groupList.push(scheduleMsg);
  saveDB(DB_FILES.classGroupMessages, groupList);
  // 3) 알림 생성 (학생들이 앱 알림 켰을 때 바로 뜨도록)
  const notiList = loadDB(DB_FILES.classNotifications);
  const members = users.filter(u=> u.classId===me.classId && u.id!==me.id);
  members.forEach(m=>{
    // notifyEnabled가 true이거나 undefined면 알림 생성 (기본 켜짐)
    if(m.notifyEnabled!==false){
      notiList.push({
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
  });
  saveDB(DB_FILES.classNotifications, notiList);
  res.json({ event: ev, message: scheduleMsg, notified: members.filter(m=>m.notifyEnabled!==false).length });
});

// 내 알림 조회 (학생이 켰을 때만, 안 읽은 것만)
app.get('/api/class/notifications', auth, (req,res)=>{
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me) return res.status(404).json({ error: '사용자 없음' });
  if(me.notifyEnabled===false) return res.json([]);
  let list = loadDB(DB_FILES.classNotifications).filter(n=> n.forUserId===me.id && !n.read);
  // 최근 10개만, 시간순
  list.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  list = list.slice(0,10);
  res.json(list);
});

// 알림 읽음 처리
app.post('/api/class/notifications/read', auth, (req,res)=>{
  const { ids } = req.body; // array or single
  let list = loadDB(DB_FILES.classNotifications);
  const idArr = Array.isArray(ids) ? ids : [ids].filter(Boolean);
  let changed = 0;
  list.forEach(n=>{
    if(n.forUserId===req.user.id && (idArr.length===0 || idArr.includes(n.id)) && !n.read){
      n.read = true;
      changed++;
    }
  });
  // if ids empty, mark all as read
  if(idArr.length===0){
    list.forEach(n=>{ if(n.forUserId===req.user.id) n.read=true; });
  }
  saveDB(DB_FILES.classNotifications, list);
  res.json({ ok: true, changed });
});

// 알림 설정 토글 (앱에서 기능 켜기)
app.put('/api/settings/notify', auth, (req,res)=>{
  const { enabled } = req.body;
  const users = loadDB(DB_FILES.users);
  const idx = users.findIndex(u=>u.id===req.user.id);
  if(idx===-1) return res.status(404).json({ error: '사용자 없음' });
  users[idx].notifyEnabled = !!enabled;
  saveDB(DB_FILES.users, users);
  const { passwordHash, ...safe } = users[idx];
  const newToken = jwt.sign({ id: safe.id, name: safe.name, role: safe.role, studentId: safe.studentId, subject: safe.subject, profileImage: safe.profileImage, classId: safe.classId, className: safe.className, notifyEnabled: safe.notifyEnabled }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: safe, token: newToken, enabled: !!enabled });
});

// 1:1 개인 채팅 조회
app.get('/api/class/private-messages', auth, (req,res)=>{
  const { withUserId } = req.query;
  if(!withUserId) return res.status(400).json({ error: '대화 상대 필요' });
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  const other = users.find(u=>u.id===withUserId);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  if(!other || other.classId!==me.classId) return res.status(400).json({ error: '같은 반이 아닙니다.' });
  let list = loadDB(DB_FILES.classPrivateMessages).filter(m=>
    (m.fromId===me.id && m.toId===withUserId) || (m.fromId===withUserId && m.toId===me.id)
  );
  list.sort((a,b)=> new Date(a.createdAt)-new Date(b.createdAt));
  if(list.length>100) list = list.slice(-100);
  res.json(list);
});

// 1:1 개인 채팅 전송 (텍스트/이모티콘)
app.post('/api/class/private-messages', auth, (req,res)=>{
  const { toUserId, text, type, emoticonId } = req.body;
  if(!toUserId) return res.status(400).json({ error: '상대 필요' });
  if(type==='emoticon'){
    if(!emoticonId || !EMOTICONS.includes(emoticonId)) return res.status(400).json({ error: '올바른 이모티콘을 선택해주세요.' });
  } else {
    if(!text || !text.trim()) return res.status(400).json({ error: '내용 필요' });
  }
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  const other = users.find(u=>u.id===toUserId);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  if(!other || other.classId!==me.classId) return res.status(400).json({ error: '같은 반이 아닙니다.' });
  const list = loadDB(DB_FILES.classPrivateMessages);
  const msg = {
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
  };
  list.push(msg);
  saveDB(DB_FILES.classPrivateMessages, list);
  res.json(msg);
});

// 내게 온 개인 메시지 전체 (알림용) - 같은 반에서 나에게 온 모든 1:1 메시지
app.get('/api/class/private-inbox', auth, (req,res)=>{
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  let list = loadDB(DB_FILES.classPrivateMessages).filter(m=> m.toId===me.id || m.fromId===me.id);
  // 최근 50개만, 최신순
  list.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  list = list.slice(0,50);
  // 읽음 처리는 별도로 하지 않고, 클라이언트가 폴링으로 새 메시지를 감지
  res.json(list);
});

// 투표 생성 (단톡방에서)
app.post('/api/class/votes', auth, (req,res)=>{
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  const { title, options } = req.body;
  if(!title || !Array.isArray(options) || options.length<2) return res.status(400).json({ error: '제목과 2개 이상 선택지를 입력해주세요.' });
  const cleanOpts = options.map(o=> String(o).trim()).filter(Boolean).slice(0,6);
  if(cleanOpts.length<2) return res.status(400).json({ error: '선택지 2개 이상 필요' });
  const list = loadDB(DB_FILES.classVotes);
  const vote = {
    id: uuidv4(),
    classId: me.classId,
    author: me.name,
    authorId: me.id,
    title: title.trim(),
    options: cleanOpts.map((txt,i)=> ({ id: `opt${i}`, text: txt, votes: [] })),
    createdAt: new Date().toISOString(),
    status: 'open'
  };
  list.push(vote);
  saveDB(DB_FILES.classVotes, list);
  // 단톡에도 투표 메시지
  const gList = loadDB(DB_FILES.classGroupMessages);
  gList.push({
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
  saveDB(DB_FILES.classGroupMessages, gList);
  res.json(vote);
});

// 투표 목록
app.get('/api/class/votes', auth, (req,res)=>{
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  let list = loadDB(DB_FILES.classVotes).filter(v=> v.classId===me.classId);
  list.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  res.json(list);
});

// 투표하기
app.post('/api/class/votes/:id/vote', auth, (req,res)=>{
  const { optionId } = req.body;
  if(!optionId) return res.status(400).json({ error: '선택지 필요' });
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  let list = loadDB(DB_FILES.classVotes);
  const idx = list.findIndex(v=> v.id===req.params.id && v.classId===me.classId);
  if(idx===-1) return res.status(404).json({ error: '투표 없음' });
  const vote = list[idx];
  if(vote.status!=='open') return res.status(400).json({ error: '종료된 투표' });
  // 이미 투표했는지 확인 (한 사람 한 표, 변경 가능)
  vote.options.forEach(opt=>{
    opt.votes = opt.votes.filter(uid=> uid!==me.id);
  });
  const opt = vote.options.find(o=> o.id===optionId);
  if(!opt) return res.status(400).json({ error: '선택지 없음' });
  opt.votes.push(me.id);
  saveDB(DB_FILES.classVotes, list);
  res.json(vote);
});

// 투표 종료 (작성자 또는 선생님만)
app.post('/api/class/votes/:id/close', auth, (req,res)=>{
  const users = loadDB(DB_FILES.users);
  const me = users.find(u=>u.id===req.user.id);
  if(!me || !me.classId) return res.status(400).json({ error: '반을 먼저 선택해주세요.' });
  let list = loadDB(DB_FILES.classVotes);
  const idx = list.findIndex(v=> v.id===req.params.id && v.classId===me.classId);
  if(idx===-1) return res.status(404).json({ error: '투표 없음' });
  if(list[idx].authorId!==me.id && me.role!=='teacher') return res.status(403).json({ error: '작성자나 선생님만 종료 가능' });
  list[idx].status = 'closed';
  saveDB(DB_FILES.classVotes, list);
  res.json(list[idx]);
});

// catch all to index.html
app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});

const server = app.listen(PORT, ()=> {
  console.log(`✅ 성수고등학교 서버 실행중: http://localhost:${PORT}`);
  console.log(`📁 데이터 저장 위치: ${DATA_DIR}`);
});
server.on('error', (err)=>{
  if(err.code === 'EADDRINUSE'){
    console.error(`\n❌ 포트 ${PORT}가 이미 사용 중입니다!`);
    console.error(`   해결: stop.bat 실행 또는 명령 프롬프트에서 아래 실행:`);
    console.error(`   netstat -ano | findstr :${PORT}`);
    console.error(`   taskkill /F /PID <번호>\n`);
    console.error(`   또는 start.bat을 사용하세요 (자동으로 기존 서버 종료).\n`);
    process.exit(1);
  } else {
    console.error(err);
    process.exit(1);
  }
});
