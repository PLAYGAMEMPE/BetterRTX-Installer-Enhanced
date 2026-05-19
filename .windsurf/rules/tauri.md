---
trigger: always_on
---

# Project Rules — BetterRTX Installer (Tauri v2)

- Use **Tauri v2** APIs and docs; prefer NSIS installer on Windows.
- Frontend: React + TS; strict mode; Tailwind CSS v4; keep UI edits isolated. Reference Tailwind @docs
- Rust core: small commands with `#[tauri::command]`; pure helpers.
- use context7 to referecne Tauri docs
- Test with `pnpm tauri dev` from the `v3/` directory. Use **pnpm** exclusively — do not use npm, bun, or yarn.
- Prefer Tauri plugins over implementing own features.