//! Panel de diagnostico: genera un informe completo del estado del sistema
//! y de una instalacion concreta de Minecraft Bedrock.

use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::app_core::{backup, detection, installer::index_redirect};

const RTX_FILES: &[&str] = &[
    "RTXStub.material.bin",
    "RTXPostFX.Tonemapping.material.bin",
    "RTXPostFX.Bloom.material.bin",
];

/// Informe de diagnostico de una instalacion concreta.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub install_location: String,
    pub install_kind: String,
    pub materials_dir: String,
    pub materials_dir_exists: bool,
    pub directly_writable: bool,
    pub index_json_present: bool,
    pub index_json_valid: bool,
    pub recommended_provider: String,
    pub provider_confidence: String,
    pub external_unlockers: Vec<String>,
    pub backup_count: usize,
    /// Archivos RTX presentes en el directorio de materiales.
    pub rtx_files_present: Vec<String>,
    /// Indica si hay un redirect activo (betterrtx/ existe y JSON lo referencia).
    pub betterrtx_redirect_active: bool,
    pub notes: Vec<String>,
}

/// Genera el informe de diagnostico para una instalacion dada.
pub fn run(install_location: &str) -> DiagnosticsReport {
    let cap = detection::scan_capabilities(install_location);
    let root = Path::new(install_location);
    let materials = root.join("data").join("renderer").join("materials");

    let rtx_present: Vec<String> = RTX_FILES
        .iter()
        .filter(|&&f| materials.join(f).exists())
        .map(|f| f.to_string())
        .collect();

    let redirect_active = index_redirect::is_redirect_active(&materials);
    let backups = backup::list_backups(root);

    DiagnosticsReport {
        install_location: install_location.to_string(),
        install_kind: format!("{:?}", cap.install_kind),
        materials_dir: cap.materials_dir.clone(),
        materials_dir_exists: cap.materials_dir_exists,
        directly_writable: cap.directly_writable,
        index_json_present: cap.index_json_present,
        index_json_valid: cap.index_json_valid,
        recommended_provider: cap.recommended_provider,
        provider_confidence: format!("{:?}", cap.provider_confidence),
        external_unlockers: cap.external_unlockers,
        backup_count: backups.len(),
        rtx_files_present: rtx_present,
        betterrtx_redirect_active: redirect_active,
        notes: cap.notes,
    }
}
