//! Motor de compatibilidad basico.
//!
//! Verifica que una instalacion de Minecraft puede recibir un preset de
//! BetterRTX antes de iniciar el proceso de instalacion. Emite advertencias
//! (no bloquea salvo condicion critica) para que el usuario tome una decision
//! informada.
//!
//! La tabla de versiones remota y la deteccion de ABI de shaders se incorporan
//! en Fase 3.

use serde::{Deserialize, Serialize};
use std::path::Path;

/// Estado general de compatibilidad.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CompatStatus {
    /// Ninguna advertencia ni bloqueador.
    Ok,
    /// Hay advertencias; el usuario puede continuar bajo su responsabilidad.
    Warning,
    /// La instalacion no puede recibir el preset en su estado actual.
    Blocked,
}

/// Informe de compatibilidad de una instalacion.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompatReport {
    pub status: CompatStatus,
    pub warnings: Vec<String>,
    pub blockers: Vec<String>,
    /// `true` si no hay bloqueadores (la instalacion puede proceder).
    pub can_proceed: bool,
}

/// Archivos RTX que deben estar presentes tras al menos un arranque con RTX.
const RTX_FILES: &[&str] = &[
    "RTXStub.material.bin",
    "RTXPostFX.Tonemapping.material.bin",
    "RTXPostFX.Bloom.material.bin",
];

/// Verifica compatibilidad basica sin descargar ni modificar nada.
pub fn check(install_location: &str) -> CompatReport {
    let mut warnings = Vec::new();
    let mut blockers = Vec::new();

    let root = Path::new(install_location);

    if !root.exists() {
        blockers.push(format!(
            "La ruta de instalacion no existe: {}",
            install_location
        ));
        return build_report(warnings, blockers);
    }

    let materials = root.join("data").join("renderer").join("materials");

    if !materials.exists() {
        warnings.push(
            "No se encontro la carpeta de materiales. \
             Ejecuta Minecraft con RTX activo al menos una vez antes de instalar."
                .into(),
        );
        // No hay archivos RTX si la carpeta no existe; advertencia ya cubre esto.
        return build_report(warnings, blockers);
    }

    // Verificar presencia de archivos RTX.
    let missing: Vec<&str> = RTX_FILES
        .iter()
        .filter(|&&f| !materials.join(f).exists())
        .copied()
        .collect();

    if !missing.is_empty() {
        warnings.push(format!(
            "Archivos RTX no encontrados: {}. \
             Inicia Minecraft con RTX habilitado para generarlos.",
            missing.join(", ")
        ));
    }

    // Verificar que el directorio de materiales no este vacio.
    let any_bin = std::fs::read_dir(&materials)
        .ok()
        .map(|rd| rd.flatten().any(|e| {
            e.path().extension().map(|x| x == "bin").unwrap_or(false)
        }))
        .unwrap_or(false);

    if !any_bin {
        warnings.push(
            "El directorio de materiales esta vacio. \
             Ejecuta Minecraft con RTX al menos una vez."
                .into(),
        );
    }

    build_report(warnings, blockers)
}

fn build_report(warnings: Vec<String>, blockers: Vec<String>) -> CompatReport {
    let status = if !blockers.is_empty() {
        CompatStatus::Blocked
    } else if !warnings.is_empty() {
        CompatStatus::Warning
    } else {
        CompatStatus::Ok
    };
    let can_proceed = blockers.is_empty();
    CompatReport { status, warnings, blockers, can_proceed }
}
