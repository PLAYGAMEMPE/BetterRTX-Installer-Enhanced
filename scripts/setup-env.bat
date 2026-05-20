@echo off
rem ============================================================
rem  BetterRTX Easy Installer - Setup del entorno de desarrollo
rem  Instala: Node.js LTS, pnpm v11, Rust (MSVC), VS Build
rem  Tools, WebView2. Compatible con Windows 10 (1809+) / 11.
rem
rem  EJECUCION: Como usuario normal. UAC se solicita si es
rem  necesario al instalar paquetes via winget.
rem
rem  Si se instalan herramientas nuevas, el script indicara
rem  que debes abrir una terminal nueva y volver a ejecutarlo.
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

rem ================================================================
rem  1. winget (gestor de paquetes de Windows)
rem ================================================================
where winget >nul 2>&1
if errorlevel 1 (
  call :err "winget no esta disponible en este sistema."
  echo(
  echo   Para instalarlo abre Microsoft Store y busca "App Installer"
  echo   o descargalo desde: https://aka.ms/getwinget
  echo   Luego cierra y vuelve a ejecutar este script.
  goto :summary
)
call :ok "winget detectado."

rem ================================================================
rem  2. Node.js LTS  (necesario para instalar pnpm via npm)
rem ================================================================
set "NODE_EXE="
set "NPM_EXE="

rem -- Buscar node en PATH actual
where node >nul 2>&1
if not errorlevel 1 (
  set "NODE_EXE=node"
  set "NPM_EXE=npm"
)

rem -- Buscar en rutas conocidas (winget instala en ProgramFiles sin tocar la sesion actual)
if not defined NODE_EXE (
  for %%P in (
    "%ProgramFiles%\nodejs"
    "%ProgramFiles(x86)%\nodejs"
    "%LOCALAPPDATA%\Programs\nodejs"
  ) do (
    if exist "%%~P\node.exe" (
      set "PATH=%%~P;!PATH!"
      set "NODE_EXE=node"
      set "NPM_EXE=npm"
    )
  )
)

if defined NODE_EXE (
  for /f "tokens=*" %%V in ('node --version 2^>nul') do call :ok "Node.js %%V detectado."
) else (
  call :info "Instalando Node.js LTS via winget..."
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
  rem Intentar agregar al PATH de la sesion actual tras la instalacion
  for %%P in (
    "%ProgramFiles%\nodejs"
    "%ProgramFiles(x86)%\nodejs"
    "%LOCALAPPDATA%\Programs\nodejs"
  ) do (
    if exist "%%~P\node.exe" (
      set "PATH=%%~P;!PATH!"
      set "NODE_EXE=node"
      set "NPM_EXE=npm"
    )
  )
  if defined NODE_EXE (
    for /f "tokens=*" %%V in ('node --version 2^>nul') do call :ok "Node.js %%V instalado."
  ) else (
    call :err "No se pudo instalar Node.js. Instala manualmente: https://nodejs.org"
    set "RESTART_NEEDED=1"
  )
)

rem ================================================================
rem  3. pnpm v11  (gestor de dependencias del proyecto)
rem ================================================================
set "PNPM_EXE="

where pnpm >nul 2>&1
if not errorlevel 1 (
  set "PNPM_EXE=pnpm"
) else (
  rem Buscar en rutas conocidas de instalacion global
  for %%P in (
    "%APPDATA%\npm\pnpm.cmd"
    "%LOCALAPPDATA%\pnpm\pnpm.cmd"
  ) do (
    if exist "%%~P" set "PNPM_EXE=%%~P"
  )
)

if defined PNPM_EXE (
  for /f "tokens=*" %%V in ('"%PNPM_EXE%" --version 2^>nul') do call :ok "pnpm v%%V detectado."
) else if defined NPM_EXE (
  call :info "Instalando pnpm v11 via npm..."
  call npm install -g pnpm@11 >> "%LOG%" 2>&1
  if errorlevel 1 (
    call :err "Fallo 'npm install -g pnpm@11'. Revisa %LOG%"
    set "RESTART_NEEDED=1"
  ) else (
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
    if defined PNPM_EXE (
      for /f "tokens=*" %%V in ('"%PNPM_EXE%" --version 2^>nul') do call :ok "pnpm v%%V instalado."
    ) else (
      call :err "pnpm instalado pero no encontrado en PATH. Reabre la terminal y vuelve a ejecutar."
      set "RESTART_NEEDED=1"
    )
  )
) else (
  call :err "pnpm no instalable: Node.js no esta disponible en esta sesion."
  call :info "Reabre la terminal tras la instalacion de Node.js y vuelve a ejecutar este script."
  set "RESTART_NEEDED=1"
)

rem ================================================================
rem  4. Rust + Cargo
rem ================================================================
set "CARGO_BIN=%USERPROFILE%\.cargo\bin"
set "CARGO_EXE="

where cargo >nul 2>&1
if not errorlevel 1 (
  set "CARGO_EXE=cargo"
  call :ok "Rust/Cargo detectado en PATH."
) else if exist "%CARGO_BIN%\cargo.exe" (
  set "PATH=%CARGO_BIN%;!PATH!"
  set "CARGO_EXE=cargo"
  call :ok "Rust detectado en %CARGO_BIN% (PATH actualizado para esta sesion)."
) else (
  call :info "Instalando Rust (rustup)... puede tardar varios minutos."
  winget install --id Rustlang.Rustup -e --silent --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
  if exist "%CARGO_BIN%\cargo.exe" (
    set "PATH=%CARGO_BIN%;!PATH!"
    set "CARGO_EXE=cargo"
    call :ok "Rust instalado correctamente."
  ) else (
    call :err "No se pudo instalar Rust. Instala manualmente: https://rustup.rs"
    set "RESTART_NEEDED=1"
  )
)

rem ================================================================
rem  5. Toolchain Rust MSVC (requerido para compilar en Windows)
rem ================================================================
if defined CARGO_EXE (
  if exist "%CARGO_BIN%\rustup.exe" (
    call :info "Configurando toolchain stable-msvc (requerido en Windows)..."
    "%CARGO_BIN%\rustup.exe" default stable-msvc >> "%LOG%" 2>&1
    "%CARGO_BIN%\rustup.exe" target add x86_64-pc-windows-msvc >> "%LOG%" 2>&1
    call :ok "Toolchain stable-msvc configurado."
  )
)

rem ================================================================
rem  6. VS Build Tools con workload C++ (linker MSVC para Rust)
rem ================================================================
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "HAS_MSVC=0"
if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%Q in (
    `"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`
  ) do (
    if not "%%Q"=="" set "HAS_MSVC=1"
  )
)
if "!HAS_MSVC!"=="1" (
  call :ok "VS Build Tools con workload C++ detectado."
) else (
  call :info "Instalando VS Build Tools con workload C++ (~2-4 GB, 5-15 min)..."
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent --accept-source-agreements --accept-package-agreements --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" >> "%LOG%" 2>&1
  if errorlevel 1 (
    call :err "No se pudo instalar VS Build Tools automaticamente."
    call :err "Instala manualmente 'Build Tools for Visual Studio 2022' con workload 'Desktop development with C++'."
    call :err "Descarga: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
  ) else (
    call :ok "VS Build Tools instalado."
    set "RESTART_NEEDED=1"
  )
)

