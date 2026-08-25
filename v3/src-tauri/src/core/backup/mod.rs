//! Sistema de backup con manifest verificable.
//!
//! Antes de cualquier instalacion se guarda en `.betterrtx-backup/<timestamp>/`
//! un `manifest.json` con el SHA256 de cada archivo respaldado. Esto permite
//! verificar la integridad del backup y restaurar con certeza.
//!
//! La restauracion a vanilla es la operacion inversa: copia los archivos del
//! backup de vuelta al directorio de materiales y verifica los hashes.

use crate::app_core::installer::index_redirect;
use crate::app_core::integrity;
use crate::infra::error::AppError;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Nombre del directorio de backups dentro del directorio de la instalacion.
pub const BACKUP_DIR_NAME: &str = ".betterrtx-backup";

/// Archivos RTX que se respaldan antes de instalar.
const RTX_FILES: &[&str] = &[
    "RTXStub.material.bin",
    "RTXPostFX.Tonemapping.material.bin",
    "RTXPostFX.Bloom.material.bin",
];

/// Entrada de un archivo en el manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFile {
    pub name: String,
    pub sha256: String,
    pub size: u64,
}

/// Manifest de un backup: metadatos + hashes de todos los archivos respaldados.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    /// ID unico de la sesion de instalacion que genero este backup.
    pub session_id: String,
    /// Timestamp ISO 8601 de creacion.
    pub created_at: String,
    /// Ruta de la instalacion de Minecraft a la que corresponde.
    pub install_location: String,
    /// Mecanismo de instalacion usado (`indexRedirect` | `directOverwrite`).
    pub mechanism: String,
    /// Archivos respaldados con sus hashes.
    pub files: Vec<BackupFile>,
}

/// Entrada resumida de un backup (para listar sin cargar todos los manifests).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub session_id: String,
    pub created_at: String,
    pub backup_dir: String,
    pub mechanism: String,
    pub file_count: usize,
}

/// Crea un backup de los materiales RTX actuales en la instalacion.
///
/// Devuelve la ruta del directorio de backup creado y el manifest generado.
pub fn create_backup(
    install_location: &Path,
    materials_dir: &Path,
    session_id: &str,
    mechanism: &str,
) -> Result<(PathBuf, BackupManifest), AppError> {
    let backup_root = install_location.join(BACKUP_DIR_NAME);
    let timestamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let backup_dir = backup_root.join(&timestamp);

    fs::create_dir_all(&backup_dir)
        .map_err(|e| AppError::Io(format!("No se pudo crear directorio de backup: {e}")))?;

    let mut backed_files = Vec::new();

    for &filename in RTX_FILES {
        let src = materials_dir.join(filename);
        if !src.exists() {
            tracing::debug!(file = filename, "archivo no encontrado, omitiendo del backup");
            continue;
        }

        let dest = backup_dir.join(filename);
        fs::copy(&src, &dest)
            .map_err(|e| AppError::Io(format!("Backup de {filename} falló: {e}")))?;

        let sha256 = integrity::sha256_file(&dest)?;
        let size = fs::metadata(&dest)
            .map(|m| m.len())
            .unwrap_or(0);

        backed_files.push(BackupFile {
            name: filename.to_string(),
            sha256,
            size,
        });
    }

    // Incluir materials.index.json si existe.
    let index_src = materials_dir.join("materials.index.json");
    if index_src.exists() {
        let index_dest = backup_dir.join("materials.index.json");
        fs::copy(&index_src, &index_dest)
            .map_err(|e| AppError::Io(format!("Backup de materials.index.json falló: {e}")))?;
        let sha256 = integrity::sha256_file(&index_dest)?;
        let size = fs::metadata(&index_dest).map(|m| m.len()).unwrap_or(0);
        backed_files.push(BackupFile {
            name: "materials.index.json".to_string(),
            sha256,
            size,
        });
    }

    let manifest = BackupManifest {
        session_id: session_id.to_string(),
        created_at: Utc::now().to_rfc3339(),
        install_location: install_location.display().to_string(),
        mechanism: mechanism.to_string(),
        files: backed_files,
    };

    // Escribir manifest.json en el directorio de backup.
    let manifest_path = backup_dir.join("manifest.json");
    let json =
        serde_json::to_string_pretty(&manifest).map_err(|e| AppError::Io(e.to_string()))?;
    fs::write(&manifest_path, json)
        .map_err(|e| AppError::Io(format!("Escribir manifest.json falló: {e}")))?;

    tracing::info!(
        backup_dir = %backup_dir.display(),
        files = manifest.files.len(),
        "Backup creado"
    );

    Ok((backup_dir, manifest))
}

