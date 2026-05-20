@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Build de release de produccion
rem  Genera: .exe portable + instaladores NSIS/MSI + ZIP.
rem  Artefactos en dist\release\.
rem  Requisito previo: scripts\setup-env.bat ejecutado una vez.
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
set "APP_EXE=brtx-installer.exe"
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

rem ---- Limpiar dist anterior ----------------------------------
if exist "%DIST_DIR%" rmdir /S /Q "%DIST_DIR%" >nul 2>&1
mkdir "%DIST_DIR%" >nul 2>&1

rem ---- Compilar release ---------------------------------------
echo   [..]    Compilando release de produccion (puede tardar varios minutos)...
call "%PNPM_EXE%" --dir "%APP_DIR%" tauri build >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo   [ERROR] La compilacion fallo con codigo %RC%. Revisa %LOG%
  endlocal & exit /b %RC%
)
echo   [OK]    Compilacion completada.

rem ---- Recolectar artefactos ----------------------------------
set "ARTIFACTS=0"

rem Ejecutable portable
if exist "%TARGET_DIR%\%APP_EXE%" (
  copy /Y "%TARGET_DIR%\%APP_EXE%" "%DIST_DIR%\" >nul
  for %%F in ("%DIST_DIR%\%APP_EXE%") do (
    set /a "SZ=%%~zF / 1048576"
    echo   [OK]    Ejecutable portable: %APP_EXE% (!SZ! MB)
  )
  set /a ARTIFACTS+=1
) else (
  echo   [WARN]  No se encontro el ejecutable portable: %TARGET_DIR%\%APP_EXE%
)

rem Instalador NSIS
if exist "%BUNDLE_DIR%\nsis" (
  for %%F in ("%BUNDLE_DIR%\nsis\*.exe") do (
    copy /Y "%%F" "%DIST_DIR%\" >nul
    for %%G in ("%DIST_DIR%\%%~nxF") do (
      set /a "SZ=%%~zG / 1048576"
      echo   [OK]    Instalador NSIS: %%~nxF (!SZ! MB)
    )
    set /a ARTIFACTS+=1
  )
)

rem Instalador MSI
if exist "%BUNDLE_DIR%\msi" (
  for %%F in ("%BUNDLE_DIR%\msi\*.msi") do (
    copy /Y "%%F" "%DIST_DIR%\" >nul
    for %%G in ("%DIST_DIR%\%%~nxF") do (
      set /a "SZ=%%~zG / 1048576"
      echo   [OK]    Instalador MSI: %%~nxF (!SZ! MB)
    )
    set /a ARTIFACTS+=1
  )
)

if "!ARTIFACTS!"=="0" (
  echo   [ERROR] No se genero ningun artefacto. Revisa %LOG%
  endlocal & exit /b 1
)

rem ---- ZIP portable -------------------------------------------
if exist "%DIST_DIR%\%APP_EXE%" (
  echo   [..]    Generando ZIP portable...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Compress-Archive -Path '%DIST_DIR%\%APP_EXE%' -DestinationPath '%DIST_DIR%\BetterRTX-EasyInstaller-portable.zip' -Force" >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo   [WARN]  No se pudo generar el ZIP. Revisa %LOG%
  ) else (
    echo   [OK]    ZIP portable generado.
  )
)

rem ---- Resumen ------------------------------------------------
>> "%LOG%" echo [%DATE% %TIME%] Build release OK. Artefactos: !ARTIFACTS!
echo(
echo ==================================================
echo   BUILD DE RELEASE COMPLETADO
echo   !ARTIFACTS! artefacto(s) en: %DIST_DIR%
echo ==================================================
endlocal & exit /b 0
