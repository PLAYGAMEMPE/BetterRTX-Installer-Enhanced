//! Mecanismo DIRECT_OVERWRITE.
//!
//! Fallback cuando `materials.index.json` no existe o no es valido.
//! Sobrescribe directamente los `.material.bin` en el directorio de materiales.
//! Los originales deben estar respaldados por el modulo `backup` antes de llamar
//! a este mecanismo.

use crate::app_core::permissions::recovery::{Journal, JournalAction};
use crate::infra::error::AppError;
use std::fs;
use std::path::Path;

/// Ejecuta la instalacion por sobrescritura directa.
///
/// Asume que los archivos originales ya estan respaldados en `backup_dir`.
/// Si un archivo de destino no existe, se crea; si existe, se sobreescribe.
pub fn execute(
    materials_dir: &Path,
    backup_dir: &Path,
    preset_files: &[(&str, &Path)],
    journal: &mut Journal,
) -> Result<(), AppError> {
    // Asegurar que el directorio de materiales existe.
    fs::create_dir_all(materials_dir)
        .map_err(|e| AppError::Io(format!("No se pudo crear materials_dir: {e}")))?;

    for (filename, source) in preset_files {
        let dest = materials_dir.join(filename);

        // Registrar backup previo en el journal (ya deberia existir, solo anotamos).
        let backup = backup_dir.join(filename);
        if backup.exists() {
            journal.record(JournalAction::FileBackup {
                original: dest.clone(),
                backup,
            });
        }

        // Sobrescribir.
        fs::copy(source, &dest).map_err(|e| {
            AppError::Io(format!(
                "DIRECT_OVERWRITE: copia de {filename} a {} falló: {e}",
                dest.display()
            ))
        })?;
        journal.record(JournalAction::FileWritten { path: dest });
    }

    tracing::info!(
        dir = %materials_dir.display(),
        files = preset_files.len(),
        "DIRECT_OVERWRITE completado"
    );
    Ok(())
}

#[allow(dead_code)]
/// Restaura los archivos originales desde el backup.
pub fn revert(materials_dir: &Path, backup_dir: &Path) -> Result<(), AppError> {
    let rtx_files = [
        "RTXStub.material.bin",
        "RTXPostFX.Tonemapping.material.bin",
        "RTXPostFX.Bloom.material.bin",
    ];

    for filename in rtx_files {
        let backup = backup_dir.join(filename);
        let dest = materials_dir.join(filename);
        if backup.exists() {
            fs::copy(&backup, &dest).map_err(|e| {
                AppError::Io(format!("Restaurar {filename} desde backup falló: {e}"))
            })?;
        }
    }

    tracing::info!(dir = %materials_dir.display(), "DIRECT_OVERWRITE revertido");
    Ok(())
}
