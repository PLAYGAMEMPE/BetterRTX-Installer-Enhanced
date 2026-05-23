fn main() {
    // Embeber el manifesto de Windows en el ejecutable.
    // requireAdministrator: la app pide elevacion UAC al arrancar;
    // los procesos hijos (instaladores de IObit, etc.) heredan el token
    // elevado sin mostrar dialogos UAC adicionales.
    #[cfg(target_os = "windows")]
    {
        let mut res = winresource::WindowsResource::new();
        res.set_manifest_file("app.manifest");
        res.compile().expect("No se pudo compilar el recurso de manifiesto de Windows");
    }

    tauri_build::build()
}
