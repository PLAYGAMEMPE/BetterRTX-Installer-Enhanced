fn main() {
    // Embeber manifesto UAC en el exe de Windows.
    // embed-manifest solo escribe RT_MANIFEST (tipo 24), sin bloque VERSION,
    // por lo que no colisiona con el VS_VERSION_INFO que genera tauri-build.
    // requireAdministrator: la app pide elevacion al arrancar una sola vez;
    // los procesos hijos (instaladores de IObit, operaciones ACL) heredan el
    // token elevado sin mostrar dialogos UAC adicionales.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        embed_manifest::embed_manifest(
            embed_manifest::new_manifest("BetterRTX Installer")
                .requested_execution_level(
                    embed_manifest::manifest::ExecutionLevel::RequireAdministrator,
                ),
        )
        .expect("No se pudo embeber el manifesto de Windows");
    }

    tauri_build::build()
}