/// Lista todos los backups disponibles para una instalacion.
pub fn list_backups(install_location: &Path) -> Vec<BackupEntry> {
    let backup_root = install_location.join(BACKUP_DIR_NAME);
    if !backup_root.exists() {
        return vec![];
    }

    let Ok(entries) = fs::read_dir(&backup_root) else {
        return vec![];
    };

    let mut backups = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join("manifest.json");
        if let Ok(content) = fs::read_to_string(&manifest_path) {
            if let Ok(manifest) = serde_json::from_str::<BackupManifest>(&content) {
                backups.push(BackupEntry {
                    session_id: manifest.session_id,
                    created_at: manifest.created_at,
                    backup_dir: path.display().to_string(),
                    mechanism: manifest.mechanism,
                    file_count: manifest.files.len(),
                });
            }
        }
    }

    // Mas reciente primero.
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    backups
}

/// Copia de vuelta los archivos de un manifest y verifica su integridad.
///
/// Si el estado restaurado ya no usa INDEX_REDIRECT (el `materials.index.json`
/// restaurado no apunta a `betterrtx/`), limpia esa carpeta si quedo huerfana
/// — evita acumular archivos de presets viejos que ya nadie referencia.
fn apply_manifest(materials_dir: &Path, manifest: &BackupManifest, backup_dir: &Path) -> Result<(), AppError> {
    for backed_file in &manifest.files {
        let src = backup_dir.join(&backed_file.name);
        if !src.exists() {
            tracing::warn!(file = %backed_file.name, "archivo de backup no encontrado, omitiendo");
            continue;
        }

        let dest = materials_dir.join(&backed_file.name);
        fs::copy(&src, &dest).map_err(|e| {
            AppError::Io(format!("Restaurar {} falló: {e}", backed_file.name))
        })?;

        integrity::verify_file(&dest, &backed_file.sha256)?;
    }

    if !index_redirect::is_redirect_active(materials_dir) {
        let betterrtx_dir = materials_dir.join(index_redirect::BETTERRTX_SUBDIR);
        if betterrtx_dir.exists() {
            let _ = fs::remove_dir_all(&betterrtx_dir);
        }
    }

    Ok(())
}

/// Restaura los materiales RTX a su estado original: el backup mas **antiguo**
/// de la instalacion (el primero que se creo, antes de aplicar ningun preset).
///
/// Usar el mas reciente aqui seria incorrecto: si ya se instalo mas de un
/// preset, el backup mas reciente solo captura el estado *antes del ultimo*
/// install (que puede seguir teniendo otro preset redirigido), no el original
/// del juego. Para restaurar un snapshot intermedio especifico, usar
/// `restore_from_session`.
pub fn restore_vanilla(
    install_location: &Path,
    materials_dir: &Path,
) -> Result<BackupManifest, AppError> {
    let backups = list_backups(install_location);
    let original = backups.last().ok_or_else(|| {
        AppError::Other("No se encontro ningun backup para esta instalacion.".into())
    })?;

    let backup_dir = PathBuf::from(&original.backup_dir);
    let manifest_path = backup_dir.join("manifest.json");
    let content = fs::read_to_string(&manifest_path)
        .map_err(|e| AppError::Io(format!("Leer manifest falló: {e}")))?;
    let manifest: BackupManifest =
        serde_json::from_str(&content).map_err(|e| AppError::Io(e.to_string()))?;

    apply_manifest(materials_dir, &manifest, &backup_dir)?;

    tracing::info!(
        backup_dir = %backup_dir.display(),
        files = manifest.files.len(),
        "Restauracion al original completada"
    );

    Ok(manifest)
}

/// Elimina el directorio de un backup especifico (por `session_id`).
///
/// No afecta los archivos actuales de la instalacion: solo borra la copia
/// de seguridad guardada en `.betterrtx-backup/<timestamp>/`.
pub fn delete_backup(install_location: &Path, session_id: &str) -> Result<(), AppError> {
    let backups = list_backups(install_location);
    let entry = backups
        .iter()
        .find(|b| b.session_id == session_id)
        .ok_or_else(|| AppError::Other(format!("Backup con session_id '{session_id}' no encontrado")))?;

    fs::remove_dir_all(&entry.backup_dir)
        .map_err(|e| AppError::Io(format!("No se pudo eliminar el backup: {e}")))?;

    tracing::info!(backup_dir = %entry.backup_dir, "Backup eliminado");
    Ok(())
}

/// Restaura desde un backup especifico (por `session_id`).
pub fn restore_from_session(
    install_location: &Path,
    materials_dir: &Path,
    session_id: &str,
) -> Result<BackupManifest, AppError> {
    let backups = list_backups(install_location);
    let entry = backups
        .iter()
        .find(|b| b.session_id == session_id)
        .ok_or_else(|| AppError::Other(format!("Backup con session_id '{session_id}' no encontrado")))?;

    let backup_dir = PathBuf::from(&entry.backup_dir);
    let manifest_path = backup_dir.join("manifest.json");
    let content = fs::read_to_string(&manifest_path)
        .map_err(|e| AppError::Io(format!("Leer manifest falló: {e}")))?;
    let manifest: BackupManifest =
        serde_json::from_str(&content).map_err(|e| AppError::Io(e.to_string()))?;

    apply_manifest(materials_dir, &manifest, &backup_dir)?;

    Ok(manifest)
}
