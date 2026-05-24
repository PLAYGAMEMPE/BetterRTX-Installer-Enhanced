//! Mecanismo INDEX_REDIRECT.
//!
//! En lugar de sobrescribir los `.material.bin` originales, crea una
//! subcarpeta `betterrtx/` dentro del directorio de materiales y parchea
//! `materials.index.json` para que el juego cargue los archivos del preset
//! desde ahi. Restaurar a vanilla = revertir el JSON + borrar la carpeta.

use crate::app_core::permissions::recovery::{Journal, JournalAction};
use crate::infra::error::AppError;
use serde_json::Value;
use std::fs;
use std::path::Path;

pub const BETTERRTX_SUBDIR: &str = "betterrtx";

/// Ejecuta la instalacion via redirect de `materials.index.json`.
///
/// # Pasos
/// 1. Backup del JSON original.
/// 2. Creacion de `betterrtx/` y copia de los archivos del preset.
/// 3. Parche del JSON para apuntar a `betterrtx/<archivo>`.
/// 4. Escritura del JSON parchado.
pub fn execute(
    materials_dir: &Path,
    preset_files: &[(&str, &Path)],
    journal: &mut Journal,
) -> Result<(), AppError> {
    let index_path = materials_dir.join("materials.index.json");
    let backup_path = materials_dir.join("materials.index.json.brtx-bak");
    let betterrtx_dir = materials_dir.join(BETTERRTX_SUBDIR);

    // 1. Leer y validar el JSON.
    let original_json = fs::read_to_string(&index_path)
        .map_err(|e| AppError::Io(format!("No se pudo leer materials.index.json: {e}")))?;
    let mut json: Value = serde_json::from_str(&original_json)
        .map_err(|e| AppError::Io(format!("materials.index.json invalido: {e}")))?;

    // 2. Backup del JSON original.
    fs::copy(&index_path, &backup_path)
        .map_err(|e| AppError::Io(format!("Backup de index.json falló: {e}")))?;
    journal.record(JournalAction::JsonPatched {
        path: index_path.clone(),
        backup: backup_path,
    });

    // 3. Crear directorio betterrtx/.
    fs::create_dir_all(&betterrtx_dir)
        .map_err(|e| AppError::Io(format!("No se pudo crear betterrtx/: {e}")))?;

    // 4. Copiar archivos del preset a betterrtx/.
    for (filename, source) in preset_files {
        let dest = betterrtx_dir.join(filename);
        fs::copy(source, &dest)
            .map_err(|e| AppError::Io(format!("Copia de {filename} a betterrtx/ falló: {e}")))?;
        journal.record(JournalAction::FileWritten { path: dest });
    }

    // 5. Parchear el JSON.
    patch_index(&mut json, preset_files);

    // 6. Escribir JSON parchado.
    let patched = serde_json::to_string_pretty(&json)
        .map_err(|e| AppError::Io(format!("Serializar JSON parchado falló: {e}")))?;
    fs::write(&index_path, patched)
        .map_err(|e| AppError::Io(format!("Escribir materials.index.json falló: {e}")))?;

    tracing::info!(
        dir = %materials_dir.display(),
        files = preset_files.len(),
        "INDEX_REDIRECT completado"
    );
    Ok(())
}

#[allow(dead_code)]
/// Revierte el redirect: restaura el JSON original y elimina `betterrtx/`.
pub fn revert(materials_dir: &Path) -> Result<(), AppError> {
    let index_path = materials_dir.join("materials.index.json");
    let backup_path = materials_dir.join("materials.index.json.brtx-bak");
    let betterrtx_dir = materials_dir.join(BETTERRTX_SUBDIR);

    if backup_path.exists() {
        fs::copy(&backup_path, &index_path)
            .map_err(|e| AppError::Io(format!("Restaurar index.json falló: {e}")))?;
        let _ = fs::remove_file(&backup_path);
    }

    if betterrtx_dir.exists() {
        fs::remove_dir_all(&betterrtx_dir)
            .map_err(|e| AppError::Io(format!("Eliminar betterrtx/ falló: {e}")))?;
    }

    tracing::info!(dir = %materials_dir.display(), "INDEX_REDIRECT revertido");
    Ok(())
}

#[allow(dead_code)]
/// Detecta si ya hay un redirect activo (betterrtx/ existe Y JSON lo referencia).
pub fn is_redirect_active(materials_dir: &Path) -> bool {
    let betterrtx_dir = materials_dir.join(BETTERRTX_SUBDIR);
    if !betterrtx_dir.exists() {
        return false;
    }
    let index_path = materials_dir.join("materials.index.json");
    if let Ok(s) = fs::read_to_string(&index_path) {
        return s.contains(BETTERRTX_SUBDIR);
    }
    false
}

/// Modifica el JSON para que las claves RTX apunten a `betterrtx/<archivo>`.
///
/// La clave en el JSON coincide con el stem del archivo (sin `.material.bin`).
/// Si la clave ya existia se actualiza; si no existia se inserta.
fn patch_index(json: &mut Value, preset_files: &[(&str, &Path)]) {
    let Value::Object(ref mut map) = json else { return };
    for (filename, _) in preset_files {
        let key = filename.strip_suffix(".material.bin").unwrap_or(filename);
        map.insert(
            key.to_string(),
            Value::String(format!("{BETTERRTX_SUBDIR}/{filename}")),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::path::PathBuf;

    #[test]
    fn patch_updates_known_rtx_keys() {
        let mut json = json!({
            "RTXStub": "RTXStub.material.bin",
            "RTXPostFX.Tonemapping": "RTXPostFX.Tonemapping.material.bin",
            "RTXPostFX.Bloom": "RTXPostFX.Bloom.material.bin",
            "Other": "other.bin"
        });

        let stub_path = PathBuf::from("preset/RTXStub.material.bin");
        let tone_path = PathBuf::from("preset/RTXPostFX.Tonemapping.material.bin");
        let bloom_path = PathBuf::from("preset/RTXPostFX.Bloom.material.bin");

        let files: &[(&str, &Path)] = &[
            ("RTXStub.material.bin", &stub_path),
            ("RTXPostFX.Tonemapping.material.bin", &tone_path),
            ("RTXPostFX.Bloom.material.bin", &bloom_path),
        ];

        patch_index(&mut json, files);

        assert_eq!(json["RTXStub"], "betterrtx/RTXStub.material.bin");
        assert_eq!(
            json["RTXPostFX.Tonemapping"],
            "betterrtx/RTXPostFX.Tonemapping.material.bin"
        );
        assert_eq!(
            json["RTXPostFX.Bloom"],
            "betterrtx/RTXPostFX.Bloom.material.bin"
        );
        // Otras claves no deben tocarse.
        assert_eq!(json["Other"], "other.bin");
    }
}
