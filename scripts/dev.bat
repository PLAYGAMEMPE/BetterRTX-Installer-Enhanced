@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Modo desarrollo (Tauri dev)
rem  Lanza frontend (Vite) + backend (Rust) con hot-reload.
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

rem ---- Validar entorno ----------------------------------------
set "CARGO_BIN=%USERPROFILE%\.cargo\bin"
set "BUN_BIN=%USERPROFILE%\.bun\bin"

set "CARGO_EXE="
where cargo >nul 2>&1
if not errorlevel 1 set "CARGO_EXE=cargo"
if not defined CARGO_EXE if exist "%CARGO_BIN%\cargo.exe" set "PATH=%CARGO_BIN%;%PATH%" & set "CARGO_EXE=cargo"
if not defined CARGO_EXE (
  echo   [ERROR] Rust/Cargo no encontrado. Ejecuta primero: scripts\setup-env.bat
  >> "%LOG%" echo [ERROR] Cargo no encontrado.
  endlocal & exit /b 1
)

set "BUN_EXE="
where bun >nul 2>&1
if not errorlevel 1 set "BUN_EXE=bun"
if not defined BUN_EXE if exist "%BUN_BIN%\bun.exe" set "BUN_EXE=%BUN_BIN%\bun.exe"
if not defined BUN_EXE (
  echo   [ERROR] Bun no encontrado. Ejecuta primero: scripts\setup-env.bat
  >> "%LOG%" echo [ERROR] Bun no encontrado.
  endlocal & exit /b 1
)
echo   [OK]    Rust y Bun detectados.

rem ---- Dependencias del frontend ------------------------------
if not exist "%APP_DIR%\node_modules" (
  echo   [..]    node_modules ausente; ejecutando 'bun install'...
  pushd "%APP_DIR%"
  "%BUN_EXE%" install >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo   [ERROR] Fallo 'bun install'. Revisa %LOG%
    popd & endlocal & exit /b 1
  )
  popd
)
echo   [OK]    Dependencias del frontend listas.

rem ---- Lanzar Tauri dev ---------------------------------------
echo   [..]    Iniciando Tauri dev (cierra esta ventana para detener)...
echo(
pushd "%APP_DIR%"
"%BUN_EXE%" run tauri dev
set "RC=%ERRORLEVEL%"
popd

>> "%LOG%" echo [%DATE% %TIME%] Tauri dev finalizo con codigo %RC%.
if not "%RC%"=="0" (
  echo(
  echo   [ERROR] Tauri dev finalizo con codigo %RC%. Revisa %LOG%
  endlocal & exit /b %RC%
)
endlocal & exit /b 0