rem ================================================================
rem  7. WebView2 Runtime  (motor de renderizado del frontend)
rem ================================================================
call :info "Verificando WebView2 Runtime..."
winget install --id Microsoft.EdgeWebView2Runtime -e --silent --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
call :ok "WebView2 Runtime verificado."

rem ================================================================
rem  8. Dependencias del frontend  (pnpm install)
rem     Solo si no se requiere reiniciar (tools en PATH actual)
rem ================================================================
if "!RESTART_NEEDED!"=="0" (
  if defined PNPM_EXE (
    if exist "%APP_DIR%\package.json" (
      call :info "Instalando dependencias del frontend con pnpm..."
      call :info "(pnpm descargara Node 22 LTS automaticamente segun .npmrc del proyecto)"
      call "%PNPM_EXE%" --dir "%APP_DIR%" install >> "%LOG%" 2>&1
      if errorlevel 1 (
        call :err "Fallo 'pnpm install'. Revisa el log en: %LOG%"
      ) else (
        call :ok "Dependencias del frontend instaladas."
      )
    ) else (
      call :err "No se encontro %APP_DIR%\package.json"
      call :err "Asegurate de clonar el repositorio completo antes de ejecutar setup."
    )
  ) else (
    call :info "pnpm no disponible; ejecuta 'pnpm install' en v3/ al reabrir la terminal."
  )
) else (
  call :info "Se omite 'pnpm install': hay herramientas nuevas que requieren nueva terminal."
)

rem ================================================================
rem  9. Pre-descarga de crates de Rust  (cargo fetch)
rem     Acelera el primer 'cargo build' sin compilar nada aun.
rem ================================================================
if "!RESTART_NEEDED!"=="0" (
  if defined CARGO_EXE (
    if exist "%APP_DIR%\src-tauri\Cargo.toml" (
      call :info "Pre-descargando crates de Rust (cargo fetch)..."
      pushd "%APP_DIR%\src-tauri"
      cargo fetch >> "%LOG%" 2>&1
      if errorlevel 1 (
        call :info "cargo fetch tuvo advertencias (no critico). Revisa %LOG%"
      ) else (
        call :ok "Crates de Rust descargados (cargo fetch OK)."
      )
      popd
    )
  )
) else (
  call :info "Se omite 'cargo fetch': reabre la terminal y vuelve a ejecutar este script."
)

rem ================================================================
rem  Resumen final
rem ================================================================
:summary
echo(
echo ==================================================
>> "%LOG%" echo [%DATE% %TIME%] Setup finalizado. Errores: !ERRORS!. RESTART_NEEDED: !RESTART_NEEDED!

if !ERRORS! gtr 0 (
  echo   SETUP INCOMPLETO  -  !ERRORS! error^(es^). Revisa: %LOG%
  if not defined CARGO_EXE echo   Falta Rust:  https://rustup.rs
  if not defined PNPM_EXE  echo   Falta pnpm:  npm install -g pnpm@11
  if "!HAS_MSVC!"=="0" (
    echo   Falta VS Build Tools:
    echo   https://visualstudio.microsoft.com/visual-cpp-build-tools/
  )
  echo ==================================================
  endlocal & exit /b 1
)

if "!RESTART_NEEDED!"=="1" (
  echo   SETUP CASI LISTO
  echo   Se instalaron herramientas que requieren nueva terminal.
  echo(
  echo   PASOS:
  echo   1) Cierra esta ventana completamente.
  echo   2) Abre una nueva terminal (cmd o PowerShell).
  echo   3) Vuelve a ejecutar:  scripts\setup-env.bat
  echo ==================================================
  endlocal & exit /b 0
)

echo   ENTORNO LISTO
echo   Ejecuta:  scripts\dev.bat          (modo desarrollo)
echo   Ejecuta:  scripts\build-portable.bat  (compilar)
echo ==================================================
endlocal & exit /b 0

rem ================================================================
rem  Subrutinas de log
rem ================================================================
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
