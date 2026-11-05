@echo off
rem ============================================================
rem  FastBCP dev server launcher (double-click to run)
rem  - starts `npm run dev` in this window
rem  - opens the browser automatically when the server is ready
rem ============================================================
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo   FastBCP 開発サーバー起動ツール
echo   ==============================

rem --- 1. .env.local の確認 ---
if not exist ".env.local" (
  echo.
  echo   [エラー] .env.local が見つかりません。
  echo   .env.example をコピーして Supabase 接続情報を設定してください。
  echo.
  pause
  exit /b 1
)

rem --- 2. 依存パッケージの確認（初回のみ npm install）---
if not exist "node_modules" (
  echo.
  echo   [情報] 依存パッケージをインストールします（初回のみ・数分かかります）...
  call npm install
  if errorlevel 1 (
    echo.
    echo   [エラー] npm install に失敗しました。ネットワーク接続等を確認してください。
    echo.
    pause
    exit /b 1
  )
)

rem --- 3. 起動済みチェック（ポート 3000）---
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo.
  echo   [情報] 開発サーバーは既に起動中です。ブラウザで開きます。
  start "" "http://localhost:3000"
  timeout /t 3 /nobreak >nul
  exit /b 0
)

echo.
echo   起動中... 準備ができたらブラウザが自動で開きます。
echo   （サーバーを停止するにはこのウィンドウで Ctrl+C を押すか閉じてください）
echo.

rem --- 4. サーバー準備完了後にブラウザを自動で開く（裏で待機）---
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$deadline=(Get-Date).AddSeconds(60); do { Start-Sleep -Seconds 2; $l=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue } until ($l -or (Get-Date) -gt $deadline); if ($l) { Start-Process 'http://localhost:3000' }"

rem --- 5. 開発サーバーを起動（このウィンドウで動作）---
call npm run dev

echo.
echo   開発サーバーを終了しました。
pause
