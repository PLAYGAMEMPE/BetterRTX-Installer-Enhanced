//! Motor de instalacion hibrido.
//!
//! Elige dinamicamente el mecanismo de instalacion mas seguro disponible:
//!
//! - **INDEX_REDIRECT** (preferido): parchea `materials.index.json` para
//!   apuntar a una subcarpeta `betterrtx/`. Los binarios vanilla quedan
//!   intactos; restaurar es simplemente revertir el JSON y borrar la carpeta.
//!
//! - **DIRECT_OVERWRITE** (fallback): sobrescribe los `.material.bin`
//!   directamente. Requiere backup verificado previo.

pub mod direct_overwrite;
pub mod index_redirect;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::app_core::{
    detection,
    permissions::{recommend, Confidence, InstallContext, InstallKind},
};
use crate::infra::error::AppError;

/// Mecanismo de instalacion elegido por el planificador.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Mechanism {
    /// Redirect via `materials.index.json` — no destructivo.
    IndexRedirect,
    /// Sobrescritura directa de `.material.bin` — requiere backup.
    DirectOverwrite,
}

/// Plan de instalacion calculado antes de tocar ningun archivo.
///
/// Se muestra al usuario para confirmar que el instalador ha elegido
/// la estrategia correcta para su entorno.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPlan {
    pub install_location: String,
    pub materials_dir: String,
    pub mechanism: Mechanism,
    pub provider: String,
    pub provider_confidence: Confidence,
    /// Siempre `true`: se hace backup antes de cualquier modificacion.
    pub backup_required: bool,
    /// Notas informativas para el usuario.
    pub notes: Vec<String>,
}

/// Calcula el `InstallPlan` optimo para una instalacion dada.
///
/// No modifica ningun archivo — solo lee el entorno.
pub fn plan_install(install_location: &str) -> InstallPlan {
    let cap = detection::scan_capabilities(install_location);
    let ctx = InstallContext {
        install_location: PathBuf::from(install_location),
        materials_dir: PathBuf::from(&cap.materials_dir),
        kind: cap.install_kind,
        directly_writable: cap.directly_writable,
    };
    let rec = recommend(&ctx);

    let mechanism = if cap.index_json_present && cap.index_json_valid {
        Mechanism::IndexRedirect
    } else {
        Mechanism::DirectOverwrite
    };

    let mut notes = cap.notes.clone();
    match mechanism {
        Mechanism::IndexRedirect => {
            notes.push("Instalacion no destructiva: los materiales vanilla quedan intactos.".into());
        }
        Mechanism::DirectOverwrite => {
            notes.push(
                "materials.index.json no encontrado o invalido: se usara sobrescritura directa."
                    .into(),
            );
            notes.push("Se creara un backup verificado antes de modificar ningun archivo.".into());
        }
    }

    InstallPlan {
        install_location: install_location.to_string(),
        materials_dir: cap.materials_dir,
        mechanism,
        provider: rec.provider,
        provider_confidence: rec.confidence,
        backup_required: true,
        notes,
    }
}

/// Parametros de una instalacion concreta (preset ya descargado a disco).
pub struct InstallParams<'a> {
    /// Directorio de materiales de la instalacion.
    pub materials_dir: &'a Path,
    /// Directorio de backup donde guardar los originales.
    pub backup_dir: &'a Path,
    /// Archivos del preset: `(nombre_de_archivo, ruta_origen)`.
    pub preset_files: &'a [(&'a str, &'a Path)],
    /// Plan calculado con [`plan_install`].
    pub plan: &'a InstallPlan,
    /// Journal para registrar mutaciones y permitir rollback.
    pub journal: &'a mut crate::app_core::permissions::recovery::Journal,
}

/// Ejecuta la instalacion segun el mecanismo del plan.
///
/// Debe llamarse despues de `PermissionProvider::acquire` y antes de
/// `PermissionProvider::release`.
pub fn execute(params: InstallParams<'_>) -> Result<(), AppError> {
    match params.plan.mechanism {
        Mechanism::IndexRedirect => {
            index_redirect::execute(params.materials_dir, params.preset_files, params.journal)
        }
        Mechanism::DirectOverwrite => {
            direct_overwrite::execute(
                params.materials_dir,
                params.backup_dir,
                params.preset_files,
                params.journal,
            )
        }
    }
}

#[allow(dead_code)]
/// Interpreta el string `install_kind` del `CapabilityReport` a `InstallKind`.
pub fn parse_install_kind(s: &str) -> InstallKind {
    match s {
        "XboxGames" => InstallKind::XboxGames,
        "WindowsApps" => InstallKind::WindowsApps,
        "Sideloaded" => InstallKind::Sideloaded,
        _ => InstallKind::Custom,
    }
}
