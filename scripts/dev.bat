@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Modo desarrollo (Tauri dev)
rem  Lanza frontend (Vite) + backend (Rust) con hot-reload.
rem  Usa Bun si esta disponible; de lo contrario, npm.
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

rem ---- Detectar gestor de paquetes (Bun > npm) ---------------
set "BUN_BIN=%USERPROFILE%\.bun\bin"
set "BUN_EXE="
where bun >nul 2>&1
if not errorlevel 1 set "BUN_EXE=bun"
if not defined BUN_EXE if exist "%BUN_BIN%\bun.exe" set "BUN_EXE=%BUN_BIN%\bun.exe"

set "NPM_EXE="
if not defined BUN_EXE (
  where npm >nul 2>&1
  if not errorlevel 1 set "NPM_EXE=npm"
)

if not defined BUN_EXE if not defined NPM_EXE (
  echo   [ERROR] Ni Bun ni npm fueron encontrados.
  echo   [ERROR] Instala Node.js LTS desde https://nodejs.org o Bun desde https://bun.sh
  >> "%LOG%" echo [ERROR] Ni bun ni npm encontrados.
  endlocal & exit /b 1
)

if defined BUN_EXE (
  echo   [OK]    Rust y Bun detectados.
) else (
  echo   [OK]    Rust y npm detectados ^(Bun no disponible; usando npm como alternativa^).
)

rem ---- Sincronizar dependencias Rust (previene version mismatch)
echo   [..]    Actualizando dependencias de Rust...
pushd "%APP_DIR%\src-tauri"
cargo update >> "%LOG%" 2>&1
popd
echo   [OK]    Dependencias de Rust actualizadas.

rem ---- Dependencias del frontend ------------------------------
if not exist "%APP_DIR%\node_modules" (
  echo   [..]    node_modules ausente; instalando dependencias del frontend...
  pushd "%APP_DIR%"
  if defined BUN_EXE (
    "%BUN_EXE%" install >> "%LOG%" 2>&1
  ) else (
    "%NPM_EXE%" install >> "%LOG%" 2>&1
  )
  if errorlevel 1 (
    echo   [ERROR] Fallo la instalacion de dependencias. Revisa %LOG%
    popd & endlocal & exit /b 1
  )
  popd
)
echo   [OK]    Dependencias del frontend listas.

rem ---- Lanzar Tauri dev ---------------------------------------
echo   [..]    Iniciando Tauri dev (cierra esta ventana para detener)...
echo(
pushd "%APP_DIR%"
if defined BUN_EXE (
  "%BUN_EXE%" run tauri dev
) else (
  "%NPM_EXE%" run tauri dev
)
set "RC=%ERRORLEVEL%"
popd

>> "%LOG%" echo [%DATE% %TIME%] Tauri dev finalizo con codigo %RC%.
if not "%RC%"=="0" (
  echo(
  echo   [ERROR] Tauri dev finalizo con codigo %RC%. Revisa %LOG%
  endlocal & exit /b %RC%
)
endlocal & exit /b 0
