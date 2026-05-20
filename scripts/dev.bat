@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Modo desarrollo (Tauri dev)
rem  Lanza frontend (Vite) + backend (Rust) con hot-reload.
rem  Requisito previo: scripts\setup-env.bat ejecutado una vez.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
title BetterRTX Easy Installer - Dev

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "APP_DIR=%ROOT_DIR%\v3"
set "LOG_DIR=%ROOT_DIR%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
set "LOG=%LOG_DIR%\dev.log"

> "%LOG%" echo [%DATE% %TIME%] === Dev iniciado ===

echo(
echo ==================================================
echo   BetterRTX Easy Installer  -  Modo desarrollo
echo ==================================================
echo(

rem ---- Validar Rust/Cargo -------------------------------------
set "CARGO_BIN=%USERPROFILE%\.cargo\bin"
set "CARGO_EXE="
where cargo >nul 2>&1
if not errorlevel 1 (
  set "CARGO_EXE=cargo"
) else if exist "%CARGO_BIN%\cargo.exe" (
  set "PATH=%CARGO_BIN%;!PATH!"
  set "CARGO_EXE=cargo"
)
if not defined CARGO_EXE (
  echo   [ERROR] Rust/Cargo no encontrado.
  echo   Ejecuta primero:  scripts\setup-env.bat
  >> "%LOG%" echo [ERROR] Cargo no encontrado.
  endlocal & exit /b 1
)

rem ---- Validar pnpm -------------------------------------------
set "PNPM_EXE="
where pnpm >nul 2>&1
if not errorlevel 1 (
  set "PNPM_EXE=pnpm"
) else (
  for %%P in (
    "%APPDATA%\npm\pnpm.cmd"
    "%LOCALAPPDATA%\pnpm\pnpm.cmd"
  ) do (
    if exist "%%~P" set "PNPM_EXE=%%~P"
  )
)
if not defined PNPM_EXE (
  echo   [ERROR] pnpm no encontrado.
  echo   Ejecuta primero:  scripts\setup-env.bat
  >> "%LOG%" echo [ERROR] pnpm no encontrado.
  endlocal & exit /b 1
)

for /f "tokens=*" %%V in ('"%PNPM_EXE%" --version 2^>nul') do set "PNPM_VER=%%V"
echo   [OK]    Rust y pnpm v!PNPM_VER! detectados.
>> "%LOG%" echo [INFO] pnpm version: !PNPM_VER!

rem ---- Sincronizar dependencias del frontend ------------------
rem  pnpm install es instantaneo si nada cambio; necesario si
rem  pnpm-lock.yaml se actualizo (ej. tras git pull).
rem  Se usa --dir porque pushd no es respetado por el shim de pnpm.
  Se usa call porque pnpm es un .cmd y sin call el bat no retorna.
echo   [..]    Sincronizando dependencias del frontend...
call "%PNPM_EXE%" --dir "%APP_DIR%" install >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   [ERROR] Fallo 'pnpm install'. Revisa %LOG%
  endlocal & exit /b 1
)
echo   [OK]    Dependencias del frontend listas.

rem ---- Limpiar procesos previos del dev server ----------------
echo   [..]    Limpiando procesos anteriores si existieran...
taskkill /F /IM brtx-installer.exe >nul 2>&1
powershell -NoProfile -Command "try { $p=Get-NetTCPConnection -LocalPort 1420 -EA Stop | Select -Expand OwningProcess -Unique; $p | %%{ Stop-Process -Id $_ -Force -EA SilentlyContinue } } catch {}" >nul 2>&1
timeout /t 1 /nobreak >nul

rem ---- Lanzar Tauri dev ---------------------------------------
echo   [..]    Iniciando Tauri dev (Vite + Rust hot-reload)...
echo   [..]    Cierra esta ventana para detener el servidor.
echo(
call "%PNPM_EXE%" --dir "%APP_DIR%" tauri dev
set "RC=%ERRORLEVEL%"

>> "%LOG%" echo [%DATE% %TIME%] Tauri dev finalizo con codigo %RC%.
if not "%RC%"=="0" (
  echo(
  echo   [ERROR] Tauri dev finalizo con codigo %RC%. Revisa %LOG%
  endlocal & exit /b %RC%
)
endlocal & exit /b 0
