const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// --- .env 로더 (dotenv 의존성 없이) ---
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !m[1].startsWith('#')) {
        const val = m[2].replace(/^["']|["']$/g, '');
        if (process.env[m[1]] === undefined) process.env[m[1]] = val;
      }
    });
  }
} catch (e) {}

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI 환경변수가 없습니다. MongoDB Atlas 연결 문자열을 .env 파일 또는 Render 환경변수에 지정하세요.'
    );
  }
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB 연결됨');
}

// 공통 스키마 옵션: _id/__v 제거 (클라이언트와 기존 JSON 응답 형태 유지)
function applyTransforms(schema) {
  const opts = {
    versionKey: false,
    transform(doc, ret) {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  };
  schema.set('toJSON', opts);
  schema.set('toObject', opts);
}

// 하위 문서 공통
const commentSchema = new mongoose.Schema(
  { id: String, author: String, text: String, at: String },
  { _id: false }
);
const applicantSchema = new mongoose.Schema(
  { id: String, name: String, at: String },
  { _id: false }
);
const voteOptionSchema = new mongoose.Schema(
  { id: String, text: String, votes: [String] },
  { _id: false }
);

// --- Models ---
const UserSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  role: String,
  studentId: String,
  subject: String,
  passwordHash: String,
  profileImage: String,
  createdAt: String,
  classId: String,
  className: String,
  notifyEnabled: Boolean,
  email: String,
});
applyTransforms(UserSchema);
const User = mongoose.model('User', UserSchema);

const EventSchema = new mongoose.Schema({
  id: String,
  title: String,
  date: String,
  category: String,
  author: String,
  authorId: String,
  color: String,
});
applyTransforms(EventSchema);
const Event = mongoose.model('Event', EventSchema);

const LostSchema = new mongoose.Schema({
  id: String,
  title: String,
  location: String,
  date: String,
  description: String,
  type: String,
  image: String,
  author: String,
  authorId: String,
  status: String,
  createdAt: String,
  comments: [commentSchema],
});
applyTransforms(LostSchema);
const Lost = mongoose.model('Lost', LostSchema);

const FacilityOpeningSchema = new mongoose.Schema({
  id: String,
  facility: String,
  date: String,
  slot: String,
  note: String,
  author: String,
  authorId: String,
  subject: String,
  createdAt: String,
});
applyTransforms(FacilityOpeningSchema);
const FacilityOpening = mongoose.model('FacilityOpening', FacilityOpeningSchema);

const ReservationSchema = new mongoose.Schema({
  id: String,
  facility: String,
  date: String,
  slot: String,
  purpose: String,
  author: String,
  authorId: String,
  createdAt: String,
});
applyTransforms(ReservationSchema);
const Reservation = mongoose.model('Reservation', ReservationSchema);

const MentoringSchema = new mongoose.Schema({
  id: String,
  title: String,
  subject: String,
  desc: String,
  type: String,
  author: String,
  authorId: String,
  role: String,
  createdAt: String,
  applicants: [applicantSchema],
});
applyTransforms(MentoringSchema);
const Mentoring = mongoose.model('Mentoring', MentoringSchema);

const ClassGroupMessageSchema = new mongoose.Schema({
  id: String,
  classId: String,
  author: String,
  authorId: String,
  role: String,
  text: String,
  type: String,
  emoticonId: String,
  schedule: mongoose.Schema.Types.Mixed,
  voteId: String,
  createdAt: String,
});
applyTransforms(ClassGroupMessageSchema);
const ClassGroupMessage = mongoose.model('ClassGroupMessage', ClassGroupMessageSchema);

const ClassPrivateMessageSchema = new mongoose.Schema({
  id: String,
  classId: String,
  fromId: String,
  fromName: String,
  toId: String,
  toName: String,
  text: String,
  type: String,
  emoticonId: String,
  createdAt: String,
});
applyTransforms(ClassPrivateMessageSchema);
const ClassPrivateMessage = mongoose.model('ClassPrivateMessage', ClassPrivateMessageSchema);

const ClassVoteSchema = new mongoose.Schema({
  id: String,
  classId: String,
  author: String,
  authorId: String,
  title: String,
  options: [voteOptionSchema],
  createdAt: String,
  status: String,
});
applyTransforms(ClassVoteSchema);
const ClassVote = mongoose.model('ClassVote', ClassVoteSchema);

const ClassNotificationSchema = new mongoose.Schema({
  id: String,
  classId: String,
  forUserId: String,
  title: String,
  date: String,
  category: String,
  author: String,
  scheduleId: String,
  createdAt: String,
  read: Boolean,
});
applyTransforms(ClassNotificationSchema);
const ClassNotification = mongoose.model('ClassNotification', ClassNotificationSchema);

module.exports = {
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
};