//! Deteccion de migracion de version de Minecraft.
//!
//! Rastrea la version de MC instalada en el momento de cada instalacion de
//! BetterRTX. Si la version cambia (update de MC), marca la instalacion como
//! "necesita migracion" para que el usuario reaplique el preset.

use crate::infra::error::AppError;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

const VERSIONS_FILE: &str = "versions.json";

/// Estado de migracion para una instalacion concreta.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationStatus {
    pub migration_needed: bool,
    /// Version registrada en la ultima instalacion de BetterRTX.
    pub installed_mc_version: Option<String>,
    /// Version actual detectada del juego.
    pub current_mc_version: Option<String>,
    /// UUID del preset instalado en esa version.
    pub installed_preset_uuid: Option<String>,
    pub install_location: String,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct VersionRecord {
    mc_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    preset_uuid: Option<String>,
    installed_at: String,
}

type VersionMap = HashMap<String, VersionRecord>;

fn versions_path(brtx_dir: &Path) -> std::path::PathBuf {
    brtx_dir.join(VERSIONS_FILE)
}

fn load_versions(brtx_dir: &Path) -> VersionMap {
    let path = versions_path(brtx_dir);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn save_versions(brtx_dir: &Path, map: &VersionMap) -> Result<(), AppError> {
    let json = serde_json::to_string_pretty(map).map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::write(versions_path(brtx_dir), json).map_err(|e| AppError::Io(e.to_string()))
}

/// Lee la version de Minecraft desde `AppxManifest.xml` en el directorio raiz.
///
/// Funciona tanto para WindowsApps como para instalaciones XboxGames.
/// Devuelve `None` si el manifest no existe o no tiene campo Version.
pub fn detect_mc_version(install_location: &str) -> Option<String> {
    let manifest = Path::new(install_location).join("AppxManifest.xml");
    let content = std::fs::read_to_string(&manifest).ok()?;

    // Buscar: <Identity ... Version="x.x.x.x" ...>
    let pos = content.find("Version=\"")?;
    let after = &content[pos + 9..];
    let end = after.find('"')?;
    Some(after[..end].to_string())
}

/// Verifica si la instalacion necesita migracion (version de MC diferente
/// a la registrada en el momento de la ultima instalacion de BetterRTX).
pub fn check_migration(install_location: &str, brtx_dir: &Path) -> MigrationStatus {
    let current = detect_mc_version(install_location);
    let versions = load_versions(brtx_dir);
    let stored = versions.get(install_location);

    let migration_needed = match (&stored, &current) {
        (Some(rec), Some(cur)) => rec.mc_version != *cur && !rec.mc_version.is_empty(),
        _ => false,
    };

    let mut notes = Vec::new();
    if migration_needed {
        notes.push(format!(
            "Minecraft actualizo de {} a {}. Reinstala el preset para compatibilidad.",
            stored.map(|r| r.mc_version.as_str()).unwrap_or("desconocida"),
            current.as_deref().unwrap_or("desconocida")
        ));
    } else if current.is_none() {
        notes.push("No se pudo leer la version de Minecraft (AppxManifest.xml no encontrado).".into());
    }

    MigrationStatus {
        migration_needed,
        installed_mc_version: stored.map(|r| r.mc_version.clone()),
        current_mc_version: current,
        installed_preset_uuid: stored.and_then(|r| r.preset_uuid.clone()),
        install_location: install_location.to_string(),
        notes,
    }
}

/// Registra la version de Minecraft actual tras una instalacion exitosa.
/// Se debe llamar al finalizar `install_preset`.
pub fn record_install(
    install_location: &str,
    preset_uuid: Option<&str>,
    brtx_dir: &Path,
) -> Result<(), AppError> {
    let mut versions = load_versions(brtx_dir);
    let mc_version = detect_mc_version(install_location).unwrap_or_default();

    versions.insert(
        install_location.to_string(),
        VersionRecord {
            mc_version,
            preset_uuid: preset_uuid.map(|s| s.to_string()),
            installed_at: Utc::now().to_rfc3339(),
        },
    );

    save_versions(brtx_dir, &versions)
}
