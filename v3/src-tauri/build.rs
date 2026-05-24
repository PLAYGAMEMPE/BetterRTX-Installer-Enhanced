fn main() {
    // ── Versión: package.json es la única fuente de verdad ──────────────────────
    // Lee la versión de package.json (un nivel arriba de src-tauri/).
    let pkg_json = std::fs::read_to_string("../package.json")
        .expect("build.rs: no se pudo leer ../package.json");
    let pkg_version = pkg_json
        .lines()
        .find(|l| l.trim().starts_with("\"version\""))
        .and_then(|l| l.split('"').nth(3))
        .expect("build.rs: campo \"version\" no encontrado en package.json");

    // Valida que Cargo.toml esté sincronizado; falla el build si no coinciden.
    let cargo_version = env!("CARGO_PKG_VERSION");
    if pkg_version != cargo_version {
        panic!(
            "\n\n[ERROR DE VERSIÓN]\n  package.json : {pkg_version}\n  Cargo.toml   : {cargo_version}\n\n  → Actualiza la version en Cargo.toml para que coincida con package.json.\n"
        );
    }

    // Expone APP_VERSION al código Rust: env!("APP_VERSION")
    println!("cargo:rustc-env=APP_VERSION={pkg_version}");
    // Reinicia la build si package.json cambia.
    println!("cargo:rerun-if-changed=../package.json");

    // ── Manifiesto Windows ───────────────────────────────────────────────────────
    // En release: embebe app.manifest con requireAdministrator + Common-Controls v6.
    // En debug (tauri dev): Tauri usa su manifiesto por defecto (asInvoker, sin UAC).
    let profile = std::env::var("PROFILE").unwrap_or_default();
    let attrs = if profile == "release" {
        tauri_build::Attributes::new().windows_attributes(
            tauri_build::WindowsAttributes::new()
                .app_manifest(include_str!("app.manifest")),
        )
    } else {
        tauri_build::Attributes::new()
    };
    tauri_build::try_build(attrs).expect("failed to run tauri-build");
}
