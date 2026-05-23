// Manifiesto UAC con requireAdministrator embebido via el canal oficial de Tauri.
// tauri_build::try_build con WindowsAttributes::app_manifest() pasa el XML
// directamente al linker MSVC (/MANIFEST:EMBED /MANIFESTINPUT:) sin crear
// ningun recurso .res adicional, por lo que no colisiona con el VERSION que
// genera tauri-build internamente.
const APP_MANIFEST: &str = include_str!("app.manifest");

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().windows_attributes(
            tauri_build::WindowsAttributes::new().app_manifest(APP_MANIFEST),
        ),
    )
    .expect("failed to run tauri-build");
}
