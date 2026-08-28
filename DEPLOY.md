# 배포 가이드 (오류 없이)

## 1. 로컬에서 먼저 확인
```bash
cd "C:\Users\user\학교 폴더\학교 사이트"
npm install
npm start
# http://localhost:3000 접속 → 회원가입/로그인 테스트
```

## 2. GitHub 업로드
```bash
git init
git add .
git commit -m "성수고 포털 v1"
git branch -M main
git remote add origin https://github.com/xxxx/seongsu-portal.git
git push -u origin main
```

## 3. Render 배포 (가장 쉬움)
1. https://dashboard.render.com → New + → Web Service
2. Connect GitHub repo 선택
3. 설정:
   - Name: seongsu-high
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free
4. Advanced → Add Disk (중요!):
   - Name: seongsu-data
   - Mount Path: `/opt/render/project/src/data`
   - Size: 1GB
   - 이렇게 해야 `data/users.json`이 재배포 후에도 유지됨
5. Create Web Service → 2~3분 후 URL 생성
6. 로그에 `✅ 성수고등학교 서버 실행중: http://localhost:10000` 확인

## 4. Railway 배포
- https://railway.app → New Project → Deploy from GitHub
- 자동으로 Dockerfile 감지 → Deploy
- Variables에 `PORT=3000` 추가 (선택)

## 5. Docker 직접 배포 (학교 서버)
```bash
docker build -t seongsu-high .
docker run -d -p 80:3000 -v seongsu_data:/app/data -v seongsu_uploads:/app/uploads --name seongsu seongsu-high
```

## 6. 자주 나는 오류와 해결
| 오류 | 원인 | 해결 |
|------|------|------|
| `Cannot find module 'express'` | npm install 안 함 | `npm install` 실행 |
| `EADDRINUSE 3000` | 포트 중복 | `stop.bat` 또는 `taskkill /F /IM node.exe` |
| `JSON parse error` | 한글이 깨진 body | `Content-Type: application/json; charset=utf-8` 로 전송 (프론트에서는 이미 처리됨) |
| `data/users.json` 초기화됨 | Render 디스크 미연결 | Disk 연결 필수 |
| 로고 안 보임 | 경로 오류 | `/logo.svg`가 public 폴더에 있는지 확인 |

## 7. HTTPS 적용
- Render/Railway는 자동 HTTPS 제공
- 학교 서버라면 Cloudflare Tunnel 또는 Nginx reverse proxy 사용 권장

## 8. 백업
- `data/` 폴더와 `uploads/` 폴더를 주기적으로 백업
- 예: `zip -r backup.zip data uploads`

완료 후 `https://당신의도메인` 에서 성수고 로고와 함께 정상 작동 확인!
