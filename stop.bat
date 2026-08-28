@echo off
echo 성수고 서버 종료 중...
taskkill /F /IM node.exe /T 2>nul
echo 종료되었습니다.
pause
