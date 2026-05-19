@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Setup del entorno de desarrollo
rem  Detecta e instala: Rust (+MSVC), Bun/Node, WebView2 Runtime.
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
  call :info "Instalando Rust (rustup)... necesario para compilar el backend Tauri."
  winget install --id Rustlang.Rustup -e --silent --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
  if exist "%CARGO_BIN%\rustc.exe" (
    call :ok "Rust instalado correctamente."
    set "RESTART_NEEDED=1"
  ) else (
    call :err "No se pudo instalar Rust. Instalalo manualmente desde https://rustup.rs"
  )
)

rem ---- Toolchain MSVC (linker de C++ requerido por Rust) ------
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "HAS_MSVC=0"
if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%P in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do set "HAS_MSVC=1"
)
if "!HAS_MSVC!"=="1" (
  call :ok "VS Build Tools (C++/MSVC) detectado."
) else (
  call :info "Instalando VS Build Tools con workload C++ (descarga grande, ~2-3 GB)..."
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent --accept-source-agreements --accept-package-agreements --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" >> "%LOG%" 2>&1
  if errorlevel 1 (
    call :err "No se pudo instalar VS Build Tools automaticamente."
    call :err "Instala manualmente 'Build Tools for Visual Studio 2022' con el workload 'Desktop development with C++'."
  ) else (
    call :ok "VS Build Tools instalado."
  )
)

rem ---- Bun (gestor preferido) ----------------------------------
set "BUN_BIN=%USERPROFILE%\.bun\bin"
where bun >nul 2>&1
if not errorlevel 1 (
  call :ok "Bun ya instalado y disponible en PATH."
) else if exist "%BUN_BIN%\bun.exe" (
  call :ok "Bun instalado en %BUN_BIN% (reabre la terminal para usarlo)."
  set "RESTART_NEEDED=1"
) else (
  call :info "Instalando Bun... necesario para construir el frontend React."
  winget install --id Oven-sh.Bun -e --silent --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
  if exist "%BUN_BIN%\bun.exe" (
    call :ok "Bun instalado correctamente."
    set "RESTART_NEEDED=1"
  ) else (
    call :info "No se pudo instalar Bun. Verificando si npm esta disponible como alternativa..."
    where npm >nul 2>&1
    if not errorlevel 1 (
      call :ok "npm detectado y sera usado como alternativa a Bun."
    ) else (
      call :err "Ni Bun ni npm encontrados. Instala Node.js LTS desde https://nodejs.org"
    )
  )
)

rem ---- WebView2 Runtime (render de la app empaquetada) --------
call :info "Verificando WebView2 Runtime..."
winget install --id Microsoft.EdgeWebView2Runtime -e --silent --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
call :ok "WebView2 Runtime verificado (preinstalado en Windows 11)."

rem ---- Dependencias del frontend (bun install / npm install) --
set "BUN_EXE="
where bun >nul 2>&1
if not errorlevel 1 set "BUN_EXE=bun"
if not defined BUN_EXE if exist "%BUN_BIN%\bun.exe" set "BUN_EXE=%BUN_BIN%\bun.exe"

set "NPM_EXE="
if not defined BUN_EXE (
  where npm >nul 2>&1
  if not errorlevel 1 set "NPM_EXE=npm"
)

if defined BUN_EXE (
  if exist "%APP_DIR%\package.json" (
    call :info "Instalando dependencias del frontend con Bun..."
    pushd "%APP_DIR%"
    "%BUN_EXE%" install >> "%LOG%" 2>&1
    if errorlevel 1 (
      call :err "Fallo 'bun install'. Revisa el log."
    ) else (
      call :ok "Dependencias del frontend instaladas con Bun."
    )
    popd
  ) else (
    call :err "No se encontro %APP_DIR%\package.json"
  )
) else if defined NPM_EXE (
  if exist "%APP_DIR%\package.json" (
    call :info "Instalando dependencias del frontend con npm..."
    pushd "%APP_DIR%"
    "%NPM_EXE%" install >> "%LOG%" 2>&1
    if errorlevel 1 (
      call :err "Fallo 'npm install'. Revisa el log."
    ) else (
      call :ok "Dependencias del frontend instaladas con npm."
    )
    popd
  ) else (
    call :err "No se encontro %APP_DIR%\package.json"
  )
) else (
  call :info "Ningún gestor de paquetes disponible en esta sesion; las dependencias se instalaran al reabrir."
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
