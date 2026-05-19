@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Build de release de produccion
rem  Genera: .exe portable + instaladores NSIS/MSI + ZIP portable.
rem  Gestor de dependencias: pnpm v11+ con Node 22 LTS.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
title BetterRTX Easy Installer - Build release

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "APP_DIR=%ROOT_DIR%\v3"
set "LOG_DIR=%ROOT_DIR%\logs"
set "DIST_DIR=%ROOT_DIR%\dist\release"
set "TARGET_DIR=%APP_DIR%\src-tauri\target\release"
set "BUNDLE_DIR=%TARGET_DIR%\bundle"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
set "LOG=%LOG_DIR%\build-release.log"

> "%LOG%" echo [%DATE% %TIME%] === Build release iniciado ===

echo(
echo ==================================================
echo   BetterRTX Easy Installer  -  Build de release
echo ==================================================
echo(

rem ---- Validar Rust/Cargo -------------------------------------
set "CARGO_BIN=%USERPROFILE%\.cargo\bin"
if exist "%CARGO_BIN%\cargo.exe" set "PATH=%CARGO_BIN%;%PATH%"
where cargo >nul 2>&1
if errorlevel 1 (
  echo   [ERROR] Rust/Cargo no encontrado. Ejecuta primero: scripts\setup-env.bat
  endlocal & exit /b 1
)

rem ---- Validar pnpm -------------------------------------------
set "PNPM_EXE="
where pnpm >nul 2>&1
if not errorlevel 1 set "PNPM_EXE=pnpm"
if not defined PNPM_EXE if exist "%APPDATA%\npm\pnpm.cmd" set "PNPM_EXE=%APPDATA%\npm\pnpm.cmd"
if not defined PNPM_EXE (
  echo   [ERROR] pnpm no encontrado. Ejecuta primero: scripts\setup-env.bat
  endlocal & exit /b 1
)
for /f "tokens=*" %%V in ('"%PNPM_EXE%" --version 2^>nul') do set "PNPM_VER=%%V"
echo   [OK]    Rust y pnpm v!PNPM_VER! detectados.

rem ---- Dependencias -------------------------------------------
if not exist "%APP_DIR%\node_modules\.pnpm" (
  echo   [..]    Instalando dependencias del frontend...
  pushd "%APP_DIR%"
  "%PNPM_EXE%" install >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo   [ERROR] Fallo 'pnpm install'. Revisa %LOG%
    popd & endlocal & exit /b 1
  )
  popd
)

rem ---- Compilar release ---------------------------------------
echo   [..]    Compilando release de produccion (puede tardar varios minutos)...
pushd "%APP_DIR%"
"%PNPM_EXE%" tauri build >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
popd
if not "%RC%"=="0" (
  echo   [ERROR] La compilacion fallo con codigo %RC%. Revisa %LOG%
  endlocal & exit /b %RC%
)
echo   [OK]    Compilacion completada.

rem ---- Recolectar artefactos ----------------------------------
if exist "%DIST_DIR%" rmdir /S /Q "%DIST_DIR%" >nul 2>&1
mkdir "%DIST_DIR%" >nul 2>&1

set "FOUND_EXE="
for %%F in ("%TARGET_DIR%\*.exe") do (
  copy /Y "%%F" "%DIST_DIR%\" >nul
  set "FOUND_EXE=%%~nxF"
  set "EXE_PATH=%DIST_DIR%\%%~nxF"
)
if not defined FOUND_EXE (
  echo   [ERROR] No se encontro el .exe portable en %TARGET_DIR%
  endlocal & exit /b 1
)
echo   [OK]    Ejecutable portable: %FOUND_EXE%

if exist "%BUNDLE_DIR%\nsis" (
  for %%F in ("%BUNDLE_DIR%\nsis\*.exe") do copy /Y "%%F" "%DIST_DIR%\" >nul
  echo   [OK]    Instalador NSIS copiado.
)
if exist "%BUNDLE_DIR%\msi" (
  for %%F in ("%BUNDLE_DIR%\msi\*.msi") do copy /Y "%%F" "%DIST_DIR%\" >nul
  echo   [OK]    Instalador MSI copiado.
)

rem ---- ZIP portable -------------------------------------------
echo   [..]    Generando ZIP portable...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '%EXE_PATH%' -DestinationPath '%DIST_DIR%\BetterRTX-EasyInstaller-portable.zip' -Force" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   [WARN]  No se pudo generar el ZIP portable. Revisa %LOG%
) else (
  echo   [OK]    ZIP portable generado.
)

>> "%LOG%" echo [%DATE% %TIME%] Build release OK.
echo(
echo ==================================================
echo   BUILD DE RELEASE COMPLETADO
echo   Artefactos listos en: %DIST_DIR%
echo ==================================================
endlocal & exit /b 0
