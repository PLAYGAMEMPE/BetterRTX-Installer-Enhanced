//! Escaneo de capacidades del entorno de instalacion.
//!
//! Antes de tocar nada, la app inspecciona la instalacion de Minecraft elegida
//! y produce un [`CapabilityReport`]: tipo de instalacion, si la carpeta de
//! materiales es escribible, si `materials.index.json` existe y es valido, que
//! mecanismo de instalacion conviene y que provider de permisos se usara.

use super::permissions::{self, Confidence, InstallContext, InstallKind};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Mecanismo de instalacion sobre los archivos RTX de Minecraft.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InstallMechanism {
    /// No destructivo: redirige `materials.index.json` a una carpeta `betterrtx/`.
    IndexRedirect,
    /// Sobrescribe directamente los `.material.bin` (requiere backup).
    DirectOverwrite,
}

/// Informe de capacidades de una instalacion concreta de Minecraft.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityReport {
    pub install_location: String,
    pub install_kind: InstallKind,
    pub materials_dir: String,
    pub materials_dir_exists: bool,
    pub directly_writable: bool,
    pub index_json_present: bool,
    pub index_json_valid: bool,
    pub recommended_mechanism: InstallMechanism,
    pub recommended_provider: String,
    pub provider_confidence: Confidence,
    pub external_unlockers: Vec<String>,
    pub notes: Vec<String>,
}

/// Clasifica el tipo de instalacion a partir de su ruta.
pub fn classify(install_location: &str) -> InstallKind {
    let lc = install_location.to_ascii_lowercase();
    if lc.contains("windowsapps") {
        InstallKind::WindowsApps
    } else if lc.contains("xboxgames") {
        InstallKind::XboxGames
    } else if lc.contains("bedrocklauncher") || lc.contains("mclauncher") {
        InstallKind::Sideloaded
    } else {
        InstallKind::Custom
    }
}

/// Comprueba si un directorio acepta escritura, probando con un archivo temporal.
/// Si el directorio no existe, sube al primer ancestro que exista.
fn is_dir_writable(dir: &Path) -> bool {
    if !dir.exists() {
        return match dir.parent() {
            Some(parent) => is_dir_writable(parent),
            None => false,
        };
    }
    let probe = dir.join(".brtx_write_test.tmp");
    match std::fs::write(&probe, b"brtx") {
        Ok(()) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

/// Realiza el escaneo de capacidades para una instalacion dada.
pub fn scan_capabilities(install_location: &str) -> CapabilityReport {
    let mut notes: Vec<String> = Vec::new();
    let kind = classify(install_location);

    let materials_dir = Path::new(install_location)
        .join("data")
        .join("renderer")
        .join("materials");
    let materials_dir_exists = materials_dir.exists();
    let directly_writable = is_dir_writable(&materials_dir);

    if !directly_writable {
        notes.push(
            "La carpeta de materiales no acepta escritura directa; se requerira \
             elevacion ACL o instalacion por staging."
                .to_string(),
        );
    }

    let index_path = materials_dir.join("materials.index.json");
    let index_json_present = index_path.exists();
    let index_json_valid = index_json_present
        && std::fs::read_to_string(&index_path)
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .is_some();

    let recommended_mechanism = if index_json_valid {
        InstallMechanism::IndexRedirect
    } else {
        if index_json_present {
            notes.push(
                "materials.index.json existe pero no es parseable; se usara \
                 sobrescritura directa con backup."
                    .to_string(),
            );
        } else {
            notes.push(
                "No se encontro materials.index.json; se usara sobrescritura \
                 directa con backup."
                    .to_string(),
            );
        }
        InstallMechanism::DirectOverwrite
    };

    let ctx = InstallContext {
        install_location: PathBuf::from(install_location),
        materials_dir: materials_dir.clone(),
        kind,
        directly_writable,
    };
    let recommendation = permissions::recommend(&ctx);
    let external_unlockers = permissions::unlocker::detect_unlockers();

    if recommendation.confidence == Confidence::None {
        notes.push(
            "Ningun provider de permisos puede manejar esta instalacion con \
             confianza; revisa el diagnostico."
                .to_string(),
        );
    }

    CapabilityReport {
        install_location: install_location.to_string(),
        install_kind: kind,
        materials_dir: materials_dir.to_string_lossy().to_string(),
        materials_dir_exists,
        directly_writable,
        index_json_present,
        index_json_valid,
        recommended_mechanism,
        recommended_provider: recommendation.provider,
        provider_confidence: recommendation.confidence,
        external_unlockers,
        notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_paths() {
        assert_eq!(
            classify(r"C:\Program Files\WindowsApps\Microsoft.Minecraft_x"),
            InstallKind::WindowsApps
        );
        assert_eq!(
            classify(r"C:\XboxGames\Minecraft for Windows\Content"),
            InstallKind::XboxGames
        );
        assert_eq!(classify(r"D:\Games\custom-mc"), InstallKind::Custom);
    }
}
