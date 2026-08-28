@echo off
chcp 65001 > nul
echo ==========================================
echo   성수고등학교 포털 서버 시작
echo ==========================================
cd /d "%~dp0"
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치해주세요.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo [설치] 패키지 설치 중...
  call npm install
)
echo [정리] 기존 서버 종료 중...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

echo [시작] 서버를 시작합니다...
echo.
echo 브라우저에서 아래 주소로 접속하세요:
echo   http://localhost:3000
echo.
echo 종료하려면 Ctrl+C 를 누르세요.
echo ==========================================
call npm start
pause
