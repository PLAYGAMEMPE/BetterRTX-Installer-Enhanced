@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Setup del entorno de desarrollo
rem  Instala: Rust (+MSVC), pnpm v11+, Node 22 LTS, WebView2.
rem  Compatible con Windows 10 (1809+) y Windows 11.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
title BetterRTX Easy Installer - Setup de entorno

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "APP_DIR=%ROOT_DIR%\v3"
set "LOG_DIR=%ROOT_DIR%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
set "LOG=%LOG_DIR%\setup-env.log"
set "ERRORS=0"
set "RESTART_NEEDED=0"

> "%LOG%" echo [%DATE% %TIME%] === Setup de entorno iniciado ===

echo(
echo ==================================================
echo   BetterRTX Easy Installer  -  Setup de entorno
echo ==================================================
echo   Raiz del proyecto : %ROOT_DIR%
echo   Log detallado     : %LOG%
echo(

rem ---- Requisito: winget --------------------------------------
where winget >nul 2>&1
if errorlevel 1 (
  call :err "winget no esta disponible en este sistema."
  call :err "Instala 'App Installer' desde Microsoft Store y vuelve a ejecutar este script."
  goto :summary
)
call :ok "winget detectado."

rem ---- Rust + Cargo -------------------------------------------
set "CARGO_BIN=%USERPROFILE%\.cargo\bin"
where rustc >nul 2>&1
if not errorlevel 1 (
  call :ok "Rust ya instalado y disponible en PATH."
) else if exist "%CARGO_BIN%\rustc.exe" (
  call :ok "Rust instalado en %CARGO_BIN% (reabre la terminal para usarlo)."
  set "RESTART_NEEDED=1"
) else (
  call :info "Instalando Rust (rustup)..."
  winget install --id Rustlang.Rustup -e --silent --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
  if exist "%CARGO_BIN%\rustc.exe" (
    call :ok "Rust instalado correctamente."
    set "RESTART_NEEDED=1"
  ) else (
    call :err "No se pudo instalar Rust. Instalalo manualmente desde https://rustup.rs"
  )
)

rem ---- Toolchain MSVC -----------------------------------------
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "HAS_MSVC=0"
if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%P in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do set "HAS_MSVC=1"
)
if "!HAS_MSVC!"=="1" (
  call :ok "VS Build Tools (C++/MSVC) detectado."
) else (
  call :info "Instalando VS Build Tools con workload C++ (~2-3 GB)..."
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent --accept-source-agreements --accept-package-agreements --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" >> "%LOG%" 2>&1
  if errorlevel 1 (
    call :err "No se pudo instalar VS Build Tools automaticamente."
    call :err "Instala manualmente 'Build Tools for Visual Studio 2022' con el workload 'Desktop development with C++'."
  ) else (
    call :ok "VS Build Tools instalado."
  )
)

rem ---- Node.js (requerido para pnpm) --------------------------
set "NODE_EXE="
where node >nul 2>&1
if not errorlevel 1 set "NODE_EXE=node"
if not defined NODE_EXE (
  call :info "Instalando Node.js LTS (necesario para pnpm)..."
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
  where node >nul 2>&1
  if not errorlevel 1 (
    call :ok "Node.js instalado correctamente."
    set "RESTART_NEEDED=1"
  ) else (
    call :err "No se pudo instalar Node.js. Instalalo desde https://nodejs.org"
  )
) else (
  for /f "tokens=*" %%V in ('node --version 2^>nul') do call :ok "Node.js %%V detectado."
)

rem ---- pnpm v11+ (gestor de dependencias del proyecto) --------
set "PNPM_EXE="
where pnpm >nul 2>&1
if not errorlevel 1 set "PNPM_EXE=pnpm"
if not defined PNPM_EXE if exist "%APPDATA%\npm\pnpm.cmd" set "PNPM_EXE=%APPDATA%\npm\pnpm.cmd"
if not defined PNPM_EXE (
  call :info "Instalando pnpm v11+ via npm..."
  npm install -g pnpm@11 >> "%LOG%" 2>&1
  where pnpm >nul 2>&1
  if not errorlevel 1 (
    set "PNPM_EXE=pnpm"
    call :ok "pnpm instalado correctamente."
    set "RESTART_NEEDED=1"
  ) else (
    call :err "No se pudo instalar pnpm. Ejecuta manualmente: npm install -g pnpm@11"
  )
) else (
  for /f "tokens=*" %%V in ('"%PNPM_EXE%" --version 2^>nul') do call :ok "pnpm v%%V detectado."
)

rem ---- Node 22 LTS local (aislado via pnpm env) ---------------
if defined PNPM_EXE (
  call :info "Descargando Node 22 LTS aislado para este proyecto (no afecta al Node global)..."
  "%PNPM_EXE%" env use 22 --global >> "%LOG%" 2>&1
  if not errorlevel 1 (
    call :ok "Node 22 LTS configurado via pnpm env (aislado del sistema)."
    call :info "Nota: el .npmrc del proyecto apunta a Node 22.22.3 para reproducibilidad."
  ) else (
    call :info "pnpm env: descarga de Node 22 no disponible en esta sesion. El .nvmrc/.node-version lo gestionara."
  )
)

rem ---- WebView2 Runtime ---------------------------------------
call :info "Verificando WebView2 Runtime..."
winget install --id Microsoft.EdgeWebView2Runtime -e --silent --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
call :ok "WebView2 Runtime verificado."

rem ---- Dependencias del frontend (pnpm install) ---------------
if defined PNPM_EXE (
  if exist "%APP_DIR%\package.json" (
    call :info "Instalando dependencias del frontend con pnpm..."
    pushd "%APP_DIR%"
    "%PNPM_EXE%" install >> "%LOG%" 2>&1
    if errorlevel 1 (
      call :err "Fallo 'pnpm install'. Revisa el log."
    ) else (
      call :ok "Dependencias instaladas con pnpm (lockfile verificado)."
    )
    popd
  ) else (
    call :err "No se encontro %APP_DIR%\package.json"
  )
) else (
  call :info "pnpm no disponible en esta sesion; ejecuta 'pnpm install' en v3/ al reabrir."
)

:summary
echo(
echo ==================================================
>> "%LOG%" echo [%DATE% %TIME%] Setup finalizado con !ERRORS! error(es).
if !ERRORS! gtr 0 (
  echo   SETUP INCOMPLETO  -  !ERRORS! error^(es^).
  echo   Revisa el detalle en: %LOG%
  echo ==================================================
  endlocal & exit /b 1
)
if "%RESTART_NEEDED%"=="1" (
  echo   SETUP CASI LISTO.
  echo   Se instalaron herramientas nuevas en el PATH.
  echo   1^) Cierra esta terminal.
  echo   2^) Abre una nueva.
  echo   3^) Ejecuta de nuevo: scripts\setup-env.bat
  echo ==================================================
  endlocal & exit /b 0
)
echo   ENTORNO LISTO. Ya puedes ejecutar: scripts\dev.bat
echo ==================================================
endlocal & exit /b 0

rem ---------------- subrutinas de log --------------------------
:ok
echo   [OK]    %~1
>> "%LOG%" echo [%TIME%] [OK]    %~1
exit /b 0
:info
echo   [..]    %~1
>> "%LOG%" echo [%TIME%] [INFO]  %~1
exit /b 0
:err
echo   [ERROR] %~1
>> "%LOG%" echo [%TIME%] [ERROR] %~1
set /a ERRORS+=1
exit /b 0
