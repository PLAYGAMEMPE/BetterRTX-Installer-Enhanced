@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Build portable (.exe)
rem  Compila frontend + backend y genera el ejecutable portable.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
title BetterRTX Easy Installer - Build portable

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "APP_DIR=%ROOT_DIR%\v3"
set "LOG_DIR=%ROOT_DIR%\logs"
set "DIST_DIR=%ROOT_DIR%\dist\portable"
set "TARGET_DIR=%APP_DIR%\src-tauri\target\release"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
set "LOG=%LOG_DIR%\build-portable.log"

> "%LOG%" echo [%DATE% %TIME%] === Build portable iniciado ===

echo(
echo ==================================================
echo   BetterRTX Easy Installer  -  Build portable
echo ==================================================
echo(

rem ---- Validar entorno ----------------------------------------
set "CARGO_BIN=%USERPROFILE%\.cargo\bin"
set "BUN_BIN=%USERPROFILE%\.bun\bin"
if exist "%CARGO_BIN%\cargo.exe" set "PATH=%CARGO_BIN%;%PATH%"

where cargo >nul 2>&1
if errorlevel 1 (
  echo   [ERROR] Rust/Cargo no encontrado. Ejecuta primero: scripts\setup-env.bat
  endlocal & exit /b 1
)
set "BUN_EXE="
where bun >nul 2>&1
if not errorlevel 1 set "BUN_EXE=bun"
if not defined BUN_EXE if exist "%BUN_BIN%\bun.exe" set "BUN_EXE=%BUN_BIN%\bun.exe"
if not defined BUN_EXE (
  echo   [ERROR] Bun no encontrado. Ejecuta primero: scripts\setup-env.bat
  endlocal & exit /b 1
)
echo   [OK]    Rust y Bun detectados.

rem ---- Dependencias -------------------------------------------
if not exist "%APP_DIR%\node_modules" (
  echo   [..]    Instalando dependencias del frontend...
  pushd "%APP_DIR%"
  "%BUN_EXE%" install >> "%LOG%" 2>&1
  if errorlevel 1 ( echo   [ERROR] Fallo 'bun install'. Revisa %LOG% & popd & endlocal & exit /b 1 )
  popd
)

rem ---- Compilar -----------------------------------------------
echo   [..]    Compilando aplicacion en modo release (esto puede tardar)...
pushd "%APP_DIR%"
"%BUN_EXE%" run tauri build >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
popd
if not "%RC%"=="0" (
  echo   [ERROR] La compilacion fallo con codigo %RC%. Revisa %LOG%
  endlocal & exit /b %RC%
)
echo   [OK]    Compilacion completada.

rem ---- Recolectar el ejecutable portable ----------------------
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%" >nul 2>&1
set "FOUND_EXE="
for %%F in ("%TARGET_DIR%\*.exe") do (
  copy /Y "%%F" "%DIST_DIR%\" >nul
  set "FOUND_EXE=%%~nxF"
)
if not defined FOUND_EXE (
  echo   [ERROR] No se encontro el .exe en %TARGET_DIR%
  >> "%LOG%" echo [ERROR] .exe no encontrado en %TARGET_DIR%
  endlocal & exit /b 1
)

>> "%LOG%" echo [%DATE% %TIME%] Build portable OK: %FOUND_EXE%
echo(
echo ==================================================
echo   BUILD PORTABLE COMPLETADO
echo   Ejecutable: %DIST_DIR%\%FOUND_EXE%
echo ==================================================
endlocal & exit /b 0
