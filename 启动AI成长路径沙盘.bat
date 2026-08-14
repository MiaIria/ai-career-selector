@echo off
setlocal
title AI成长路径沙盘 - 本地服务
cd /d "%~dp0"

if not exist "node_modules" (
  echo.
  echo 未找到项目依赖，请先在此文件夹打开终端并运行 npm install。
  echo.
  pause
  exit /b 1
)

echo.
echo 正在启动 AI成长路径沙盘...
echo 浏览器将自动打开：http://localhost:3000
echo 关闭此窗口即可停止本地服务。
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000'"
call npm run dev -- --port 3000

endlocal
