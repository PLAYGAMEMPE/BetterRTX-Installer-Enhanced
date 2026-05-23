fn main() {
    // En release: embebe app.manifest con requireAdministrator + Common-Controls v6.
    // En debug (tauri dev): Tauri usa su manifiesto por defecto (asInvoker, sin UAC).
    // Esto evita dos problemas del manifiesto en dev mode:
    //   1. cargo no puede ejecutar un hijo con requireAdministrator desde un proceso no elevado.
    //   2. El manifiesto incompleto causaba STATUS_ENTRYPOINT_NOT_FOUND al faltar Common-Controls.
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
