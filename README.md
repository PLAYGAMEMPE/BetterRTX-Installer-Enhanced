# BetterRTX Easy Installer

Aplicación portable para Windows que automatiza la instalación, gestión y
restauración de **BetterRTX** en Minecraft Bedrock RTX.

El objetivo es reducir un proceso técnico y propenso a fallos a una experiencia
**de un clic**, estable y segura, para usuarios sin conocimientos técnicos.

> Proyecto personal basado en el instalador oficial de BetterRTX
> (`BetterRTX-Installer`, v3), bajo licencia GPL-3.0. No está afiliado al
> proyecto oficial, ni a NVIDIA ni a Mojang.

## Stack

- **Frontend:** React 18 · TailwindCSS 4 · Zustand · Vite
- **Backend:** Rust · Tauri 2 · Tokio · Serde
- **Plataforma:** Windows 10 (1809+) y Windows 11

El código de la aplicación vive en [`v3/`](v3/).

## Compilar y ejecutar

Los scripts de [`scripts/`](scripts/) autodetectan dependencias, validan el
entorno y escriben logs en `logs/`.

| Paso | Comando | Qué hace |
|---|---|---|
| 1. Setup | `scripts\setup-env.bat` | Instala Rust (+MSVC), Bun y WebView2; corre `bun install`. |
| 2. Desarrollo | `scripts\dev.bat` | Lanza Tauri en modo dev (hot-reload de frontend y backend). |
| 3. Build portable | `scripts\build-portable.bat` | Genera el `.exe` portable en `dist\portable\`. |
| 4. Build release | `scripts\build-release.bat` | Genera `.exe` + NSIS + MSI + ZIP en `dist\release\`. |

Tras `setup-env.bat`, si se instalaron herramientas nuevas en el PATH, cierra y
reabre la terminal y vuelve a ejecutarlo una vez para completar `bun install`.

## Arquitectura del backend

Estructura modular en [`v3/src-tauri/src/`](v3/src-tauri/src/):

| Módulo | Contenido |
|---|---|
| `infra/error.rs` | `AppError` tipado → `{ code, message, recoverable, suggestedAction }`. |
| `infra/logging.rs` | Logging estructurado con `tracing` → `logs/install.log`. |
| `core/integrity.rs` | Verificación de integridad SHA256. |
| `core/detection.rs` | Escaneo de capacidades del entorno (`CapabilityReport`). |
| `core/permissions/` | Sistema adaptativo de permisos: providers `XboxGames`, `Acl`, `Unlocker`, `Staged` + `recovery::Journal`. |

## Estado / Roadmap

- [x] **Fase 0** — Base v3, scripts `.bat`, `AppError`, logging, integridad, módulos.
- [ ] **Fase 1 (MVP)** — `acquire`/`release` en los providers, motor de instalación
      híbrido (redirect de `materials.index.json` + fallback de sobrescritura),
      backup con manifest, restauración a vanilla, UI de progreso.
- [ ] **Fase 2** — Compatibility engine, recovery mode al arranque, diagnóstico.
- [ ] **Fase 3** — Migración automática entre versiones, sync, benchmarking.

## Licencia

Distribuido bajo [GNU General Public License v3.0](LICENSE.md).
