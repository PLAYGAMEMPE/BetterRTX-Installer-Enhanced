@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Modo desarrollo (Tauri dev)
rem  Lanza frontend (Vite) + backend (Rust) con hot-reload.
rem  Gestor de dependencias: pnpm v11+ con Node 22 LTS (aislado).
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
if not errorlevel 1 set "CARGO_EXE=cargo"
if not defined CARGO_EXE if exist "%CARGO_BIN%\cargo.exe" set "PATH=%CARGO_BIN%;%PATH%" & set "CARGO_EXE=cargo"
if not defined CARGO_EXE (
  echo   [ERROR] Rust/Cargo no encontrado. Ejecuta primero: scripts\setup-env.bat
  >> "%LOG%" echo [ERROR] Cargo no encontrado.
  endlocal & exit /b 1
)

rem ---- Validar pnpm -------------------------------------------
set "PNPM_EXE="
where pnpm >nul 2>&1
if not errorlevel 1 set "PNPM_EXE=pnpm"
if not defined PNPM_EXE if exist "%APPDATA%\npm\pnpm.cmd" set "PNPM_EXE=%APPDATA%\npm\pnpm.cmd"
if not defined PNPM_EXE (
  echo   [ERROR] pnpm no encontrado. Ejecuta primero: scripts\setup-env.bat
  echo   [ERROR] O instala manualmente: npm install -g pnpm@11
  >> "%LOG%" echo [ERROR] pnpm no encontrado.
  endlocal & exit /b 1
)

rem ---- Verificar version de pnpm ------------------------------
for /f "tokens=*" %%V in ('"%PNPM_EXE%" --version 2^>nul') do set "PNPM_VER=%%V"
echo   [OK]    Rust y pnpm v!PNPM_VER! detectados.
>> "%LOG%" echo [INFO] pnpm version: !PNPM_VER!

rem ---- Sincronizar Rust (previene version mismatch) -----------
echo   [..]    Sincronizando dependencias de Rust...
pushd "%APP_DIR%\src-tauri"
cargo update >> "%LOG%" 2>&1
popd
echo   [OK]    Dependencias de Rust sincronizadas.

rem ---- Dependencias del frontend (pnpm install) ---------------
if not exist "%APP_DIR%\node_modules\.pnpm" (
  echo   [..]    Instalando dependencias del frontend con pnpm...
  pushd "%APP_DIR%"
  "%PNPM_EXE%" install >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo   [ERROR] Fallo 'pnpm install'. Revisa %LOG%
    popd & endlocal & exit /b 1
  )
  popd
)
echo   [OK]    Dependencias del frontend listas.

rem ---- Lanzar Tauri dev ---------------------------------------
echo   [..]    Iniciando Tauri dev con Node 22 LTS y pnpm...
echo   [..]    (cierra esta ventana para detener)
echo(
pushd "%APP_DIR%"
"%PNPM_EXE%" tauri dev
set "RC=%ERRORLEVEL%"
popd

>> "%LOG%" echo [%DATE% %TIME%] Tauri dev finalizo con codigo %RC%.
if not "%RC%"=="0" (
  echo(
  echo   [ERROR] Tauri dev finalizo con codigo %RC%. Revisa %LOG%
  endlocal & exit /b %RC%
)
endlocal & exit /b 0
