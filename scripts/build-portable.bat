@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Build portable (.exe)
rem  Compila en modo release y copia el ejecutable portable a
rem  dist\portable\. No genera instaladores (NSIS/MSI).
rem  Requisito previo: scripts\setup-env.bat ejecutado una vez.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
title BetterRTX Easy Installer - Build portable

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "APP_DIR=%ROOT_DIR%\v3"
set "LOG_DIR=%ROOT_DIR%\logs"
set "DIST_DIR=%ROOT_DIR%\dist\portable"
set "TARGET_DIR=%APP_DIR%\src-tauri\target\release"
set "APP_EXE=brtx-installer.exe"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
set "LOG=%LOG_DIR%\build-portable.log"

> "%LOG%" echo [%DATE% %TIME%] === Build portable iniciado ===

echo(
echo ==================================================
echo   BetterRTX Easy Installer  -  Build portable
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
  endlocal & exit /b 1
)

for /f "tokens=*" %%V in ('"%PNPM_EXE%" --version 2^>nul') do set "PNPM_VER=%%V"
echo   [OK]    Rust y pnpm v!PNPM_VER! detectados.

rem ---- Sincronizar dependencias del frontend ------------------
echo   [..]    Sincronizando dependencias del frontend...
call "%PNPM_EXE%" --dir "%APP_DIR%" install --frozen-lockfile >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   [ERROR] Fallo 'pnpm install'. Revisa %LOG%
  endlocal & exit /b 1
)
echo   [OK]    Dependencias listas.

rem ---- Pre-descarga de crates de Rust -------------------------
echo   [..]    Verificando crates de Rust (cargo fetch)...
pushd "%APP_DIR%\src-tauri"
cargo fetch >> "%LOG%" 2>&1
popd

rem ---- Compilar release ---------------------------------------
echo   [..]    Compilando en modo release (puede tardar varios minutos)...
call "%PNPM_EXE%" --dir "%APP_DIR%" tauri build >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo   [ERROR] La compilacion fallo con codigo %RC%. Revisa %LOG%
  endlocal & exit /b %RC%
)
echo   [OK]    Compilacion completada.

rem ---- Copiar el ejecutable portable --------------------------
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%" >nul 2>&1
if not exist "%TARGET_DIR%\%APP_EXE%" (
  echo   [ERROR] No se encontro el ejecutable: %TARGET_DIR%\%APP_EXE%
  >> "%LOG%" echo [ERROR] Ejecutable no encontrado: %TARGET_DIR%\%APP_EXE%
  endlocal & exit /b 1
)
copy /Y "%TARGET_DIR%\%APP_EXE%" "%DIST_DIR%\" >nul

rem ---- Mostrar resultado --------------------------------------
for %%F in ("%DIST_DIR%\%APP_EXE%") do set "EXE_SIZE=%%~zF"
set /a EXE_MB=!EXE_SIZE! / 1048576

>> "%LOG%" echo [%DATE% %TIME%] Build portable OK: %APP_EXE% (!EXE_MB! MB)
echo(
echo ==================================================
echo   BUILD PORTABLE COMPLETADO
echo   Ejecutable : %DIST_DIR%\%APP_EXE%
echo   Tamano     : !EXE_MB! MB
echo ==================================================
endlocal & exit /b 0
